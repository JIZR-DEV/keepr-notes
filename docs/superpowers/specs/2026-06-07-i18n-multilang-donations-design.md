# Diseño — Multi-idioma con override + módulo de donaciones

**Fecha:** 2026-06-07
**Proyecto:** Keepr Notes (extensión YouTube, Chrome + Firefox)
**Versión objetivo:** 0.3.0

## Objetivo

1. Ampliar la cobertura de idiomas de 2 (en, es) a **8** (en, es, pt, fr, de, it, hi, ja).
2. Permitir que el usuario **elija el idioma manualmente** desde Ajustes (override), con modo `Automático` por defecto que sigue el idioma del navegador.
3. Añadir un **módulo de donaciones** (Ko-fi + PayPal) como tarjeta en la página de Ajustes.

Sin nuevos permisos sensibles, sin cambios al modelo de datos de notas, local-first intacto.

## Decisiones tomadas

- **Selección de idioma:** Auto + override opcional (selector en Ajustes).
- **Idiomas nuevos:** pt, fr, de, it, hi, ja.
- **Donaciones:** tarjeta en la página de Ajustes (`options.html`).
- **Consistencia en el player:** el override aplica también al content script (botón/toast).
- **PayPal:** URL real `https://www.paypal.com/paypalme/JIZRxxx`.
- **Ko-fi:** `https://ko-fi.com/jizr_dev`.

## Restricción técnica clave

`chrome.i18n.getMessage()` siempre usa el idioma de la UI del navegador y **no se puede sobrescribir en runtime**. Para soportar un selector dentro de la app hace falta una **capa i18n propia** que cargue los `messages.json` por `fetch` y resuelva el idioma elegido, con fallback a inglés.

Los strings del **manifest** (`__MSG_extName__`, `__MSG_extDesc__`, `__MSG_actionTitle__`, `__MSG_cmdAddNote__`) seguirán usando la i18n nativa (el navegador los elige por su locale; no se pueden overridear). Es aceptable: son metadatos de tienda/acción.

## Arquitectura

### A. Capa i18n propia — `src/lib/i18n.js` (reescritura)

Responsabilidad única: resolver el idioma activo, cargar su diccionario (+ fallback inglés) y aplicar traducciones al DOM.

```
SUPPORTED = ['en','es','pt','fr','de','it','hi','ja']
DEFAULT   = 'en'
SETTINGS_KEY = 'keepr_settings'   // misma clave que KeeprNotes
```

- **Lectura de preferencia (desacoplada de KeeprNotes):** lee directamente
  `kpApi.storage.local.get('keepr_settings')` → campo `lang` (`'auto'` por defecto).
  Motivo: `welcome.html` carga i18n **sin** `notes.js`, y `options.html` carga i18n
  **antes** que `notes.js`. La capa no puede depender de `KeeprNotes`.
- **`resolveLang(pref)`:**
  - si `pref` está en `SUPPORTED` y no es `'auto'` → `pref`.
  - si `'auto'`: tomar subtag primario de `kpApi.i18n.getUILanguage()`
    (p. ej. `pt-BR` → `pt`); si está en `SUPPORTED` → ese; si no → `DEFAULT`.
- **`loadLocale(lang)`:** `fetch(kpApi.runtime.getURL('_locales/'+lang+'/messages.json'))`,
  parsea `{ key: { message } }` a `{ key: message }`. Errores → `{}`.
- **`init()` (async):** resuelve idioma → carga su diccionario; si no es inglés,
  carga también inglés como fallback y los fusiona (`{...en, ...lang}`) → fija
  `document.documentElement.lang` → `apply(document)`. Idempotente.
- **`setLang(lang)` (async):** persiste `lang` en settings (merge sobre `keepr_settings`)
  y re-ejecuta `init()` para re-aplicar en vivo. Devuelve el idioma resuelto.
- **`t(key, subs)`:** síncrono tras `init()`. Lookup en el diccionario fusionado;
  fallback al `key`. Soporta sustitución posicional `$1…$9` (replica getMessage de forma
  mínima; hoy no hay usos con subs, se incluye por robustez).
- **`apply(root)`:** igual que hoy (`data-i18n`, `data-i18n-ph`, `data-i18n-title`).
- **Auto-arranque:** al cargar, llama `init()` (en `DOMContentLoaded` si procede).
  En páginas sin DOM relevante (content script) `apply` no rompe nada.
- **Compatibilidad:** mantiene el namespace global `KeeprI18n` con `{ t, apply, init, setLang, SUPPORTED }`.

Ningún consumidor (`options.js`, `sidepanel.js`, `content.js`) cambia su forma de
llamar `t(...)`; solo se benefician del idioma resuelto.

### B. Preferencia de idioma en datos — `src/lib/notes.js`

- `DEFAULT_SETTINGS` pasa de `{ theme, defaultColor }` a
  `{ theme:'auto', defaultColor:'', lang:'auto' }`.
- `getSettings`/`setSettings` ya soportan campos arbitrarios (merge). Sin más cambios.

### C. Selector de idioma — `src/options/options.html` + `options.js`

- En la tarjeta **Appearance**, fila nueva:
  ```html
  <label class="o-row">
    <span data-i18n="optLanguage">Language</span>
    <select id="lang" class="o-select">
      <option value="auto" data-i18n="optLanguageAuto">Automatic (browser)</option>
      <option value="en">English</option>
      <option value="es">Español</option>
      <option value="pt">Português</option>
      <option value="fr">Français</option>
      <option value="de">Deutsch</option>
      <option value="it">Italiano</option>
      <option value="hi">हिन्दी</option>
      <option value="ja">日本語</option>
    </select>
  </label>
  ```
  Los nombres de idioma van en su **forma nativa** y NO se traducen (no llevan `data-i18n`).
- En `options.js init()`: setear `els.lang.value = s.lang || 'auto'`; en `change`,
  `await KeeprI18n.setLang(els.lang.value)` (persiste + re-aplica en vivo) + `status(...)`.

### D. Re-aplicación en vivo en el panel — `src/sidepanel/sidepanel.js`

El listener `kpApi.storage.onChanged` ya reacciona a `SETTINGS_KEY` (para el tema).
Añadir: al cambiar settings, `await KeeprI18n.init()` y re-render de la vista activa,
para que el panel cambie de idioma sin reabrirse. Respetar la guarda de edición existente.

### E. Player en el content script — `src/content/content.js` + manifests

- Añadir `lib/i18n.js` al array `js` del content script (después de `compat.js`,
  antes de `content.js`).
- `content.js`: su `t` local usa `KeeprI18n.t` si está disponible (fallback a la i18n
  nativa mientras `init()` resuelve). Tras `KeeprI18n.init()`, re-aplicar el título/aria
  del botón ya inyectado (`buildButton` lee `t('addNoteTooltip')`).
- **`web_accessible_resources`** en `manifest.chrome.json` y `manifest.firefox.json`:
  ```json
  "web_accessible_resources": [
    { "resources": ["_locales/*/messages.json"], "matches": ["https://www.youtube.com/*"] }
  ]
  ```
  Necesario para que el content script pueda `fetch` los diccionarios. Riesgo nulo
  (son strings de UI ya incluidos en el paquete).

### F. Módulo de donaciones — `src/options/options.html` + `options.css`

Nueva `<section class="o-card">` al final de `<main>`:

```html
<section class="o-card o-support">
  <h2 data-i18n="optSupport">Support Keepr</h2>
  <p class="o-hint" data-i18n="optSupportBody">Keepr is free and local-first. If it helps you, a small tip keeps it alive.</p>
  <div class="o-actions">
    <a class="o-btn o-btn--kofi"   href="https://ko-fi.com/jizr_dev" target="_blank" rel="noopener noreferrer" data-i18n="supportKofi">Buy me a Ko-fi</a>
    <a class="o-btn o-btn--paypal" href="https://www.paypal.com/paypalme/JIZRxxx" target="_blank" rel="noopener noreferrer" data-i18n="supportPaypal">Donate with PayPal</a>
  </div>
</section>
```

- Estilo en `options.css`: `.o-btn--kofi` (rojo Ko-fi `#FF5E5B` / texto blanco),
  `.o-btn--paypal` (azul PayPal `#0070BA` / texto blanco), respetando el sistema de
  tokens de tema existente. Los enlaces se ven como botones (reusan `.o-btn`).
- Abren en pestaña nueva con `rel="noopener noreferrer"` (seguridad).

### G. Traducciones — `src/_locales/{pt,fr,de,it,hi,ja}/messages.json`

Seis archivos nuevos, cada uno con **todas** las claves de `en/messages.json` +
las nuevas (`optLanguage`, `optLanguageAuto`, `optSupport`, `optSupportBody`,
`supportKofi`, `supportPaypal`). También añadir esas 6 claves a `en` y `es`.

Cobertura objetivo: 100% en los 8 idiomas. Nombres de marca ("Keepr Notes", "Ko-fi",
"PayPal", "Markdown") no se traducen. `extName`/`extDesc` se traducen para mejorar el
listado de tienda en cada locale.

## Claves i18n nuevas (todas las locales)

| key | en (referencia) |
|-----|-----------------|
| `optLanguage` | Language |
| `optLanguageAuto` | Automatic (browser) |
| `optSupport` | Support Keepr |
| `optSupportBody` | Keepr is free and local-first. If it helps you, a small tip keeps it alive. |
| `supportKofi` | Buy me a Ko-fi |
| `supportPaypal` | Donate with PayPal |

## Flujo de datos

```
Ajustes: <select #lang> --change--> KeeprI18n.setLang(lang)
   -> setSettings({lang}) en storage.local (keepr_settings)
   -> KeeprI18n.init(): resolve -> fetch dict(+en) -> apply(document)
   -> storage.onChanged dispara en sidepanel/content -> re-init + re-render
```

Arranque de cada página: `compat.js` define `kpApi` -> `i18n.js` auto-`init()`
(lee `keepr_settings` de storage, resuelve, fetch, apply).

## Manejo de errores

- `fetch` de un locale que falla → diccionario vacío → fallback a inglés → fallback a `key`.
- `getUILanguage()` ausente o locale no soportado → inglés.
- content script sin `web_accessible_resources` (build viejo) → `t` cae a i18n nativa.
- Settings corruptos → `DEFAULT_SETTINGS` (merge defensivo ya existente).

## Pruebas / verificación

- `node --check` en `i18n.js`, `options.js`, `sidepanel.js`, `content.js`, `notes.js`, `build.js`.
- JSON válido en los 6 locales nuevos + en/es modificados (parse de cada `messages.json`).
- **Cobertura i18n 100%:** script/comprobación de que cada locale tiene exactamente el
  conjunto de claves de `en` (sin faltantes ni sobrantes).
- Integridad de manifests: `web_accessible_resources` referencia rutas válidas;
  `lib/i18n.js` listado en content_scripts.
- `node build.js` genera `dist/chrome` y `dist/firefox` sin error; `manifest.json`
  resultante contiene `web_accessible_resources`.
- Manual (pendiente, navegador real): cambiar idioma en Ajustes → panel, opciones,
  welcome y botón del player cambian en vivo / al reabrir; donaciones abren en pestaña nueva.

## Fuera de alcance (YAGNI)

- Idiomas RTL (ar/he): ninguno de los 8 es RTL; sin manejo de `dir`.
- Override del idioma de los metadatos del manifest (limitación de la plataforma).
- Traducción automática por servicio externo (rompería local-first/privacidad).
- Detección/peso de calidad de traducción más allá de cobertura de claves.

## Archivos afectados

- Reescrito: `src/lib/i18n.js`
- Modificado: `src/lib/notes.js`, `src/options/options.html`, `src/options/options.js`,
  `src/options/options.css`, `src/sidepanel/sidepanel.js`, `src/content/content.js`,
  `manifest.chrome.json`, `manifest.firefox.json`,
  `src/_locales/en/messages.json`, `src/_locales/es/messages.json`
- Nuevo: `src/_locales/{pt,fr,de,it,hi,ja}/messages.json`
- Version bump: `package.json`, ambos manifests → `0.3.0`
```
