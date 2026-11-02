import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);
const URL =
  'https://www.thetimes.com/uk/transport/article/ees-airport-delays-europe-travel-advice-b62b993b7';

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
      const article = document.querySelector('article, [data-testid="article-body"], main');
      const hide = document.getElementById('bpc_times_hide_css');
      const paywallNodes = [...document.querySelectorAll('[class*="Paywall"], [class*="paywall"], .subscription-block, #paywall-portal-article-footer')]
        .slice(0, 10)
        .map((el) => ({
          tag: el.tagName,
          id: el.id,
          className: String(el.className).slice(0, 120),
          display: getComputedStyle(el).display,
          text: (el.innerText || '').slice(0, 100).replace(/\s+/g, ' '),
        }));
      let next = null;
      try {
        const el = document.getElementById('__NEXT_DATA__');
        if (el) {
          const j = JSON.parse(el.textContent);
          const s = JSON.stringify(j);
          next = {
            len: s.length,
            keys: Object.keys(j.props?.pageProps || {}).slice(0, 25),
            hasArticleBody: /articleBody|body\.text|richText/i.test(s),
          };
        }
      } catch (e) {
        next = { err: e.message };
      }
      const ld = [];
      document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
        try {
          let j = JSON.parse(s.textContent);
          if (Array.isArray(j)) j = j.find((x) => x && x.articleBody) || j[0];
          if (j) ld.push({ type: j['@type'], bodyLen: (j.articleBody || '').length, headline: (j.headline || '').slice(0, 60) });
        } catch {}
      });
      return {
        title: document.title,
        bodyTextLen: text.trim().length,
        articleTextLen: article ? article.innerText.trim().length : 0,
        hasHideCss: !!hide,
        hideCssSample: hide ? hide.textContent.slice(0, 300) : null,
        subscribeCopy: /Continue reading|Subscribe now|Start trial|Flash Sale/i.test(text),
        paywallNodes,
        next,
        ld,
        sample: text.slice(0, 500).replace(/\s+/g, ' '),
      };
    });
    console.log(withExt ? 'WITH_EXT' : 'NO_EXT', JSON.stringify(info, null, 2));
  } finally {
    await browser.close();
  }
}

await run(false);
await run(true);
