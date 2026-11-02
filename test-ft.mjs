import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);

function analyze(label, data) {
  console.log(label, JSON.stringify(data, null, 2));
}

async function dismissCookies(page) {
  for (const label of ['Accept', 'Accept all', 'Agree', 'I accept', 'Accept cookies']) {
    const clicked = await page.evaluate((text) => {
      const buttons = [...document.querySelectorAll('button, a, [role="button"]')];
      const btn = buttons.find((b) => (b.textContent || '').trim().toLowerCase() === text.toLowerCase());
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    }, label);
    if (clicked) {
      await new Promise((r) => setTimeout(r, 1200));
      return label;
    }
  }
  return null;
}

async function pageSignals(page) {
  return page.evaluate(() => {
    const text = document.body ? document.body.innerText : '';
    const articleEl =
      document.getElementById('bpc_ft_restored') ||
      document.querySelector('.n-content-body, .js-article__content-body, .article__content-body, article');
    return {
      url: location.href,
      title: document.title,
      hasBarrier:
        document.title === 'Subscribe to read' ||
        !!document.querySelector('#barrier-page, .barrier, .js-barrier, [data-trackable="paywall"]'),
      hasSubscribeCopy: /Subscribe to unlock|Become an FT subscriber/i.test(text.slice(0, 2500)),
      articleBodyLength: articleEl ? articleEl.innerText.trim().length : 0,
      hasArticlePhrase: /superyacht|Fertitta|ambassador to Italy/i.test(text),
      restoredFallback: !!document.getElementById('bpc_ft_restored'),
      hasContentPath: /\/content\//.test(location.pathname),
      navigatorUA: navigator.userAgent,
    };
  });
}

async function run(withExtension) {
  const browser = await puppeteer.launch({
    headless: false,
    pipe: true,
    defaultViewport: { width: 1280, height: 900 },
    enableExtensions: withExtension ? [extensionPath] : false,
  });

  try {
    if (withExtension) {
      const sw = await browser.waitForTarget(
        (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
        { timeout: 15000 }
      );
      console.log('SERVICE_WORKER', sw.url());
    }

    const page = await browser.newPage();
    const uaSeen = [];
    page.on('request', (req) => {
      if (req.isNavigationRequest() && req.url().includes('ft.com')) {
        uaSeen.push({
          url: req.url().slice(0, 120),
          ua: req.headers()['user-agent'] || '',
          referer: req.headers()['referer'] || '',
        });
      }
    });

    await page.goto('https://www.ft.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2500));
    const cookie = await dismissCookies(page);
    console.log('COOKIE', cookie);

    // Prefer a real homepage click; fall back to a known article if homepage is sparse
    let linkInfo = await page.evaluate(() => {
      const links = [...document.querySelectorAll('a[href*="/content/"]')];
      const link = links.find((a) => {
        try {
          const u = new URL(a.href, location.origin);
          return u.hostname.endsWith('ft.com') && /\/content\/[a-f0-9-]+/i.test(u.pathname);
        } catch {
          return false;
        }
      });
      if (!link) return null;
      return { href: link.href, text: (link.textContent || '').trim().slice(0, 120), source: 'homepage' };
    });

    if (!linkInfo) {
      linkInfo = {
        href: 'https://www.ft.com/content/f5773412-4604-4078-9fc9-41b715326572',
        text: 'fallback article',
        source: 'fallback',
      };
    }

    console.log('CLICKING', linkInfo);
    await page.goto(linkInfo.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 5000));
    await dismissCookies(page);
    // Give content script / SW restore a moment after paywall paint
    await new Promise((r) => setTimeout(r, 2000));

    const signals = await pageSignals(page);
    const shot = path.join(
      __dirname,
      '.firecrawl',
      withExtension ? 'ft-with-ext.png' : 'ft-without-ext.png'
    );
    fs.mkdirSync(path.dirname(shot), { recursive: true });
    await page.screenshot({ path: shot, fullPage: false });

    return { withExtension, linkInfo, signals, uaSeen, shot };
  } finally {
    await browser.close();
  }
}

const without = await run(false);
analyze('WITHOUT_EXTENSION', without);

const withExt = await run(true);
analyze('WITH_EXTENSION', withExt);

const bypassed =
  withExt.signals.hasContentPath &&
  !withExt.signals.hasBarrier &&
  withExt.signals.hasArticlePhrase &&
  withExt.signals.articleBodyLength > 1200 &&
  !/Just a moment|Security Verification|Subscribe to read/i.test(withExt.signals.title);

const summary = {
  bypassed,
  baselineHadPaywall: without.signals.hasBarrier || without.signals.hasSubscribeCopy,
  baselineBodyLen: without.signals.articleBodyLength,
  extBodyLen: withExt.signals.articleBodyLength,
  extUA: withExt.uaSeen.slice(-1)[0],
  baselineUA: without.uaSeen.slice(-1)[0],
};
analyze('SUMMARY', summary);

if (!bypassed) {
  console.error('TEST_FAILED');
  process.exitCode = 1;
} else {
  console.log('TEST_PASSED');
}
