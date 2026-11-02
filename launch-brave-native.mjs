/**
 * Launch Brave WITHOUT Puppeteer/CDP — Akamai fingerprints automation.
 * Uses Chromium --load-extension flags (still work in Brave).
 */
import { spawn } from 'child_process';
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
  console.error('Brave not found. Set BRAVE_PATH or Load unpacked at brave://extensions');
  process.exit(1);
}

const profileDir = path.join(__dirname, '.brave-bpc-native-profile');
fs.mkdirSync(profileDir, { recursive: true });

console.log('Launching Brave (no Puppeteer / no CDP)...');
console.log('Brave:', executablePath);
console.log('Extension:', extensionPath);
console.log('Profile:', profileDir);
console.log('URL:', startUrl);

const child = spawn(
  executablePath,
  [
    `--user-data-dir=${profileDir}`,
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--no-first-run',
    '--no-default-browser-check',
    startUrl,
  ],
  { detached: true, stdio: 'ignore' }
);
child.unref();
console.log('Brave started (pid', child.pid + '). Close the window when done.');
