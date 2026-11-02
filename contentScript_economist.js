/* Economist: light UI strip for article regwall only. Never blank homepage / .tp-active. */
(function () {
  'use strict';

  // Homepage and section indexes must stay untouched — aggressive observers froze load.
  function isArticlePath() {
    var path = location.pathname || '';
    if (path === '/' || path.length < 8) return false;
    // Typical: /finance-and-economics/2026/07/18/slug
    return /\/\d{4}\/\d{2}\/\d{2}\//.test(path) ||
      /\/(article|story|interactive)\//i.test(path);
  }

  // IMPORTANT: never hide .tp-active — Piano puts that on <body> and whites out the site.
  var HIDE_CSS = [
    '#tp-regwall',
    '#regwall-container',
    '#regwall-contents',
    '#regwall-layout',
    '[data-testid="regwall"]',
    '[data-test-id="regwall"]',
    '.layout-article-regwall',
    '.tp-modal',
    '.tp-backdrop'
  ].join(',') +
    '{display:none!important;visibility:hidden!important;pointer-events:none!important;height:0!important;max-height:0!important;overflow:hidden!important;}';

  var UNLOCK_CSS =
    'html,body{pointer-events:auto!important;overflow:auto!important;}' +
    'body.tp-active{overflow:auto!important;}';

  function injectCss() {
    if (document.getElementById('bpc_econ_hide_css')) return;
    var style = document.createElement('style');
    style.id = 'bpc_econ_hide_css';
    style.textContent = HIDE_CSS + UNLOCK_CSS;
    (document.documentElement || document.head || document).appendChild(style);
  }

  function removeRegwall() {
    document.querySelectorAll(
      '#tp-regwall, #regwall-container, #regwall-contents, #regwall-layout, [data-testid="regwall"], [data-test-id="regwall"], .layout-article-regwall, .tp-modal, .tp-backdrop'
    ).forEach(function (el) {
      try { el.remove(); } catch (e) {}
    });
    if (document.body) {
      document.body.style.setProperty('pointer-events', 'auto', 'important');
      document.body.style.setProperty('overflow', 'auto', 'important');
    }
  }

  function readNextBody() {
    var el = document.getElementById('__NEXT_DATA__');
    if (!el) return null;
    try {
      var pp = JSON.parse(el.textContent).props.pageProps;
      var content = pp.content || {};
      var body = content.body || [];
      var paras = [];
      for (var i = 0; i < body.length; i++) {
        var item = body[i];
        if (!item) continue;
        var text = (item.text || '').trim();
        if (!text && item.textHtml) {
          var tmp = document.createElement('div');
          tmp.innerHTML = item.textHtml;
          text = (tmp.textContent || '').trim();
        }
        if (text) paras.push(text);
      }
      return {
        headline: content.headline || '',
        rubric: content.rubric || '',
        paras: paras
      };
    } catch (e) {
      return null;
    }
  }

  function renderArticle(data) {
    if (!data || !data.paras || !data.paras.length || document.getElementById('bpc_econ_restored'))
      return;
    // Only inject when the page looks gated / teaser-short
    var article = document.querySelector('article, [data-test-id="article-body"]');
    var visibleLen = article ? article.innerText.trim().length : 0;
    if (visibleLen > 2500 && data.paras.length < 8) return;

    var target = article || document.querySelector('main, body');
    if (!target) return;
    var wrap = document.createElement('div');
    wrap.id = 'bpc_econ_restored';
    wrap.style.cssText =
      'white-space:pre-wrap;line-height:1.7;max-width:42rem;margin:1.5rem auto;padding:1.25rem;font-size:1.05rem;background:#fff;color:#111;position:relative;z-index:2147483646;pointer-events:auto;';
    if (data.headline) {
      var h = document.createElement('h1');
      h.textContent = data.headline;
      wrap.appendChild(h);
    }
    if (data.rubric) {
      var rub = document.createElement('p');
      rub.style.fontStyle = 'italic';
      rub.textContent = data.rubric;
      wrap.appendChild(rub);
    }
    for (var i = 0; i < data.paras.length; i++) {
      var p = document.createElement('p');
      p.textContent = data.paras[i];
      wrap.appendChild(p);
    }
    target.appendChild(wrap);
  }

  function tick() {
    if (!isArticlePath()) return;
    injectCss();
    removeRegwall();
    var data = readNextBody();
    if (data && data.paras.length)
      renderArticle(data);
  }

  // Non-article pages: do nothing (fixes homepage hang).
  if (!isArticlePath()) return;

  injectCss();
  tick();

  var scheduled = false;
  var obs = new MutationObserver(function () {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () {
      scheduled = false;
      injectCss();
      removeRegwall();
    }, 250);
  });
  obs.observe(document.documentElement || document, { childList: true, subtree: true });

  var n = 0;
  var id = setInterval(function () {
    n += 1;
    tick();
    if (n >= 30) clearInterval(id);
  }, 700);

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', tick);
  window.addEventListener('load', tick);
})();
