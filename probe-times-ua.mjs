import puppeteer from 'puppeteer';

const URL =
  'https://www.thetimes.com/business/entrepreneurs/article/camlin-boss-sale-siemens-lwbv6ggwv';
const FIREFOX =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0';

async function tryUa(label, ua, referer) {
  const browser = await puppeteer.launch({
    headless: false,
    pipe: true,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page = await browser.newPage();
  if (ua) await page.setUserAgent(ua);
  if (referer) await page.setExtraHTTPHeaders({ Referer: referer });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 6000));
  const info = await page.evaluate(() => {
    const bodyEl = document.querySelector('article, [data-testid="article-body"], main');
    return {
      title: document.title,
      bodyLen: bodyEl ? bodyEl.innerText.trim().length : 0,
      paras: document.querySelectorAll('article p').length,
      blocked: /Access Denied|Just a moment|Pardon Our Interruption/i.test(document.body.innerText.slice(0, 500)),
      paywall: !!document.querySelector('.subscription-block, [class*="Paywall"], #paywall-portal-article-footer'),
    };
  });
  console.log(label, JSON.stringify(info));
  await browser.close();
  return info;
}

await tryUa('default', null, null);
await tryUa('firefox+google-ref', FIREFOX, 'https://www.google.com/');
await tryUa('chrome+google-ref', null, 'https://www.google.com/');
