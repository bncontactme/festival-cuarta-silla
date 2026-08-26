# Investigación: librerías de transición minimalistas (2026)

Contexto: sitio de festival, cinco páginas, mayormente estático, con mucha
tipografía grande. Se busca movimiento editorial con el menor peso posible y
sin comprometer accesibilidad.

## Panorama

| Opción                        | Peso (gzip)  | Qué resuelve bien                          | Por qué sí / no aquí |
| ----------------------------- | ------------ | ------------------------------------------ | -------------------- |
| **View Transitions API**      | 0 KB         | transiciones entre páginas y de estado     | ✅ soporte en Chrome/Edge 111+, Firefox 133+, Safari 18+; degrada a corte seco |
| **CSS scroll-driven** (`animation-timeline`) | 0 KB | progreso, parallax, reveals ligados al scroll | ✅ para efectos continuos; detrás de `@supports` |
| **Lenis**                     | ~3 KB        | inercia de scroll sin romper `position: sticky` | ✅ estándar de facto; es la única dependencia |
| **Motion** (ex Framer Motion) | ~8 KB núcleo / ~30 KB completo | animación declarativa, gestos, layout | ❌ pensado para React; aquí no hay React |
| **GSAP + ScrollTrigger**      | ~25–50 KB    | timelines complejos, SVG, control fino     | ❌ gratis desde 2025 (Webflow), pero es 8× el presupuesto para lo que hace falta |
| **GSAP SplitText**            | incluido     | partir texto en líneas/caracteres          | ❌ sólo se necesita partir por líneas: ~20 líneas de código propio |
| **Anime.js v4**               | ~9 KB        | tweens y física, modular                   | ❌ no hace falta tweening imperativo |
| **Trig.js**                   | ~4 KB        | observador de scroll CSS-first             | ➖ interesante, pero `IntersectionObserver` nativo cubre el caso sin dependencia |

## Decisión

Tres capas, de la más barata a la más cara. Cada efecto se implementa en la
capa más baja que lo soporte.

**1. Nativo, 0 KB — View Transitions.** Navegación entre páginas: la saliente
se desvanece hacia arriba, la entrante se descubre con un `clip-path` de abajo
a arriba. El wordmark del header lleva `view-transition-name` y persiste entre
páginas. Donde no hay soporte, la navegación es instantánea: no se pierde nada.

**2. Nativo, 0 KB — CSS scroll-driven animations.** Barra de progreso de
lectura (`animation-timeline: scroll(root)`) y la deriva vertical de las
sillas de fondo (`animation-timeline: view()`). Todo dentro de
`@supports (animation-timeline: view())`; sin soporte, los elementos se
quedan quietos y el diseño no depende de ellos.

**3. JS, 7.1 KB gzip.** Sólo lo que no se puede hacer sin él:

- **Lenis** (~3 KB) — inercia de scroll. Es lo que separa un sitio de festival
  de una página corporativa. Se desactiva entero con `prefers-reduced-motion`
  y no se activa en táctil, donde el scroll nativo ya se siente bien y cuesta
  menos batería.
- **`IntersectionObserver`** — los reveals al entrar en pantalla. Nativo, se
  observa cada elemento una vez y se deja de observar. No necesita librería.
- **Partidor de líneas propio (~20 líneas)** — mide `offsetTop` palabra por
  palabra para agrupar por línea visual, y envuelve cada línea en un
  contenedor con `overflow: hidden` para deslizarla desde abajo. Es lo único
  que se usaba de SplitText, y respeta el salto de línea que el navegador ya
  decidió (importante: los titulares llevan `text-wrap: balance`).
- **Entrada de la portada móvil (~0.2 KB)** — el montaje es CSS entero (cinco
  `@keyframes` y unos retrasos), o sea capa 2. El JS sólo decide **si toca
  jugarla** —una vez por sesión, sólo en la portada— y le pone puerta de
  salida: al primer toque se va al final. Nadie debería tener que esperar a
  que una animación termine para poder usar un sitio.
- **Imán de las sillas del hero (~1 KB)** — la flotación en agua es CSS: cuatro
  ciclos de duración prima entre sí sobre `translate`, `rotate`, `scale` y
  `transform`, con las amplitudes en porcentajes del área de paseo. El JS hace
  las dos cosas que CSS no sabe: llevar la silla hacia el puntero con inercia,
  y medir cuánto puede llevarla sin que cruce la mitad de la pantalla —del
  área se descuenta lo que ya se come la órbita y lo que sobresale por el
  giro—. El bucle se corta al llegar al destino y no corre con el hero fuera
  de pantalla.

## Detalles que costaron

- **Tildes en mayúsculas.** En español, É/Ó/Í suben por encima de la altura de
  caja. Con `line-height` de póster (0.8) chocan con la línea de arriba. El
  mínimo seguro para display en español resultó ser **0.95**; sólo el titular
  del hero baja a 0.86, y está verificado a mano porque «FESTIVAL DE ARTE
  CONCEPTUAL» no lleva ninguna tilde.
- **Descendentes recortadas.** El `overflow: hidden` que hace de máscara en
  cada línea recorta las descendentes cuando el interlineado es menor que 1.
  Se compensa con `padding-bottom: 0.14em` y `margin-bottom: -0.14em`.
- **`clip-path` mata al `IntersectionObserver`.** Este costó caro. La primera
  versión escondía los titulares con `clip-path: inset(0 0 100% 0)` y los
  destapaba al entrar en pantalla. Nunca entraban: el observer mide el área
  **ya recortada**, así que un elemento recortado a cero reporta
  `intersectionRatio: 0` e `isIntersecting: false` aunque esté en mitad de la
  ventana. No entra → no recibe `.dentro` → sigue recortado. Punto muerto, y
  el hero se quedaba en blanco. La regla: **nunca escondas con `clip-path` un
  elemento que estás observando.** El recorte va siempre en un hijo (`.linea`),
  que deja intacta el área del padre observado.
- **Umbral de área.** `threshold: 0.15` sobre un elemento más alto que la
  ventana puede no cumplirse nunca. Se usa `threshold: 0` y se controla el
  disparo con `rootMargin`.
- **Contenido escondido si el JS falla.** Las reglas de reveal cuelgan de una
  clase `.js` que añade un script en línea en el `<head>`. Sin JS, sin la
  clase, y el contenido se ve directamente. Además, cada pieza de `motion.ts`
  se inicia dentro de su propio `try`, y si la de los reveals falla se quita
  la clase `.js` a mano: más vale un sitio sin animación que uno en blanco.
- **Especificidad con variantes `data-[]` de Tailwind.** Dos utilidades de
  `clip-path` con la misma especificidad dependen del orden en que Tailwind
  las genere. La cortina del menú móvil se escribió en CSS plano fuera de
  `@layer`, donde el resultado no depende de eso.
- **La entrada tiene que decidirse antes del primer pintado.** Si el flag de
  «toca jugarla» se pusiera desde `motion.ts`, el teléfono llegaría a pintar
  la portada terminada y la entrada arrancaría con un salto hacia atrás. Va
  en el script en línea del `<head>`, junto a la clase `.js`.
- **Un enlace invisible sigue siendo pulsable.** Durante la entrada, las
  puertas están a opacidad 0 pero vivas: un destino que no se ve y responde
  al dedo es una trampa. Llevan `pointer-events: none` hasta que aparecen, y
  el toque para saltar la entrada lo recoge el `<html>`, así que no se pierde.
- **Todo paso acaba en el estado natural del elemento.** La silla termina en
  su opacidad de marca de agua, las capas en su recorte completo, los textos
  a opacidad 1. Por eso el atributo `data-intro` se puede quitar en cualquier
  momento —al tocar, o solo al terminar— sin que nada dé un salto.
- **La silla arranca centrada en la pantalla, no en su hueco.** Mientras el
  resto no ha aparecido, el sitio definitivo de la silla queda 160px por
  encima del centro óptico y se nota mucho. Se compensa con un `translate`
  que la animación resuelve a cero: la silla sube a su sitio según llega el
  resto de la composición.
