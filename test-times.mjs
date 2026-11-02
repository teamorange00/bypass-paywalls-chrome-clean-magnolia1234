import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);
const ARTICLE =
  process.argv[2] ||
  'https://www.thetimes.com/business/entrepreneurs/article/camlin-boss-sale-siemens-lwbv6ggwv';

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
    await new Promise((r) => setTimeout(r, 5000));
    const data = await page.evaluate(() => ({
      hasHideCss: !!document.getElementById('bpc_times_hide_css'),
      hasSubBlock: !!document.querySelector('.subscription-block, #paywall-portal-article-footer'),
      bodyLen: (document.querySelector('article') || document.body).innerText.trim().length,
    }));
    console.log(withExtension ? 'WITH_EXT' : 'NO_EXT', data);
    return data;
  } finally {
    await browser.close();
  }
}

const withExt = await run(true);
if (!withExt.hasHideCss) {
  console.error('FAIL times CS not injected');
  process.exit(1);
}
console.log('PASS times UI strip (full text still server-gated without Googlebot)');
