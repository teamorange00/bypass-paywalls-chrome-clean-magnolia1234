import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);

const URLS = [
  'https://www.ft.com/',
  'https://www.ft.com/world',
];

async function findArticleUrl(page) {
  return page.evaluate(() => {
    const a = [...document.querySelectorAll('a[href*="/content/"]')].find((el) =>
      /\/content\/[a-f0-9-]{20,}/i.test(el.getAttribute('href') || '')
    );
    return a ? a.href : null;
  });
}

async function probe(url, withExt) {
  const browser = await puppeteer.launch({
    headless: false,
    pipe: true,
    defaultViewport: { width: 1280, height: 900 },
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
    let status = null;
    let navErr = null;
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
      status = resp && resp.status();
    } catch (e) {
      navErr = String(e).slice(0, 140);
    }
    await new Promise((r) => setTimeout(r, 6000));

    const info = await page
      .evaluate(() => {
        const body = document.body;
        const text = body ? body.innerText : '';
        return {
          title: document.title,
          bodyLen: text.trim().length,
          subscribeTitle: document.title === 'Subscribe to read',
          barrier: !!document.querySelector(
            '#barrier-page, .barrier, [data-trackable="paywall"], .subscription-prompt'
          ),
          restored: !!document.getElementById('bpc_ft_restored'),
          restoredLen: (document.getElementById('bpc_ft_restored') || {}).innerText
            ? document.getElementById('bpc_ft_restored').innerText.trim().length
            : 0,
          articleBodyLen: (
            document.querySelector('.n-content-body, .js-article__content-body, .article__content') ||
            body
          ).innerText.trim().length,
          snippet: text.replace(/\s+/g, ' ').trim().slice(0, 220),
        };
      })
      .catch((e) => ({ evalErr: String(e).slice(0, 120) }));

    let article = null;
    if (/ft\.com\/?$/i.test(url) || /\/world\/?$/i.test(url)) {
      const href = await findArticleUrl(page).catch(() => null);
      article = href;
    }

    return { url, withExt, status, navErr, info, article };
  } finally {
    await browser.close();
  }
}

const home = await probe(URLS[0], true);
console.log('HOME_EXT', JSON.stringify(home, null, 2));

let articleUrl = home.article;
if (!articleUrl) {
  const homeNo = await probe(URLS[0], false);
  articleUrl = homeNo.article;
  console.log('HOME_NOEXT_ARTICLE', articleUrl);
}

if (articleUrl) {
  const artExt = await probe(articleUrl, true);
  console.log('ARTICLE_EXT', JSON.stringify(artExt, null, 2));
  const artNo = await probe(articleUrl, false);
  console.log('ARTICLE_NOEXT', JSON.stringify(artNo, null, 2));

  const pass =
    home.status === 200 &&
    home.info.bodyLen > 500 &&
    artExt.status === 200 &&
    (artExt.info.restored || artExt.info.articleBodyLen > 1200) &&
    !artExt.info.subscribeTitle;

  console.log(JSON.stringify({ pass, articleUrl }, null, 2));
  process.exitCode = pass ? 0 : 1;
} else {
  console.log(JSON.stringify({ pass: false, reason: 'no article url' }, null, 2));
  process.exitCode = 1;
}
