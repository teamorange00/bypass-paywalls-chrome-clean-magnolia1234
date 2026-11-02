import puppeteer from 'puppeteer';

const URL =
  'https://www.bloomberg.com/news/articles/2026-07-17/how-golf-influencers-are-changing-the-pga-tour';

const browser = await puppeteer.launch({
  headless: false,
  pipe: true,
  defaultViewport: { width: 1280, height: 900 },
  args: ['--disable-blink-features=AutomationControlled'],
});
const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
await new Promise((r) => setTimeout(r, 6000));

const info = await page.evaluate(() => {
  const scripts = [...document.querySelectorAll('script')].map((s) => ({
    type: s.type,
    props: s.getAttribute('data-component-props'),
    id: s.id,
    len: (s.textContent || '').length,
    head: (s.textContent || '').slice(0, 80),
  }));
  const interesting = scripts
    .filter((s) => s.len > 500 || s.props || s.id === '__NEXT_DATA__' || /ld\+json/i.test(s.type || ''))
    .slice(0, 40);

  let nextBody = null;
  const nd = document.getElementById('__NEXT_DATA__');
  if (nd) {
    try {
      const j = JSON.parse(nd.textContent);
      const s = JSON.stringify(j);
      nextBody = {
        keys: Object.keys(j.props?.pageProps || j).slice(0, 30),
        hasBody: /"body"\s*:/.test(s),
        len: s.length,
      };
    } catch (e) {
      nextBody = { err: e.message };
    }
  }

  const ld = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    try {
      let j = JSON.parse(s.textContent);
      if (Array.isArray(j)) j = j.find((x) => x && x.articleBody) || j[0];
      if (j)
        ld.push({
          type: j['@type'],
          headline: (j.headline || '').slice(0, 80),
          bodyLen: (j.articleBody || '').length,
        });
    } catch {}
  });

  // look for long text nodes that look like article paras
  const longParas = [...document.querySelectorAll('p')]
    .map((p) => (p.innerText || '').trim())
    .filter((t) => t.length > 80)
    .slice(0, 12);

  return {
    interestingScripts: interesting,
    nextBody,
    ld,
    longParas,
    paraCount: document.querySelectorAll('p').length,
    articleHtmlLen: (document.querySelector('article') || {}).innerHTML?.length || 0,
  };
});

console.log(JSON.stringify(info, null, 2));
await browser.close();
