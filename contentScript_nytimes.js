/* NYT: strip soft paywall UI / dock; click preview if present. No Googlebot. */
(function () {
  'use strict';

  var HIDE_CSS = [
    '[data-testid="inline-message"]',
    '.expanded-dock',
    '#gateway-content',
    '[id*="gateway"]',
    '[class*="gw-modal"]',
    '[class*="css-"][class*="modal"]',
    '.nytc---modal-window---isShown',
    '.tp-modal',
    '.tp-backdrop'
  ].join(',') + '{display:none!important;visibility:hidden!important;pointer-events:none!important;}';

  var UNMASK_CSS =
    'html,body,article,main,#site-content,#story,[name="articleBody"]' +
    '{overflow:visible!important;height:auto!important;max-height:none!important;position:static!important;}' +
    '#app>div,#site-content>div{position:static!important;}';

  function injectCss() {
    if (document.getElementById('bpc_nyt_hide_css'))
      return;
    var style = document.createElement('style');
    style.id = 'bpc_nyt_hide_css';
    style.textContent = HIDE_CSS + UNMASK_CSS;
    (document.documentElement || document.head || document).appendChild(style);
  }

  function clean() {
    document.querySelectorAll(
      '[data-testid="inline-message"], .expanded-dock, #gateway-content, .nytc---modal-window---isShown, .tp-modal, .tp-backdrop'
    ).forEach(function (el) {
      try { el.remove(); } catch (e) {}
    });
    document.querySelectorAll('.nytc---modal-window---noScroll').forEach(function (el) {
      el.classList.remove('nytc---modal-window---noScroll');
    });
    // soft "continue reading" / preview buttons
    document.querySelectorAll('button, a').forEach(function (el) {
      var t = (el.textContent || '').trim().toLowerCase();
      if (t === 'continue reading' || t === 'read more' || /css-3s1ce0/.test(el.className || '')) {
        try { el.click(); } catch (e) {}
      }
    });
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
    if (n >= 40) clearInterval(id);
  }, 500);
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', tick);
  window.addEventListener('load', tick);
})();
