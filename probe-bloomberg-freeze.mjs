import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);
const URL =
  'https://www.bloomberg.com/news/articles/2026-07-18/iran-ramps-up-retaliatory-attack-on-kuwait-after-us-escalation';

async function run(withExt) {
  const browser = await puppeteer.launch({
    headless: false,
    pipe: true,
    defaultViewport: { width: 1280, height: 900 },
    enableExtensions: withExt ? [extensionPath] : false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  try {
    if (withExt) {
      await browser.waitForTarget(
        (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
        { timeout: 20000 }
      );
    }
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 10000));

    const info = await page.evaluate(() => {
      const blockers = [];
      document.querySelectorAll('div, section, aside, iframe').forEach((el) => {
        const st = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (r.width < 200 || r.height < 200) return;
        const covers =
          (st.position === 'fixed' || st.position === 'sticky' || st.position === 'absolute') &&
          r.width >= window.innerWidth * 0.5 &&
          r.height >= window.innerHeight * 0.4;
        const pe = st.pointerEvents !== 'none';
        const z = parseInt(st.zIndex, 10) || 0;
        const bg = st.backgroundImage + ' ' + st.backgroundColor;
        const gradient = /gradient/i.test(bg) || /gradient/i.test(st.maskImage || '');
        if ((covers && pe) || (gradient && covers) || (z > 1000 && covers)) {
          blockers.push({
            tag: el.tagName,
            id: el.id,
            cls: String(el.className).slice(0, 160),
            testid: el.getAttribute('data-testid'),
            pos: st.position,
            z,
            pe: st.pointerEvents,
            display: st.display,
            opacity: st.opacity,
            bg: bg.slice(0, 120),
            gradient,
            w: Math.round(r.width),
            h: Math.round(r.height),
            text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 160),
          });
        }
      });

      const body = document.body;
      const bst = body ? getComputedStyle(body) : null;
      return {
        title: document.title,
        hasHideCss: !!document.getElementById('bpc_bbg_hide_css'),
        bodyOverflow: bst && bst.overflow,
        bodyPe: bst && bst.pointerEvents,
        paywallAttr: body && body.getAttribute('data-paywall-overlay-status'),
        fortress: !!document.querySelector(
          '#fortress-container-root, #fortress-paywall-container-root, #slidingBanner'
        ),
        articleLen: (document.querySelector('article') || body || document.documentElement)
          .innerText.trim().length,
        blockers: blockers.slice(0, 20),
      };
    });

    console.log(withExt ? 'WITH_EXT' : 'NO_EXT', JSON.stringify(info, null, 2));
  } finally {
    await browser.close();
  }
}

await run(false);
await run(true);
