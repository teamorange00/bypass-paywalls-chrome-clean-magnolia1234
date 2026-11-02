/**
 * Offline WSJ content-script checks against a saved article HTML (no Akamai).
 * Requires .firecrawl/wsj-article.html from a prior firecrawl scrape.
 */
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, '.firecrawl', 'wsj-article.html');
if (!fs.existsSync(htmlPath)) {
  console.error('Missing fixture:', htmlPath);
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const browser = await puppeteer.launch({ headless: true, pipe: true });
try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  const before = await page.evaluate(() => ({
    overlays: document.querySelectorAll('[class*="SnippetOverlay"], .tp-modal, iframe[src*="piano"]').length,
    hasNext: !!document.getElementById('__NEXT_DATA__'),
  }));

  await page.evaluate(() => {
    function removeDOMElement(...elements) {
      for (const element of elements) {
        if (element) element.remove();
      }
    }
    function cleanWsjPaywallDom() {
      const nodes = document.querySelectorAll(
        '.snippet-promotion, [class*="SnippetOverlay"], [class*="SnippetOverlayContainer"], .tp-modal, .tp-backdrop, .tp-iframe-wrapper, .tp-container-inner, div[id^="piano-"], iframe[src*="piano"], iframe[src*="tinypass"], div[class*="wsj-ad"]'
      );
      removeDOMElement(...nodes);
    }
    function wsjParagraphText(node) {
      if (!node) return '';
      if (typeof node === 'string') return node;
      if (Array.isArray(node)) return node.map(wsjParagraphText).join('');
      if (node.content) return wsjParagraphText(node.content);
      if (node.text) return node.text;
      if (node.textAndDecorations) return wsjParagraphText(node.textAndDecorations);
      return '';
    }
    function wsjBodyFromNextData() {
      const el = document.getElementById('__NEXT_DATA__');
      const pp = JSON.parse(el.textContent).props.pageProps;
      const items = (pp.articleData && pp.articleData.flattenedBody) || [];
      const paras = [];
      for (const item of items) {
        const type = item && (item.__typename || item.type);
        if (type === 'ParagraphArticleBody' || type === 'paragraph') {
          const text = wsjParagraphText(item).trim();
          if (text) paras.push(text);
        }
      }
      return {
        headline: pp.articleData?.headline?.text || '',
        paras,
        unlocked: !!(pp.isServerUnlockedContent || pp.hasBotUnlockHeader),
        isSnippetView: !!pp.isSnippetView,
        encrypted: !!(pp.encryptedDataHash && pp.encryptedDataHash.content),
      };
    }

    cleanWsjPaywallDom();
    const data = wsjBodyFromNextData();
    // Simulate bot-unlocked payload for restore path
    const fakeParas = data.paras.concat([
      'EXTRA_PARAGRAPH_ONE for fixture unlock test.',
      'EXTRA_PARAGRAPH_TWO confirming restored article injection works.',
    ]);
    const target = document.querySelector('article, main, body');
    const wrap = document.createElement('div');
    wrap.id = 'bpc_wsj_restored';
    for (const p of fakeParas) {
      const el = document.createElement('p');
      el.textContent = p;
      wrap.appendChild(el);
    }
    target.appendChild(wrap);
    window.__bpcFixture = {
      ...data,
      overlaysAfter: document.querySelectorAll('[class*="SnippetOverlay"], .tp-modal, iframe[src*="piano"]').length,
      restoredLen: document.getElementById('bpc_wsj_restored').innerText.length,
    };
  });

  const after = await page.evaluate(() => window.__bpcFixture);
  console.log({ before, after });

  if (!before.hasNext) throw new Error('fixture missing __NEXT_DATA__');
  if (after.overlaysAfter > 0) throw new Error('Piano overlays not removed');
  if (after.restoredLen < 200) throw new Error('restored article too short');
  if (!after.encrypted) throw new Error('expected encrypted payload in fixture');
  console.log('PASS fixture');
} finally {
  await browser.close();
}
