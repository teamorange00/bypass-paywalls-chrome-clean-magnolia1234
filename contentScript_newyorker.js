/* New Yorker: strip paywall UI; AMP unhide. No Googlebot. */
(function () {
  'use strict';

  var HIDE_CSS = [
    '[class*="paywall"]',
    '[class*="Paywall"]',
    '[class*="gateway"]',
    '.tp-modal',
    '.tp-backdrop',
    'aside[class*="paywall"]'
  ].join(',') + '{display:none!important;visibility:hidden!important;pointer-events:none!important;}';

  var UNMASK_CSS =
    'article,main,[class*="Article"],body' +
    '{max-height:none!important;overflow:visible!important;-webkit-mask-image:none!important;mask-image:none!important;}';

  function injectCss() {
    if (document.getElementById('bpc_nyer_hide_css'))
      return;
    var style = document.createElement('style');
    style.id = 'bpc_nyer_hide_css';
    style.textContent = HIDE_CSS + UNMASK_CSS;
    (document.documentElement || document.head || document).appendChild(style);
  }

  function clean() {
    document.querySelectorAll(
      '.paywall-bar, [class*="paywall"], [class*="Paywall"], [class*="gateway"], .tp-modal, .tp-backdrop'
    ).forEach(function (el) {
      try { el.remove(); } catch (e) {}
    });
    document.querySelectorAll('.responsive-asset--invisible').forEach(function (el) {
      el.classList.remove('responsive-asset--invisible');
    });
    document.querySelectorAll('.aspect-ratio--overlay-container, .asset-embed__asset-container').forEach(function (overlay) {
      var noscript = overlay.querySelector('noscript');
      if (!noscript || !noscript.innerHTML)
        return;
      var tmp = document.createElement('div');
      tmp.innerHTML = noscript.innerHTML;
      var img = tmp.querySelector('img');
      if (img) {
        overlay.appendChild(img);
        try { noscript.remove(); } catch (e) {}
      }
    });
    if (location.pathname.includes('/amp') || location.search.includes('outputType=amp')) {
      document.querySelectorAll('[amp-access-hide], [subscriptions-section]').forEach(function (el) {
        el.removeAttribute('amp-access-hide');
        el.removeAttribute('subscriptions-section');
        el.style.setProperty('display', 'block', 'important');
      });
      document.querySelectorAll('amp-ad, amp-embed, .ad').forEach(function (el) {
        try { el.remove(); } catch (e) {}
      });
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
