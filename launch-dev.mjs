import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);
const startUrl = process.argv[2] || 'https://www.ft.com/';

const isWsj = /wsj\.com/i.test(startUrl);
if (isWsj) {
  console.warn('WARNING: Chrome for Testing is often blocked by WSJ/Akamai.');
  console.warn('For wsj.com prefer:  node launch-brave.mjs "<url>"');
  console.warn('Or Load unpacked in Brave → brave://extensions');
}

console.log('Launching Chrome for Testing with BPC extension...');
console.log('Extension path:', extensionPath);

const browser = await puppeteer.launch({
  headless: false,
  pipe: true,
  defaultViewport: null,
  enableExtensions: [extensionPath],
  args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
});

const swTarget = await browser.waitForTarget(
  (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
  { timeout: 15000 }
);
console.log('Extension loaded:', swTarget.url());

const page = await browser.newPage();
await page.goto(startUrl, { waitUntil: 'domcontentloaded' });
console.log('Opened:', startUrl);

// Auto-click first FT article link when starting on homepage
if (/^https?:\/\/(www\.)?ft\.com\/?$/i.test(startUrl)) {
  await new Promise((r) => setTimeout(r, 2500));
  const link = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href*="/content/"]')];
    const hit = links.find((a) => {
      try {
        const u = new URL(a.href, location.origin);
        return u.hostname.endsWith('ft.com') && /\/content\/[a-f0-9-]+/i.test(u.pathname);
      } catch {
        return false;
      }
    });
    return hit ? { href: hit.href, text: (hit.textContent || '').trim().slice(0, 120) } : null;
  });
  if (link) {
    console.log('Clicking article:', link);
    await page.goto(link.href, { waitUntil: 'domcontentloaded' });
    console.log('Now on:', page.url());
  } else {
    console.log('No article link found to auto-click; browse manually.');
  }
}

console.log('Leave this window open to test. Press Ctrl+C here to close.');
process.on('SIGINT', async () => {
  await browser.close();
  process.exit(0);
});
await new Promise(() => {});
