/**
 * Probe whether Googlebot UA on /client returns documentKey (page stays normal Brave).
 */
import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const brave = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
const ext = path.resolve(__dirname);
const profile = path.join(ext, '.brave-bpc-probe-profile');
const url =
  process.argv[2] ||
  'https://www.wsj.com/lifestyle/relationships/ceo-parent-nanny-assistant-teams-hiring-20d3a9c0';

const browser = await puppeteer.launch({
  headless: false,
  executablePath: brave,
  pipe: true,
  defaultViewport: null,
  enableExtensions: [ext],
  userDataDir: profile,
  args: ['--disable-blink-features=AutomationControlled'],
});

const page = await browser.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await new Promise((r) => setTimeout(r, 4000));

// From extension SW context we can't easily set UA per fetch from page.
// Use CDP Network.setExtraHTTPHeaders? Better: page.evaluate can't change UA of fetch.
// Use page.setUserAgent temporarily then fetch via page.evaluate — actually fetch uses page UA.
const GOOGLEBOT =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const pp = await page.evaluate(() => {
  const nd = document.getElementById('__NEXT_DATA__');
  const p = JSON.parse(nd.textContent).props.pageProps;
  return {
    encKey: p.encryptedDocumentKey,
    path: location.pathname + location.search,
    client: (p.endpoints && p.endpoints.entitlements) || 'https://www.wsj.com/client?legacy=false',
    hasHash: !!(p.encryptedDataHash && p.encryptedDataHash.content),
  };
});

async function clientWith(ua, referer, xUrl) {
  const ctx = await browser.createBrowserContext();
  const p2 = await ctx.newPage();
  await p2.setUserAgent(ua);
  await p2.setExtraHTTPHeaders({
    'X-ENCRYPTED-DOCUMENT-KEY': pp.encKey,
    'x-original-host': 'www.wsj.com',
    'x-original-referrer': referer,
    'x-original-url': xUrl,
    Referer: referer,
  });
  const resp = await p2.goto(pp.client, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => e);
  let body = '';
  let status = 0;
  if (resp && resp.status) {
    status = resp.status();
    body = await resp.text().catch(() => '');
  } else if (resp && resp.message) {
    body = resp.message;
  }
  await ctx.close();
  let j = {};
  try {
    j = JSON.parse(body);
  } catch {}
  return {
    ua: ua.slice(0, 40),
    status,
    hasDocKey: !!j.documentKey,
    type: j.type,
    sample: body.slice(0, 180),
  };
}

const results = [];
results.push(await clientWith(GOOGLEBOT, 'https://www.google.com/', pp.path));
results.push(
  await clientWith(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'https://www.google.com/',
    pp.path
  )
);

// Also try main document with Googlebot in fresh context — does SSR unlock?
const ctx3 = await browser.createBrowserContext();
const p3 = await ctx3.newPage();
await p3.setUserAgent(GOOGLEBOT);
await p3.setExtraHTTPHeaders({ Referer: 'https://www.google.com/' });
const r3 = await p3.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => null);
const htmlInfo = await p3.evaluate(() => {
  const t = document.title;
  const body = (document.body && document.body.innerText) || '';
  const nd = document.getElementById('__NEXT_DATA__');
  let unlocked = null;
  let paras = 0;
  if (nd) {
    try {
      const pp = JSON.parse(nd.textContent).props.pageProps;
      unlocked = !!(pp.isServerUnlockedContent || pp.hasBotUnlockHeader || pp.isFreeArticle);
      paras = ((pp.articleData && pp.articleData.flattenedBody) || []).filter((x) =>
        String(x.__typename || x.type || '').includes('Paragraph')
      ).length;
    } catch {}
  }
  return {
    title: t,
    statusHint: /Access temporarily restricted|captcha|Pardon Our Interruption/i.test(body)
      ? 'akamai'
      : 'ok',
    unlocked,
    paras,
    sample: body.slice(0, 200).replace(/\s+/g, ' '),
  };
});
await ctx3.close();

console.log(JSON.stringify({ clientTries: results, googlebotMainDoc: htmlInfo, hasHash: pp.hasHash }, null, 2));
await browser.close();
