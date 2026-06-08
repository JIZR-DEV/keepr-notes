/*
 * Keepr Notes — helper de internacionalización.
 * t(key, subs) lee de _locales vía kpApi.i18n; aplica traducciones a los
 * elementos marcados con data-i18n / data-i18n-ph / data-i18n-title.
 * Carga después de compat.js.
 */
(function (global) {
  'use strict';

  function t(key, subs) {
    try {
      const msg = global.kpApi && global.kpApi.i18n && global.kpApi.i18n.getMessage(key, subs);
      if (msg) return msg;
    } catch {
      /* ignora */
    }
    return key;
  }

  function apply(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const v = t(el.getAttribute('data-i18n'));
      if (v) el.textContent = v;
    });
    scope.querySelectorAll('[data-i18n-ph]').forEach((el) => {
      const v = t(el.getAttribute('data-i18n-ph'));
      if (v) el.setAttribute('placeholder', v);
    });
    scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const v = t(el.getAttribute('data-i18n-title'));
      if (v) el.setAttribute('title', v);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => apply());
  } else {
    apply();
  }

  global.KeeprI18n = { t, apply };
})(self);
