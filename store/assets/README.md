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

Las capturas de la ficha deben mostrar el producto REAL en funcionamiento, así que
se toman tras cargar la extensión (no se pueden autogenerar fielmente).

Tamaños:
- **Chrome Web Store:** 1280×800 o 640×400 (PNG/JPG). Mínimo 1, recomendado 4–5.
- **Firefox AMO:** tamaño libre (se recomienda ~1280×800).

Guion sugerido (alineado con los `screenshot_captions` de cada listing):
1. Un video de YouTube con el botón de Keepr en el player + el panel lateral con notas.
2. Clic en una nota → el video salta al segundo exacto (mostrar el timestamp).
3. La Biblioteca con búsqueda global entre todos los videos.
4. Export a Markdown con timestamps clicables (mostrar el `.md` resultante).
5. Pantalla de Ajustes mostrando "100% local, sin servidores" (mensaje de confianza).

Consejo: usa una ventana a 1280×800, tema oscuro, y un video de demo neutro.
