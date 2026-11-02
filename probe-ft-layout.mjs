import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL =
  'https://www.ft.com/content/8a424dc2-13cb-4eb6-86d0-a3193d710359';

async function probe(withExt) {
  const browser = await puppeteer.launch({
    headless: false,
    pipe: true,
    defaultViewport: { width: 1400, height: 900 },
    enableExtensions: withExt ? [path.resolve(__dirname)] : false,
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
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 7000));
    const info = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const article = document.querySelector('article, .article__content, main');
      const narrow = [];
      document.querySelectorAll('h1, article, .n-content-body, [class*="article"], main').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.width < 200) {
          const st = getComputedStyle(el);
          narrow.push({
            tag: el.tagName,
            cls: String(el.className).slice(0, 100),
            w: Math.round(r.width),
            display: st.display,
            grid: st.gridTemplateColumns,
            maxW: st.maxWidth,
            width: st.width,
            style: (el.getAttribute('style') || '').slice(0, 160),
          });
        }
      });
      return {
        title: document.title,
        h1W: h1 ? Math.round(h1.getBoundingClientRect().width) : null,
        articleW: article ? Math.round(article.getBoundingClientRect().width) : null,
        bodyW: Math.round(document.body.getBoundingClientRect().width),
        narrow,
        restored: !!document.getElementById('bpc_ft_restored'),
      };
    });
    console.log(withExt ? 'WITH_EXT' : 'NO_EXT', JSON.stringify(info, null, 2));
  } finally {
    await browser.close();
  }
}

await probe(false);
await probe(true);
