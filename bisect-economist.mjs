import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);
const URL = 'https://www.economist.com/';
const manifestPath = path.join(extensionPath, 'manifest.json');
const backupPath = path.join(extensionPath, 'manifest.json.bisect-bak');

const original = fs.readFileSync(manifestPath, 'utf8');
fs.writeFileSync(backupPath, original);

function setEconomistScripts(mode) {
  const m = JSON.parse(original);
  m.content_scripts = m.content_scripts.filter(
    (cs) => !(cs.matches || []).some((x) => String(x).includes('economist'))
  );
  if (mode === 'early') {
    m.content_scripts.push({
      matches: ['*://*.economist.com/*', '*://economist.com/*'],
      js: ['contentScript_economist_early.js'],
      run_at: 'document_start',
      all_frames: false,
    });
  } else if (mode === 'main') {
    m.content_scripts.push({
      matches: ['*://*.economist.com/*', '*://economist.com/*'],
      js: ['contentScript_economist.js'],
      run_at: 'document_start',
      all_frames: false,
    });
  } else if (mode === 'both-safe') {
    m.content_scripts.push({
      matches: ['*://*.economist.com/*', '*://economist.com/*'],
      js: ['contentScript_economist_early.js'],
      run_at: 'document_start',
      all_frames: false,
    });
    m.content_scripts.push({
      matches: ['*://*.economist.com/*', '*://economist.com/*'],
      js: ['contentScript_economist.js'],
      run_at: 'document_start',
      all_frames: false,
    });
  } else if (mode === 'none') {
    // DNR only
  }
  m.version = '3.0.7.' + ({ none: 80, early: 81, main: 82, 'both-safe': 83 }[mode] || 89);
  fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));
}

async function run(mode) {
  setEconomistScripts(mode);
  const browser = await puppeteer.launch({
    headless: false,
    pipe: true,
    defaultViewport: { width: 1200, height: 800 },
    enableExtensions: [extensionPath],
    args: ['--disable-blink-features=AutomationControlled'],
    protocolTimeout: 45000,
  });
  try {
    await browser.waitForTarget(
      (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
      { timeout: 20000 }
    );
    const page = await browser.newPage();
    const t0 = Date.now();
    let status = null;
    let err = null;
    try {
      const resp = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 25000 });
      status = resp && resp.status();
    } catch (e) {
      err = String(e).slice(0, 120);
    }
    await new Promise((r) => setTimeout(r, 3000));
    let bodyLen = null;
    try {
      bodyLen = await page.evaluate(() => (document.body ? document.body.innerText.trim().length : -1));
    } catch (e) {
      bodyLen = 'eval-fail:' + String(e).slice(0, 80);
    }
    console.log(JSON.stringify({ mode, ms: Date.now() - t0, status, bodyLen, err }));
  } finally {
    await browser.close();
  }
}

try {
  for (const mode of ['none', 'early', 'main', 'both-safe']) {
    await run(mode);
  }
} finally {
  fs.writeFileSync(manifestPath, original);
  try { fs.unlinkSync(backupPath); } catch {}
}
