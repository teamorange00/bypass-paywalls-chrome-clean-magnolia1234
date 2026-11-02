// NYT: block meter / paywall scripts (no Googlebot).
(function () {
  var BLOCK_SRC = /(meter-svc\.nytimes\.com\/meter\.js|mwcm\.nyt\.com\/.+\.js|tinypass\.com|piano\.io)/i;

  function shouldBlockScript(node) {
    if (!node || node.tagName !== 'SCRIPT')
      return false;
    if (node.id === '__NEXT_DATA__' || /ld\+json|application\/json/i.test(node.type || ''))
      return false;
    var src = node.src || '';
    if (BLOCK_SRC.test(src))
      return true;
    var text = node.textContent || '';
    if (text.length > 8000)
      return false;
    return /meter-svc\.nytimes|paywall.*nytimes/i.test(text);
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
    var nodes = root.querySelectorAll('script');
    for (var i = 0; i < nodes.length; i++)
      blockNode(nodes[i]);
  }

  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++)
        scan(added[j]);
    }
  });
  observer.observe(document.documentElement || document, { childList: true, subtree: true });
  if (document.documentElement)
    scan(document.documentElement);
})();
