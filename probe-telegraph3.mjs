import puppeteer from 'puppeteer';

const URL =
  'https://www.telegraph.co.uk/news/2026/07/18/tunbridge-wells-taps-run-dry-in-south-east-water-crisis/';

async function check(label, clearCookies) {
  const browser = await puppeteer.launch({
    headless: false,
    pipe: true,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page = await browser.newPage();
  if (clearCookies) {
    const client = await page.createCDPSession();
    await client.send('Network.clearBrowserCookies');
  }
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 10000));
  const info = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const bodyEl = document.querySelector(
      'article, [itemprop="articleBody"], .articleBodyText, .article__content, main'
    );
    return {
      title: document.title,
      bodyLen: bodyEl ? bodyEl.innerText.trim().length : 0,
      paras: document.querySelectorAll('article p, [itemprop="articleBody"] p').length,
      subwall: !!document.querySelector('[class^="subwall"], [class*="subwall"], .premium-paywall, .tp-modal, .tp-backdrop'),
      subscribe: /subscribe|already a subscriber|premium/i.test(text.slice(0, 2500)),
      tpIframes: document.querySelectorAll('iframe[src*="tinypass"], iframe[src*="piano"]').length,
      sampleEnd: (bodyEl ? bodyEl.innerText : text).slice(-300).replace(/\s+/g, ' '),
    };
  });
  console.log(label, JSON.stringify(info, null, 2));
  await browser.close();
}

await check('fresh', true);
