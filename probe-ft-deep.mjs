import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL =
  'https://www.ft.com/content/8a424dc2-13cb-4eb6-86d0-a3193d710359?syn-25a6b1a6=1';

const browser = await puppeteer.launch({
  headless: false,
  pipe: true,
  defaultViewport: { width: 1280, height: 900 },
  enableExtensions: [path.resolve(__dirname)],
  args: ['--disable-blink-features=AutomationControlled'],
  protocolTimeout: 60000,
});

try {
  await browser.waitForTarget(
    (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
    { timeout: 20000 }
  );
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 8000));

  const info = await page.evaluate(async () => {
    const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => {
      try {
        const j = JSON.parse(s.textContent);
        const arr = Array.isArray(j) ? j : [j];
        return arr.map((x) => ({
          type: x['@type'],
          hasBody: !!x.articleBody,
          bodyLen: (x.articleBody || '').length,
          headline: x.headline || '',
        }));
      } catch {
        return [{ err: true }];
      }
    });

    let bg = null;
    try {
      bg = await chrome.runtime.sendMessage({
        request: 'ftArticle',
        url: location.href,
      });
    } catch (e) {
      bg = { err: String(e) };
    }

    return {
      title: document.title,
      ld,
      bg: bg && {
        ok: bg.ok,
        bodyLen: (bg.articleBody || '').length,
        headline: bg.headline,
        error: bg.error,
        htmlLength: bg.htmlLength,
      },
      hasMatchesErr: false,
    };
  });

  // chrome.runtime not available in page world - ask via evaluate in isolated... puppeteer page.evaluate is main world.
  // Use extension background differently - just report ld+json + errors
  console.log(
    JSON.stringify(
      {
        pageErrors: pageErrors.filter((e) => /matches|Illegal return/i.test(e)),
        allErrors: pageErrors.slice(0, 10),
        title: info.title,
        ld: info.ld,
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
