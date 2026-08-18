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

## `svg/` — los vectores (lo que hay que usar)

Convertidos con `pdftocairo -svg` desde la capa PDF del `.ai`, así que son
**trazados reales**, no calcos. Las letras vienen como contornos: no hace falta
tener Old London ni Acumin instaladas, y no hay problema de licencia de fuente.

| Archivo | viewBox | Qué es |
|---|---|---|
| `silla.svg` | 316 × 420 | La silla, un solo trazo de 474 puntos |
| `logotipo.svg` | 534 × 115 | Lockup completo: "Festival de arte / Cuarta Silla / Conceptual" |
| `wordmark.svg` | 533 × 85 | Sólo "Cuarta Silla", recortado al tinta |

Cada uno viene además en tres variantes de color ya resueltas
(`-roja` `#ff0100`, `-amarilla` `#fffd00`, `-hueso` `#cfd8d7`) para poder usarlas
desde `<img>`, donde `currentColor` no funciona.

### Dos decisiones sobre el arte

**El respaldo va calado.** En el tablero original la silla se dibuja con el texto
del respaldo pintado del color del fondo del panel (negro sobre la silla roja,
pizarra sobre la blanca). Eso ata cada silla a un fondo concreto. Aquí el texto
es una máscara: la silla es de un solo color y el fondo se ve por debajo del
logotipo. Así la misma silla funciona sobre cualquier color, que es como se
comporta en el manual.

**Se quitaron dos motas.** El arte original trae dos trazos sueltos junto a la
pata derecha (3,4 × 2,6 pt y 0,9 × 5,2 pt) que no forman parte del dibujo. Están
en los PNG, no en los SVG. Si resulta que son intencionales, se recuperan
volviendo a correr la conversión sin el filtro.

## Cómo se regeneran

```
brew install poppler
pdftocairo -svg "identidad visual.ai" board.svg
```

Para reproducir los recortes individuales hay que fijar el `MediaBox` de la
página por región antes de convertir: `pdftocairo` ignora `-x/-y/-W/-H` cuando
la salida es SVG.
