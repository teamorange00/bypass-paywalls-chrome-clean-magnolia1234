import fs from 'fs';

const t = fs.readFileSync('.firecrawl/economist-article.html', 'utf8');
const m = t.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
const pp = JSON.parse(m[1]).props.pageProps;

console.log({
  walled: pp.walled,
  isSubscriber: pp.isSubscriber,
  paywallCheck: pp.paywallCheck,
  contentVariant: pp.contentVariant,
  statusCode: pp.statusCode,
  contentType: typeof pp.content,
  contentKeys: pp.content && typeof pp.content === 'object' ? Object.keys(pp.content) : null,
});

const content = pp.content;
function summarize(obj, depth = 0) {
  if (depth > 4) return typeof obj;
  if (Array.isArray(obj)) {
    return {
      _array: obj.length,
      _0: obj[0] ? summarize(obj[0], depth + 1) : null,
    };
  }
  if (obj && typeof obj === 'object') {
    const o = {};
    for (const k of Object.keys(obj).slice(0, 40)) o[k] = summarize(obj[k], depth + 1);
    return o;
  }
  if (typeof obj === 'string') return `string(${obj.length})`;
  return typeof obj;
}
console.log(JSON.stringify(summarize(content), null, 2).slice(0, 5000));

// extract all text-like leaves under content
const paras = [];
function walk(node, path = '') {
  if (!node) return;
  if (typeof node === 'string') {
    if (node.trim().length > 40) paras.push({ path, text: node.trim() });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((n, i) => walk(n, `${path}[${i}]`));
    return;
  }
  if (typeof node === 'object') {
    // common shapes
    if (typeof node.text === 'string' && node.text.trim()) {
      paras.push({ path: path + '.text', text: node.text.trim(), type: node.type || node.name });
    }
    if (typeof node.value === 'string' && node.value.length > 40) {
      paras.push({ path: path + '.value', text: node.value.trim(), type: node.type });
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'text' || k === 'value') continue;
      walk(v, path + '.' + k);
    }
  }
}
walk(content);
console.log('para count', paras.length);
console.log(
  'longest',
  paras
    .slice()
    .sort((a, b) => b.text.length - a.text.length)
    .slice(0, 8)
    .map((p) => ({ path: p.path, type: p.type, len: p.text.length, preview: p.text.slice(0, 160) }))
);

// headline
console.log('headline-ish', content?.headline || content?.title || content?.seoHeadline || content?.name);

fs.writeFileSync('.firecrawl/economist-content.json', JSON.stringify(content, null, 2));
console.log('wrote .firecrawl/economist-content.json');
