/* Telegraph: strip Piano/subwall UI; keep article body already in DOM. No Googlebot. */
(function () {
  'use strict';

  var HIDE_CSS = [
    '[class^="subwall"]',
    '[class*="subwall"]',
    '.premium-paywall',
    '.tp-modal',
    '.tp-backdrop',
    '.tp-iframe-wrapper',
    'iframe[src*="tinypass"]',
    'iframe[src*="piano"]',
    '.truncated-content'
  ].join(',') + '{display:none!important;visibility:hidden!important;pointer-events:none!important;}';

  var UNMASK_CSS =
    'article,[itemprop="articleBody"],.articleBodyText,.article__content,main,body' +
    '{max-height:none!important;overflow:visible!important;-webkit-mask-image:none!important;mask-image:none!important;}';

  function injectCss() {
    if (document.getElementById('bpc_telegraph_hide_css'))
      return;
    var style = document.createElement('style');
    style.id = 'bpc_telegraph_hide_css';
    style.textContent = HIDE_CSS + UNMASK_CSS;
    (document.documentElement || document.head || document).appendChild(style);
  }

  function clean() {
    document.querySelectorAll(
      '[class^="subwall"], [class*="subwall"], .premium-paywall, .tp-modal, .tp-backdrop, .tp-iframe-wrapper, iframe[src*="tinypass"], iframe[src*="piano"], .advert, .commercial-unit, .truncated-content'
    ).forEach(function (el) {
      try { el.remove(); } catch (e) {}
    });

    // AMP unhide
    if (/\/amp\/?$/i.test(location.pathname) || location.pathname.includes('/amp/')) {
      document.querySelectorAll('[amp-access], [subscriptions-section]').forEach(function (el) {
        el.removeAttribute('amp-access');
        el.removeAttribute('amp-access-hide');
        el.removeAttribute('subscriptions-section');
        el.style.setProperty('display', 'block', 'important');
      });
      document.querySelectorAll('amp-ad, amp-embed, .premium-paywall').forEach(function (el) {
        try { el.remove(); } catch (e) {}
      });
    }

    // ld+json fallback if body looks empty
    if (document.getElementById('bpc_telegraph_restored'))
      return;
    var bodyEl = document.querySelector('article, [itemprop="articleBody"], .articleBodyText, main');
    var bodyLen = bodyEl ? (bodyEl.innerText || '').trim().length : 0;
    if (bodyLen > 800)
      return;

    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < scripts.length; i++) {
      try {
        var json = JSON.parse(scripts[i].textContent);
        if (Array.isArray(json))
          json = json.find(function (x) { return x && x.articleBody; }) || json[0];
        if (!json || !json.articleBody || String(json.articleBody).length < 400)
          continue;
        var wrap = document.createElement('div');
        wrap.id = 'bpc_telegraph_restored';
        wrap.style.cssText =
          'white-space:pre-wrap;line-height:1.7;max-width:42rem;margin:1.5rem auto;padding:1.25rem;font-size:1.05rem;background:#fff;color:#111;position:relative;z-index:2147483646;';
        if (json.headline) {
          var h = document.createElement('h1');
          h.textContent = json.headline;
          wrap.appendChild(h);
        }
        var p = document.createElement('div');
        p.textContent = json.articleBody;
        wrap.appendChild(p);
        (bodyEl || document.body).appendChild(wrap);
        break;
      } catch (e) {}
    }
  }

  function tick() {
    injectCss();
    clean();
  }

  injectCss();
  tick();
  var obs = new MutationObserver(tick);
  obs.observe(document.documentElement || document, { childList: true, subtree: true });
  var n = 0;
  var id = setInterval(function () {
    n += 1;
    tick();
    if (n >= 30) clearInterval(id);
  }, 500);
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', tick);
  window.addEventListener('load', tick);
})();
