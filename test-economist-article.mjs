import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const browser = await puppeteer.launch({
  headless: false,
  pipe: true,
  defaultViewport: { width: 1200, height: 800 },
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
  await page.goto('https://www.economist.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await new Promise((r) => setTimeout(r, 3000));

  const href = await page.evaluate(() => {
    const re = /\/\d{4}\/\d{2}\/\d{2}\//;
    const a = [...document.querySelectorAll('a[href]')].find((x) =>
      re.test(x.getAttribute('href') || '')
    );
    return a ? a.href : null;
  });
  console.log('article', href);
  if (!href) {
    process.exitCode = 1;
  } else {
    await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 7000));

    const info = await page.evaluate(() => ({
      title: document.title,
      bodyLen: document.body.innerText.trim().length,
      hasHide: !!document.getElementById('bpc_econ_hide_css'),
      hasRegwall: !!document.querySelector('#tp-regwall, .layout-article-regwall'),
      restored: !!document.getElementById('bpc_econ_restored'),
    }));

    const pass = info.bodyLen > 300 && !info.hasRegwall;
    console.log(JSON.stringify({ pass, ...info }, null, 2));
    process.exitCode = pass ? 0 : 1;
  }
} finally {
  await browser.close();
}
