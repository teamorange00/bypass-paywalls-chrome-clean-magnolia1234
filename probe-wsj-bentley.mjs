import fs from 'fs';

const html = fs.readFileSync('.firecrawl/wsj-bentley.html', 'utf8');
console.log('html len', html.length);

const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
if (!m) {
  console.log('no NEXT_DATA');
  process.exit(1);
}
const pp = JSON.parse(m[1]).props.pageProps;
console.log({
  pathHint: 'cio-journal',
  isSnippetView: pp.isSnippetView,
  unlocked: pp.isServerUnlockedContent,
  bot: pp.hasBotUnlockHeader,
  paywallIndex: pp.paywallIndex,
  wordCount: pp.articleData?.articleTrackingMeta?.articleWordCount,
  flatLen: pp.articleData?.flattenedBody?.length,
  encLen: pp.encryptedDataHash?.content?.length,
  hasKey: !!pp.encryptedDocumentKey,
  entitlements: pp.endpoints?.entitlements,
  headline: pp.articleData?.headline?.text,
});

function paraText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(paraText).join('');
  if (node.content) return paraText(node.content);
  if (node.text) return node.text;
  if (node.textAndDecorations) return paraText(node.textAndDecorations);
  return '';
}
const paras = (pp.articleData?.flattenedBody || [])
  .filter((x) => (x.__typename || x.type || '').includes('Paragraph') || x.type === 'paragraph')
  .map((x) => paraText(x).trim())
  .filter(Boolean);
console.log('teaser paras', paras.length);
paras.forEach((p, i) => console.log(i, p.slice(0, 160)));

// Paywall UI markers in HTML
for (const term of [
  'Continue reading your article',
  'SnippetOverlay',
  'snippet-promotion',
  'tp-container',
  'Subscribe Now',
  'piano.vx.wsj',
  'Goodwood',
  'mask-image',
  'linear-gradient',
]) {
  console.log(term, (html.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length);
}

// Save next data for decrypt attempts
fs.writeFileSync('.firecrawl/wsj-bentley-next.json', JSON.stringify(pp, null, 2));
