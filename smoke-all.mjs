import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);

const checks = [
  {
    name: 'economist-home',
    url: 'https://www.economist.com/',
    ok: (i) => i.status === 200 && i.bodyLen > 500 && !i.navErr,
  },
  {
    name: 'atlantic',
    url: 'https://www.theatlantic.com/health/2026/07/cyclosporiasis-parasite-taco-bell-lettuce/687986/',
    ok: (i) =>
      i.status === 200 &&
      !i.gate &&
      i.bodyLen > 2000 &&
      !/to read this story/i.test(i.text || ''),
  },
  {
    name: 'bloomberg',
    url: 'https://www.bloomberg.com/news/articles/2026-07-18/iran-ramps-up-retaliatory-attack-on-kuwait-after-us-escalation',
    ok: (i) =>
      i.status === 200 &&
      i.bodyPe === 'auto' &&
      !i.stopScroll &&
      (i.restored || i.bodyLen > 2000),
  },
];

const browser = await puppeteer.launch({
  headless: false,
  pipe: true,
  defaultViewport: { width: 1280, height: 900 },
  enableExtensions: [extensionPath],
  args: ['--disable-blink-features=AutomationControlled'],
  protocolTimeout: 60000,
});

const results = [];
try {
  await browser.waitForTarget(
    (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
    { timeout: 20000 }
  );

  for (const check of checks) {
    const page = await browser.newPage();
    let status = null;
    let navErr = null;
    try {
      const resp = await page.goto(check.url, {
        waitUntil: 'domcontentloaded',
        timeout: 35000,
      });
      status = resp && resp.status();
    } catch (e) {
      navErr = String(e).slice(0, 120);
    }
    await new Promise((r) => setTimeout(r, 7000));
    const info = await page
      .evaluate(() => {
        const body = document.body;
        const bs = body ? getComputedStyle(body) : null;
        return {
          title: document.title,
          bodyLen: body ? body.innerText.trim().length : 0,
          text: body ? body.innerText.slice(0, 400) : '',
          gate: !!document.getElementById('gate-toast'),
          bodyPe: bs ? bs.pointerEvents : null,
          stopScroll: body ? /stopScroll/i.test(body.className || '') : false,
          restored: !!(
            document.getElementById('bpc_bbg_restored') ||
            document.getElementById('bpc_econ_restored') ||
            document.querySelector('.bpc-atlantic-restored') ||
            document.getElementById('bpc_atlantic_hide_css')
          ),
          econHide: !!document.getElementById('bpc_econ_hide_css'),
          atlHide: !!document.getElementById('bpc_atlantic_hide_css'),
          bbgHide: !!document.getElementById('bpc_bbg_hide_css'),
        };
      })
      .catch((e) => ({ evalErr: String(e).slice(0, 100) }));

    const row = { name: check.name, status, navErr, ...info };
    row.pass = check.ok(row);
    results.push(row);
    await page.close().catch(() => {});
  }
} finally {
  await browser.close();
}

const pass = results.every((r) => r.pass);
console.log(JSON.stringify({ pass, results }, null, 2));
process.exitCode = pass ? 0 : 1;
