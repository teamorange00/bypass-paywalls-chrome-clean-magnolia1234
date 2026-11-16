import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);
const URL =
  'https://www.bloomberg.com/news/articles/2026-11-16/switzerland-s-economy-unexpectedly-grows-thanks-to-industry?srnd=homepage-americas';

// Regression: repeat visits engage a second scroll lock
// (_leaderboardParallaxWrapper_*: height:100vh; overflow-y:hidden on the
// page wrapper). Computed overflow on html/body looked fine while the
// wheel was stuck at 280px — so this test drives a real mouse wheel and
// asserts the viewport actually moves, on a first AND a repeat visit.
const browser = await puppeteer.launch({
  headless: false,
  pipe: true,
  defaultViewport: { width: 1400, height: 950 },
  enableExtensions: [extensionPath],
  userDataDir: path.join(__dirname, '.chrome-bbg-scrolltest'),
  args: ['--disable-blink-features=AutomationControlled'],
  protocolTimeout: 120000,
});

async function wheelToBottom(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 500));
  let y = 0;
  for (let i = 0; i < 8; i++) {
    await page.mouse.move(700, 450);
    await page.mouse.wheel({ deltaY: 700 });
    await new Promise((r) => setTimeout(r, 450));
    y = await page.evaluate(() => scrollY);
  }
  return y;
}

try {
  await browser.waitForTarget(
    (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
    { timeout: 20000 }
  );
  const page = await browser.newPage();
  const visits = [];
  for (let visit = 1; visit <= 2; visit++) {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 8000));
    const state = await page.evaluate(() => ({
      docSH: document.documentElement.scrollHeight,
      restored: !!document.getElementById('bpc_bbg_restored'),
      restoredLen: document.getElementById('bpc_bbg_restored')?.innerText.trim().length || 0,
      fortress: !!document.querySelector('#fortress-container-root, #slidingBanner'),
    }));
    const finalY = await wheelToBottom(page);
    const row = { visit, ...state, finalY };
    row.pass = state.restored && state.restoredLen > 1500 && !state.fortress && state.docSH > 3000 && finalY > 2000;
    visits.push(row);
    console.log(JSON.stringify(row, null, 2));
  }
  const pass = visits.every((v) => v.pass);
  console.log(pass ? 'PASS bloomberg scroll (both visits wheel to bottom)' : 'FAIL bloomberg scroll');
  process.exitCode = pass ? 0 : 1;
} finally {
  await browser.close();
}
