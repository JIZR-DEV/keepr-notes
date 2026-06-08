/*
 * Keepr Notes — helper de internacionalización con override de idioma.
 *
 * La API nativa (chrome.i18n.getMessage) siempre usa el idioma del navegador y
 * no se puede sobrescribir en runtime. Para permitir un selector de idioma en
 * Ajustes, esta capa carga los _locales/<lang>/messages.json por fetch y resuelve
 * el idioma elegido (o 'auto' = idioma del navegador), con fallback a inglés.
 *
 * - t(key, subs): síncrono tras la carga; mientras tanto cae a la i18n nativa.
 * - apply(root): aplica data-i18n / data-i18n-ph / data-i18n-title.
 * - init(): lee la preferencia de storage, carga el diccionario y aplica al DOM.
 * - setLang(lang): persiste la preferencia y re-aplica en vivo.
 * - ready: promesa que resuelve cuando el diccionario está cargado.
 *
 * Carga después de compat.js. Funciona en páginas de extensión y en el content
 * script (requiere _locales en web_accessible_resources para este último).
 */
(function (global) {
  'use strict';

  const SUPPORTED = ['en', 'es', 'pt', 'fr', 'de', 'it', 'hi', 'ja'];
  const DEFAULT = 'en';
  const SETTINGS_KEY = 'keepr_settings';

  let dict = {}; // diccionario fusionado { key: message }
  let currentLang = DEFAULT;

  function nativeMsg(key, subs) {
    try {
      const m = global.kpApi && global.kpApi.i18n && global.kpApi.i18n.getMessage(key, subs);
      if (m) return m;
    } catch {
      /* ignora */
    }
    return '';
  }

  /** Sustitución posicional $1..$9 al estilo de getMessage. */
  function substitute(msg, subs) {
    if (subs == null) return msg;
    const arr = Array.isArray(subs) ? subs : [subs];
    return msg.replace(/\$(\d)/g, (_, d) => {
      const i = Number(d) - 1;
      return i >= 0 && i < arr.length ? String(arr[i]) : '';
    });
  }

  function t(key, subs) {
    const fromDict = dict[key];
    if (fromDict) return substitute(fromDict, subs);
    // Aún no cargado o clave ausente: cae a la i18n nativa, luego a la clave.
    const native = nativeMsg(key, subs);
    return native || key;
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

  async function getPref() {
    try {
      const out = await global.kpApi.storage.local.get(SETTINGS_KEY);
      const s = out[SETTINGS_KEY] || {};
      return s.lang || 'auto';
    } catch {
      return 'auto';
    }
  }

  function resolveLang(pref) {
    if (pref && pref !== 'auto' && SUPPORTED.includes(pref)) return pref;
    let ui = '';
    try {
      ui = (global.kpApi.i18n.getUILanguage() || '').toLowerCase();
    } catch {
      ui = '';
    }
    const primary = ui.split('-')[0];
    return SUPPORTED.includes(primary) ? primary : DEFAULT;
  }

  async function loadLocale(lang) {
    try {
      const url = global.kpApi.runtime.getURL(`_locales/${lang}/messages.json`);
      const res = await fetch(url);
      if (!res.ok) return {};
      const raw = await res.json();
      const flat = {};
      for (const k of Object.keys(raw)) {
        if (raw[k] && typeof raw[k].message === 'string') flat[k] = raw[k].message;
      }
      return flat;
    } catch {
      return {};
    }
  }

  async function load(lang) {
    const target = await loadLocale(lang);
    if (lang === DEFAULT) return target;
    const base = await loadLocale(DEFAULT);
    return Object.assign({}, base, target); // fallback inglés bajo el idioma elegido
  }

  async function init() {
    const pref = await getPref();
    currentLang = resolveLang(pref);
    dict = await load(currentLang);
    try {
      document.documentElement.lang = currentLang;
    } catch {
      /* sin document (poco probable) */
    }
    apply(document);
    return currentLang;
  }

  async function setLang(lang) {
    try {
      const out = await global.kpApi.storage.local.get(SETTINGS_KEY);
      const next = Object.assign({}, out[SETTINGS_KEY] || {}, { lang });
      await global.kpApi.storage.local.set({ [SETTINGS_KEY]: next });
    } catch {
      /* si falla el guardado, igual aplicamos en memoria */
    }
    return init();
  }

  // Arranque automático. `ready` permite a los consumidores esperar el diccionario.
  const ready = init();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => apply());
  }

  global.KeeprI18n = { t, apply, init, setLang, ready, SUPPORTED, getCurrentLang: () => currentLang };
})(self);
