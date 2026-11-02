const url =
  'https://www.ft.com/content/8a424dc2-13cb-4eb6-86d0-a3193d710359?syn-25a6b1a6=1';

const resp = await fetch(url, {
  headers: {
    Accept: 'text/html',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
    Referer: 'https://www.google.com/',
  },
});
const html = await resp.text();
const re = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
const blocks = [...html.matchAll(re)];
let body = '';
let headline = '';
for (const b of blocks) {
  try {
    let j = JSON.parse(b[1]);
    if (Array.isArray(j)) j = j.find((x) => x && x.articleBody) || j[0];
    if (j && j.articleBody) {
      body = j.articleBody;
      headline = j.headline || '';
      break;
    }
  } catch {}
}
const title = (/<title>([^<]+)/i.exec(html) || [])[1] || '';
console.log(
  JSON.stringify(
    {
      status: resp.status,
      htmlLen: html.length,
      blocks: blocks.length,
      headline,
      bodyLen: body.length,
      title,
      hasSubscribe: /Subscribe to read/i.test(html),
    },
    null,
    2
  )
);
