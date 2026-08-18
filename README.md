# Festival de Arte Conceptual — La Cuarta Silla

Migración del sitio de Wix (`festivaldearteconceptual.com`) a código propio.
Astro estático, sin backend, sin dependencias en tiempo de ejecución.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # -> dist/  (HTML estático)
npm run preview
```

## Dónde está el contenido

**Todo el texto vive en [`src/data/site.ts`](src/data/site.ts).** Un solo
archivo, en español, sin marcado. Para cambiar fechas, sedes, el manifiesto o
los horarios se edita ahí y nada más. Las páginas sólo lo consumen.

El texto se migró literal del sitio original. Dos apuntes:

- **`programa.dias`** — el original listaba «Domingo, 24 de septiembre», que
  choca con el rango anunciado (24–27). Aquí dice **27**. Si el original
  estaba bien y el festival sí repite día, se corrige en `site.ts`.
- **Textos nuevos** (no existían en Wix): las etiquetas de la cuenta regresiva
  (Días/Horas/Min/Seg), «Por anunciar» en los huecos del programa, y la
  página 404 («Silla vacía»). Todo lo demás es del original.

Los patrocinadores están vacíos a propósito: el sitio de Wix sólo tenía fotos
de stock de relleno. Cuando lleguen los logos reales se añaden a
`patrocinadores.lista` y la cuadrícula de «Próximamente» se reemplaza sola.

## Identidad

Paleta y tipografías salen del manual (`identidad visual.ai`), no del sitio
viejo:

| Token       | Hex       | Uso                                  |
| ----------- | --------- | ------------------------------------ |
| `amarillo`  | `#fffd00` | fondo dominante                      |
| `rojo`      | `#ff0100` | tinta principal, acentos             |
| `hueso`     | `#cfd8d7` | fondo de secciones de lectura        |
| `tinta`     | `#1e1e1e` | texto, bordes, cuenta regresiva      |
| `pizarra`   | `#23404a` | sección de sedes                     |
| `ladrillo`  | `#99272d` | disponible, sin usar todavía         |

El encargo pedía **amarillo primario, rojo, blanco secundario**, así que se
invirtió la jerarquía del sitio viejo (que era rojo sobre rojo): ahora el
amarillo es el campo y el rojo es la tinta.

**Tipografías.** El manual usa Old London y Acumin Variable Concept; ninguna
de las dos se puede servir en web sin licencia (Acumin es de Adobe Fonts,
sólo vía Typekit). Se sustituyeron por equivalentes libres, autoalojadas con
`@fontsource` — cero peticiones a Google:

| Manual / Wix              | En el sitio      | Rol                    |
| ------------------------- | ---------------- | ---------------------- |
| Old London                | UnifrakturCook   | wordmark «Cuarta Silla» |
| Tusker Grotesk Condensed  | Anton            | titulares display      |
| Acumin Variable Concept   | Archivo Variable | texto corrido          |
| Truetypewriter Polyglott  | Courier Prime    | fechas, metadatos      |

Si el cliente compra las licencias de Old London y Acumin, se cambian las
cuatro variables `--font-*` en `src/styles/global.css` y listo.

## Movimiento

El encargo pedía investigar librerías de transición minimalistas. El resumen
de lo que se evaluó y por qué está en [`MOTION.md`](MOTION.md). Lo que se
usa, en tres capas de menor a mayor coste:

1. **View Transitions nativas** entre páginas — 0 KB de JS.
2. **Animaciones CSS ligadas al scroll** (`animation-timeline`) para la barra
   de progreso y la deriva de las sillas — 0 KB de JS, con degradación limpia
   donde no hay soporte.
3. **JS**: Lenis para la inercia del scroll, un `IntersectionObserver` para
   los reveals y un partidor de líneas propio de ~20 líneas que sustituye a
   SplitText. **6.6 KB gzip en total**, incluidos la cuenta regresiva, el menú
   y la entrada de la portada móvil.

Reglas que se respetan en todo el sitio:

- `prefers-reduced-motion: reduce` apaga absolutamente todo el movimiento,
  incluidas la inercia de Lenis y las View Transitions.
- Los reveals cuelgan de una clase `.js` que pone un script en línea en el
  `<head>`. **Sin JS el contenido se ve igual**: nunca se queda escondido
  esperando una animación que no va a llegar.

## Móvil: otro sitio, no éste encogido

En un teléfono la portada medía **5 300px — más de seis pantallas de scroll**,
y el programa cinco más. Recortar y reordenar ese mismo contenido no bastaba:
seguía siendo demasiado. Así que el móvil **es otro sitio**. Misma paleta,
misma tipografía, mismos cantos de 2px; otra estructura y menos texto.

El de escritorio es una revista que se lee de arriba abajo. El móvil es una
portada con cuatro puertas, y detrás de cada puerta una pantalla que cabe
entera —sin scroll— porque lo que no cabía viene plegado.

| Página     | Antes (móvil)   | Ahora                          |
| ---------- | --------------- | ------------------------------ |
| Inicio     | ~6,3 pantallas  | 1 (+ manifiesto a un toque)    |
| Programa   | ~5 pantallas    | 1 (días plegados)              |
| Sedes      | ~7 pantallas    | 1 (sedes plegadas)             |
| Registro   | ~2,5 pantallas  | 1                              |

### La entrada

La portada arranca con la silla roja sola, centrada en el fondo oscuro. Luego
el amarillo inunda la pantalla desde abajo con un canto duro que corta la
silla por la mitad; la silla se retira al fondo hasta quedar en marca de agua;
cae el rótulo rojo; la franja de fechas entra barriendo de izquierda a
derecha; y aparecen las puertas. **1,9 s**, y se salta con tocar la pantalla.

Es CSS entero: cinco `@keyframes` y unos retrasos. El JS sólo decide si toca
jugarla —una vez por sesión, sólo en la portada— y le pone puerta de salida.
La decisión se toma en un script en línea del `<head>`, antes del primer
pintado: si se tomara más tarde, el teléfono llegaría a pintar la portada
terminada y la entrada empezaría con un salto hacia atrás.

Durante la entrada, la barra y las puertas llevan `pointer-events: none`. Un
enlace a opacidad 0 sigue siendo pulsable, y un destino que no se ve es una
trampa.

### Cómo está montado

Una página trae los dos contenidos y el ancho decide cuál se pinta:

```astro
<Base titulo="Sedes">
  <Fragment slot="movil"> … la pantalla de móvil … </Fragment>
  … el sitio de escritorio de siempre …
</Base>
```

Nunca se pintan los dos. `Base.astro` detecta el slot, marca el `<body>` y
apaga la cabecera y el pie del sitio grande en móvil, que ahí no pintan nada:
este sitio trae los suyos, más pequeños. Todo lo específico vive en
[`src/styles/movil.css`](src/styles/movil.css), dentro de una sola media
query — por encima de 1024px ese archivo no existe.

Las páginas que no traen `slot="movil"` (privacidad, 404) ya cabían en un
teléfono y se sirven igual en todas partes.

### Reglas que conviene no romper

- **Los acordeones son `<details>` nativos.** Cuatro días u ocho sedes caben
  en una pantalla si vienen plegados, y `<details>` lo da sin JS, accesible y
  con la búsqueda del navegador funcionando dentro.
- **El manifiesto es una pantalla con `:target`.** No tiene página propia —en
  escritorio es una sección de la home— y no merecía una URL nueva. `:target`
  da la pantalla, la URL y el botón atrás del teléfono, sin una línea de JS.
- **El pie del sitio grande no se pinta en móvil**, y con él se iba el único
  enlace al aviso de privacidad. Está en la línea legal del final de la
  portada; si se rehace esa zona, no se puede perder.
- **`--desvio`** (movil.css) es la mitad de lo que ocupan la franja, las
  puertas y el legal: coloca la silla en el centro de la *pantalla* al empezar
  la entrada, no en el centro de su hueco. Si cambian esos bloques, cambia.

## Estructura

```
src/
  data/site.ts        todo el texto, compartido por los dos sitios
  styles/global.css   tokens, componentes, las tres capas de movimiento
  styles/movil.css    el sitio móvil entero (una sola media query)
  scripts/motion.ts   Lenis + reveals + partidor + cuenta + menú + entrada
  layouts/Base.astro  head, SEO, JSON-LD, nav, pie, reparto móvil/escritorio
  components/         Nav, Footer, Marquee, Silla, Encabezado
  components/movil/   Portada (con la entrada), Pantalla
  pages/              index, programa, sedes, registro, privacidad, 404
```

## URLs

Las rutas viejas de Wix redirigen (301) para no romper enlaces que ya
circulan en redes y en el PDF de la convocatoria:

| Wix                      | Nueva         |
| ------------------------ | ------------- |
| `/agenda`                | `/programa`   |
| `/lugar`                 | `/sedes`      |
| `/event-list`            | `/registro`   |
| `/política-de-privacidad`| `/privacidad` |

## Publicación

`npm run build` deja HTML estático en `dist/`. Sirve tal cual en Netlify,
Vercel, Cloudflare Pages o cualquier hosting. Las redirecciones se generan
como páginas `<meta refresh>`; si el hosting soporta 301 de verdad
(`_redirects` en Netlify, `vercel.json`), conviene declararlas ahí también
para no perder señal de SEO.

## Lo que falta (depende del cliente)

- Contenido real del programa: los 48 horarios existen y están vacíos.
- Logos de patrocinadores.
- Registro a eventos: hoy es una ficha en estado «Próximamente» con el botón
  desactivado. Cuando se decida el sistema (formulario propio, Eventbrite,
  etc.) se conecta ahí.
- Redes sociales del festival: el sitio de Wix no enlazaba ninguna.
