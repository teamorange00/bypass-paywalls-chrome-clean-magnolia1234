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
await new Promise((r) => setTimeout(r, 8000));

const info = await page.evaluate(() => {
  const body = document.body;
  const text = body ? body.innerText.trim() : '';
  return {
    title: document.title,
    bodyTextLen: text.length,
    hasNext: !!document.getElementById('__next') || !!document.getElementById('__NEXT_DATA__'),
    hasHideCss: !!document.getElementById('bpc_econ_hide_css'),
    tpRegwall: !!document.querySelector('#tp-regwall'),
    freeTrial: /Continue with a free trial/i.test(text),
    bodyHasTpActive: !!(body && body.classList.contains('tp-active')),
    cssHidesTpActive: ((document.getElementById('bpc_econ_hide_css') || {}).textContent || '').includes('.tp-active'),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();

if (info.bodyTextLen < 200 || !info.hasNext) {
  console.error('FAIL page looks blank/broken');
  process.exit(1);
}
if (info.cssHidesTpActive) {
  console.error('FAIL css still hides .tp-active');
  process.exit(1);
}
console.log('PASS economist page renders');
