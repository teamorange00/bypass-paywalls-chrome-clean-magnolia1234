import fs from 'fs';
import crypto from 'crypto';

const pp = JSON.parse(fs.readFileSync('.firecrawl/wsj-bentley-next.json', 'utf8'));

function wsjDecodePayload(e) {
  if (typeof e !== 'string' || !e.length) return e;
  let r = 0, l = '', a = 0, s = 6;
  const o = {
    '0': 52, '1': 53, '2': 54, '3': 55, '4': 56, '5': 57, '6': 58, '7': 59, '8': 60, '9': 61,
    A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9, K: 10, L: 11, M: 12, N: 13, O: 14, P: 15,
    Q: 16, R: 17, S: 18, T: 19, U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25,
    a: 26, b: 27, c: 28, d: 29, e: 30, f: 31, g: 32, h: 33, i: 34, j: 35, k: 36, l: 37, m: 38, n: 39, o: 40,
    p: 41, q: 42, r: 43, s: 44, t: 45, u: 46, v: 47, w: 48, x: 49, y: 50, z: 51, '+': 62, '/': 63,
  };
  const u = {
    from(input) {
      const pad = input.match(/=+/);
      if (pad) input = input.slice(0, pad.index);
      r = 6 * input.length; l = input; a = 0; s = 6;
    },
    pop(bits) {
      if (r <= 0) return null;
      let n = 0, t = o[l.charAt(a)], eBits = Math.min(bits, r);
      r -= eBits;
      while (eBits > 0) {
        if (eBits >= s) {
          eBits -= s;
          n |= (t & (1 << s) - 1) << eBits;
          if (a < l.length - 1) { s = 6; a += 1; t = o[l.charAt(a)]; }
        } else {
          n |= (t & (1 << s) - 1) >> s - eBits;
          s -= eBits;
          break;
        }
      }
      return n;
    },
  };
  u.from(e);
  const c = [];
  let d = 2, v = 2, p = 3, m = true;
  let f = u.pop(d) === 1 ? String.fromCharCode(u.pop(7)) : String.fromCharCode(u.pop(16));
  let h = f, n, t;
  for (; m && (c[++v] = f, m = false), v >= p && (d += 1, p = 2 ** d - 1), 0 !== (n = u.pop(d));) {
    if (n === 1) { t = String.fromCharCode(u.pop(7)); m = true; }
    else if (n === 2) { t = String.fromCharCode(u.pop(16)); m = true; }
    else t = c[n] ? c[n] : f + f.charAt(0);
    c[++v] = f + t.charAt(0);
    h += t;
    f = t;
  }
  return h;
}

async function findSigned() {
  const feeds = [
    'https://api.pullpush.io/reddit/search/submission/?author=wsj&size=100&sort=desc',
    'https://api.pullpush.io/reddit/search/submission/?q=wsjreddit&size=100&sort=desc',
  ];
  const now = Date.now() / 1000;
  const out = [];
  for (const feed of feeds) {
    try {
      const r = await fetch(feed, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      console.log('feed', r.status, feed.slice(0, 60));
      if (!r.ok) continue;
      const j = await r.json();
      for (const d of j.data || []) {
        const age = (now - (d.created_utc || 0)) / 86400;
        const blob = [d.url, d.selftext, d.title, d.url_overridden_by_dest].join('\n');
        const matches = blob.match(/https?:\/\/www\.wsj\.com\/[^\s"'<>\]]+/g) || [];
        for (const raw of matches) {
          const u = raw.replace(/&amp;/g, '&');
          if (/[?&]st=/.test(u)) out.push({ age, u });
        }
      }
    } catch (e) {
      console.log('feed err', e.message);
    }
  }
  out.sort((a, b) => a.age - b.age);
  return [...new Map(out.map((x) => [x.u, x])).values()];
}

async function tryClient(xOriginalUrl, label) {
  const resp = await fetch(pp.endpoints.entitlements, {
    headers: {
      'X-ENCRYPTED-DOCUMENT-KEY': pp.encryptedDocumentKey,
      'x-original-host': 'www.wsj.com',
      'x-original-referrer': 'https://www.reddit.com/',
      'x-original-url': xOriginalUrl,
    },
  });
  const cj = await resp.json();
  console.log(label, { status: resp.status, dkLen: (cj.documentKey || '').length, type: cj.type });
  return cj;
}

const signed = await findSigned();
console.log('signed count', signed.length);
signed.slice(0, 8).forEach((x) => console.log(x.age.toFixed(1) + 'd', x.u.slice(0, 130)));

await tryClient('/cio-journal/goodwood-festival-of-speed-bentley-continental-gts-b344d570', 'bare');

for (const s of signed.slice(0, 10)) {
  const u = new URL(s.u);
  const cj = await tryClient(u.pathname + u.search, s.age.toFixed(1) + 'd:' + u.searchParams.get('st'));
  if (!cj.documentKey) continue;

  const key = Buffer.from(cj.documentKey, 'base64');
  const iv = Buffer.from(pp.encryptedDataHash.iv, 'base64');
  const content = Buffer.from(pp.encryptedDataHash.content, 'base64');
  const decipher = crypto.createDecipheriv(key.length === 32 ? 'aes-256-ctr' : 'aes-128-ctr', key, iv);
  const plain = Buffer.concat([decipher.update(content), decipher.final()]);
  const b64 = plain.toString('base64');
  let decoded = '';
  try { decoded = wsjDecodePayload(b64); } catch (e) { decoded = plain.toString('utf8'); }
  console.log('SUCCESS decrypt', { bytes: plain.length, decodedLen: decoded.length, preview: decoded.slice(0, 400) });
  fs.writeFileSync('.firecrawl/wsj-bentley-decrypted.txt', decoded);
  break;
}

// Also try archive.ph / archive.md
for (const arch of [
  'https://archive.md/newest/https://www.wsj.com/cio-journal/goodwood-festival-of-speed-bentley-continental-gts-b344d570',
]) {
  try {
    const r = await fetch(arch, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
    const t = await r.text();
    console.log('archive', r.status, r.url, t.length, /Goodwood|Bentley Continental/i.test(t), /Continue reading your article/i.test(t));
  } catch (e) {
    console.log('archive err', e.message);
  }
}
