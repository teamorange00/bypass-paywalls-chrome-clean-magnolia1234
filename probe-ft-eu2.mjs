import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL =
  'https://www.ft.com/content/eb0cd740-e45d-4dd7-ab9a-6f6643bb32ee?syn-25a6b1a6=1';

const browser = await puppeteer.launch({
  headless: false,
  pipe: true,
  defaultViewport: { width: 1400, height: 900 },
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
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 9000));

  const info = await page.evaluate(() => {
    const restored = document.getElementById('bpc_ft_restored');
    const heads = [...document.querySelectorAll('h1')].map((h) => {
      const r = h.getBoundingClientRect();
      const st = getComputedStyle(h);
      return {
        text: h.innerText.trim().slice(0, 80),
        w: Math.round(r.width),
        x: Math.round(r.x),
        display: st.display,
        parent: h.parentElement
          ? h.parentElement.tagName + '.' + String(h.parentElement.className).slice(0, 60)
          : null,
        inRestored: !!(restored && restored.contains(h)),
      };
    });

    // Find any element containing the article title that's narrow
    const titleBits = [];
    document.querySelectorAll('h1, h2, .article-info__headline, [class*="headline"]').forEach((el) => {
      if (!/EU faces crumbling/i.test(el.innerText || '')) return;
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      titleBits.push({
        tag: el.tagName,
        cls: String(el.className).slice(0, 80),
        w: Math.round(r.width),
        x: Math.round(r.x),
        display: st.display,
        maxW: st.maxWidth,
        style: (el.getAttribute('style') || '').slice(0, 100),
      });
    });

    // Layout rows with forced styles
    const styled = [];
    document.querySelectorAll('[style]').forEach((el) => {
      const s = el.getAttribute('style') || '';
      if (!/display\s*:\s*block|max-height|overflow/i.test(s)) return;
      const r = el.getBoundingClientRect();
      if (r.width < 300 && r.height > 40) {
        styled.push({
          tag: el.tagName,
          cls: String(el.className).slice(0, 80),
          w: Math.round(r.width),
          style: s.slice(0, 140),
        });
      }
    });

    const rr = restored ? restored.getBoundingClientRect() : null;
    return {
      title: document.title,
      heads,
      titleBits,
      styled: styled.slice(0, 15),
      restoredW: rr ? Math.round(rr.width) : null,
      restoredX: rr ? Math.round(rr.x) : null,
      restoredLen: restored ? restored.innerText.trim().length : 0,
    };
  });

  await page.screenshot({
    path: path.join(__dirname, 'ft-eu-layout.png'),
    fullPage: false,
  });

  const pass =
    info.restoredLen > 2000 &&
    info.restoredW > 500 &&
    !info.titleBits.some((t) => t.w < 300 && t.w > 0);

  console.log(JSON.stringify({ pass, ...info }, null, 2));
  process.exitCode = pass ? 0 : 1;
} finally {
  await browser.close();
}
