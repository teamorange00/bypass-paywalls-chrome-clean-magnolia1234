/* The Atlantic (MAIN world): hide/block articleViews meter cookie from page JS. */
(function () {
  'use strict';

  var METER = /(?:^|;\s*)articleViews=[^;]*/gi;

  function stripMeter(cookieStr) {
    return String(cookieStr || '')
      .replace(METER, '')
      .replace(/^;\s*/, '')
      .replace(/;\s*;/g, ';')
      .replace(/;\s*$/, '')
      .trim();
  }

  function clearMeterCookie() {
    try {
      document.cookie = 'articleViews=; path=/; domain=.theatlantic.com; max-age=0';
      document.cookie = 'articleViews=; path=/; max-age=0';
      document.cookie = 'articleViews=; path=/; domain=www.theatlantic.com; max-age=0';
    } catch (e) {}
  }

  try {
    var proto = Document.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, 'cookie');
    if (!desc || !desc.get || !desc.set) {
      proto = HTMLDocument.prototype;
      desc = Object.getOwnPropertyDescriptor(proto, 'cookie');
    }
    if (desc && desc.configurable && desc.get && desc.set) {
      Object.defineProperty(proto, 'cookie', {
        configurable: true,
        enumerable: true,
        get: function () {
          return stripMeter(desc.get.call(this));
        },
        set: function (value) {
          var v = String(value || '');
          if (/^\s*articleViews\s*=/i.test(v))
            return;
          return desc.set.call(this, v);
        }
      });
    }
  } catch (e) {}

  clearMeterCookie();
})();
