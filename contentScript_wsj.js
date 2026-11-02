/* WSJ: strip Piano UI only. No Googlebot/referer spoofing, no /client unlock probes. */
(function () {
  'use strict';

  var HIDE_CSS = [
    '#cx-snippet-overlay-container',
    '#cx-snippet-overlay',
    '#cx-snippet-promotion',
    '#cx-snippet-overlay-primary-button',
    '#cx-snippet-overlay-sign-in-text',
    '#cx-candybar',
    '#cx-sign-in-reminder',
    '#cx-scrim',
    '.snippet-promotion',
    '[class*="SnippetOverlay"]',
    '[class*="SnippetOverlayContainer"]',
    '[class*="SnippetSubheadline"]',
    '[class*="SnippetSignIn"]',
    '[class*="WSJLogoWrapper"]',
    '[data-testid*="Piano"]',
    '[data-testid*="Snippet"]',
    '.tp-container-inner',
    '.tp-modal',
    '.tp-backdrop',
    '.tp-iframe-wrapper',
    'div[data-original-tag="iframe"][src*="piano"]',
    'iframe[src*="piano"]',
    'iframe[src*="tinypass"]'
  ].join(',') + '{display:none!important;visibility:hidden!important;height:0!important;max-height:0!important;overflow:hidden!important;opacity:0!important;pointer-events:none!important;}';

  var UNMASK_CSS = [
    'html,body,article,main,[class*="ArticleBody"],[class*="article-body"]'
  ].join(',') + '{max-height:none!important;overflow:visible!important;-webkit-mask-image:none!important;mask-image:none!important;}';

  function injectCss() {
    if (document.getElementById('bpc_wsj_hide_css'))
      return;
    var style = document.createElement('style');
    style.id = 'bpc_wsj_hide_css';
    style.textContent = HIDE_CSS + UNMASK_CSS;
    (document.documentElement || document.head || document).appendChild(style);
  }

  function removePaywallNodes() {
    var sel = [
      '#cx-snippet-overlay-container',
      '#cx-snippet-overlay',
      '#cx-snippet-promotion',
      '#cx-snippet-overlay-primary-button',
      '#cx-snippet-overlay-sign-in-text',
      '#cx-candybar',
      '#cx-sign-in-reminder',
      '#cx-scrim',
      '.snippet-promotion',
      '[class*="SnippetOverlay"]',
      '[class*="SnippetSubheadline"]',
      '[class*="WSJLogoWrapper"]',
      '.tp-container-inner',
      'div[data-original-tag="iframe"][src*="piano"]',
      'iframe[src*="piano"]',
      'iframe[src*="tinypass"]'
    ].join(',');
    document.querySelectorAll(sel).forEach(function (el) {
      try { el.remove(); } catch (e) {}
    });

    document.querySelectorAll('div, section, aside, p').forEach(function (el) {
      var text = ((el.innerText || el.textContent || '')).replace(/\s+/g, ' ').trim();
      if (!text || text.length > 400) return;
      if (/Continue reading your article with a WSJ|Already a subscriber\? Sign In/i.test(text) &&
          /Subscribe Now|WSJ subscription/i.test(text)) {
        try { el.remove(); } catch (e) {}
      }
    });
  }

  function paragraphText(node) {
    if (!node) return '';
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(paragraphText).join('');
    if (node.content) return paragraphText(node.content);
    if (node.text) return node.text;
    if (node.textAndDecorations) return paragraphText(node.textAndDecorations);
    return '';
  }

  function readNextData() {
    var el = document.getElementById('__NEXT_DATA__');
    if (!el) return null;
    try {
      var pp = JSON.parse(el.textContent).props.pageProps;
      var items = (pp.articleData && pp.articleData.flattenedBody) || pp.snippet || [];
      var paras = [];
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var type = item && (item.__typename || item.type);
        if (type === 'ParagraphArticleBody' || type === 'paragraph') {
          var t = paragraphText(item).trim();
          if (t) paras.push(t);
        }
      }
      return {
        headline: (pp.articleData && pp.articleData.headline && pp.articleData.headline.text) || '',
        paras: paras
      };
    } catch (e) {
      return null;
    }
  }

  function renderArticle(headline, paras) {
    if (!paras || !paras.length || document.getElementById('bpc_wsj_restored'))
      return;
    removePaywallNodes();
    var target = document.querySelector('article, main, [class*="ArticleBody"], body');
    if (!target) return;
    var wrap = document.createElement('div');
    wrap.id = 'bpc_wsj_restored';
    wrap.style.cssText = 'white-space:pre-wrap;line-height:1.7;max-width:42rem;margin:1.5rem auto;padding:1.25rem;font-size:1.05rem;background:#fff;color:#111;position:relative;z-index:2147483646;';
    if (headline) {
      var h = document.createElement('h1');
      h.textContent = headline;
      wrap.appendChild(h);
      document.title = headline + ' - WSJ';
    }
    for (var i = 0; i < paras.length; i++) {
      var p = document.createElement('p');
      p.textContent = paras[i];
      wrap.appendChild(p);
    }
    target.appendChild(wrap);
  }

  function tick() {
    injectCss();
    removePaywallNodes();
    var data = readNextData();
    if (data && data.paras && data.paras.length)
      renderArticle(data.headline, data.paras);
  }

  injectCss();
  tick();

  var obs = new MutationObserver(function () {
    injectCss();
    removePaywallNodes();
  });
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
