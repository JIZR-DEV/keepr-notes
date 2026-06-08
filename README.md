# Keepr Notes — Notas con timestamp para YouTube (Chrome + Firefox)

> **Tus notas viven en tu disco, no en un servidor que puede morir mañana.**

Extensión de navegador (Manifest V3, **Chrome/Edge y Firefox**) para tomar notas
con marca de tiempo mientras ves YouTube. Pulsas un botón, captura el segundo
exacto; haces clic en la nota y el video salta a ese momento. **100% local, sin
servidor, sin login, sin rastreo.**

## Funciones

- 📌 **Nota en un clic** desde el botón del player, el panel o con `Alt+N`
  (más un atajo configurable `Alt+Shift+N` vía la commands API del navegador).
- ⏱️ **Clic en la nota → salta al segundo exacto.**
- 🎨 **Color por nota** y **copiar enlace** al momento exacto (`?t=`).
- 🔎 **Búsqueda global** entre las notas de todos los videos.
- 🔀 **Orden** por tiempo / más recientes / última edición.
- 🗂️ **Panel lateral** (side panel en Chrome, sidebar en Firefox) + **Biblioteca**.
- 📤 **Export a Markdown** con timestamps clicables · **Backup/Restore** `.json`.
- 🌍 **Internacionalización** EN + ES (vía `_locales`).
- 🎉 **Onboarding** al instalar y **página de Ajustes** (tema claro/oscuro, color por defecto).
- 🛡️ **Resiliente** a rediseños de YouTube (MutationObserver + selectores con fallback + SPA nav).

## Arquitectura

```
src/                       Código compartido por ambos navegadores
  background.js            Abre panel (Chrome) / sidebar (Firefox) + commands + onboarding
  lib/
    compat.js              Shim kpApi = browser || chrome (promesas en ambos)
    i18n.js                Aplica traducciones a [data-i18n]
    notes.js               Capa de datos: CRUD, búsqueda, export, backup, settings
  content/                 Botón en el player, captura de tiempo, seek
  sidepanel/               Panel: notas, biblioteca, búsqueda global, tema
  options/                 Página de Ajustes
  welcome/                 Pantalla de bienvenida (primer uso)
  _locales/{en,es}/        Cadenas traducidas
  icons/                   16 / 48 / 128
manifest.chrome.json       Manifest específico de Chrome (side_panel, sidePanel)
manifest.firefox.json      Manifest específico de Firefox (sidebar_action, gecko id)
build.js                   Genera dist/chrome y dist/firefox
store/                     Fichas de tienda (EN/ES), privacidad y assets de marca
```

Una sola base de código (`src/`) + dos manifests. `kpApi` (en `compat.js`)
unifica el namespace: `browser.*` en Firefox, `chrome.*` en Chrome, ambos con
promesas. El panel usa `chrome.sidePanel` en Chrome y `sidebar_action` en Firefox.

## Build

```bash
node build.js            # genera dist/chrome y dist/firefox
node build.js chrome     # solo Chrome
node build.js firefox    # solo Firefox
```

## Instalación (modo desarrollador)

**Chrome / Edge:** `chrome://extensions` → Modo de desarrollador → *Cargar
descomprimida* → selecciona `dist/chrome`.

**Firefox:** `about:debugging#/runtime/this-firefox` → *Cargar complemento
temporal* → selecciona `dist/firefox/manifest.json`.

## Esquema de datos (local)

```jsonc
// clave: "keepr_v_<videoId>"
{
  "videoId": "abc123",
  "title": "Título del video",
  "url": "https://www.youtube.com/watch?v=abc123&t=0s",
  "updated": 1733520000000,
  "notes": [
    { "id": "n_x", "t": 92.4, "text": "Mi nota", "color": "#ef4444", "tags": [],
      "created": 0, "updated": 0 }
  ]
}
// clave: "keepr_settings" -> { theme, defaultColor }
```

## Permisos y por qué

- `storage` — guardar notas localmente.
- `sidePanel` (solo Chrome) / `sidebar_action` (Firefox) — mostrar el panel.
- `tabs` — saber qué video tienes activo para mostrar sus notas.
- `host_permissions: youtube.com` — inyectar el botón y leer el tiempo del player.

Sin permisos de red. Nada sale del dispositivo. Ver `store/PRIVACY.md`.

## Roadmap (post, detrás de Pro de pago único)

- Sync BYO-key a Notion/Obsidian/Drive · importador de exports de apps difuntas
  (rescate de huérfanos) · recordatorio de backup · captura de frame (tras spike técnico).
