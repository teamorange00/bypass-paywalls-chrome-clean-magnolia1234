import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);
const URL =
  'https://www.economist.com/finance-and-economics/2026/07/16/how-to-shrink-the-feds-7trn-balance-sheet';

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
    await new Promise((r) => setTimeout(r, 7000));

    const info = await page.evaluate(() => {
      const text = document.body ? document.body.innerText : '';
      const hits = [];
      document.querySelectorAll('div, section, aside, dialog').forEach((el) => {
        const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
        if (!t || t.length > 500) return;
        if (/Continue with a free trial|Get full access to our independent journalism|Free trial/i.test(t)) {
          hits.push({
            tag: el.tagName,
            id: el.id,
            className: String(el.className).slice(0, 180),
            testid: el.getAttribute('data-testid') || el.getAttribute('data-test-id'),
            text: t.slice(0, 240),
          });
        }
      });

      let next = null;
      try {
        const pp = JSON.parse(document.getElementById('__NEXT_DATA__').textContent).props.pageProps;
        const body = (pp.content && pp.content.body) || [];
        next = {
          walled: pp.walled,
          isSubscriber: pp.isSubscriber,
          bodyBlocks: body.length,
          headline: pp.content && pp.content.headline,
          firstLens: body.slice(0, 3).map((b) => ({ type: b.type, len: (b.text || '').length })),
        };
      } catch (e) {
        next = { err: e.message };
      }

      const restored = document.getElementById('bpc_econ_restored');
      return {
        title: document.title,
        hasHideCss: !!document.getElementById('bpc_econ_hide_css'),
        freeTrialCopy: /Continue with a free trial|Get full access to our independent journalism/i.test(text),
        hits: hits.slice(0, 12),
        next,
        restoredLen: restored ? restored.innerText.length : 0,
        restoredParas: restored ? restored.querySelectorAll('p').length : 0,
      };
    });
    console.log(withExt ? 'WITH_EXT' : 'NO_EXT', JSON.stringify(info, null, 2));
    return info;
  } finally {
    await browser.close();
  }
}

await run(false);
await run(true);
