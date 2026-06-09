# Assets de tienda

Fuentes vectoriales editables para la ficha de las tiendas.

- `promo-tile.svg` — 440×280. Tile promocional pequeño de Chrome Web Store.
- `marquee.svg` — 1400×560. Marquee / feature graphic (Chrome) y banner de AMO.

## Cómo exportar a PNG

Las tiendas piden PNG/JPG. Para rasterizar los SVG:

- **Rápido:** abre el `.svg` en un navegador, haz captura, o usa una extensión de export.
- **CLI (si tienes Inkscape):** `inkscape promo-tile.svg --export-filename=promo-tile.png -w 440 -h 280`
- **Online:** cualquier conversor SVG→PNG respetando el tamaño exacto.

## Screenshots de la ficha (capturas reales del producto)

Ya generadas en [`screenshots/`](screenshots/), a **1280×800 PNG** (tamaño exacto de
Chrome Web Store; también válidas para AMO). Renderizan la **UI real** de la extensión
(su HTML/CSS reales) con datos de ejemplo, sobre un marco promocional de marca. Set
completo en inglés y español:

| # | Inglés | Español | Muestra |
|---|--------|---------|---------|
| 1 | `01-capture-en.png` | `01-captura-es.png` | Notas con timestamp del vídeo activo |
| 2 | `02-library-en.png` | `02-biblioteca-es.png` | Biblioteca de vídeos anotados |
| 3 | `03-search-en.png` | `03-busqueda-es.png` | Búsqueda global con resaltado |
| 4 | `04-settings-en.png` | `04-ajustes-es.png` | Ajustes: tema, color, 8 idiomas |
| 5 | `05-welcome-en.png` | `05-bienvenida-es.png` | Onboarding (sin cuenta, sin servidores) |

No muestran vídeo real de YouTube (mejor para políticas de marca/copyright); el
contenido de ejemplo es neutro. Sube 4–5 por ficha en el idioma correspondiente.

### Cómo regenerarlas
Se generan con un harness desechable que monta la UI real con un mock de
`chrome.storage`, servido por HTTP, y capturado con Playwright a 1280×800. El harness
vive en `dist/` (se borra al rehacer el build), por lo que para reproducirlas hay que
recrear el mock + `promo.html` y volver a capturar. Tamaños de referencia:
- **Chrome Web Store:** 1280×800 o 640×400 (PNG/JPG). Mínimo 1, recomendado 4–5.
- **Firefox AMO:** tamaño libre (se recomienda ~1280×800).
