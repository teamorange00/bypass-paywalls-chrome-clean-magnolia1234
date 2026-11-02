import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL =
  'https://www.ft.com/content/eb0cd740-e45d-4dd7-ab9a-6f6643bb32ee?syn-25a6b1a6=1';

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
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch((e) => {
      errors.push('nav:' + String(e).slice(0, 100));
    });
    await new Promise((r) => setTimeout(r, 8000));

    const info = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const article =
        document.querySelector('.n-content-body, .article__content, article, main') ||
        document.body;
      const hr = h1 ? h1.getBoundingClientRect() : null;
      const ar = article.getBoundingClientRect();
      const narrow = [];
      document.querySelectorAll('h1, article, .n-content-body, .n-layout__row--content, main').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.width < 220) {
          const st = getComputedStyle(el);
          narrow.push({
            tag: el.tagName,
            cls: String(el.className).slice(0, 80),
            w: Math.round(r.width),
            display: st.display,
            style: (el.getAttribute('style') || '').slice(0, 120),
          });
        }
      });
      return {
        title: document.title,
        h1: h1 ? h1.innerText.trim().slice(0, 120) : null,
        h1W: hr ? Math.round(hr.width) : null,
        articleW: Math.round(ar.width),
        bodyLen: (document.body.innerText || '').trim().length,
        articleLen: (article.innerText || '').trim().length,
        restored: !!document.getElementById('bpc_ft_restored'),
        layoutCss: !!document.getElementById('bpc_ft_layout_css'),
        subscribeTitle: document.title === 'Subscribe to read',
        narrow,
        snippet: (article.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 220),
      };
    });

    console.log(
      withExt ? 'WITH_EXT' : 'NO_EXT',
      JSON.stringify(
        {
          ...info,
          layoutOk: info.h1W > 400 && info.articleW > 400 && info.narrow.length === 0,
          errors: errors.filter((e) => /matches|Illegal return|TypeError/i.test(e)).slice(0, 8),
        },
        null,
        2
      )
    );
  } finally {
    await browser.close();
  }
}

await probe(false);
await probe(true);
