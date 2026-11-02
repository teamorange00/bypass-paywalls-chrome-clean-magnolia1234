import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);
const URL =
  'https://www.theatlantic.com/health/2026/07/cyclosporiasis-parasite-taco-bell-lettuce/687986/';

const browser = await puppeteer.launch({
  headless: false,
  pipe: true,
  defaultViewport: { width: 1280, height: 900 },
  enableExtensions: [extensionPath],
  args: ['--disable-blink-features=AutomationControlled'],
});

try {
  await browser.waitForTarget(
    (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
    { timeout: 20000 }
  );
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 8000));

  // Page JS should not see articleViews; jar should also be cleared shortly after Set-Cookie.
  const info = await page.evaluate(() => {
    return {
      jsCookieHasMeter: /articleViews=/i.test(document.cookie),
      rawCookie: document.cookie,
      gate: !!document.getElementById('gate-toast'),
      lastFree: /last free article/i.test(document.body.innerText),
      articleLen: (document.querySelector('[class*="ArticleBody"]') || document.querySelector('article') || document.body)
        .innerText.trim().length,
    };
  });

  // Check extension cookie jar via CDP
  const client = await page.createCDPSession();
  const jar = await client.send('Network.getCookies', { urls: [URL] });
  const meterCookie = (jar.cookies || []).find((c) => c.name === 'articleViews');

  // Wait a beat for onChanged remover
  await new Promise((r) => setTimeout(r, 1500));
  const jar2 = await client.send('Network.getCookies', { urls: [URL] });
  const meterCookie2 = (jar2.cookies || []).find((c) => c.name === 'articleViews');

  const pass =
    !info.jsCookieHasMeter &&
    !info.gate &&
    !info.lastFree &&
    info.articleLen > 4000 &&
    !meterCookie2;

  console.log(
    JSON.stringify(
      {
        pass,
        info,
        meterCookieAfterLoad: meterCookie || null,
        meterCookieAfterClear: meterCookie2 || null,
      },
      null,
      2
    )
  );
  process.exitCode = pass ? 0 : 1;
} finally {
  await browser.close();
}
