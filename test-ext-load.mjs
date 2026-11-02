import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = __dirname;
const profilePath = path.join(__dirname, '.chrome-test-profile-load');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

if (fs.existsSync(profilePath)) fs.rmSync(profilePath, { recursive: true, force: true });
fs.mkdirSync(profilePath, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: false,
  args: [
    `--user-data-dir=${profilePath}`,
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--no-first-run',
    '--no-default-browser-check',
  ],
});

await new Promise((r) => setTimeout(r, 4000));

const targets = browser.targets().map((t) => ({ type: t.type(), url: t.url() }));
console.log('TARGETS', JSON.stringify(targets, null, 2));

const page = await browser.newPage();
await page.goto('chrome://extensions', { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 1500));

// Try to read extensions via chrome.management from an extension page if available
const bg = targets.find((t) => t.type === 'background_page' || t.type === 'service_worker');
console.log('BG', bg);

const version = await page.browser().version();
console.log('BROWSER', version);

await page.screenshot({
  path: path.join(__dirname, '.firecrawl', 'extensions-page.png'),
});
await browser.close();
