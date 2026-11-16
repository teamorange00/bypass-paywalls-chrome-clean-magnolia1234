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
    '[class*="articleBlur"]',
    '[id^="sp_message_container"]',
    'iframe[id^="sp_message_iframe"]'
  ].join(',') +
    '{display:none!important;visibility:hidden!important;height:0!important;max-height:0!important;overflow:hidden!important;pointer-events:none!important;}';

  var UNLOCK_CSS =
    'html,body' +
    '{pointer-events:auto!important;overflow:auto!important;overflow-y:auto!important;touch-action:auto!important;}' +
    'body,article,.body-copy,.body-copy-v2,.body-content,[class*="body-content"],main' +
    '{overflow:visible!important;max-height:none!important;-webkit-filter:none!important;filter:none!important;}' +
    // Repeat-visit lock: fortress adds _leaderboardParallaxWrapper_* to the
    // page wrapper (height:100vh; overflow-y:hidden), clipping the whole
    // article to one viewport so the wheel stops after ~280px. Unlock it.
    '[class*="leaderboardParallaxWrapper"],[class*="parallaxWrapper"]' +
    '{overflow:visible!important;overflow-y:visible!important;height:auto!important;max-height:none!important;}' +
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

  function stripScrollLock(el) {
    if (!el || typeof el.className !== 'string' || !el.className)
      return;
    // Fortress/Piano locks live on <html> as well as <body>:
    // _stopScroll_xxx / _restrictScroll_xxx / sp-message-open (Sourcepoint)
    if (!/stopScroll|restrictScroll|sp-message-open/i.test(el.className))
      return;
    el.className = el.className
      .split(/\s+/)
      .filter(function (c) {
        return c && !/stopScroll|restrictScroll|sp-message-open/i.test(c);
      })
      .join(' ');
  }

  function setImp(el, prop, value) {
    if (el.style.getPropertyValue(prop) !== value)
      el.style.setProperty(prop, value, 'important');
  }

  function unlockPage() {
    var html = document.documentElement;
    var body = document.body;
    if (html) {
      html.style.setProperty('pointer-events', 'auto', 'important');
      html.style.setProperty('overflow', 'auto', 'important');
      html.style.setProperty('overflow-y', 'auto', 'important');
      stripScrollLock(html);
    }
    if (body) {
      body.style.setProperty('pointer-events', 'auto', 'important');
      body.style.setProperty('overflow', 'auto', 'important');
      body.style.setProperty('overflow-y', 'auto', 'important');
      body.removeAttribute('data-paywall-overlay-status');
      stripScrollLock(body);
    }
    // Scroll locks can land on any wrapper, not just html/body
    // (e.g. _restrictScroll_* on a div). Strip them wherever they appear.
    document
      .querySelectorAll('[class*="restrictScroll"], [class*="stopScroll"]')
      .forEach(function (el) { stripScrollLock(el); });
    // Generic clipper unlock: any ancestor of the article that clips its
    // content (scrollHeight >> clientHeight, overflow hidden) is a paywall
    // scroll lock — the repeat-visit _leaderboardParallaxWrapper_* case.
    // Only ancestors are touched, so carousels/widgets inside the article
    // are left alone.
    var anchor = document.querySelector('article, main, #bpc_bbg_restored');
    var node = anchor ? anchor.parentElement : null;
    var guard = 0;
    while (node && node !== body && node !== html && guard < 20) {
      guard += 1;
      if (node.scrollHeight > node.clientHeight + 50) {
        setImp(node, 'overflow', 'visible');
        setImp(node, 'overflow-y', 'visible');
        setImp(node, 'height', 'auto');
        setImp(node, 'max-height', 'none');
      }
      node = node.parentElement;
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
      // Whitelist prose only. story.body also carries inline-newsletter,
      // tabularData (related-links headline soup), media and ad blocks —
      // inlining those produced concatenated, unspaced "paragraphs".
      if (type && !/^(paragraph|blockquote|quote|heading|subheading|dek|text|p)$/.test(type))
        continue;
      var text = inlineText(block).replace(/\s+/g, ' ').trim();
      if (text.length > 40 && paras[paras.length - 1] !== text)
        paras.push(text);
    }
    return paras;
  }

  function normText(s) {
    return (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
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

  var restoreAttempts = 0;

  function renderRestored(data) {
    if (!data || document.getElementById('bpc_bbg_restored'))
      return false;
    // Wait for the article shell. Appending to <body> at document_start
    // (previous behaviour) stranded the restored copy outside the article
    // grid, above/behind unrelated modules. Only fall back to <body>
    // after ~10s of ticks with no article/main in the DOM.
    var article = document.querySelector(
      'article[class*="articleLayout"], main article, article, main'
    );
    restoreAttempts += 1;
    if (!article && restoreAttempts < 25)
      return false;
    // Inserting/removing nodes inside the React (#__next) tree before
    // hydration finishes triggers React #418/#423 recovery, which can
    // discard the restored node. Wait for load; fortress/blur removal
    // above already makes the wait invisible to the reader.
    if (article && document.readyState !== 'complete' && restoreAttempts < 40)
      return false;
    var target = article || document.body;
    if (!target) return false;
    var inArticle = !!article;

    // If the page already rendered a full native body, do not duplicate it.
    if (inArticle) {
      var nativeParas = target.querySelectorAll(
        'p[class*="ArticleBodyText"], .body-copy p, .body-copy-v2 p'
      );
      if (nativeParas.length > 6 && !document.querySelector('[class*="articleBlur"]'))
        return true; // nothing to restore; stop retrying
    }

    var wrap = document.createElement('div');
    wrap.id = 'bpc_bbg_restored';
    wrap.className = 'body-copy art_done';
    wrap.style.cssText =
      'line-height:1.7;max-width:42rem;width:100%;box-sizing:border-box;margin:1.5rem auto;padding:1.25rem;font-size:1.05rem;background:#fff;color:#111;position:relative;z-index:2147483646;pointer-events:auto;grid-column:1/-1;justify-self:center;';

    // The in-page <h1> already shows the headline inside an article;
    // repeating it (and a summary identical to paragraph 1) read as
    // duplicated content. Only add them for the bare-<body> fallback.
    if (data.headline) {
      document.title = data.headline + ' - Bloomberg';
      if (!inArticle) {
        var h = document.createElement('h1');
        h.textContent = data.headline;
        wrap.appendChild(h);
      }
    }
    var firstPara = data.paras && data.paras.length ? data.paras[0] : '';
    if (data.summary && normText(data.summary) !== normText(firstPara)) {
      var s = document.createElement('p');
      s.style.fontStyle = 'italic';
      s.style.margin = '0 0 1em';
      s.textContent = data.summary;
      wrap.appendChild(s);
    }
    if (data.html) {
      wrap.insertAdjacentHTML('beforeend', data.html);
      wrap.querySelectorAll('script').forEach(function (sc) { sc.remove(); });
    } else if (data.paras && data.paras.length) {
      for (var i = 0; i < data.paras.length; i++) {
        var p = document.createElement('p');
        p.style.margin = '0 0 1em';
        p.textContent = data.paras[i];
        wrap.appendChild(p);
      }
    } else {
      return false;
    }

    // Replace the native teaser in place. Its 1-2 paragraphs duplicate
    // the restored opening, and its articleBlur overlay fades them out —
    // leaving it in the flow made the article start twice.
    var nativeBody = inArticle
      ? target.querySelector('div.body-content, div.body-copy-v2, div.body-copy')
      : null;

    // Remove any remaining blurred teaser fragments outside nativeBody.
    document
      .querySelectorAll('[class*="articleBlur"], div.body-content[class*="teaser-content_"], [class*="teaser-content"]')
      .forEach(function (el) {
        if (nativeBody && nativeBody.contains(el)) return;
        try { el.remove(); } catch (e) {}
      });

    if (nativeBody && nativeBody.parentNode) {
      nativeBody.parentNode.insertBefore(wrap, nativeBody);
      try { nativeBody.remove(); } catch (e) {}
    } else {
      // No native body container: sit just before "More From Bloomberg".
      var moreFrom = inArticle
        ? target.querySelector('[class*="gridLayout_full"], [class*="MoreFromBloomberg"]')
        : null;
      if (moreFrom && moreFrom.parentNode)
        moreFrom.parentNode.insertBefore(wrap, moreFrom);
      else
        target.appendChild(wrap);
    }
    unlockPage();
    return true;
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
