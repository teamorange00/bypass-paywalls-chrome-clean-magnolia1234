/**
 * The Times: Zephr soft-wall UI only.
 * Full article body is NOT in the page for non-subscribers (no Googlebot unlock).
 * Avoid blanking the page by hiding broad [class*="paywall"] wrappers.
 */
(function () {
  'use strict';

  // Specific Zephr / portal nodes only — do NOT use [class*="paywall"] (too broad).
  var HIDE_CSS = [
    '#tm-zephr-footer-fallback-paywall',
    '#paywall-portal-article-footer',
    '#paywall-portal-page-footer',
    '.subscription-block',
    '.zephr-paywall',
    '.paywall-bau-banner',
    '.tm-zephr-footer-fallback__paywall',
    '[class*="zephr-paywall"]',
    '[class*="zephr-rule"]'
  ].join(',') + '{display:none!important;visibility:hidden!important;pointer-events:none!important;}';

  function injectCss() {
    var style = document.getElementById('bpc_times_hide_css');
    if (!style) {
      style = document.createElement('style');
      style.id = 'bpc_times_hide_css';
      (document.documentElement || document.head || document).appendChild(style);
    }
    style.textContent = HIDE_CSS;
  }

  function removeWallUi() {
    document.querySelectorAll(
      '#tm-zephr-footer-fallback-paywall, #paywall-portal-article-footer, #paywall-portal-page-footer, .subscription-block, .zephr-paywall, .paywall-bau-banner, .tm-zephr-footer-fallback__paywall, [class*="zephr-paywall"]'
    ).forEach(function (el) {
      try { el.remove(); } catch (e) {}
    });
  }

  function articleBits() {
    var h1 = document.querySelector('h1');
    var headline = h1 ? h1.textContent.trim() : (document.title || '').split('|')[0].trim();
    var dek = '';
    var dekEl =
      document.querySelector('[data-testid="standfirst"], .article-header__standfirst, .standfirst, h1 + p, header p');
    if (dekEl)
      dek = (dekEl.textContent || '').trim();
    var paras = [];
    document.querySelectorAll('article p, [data-testid="article-body"] p').forEach(function (p) {
      var t = (p.textContent || '').trim();
      if (t.length > 40 && !/Subscribe|Start trial|Continue reading|Flash Sale/i.test(t))
        paras.push(t);
    });
    return { headline: headline, dek: dek, paras: paras };
  }

  function showTeaserNote(bits) {
    if (document.getElementById('bpc_times_note'))
      return;
    // Only when body is clearly teaser-only
    var article = document.querySelector('article, [data-testid="article-body"], main');
    var len = article ? article.innerText.trim().length : 0;
    if (len > 1200)
      return;

    var wrap = document.createElement('div');
    wrap.id = 'bpc_times_note';
    wrap.style.cssText =
      'max-width:42rem;margin:1.5rem auto;padding:1.25rem;font:16px/1.6 system-ui,sans-serif;color:#111;background:#fff;border-top:3px solid #111;position:relative;z-index:2147483646;';
    if (bits.headline) {
      var h = document.createElement('h1');
      h.style.cssText = 'font-size:1.6rem;line-height:1.25;margin:0 0 0.75rem;';
      h.textContent = bits.headline;
      wrap.appendChild(h);
    }
    if (bits.dek) {
      var d = document.createElement('p');
      d.style.cssText = 'font-size:1.1rem;margin:0 0 1rem;';
      d.textContent = bits.dek;
      wrap.appendChild(d);
    }
    for (var i = 0; i < bits.paras.length; i++) {
      var p = document.createElement('p');
      p.textContent = bits.paras[i];
      wrap.appendChild(p);
    }
    var note = document.createElement('p');
    note.style.cssText = 'margin-top:1.25rem;padding-top:1rem;border-top:1px solid #ddd;color:#444;font-size:0.95rem;';
    note.textContent =
      'The Times only sends this teaser to the browser for non-subscribers. Full text is not on the page to restore (same as WSJ/Economist).';
    wrap.appendChild(note);
    (article || document.body).appendChild(wrap);
  }

  function tick() {
    injectCss();
    removeWallUi();
    showTeaserNote(articleBits());
  }

  injectCss();
  tick();
  var obs = new MutationObserver(function () {
    injectCss();
    removeWallUi();
  });
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
