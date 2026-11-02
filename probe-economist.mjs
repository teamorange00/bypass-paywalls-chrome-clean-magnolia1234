const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function get(url) {
  const r = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'text/html' },
    redirect: 'follow',
  });
  const t = await r.text();
  return { status: r.status, url: r.url, len: t.length, t };
}

const home = await get('https://www.economist.com/');
console.log('home', home.status, home.len);

const hrefs = [...home.t.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
const artPath = hrefs.find(
  (h) =>
    /economist\.com\/.+\/\d{4}\/\d{2}\/\d{2}\//.test(h) ||
    /^\/(leaders|britain|business|finance|science|culture|international|europe|china|united-states|the-americas|asia|middle-east|africa)\/\d{4}\/\d{2}\/\d{2}\//.test(
      h
    )
);
const artUrl = artPath
  ? artPath.startsWith('http')
    ? artPath
    : 'https://www.economist.com' + artPath
  : 'https://www.economist.com/leaders/';
console.log('picked', artUrl);

const art = await get(artUrl.split('?')[0]);
console.log('art', art.status, art.url, art.len);
console.log('title', (art.t.match(/<title[^>]*>([^<]+)/i) || [])[1]);
console.log({
  tinypass: /tinypass|piano\.io|tp\.piano/i.test(art.t),
  regwall: /layout-article-regwall|subscription-proposition|regwall/i.test(art.t),
  nextData: /__NEXT_DATA__/i.test(art.t),
  ldjson: /application\/ld\+json/i.test(art.t),
  articleBody: /"articleBody"/i.test(art.t),
  subscribe: /Subscribe to continue|already a subscriber|Become a subscriber/i.test(art.t),
  paraClassCount: (art.t.match(/article__body-text/g) || []).length,
});

const blocks = [...art.t.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
for (const b of blocks.slice(0, 8)) {
  try {
    let j = JSON.parse(b[1]);
    if (Array.isArray(j)) j = j.find((x) => x && (x.articleBody || x['@type'])) || j[0];
    if (j && (j.articleBody || j.headline)) {
      console.log('ld', j['@type'], String(j.headline || '').slice(0, 90), 'bodyLen', (j.articleBody || '').length);
    }
  } catch {}
}

if (/__NEXT_DATA__/i.test(art.t)) {
  const m = art.t.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (m) {
    try {
      const nd = JSON.parse(m[1]);
      const s = JSON.stringify(nd);
      console.log('nextData keys', Object.keys(nd.props?.pageProps || nd).slice(0, 20));
      console.log('next has body-ish', /articleBody|bodyText|content\.|components/i.test(s));
      console.log('next len', s.length);
    } catch (e) {
      console.log('next parse fail', e.message);
    }
  }
}

// dump interesting script ids / data attrs
const ids = [...art.t.matchAll(/id="([^"]*(?:paywall|piano|tinypass|regwall|subscription|__NEXT)[^"]*)"/gi)].map(
  (m) => m[1]
);
console.log('ids', [...new Set(ids)].slice(0, 20));
