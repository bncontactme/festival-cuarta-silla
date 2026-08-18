# Brand assets — Festival de arte Cuarta Silla Conceptual

Extraído de `identidad visual.ai` (Adobe Illustrator 30.3, mesa de trabajo 1440 × 2560 px).
Todo se rasterizó a 4× (5760 × 10240) desde la capa PDF del archivo. Los recortes con
transparencia se generaron desenmascarando el color de fondo sólido, así que los bordes
antialiasing quedan limpios sobre cualquier fondo.

## Paleta

| Nombre           | Hex       | RGB           | Uso en el tablero            |
|------------------|-----------|---------------|------------------------------|
| Rojo             | `#ff0100` | 255, 1, 0     | Color primario, fondo hero   |
| Amarillo         | `#fffd00` | 255, 253, 0   | Acento                       |
| Vino             | `#99272d` | 153, 39, 45   | Secundario, mockups          |
| Azul pizarra     | `#23404a` | 35, 64, 74    | Fondo oscuro alterno         |
| Gris claro       | `#cfd8d7` | 207, 216, 215 | "Blanco" de la marca         |
| Negro            | `#1e1e1e` | 30, 30, 30    | Fondo oscuro                 |

Nota: el "blanco" de la identidad es `#cfd8d7`, no `#ffffff`.

## Tipografías

- **OldLondon** — display / logotipo ("Cuarta Silla")
- **Acumin Variable Concept** — texto de apoyo ("Festival de arte", "Conceptual")

## Contenido

### `logotipo/`
- `logotipo-cuarta-silla.png` — 2140 × 463, alpha. Lockup completo en `#cfd8d7`.

### `sillas/`
- `silla-roja-sobre-negro.png` — 1267 × 1684, alpha. Silla en rojo, respaldo con logo.
- `silla-blanca-sobre-azul.png` — 1270 × 1686, alpha. Silla en `#cfd8d7`.
- `silla-mini-{amarilla,vino,blanca,azul}.png` — ~578 × 782, alpha. Las cuatro variantes
  cromáticas de la fila del hero. Resolución menor: son versiones pequeñas en el original.

### `lockups/`
Seis bloques de la sección "Paleta de color", nombrados por el hex del fondo:
`lockup-ff0100`, `lockup-fffd00`, `lockup-99272d`, `lockup-23404a`, `lockup-cfd8d7`,
`lockup-1e1e1e`. Cada uno ~2595 × 584, muestra el logotipo sobre ese fondo.

### `mockups/`
- `mockup-tote-vino.png` — 452 × 487, alpha
- `mockup-tote-roja.png` — 564 × 463, alpha

Estos dos son las **imágenes rasterizadas originales incrustadas** en el `.ai`, extraídas
sin recompresión. Su resolución nativa es baja; no dan para ampliar.

### `tableros/`
- `identidad-visual-completo.png` — el tablero entero a 4× (5760 × 10240)
- `panel-*.png` — cada sección recortada (hero, sillas, paleta, tipografías, mockups)

## Limitación: no hay vectores

Los recortes son PNG, no SVG. El arte de las sillas y el logotipo **sí es vectorial** dentro
del `.ai`, pero en esta máquina no hay ninguna herramienta de conversión PDF→SVG instalada
(poppler, inkscape, mutool, imagemagick). Dos caminos para obtener SVG real:

1. Exportar desde Illustrator: `Archivo → Exportar → Exportar como… → SVG`.
2. Instalar poppler y convertir:

   ```
   brew install poppler
   pdftocairo -svg "identidad visual.ai" identidad.svg
   ```

   El logotipo saldría con el texto convertido a trazados sólo si ya está expandido en el
   archivo; si no, hará falta OldLondon instalada o convertir el texto a contornos antes.
