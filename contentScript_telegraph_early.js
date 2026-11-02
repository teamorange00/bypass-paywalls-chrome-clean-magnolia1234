// Telegraph document_start: stop Piano / TinyPass / Adobe paywall scripts.
(function () {
  var BLOCK_SRC = /(tinypass\.com|piano\.io|\/piano\/|assets\.adobedtm\.com\/|cdn\.ampproject\.org\/v\d\/amp-(access|ad|subscriptions))/i;

  function shouldBlockScript(node) {
    if (!node || node.tagName !== 'SCRIPT')
      return false;
    if (node.id === '__NEXT_DATA__' || node.type === 'application/ld+json' || node.type === 'application/json')
      return false;
    var src = node.src || '';
    if (BLOCK_SRC.test(src))
      return true;
    var text = node.textContent || '';
    if (text.length > 8000)
      return false;
    return /tinypass\.com|TP\.piano|piano\.io\//i.test(text);
  }

  function blockNode(node) {
    if (!node || node.nodeType !== 1)
      return;
    if (node.tagName === 'IFRAME') {
      var src = node.src || node.getAttribute('src') || '';
      if (BLOCK_SRC.test(src)) {
        if (node.parentNode)
          node.parentNode.removeChild(node);
        return;
      }
    }
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
    var nodes = root.querySelectorAll('script, iframe');
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
