import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);

async function pickArticle(page) {
  await page.goto('https://www.bloomberg.com/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 4000));
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button, a')].find((b) =>
      /accept|agree|consent/i.test((b.textContent || '').trim())
    );
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));
  return page.evaluate(() => {
    const hit = [...document.querySelectorAll('a[href]')].find((a) => {
      try {
        const u = new URL(a.href, location.origin);
        return u.hostname.endsWith('bloomberg.com') && /\/(news|articles|features)\//.test(u.pathname);
      } catch {
        return false;
      }
    });
    return hit ? hit.href.split('?')[0] : null;
  });
}

async function signals(page) {
  return page.evaluate(() => {
    const restored = document.getElementById('bpc_bbg_restored');
    const body =
      restored ||
      document.querySelector('.body-copy-v2, .body-copy, .body-content, article, main');
    return {
      title: document.title,
      url: location.href,
      hasHideCss: !!document.getElementById('bpc_bbg_hide_css'),
      hasFortress: !!document.querySelector('#fortress-paywall-container-root'),
      hasRestored: !!restored,
      bodyLen: body ? body.innerText.trim().length : 0,
      hasJson: !!document.querySelector(
        'script[data-component-props="ArticleBody"], script[data-component-props="FeatureBody"]'
      ),
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
    const article = await pickArticle(page);
    console.log('article', article);
    if (!article) throw new Error('no bloomberg article');
    await page.goto(article, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 7000));
    const data = await signals(page);
    console.log(withExtension ? 'WITH_EXT' : 'NO_EXT', JSON.stringify(data, null, 2));
    return data;
  } finally {
    await browser.close();
  }
}

const noExt = await run(false);
const withExt = await run(true);
const ok = withExt.hasHideCss && !withExt.hasFortress && withExt.bodyLen > 400;
if (!ok) {
  console.error('FAIL bloomberg');
  process.exit(1);
}
console.log('PASS bloomberg', {
  noExtBody: noExt.bodyLen,
  withExtBody: withExt.bodyLen,
  restored: withExt.hasRestored,
});
