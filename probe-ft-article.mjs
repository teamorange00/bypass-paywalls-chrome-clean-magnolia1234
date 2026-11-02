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
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push('console:' + msg.text());
  });

  const resp = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch((e) => {
    pageErrors.push('nav:' + String(e).slice(0, 120));
    return null;
  });
  await new Promise((r) => setTimeout(r, 8000));

  const info = await page.evaluate(() => {
    const text = document.body ? document.body.innerText : '';
    return {
      title: document.title,
      statusOk: true,
      subscribeTitle: document.title === 'Subscribe to read',
      barrier: !!document.querySelector('#barrier-page, .barrier, [data-trackable="paywall"]'),
      restored: !!document.getElementById('bpc_ft_restored'),
      restoredLen: (document.getElementById('bpc_ft_restored') || { innerText: '' }).innerText.trim()
        .length,
      bodyLen: text.trim().length,
      articleLen: (
        document.querySelector('.n-content-body, .js-article__content-body, .article__content') ||
        document.body
      ).innerText.trim().length,
      snippet: text.replace(/\s+/g, ' ').trim().slice(0, 280),
    };
  });

  const illegalReturn = pageErrors.some((e) => /Illegal return statement/i.test(e));
  const pass =
    !illegalReturn &&
    !info.subscribeTitle &&
    info.articleLen > 1000;

  console.log(
    JSON.stringify(
      {
        pass,
        status: resp && resp.status(),
        illegalReturn,
        pageErrors: pageErrors.slice(0, 15),
        info,
      },
      null,
      2
    )
  );
  process.exitCode = pass ? 0 : 1;
} finally {
  await browser.close();
}
