import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);
const URL =
  'https://www.bloomberg.com/news/articles/2026-07-17/how-golf-influencers-are-changing-the-pga-tour';

async function run(withExt) {
  const browser = await puppeteer.launch({
    headless: false,
    pipe: true,
    defaultViewport: { width: 1280, height: 900 },
    enableExtensions: withExt ? [extensionPath] : false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  try {
    if (withExt) {
      await browser.waitForTarget(
        (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
        { timeout: 15000 }
      );
    }
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 8000));
    const info = await page.evaluate(() => {
      const text = document.body ? document.body.innerText : '';
      const hits = [];
      document.querySelectorAll('div, section, aside, dialog').forEach((el) => {
        const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
        if (!t || t.length > 500) return;
        if (/Subscribe now for unlimited access|Claim This Offer|Cancel anytime/i.test(t)) {
          hits.push({
            tag: el.tagName,
            id: el.id,
            className: String(el.className).slice(0, 160),
            role: el.getAttribute('role'),
            testid: el.getAttribute('data-testid') || el.getAttribute('data-component'),
            text: t.slice(0, 220),
          });
        }
      });
      const jsonScripts = [...document.querySelectorAll('script[data-component-props]')].map((s) =>
        s.getAttribute('data-component-props')
      );
      const restored = document.getElementById('bpc_bbg_restored');
      return {
        title: document.title,
        hasHideCss: !!document.getElementById('bpc_bbg_hide_css'),
        hasFortress: !!document.querySelector('#fortress-paywall-container-root'),
        subscribeCopy: /Subscribe now for unlimited access/i.test(text),
        claimOffer: /Claim This Offer/i.test(text),
        hits: hits.slice(0, 15),
        jsonScripts: jsonScripts.slice(0, 20),
        restoredLen: restored ? restored.innerText.length : 0,
        bodyLen: (document.querySelector('article, .body-content, .body-copy, main') || document.body)
          .innerText.trim()
          .length,
        sample: text.slice(0, 600).replace(/\s+/g, ' '),
      };
    });
    console.log(withExt ? 'WITH_EXT' : 'NO_EXT', JSON.stringify(info, null, 2));
  } finally {
    await browser.close();
  }
}

await run(false);
await run(true);
