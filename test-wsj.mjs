import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);
const ARTICLE =
  process.argv[2] ||
  'https://www.wsj.com/politics/policy/a-look-inside-the-newly-public-election-intelligence-files-8d2a217f';

async function signals(page) {
  return page.evaluate(() => {
    const text = document.body ? document.body.innerText : '';
    let next = null;
    try {
      const el = document.getElementById('__NEXT_DATA__');
      if (el) next = JSON.parse(el.textContent).props.pageProps;
    } catch {}
    const restored = document.getElementById('bpc_wsj_restored');
    const articleEl = restored || document.querySelector('article, [class*="ArticleBody"]');
    return {
      url: location.href,
      title: document.title,
      bodyLen: text.length,
      verification: /Verification Required|temporarily restricted/i.test(text),
      subscribe: /Subscribe to continue reading|Continue reading your article with a WSJ/i.test(
        text.slice(0, 4000)
      ),
      restored: !!restored,
      articleLen: articleEl ? (articleEl.innerText || '').trim().length : 0,
      hasNext: !!next,
      isSnippetView: next?.isSnippetView ?? null,
      unlocked: !!(next?.isServerUnlockedContent || next?.hasBotUnlockHeader),
      flatLen: next?.articleData?.flattenedBody?.length ?? 0,
      wordCount: next?.articleData?.articleTrackingMeta?.articleWordCount ?? null,
      ua: navigator.userAgent,
      hasPianoOverlay: !!document.querySelector('[class*="SnippetOverlay"], .snippet-promotion, .tp-modal'),
    };
  });
}

async function run(withExtension) {
  const profile = path.join(__dirname, withExtension ? '.chrome-wsj-ext' : '.chrome-wsj-base');
  const browser = await puppeteer.launch({
    headless: false,
    channel: 'chrome',
    pipe: true,
    defaultViewport: { width: 1280, height: 900 },
    enableExtensions: withExtension ? [extensionPath] : false,
    userDataDir: profile,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  try {
    if (withExtension) {
      const sw = await browser.waitForTarget(
        (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
        { timeout: 20000 }
      );
      console.log('SERVICE_WORKER', sw.url());
    }

    const page = await browser.newPage();
    await page.goto('https://www.wsj.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 3500));
    console.log(withExtension ? 'HOME+EXT' : 'HOME', await signals(page));

    await page.goto(ARTICLE, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 8000));
    const art = await signals(page);
    console.log(withExtension ? 'ARTICLE+EXT' : 'ARTICLE', art);

    const shot = path.join(
      __dirname,
      '.firecrawl',
      withExtension ? 'wsj-test-ext.png' : 'wsj-test-base.png'
    );
    await page.screenshot({ path: shot });
    fs.writeFileSync(shot.replace('.png', '.json'), JSON.stringify(art, null, 2));
    return art;
  } finally {
    await browser.close();
  }
}

const base = await run(false);
const ext = await run(true);

const baseEmptyShell = base.bodyLen === 0 && /^(wsj\.com)?$/i.test((base.title || '').trim());
const extEmptyShell = ext.bodyLen === 0 && /^(wsj\.com)?$/i.test((ext.title || '').trim());
const baseLocked =
  base.verification ||
  base.subscribe ||
  baseEmptyShell ||
  (base.isSnippetView && !base.unlocked);
const extUnlocked =
  ext.restored ||
  ext.unlocked ||
  (!ext.subscribe && !ext.verification && !extEmptyShell && ext.articleLen > 2500) ||
  (ext.flatLen >= 5 && !ext.hasPianoOverlay);

console.log('\nRESULT', {
  baseLocked,
  extUnlocked,
  baseSubscribe: base.subscribe,
  extSubscribe: ext.subscribe,
  extRestored: ext.restored,
  extArticleLen: ext.articleLen,
  baseEmptyShell,
  extEmptyShell,
});

if ((base.verification && ext.verification) || (baseEmptyShell && extEmptyShell)) {
  console.log(
    'NOTE: Akamai blocked both runs (captcha/empty shell) — test manually via: node launch-dev.mjs "https://www.wsj.com/"'
  );
  process.exit(2);
}

if (!extUnlocked) {
  console.error('FAIL: extension did not unlock WSJ article');
  process.exit(1);
}
console.log('PASS');
