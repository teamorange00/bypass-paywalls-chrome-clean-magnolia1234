import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname);
const TARGET = 'https://www.bloomberg.com/news/articles/2026-11-16/switzerland-s-economy-unexpectedly-grows-thanks-to-industry?srnd=homepage-americas';
const OUTDIR = path.join(__dirname, '.firecrawl');
fs.mkdirSync(OUTDIR, { recursive: true });

async function probe(page, label) {
  return page.evaluate((lbl) => {
    const body = document.body;
    const html = document.documentElement;
    const bs = body ? getComputedStyle(body) : null;
    const hs = html ? getComputedStyle(html) : null;
    const restored = document.getElementById('bpc_bbg_restored');
    const articleEl = document.querySelector('article, main, .body-copy-v2, .body-copy, .body-content');
    // __NEXT_DATA__ story
    let nextInfo = null;
    const nextEl = document.getElementById('__NEXT_DATA__');
    if (nextEl) {
      try {
        const pp = JSON.parse(nextEl.textContent).props.pageProps;
        const story = pp.story || {};
        const bc = story.body && story.body.content;
        nextInfo = {
          nextLen: nextEl.textContent.length,
          pagePropsKeys: Object.keys(pp).slice(0, 40),
          storyKeys: Object.keys(story).slice(0, 40),
          headline: story.headline || story.seoHeadline || null,
          bodyContentBlocks: Array.isArray(bc) ? bc.length : (story.body ? typeof story.body : null),
          isPaywalled: story.isPaywalled ?? pp.isPaywalled ?? null,
          paywall: story.paywall ?? null,
        };
      } catch (e) { nextInfo = { err: String(e).slice(0,200) }; }
    }
    // JSON component scripts
    const compScripts = [...document.querySelectorAll('script[data-component-props]')].map(s => ({
      props: s.getAttribute('data-component-props'),
      len: (s.textContent||'').length,
      head: (s.textContent||'').slice(0,120)
    })).slice(0,10);
    // blockers / overlays
    const blockers = [];
    document.querySelectorAll('div,section,aside,iframe').forEach(el=>{
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width < 300 || r.height < 150) return;
      const covers = (st.position==='fixed'||st.position==='absolute'||st.position==='sticky') && r.width>=innerWidth*0.4 && r.height>=innerHeight*0.25;
      if (!covers) return;
      blockers.push({
        tag: el.tagName, id: el.id, cls: String(el.className).slice(0,140),
        testid: el.getAttribute('data-testid'),
        pos: st.position, z: st.zIndex, pe: st.pointerEvents, display: st.display, opacity: st.opacity,
        text: (el.innerText||'').replace(/\s+/g,' ').trim().slice(0,180)
      });
    });
    const text = body ? body.innerText : '';
    return {
      label: lbl,
      title: document.title,
      url: location.href,
      readyState: document.readyState,
      hasHideCss: !!document.getElementById('bpc_bbg_hide_css'),
      hasFortress: !!document.querySelector('#fortress-paywall-container-root, #fortress-preblocked-container-root, #fortress-container-root'),
      fortressHtml: document.querySelector('#fortress-paywall-container-root, #fortress-container-root')?.outerHTML?.slice(0,300) || null,
      hasSlidingBanner: !!document.getElementById('slidingBanner'),
      slidingText: document.getElementById('slidingBanner')?.innerText?.replace(/\s+/g,' ').trim().slice(0,250) || null,
      hasRestored: !!restored,
      restoredLen: restored ? restored.innerText.trim().length : 0,
      restoredHead: restored ? restored.innerText.slice(0,400) : null,
      bodyLen: text.trim().length,
      bodyPe: bs?.pointerEvents, bodyOverflow: bs?.overflow, bodyOverflowY: bs?.overflowY,
      htmlPe: hs?.pointerEvents, htmlOverflow: hs?.overflow,
      bodyClass: body ? String(body.className).slice(0,250) : null,
      bodyStyle: body ? body.getAttribute('style') : null,
      paywallAttr: body ? body.getAttribute('data-paywall-overlay-status') : null,
      hasSubGateText: /Subscribe|Sign In|Bloomberg Anywhere|Continue reading|Create a free account|This story is for subscribers/i.test(text),
      gateSnippets: (text.match(/.{0,40}(Subscribe|Sign In|subscribers only|Continue reading).{0,80}/gi)||[]).slice(0,5),
      articleLen: articleEl ? articleEl.innerText.trim().length : 0,
      articleHead: articleEl ? articleEl.innerText.slice(0,500) : null,
      nextInfo,
      compScripts,
      blockers: blockers.slice(0,12),
      bodyFirst800: text.slice(0,800),
    };
  }, label).catch(e => ({ label, evalErr: String(e).slice(0,300) }));
}

async function run(withExt, label) {
  console.log(`\n===== RUN ${label} (ext=${withExt}) =====`);
  const browser = await puppeteer.launch({
    headless: false,
    pipe: true,
    defaultViewport: { width: 1400, height: 950 },
    enableExtensions: withExt ? [extensionPath] : false,
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--disable-infobars'],
    protocolTimeout: 120000,
  });
  const logs = [];
  try {
    let swUrl = null;
    if (withExt) {
      try {
        const t = await browser.waitForTarget(t => t.type()==='service_worker' && t.url().includes('chrome-extension://'), {timeout: 20000});
        swUrl = t.url();
        console.log('SW loaded:', swUrl);
      } catch(e){ console.log('SW WAIT FAILED', String(e).slice(0,200)); }
    }
    const page = await browser.newPage();
    page.on('console', m => logs.push(`[console:${m.type()}] ${m.text().slice(0,300)}`));
    page.on('pageerror', e => logs.push(`[pageerror] ${String(e).slice(0,300)}`));
    page.on('requestfailed', r => logs.push(`[reqfail] ${r.url().slice(0,160)} :: ${r.failure()?.errorText}`));
    page.on('response', r => { if (r.status()>=400) logs.push(`[http ${r.status()}] ${r.url().slice(0,160)}`); });

    console.log('Navigating to target...');
    let status = null, navErr = null;
    try {
      const resp = await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 90000 });
      status = resp?.status();
    } catch(e){ navErr = String(e).slice(0,300); }
    console.log(`nav status=${status} err=${navErr}`);

    // consent dismissal attempt
    await new Promise(r=>setTimeout(r,3000));
    await page.evaluate(()=>{
      const btn=[...document.querySelectorAll('button,a,[role="button"]')].find(b=>/accept all|accept|agree|i accept|continue/i.test((b.textContent||'').trim()) && (b.textContent||'').trim().length<40);
      if(btn) btn.click();
    }).catch(()=>{});
    await new Promise(r=>setTimeout(r,6000));

    const snap = await probe(page, label);
    console.log(JSON.stringify(snap, null, 2));
    const shot = path.join(OUTDIR, `bbg-target-${label}.png`);
    await page.screenshot({ path: shot, fullPage: false }).catch(e=>console.log('shot fail',e));
    console.log('screenshot:', shot);

    // Real wheel scroll (computed overflow alone passed while the wheel
    // was stuck at 280px under the repeat-visit parallaxWrapper lock)
    await page.evaluate(()=>window.scrollTo(0, 0)).catch(()=>{});
    await new Promise(r=>setTimeout(r,400));
    for (let i=0;i<3;i++){ await page.mouse.move(700,450); await page.mouse.wheel({deltaY:700}); await new Promise(r=>setTimeout(r,400)); }
    const wheelY = await page.evaluate(()=>scrollY).catch(()=>0);
    console.log('wheel scrollY after 3 wheels:', wheelY);
    await page.evaluate(()=>window.scrollTo(0, 1200)).catch(()=>{});
    await new Promise(r=>setTimeout(r,1000));
    const snap2 = await probe(page, label+'-after-scroll');
    snap2.wheelY = wheelY;
    console.log('--- after scroll ---');
    console.log(JSON.stringify({bodyLen: snap2.bodyLen, restoredLen: snap2.restoredLen, hasFortress: snap2.hasFortress, hasSlidingBanner: snap2.hasSlidingBanner, hasSubGateText: snap2.hasSubGateText, articleLen: snap2.articleLen, wheelY}, null, 2));
    const shot2 = path.join(OUTDIR, `bbg-target-${label}-scrolled.png`);
    await page.screenshot({ path: shot2, fullPage: false }).catch(()=>{});

    fs.writeFileSync(path.join(OUTDIR, `bbg-target-${label}.json`), JSON.stringify({status, navErr, swUrl, snap, snap2, logs: logs.slice(0,120)}, null, 2));
    console.log(`logs (${logs.length}):`); logs.slice(0,40).forEach(l=>console.log(' ', l));
    return { snap, snap2, status, swUrl };
  } finally {
    await browser.close();
  }
}

const noExt = await run(false, 'noext');
const withExt = await run(true, 'withext');

console.log('\n===== VERDICT =====');
const w = withExt.snap2 || withExt.snap;
const n = noExt.snap2 || noExt.snap;
console.log(JSON.stringify({
  noExt: { status: noExt.status, bodyLen: n.bodyLen, fortress: n.hasFortress, sliding: n.hasSlidingBanner, gate: n.hasSubGateText, restored: n.hasRestored },
  withExt: { sw: !!withExt.swUrl, status: withExt.status, bodyLen: w.bodyLen, hideCss: w.hasHideCss, fortress: w.hasFortress, sliding: w.hasSlidingBanner, gate: w.hasSubGateText, restored: w.hasRestored, restoredLen: w.restoredLen, articleLen: w.articleLen },
}, null, 2));
const pass = withExt.swUrl && w.hasHideCss && !w.hasFortress && !w.hasSlidingBanner && (w.wheelY||0)>800 && (w.restoredLen>800 || w.articleLen>1500 || w.bodyLen>2500);
console.log(pass ? 'PASS: extension active, paywall removed, article readable' : 'FAIL/PARTIAL: see details above');
process.exitCode = pass ? 0 : 1;
