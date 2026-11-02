import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);
const URLS = [
  'https://www.economist.com/',
  'https://www.economist.com/finance-and-economics/',
];

async function probe(url, withExt) {
  const browser = await puppeteer.launch({
    headless: false,
    pipe: true,
    defaultViewport: { width: 1280, height: 900 },
    enableExtensions: withExt ? [extensionPath] : false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  try {
    if (withExt) {
      await browser.waitForTarget(
        (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
        { timeout: 20000 }
      );
    }
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    page.on('requestfailed', (r) => {
      const u = r.url();
      if (/economist|piano|tinypass|zephr|cdn/i.test(u))
        errors.push('fail:' + r.failure().errorText + ' ' + u.slice(0, 140));
    });
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch((e) => {
      errors.push('goto:' + String(e).slice(0, 160));
      return null;
    });
    await new Promise((r) => setTimeout(r, 8000));
    const info = await page.evaluate(() => {
      const body = document.body;
      const bs = body ? getComputedStyle(body) : null;
      const html = document.documentElement;
      const hs = html ? getComputedStyle(html) : null;
      return {
        title: document.title,
        ready: document.readyState,
        bodyLen: body ? body.innerText.trim().length : 0,
        childCount: body ? body.children.length : 0,
        bodyDisplay: bs && bs.display,
        bodyVisibility: bs && bs.visibility,
        bodyPe: bs && bs.pointerEvents,
        htmlDisplay: hs && hs.display,
        tpActive: !!(body && body.classList.contains('tp-active')),
        bodyClass: body ? String(body.className).slice(0, 200) : null,
        hasHideCss: !!document.getElementById('bpc_econ_hide_css'),
        hideCss: (document.getElementById('bpc_econ_hide_css') || {}).textContent || null,
        mainHtml: (document.querySelector('main, #content, [class*="layout"]') || body || html)
          ? ((document.querySelector('main, #content') || body).innerHTML || '').slice(0, 300)
          : null,
        blankish:
          !body ||
          body.innerText.trim().length < 40 ||
          (bs && (bs.display === 'none' || bs.visibility === 'hidden')),
      };
    }).catch((e) => ({ evalErr: String(e) }));
    console.log(
      JSON.stringify(
        {
          url,
          withExt,
          status: resp && resp.status(),
          info,
          errors: errors.slice(0, 25),
        },
        null,
        2
      )
    );
  } finally {
    await browser.close();
  }
}

for (const url of URLS) {
  await probe(url, false);
  await probe(url, true);
}
