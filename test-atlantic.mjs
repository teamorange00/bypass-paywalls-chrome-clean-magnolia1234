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
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  );
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 10000));

  const info = await page.evaluate(() => {
    const body =
      document.querySelector('section[class*="ArticleBody"], [class*="ArticleBody_root"]') ||
      document.querySelector('article');
    const text = body ? body.innerText : '';
    return {
      hasGateToast: !!document.getElementById('gate-toast'),
      gateVisible: (() => {
        const el = document.getElementById('gate-toast');
        if (!el) return false;
        const st = getComputedStyle(el);
        return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
      })(),
      phraseInBody: /to read this story/i.test(document.body.innerText),
      articleLen: text.trim().length,
      paraCount: body ? body.querySelectorAll('p').length : 0,
      hasTaylor: /Taylor Farms/i.test(text),
      hasEnd: /Americans won’t know that unless the CDC says something/i.test(text),
      hasHideCss: !!document.getElementById('bpc_atlantic_hide_css'),
      articleViewsCookie: document.cookie.includes('articleViews'),
      restored: !!document.querySelector('.bpc-atlantic-restored') || text.length > 5000,
    };
  });

  const pass =
    !info.hasGateToast &&
    !info.gateVisible &&
    !info.phraseInBody &&
    info.articleLen > 5000 &&
    info.hasTaylor &&
    info.hasEnd;

  console.log(JSON.stringify({ pass, ...info }, null, 2));
  process.exitCode = pass ? 0 : 1;
} finally {
  await browser.close();
}
