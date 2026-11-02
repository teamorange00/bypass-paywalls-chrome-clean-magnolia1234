import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);

const browser = await puppeteer.launch({
  headless: false,
  pipe: true,
  enableExtensions: [extensionPath],
});

const swTarget = await browser.waitForTarget(
  (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
  { timeout: 15000 }
);
const worker = await swTarget.worker();
const data = await worker.evaluate(async () => {
  const url = 'https://www.ft.com/content/f5773412-4604-4078-9fc9-41b715326572';
  const resp = await fetch(url, { credentials: 'omit', headers: { Accept: 'text/html' } });
  const html = await resp.text();
  const re = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let articleBody = '';
  let headline = '';
  let match;
  while ((match = re.exec(html))) {
    try {
      let json = JSON.parse(match[1]);
      if (Array.isArray(json))
        json = json.find((x) => x && x.articleBody) || json[0];
      if (json && json.articleBody) {
        headline = json.headline || '';
        articleBody = json.articleBody;
        break;
      }
    } catch {}
  }
  const title = (html.match(/<title>([^<]+)/) || [])[1];
  return {
    status: resp.status,
    htmlLength: html.length,
    headline,
    bodyLen: articleBody.length,
    title,
  };
});
console.log(JSON.stringify(data, null, 2));
await browser.close();
