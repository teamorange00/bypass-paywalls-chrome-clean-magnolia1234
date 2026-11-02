import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: false,
  pipe: true,
  defaultViewport: { width: 1280, height: 900 },
  args: ['--disable-blink-features=AutomationControlled'],
});
const page = await browser.newPage();
await page.goto('https://www.thetimes.co.uk/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await new Promise((r) => setTimeout(r, 5000));
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button, a')].find((b) =>
    /accept|agree|consent/i.test((b.textContent || '').trim())
  );
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 1500));

const link = await page.evaluate(() => {
  const hit = [...document.querySelectorAll('a[href]')].find((a) => {
    try {
      const u = new URL(a.href, location.origin);
      return (
        (u.hostname.endsWith('thetimes.co.uk') || u.hostname.endsWith('thetimes.com')) &&
        /\/article\//.test(u.pathname)
      );
    } catch {
      return false;
    }
  });
  return hit ? hit.href : null;
});
console.log('article', link);
if (!link) {
  console.log(await page.title());
  await browser.close();
  process.exit(2);
}

await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 90000 });
await new Promise((r) => setTimeout(r, 7000));

const info = await page.evaluate(() => {
  const html = document.documentElement.outerHTML;
  const text = document.body.innerText || '';
  const bodyEl = document.querySelector('article, [data-testid="article-body"], main');
  let nextKeys = null;
  try {
    const el = document.getElementById('__NEXT_DATA__');
    if (el) nextKeys = Object.keys(JSON.parse(el.textContent).props?.pageProps || {}).slice(0, 30);
  } catch {}
  return {
    title: document.title,
    url: location.href,
    bodyLen: bodyEl ? bodyEl.innerText.trim().length : 0,
    paras: document.querySelectorAll('article p, [data-testid="article-body"] p').length,
    subscriptionBlock: !!document.querySelector('.subscription-block, [class*="Paywall"], [class*="paywall"]'),
    tinypass: /tinypass|piano/i.test(html),
    hasNext: !!document.getElementById('__NEXT_DATA__'),
    nextKeys,
    ldBody: [...document.querySelectorAll('script[type="application/ld+json"]')].some((s) => {
      try {
        let j = JSON.parse(s.textContent);
        if (Array.isArray(j)) j = j.find((x) => x && x.articleBody) || j[0];
        return j && j.articleBody && String(j.articleBody).length > 400;
      } catch {
        return false;
      }
    }),
    sample: text.slice(0, 450).replace(/\s+/g, ' '),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
