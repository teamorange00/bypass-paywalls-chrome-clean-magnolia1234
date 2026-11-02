import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL =
  'https://www.bloomberg.com/news/articles/2026-07-18/iran-ramps-up-retaliatory-attack-on-kuwait-after-us-escalation';

const browser = await puppeteer.launch({
  headless: false,
  pipe: true,
  defaultViewport: { width: 1280, height: 900 },
  enableExtensions: [path.resolve(__dirname)],
  args: ['--disable-blink-features=AutomationControlled'],
});

await browser.waitForTarget(
  (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
  { timeout: 20000 }
);
const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 10000));

const info = await page.evaluate(() => {
  const body = document.body;
  const html = document.documentElement;
  const bs = getComputedStyle(body);
  const hs = getComputedStyle(html);
  const next = document.getElementById('__NEXT_DATA__');
  let story = null;
  if (next) {
    try {
      const pp = JSON.parse(next.textContent).props.pageProps;
      const s = pp.story || {};
      const bodyContent = s.body && s.body.content;
      story = {
        keys: Object.keys(pp).slice(0, 30),
        headline: s.headline,
        contentLen: Array.isArray(bodyContent) ? bodyContent.length : null,
        nextLen: next.textContent.length,
      };
    } catch (e) {
      story = { err: String(e) };
    }
  }

  const grads = [];
  document.querySelectorAll('*').forEach((el) => {
    const st = getComputedStyle(el);
    const bg = st.backgroundImage || '';
    if (!/gradient/i.test(bg)) return;
    const r = el.getBoundingClientRect();
    if (r.height > 80 && r.width > 200) {
      grads.push({
        tag: el.tagName,
        id: el.id,
        cls: String(el.className).slice(0, 120),
        bg: bg.slice(0, 120),
        h: Math.round(r.height),
        pe: st.pointerEvents,
        pos: st.position,
        z: st.zIndex,
      });
    }
  });

  const overlays = [];
  document.querySelectorAll('div, section, aside, iframe').forEach((el) => {
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width < window.innerWidth * 0.4 || r.height < window.innerHeight * 0.3) return;
    if (st.position !== 'fixed' && st.position !== 'absolute') return;
    overlays.push({
      id: el.id,
      cls: String(el.className).slice(0, 140),
      pe: st.pointerEvents,
      display: st.display,
      opacity: st.opacity,
      z: st.zIndex,
      text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120),
    });
  });

  return {
    bodyStyle: body.getAttribute('style'),
    htmlStyle: html.getAttribute('style'),
    bodyClass: String(body.className).slice(0, 200),
    bs: { pe: bs.pointerEvents, overflow: bs.overflow },
    hs: { pe: hs.pointerEvents, overflow: hs.overflow },
    story,
    grads: grads.slice(0, 15),
    overlays: overlays.slice(0, 15),
    restored: !!document.getElementById('bpc_bbg_restored'),
    articleText: (document.querySelector('article') || body).innerText.slice(0, 300),
  };
});

console.log(JSON.stringify(info, null, 2));
await browser.close();
