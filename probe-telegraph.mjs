import puppeteer from 'puppeteer';
import fs from 'fs';

const browser = await puppeteer.launch({
  headless: false,
  pipe: true,
  defaultViewport: { width: 1280, height: 900 },
  args: ['--disable-blink-features=AutomationControlled'],
});
const page = await browser.newPage();
await page.goto('https://www.telegraph.co.uk/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await new Promise((r) => setTimeout(r, 5000));

// dismiss cookies
await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('button, a')];
  const btn = buttons.find((b) => /accept|agree|consent/i.test((b.textContent || '').trim()));
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 1500));

const link = await page.evaluate(() => {
  const links = [...document.querySelectorAll('a[href]')];
  const hit = links.find((a) => {
    try {
      const u = new URL(a.href, location.origin);
      return (
        u.hostname.endsWith('telegraph.co.uk') &&
        /\/\d{4}\/\d{2}\/\d{2}\//.test(u.pathname) &&
        !/\/amp\//.test(u.pathname)
      );
    } catch {
      return false;
    }
  });
  return hit ? hit.href : null;
});
console.log('article', link);
if (!link) {
  console.log('title', await page.title());
  console.log('sample', await page.evaluate(() => (document.body.innerText || '').slice(0, 300)));
  await browser.close();
  process.exit(2);
}

await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 90000 });
await new Promise((r) => setTimeout(r, 5000));

const info = await page.evaluate(() => {
  const html = document.documentElement.outerHTML;
  const text = document.body ? document.body.innerText : '';
  let next = null;
  try {
    const el = document.getElementById('__NEXT_DATA__');
    if (el) next = Object.keys(JSON.parse(el.textContent).props?.pageProps || {});
  } catch {}
  return {
    title: document.title,
    url: location.href,
    tinypass: /tinypass|piano/i.test(html),
    nextKeys: next,
    hasNext: !!document.getElementById('__NEXT_DATA__'),
    ldArticleBody: [...document.querySelectorAll('script[type="application/ld+json"]')].some((s) => {
      try {
        const j = JSON.parse(s.textContent);
        const arr = Array.isArray(j) ? j : [j];
        return arr.some((x) => x && x.articleBody && String(x.articleBody).length > 400);
      } catch {
        return false;
      }
    }),
    subwall: !!document.querySelector('[class^="subwall"], [class*="subwall"], .premium-paywall'),
    articleParas: document.querySelectorAll('article p, .articleBodyText p, [itemprop="articleBody"] p').length,
    sample: text.slice(0, 400).replace(/\s+/g, ' '),
    paywallClasses: [...document.querySelectorAll('[class*="paywall"], [class*="subwall"], [class*="premium"]')]
      .slice(0, 12)
      .map((el) => el.className.toString().slice(0, 80)),
  };
});
console.log(JSON.stringify(info, null, 2));
fs.writeFileSync(
  '.firecrawl/telegraph-article-url.txt',
  link + '\n' + JSON.stringify(info, null, 2)
);
await browser.close();
