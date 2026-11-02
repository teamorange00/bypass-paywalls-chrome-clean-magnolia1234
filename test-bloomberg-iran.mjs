import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL =
  'https://www.bloomberg.com/news/articles/2026-07-18/iran-ramps-up-retaliatory-attack-on-kuwait-after-us-escalation';

const browser = await puppeteer.launch({
  headless: false,
  pipe: true,
  defaultViewport: { width: 1280, height: 900 },
  enableExtensions: [path.resolve(__dirname)],
  args: ['--disable-blink-features=AutomationControlled'],
});

try {
  await browser.waitForTarget(
    (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
    { timeout: 20000 }
  );
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 10000));

  const info = await page.evaluate(() => {
    const bs = getComputedStyle(document.body);
    const hs = getComputedStyle(document.documentElement);
    const restored = document.getElementById('bpc_bbg_restored');
    return {
      bodyPe: bs.pointerEvents,
      htmlPe: hs.pointerEvents,
      bodyOverflow: bs.overflow,
      stopScroll: /stopScroll/i.test(document.body.className || ''),
      slidingBanner: !!document.getElementById('slidingBanner'),
      fortress: !!document.querySelector('#fortress-container-root, #fortress-paywall-container-root'),
      restored: !!restored,
      restoredLen: restored ? restored.innerText.trim().length : 0,
      hasKuwait: /Kuwait|Iran|Tehran/i.test((restored || document.body).innerText),
    };
  });

  // Click test: page should accept pointer events
  const clickable = info.bodyPe === 'auto' && info.htmlPe === 'auto';

  const pass =
    clickable &&
    !info.stopScroll &&
    !info.slidingBanner &&
    info.restored &&
    info.restoredLen > 1000 &&
    info.hasKuwait;

  console.log(JSON.stringify({ pass, clickable, ...info }, null, 2));
  process.exitCode = pass ? 0 : 1;
} finally {
  await browser.close();
}
