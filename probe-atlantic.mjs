import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);
const URL =
  'https://www.theatlantic.com/health/2026/07/cyclosporiasis-parasite-taco-bell-lettuce/687986/';

async function run(withExt) {
  const browser = await puppeteer.launch({
    headless: false,
    pipe: true,
    defaultViewport: { width: 1280, height: 900 },
    enableExtensions: withExt ? [extensionPath] : false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  try {
    if (withExt) {
      await browser.waitForTarget(
        (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
        { timeout: 20000 }
      );
    }
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 8000));
    const info = await page.evaluate(() => {
      const text = document.body ? document.body.innerText : '';
      const hits = [];
      document.querySelectorAll('div, section, aside, dialog').forEach((el) => {
        const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
        if (!t || t.length > 400) return;
        if (/to read this story|sign in|start a free trial|free trial/i.test(t) && /sign in|free trial|subscribe/i.test(t)) {
          hits.push({
            tag: el.tagName,
            id: el.id,
            className: String(el.className).slice(0, 160),
            testid: el.getAttribute('data-testid') || el.getAttribute('data-test-id'),
            text: t.slice(0, 220),
          });
        }
      });
      const article = document.querySelector('article, [class*="ArticleBody"], main');
      return {
        title: document.title,
        hasHideCss: !!document.getElementById('bpc_atlantic_hide_css'),
        signInCopy: /to read this story|start a free trial/i.test(text),
        hasCyclospora: /cyclosporiasis|Taco Bell|shredded lettuce/i.test(text),
        articleLen: article ? article.innerText.trim().length : 0,
        hits: hits.slice(0, 15),
        articleViewsCookie: document.cookie.includes('articleViews'),
      };
    });
    console.log(withExt ? 'WITH_EXT' : 'NO_EXT', JSON.stringify(info, null, 2));
  } finally {
    await browser.close();
  }
}

await run(false);
await run(true);
