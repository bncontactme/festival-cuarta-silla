/**
 * La silla secreta de la portada.
 *
 * Diez toques a la silla del hero —cualquiera de las dos que flotan junto al
 * titular en escritorio, o la que está detrás del rótulo en el teléfono— y el
 * sitio se abre en el juego. Es un huevo de pascua: nada lo anuncia, y quien
 * no lo busca no puede tropezar con él ni notar que existe.
 *
 * ── Cómo se cuenta ─────────────────────────────────────────────────────
 * Las sillas van por debajo del texto y no reciben el puntero (ni deben: el
 * imán las mueve desde la ventana). Así que no se escucha a la silla sino a
 * la página: un toque cuenta si cae dentro de la silla y no en un enlace ni
 * en un botón. El rótulo que la tapa en el teléfono no se come los toques.
 *
 * ── Qué se ve ──────────────────────────────────────────────────────────
 * Cada toque la despierta un poco: de marca de agua a rojo entero en diez
 * pasos, con un brinco que crece con la cuenta y, a partir del séptimo, un
 * temblor. Si se deja de tocar un segundo y medio, se vuelve a dormir y la
 * cuenta vuelve a cero: diez toques sueltos a lo largo de una visita no
 * abren nada.
 *
 * ── El décimo ──────────────────────────────────────────────────────────
 * La silla, ya roja, toma impulso y salta hacia quien mira, y el sitio se va
 * a `/juego` dejando dicho dónde estaba: allí la página se abre en un círculo
 * que crece desde ese punto mientras la silla pasa de largo (`juego.astro`).
 * Al quinto toque ya se pidió la página por adelantado, para que el décimo
 * no espere a la red. Con menos movimiento pedido, o donde el navegador no
 * sabe hacer transiciones entre páginas, la silla se llena igual y se llega
 * al juego sin más.
 */
import { conBase } from '../lib/base';

const TOQUES = 10;
/** Tanto tiempo sin tocar y la silla se vuelve a dormir. */
const OLVIDO = 1500;
/** A partir de este toque se pide `/juego` por adelantado. */
const PRECARGA = 5;
const DESTINO = conBase('/juego');
const INTERACTIVO = 'a[href], button, input, select, textarea, summary, label, [role="button"]';

const reducido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function iniciar(sillas: HTMLImageElement[]) {
  let cuenta = 0;
  let reloj = 0;
  let saliendo = false;
  let precargada = false;
  const tocadas = new Set<HTMLImageElement>();
  /** El salto del décimo toque, que se queda en su último cuadro. */
  let despegue: Animation | null = null;

  /** Lo que se aclara: en escritorio la opacidad de marca de agua la lleva la
   *  caja de paseo (`.flotador`), no la silla; en el teléfono, la silla. */
  const velo = (s: HTMLElement) => s.closest<HTMLElement>('.flotador') ?? s;

  /** La opacidad de reposo de cada silla, leída del CSS antes de tocarla. */
  const reposos = new WeakMap<HTMLElement, number>();
  const reposo = (v: HTMLElement) => {
    let o = reposos.get(v);
    if (o === undefined) {
      o = Number(getComputedStyle(v).opacity) || 0.2;
      reposos.set(v, o);
    }
    return o;
  };

  function dormir() {
    cuenta = 0;
    for (const s of tocadas) {
      const v = velo(s);
      v.style.transition = 'opacity 0.6s var(--ease-salida)';
      v.style.opacity = '';
    }
    tocadas.clear();
  }

  function dentro(s: HTMLElement, x: number, y: number) {
    const r = s.getBoundingClientRect();
    // La del otro sitio —móvil o escritorio— está escondida y no mide nada.
    if (!r.width || !r.height) return false;
    // Un poco hacia dentro: el SVG trae aire alrededor de la silla.
    const mx = r.width * 0.08;
    const my = r.height * 0.04;
    return x >= r.left + mx && x <= r.right - mx && y >= r.top + my && y <= r.bottom - my;
  }

  function brinco(silla: HTMLElement, n: number) {
    // Más alto cuanto más despierta: de un 6,5 % a un 20 %.
    const f = 0.05 + 0.015 * n;
    silla.animate(
      [
        { scale: '1' },
        { scale: String(1 + f), offset: 0.35 },
        { scale: String(1 - f * 0.35), offset: 0.7 },
        { scale: '1' },
      ],
      { duration: 280, easing: 'ease-out' },
    );
    // Del séptimo en adelante, además tiembla. Sumado al giro que ya trae.
    if (n >= 7) {
      const g = 3 + (n - 7) * 2;
      silla.animate(
        [
          { rotate: '0deg' },
          { rotate: `${-g}deg` },
          { rotate: `${g}deg` },
          { rotate: `${-g / 2}deg` },
          { rotate: '0deg' },
        ],
        { duration: 280, composite: 'add' },
      );
    }
  }

  function precargar() {
    precargada = true;
    const l = document.createElement('link');
    l.rel = 'prefetch';
    l.href = DESTINO;
    document.head.append(l);
  }

  function saltar(silla: HTMLImageElement) {
    saliendo = true;
    clearTimeout(reloj);
    const r = silla.getBoundingClientRect();
    try {
      sessionStorage.setItem(
        'cs-portal',
        JSON.stringify({
          x: (r.left + r.width / 2) / innerWidth,
          y: (r.top + r.height / 2) / innerHeight,
          t: Date.now(),
        }),
      );
    } catch {
      // Sin almacenamiento se llega igual, sin portal.
    }

    const ir = () => location.assign(DESTINO);
    if (reducido()) return ir();

    // Toma impulso y salta hacia quien mira. Lleva nombre de transición: al
    // cambiar de página el navegador la saca aparte, y allí pasa de largo
    // mientras se abre el círculo.
    silla.style.viewTransitionName = 'silla-portal';
    despegue = silla.animate(
      [{ scale: '1' }, { scale: '0.9', offset: 0.3 }, { scale: '1.3' }],
      { duration: 320, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' },
    );
    despegue.finished.then(ir, ir);
  }

  function tocar(silla: HTMLImageElement) {
    cuenta++;
    tocadas.add(silla);
    clearTimeout(reloj);
    reloj = window.setTimeout(dormir, OLVIDO);

    const v = velo(silla);
    const base = reposo(v);
    v.style.transition = 'opacity 0.18s var(--ease-salida)';
    v.style.opacity = String(base + (1 - base) * Math.min(1, cuenta / TOQUES));

    if (!reducido()) brinco(silla, cuenta);
    if (cuenta >= PRECARGA && !precargada) precargar();
    if (cuenta >= TOQUES) saltar(silla);
  }

  document.addEventListener('pointerdown', (e) => {
    if (saliendo || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    // En el teléfono, el primer toque salta la entrada de la portada; y con
    // el cargador puesto, la portada ni se ve.
    const raiz = document.documentElement.dataset;
    if (raiz.intro || raiz.carga) return;
    if (e.target instanceof Element && e.target.closest(INTERACTIVO)) return;
    const silla = sillas.find((s) => dentro(s, e.clientX, e.clientY));
    if (!silla) return;
    // Que diez clics seguidos no vayan seleccionando el titular.
    e.preventDefault();
    tocar(silla);
  });

  // Volver atrás desde el juego trae esta página tal como se fue —la silla
  // roja, agrandada y con nombre de transición—. Se la devuelve a su sitio.
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    saliendo = false;
    despegue?.cancel();
    despegue = null;
    for (const s of sillas) s.style.viewTransitionName = '';
    // De golpe y no con el fundido de `dormir()`: al volver, la silla ya
    // tiene que estar dormida, no dormirse delante de quien vuelve.
    for (const s of tocadas) {
      const v = velo(s);
      v.style.transition = '';
      v.style.opacity = '';
    }
    tocadas.clear();
    cuenta = 0;
  });
}

const sillas = [...document.querySelectorAll<HTMLImageElement>('[data-silla-secreta]')];
if (sillas.length) iniciar(sillas);
