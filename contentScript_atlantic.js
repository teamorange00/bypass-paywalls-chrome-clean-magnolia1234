/* The Atlantic: clear articleViews meter, strip #gate-toast / last-free UI, restore from urql. No Googlebot. */
(function () {
  'use strict';

  var restored = false;

  function clearMeterCookie() {
    try {
      document.cookie = 'articleViews=; path=/; domain=.theatlantic.com; max-age=0';
      document.cookie = 'articleViews=; path=/; max-age=0';
      document.cookie = 'articleViews=; path=/; domain=www.theatlantic.com; max-age=0';
    } catch (e) {}
    try {
      chrome.runtime.sendMessage({ request: 'clearAtlanticMeter' });
    } catch (e) {}
  }

  clearMeterCookie();

  var HIDE_CSS = [
    '#gate-toast',
    '#gate-toast *',
    '[id*="gate-toast"]',
    '[class*="GateToast"]',
    '[class*="gate-toast"]',
    '[class*="Meter"]',
    '[class*="meter-banner"]',
    '[class*="ArticleMeter"]',
    '[data-testid*="meter"]',
    '[data-testid*="gate"]',
    '.c-nudge__container',
    '.c-non-metered-nudge',
    '[class*="nudge"]',
    '[class*="paywall"]',
    '[class*="Paywall"]',
    '.tp-modal',
    '.tp-backdrop'
  ].join(',') +
    '{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;height:0!important;max-height:0!important;overflow:hidden!important;}';

  var UNMASK_CSS =
    'article,main,[class*="Article"],[class*="ArticleBody"],body' +
    '{max-height:none!important;overflow:visible!important;-webkit-mask-image:none!important;mask-image:none!important;}';

  function injectCss() {
    if (document.getElementById('bpc_atlantic_hide_css'))
      return;
    var style = document.createElement('style');
    style.id = 'bpc_atlantic_hide_css';
    style.textContent = HIDE_CSS + UNMASK_CSS;
    (document.documentElement || document.head || document).appendChild(style);
  }

  function isMeterCopy(text) {
    if (!text) return false;
    if (/to read this story/i.test(text) && /sign in|free trial/i.test(text))
      return true;
    if (/last free article/i.test(text))
      return true;
    if (/free articles? remaining/i.test(text))
      return true;
    if (/you(?:'|’)ve? read \d+ (?:free )?articles?/i.test(text))
      return true;
    if (/\d+\s+free articles?\s+left/i.test(text))
      return true;
    return false;
  }

  function removeGateNodes() {
    document.querySelectorAll(
      '#gate-toast, [id*="gate-toast"], [class*="Meter"], [class*="meter-banner"], [data-testid*="meter"], .c-nudge__container, .c-non-metered-nudge, [class*="nudge"], .tp-modal, .tp-backdrop'
    ).forEach(function (el) {
      try { el.remove(); } catch (e) {}
    });

    document.querySelectorAll('div, section, aside, p, span').forEach(function (el) {
      var text = ((el.innerText || '').replace(/\s+/g, ' ').trim());
      if (!text || text.length > 220) return;
      if (isMeterCopy(text)) {
        try { el.remove(); } catch (e) {}
      }
    });
  }

  function extractUrqlArticle() {
    var next = document.getElementById('__NEXT_DATA__');
    if (!next || !next.textContent) return null;
    try {
      var data = JSON.parse(next.textContent);
      var state = data && data.props && data.props.pageProps && data.props.pageProps.urqlState;
      if (!state) return null;
      var best = null;
      Object.keys(state).forEach(function (key) {
        var entry = state[key];
        if (!entry || !entry.data || entry.data.length < 500) return;
        try {
          var inner = JSON.parse(entry.data);
          var art = inner && inner.article;
          if (!art || !Array.isArray(art.content) || !art.content.length) return;
          if (!best || art.content.length > best.content.length)
            best = art;
        } catch (e) {}
      });
      return best;
    } catch (e) {
      return null;
    }
  }

  function blocksToHtml(content, paraClass) {
    var html = '';
    for (var i = 0; i < content.length; i++) {
      var block = content[i];
      if (!block) continue;
      var inner = block.innerHtml || block.html || block.text || '';
      if (!inner) continue;
      if (block.__typename === 'ArticleParagraphContent' || !block.__typename || /Paragraph/i.test(block.__typename || '')) {
        html += '<p class="' + paraClass + '">' + inner + '</p>';
      } else if (inner.indexOf('<') === 0) {
        html += inner;
      } else {
        html += '<p class="' + paraClass + '">' + inner + '</p>';
      }
    }
    return html;
  }

  function restoreFromNextData() {
    if (restored) return;
    var art = extractUrqlArticle();
    if (!art || !art.content || art.content.length < 2) return;

    var body =
      document.querySelector('section[class*="ArticleBody"], [class*="ArticleBody_root"]') ||
      document.querySelector('article');
    if (!body) return;

    var existingParas = body.querySelectorAll('p[class*="ArticleParagraph"], p');
    var currentTextLen = (body.innerText || '').trim().length;
    var restoredHtml = blocksToHtml(
      art.content,
      (existingParas[0] && existingParas[0].className) || 'ArticleParagraph_root'
    );
    if (!restoredHtml || restoredHtml.length < 800) return;

    // Only restore when page is clearly truncated vs urql payload
    var restoredTextLen = restoredHtml.replace(/<[^>]+>/g, '').length;
    if (currentTextLen >= restoredTextLen * 0.85 && existingParas.length >= art.content.length)
      return;

    // Remove truncated paragraphs; keep ads/dividers
    body.querySelectorAll('p[class*="ArticleParagraph"]').forEach(function (p) {
      try { p.remove(); } catch (e) {}
    });

    var wrap = document.createElement('div');
    wrap.className = 'bpc-atlantic-restored';
    wrap.innerHTML = restoredHtml;
    var firstChild = body.firstChild;
    while (wrap.firstChild)
      body.insertBefore(wrap.firstChild, firstChild);

    restored = true;
  }

  function ampUnhide() {
    if (!(/\/amp\/?$/i.test(location.pathname) || location.search.includes('outputType=amp')))
      return;
    document.querySelectorAll('[amp-access-hide], [subscriptions-section="content"]').forEach(function (el) {
      el.removeAttribute('amp-access-hide');
      el.removeAttribute('subscriptions-section');
      el.style.setProperty('display', 'block', 'important');
    });
    document.querySelectorAll('amp-ad, amp-embed').forEach(function (el) {
      try { el.remove(); } catch (e) {}
    });
  }

  function tick() {
    clearMeterCookie();
    injectCss();
    removeGateNodes();
    restoreFromNextData();
    ampUnhide();
  }

  injectCss();
  tick();
  var obs = new MutationObserver(tick);
  obs.observe(document.documentElement || document, { childList: true, subtree: true });
  var n = 0;
  var id = setInterval(function () {
    n += 1;
    tick();
    if (n >= 60) clearInterval(id);
  }, 400);
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', tick);
  window.addEventListener('load', tick);
})();
