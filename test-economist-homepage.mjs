import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);

async function load(url, withExt) {
  const browser = await puppeteer.launch({
    headless: false,
    pipe: true,
    defaultViewport: { width: 1200, height: 800 },
    enableExtensions: withExt ? [extensionPath] : false,
    args: ['--disable-blink-features=AutomationControlled'],
    protocolTimeout: 60000,
  });
  try {
    if (withExt) {
      await browser.waitForTarget(
        (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
        { timeout: 20000 }
      );
    }
    const page = await browser.newPage();
    const t0 = Date.now();
    let err = null;
    let status = null;
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      status = resp && resp.status();
    } catch (e) {
      err = String(e).slice(0, 140);
    }
    await new Promise((r) => setTimeout(r, 4000));
    const info = await page.evaluate(() => ({
      title: document.title,
      bodyLen: document.body ? document.body.innerText.trim().length : 0,
      hasHide: !!document.getElementById('bpc_econ_hide_css'),
    })).catch((e) => ({ evalErr: String(e).slice(0, 100) }));
    return { url, withExt, ms: Date.now() - t0, status, err, info };
  } finally {
    await browser.close();
  }
}

const home = 'https://www.economist.com/';
const article =
  'https://www.economist.com/finance-and-economics/2026/07/17/americas-central-bank-has-a-new-boss';

const results = [];
results.push(await load(home, true));
results.push(await load(article, true));

const homeOk = results[0].status === 200 && results[0].info.bodyLen > 500 && !results[0].err;
const articleOk =
  results[1].status === 200 &&
  results[1].info.bodyLen > 200 &&
  !results[1].err;

console.log(JSON.stringify({ pass: homeOk && articleOk, homeOk, articleOk, results }, null, 2));
process.exitCode = homeOk && articleOk ? 0 : 1;
