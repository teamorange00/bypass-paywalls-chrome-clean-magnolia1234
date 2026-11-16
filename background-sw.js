/* Bypass Paywalls Clean - Manifest V3 service worker */
console.log('[BPC] service worker started');

const ATLANTIC_METER_COOKIES = ['articleViews'];
const ATLANTIC_COOKIE_URLS = [
  'https://www.theatlantic.com/',
  'https://theatlantic.com/',
];

function isAtlanticUrl(url) {
  try {
    return /(^|\.)theatlantic\.com$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

async function clearAtlanticMeterCookies() {
  for (const url of ATLANTIC_COOKIE_URLS) {
    for (const name of ATLANTIC_METER_COOKIES) {
      try {
        await chrome.cookies.remove({ url, name });
      } catch (err) {
        // ignore missing cookies / permission races
      }
    }
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[BPC] installed', details.reason);
  try {
    const enabled = await chrome.declarativeNetRequest.getEnabledRulesets();
    console.log('[BPC] enabled rulesets', enabled);
  } catch (err) {
    console.error('[BPC] DNR status error', err);
  }
  clearAtlanticMeterCookies();
});

// Server Set-Cookie rewrites articleViews on every article hit — delete as soon as it appears.
chrome.cookies.onChanged.addListener((changeInfo) => {
  if (!changeInfo || changeInfo.removed || !changeInfo.cookie)
    return;
  const cookie = changeInfo.cookie;
  if (cookie.name !== 'articleViews')
    return;
  const domain = (cookie.domain || '').replace(/^\./, '');
  if (!/theatlantic\.com$/i.test(domain))
    return;
  const url = 'https://' + domain + (cookie.path || '/');
  chrome.cookies.remove({
    url,
    name: 'articleViews',
    storeId: cookie.storeId,
  }).catch(() => {});
});

if (chrome.webNavigation && chrome.webNavigation.onBeforeNavigate) {
  chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId === 0 && isAtlanticUrl(details.url))
      clearAtlanticMeterCookies();
  });
}

function isFtArticleUrl(url) {
  try {
    const u = new URL(url);
    return /(^|\.)ft\.com$/i.test(u.hostname) && /\/content\/[a-f0-9-]+/i.test(u.pathname);
  } catch {
    return false;
  }
}

function isWsjArticleUrl(url) {
  try {
    const u = new URL(url);
    if (!/(^|\.)wsj\.com$/i.test(u.hostname))
      return false;
    if (/\/amp\//.test(u.pathname))
      return true;
    if (/\/articles\//.test(u.pathname))
      return true;
    // Modern section URLs: /politics/policy/slug-id
    return u.pathname.split('/').filter(Boolean).length >= 3;
  } catch {
    return false;
  }
}

function decodeEntities(text) {
  const named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201d', ldquo: '\u201c',
    mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', copy: '\u00a9',
  };
  return String(text).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, ent) => {
    if (ent[0] === '#') {
      const code = ent[1] === 'x' || ent[1] === 'X'
        ? parseInt(ent.slice(2), 16)
        : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    const v = named[ent.toLowerCase()];
    return v !== undefined ? v : m;
  });
}

// archive.today snapshots normalize the FT body to
// <article id="article-body"><div>para</div>...</article> regardless of
// FT's own markup — extract and flatten that to plain text.
function extractArchiveArticleBody(html) {
  const start = html.indexOf('<article id="article-body"');
  if (start < 0)
    return '';
  const end = html.indexOf('</article>', start);
  if (end < 0)
    return '';
  const inner = html.slice(start, end);
  const text = inner
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|h\d)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '');
  const paras = decodeEntities(text)
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 40 && !/Subscribe to (read|unlock)/i.test(p));
  return paras.join('\n\n');
}

function canonicalFtUrl(url) {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/content\/[a-f0-9-]+/i);
    if (m)
      return u.origin + m[0];
  } catch {
    // fall through
  }
  return url;
}

async function fetchFtFromWayback(url) {
  try {
    const avail = await fetch(
      'https://archive.org/wayback/available?url=' + encodeURIComponent(url),
      { credentials: 'omit' }
    );
    if (!avail.ok)
      return { articleBody: '', headline: '' };
    const data = await avail.json();
    const closest = data && data.archived_snapshots && data.archived_snapshots.closest;
    if (!closest || !closest.available || !closest.url)
      return { articleBody: '', headline: '' };
    const resp = await fetch(closest.url, { credentials: 'omit', redirect: 'follow' });
    if (!resp.ok)
      return { articleBody: '', headline: '' };
    const html = await resp.text();
    // Wayback captures keep FT's original ld+json when the crawler was
    // served the full page; otherwise the body may be in article markup.
    const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
    for (const block of blocks) {
      try {
        let json = JSON.parse(block[1]);
        if (Array.isArray(json))
          json = json.find((x) => x && x.articleBody) || json[0];
        if (json && json.articleBody && json.articleBody.length > 1200)
          return { articleBody: json.articleBody, headline: json.headline || '' };
      } catch {
        // keep looking
      }
    }
    const fromMarkup = extractArchiveArticleBody(html);
    return { articleBody: fromMarkup, headline: '' };
  } catch {
    return { articleBody: '', headline: '' };
  }
}

async function fetchFtFromArchive(rawUrl) {
  const url = canonicalFtUrl(rawUrl);
  // archive.today captures are fetched once (often from a browser/region
  // FT served the full page to) and then served statically — FT's live
  // barrier never re-evaluates. Try the main mirrors in order.
  // NOTE: lookup must use the canonical /content/<uuid> URL — archive
  // indexes captures without tracking query strings (srnd, shareType...).
  for (const base of ['https://archive.ph/newest/', 'https://archive.today/newest/']) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 45000);
      const resp = await fetch(base + url, {
        redirect: 'follow',
        credentials: 'omit',
        signal: ctrl.signal,
        headers: { Accept: 'text/html,application/xhtml+xml' },
      });
      clearTimeout(timer);
      if (!resp.ok)
        continue;
      const html = await resp.text();
      const articleBody = extractArchiveArticleBody(html);
      if (articleBody.length > 1200) {
        const title = (html.match(/<title>([^<]+)/) || [])[1] || '';
        return { articleBody, headline: decodeEntities(title).trim(), source: 'archive' };
      }
    } catch {
      // try next mirror
    }
  }
  const wayback = await fetchFtFromWayback(url);
  if (wayback.articleBody && wayback.articleBody.length > 1200)
    return { articleBody: wayback.articleBody, headline: wayback.headline, source: 'wayback' };
  return { articleBody: '', headline: '', source: 'archive' };
}

async function fetchFtArticle(url) {
  let headline = '';
  let htmlLength = 0;
  try {
    const resp = await fetch(url, {
      redirect: 'follow',
      credentials: 'omit',
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    if (resp.ok) {
      const html = await resp.text();
      htmlLength = html.length;
      const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
      for (const block of blocks) {
        try {
          let json = JSON.parse(block[1]);
          if (Array.isArray(json))
            json = json.find((x) => x && x.articleBody) || json[0];
          if (json && json.articleBody) {
            return { headline: json.headline || '', articleBody: json.articleBody, htmlLength, source: 'live' };
          }
          if (json && json.headline && !headline)
            headline = json.headline;
        } catch {
          // keep looking
        }
      }
    }
  } catch {
    // fall through to archive
  }
  // Live FT returned the subscribe shell (premium articles): the body was
  // never sent. Fall back to an archive.today capture of the same URL.
  const archived = await fetchFtFromArchive(url);
  return {
    headline: headline || archived.headline || '',
    articleBody: archived.articleBody,
    htmlLength,
    source: archived.articleBody ? archived.source : 'none',
  };
}

/**
 * WSJ: no Googlebot/referer spoofing, no /client unlock probes, no SW re-fetch.
 * Full text needs a server documentKey we no longer request.
 * Content script handles Piano strip + public teaser only.
 */
async function fetchWsjArticle(_url, extras = {}) {
  return {
    headline: extras.headline || '',
    paras: Array.isArray(extras.paras) ? extras.paras : [],
    source: 'snippet',
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.request === 'clearAtlanticMeter') {
    clearAtlanticMeterCookies()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  if (message && message.request === 'ftArticle') {
    const url = message.url || (sender.tab && sender.tab.url);
    if (!isFtArticleUrl(url)) {
      sendResponse({ ok: false, error: 'not an FT article' });
      return false;
    }
    fetchFtArticle(url)
      .then((data) => sendResponse({ ok: true, ...data }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  if (message && message.request === 'wsjArticle') {
    const url = message.url || (sender.tab && sender.tab.url);
    if (!isWsjArticleUrl(url)) {
      sendResponse({ ok: false, error: 'not a WSJ article' });
      return false;
    }
    fetchWsjArticle(url, {
      headline: message.headline,
      paras: message.paras,
      unlocked: message.unlocked,
      encryptedDocumentKey: message.encryptedDocumentKey,
      encryptedDataHash: message.encryptedDataHash,
      entitlementsUrl: message.entitlementsUrl,
    })
      .then((data) => sendResponse({ ok: true, ...data }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  return false;
});

function injectRestoredArticle(tabId, response, site) {
  return chrome.scripting.executeScript({
    target: { tabId },
    func: (payload, siteName) => {
      const id = siteName === 'wsj' ? 'bpc_wsj_restored' : 'bpc_ft_restored';
      if (!payload || document.getElementById(id))
        return;
      if (siteName === 'wsj') {
        document.querySelectorAll(
          '.snippet-promotion, [class*="SnippetOverlay"], .tp-modal, .tp-backdrop, iframe[src*="piano"], iframe[src*="tinypass"]'
        ).forEach((el) => el.remove());
        const target = document.querySelector('article, main, [class*="ArticleBody"], body');
        if (!target || !payload.paras || !payload.paras.length)
          return;
        const wrap = document.createElement('div');
        wrap.id = id;
        wrap.style.cssText =
          'white-space:pre-wrap;line-height:1.7;max-width:42rem;margin:1.5rem auto;padding:1rem;font-size:1.05rem;background:#fff;color:#000;position:relative;z-index:2147483646;';
        if (payload.headline) {
          const h = document.createElement('h1');
          h.textContent = payload.headline;
          wrap.appendChild(h);
          document.title = payload.headline + ' - WSJ';
        }
        for (const p of payload.paras) {
          const el = document.createElement('p');
          el.textContent = p;
          wrap.appendChild(el);
        }
        target.appendChild(wrap);
        return;
      }

      // FT path (existing behavior)
      if (window.__bpcFtRequested)
        return;
      window.__bpcFtRequested = true;
      if (!payload.articleBody)
        return;
      document
        .querySelectorAll('#barrier-page, .barrier, .subscription-prompt, [data-trackable="paywall"], .article__content-sign-up')
        .forEach((el) => el.remove());
      const target = document.querySelector('.article__content, main, article, body');
      if (!target)
        return;
      const wrap = document.createElement('div');
      wrap.id = id;
      wrap.style.cssText =
        'white-space:pre-wrap;line-height:1.7;max-width:42rem;margin:1.5rem auto;padding:1rem;font-size:1.05rem;';
      if (payload.headline) {
        const h = document.createElement('h1');
        h.textContent = payload.headline;
        wrap.appendChild(h);
        document.title = payload.headline + ' | Financial Times';
      }
      const p = document.createElement('div');
      p.textContent = payload.articleBody;
      wrap.appendChild(p);
      target.appendChild(wrap);
    },
    args: [response, site],
  });
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url)
    return;

  if (isFtArticleUrl(tab.url)) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          if (window.__bpcFtRequested)
            return;
          window.__bpcFtRequested = true;
          chrome.runtime.sendMessage({ request: 'ftArticle', url: location.href }, (response) => {
            if (!response || !response.ok || !response.articleBody)
              return;
            if (document.getElementById('bpc_ft_restored'))
              return;
            const paywalled =
              document.title === 'Subscribe to read' ||
              !!document.querySelector('#barrier-page, .barrier, [data-trackable="paywall"]');
            const body = document.querySelector('.n-content-body, .js-article__content-body');
            const bodyLen = body ? (body.innerText || '').trim().length : 0;
            if (!paywalled && bodyLen > 1200)
              return;

            document
              .querySelectorAll(
                '#barrier-page, .barrier, .subscription-prompt, [data-trackable="paywall"], .article__content-sign-up'
              )
              .forEach((el) => el.remove());

            const target = document.querySelector('.article__content, main, article, body');
            if (!target)
              return;
            const wrap = document.createElement('div');
            wrap.id = 'bpc_ft_restored';
            wrap.style.cssText =
              'white-space:pre-wrap;line-height:1.7;max-width:42rem;margin:1.5rem auto;padding:1rem;font-size:1.05rem;';
            if (response.headline) {
              const h = document.createElement('h1');
              h.textContent = response.headline;
              wrap.appendChild(h);
              document.title = response.headline + ' | Financial Times';
            }
            const p = document.createElement('div');
            p.textContent = response.articleBody;
            wrap.appendChild(p);
            target.appendChild(wrap);
          });
        },
      });
    } catch (err) {
      console.error('[BPC] FT inject failed', err);
    }
    return;
  }

  // WSJ: do not auto-fetch or call /client — Akamai treats unlock probes as bot traffic.
});
