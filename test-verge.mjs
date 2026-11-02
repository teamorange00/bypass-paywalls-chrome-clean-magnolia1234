import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);
const articleUrl =
  'https://www.theverge.com/tech/966937/microsoft-surface-laptop-13-inch-8gb-ram-2026-review';

async function collect(page) {
  return page.evaluate(() => {
    const bodyText = document.body ? document.body.innerText : '';
    const anchor = document.querySelector('#zephr-anchor');
    return {
      title: document.title,
      hasPaywallCopy: /Continue reading with a Verge subscription/i.test(bodyText),
      hasTrialButton: /START YOUR TRIAL/i.test(bodyText),
      hasRamageddon: /RAMageddon/i.test(bodyText),
      hasNotEnough: /8GB is not enough for a Windows laptop in 2026/i.test(bodyText),
      zephrOverlay: !!document.querySelector('#zephr-overlay'),
      zephrScriptTags: [...document.querySelectorAll('script[src*="zephr"]')].map((s) => s.src),
      anchorTextLength: anchor ? (anchor.innerText || '').trim().length : 0,
      restoredFallback: !!document.getElementById('bpc_verge_restored'),
      bpcDone: !!document.getElementById('bpc_done'),
    };
  });
}

async function dismissAndScroll(page) {
  for (const label of ['Accept', 'Reject Non-Essential', 'Agree', 'Accept all']) {
    const clicked = await page.evaluate((text) => {
      const buttons = [...document.querySelectorAll('button, a')];
      const btn = buttons.find((b) => (b.textContent || '').trim() === text);
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    }, label);
    if (clicked) {
      await new Promise((r) => setTimeout(r, 1500));
      break;
    }
  }
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollBy(0, 700));
    await new Promise((r) => setTimeout(r, 350));
  }
  await new Promise((r) => setTimeout(r, 2500));
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
      const swTarget = await browser.waitForTarget(
        (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
        { timeout: 15000 }
      );
      console.log('SERVICE_WORKER', swTarget.url());
    }

    const page = await browser.newPage();
    const zephr = { requested: [], failed: [], responded: [] };
    page.on('request', (req) => {
      if (req.url().includes('zephr')) zephr.requested.push(req.url());
    });
    page.on('requestfailed', (req) => {
      if (req.url().includes('zephr')) {
        zephr.failed.push({ url: req.url(), err: req.failure()?.errorText });
      }
    });
    page.on('response', (res) => {
      if (res.url().includes('zephr')) {
        zephr.responded.push({ status: res.status(), url: res.url() });
      }
    });

    await page.goto(articleUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1500));
    await dismissAndScroll(page);
    const result = await collect(page);

    const shot = path.join(
      __dirname,
      '.firecrawl',
      withExtension ? 'verge-with-ext.png' : 'verge-without-ext.png'
    );
    fs.mkdirSync(path.dirname(shot), { recursive: true });
    await page.screenshot({ path: shot, fullPage: false });

    return { withExtension, result, zephr, shot };
  } finally {
    await browser.close();
  }
}

const without = await run(false);
console.log('WITHOUT_EXTENSION', JSON.stringify(without, null, 2));
const withExt = await run(true);
console.log('WITH_EXTENSION', JSON.stringify(withExt, null, 2));

const bypassed =
  withExt.result.hasRamageddon &&
  withExt.result.hasNotEnough &&
  !withExt.result.hasPaywallCopy &&
  !withExt.result.hasTrialButton;

console.log(
  JSON.stringify(
    {
      bypassed,
      baselineHadPaywall:
        without.result.hasPaywallCopy ||
        without.result.hasTrialButton ||
        without.result.zephrOverlay,
      baselineCouldReadFull: without.result.hasNotEnough,
      extCouldReadFull: withExt.result.hasNotEnough,
      zephrBlocked: withExt.zephr.failed.length > 0 || withExt.zephr.responded.every((r) => r.status === 0),
      zephrResponsesWithExt: withExt.zephr.responded,
    },
    null,
    2
  )
);

if (!bypassed) {
  console.error('TEST_FAILED');
  process.exitCode = 1;
} else {
  console.log('TEST_PASSED');
}
