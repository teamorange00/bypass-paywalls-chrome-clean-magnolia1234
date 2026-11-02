import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);
const ARTICLE =
  process.argv[2] ||
  'https://www.telegraph.co.uk/news/2026/07/18/tunbridge-wells-taps-run-dry-in-south-east-water-crisis/';

async function signals(page) {
  return page.evaluate(() => {
    const bodyEl = document.querySelector(
      'article, [itemprop="articleBody"], .articleBodyText, #bpc_telegraph_restored, main'
    );
    return {
      title: document.title,
      hasHideCss: !!document.getElementById('bpc_telegraph_hide_css'),
      bodyLen: bodyEl ? bodyEl.innerText.trim().length : 0,
      hasSubwall: !!document.querySelector('[class^="subwall"], .premium-paywall, .tp-modal'),
      hasRestored: !!document.getElementById('bpc_telegraph_restored'),
    };
  });
}

async function run(withExtension) {
  const browser = await puppeteer.launch({
    headless: false,
    pipe: true,
    defaultViewport: { width: 1280, height: 900 },
    enableExtensions: withExtension ? [extensionPath] : false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  try {
    if (withExtension) {
      await browser.waitForTarget(
        (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
        { timeout: 15000 }
      );
    }
    const page = await browser.newPage();
    await page.goto(ARTICLE, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 6000));
    const data = await signals(page);
    console.log(withExtension ? 'WITH_EXT' : 'NO_EXT', JSON.stringify(data, null, 2));
    return data;
  } finally {
    await browser.close();
  }
}

const noExt = await run(false);
const withExt = await run(true);
const ok = withExt.hasHideCss && withExt.bodyLen > 800 && !withExt.hasSubwall;
if (!ok) {
  console.error('FAIL telegraph');
  process.exit(1);
}
console.log('PASS telegraph', { noExtBody: noExt.bodyLen, withExtBody: withExt.bodyLen });
