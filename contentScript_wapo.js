/* Washington Post: GDPR continue + strip soft walls/ads. No Googlebot. */
(function () {
  'use strict';

  var HIDE_CSS = [
    '[data-qa$="-ad"]',
    '#leaderboard-wrapper',
    '[class*="paywall"]',
    '[class*="Paywall"]',
    '[data-qa*="paywall"]',
    '.tp-modal',
    '.tp-backdrop'
  ].join(',') + '{display:none!important;visibility:hidden!important;pointer-events:none!important;}';

  var UNMASK_CSS =
    'article,main,[data-qa="article-body"],body' +
    '{max-height:none!important;overflow:visible!important;-webkit-mask-image:none!important;mask-image:none!important;}';

  function injectCss() {
    if (document.getElementById('bpc_wapo_hide_css'))
      return;
    var style = document.createElement('style');
    style.id = 'bpc_wapo_hide_css';
    style.textContent = HIDE_CSS + UNMASK_CSS;
    (document.documentElement || document.head || document).appendChild(style);
  }

  function handleGdpr() {
    if (!location.href.includes('/gdpr-consent/'))
      return;
    var free = document.querySelector('.gdpr-consent-container .continue-btn.button.free');
    if (free) {
      try { free.click(); } catch (e) {}
    }
    setTimeout(function () {
      var box = document.querySelector('.gdpr-consent-container .consent-page:not(.hide) #agree');
      if (box) {
        box.checked = true;
        box.dispatchEvent(new Event('change'));
        var accept = document.querySelector(
          '.gdpr-consent-container .consent-page:not(.hide) .continue-btn.button.accept-consent'
        );
        if (accept) {
          try { accept.click(); } catch (e) {}
        }
      }
    }, 300);
  }

  function clean() {
    document.querySelectorAll('#leaderboard-wrapper, [data-qa$="-ad"], .tp-modal, .tp-backdrop').forEach(function (el) {
      try { el.remove(); } catch (e) {}
    });
  }

  function tick() {
    injectCss();
    handleGdpr();
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
