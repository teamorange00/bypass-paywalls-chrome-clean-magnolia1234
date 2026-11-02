// New Yorker: block presenter-articles paywall bundle + AMP subscriptions.
(function () {
  var BLOCK_SRC = /(\.newyorker\.com\/verso\/static\/presenter-articles.+\.js|cdn\.ampproject\.org\/v\d\/amp-(ad|subscriptions)|tinypass\.com|piano\.io)/i;

  function shouldBlockScript(node) {
    if (!node || node.tagName !== 'SCRIPT')
      return false;
    if (node.id === '__NEXT_DATA__' || /ld\+json|application\/json/i.test(node.type || ''))
      return false;
    return BLOCK_SRC.test(node.src || '');
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
