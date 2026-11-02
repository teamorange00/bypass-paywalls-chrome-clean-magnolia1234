// FT document_start: block Zephr barrier bundle only.
// Do not strip page-kit / private-foundation — those own layout CSS/JS.
(function () {
  var BLOCK_SRC = /(zephrBarriersScripts|pg\.ft\.com\/adapters\/dotcom-article|consent-notice\.ft\.com\/cmp)/i;

  function shouldBlockScript(node) {
    if (!node || node.tagName !== 'SCRIPT')
      return false;
    if (node.id === '__NEXT_DATA__' || /ld\+json|application\/json/i.test(node.type || ''))
      return false;
    var src = node.src || '';
    if (src && BLOCK_SRC.test(src))
      return true;
    var text = node.textContent || '';
    if (text.length > 8000)
      return false;
    return /zephrBarriersScripts/i.test(text);
  }

  function blockNode(node) {
    if (!node || node.nodeType !== 1)
      return;
    if (shouldBlockScript(node)) {
      node.type = 'text/blocked-by-bpc';
      node.removeAttribute('src');
      try { node.textContent = ''; } catch (e) {}
      if (node.parentNode)
        node.parentNode.removeChild(node);
    }
  }

  function scan(root) {
    blockNode(root);
    if (!root || !root.querySelectorAll)
      return;
    var scripts = root.querySelectorAll('script');
    for (var i = 0; i < scripts.length; i++)
      blockNode(scripts[i]);
  }

  var scheduled = false;
  var observer = new MutationObserver(function (mutations) {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () {
      scheduled = false;
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++)
          scan(added[j]);
      }
    }, 0);
  });
  observer.observe(document.documentElement || document, { childList: true, subtree: true });
  if (document.documentElement)
    scan(document.documentElement);
})();
