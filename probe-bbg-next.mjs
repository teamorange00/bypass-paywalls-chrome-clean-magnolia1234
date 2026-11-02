import puppeteer from 'puppeteer';
import fs from 'fs';

const URL =
  'https://www.bloomberg.com/news/articles/2026-07-17/how-golf-influencers-are-changing-the-pga-tour';

const browser = await puppeteer.launch({
  headless: false,
  pipe: true,
  defaultViewport: { width: 1280, height: 900 },
  args: ['--disable-blink-features=AutomationControlled'],
});
const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
await new Promise((r) => setTimeout(r, 5000));

const info = await page.evaluate(() => {
  const pp = JSON.parse(document.getElementById('__NEXT_DATA__').textContent).props.pageProps;
  const story = pp.story || {};
  function summarize(obj, depth = 0) {
    if (depth > 3) return typeof obj;
    if (Array.isArray(obj)) return { _arr: obj.length, _0: obj[0] ? summarize(obj[0], depth + 1) : null };
    if (obj && typeof obj === 'object') {
      const o = {};
      for (const k of Object.keys(obj).slice(0, 40)) o[k] = summarize(obj[k], depth + 1);
      return o;
    }
    if (typeof obj === 'string') return `string(${obj.length})`;
    return typeof obj;
  }

  const body = story.body;
  const paras = [];
  function walk(node, path = '') {
    if (!node) return;
    if (typeof node === 'string') {
      if (node.trim().length > 40) paras.push({ path, text: node.trim().slice(0, 120), len: node.length });
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((n, i) => walk(n, `${path}[${i}]`));
      return;
    }
    if (typeof node === 'object') {
      if (typeof node.text === 'string' && node.text.trim().length > 20) {
        paras.push({ path: path + '.text', type: node.type, text: node.text.trim().slice(0, 120), len: node.text.length });
      }
      if (typeof node.value === 'string' && node.value.length > 40) {
        paras.push({ path: path + '.value', type: node.type, text: node.value.slice(0, 120), len: node.value.length });
      }
      for (const [k, v] of Object.entries(node)) {
        if (k === 'text' || k === 'value') continue;
        walk(v, path + '.' + k);
      }
    }
  }
  walk(body);

  return {
    storyKeys: Object.keys(story),
    headline: story.headline || story.title,
    type: story.type,
    bodyType: typeof body,
    bodySummary: summarize(body),
    preview: pp.preview,
    paraHits: paras.slice(0, 20),
    paraCount: paras.length,
    totalTextLen: paras.reduce((a, p) => a + (p.len || 0), 0),
  };
});

console.log(JSON.stringify(info, null, 2));
fs.writeFileSync('.firecrawl/bbg-story-meta.json', JSON.stringify(info, null, 2));
await browser.close();
