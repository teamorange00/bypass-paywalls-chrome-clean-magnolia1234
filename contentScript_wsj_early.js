// WSJ document_start: stop Piano / TinyPass / Cxense paywall scripts early.
(function () {
  var BLOCK_SRC = /(cdn\.cxense\.com|tinypass\.com|piano\.io|\/asset\/piano\/|piano\.vx\.wsj\.com|piano\.auth\.wsj\.com)/i;

  function shouldBlockScript(node) {
    if (!node || node.tagName !== 'SCRIPT')
      return false;
    var src = node.src || '';
    if (BLOCK_SRC.test(src))
      return true;
    var text = node.textContent || '';
    return /tinypass|TP\.piano|piano\.io|cxense/i.test(text) && /paywall|subscribe|entitlement/i.test(text);
  }

  function blockNode(node) {
    if (!node || node.nodeType !== 1)
      return;
    if (node.tagName === 'IFRAME' || (node.tagName === 'DIV' && node.getAttribute('data-original-tag') === 'iframe')) {
      var src = node.src || node.getAttribute('src') || '';
      if (BLOCK_SRC.test(src)) {
        if (node.parentNode)
          node.parentNode.removeChild(node);
        return;
      }
    }
    if (node.id === 'cx-snippet-overlay-container' || node.id === 'cx-snippet-overlay' ||
        (node.className && typeof node.className === 'string' && /SnippetOverlay/i.test(node.className))) {
      if (node.parentNode)
        node.parentNode.removeChild(node);
      return;
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
