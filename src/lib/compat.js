/*
 * Keepr Notes — shim de compatibilidad cross-browser.
 * Define el namespace `kpApi` con APIs basadas en promesas en ambos navegadores:
 *  - Firefox expone `browser.*` (promesas nativas).
 *  - Chrome/Edge (MV3) exponen `chrome.*`, que ya devuelve promesas.
 * Debe cargarse ANTES de notes.js y del resto de scripts del mismo contexto.
 */
(function () {
  'use strict';
  globalThis.kpApi = globalThis.browser || globalThis.chrome;
})();
