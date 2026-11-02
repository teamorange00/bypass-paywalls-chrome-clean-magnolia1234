// Runs at document_start to stop Zephr before it truncates the article.
(function () {
  function shouldBlockScript(node) {
    if (!node || node.tagName !== 'SCRIPT')
      return false;
    var src = node.src || '';
    if (/zephr/i.test(src))
      return true;
    var text = node.textContent || '';
    return /zephr/i.test(text) && /feature-decisions|zephr-browser|zephr-anchor/i.test(text);
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
      return;
    }
    if (node.id === 'zephr-overlay' || (node.className && String(node.className).indexOf('zephr-') !== -1 && node.id !== 'zephr-anchor')) {
      if (node.id !== 'zephr-anchor')
        node.remove();
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

  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++)
        scan(added[j]);
    }
  });

  observer.observe(document.documentElement || document, {
    childList: true,
    subtree: true
  });

  if (document.documentElement)
    scan(document.documentElement);
})();
