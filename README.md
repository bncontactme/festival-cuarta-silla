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

### Lo que está montado y esperando contenido

Tres cosas del pedido del 26/08 están construidas enteras y **apagadas hasta
que lleguen los datos**. Ninguna necesita tocar una plantilla: se pega el dato
en su archivo y se encienden solas.

| Qué | Archivo | Qué falta |
| --- | --- | --- |
| Artistas | `src/data/artistas.ts` | nombres, disciplina, `@` y fotos 4:5 en `public/artistas/` |
| Archivo de ediciones | `src/data/archivo.ts` | año de cada edición y fotos en `public/archivo/<año>/` |
| Donaciones | `festival.donaciones.paypal` en `src/data/site.ts` | el enlace de PayPal |

Mientras están vacías, cada una se pinta en su estado vacío —una ficha que
dice qué falta— salvo la donación, que **no se pinta en absoluto**: un botón
de donar que no lleva a ninguna parte es peor que no tenerlo. En cuanto haya
enlace aparece en tres sitios a la vez (cierre de la portada, pie y remate de
`/registro`).

## Identidad

Paleta y tipografías salen del manual (`identidad visual.ai`), no del sitio
viejo:

| Token       | Hex       | Uso                                        |
| ----------- | --------- | ------------------------------------------ |
| `amarillo`  | `#fffd00` | el campo — fondo dominante                 |
| `papel`     | `#ffffff` | el descanso — secciones de lectura y fotos |
| `tinta`     | `#1e1e1e` | el peso — sedes, cuenta regresiva, pie     |
| `rojo`      | `#ff0100` | el grito — cierre, cinta, acentos          |
| `ladrillo`  | `#99272d` | el filete del tipo «escena» del Gantt      |
| `hueso`     | `#cfd8d7` | **retirado** — declarado, sin uso          |
| `pizarra`   | `#23404a` | **retirado** — declarado, sin uso          |

El encargo pedía **amarillo primario, rojo, blanco secundario**, así que se
invirtió la jerarquía del sitio viejo (que era rojo sobre rojo): ahora el
amarillo es el campo y el rojo es la tinta.

**Por qué se retiraron el hueso y la pizarra.** En la revisión del 26/08 el
cliente los señaló a los dos: «el gris no me gusta nada, prefiero que sea
blanco» y «el azul… siento que apaga la página esos colores, y la página son
colores vivos». Tenía razón de fondo: eran las dos únicas superficies apagadas
del sitio y entre las dos cargaban todo lo que se lee y el plano entero. El
gris pasó a blanco y el azul a negro, y las secciones quedan alternando claro
y oscuro sin repetir fondo dos veces seguidas:

```
amarillo → tinta → rojo → papel → TINTA → amarillo → papel → TINTA →
papel ⇄ amarillo → rojo → tinta
```

Los dos tokens se quedan declarados en `global.css` porque están en el manual
de identidad; simplemente no visten ninguna superficie.

Dos colores más del sistema, y no son tintas sino roles: `--anillo` (el color
del anillo de foco) y `--canto` (el canto y la sombra dura de los botones).
Los dos valen tinta por defecto y las secciones oscuras los vuelcan a
amarillo, porque sobre negro un canto de tinta no existe.

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
  data/tipos.ts       las formas del contenido que carga el panel
  data/contenido.ts   lee la instantánea; dice si viene del panel o del repo
  data/contenido.json la instantánea, comiteada: respaldo e histórico en git
  styles/global.css   tokens, componentes, las tres capas de movimiento
  styles/movil.css    el sitio móvil entero (una sola media query)
  styles/panel.css    el panel; CSS propio, no el del sitio
  scripts/motion.ts   Lenis + reveals + partidor + cuenta + menú + entrada
  scripts/panel/      el panel: api, esquema, campos, tabla, previa
  layouts/Base.astro  head, SEO, JSON-LD, nav, pie, reparto móvil/escritorio
  components/         Nav, Footer, Marquee, Silla, Encabezado
  components/movil/   Portada (con la entrada), Pantalla
  pages/              index, programa, artistas, sedes, archivo, registro,
                      privacidad, 404
  pages/admin/        el panel de edición (noindex, fuera del sitemap)
scripts/instantanea.mjs   baja el contenido del panel antes de cada build
workers/panel/            el Worker: KV, validación, Cloudinary, historial
```

## URLs

Las rutas viejas de Wix redirigen (301) para no romper enlaces que ya
circulan en redes y en el PDF de la convocatoria (que cerró: ya no hay ni un
botón que lleve a él, pero el enlace sigue vivo en `festival.convocatoriaPDF`):

| Wix                      | Nueva         |
| ------------------------ | ------------- |
| `/agenda`                | `/programa`   |
| `/lugar`                 | `/sedes`      |
| `/event-list`            | `/registro`   |
| `/política-de-privacidad`| `/privacidad` |

## Publicación

`npm run build` baja el contenido del panel (`scripts/instantanea.mjs`) y deja
HTML estático en `dist/`. Si el panel no contesta, usa la copia comiteada y
sigue: el sitio no se cae por culpa del panel.

El sitio se publica en **GitHub Pages** desde `main`
([`.github/workflows/publicar.yml`](.github/workflows/publicar.yml)), servido en
`www.festivaldearteconceptual.com` — `public/CNAME` es lo que se lo dice a
GitHub, y con eso GitHub redirige solo el dominio pelado a `www`.

Por qué GitHub Pages y no Cloudflare Pages, que era el plan: el dominio se
registró en Wix el 26/07/2026 e ICANN no deja transferirlo hasta el 24/09, que
es cuando arranca el festival; Wix tampoco deja cambiar los nameservers, así que
el DNS se queda ahí. Y Cloudflare Pages no sirve el dominio raíz si el DNS no
vive en Cloudflare. GitHub Pages sí, con registros A. El precio es que las
redirecciones viejas siguen siendo `<meta refresh>` en vez de 301 de verdad;
[`public/_redirects`](public/_redirects) ya está escrito para el día que el
dominio salga de Wix y el sitio se mude.

## Panel de edición

El programa, las sedes, lxs artistas, el archivo y los patrocinadores **los
carga el festival desde `/admin`**, no se escriben aquí. El contenido vive en un
Worker de Cloudflare con KV, las fotos en Cloudinary, y el sitio se lo baja en
cada build a `src/data/contenido.json` —que se queda comiteado, y por eso el
sitio construye igual aunque el panel esté caído—.

El plan completo, con el porqué de cada pieza y lo que falta por dar de alta,
está en **[PANEL.md](PANEL.md)**. Los comandos, en
**[workers/panel/README.md](workers/panel/README.md)**.

Lo que NO pasa por el panel es el texto del sitio: el manifiesto, los rótulos,
los estados vacíos, el aviso de privacidad. Eso sigue en `src/data/site.ts` y es
correcto que un cambio ahí sea un commit.

## Lo que falta (depende del cliente)

- Contenido real del programa, artistas y archivo. Ya no depende de mí: entra
  por `/admin` en cuanto se dé de alta el Worker (ver [PANEL.md](PANEL.md)).
  Mientras el programa no sea el bueno, el sitio enseña un cartel de
  «Próximamente» en vez de la rejilla; publicarlo es desmarcar una casilla en
  el panel.
- Logos de las marcas que están sin él (Mezcania, MESH, Capicua, Suero,
  DC Producciones). Se suben desde el panel.
- Registro a eventos: hoy es una ficha en estado «Próximamente» con el botón
  desactivado. Cuando se decida el sistema (formulario propio, Eventbrite,
  etc.) se conecta ahí.
- Redes sociales del festival: el sitio de Wix no enlazaba ninguna.
