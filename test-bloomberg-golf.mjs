import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);
const URL =
  'https://www.bloomberg.com/news/articles/2026-07-17/how-golf-influencers-are-changing-the-pga-tour';

const browser = await puppeteer.launch({
  headless: false,
  pipe: true,
  defaultViewport: { width: 1280, height: 900 },
  enableExtensions: [extensionPath],
  args: ['--disable-blink-features=AutomationControlled'],
});

await browser.waitForTarget(
  (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
  { timeout: 15000 }
);
const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
await new Promise((r) => setTimeout(r, 7000));

const info = await page.evaluate(() => {
  const restored = document.getElementById('bpc_bbg_restored');
  const text = document.body.innerText || '';
  return {
    hasHideCss: !!document.getElementById('bpc_bbg_hide_css'),
    hasFortressRoot: !!document.querySelector('#fortress-container-root'),
    hasSlidingBanner: !!document.querySelector('#slidingBanner'),
    hasColumnWall: !!document.querySelector('[data-testid="column-wall"]'),
    claimOffer: /Claim This Offer/i.test(text),
    subscribeUnlimited: /Subscribe now for unlimited access/i.test(text),
    restoredLen: restored ? restored.innerText.length : 0,
    restoredParas: restored ? restored.querySelectorAll('p').length : 0,
    hasDeChambeau: /DeChambeau/i.test(restored ? restored.innerText : text),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();

const ok =
  info.hasHideCss &&
  !info.hasFortressRoot &&
  !info.hasSlidingBanner &&
  !info.claimOffer &&
  info.restoredLen > 2000 &&
  info.hasDeChambeau;

if (!ok) {
  console.error('FAIL bloomberg golf article');
  process.exit(1);
}
console.log('PASS bloomberg golf article');
