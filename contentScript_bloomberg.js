/* Bloomberg: strip fortress/sliding banners, unlock body scroll, restore from __NEXT_DATA__. No Googlebot. */
(function () {
  'use strict';

  var clearedStorage = false;

  var HIDE_CSS = [
    '#fortress-paywall-container-root',
    '#fortress-preblocked-container-root',
    '#fortress-container-root',
    '#slidingBanner',
    '#reg-ui-client',
    '[data-testid="column-wall"]',
    '[class*="columnWall"]',
    '#slidingBanner[class*="_sheet_"]',
    '#slidingBanner[class*="_sheetWrapper_"]',
    '#slidingBanner[class*="_banner_"]',
    'body[data-paywall-overlay-status] > #fortress-container-root',
    '.tp-modal',
    '.tp-backdrop',
    '[id^="sp_message_container"]',
    'iframe[id^="sp_message_iframe"]'
  ].join(',') +
    '{display:none!important;visibility:hidden!important;height:0!important;max-height:0!important;overflow:hidden!important;pointer-events:none!important;}';

  var UNLOCK_CSS =
    'html,body' +
    '{pointer-events:auto!important;overflow:auto!important;overflow-y:auto!important;touch-action:auto!important;}' +
    'body,article,.body-copy,.body-copy-v2,.body-content,[class*="body-content"],main' +
    '{overflow:visible!important;max-height:none!important;-webkit-filter:none!important;filter:none!important;}' +
    '.blur,[class*="nearly-transparent-text-blur"],.shimmering-text' +
    '{filter:none!important;-webkit-filter:none!important;opacity:1!important;}';

  function injectCss() {
    if (document.getElementById('bpc_bbg_hide_css'))
      return;
    var style = document.createElement('style');
    style.id = 'bpc_bbg_hide_css';
    style.textContent = HIDE_CSS + UNLOCK_CSS;
    (document.documentElement || document.head || document).appendChild(style);
  }

  function unlockPage() {
    var html = document.documentElement;
    var body = document.body;
    if (html) {
      html.style.setProperty('pointer-events', 'auto', 'important');
      html.style.setProperty('overflow', 'auto', 'important');
    }
    if (body) {
      body.style.setProperty('pointer-events', 'auto', 'important');
      body.style.setProperty('overflow', 'auto', 'important');
      body.style.setProperty('overflow-y', 'auto', 'important');
      body.removeAttribute('data-paywall-overlay-status');
      // Piano/fortress scroll lock: _stopScroll_xxxxx
      if (body.className && /stopScroll/i.test(body.className)) {
        body.className = body.className
          .split(/\s+/)
          .filter(function (c) { return c && !/stopScroll/i.test(c); })
          .join(' ');
      }
    }
  }

  function removeOverlays() {
    document.querySelectorAll(
      '#fortress-paywall-container-root, #fortress-preblocked-container-root, #fortress-container-root, #slidingBanner, #reg-ui-client, [data-testid="column-wall"], [class*="columnWall"], div[id^="leaderboard"], div[class^="leaderboard"], .canopy-container, .page-ad, [data-ad-placeholder], .tp-modal, .tp-backdrop, [id^="sp_message_container"], iframe[id^="sp_message_iframe"]'
    ).forEach(function (el) {
      try { el.remove(); } catch (e) {}
    });

    // Text-matched subscribe sheets (hashed class names change)
    document.querySelectorAll('div, section, aside').forEach(function (el) {
      var text = ((el.innerText || '').replace(/\s+/g, ' ').trim());
      if (!text || text.length > 450) return;
      if (/Claim This Offer/i.test(text) &&
          /unlimited access|Subscribe now for unlimited|first month|Cancel anytime/i.test(text)) {
        try { el.remove(); } catch (e) {}
      }
    });

    unlockPage();

    if (!clearedStorage) {
      clearedStorage = true;
      try { sessionStorage.clear(); } catch (e) {}
    }
  }

  function unblur() {
    document.querySelectorAll('div.blur[style]').forEach(function (el) {
      el.classList.remove('blur');
      el.removeAttribute('style');
    });
    document.querySelectorAll('div.shimmering-text').forEach(function (el) {
      try { el.remove(); } catch (e) {}
    });
    document.querySelectorAll('[class*="nearly-transparent-text-blur"]').forEach(function (el) {
      el.className = (el.className || '')
        .split(/\s+/)
        .filter(function (c) { return c && !/nearly-transparent-text-blur/i.test(c); })
        .join(' ');
    });
    document.querySelectorAll('img.lazy-img__image[src][data-native-src]').forEach(function (img) {
      if (/\/(60|150)x-1\.(png|jpg)$/.test(img.src))
        img.setAttribute('src', img.getAttribute('data-native-src'));
      img.style.filter = 'none';
    });
  }

  function inlineText(node) {
    if (!node) return '';
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(inlineText).join('');
    if (typeof node !== 'object') return '';
    if (typeof node.value === 'string') return node.value;
    if (typeof node.text === 'string') return node.text;
    if (node.content) return inlineText(node.content);
    return '';
  }

  function parasFromBody(body) {
    var paras = [];
    if (!body) return paras;
    var blocks = body.content || (Array.isArray(body) ? body : []);
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      if (!block || typeof block !== 'object') continue;
      var type = String(block.type || '').toLowerCase();
      if (type && !/paragraph|text|p\b|quote|heading|dek/i.test(type) && type !== 'paragraph') {
        var maybe = inlineText(block).replace(/\s+/g, ' ').trim();
        if (maybe.length > 60 && !/^https?:\/\//i.test(maybe))
          paras.push(maybe);
        continue;
      }
      var text = inlineText(block).replace(/\s+/g, ' ').trim();
      if (text.length > 40)
        paras.push(text);
    }
    return paras;
  }

  function readNextStory() {
    var el = document.getElementById('__NEXT_DATA__');
    if (!el) return null;
    try {
      var pp = JSON.parse(el.textContent).props.pageProps;
      var story = pp.story || {};
      return {
        headline: story.headline || story.seoHeadline || '',
        summary: story.summaryText || story.socialDescription || '',
        paras: parasFromBody(story.body)
      };
    } catch (e) {
      return null;
    }
  }

  function restoreFromJsonScript() {
    var jsonScript = document.querySelector(
      'script[data-component-props="ArticleBody"], script[data-component-props="FeatureBody"]'
    );
    if (!jsonScript) return null;
    try {
      var json = JSON.parse(jsonScript.textContent);
      var html = (json && json.body) || (json && json.story && json.story.body);
      if (!html || String(html).length < 200) return null;
      return { html: String(html), headline: (json && json.headline) || '' };
    } catch (e) {
      return null;
    }
  }

  function renderRestored(data) {
    if (!data || document.getElementById('bpc_bbg_restored'))
      return;
    var target = document.querySelector(
      'div.body-copy-v2, div.body-copy, div.body-content, article, main, body'
    );
    if (!target) return;

    var wrap = document.createElement('div');
    wrap.id = 'bpc_bbg_restored';
    wrap.className = 'body-copy art_done';
    wrap.style.cssText =
      'line-height:1.7;max-width:42rem;margin:1.5rem auto;padding:1.25rem;font-size:1.05rem;background:#fff;color:#111;position:relative;z-index:2147483646;pointer-events:auto;';

    if (data.headline) {
      var h = document.createElement('h1');
      h.textContent = data.headline;
      wrap.appendChild(h);
      document.title = data.headline + ' - Bloomberg';
    }
    if (data.summary) {
      var s = document.createElement('p');
      s.style.fontStyle = 'italic';
      s.textContent = data.summary;
      wrap.appendChild(s);
    }
    if (data.html) {
      wrap.insertAdjacentHTML('beforeend', data.html);
      wrap.querySelectorAll('script').forEach(function (sc) { sc.remove(); });
    } else if (data.paras && data.paras.length) {
      for (var i = 0; i < data.paras.length; i++) {
        var p = document.createElement('p');
        p.textContent = data.paras[i];
        wrap.appendChild(p);
      }
    } else {
      return;
    }

    target.appendChild(wrap);
    document.querySelectorAll('div.body-content[class*="teaser-content_"]').forEach(function (el) {
      try { el.remove(); } catch (e) {}
    });
    unlockPage();
  }

  function restore() {
    if (document.getElementById('bpc_bbg_restored'))
      return;
    if (!/\/(news|articles|features)\//.test(location.pathname))
      return;

    var fromScript = restoreFromJsonScript();
    if (fromScript) {
      renderRestored(fromScript);
      return;
    }

    var story = readNextStory();
    if (story && story.paras && story.paras.length >= 3)
      renderRestored(story);
  }

  function tick() {
    injectCss();
    removeOverlays();
    unlockPage();
    unblur();
    restore();
  }

  injectCss();
  tick();
  var obs = new MutationObserver(function () {
    injectCss();
    removeOverlays();
    unlockPage();
  });
  obs.observe(document.documentElement || document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
  var n = 0;
  var id = setInterval(function () {
    n += 1;
    tick();
    if (n >= 50) clearInterval(id);
  }, 400);
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', tick);
  window.addEventListener('load', tick);
})();
