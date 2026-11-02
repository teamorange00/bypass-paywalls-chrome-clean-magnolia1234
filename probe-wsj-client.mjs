/**
 * Probe WSJ /client documentKey from a real Brave tab (with extension).
 */
import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const brave = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
const ext = path.resolve(__dirname);
const profile = path.join(ext, '.brave-bpc-probe-profile');
const url =
  process.argv[2] ||
  'https://www.wsj.com/lifestyle/relationships/ceo-parent-nanny-assistant-teams-hiring-20d3a9c0';

const browser = await puppeteer.launch({
  headless: false,
  executablePath: brave,
  pipe: true,
  defaultViewport: null,
  enableExtensions: [ext],
  userDataDir: profile,
  args: ['--disable-blink-features=AutomationControlled'],
});

const page = await browser.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await new Promise((r) => setTimeout(r, 5000));

const result = await page.evaluate(async () => {
  const nd = document.getElementById('__NEXT_DATA__');
  if (!nd) return { error: 'no NEXT_DATA' };
  const pp = JSON.parse(nd.textContent).props.pageProps;
  const encKey = pp.encryptedDocumentKey;
  const articlePath = location.pathname + location.search;
  const clientUrl = (pp.endpoints && pp.endpoints.entitlements) || 'https://www.wsj.com/client?legacy=false';

  async function tryClient(label, headers) {
    const r = await fetch(clientUrl, {
      cache: 'no-cache',
      credentials: 'include',
      headers,
    });
    const j = await r.json().catch(() => ({}));
    return {
      label,
      status: r.status,
      hasDocKey: !!j.documentKey,
      docKeyLen: j.documentKey ? j.documentKey.length : 0,
      type: j.type,
      keys: Object.keys(j).slice(0, 12),
      sample: JSON.stringify(j).slice(0, 220),
    };
  }

  const tries = [];
  tries.push(
    await tryClient('bare-path+google-ref', {
      'X-ENCRYPTED-DOCUMENT-KEY': encKey,
      'x-original-host': 'www.wsj.com',
      'x-original-referrer': 'https://www.google.com/',
      'x-original-url': articlePath,
    })
  );
  tries.push(
    await tryClient('reddit-ref', {
      'X-ENCRYPTED-DOCUMENT-KEY': encKey,
      'x-original-host': 'www.wsj.com',
      'x-original-referrer': 'https://www.reddit.com/',
      'x-original-url': articlePath,
    })
  );
  tries.push(
    await tryClient('key-only', {
      'X-ENCRYPTED-DOCUMENT-KEY': encKey,
    })
  );

  let signed = null;
  try {
    const pr = await fetch(
      'https://api.pullpush.io/reddit/search/submission/?author=wsj&size=40&sort=desc'
    );
    const pj = await pr.json();
    const now = Date.now() / 1000;
    for (const d of pj.data || []) {
      const age = (now - (d.created_utc || 0)) / 86400;
      if (age > 14) continue;
      const blob = [d.url, d.url_overridden_by_dest, d.selftext].join('\n');
      const matches = blob.match(/https?:\/\/www\.wsj\.com\/[^\s"'<>\]]+/g) || [];
      for (const raw of matches) {
        const u = raw.replace(/&amp;/g, '&');
        if (/[?&]st=/.test(u)) {
          signed = { age, u };
          break;
        }
      }
      if (signed) break;
    }
  } catch (e) {
    signed = { err: e.message };
  }

  if (signed && signed.u) {
    const u = new URL(signed.u);
    tries.push(
      await tryClient('signed-st+' + signed.age.toFixed(1) + 'd', {
        'X-ENCRYPTED-DOCUMENT-KEY': encKey,
        'x-original-host': 'www.wsj.com',
        'x-original-referrer': 'https://www.reddit.com/',
        'x-original-url': u.pathname + u.search,
      })
    );
  }

  return {
    title: document.title,
    isSnippetView: pp.isSnippetView,
    paraCount: ((pp.articleData && pp.articleData.flattenedBody) || []).filter((x) =>
      String(x.__typename || x.type || '').includes('Paragraph')
    ).length,
    encKeyLen: (encKey || '').length,
    hasHash: !!(pp.encryptedDataHash && pp.encryptedDataHash.content),
    signed,
    tries,
    hasArchiveBar: !!document.getElementById('bpc_wsj_archive_bar'),
    restoredLen: (document.getElementById('bpc_wsj_restored') || {}).innerText
      ? document.getElementById('bpc_wsj_restored').innerText.length
      : 0,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
