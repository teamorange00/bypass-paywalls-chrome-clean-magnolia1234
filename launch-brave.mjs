/**
 * Launch Brave with the unpacked extension via Puppeteer.
 * Prefer launch-brave-native.mjs for wsj.com — Puppeteer CDP is still fingerprintable.
 * Chrome for Testing is almost always blocked by Akamai on wsj.com.
 */
import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);
const startUrl = process.argv[2] || 'https://www.wsj.com/';

const braveCandidates = [
  process.env.BRAVE_PATH,
  'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  path.join(process.env.LOCALAPPDATA || '', 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
].filter(Boolean);

const executablePath = braveCandidates.find((p) => fs.existsSync(p));
if (!executablePath) {
  console.error('Brave not found. Install Brave, or set BRAVE_PATH to brave.exe');
  console.error('Manual fallback:');
  console.error('  1. Open Brave → brave://extensions');
  console.error('  2. Enable Developer mode');
  console.error(`  3. Load unpacked → ${extensionPath}`);
  process.exit(1);
}

const profileDir = path.join(__dirname, '.brave-bpc-profile');
console.log('Launching Brave with BPC extension...');
console.log('Brave:', executablePath);
console.log('Extension:', extensionPath);
console.log('Profile:', profileDir);
console.log('NOTE: Close DevTools on WSJ tabs — Akamai lists inspection tools as a block reason.');

const browser = await puppeteer.launch({
  headless: false,
  executablePath,
  pipe: true,
  defaultViewport: null,
  enableExtensions: [extensionPath],
  userDataDir: profileDir,
  args: [
    '--start-maximized',
    '--disable-blink-features=AutomationControlled',
  ],
});

try {
  const swTarget = await browser.waitForTarget(
    (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
    { timeout: 20000 }
  );
  console.log('Extension loaded:', swTarget.url());
} catch {
  console.warn('Could not confirm extension service worker — check brave://extensions');
}

const page = await browser.newPage();
await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
console.log('Opened:', startUrl);
console.log('Leave this window open to test. Press Ctrl+C here to close.');

process.on('SIGINT', async () => {
  await browser.close();
  process.exit(0);
});
await new Promise(() => {});
