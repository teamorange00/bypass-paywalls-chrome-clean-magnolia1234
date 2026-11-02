import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);
const URL =
  'https://www.economist.com/finance-and-economics/2026/07/16/how-to-shrink-the-feds-7trn-balance-sheet';

const browser = await puppeteer.launch({
  headless: false,
  pipe: true,
  defaultViewport: { width: 1280, height: 900 },
  enableExtensions: [extensionPath],
  args: ['--disable-blink-features=AutomationControlled'],
});

await browser.waitForTarget(
  (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
  { timeout: 20000 }
);
const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 12000));

const info = await page.evaluate(() => {
  const text = document.body ? document.body.innerText : '';
  return {
    title: document.title,
    hasHideCss: !!document.getElementById('bpc_econ_hide_css'),
    tpRegwall: !!document.querySelector('#tp-regwall'),
    regwallContainer: !!document.querySelector('#regwall-container'),
    freeTrial: /Continue with a free trial|Get full access to our independent journalism for free/i.test(text),
    restoredLen: document.getElementById('bpc_econ_restored')
      ? document.getElementById('bpc_econ_restored').innerText.length
      : 0,
    walled: (() => {
      try {
        return JSON.parse(document.getElementById('__NEXT_DATA__').textContent).props.pageProps.walled;
      } catch {
        return null;
      }
    })(),
    bodyBlocks: (() => {
      try {
        return JSON.parse(document.getElementById('__NEXT_DATA__').textContent).props.pageProps.content
          .body.length;
      } catch {
        return null;
      }
    })(),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();

if (!info.hasHideCss || info.tpRegwall || info.freeTrial) {
  console.error('FAIL economist free-trial wall still visible');
  process.exit(1);
}
console.log('PASS economist free-trial wall removed');
if (info.walled && info.bodyBlocks <= 2) {
  console.log('NOTE: SSR still teaser-only (walled); full text not in page data');
}
