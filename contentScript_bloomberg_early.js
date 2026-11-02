// Bloomberg: block TinyPass / fence / transporter paywall scripts early.
(function () {
  var BLOCK_SRC = /(tinypass\.com|piano\.io|assets\.bwbx\.io\/s\d\/(fence\/plug-client|javelin\/.+\/transporter)\/)/i;

  function shouldBlockScript(node) {
    if (!node || node.tagName !== 'SCRIPT')
      return false;
    if (/ld\+json|application\/json/i.test(node.type || '') || node.getAttribute('data-component-props'))
      return false;
    var src = node.src || '';
    if (BLOCK_SRC.test(src))
      return true;
    var text = node.textContent || '';
    if (text.length > 8000)
      return false;
    return /tinypass\.com|TP\.piano|fortress-paywall|fortress-container|slidingBanner|paywall-overlay/i.test(text);
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
