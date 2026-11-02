import fs from 'fs';

const t = fs.readFileSync('.firecrawl/economist-article.html', 'utf8');
const m = t.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
if (!m) {
  console.log('no next data');
  process.exit(1);
}
const nd = JSON.parse(m[1]);
const pp = nd.props?.pageProps || {};
console.log('pageProps keys', Object.keys(pp));

function findStrings(obj, path = '', hits = [], depth = 0) {
  if (depth > 8 || hits.length > 50) return hits;
  if (typeof obj === 'string') {
    if (
      obj.length > 200 &&
      /[a-z]{20}/i.test(obj) &&
      !obj.startsWith('http') &&
      !obj.startsWith('{') &&
      !obj.startsWith('data:')
    ) {
      hits.push({ path, len: obj.length, preview: obj.slice(0, 140).replace(/\s+/g, ' ') });
    }
    return hits;
  }
  if (!obj || typeof obj !== 'object') return hits;
  if (Array.isArray(obj)) {
    obj.slice(0, 40).forEach((v, i) => findStrings(v, `${path}[${i}]`, hits, depth + 1));
    return hits;
  }
  for (const k of Object.keys(obj).slice(0, 50)) findStrings(obj[k], `${path}.${k}`, hits, depth + 1);
  return hits;
}

const hits = findStrings(pp).sort((a, b) => b.len - a.len).slice(0, 20);
console.log('long strings', hits);

const s = JSON.stringify(pp);
for (const key of [
  'paywall',
  'regwall',
  'isPaywalled',
  'gated',
  'body',
  'content',
  'tinypass',
  'piano',
  'cpBody',
  'text',
  'chapter',
  'component',
]) {
  console.log(key, s.toLowerCase().includes(key.toLowerCase()));
}

function summarize(obj, depth = 0) {
  if (depth > 3) return typeof obj;
  if (Array.isArray(obj)) return `array(${obj.length}) ` + (obj[0] ? summarize(obj[0], depth + 1) : '');
  if (obj && typeof obj === 'object') {
    const o = {};
    for (const k of Object.keys(obj).slice(0, 30)) o[k] = summarize(obj[k], depth + 1);
    return o;
  }
  return typeof obj;
}
console.log(JSON.stringify(summarize(pp), null, 2).slice(0, 4000));

// paywall-ish fields
function walk(obj, path = '') {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.slice(0, 20).forEach((v, i) => walk(v, `${path}[${i}]`));
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (/paywall|regwall|gated|entitlement|access|meter|piano|tinypass/i.test(k)) {
      console.log('field', path + '.' + k, typeof v, JSON.stringify(v).slice(0, 200));
    }
    if (typeof v === 'object') walk(v, path + '.' + k);
  }
}
walk(pp);

// HTML paywall selectors present
console.log('html selectors', {
  subscription: /subscription/i.test(t),
  softRegwall: /soft-regwall|regwall|paywall/i.test(t),
  articleBody: /data-test-id="article-body"|article-body|article__body/i.test(t),
  truncated: /truncated|fade|gradient/i.test(t),
});
const classes = [...t.matchAll(/class="([^"]*(?:paywall|regwall|subscription|piano|tp-)[^"]*)"/gi)].map((x) => x[1]);
console.log('paywall classes', [...new Set(classes)].slice(0, 30));
