/**
 * Does a Google Referer (no Googlebot UA) unlock WSJ SSR in Brave?
 */
import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const brave = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
const url =
  process.argv[2] ||
  'https://www.wsj.com/lifestyle/relationships/ceo-parent-nanny-assistant-teams-hiring-20d3a9c0';

const browser = await puppeteer.launch({
  headless: false,
  executablePath: brave,
  pipe: true,
  defaultViewport: null,
  userDataDir: path.join(__dirname, '.brave-bpc-referer-profile'),
  args: ['--disable-blink-features=AutomationControlled'],
});

const page = await browser.newPage();
await page.setExtraHTTPHeaders({ Referer: 'https://www.google.com/' });
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await new Promise((r) => setTimeout(r, 5000));

const info = await page.evaluate(() => {
  const nd = document.getElementById('__NEXT_DATA__');
  if (!nd) {
    return {
      title: document.title,
      sample: (document.body.innerText || '').slice(0, 240),
      noNext: true,
    };
  }
  const pp = JSON.parse(nd.textContent).props.pageProps;
  const paras = ((pp.articleData && pp.articleData.flattenedBody) || []).filter((x) =>
    String(x.__typename || x.type || '').includes('Paragraph')
  );
  return {
    title: document.title,
    isSnippetView: pp.isSnippetView,
    unlocked: !!(pp.isServerUnlockedContent || pp.hasBotUnlockHeader || pp.isFreeArticle),
    paraCount: paras.length,
    hasDocKeyEndpoint: !!(pp.encryptedDocumentKey && pp.encryptedDataHash),
    firstPara: paras[0] ? JSON.stringify(paras[0]).slice(0, 120) : null,
  };
});

console.log(JSON.stringify(info, null, 2));
await browser.close();
