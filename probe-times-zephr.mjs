import puppeteer from 'puppeteer';

const URL =
  'https://www.thetimes.com/uk/transport/article/ees-airport-delays-europe-travel-advice-b62b993b7';

const browser = await puppeteer.launch({
  headless: false,
  pipe: true,
  defaultViewport: { width: 1280, height: 900 },
  args: ['--disable-blink-features=AutomationControlled'],
});
const page = await browser.newPage();

// Block Zephr like Verge
await page.setRequestInterception(true);
page.on('request', (req) => {
  const u = req.url();
  if (/zephr\.com|zephr-browser|tinypass\.com|piano\.io/i.test(u)) {
    req.abort();
    return;
  }
  req.continue();
});

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 10000));

const info = await page.evaluate(() => {
  const article = document.querySelector('article, [data-testid="article-body"], main');
  const text = article ? article.innerText.trim() : '';
  const scripts = [...document.querySelectorAll('script')]
    .filter((s) => (s.textContent || '').length > 2000)
    .map((s) => ({
      id: s.id,
      type: s.type,
      len: s.textContent.length,
      head: s.textContent.slice(0, 100).replace(/\s+/g, ' '),
      hasBody: /articleBody|richText|bodyText|\"blocks\"/i.test(s.textContent),
    }))
    .slice(0, 20);

  // Find longest paragraph-ish text
  const paras = [...document.querySelectorAll('p')]
    .map((p) => p.innerText.trim())
    .filter((t) => t.length > 40);

  return {
    title: document.title,
    articleLen: text.length,
    paraCount: paras.length,
    longestPara: paras.sort((a, b) => b.length - a.length)[0]?.slice(0, 200),
    zephrLeft: !!document.querySelector('.zephr-paywall, [class*="zephr"]'),
    scripts,
    bodySample: text.slice(0, 800),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
