import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: false,
  pipe: true,
  defaultViewport: { width: 1280, height: 900 },
  args: ['--disable-blink-features=AutomationControlled'],
});
const page = await browser.newPage();
await page.goto('https://www.telegraph.co.uk/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await new Promise((r) => setTimeout(r, 4000));
await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('button, a')];
  const btn = buttons.find((b) => /accept all|accept|agree/i.test((b.textContent || '').trim()));
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 1500));

const links = await page.evaluate(() => {
  return [...document.querySelectorAll('a[href]')]
    .map((a) => {
      const premium = !!(
        a.closest('[class*="premium"]') ||
        a.querySelector('[class*="premium"]') ||
        /premium/i.test(a.className)
      );
      return { href: a.href, text: (a.textContent || '').trim().slice(0, 80), premium };
    })
    .filter((x) => {
      try {
        const u = new URL(x.href);
        return u.hostname.endsWith('telegraph.co.uk') && /\/\d{4}\/\d{2}\/\d{2}\//.test(u.pathname);
      } catch {
        return false;
      }
    });
});

const premium = links.filter((l) => l.premium);
const pick = premium[0] || links[0];
console.log('premium count', premium.length, 'total dated', links.length);
console.log('pick', pick);

await page.goto(pick.href, { waitUntil: 'domcontentloaded', timeout: 90000 });
await new Promise((r) => setTimeout(r, 6000));

const info = await page.evaluate(() => {
  const html = document.documentElement.outerHTML;
  const text = document.body.innerText || '';
  const bodyEl = document.querySelector(
    'article, [itemprop="articleBody"], .articleBodyText, .article__content, main'
  );
  return {
    title: document.title,
    url: location.href,
    tinypass: /tinypass|piano\.io/i.test(html),
    subwall: !!document.querySelector('[class^="subwall"], [class*="subwall"], .premium-paywall, .tp-modal'),
    bodyLen: bodyEl ? bodyEl.innerText.trim().length : 0,
    paras: document.querySelectorAll('article p, [itemprop="articleBody"] p, .articleBodyText p').length,
    subscribe: /subscribe to unlock|already a subscriber|to continue reading/i.test(text.slice(0, 4000)),
    amphtml: (document.querySelector('link[rel="amphtml"]') || {}).href || null,
    sample: text.slice(0, 500).replace(/\s+/g, ' '),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
