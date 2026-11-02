import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);
const ARTICLE =
  process.argv[2] ||
  'https://www.economist.com/leaders/2026/07/16/its-too-darn-hot-blame-global-dimming';

async function signals(page) {
  return page.evaluate(() => {
    const text = document.body ? document.body.innerText : '';
    const restored = document.getElementById('bpc_econ_restored');
    let nextParas = 0;
    let walled = null;
    try {
      const pp = JSON.parse(document.getElementById('__NEXT_DATA__').textContent).props.pageProps;
      nextParas = (pp.content && pp.content.body && pp.content.body.length) || 0;
      walled = !!pp.walled;
    } catch {}
    return {
      title: document.title,
      hasHideCss: !!document.getElementById('bpc_econ_hide_css'),
      hasRestored: !!restored,
      restoredLen: restored ? restored.innerText.length : 0,
      restoredParas: restored ? restored.querySelectorAll('p').length : 0,
      nextParas,
      walled,
      hasRegwallUi: !!document.querySelector('[class*="regwall"], .layout-article-regwall, .tp-modal'),
      subscribeCopy: /Subscribe to continue|Become a subscriber|already a subscriber/i.test(text.slice(0, 3000)),
      cloudflare: /Just a moment|cf-challenge/i.test(text.slice(0, 500)),
    };
  });
}

async function run(withExtension) {
  const browser = await puppeteer.launch({
    headless: false,
    pipe: true,
    defaultViewport: { width: 1280, height: 900 },
    enableExtensions: withExtension ? [extensionPath] : false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  try {
    if (withExtension) {
      await browser.waitForTarget(
        (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
        { timeout: 15000 }
      );
    }
    const page = await browser.newPage();
    await page.goto(ARTICLE, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 6000));
    const data = await signals(page);
    console.log(withExtension ? 'WITH_EXT' : 'NO_EXT', JSON.stringify(data, null, 2));
    return data;
  } finally {
    await browser.close();
  }
}

const noExt = await run(false);
const withExt = await run(true);

const ok =
  withExt.hasHideCss &&
  withExt.hasRestored &&
  withExt.restoredLen > 200 &&
  !withExt.cloudflare &&
  (withExt.restoredParas >= noExt.restoredParas || withExt.restoredLen >= 200);

if (!ok) {
  console.error('FAIL economist bypass incomplete (may be teaser-only SSR when walled)');
  process.exit(withExt.cloudflare ? 2 : 1);
}
console.log('PASS economist UI strip + NEXT_DATA restore');
if (withExt.walled && withExt.nextParas <= 2) {
  console.log('NOTE: SSR walled teaser only — full body still requires subscription unlock');
}
