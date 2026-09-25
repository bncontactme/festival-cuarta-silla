/**
 * El juego en la página: el lienzo, las teclas, el dedo y los letreros.
 *
 * La física vive en `mundo.ts` y va de a pasos fijos de 1/60 s; aquí se
 * decide cuántos pasos tocan en cada cuadro y se pinta lo que hay entre uno y
 * otro (interpolando), para que en una pantalla de 120 Hz se vea igual de
 * suave sin que el dino salte distinto.
 *
 * Todo lo que es letra —el marcador, «¡Sillazo!», el botón— es HTML encima
 * del lienzo y no texto pintado: sale con las tipografías del sitio, se lee
 * con lector de pantalla y el botón se puede pulsar con el teclado. El lienzo
 * sólo pinta el mundo.
 *
 * El bucle sólo corre mientras se juega. Esperando, en pausa o tras el choque,
 * la pantalla se pinta una vez y se queda quieta: una página de error no
 * puede estar gastando batería.
 */
import { Mundo, ALTO, SUELO, P, X_DINO, PERIODO_SUELO, PUNTOS_MAX } from './mundo';
import { DINO, ESTRELLA, type Sprite } from './sprites';

const PASO_MS = 1000 / 60;
/** Como mucho, estos pasos por cuadro: tras un tirón no se recupera a lo loco. */
const MAX_PASOS = 8;
/** Tras el choque, una tecla tarda esto en valer para empezar otra: si no, la
 *  misma pulsación que llegó tarde reinicia sin que se vea el choque. */
const ESPERA_REINICIO = 750;
const CLAVE_RECORD = 'cs-juego-record';

/** Lo que, con el foco puesto, ya sabe qué hacer con un espacio. */
const INTERACTIVO =
  'a[href], button, input, select, textarea, summary, [contenteditable]:not([contenteditable="false"]), [tabindex]:not([tabindex="-1"])';

type Estado = 'inicio' | 'corriendo' | 'pausa' | 'fin';

const cinco = (n: number) => String(n).padStart(5, '0');
const entre = (a: number, b: number, t: number) => a + (b - a) * t;

function leerRecord(): number {
  // Navegación privada o almacenamiento bloqueado: se juega igual, sin récord.
  try {
    return Math.min(PUNTOS_MAX, Math.max(0, Number(localStorage.getItem(CLAVE_RECORD)) || 0));
  } catch {
    return 0;
  }
}

function guardarRecord(n: number) {
  try {
    localStorage.setItem(CLAVE_RECORD, String(n));
  } catch {
    // Ídem.
  }
}

function montar(pantalla: HTMLElement) {
  const lienzo = pantalla.querySelector<HTMLCanvasElement>('[data-juego-lienzo]');
  const ctx = lienzo?.getContext('2d');
  if (!lienzo || !ctx) return;

  const q = <T extends HTMLElement>(sel: string) => pantalla.querySelector<T>(sel)!;
  const elPuntos = q('[data-juego-puntos]');
  const elRecord = q('[data-juego-record]');
  const elRecordCifra = q('[data-juego-record-cifra]');
  const elMarcador = q('[data-juego-marcador]');
  const elEstado = q('[data-juego-estado]');
  const botonOtra = q<HTMLButtonElement>('[data-juego-otra]');

  // Los colores los pone el CSS del componente: así el juego se viste como
  // la sección donde lo pongan sin tocar este archivo.
  const estilo = getComputedStyle(pantalla);
  const color = (nombre: string, porDefecto: string) => estilo.getPropertyValue(nombre).trim() || porDefecto;
  const colores = {
    campo: color('--juego-campo', '#ffffff'),
    tinta: color('--juego-tinta', '#1e1e1e'),
    silla: color('--juego-silla', '#ff0100'),
    estrella: color('--juego-estrella', '#fffd00'),
  };

  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mundo = new Mundo(600);
  // Con el dedo no hay forma de agacharse; si aparece un teclado, sí.
  mundo.sinAgacharse = window.matchMedia('(pointer: coarse)').matches;
  mundo.estrellasQuietas = reducido.matches;
  reducido.addEventListener?.('change', () => (mundo.estrellasQuietas = reducido.matches));

  let estado: Estado = 'inicio';
  let record = leerRecord();
  let mostrado = -1;
  let horaChoque = 0;
  let enVista = false;
  let parpadeando = false;
  let relojParpadeo = 0;

  // ── Pintar ──────────────────────────────────────────────────────────────
  // `k` son píxeles de pantalla por unidad del mundo. Los sprites se pasan a
  // láminas a esa escala, con cada píxel gordo redondeado a píxeles enteros:
  // así se ven nítidos a cualquier tamaño sin costuras entre celdas.
  let k = 1;
  const laminas = new Map<Sprite, HTMLCanvasElement>();

  function lamina(s: Sprite, tinta: string): HTMLCanvasElement {
    let c = laminas.get(s);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(s.ancho * P * k));
    c.height = Math.max(1, Math.round(s.alto * P * k));
    const g = c.getContext('2d')!;
    for (let j = 0; j < s.alto; j++) {
      const y0 = Math.round(j * P * k), y1 = Math.round((j + 1) * P * k);
      for (let i = 0; i < s.ancho; ) {
        const v = s.celdas[j * s.ancho + i];
        let fin = i + 1;
        while (fin < s.ancho && s.celdas[j * s.ancho + fin] === v) fin++;
        if (v) {
          const x0 = Math.round(i * P * k);
          g.fillStyle = v === 1 ? tinta : colores.campo;
          g.fillRect(x0, y0, Math.round(fin * P * k) - x0, y1 - y0);
        }
        i = fin;
      }
    }
    laminas.set(s, c);
    return c;
  }

  const px = (u: number) => Math.round(u * k);
  const sello = (s: Sprite, tinta: string, x: number, y: number) =>
    ctx.drawImage(lamina(s, tinta), px(x), px(y));

  function pintar(alfa: number) {
    ctx!.fillStyle = colores.campo;
    ctx!.fillRect(0, 0, lienzo!.width, lienzo!.height);

    for (const e of mundo.estrellas) sello(ESTRELLA, colores.estrella, entre(e.xAntes, e.x, alfa), e.y);

    ctx!.fillStyle = colores.tinta;
    ctx!.fillRect(0, px(SUELO), lienzo!.width, px(SUELO + P) - px(SUELO));
    const recorrido = entre(mundo.recorridoAntes, mundo.recorrido, alfa);
    for (const m of mundo.motas) {
      let x = (((m.x - recorrido) % PERIODO_SUELO) + PERIODO_SUELO) % PERIODO_SUELO;
      for (; x < mundo.ancho; x += PERIODO_SUELO) {
        ctx!.fillRect(px(x), px(m.y), px(x + m.ancho) - px(x), px(m.y + P) - px(m.y));
      }
    }

    for (const o of mundo.obstaculos) {
      for (const pieza of mundo.piezas(o, entre(o.xAntes, o.x, alfa))) {
        sello(pieza.sprite, colores.silla, pieza.x, pieza.y);
      }
    }

    const dino = parpadeando && estado === 'inicio' ? DINO.parpadeo : mundo.dino;
    sello(dino, colores.tinta, X_DINO, mundo.yDino(entre(mundo.hAntes, mundo.h, alfa), dino));
  }

  // ── Tamaño ──────────────────────────────────────────────────────────────
  // El alto del mundo es fijo (150) y el ancho, el que dé la pantalla: en una
  // ancha se ve venir más, en el teléfono menos (y por eso ahí va más lento).
  function dimensionar(ancho: number, alto: number) {
    if (ancho < 1 || alto < 1 || (ancho === lienzo!.width && alto === lienzo!.height)) return;
    lienzo!.width = ancho;
    lienzo!.height = alto;
    k = alto / ALTO;
    mundo.ancho = ancho / k;
    laminas.clear();
    // Esperando, se recoloca la escena para que la silla de muestra quede
    // dentro de la pantalla nueva.
    if (estado === 'inicio') mundo.reiniciar();
    pintar(1);
  }

  const medidor = new ResizeObserver(([entrada]) => {
    const dp = entrada.devicePixelContentBoxSize?.[0];
    const dpr = window.devicePixelRatio || 1;
    dimensionar(
      dp ? dp.inlineSize : Math.round(entrada.contentRect.width * dpr),
      dp ? dp.blockSize : Math.round(entrada.contentRect.height * dpr),
    );
  });
  try {
    // En píxeles de dispositivo, para no escalar el lienzo ni medio píxel;
    // Safari no lo sabe medir así y se queda con el redondeo.
    medidor.observe(lienzo, { box: 'device-pixel-content-box' });
  } catch {
    medidor.observe(lienzo);
  }

  // ── Bucle ───────────────────────────────────────────────────────────────
  let raf = 0;
  let antes = 0;
  let acumulado = 0;

  function cuadro(t: number) {
    raf = 0;
    if (estado !== 'corriendo') return;
    acumulado += Math.min(250, Math.max(0, t - antes));
    antes = t;
    let pasos = 0;
    while (acumulado >= PASO_MS && pasos < MAX_PASOS && mundo.estado === 'corriendo') {
      mundo.paso();
      acumulado -= PASO_MS;
      pasos++;
    }
    if (pasos === MAX_PASOS) acumulado = 0;
    if (mundo.estado === 'fin') return chocar();
    pintar(acumulado / PASO_MS);
    marcador();
    raf = requestAnimationFrame(cuadro);
  }

  function arrancar() {
    ponerEstado('corriendo');
    if (raf) return;
    antes = performance.now();
    acumulado = 0;
    raf = requestAnimationFrame(cuadro);
  }

  function parar() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  // ── Estados ─────────────────────────────────────────────────────────────
  function ponerEstado(nuevo: Estado) {
    estado = nuevo;
    pantalla.dataset.estado = nuevo;
    programarParpadeo();
  }

  function marcador() {
    const puntos = mundo.puntos;
    if (puntos !== mostrado) {
      // Cada cien, el marcador parpadea (el CSS lo apaga si se pide menos
      // movimiento). No al reiniciar, que también cruza un cero.
      if (mostrado >= 0 && Math.floor(puntos / 100) > Math.floor(mostrado / 100)) {
        elMarcador.classList.remove('juego-marcador--hito');
        void elMarcador.offsetWidth;
        elMarcador.classList.add('juego-marcador--hito');
      }
      mostrado = puntos;
      elPuntos.textContent = cinco(puntos);
    }
    elRecord.hidden = record === 0;
    elRecordCifra.textContent = cinco(record);
  }

  function chocar() {
    parar();
    horaChoque = performance.now();
    pintar(1);
    const puntos = mundo.puntos;
    const nuevoRecord = puntos > record;
    if (nuevoRecord) {
      record = puntos;
      guardarRecord(record);
    }
    marcador();
    ponerEstado('fin');
    elEstado.textContent = `¡Sillazo! ${puntos} puntos. ${nuevoRecord ? '¡Récord nuevo!' : `Récord: ${record}.`}`;
  }

  function otraVez() {
    mundo.reiniciar();
    mundo.empezar();
    mostrado = -1;
    elMarcador.classList.remove('juego-marcador--hito');
    elEstado.textContent = '';
    marcador();
    arrancar();
  }

  function pausar() {
    if (estado !== 'corriendo') return;
    parar();
    // Nada de lo que estaba pulsado sigue pulsado al volver.
    mundo.soltarSalto();
    mundo.agacharse(false);
    ponerEstado('pausa');
  }

  /** Espacio, ↑, un toque o un clic: lo que toque según el momento. */
  function adelante(repetida = false) {
    if (estado === 'inicio') {
      mundo.saltar();
      marcador();
      arrancar();
    } else if (estado === 'corriendo') {
      mundo.saltar();
    } else if (repetida) {
      // Una tecla que se quedó pulsada no reanuda ni reinicia: tiene que ser
      // una pulsación nueva.
    } else if (estado === 'pausa') {
      arrancar();
    } else if (performance.now() - horaChoque >= ESPERA_REINICIO) {
      otraVez();
    }
  }

  /** El dino, parpadeando de vez en cuando mientras espera. */
  function programarParpadeo() {
    clearTimeout(relojParpadeo);
    if (parpadeando) {
      parpadeando = false;
      if (estado === 'inicio') pintar(1);
    }
    if (estado !== 'inicio' || !enVista || reducido.matches) return;
    relojParpadeo = window.setTimeout(() => {
      parpadeando = true;
      pintar(1);
      relojParpadeo = window.setTimeout(programarParpadeo, 150);
    }, 2500 + Math.random() * 4000);
  }

  // ── El anillo de foco ───────────────────────────────────────────────────
  // El anillo es para quien llega tabulando: le dice dónde quedó el teclado.
  // Quien juega ya lo sabe, y el navegador lo encendería igual, porque el
  // juego toma el foco con una tecla y eso cuenta como foco de teclado. Así
  // que se apaga en cuanto se juega y vuelve con el tabulador (el CSS está en
  // `Juego.astro`).
  const jugando = () => (pantalla.dataset.jugando = '');

  // ── Teclado ─────────────────────────────────────────────────────────────
  // Con el foco en el juego, todo es suyo. Con el foco en ninguna parte y el
  // juego a la vista, el espacio también: es lo que hace el dino de Chrome en
  // la página de error, y aquí vive en la página de error. Con el foco en un
  // enlace, un botón o un campo, la tecla es de ellos.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') delete pantalla.dataset.jugando;
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    const salto = e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowUp';
    const abajo = e.key === 'ArrowDown';
    const intro = e.key === 'Enter';
    if (!salto && !abajo && !intro) return;

    const enfocado = e.target === pantalla;
    if (!enfocado) {
      // ↓ sin foco sólo es del juego en plena carrera: con el dino esperando,
      // es la tecla de bajar por la página.
      if (intro || !enVista || (abajo && estado !== 'corriendo')) return;
      if (e.target instanceof Element && (pantalla.contains(e.target) || e.target.closest(INTERACTIVO))) return;
    }
    // Intro sólo empieza, reanuda o reinicia; en carrera no salta.
    if (intro && estado === 'corriendo') return;

    e.preventDefault();
    jugando();
    if (abajo) {
      mundo.sinAgacharse = false;
      mundo.agacharse(true);
    } else {
      adelante(e.repeat);
    }
    // Que lo que venga después le llegue al juego directamente.
    if (!enfocado) pantalla.focus({ preventScroll: true });
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowUp') mundo.soltarSalto();
    else if (e.key === 'ArrowDown') mundo.agacharse(false);
  });

  // ── Dedo y ratón ────────────────────────────────────────────────────────
  pantalla.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.target instanceof Element && e.target.closest('button')) return;
    jugando();
    adelante();
    // Para enterarse de cuándo se levanta el dedo aunque se salga del juego:
    // de eso depende la altura del salto.
    try {
      pantalla.setPointerCapture(e.pointerId);
    } catch {
      // Sin captura, se suelta al salir: el salto queda corto y ya.
    }
  });
  pantalla.addEventListener('pointerup', () => mundo.soltarSalto());
  pantalla.addEventListener('pointercancel', () => mundo.soltarSalto());

  botonOtra.addEventListener('click', () => {
    otraVez();
    jugando();
    pantalla.focus({ preventScroll: true });
  });

  // ── Cuándo parar ────────────────────────────────────────────────────────
  // Otra pestaña, otra ventana o el juego fuera de la pantalla: pausa. Al
  // volver se sigue con una pulsación, no solo: que nadie se encuentre el
  // dino corriendo contra una silla que no vio venir.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pausar();
  });
  window.addEventListener('blur', pausar);
  new IntersectionObserver(
    ([entrada]) => {
      enVista = entrada.intersectionRatio >= 0.5;
      if (!enVista) pausar();
      programarParpadeo();
    },
    { threshold: [0, 0.5, 1] },
  ).observe(pantalla);

  marcador();
  ponerEstado('inicio');
}

for (const pantalla of document.querySelectorAll<HTMLElement>('[data-juego]')) montar(pantalla);
