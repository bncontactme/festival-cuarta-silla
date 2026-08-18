/**
 * Capa de movimiento del sitio. Presupuesto: ~5 KB gzip.
 *
 * - Lenis (3 KB) para inercia de scroll.
 * - IntersectionObserver para los reveals (soporte universal, sin librería).
 * - Un partidor de líneas propio: hace lo único que necesitamos de SplitText
 *   (envolver líneas para animarlas por separado) en ~20 líneas.
 *
 * Todo se apaga solo con `prefers-reduced-motion: reduce`.
 */
import Lenis from 'lenis';

const reducido = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** ¿Se está pintando el sitio móvil, que es otro sitio y no lleva scroll? */
const enMovil = () =>
  window.matchMedia('(width < 64rem)').matches &&
  document.body.dataset.movil === 'si';

let lenis: Lenis | null = null;

/**
 * Inercia de scroll. Se detiene si el usuario pide menos movimiento — y no
 * llega a arrancar en el sitio móvil, donde la página no tiene scroll
 * vertical que suavizar: lo hace cada pantalla por su cuenta.
 */
function iniciarScroll() {
  if (reducido() || enMovil() || lenis) return;

  lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    // En táctil el scroll nativo ya se siente bien y cuesta menos batería.
    syncTouch: false,
  });

  const raf = (t: number) => {
    lenis?.raf(t);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);

  // Anclajes internos pasan por Lenis para que el easing sea el mismo.
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement)?.closest?.('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href')!.slice(1);
    const destino = id && document.getElementById(id);
    if (!destino) return;
    e.preventDefault();
    lenis?.scrollTo(destino, { offset: -80 });
  });
}

/**
 * Parte un elemento en líneas visuales y envuelve cada una para poder
 * deslizarlas desde abajo. Mide posiciones reales, así que respeta el
 * salto de línea que el navegador ya decidió.
 */
function partirLineas(el: HTMLElement) {
  if (el.dataset.partido === 'si') return;

  const texto = el.textContent ?? '';
  if (!texto.trim()) return;

  // Cada palabra a su propio span para poder leer su posición vertical.
  el.textContent = '';
  const palabras = texto.trim().split(/\s+/).map((p) => {
    const s = document.createElement('span');
    s.textContent = p;
    s.style.display = 'inline-block';
    el.append(s, document.createTextNode(' '));
    return s;
  });

  // Agrupamos por offsetTop: mismo top === misma línea.
  const lineas: HTMLElement[][] = [];
  let topAnterior: number | null = null;
  for (const s of palabras) {
    if (topAnterior === null || Math.abs(s.offsetTop - topAnterior) > 2) {
      lineas.push([]);
      topAnterior = s.offsetTop;
    }
    lineas[lineas.length - 1].push(s);
  }

  el.textContent = '';
  lineas.forEach((palabrasDeLinea, i) => {
    const linea = document.createElement('span');
    linea.className = 'linea';
    const interior = document.createElement('span');
    interior.style.setProperty('--retraso', `${i * 90}ms`);
    interior.textContent = palabrasDeLinea.map((s) => s.textContent).join(' ');
    linea.append(interior);
    el.append(linea);
  });

  el.dataset.partido = 'si';
}

/** Reveals al entrar en pantalla. Se observa una vez y se olvida. */
function iniciarReveals() {
  const objetivos = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (!objetivos.length) return;

  if (reducido()) {
    objetivos.forEach((el) => el.classList.add('dentro'));
    return;
  }

  const io = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        entrada.target.classList.add('dentro');
        io.unobserve(entrada.target);
      }
    },
    // threshold 0: basta con que asome. Con un umbral de área, un elemento
    // más alto que la ventana podría no alcanzarlo nunca.
    { rootMargin: '0px 0px -12% 0px', threshold: 0 },
  );

  objetivos.forEach((el) => {
    const i = Number(el.dataset.retraso ?? 0);
    if (i) el.style.setProperty('--retraso', `${i}ms`);
    io.observe(el);
  });
}

/** Los titulares se parten en líneas antes de observarse. */
function iniciarTitulares() {
  document
    .querySelectorAll<HTMLElement>('[data-lineas]')
    .forEach(partirLineas);
}

/**
 * Cuenta regresiva al arranque del festival.
 *
 * Puede haber más de una en la página: en la portada conviven la del sitio de
 * escritorio (cuatro cajas) y la del móvil (una línea, sólo días). Sólo se ve
 * una, pero las dos están en el DOM, así que se pintan todas — con
 * `querySelector` a secas la escondida se quedaba con el reloj y la visible
 * con los guiones.
 */
function iniciarCuenta() {
  const raices = document.querySelectorAll<HTMLElement>('[data-cuenta]');
  if (!raices.length) return;

  const campos = ['dias', 'horas', 'minutos', 'segundos'] as const;

  const relojes = [...raices].map((raiz) => ({
    raiz,
    destino: new Date(raiz.dataset.cuenta!).getTime(),
    nodos: Object.fromEntries(
      campos.map((c) => [c, raiz.querySelector(`[data-campo="${c}"]`)]),
    ) as Record<(typeof campos)[number], HTMLElement | null>,
  }));

  const pintar = () => {
    const ahora = Date.now();
    for (const { raiz, destino, nodos } of relojes) {
      const falta = destino - ahora;
      if (falta <= 0) {
        raiz.dataset.estado = 'enCurso';
        campos.forEach((c) => nodos[c] && (nodos[c]!.textContent = '00'));
        continue;
      }
      const s = Math.floor(falta / 1000);
      const valores = {
        dias: Math.floor(s / 86400),
        horas: Math.floor((s % 86400) / 3600),
        minutos: Math.floor((s % 3600) / 60),
        segundos: s % 60,
      };
      for (const c of campos) {
        if (nodos[c]) {
          nodos[c]!.textContent = String(valores[c]).padStart(2, '0');
        }
      }
    }
  };

  pintar();
  setInterval(pintar, 1000);
}

/**
 * La entrada de la portada móvil.
 *
 * El montaje lo hace CSS entero; esto sólo le pone puerta de salida. Al
 * primer toque se va al final: nadie debería tener que esperar a que una
 * animación termine para poder usar un sitio. Y al terminar sola, el
 * atributo se retira para no dejar estado vivo — todos los pasos acaban
 * exactamente en el estado natural del elemento, así que quitarlo en
 * cualquier momento no da ningún salto.
 */
function iniciarEntrada() {
  const raiz = document.documentElement;
  if (raiz.dataset.intro !== 'si') return;

  const terminar = () => delete raiz.dataset.intro;

  raiz.addEventListener('pointerdown', terminar, { once: true, passive: true });
  raiz.addEventListener('keydown', terminar, { once: true });
  setTimeout(terminar, 2200);
}

/** Menú móvil. */
function iniciarMenu() {
  const boton = document.querySelector<HTMLButtonElement>('[data-menu-boton]');
  const panel = document.querySelector<HTMLElement>('[data-menu-panel]');
  if (!boton || !panel) return;

  const alternar = (abierto: boolean) => {
    boton.setAttribute('aria-expanded', String(abierto));
    panel.dataset.abierto = String(abierto);
    document.documentElement.style.overflow = abierto ? 'hidden' : '';
    abierto ? lenis?.stop() : lenis?.start();
  };

  boton.addEventListener('click', () =>
    alternar(boton.getAttribute('aria-expanded') !== 'true'),
  );
  panel.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) alternar(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') alternar(false);
  });
}

/**
 * Cada pieza va por separado: si una falla, las demás siguen. Y si falla
 * `iniciarReveals`, se destapa todo a mano — más vale un sitio sin animación
 * que un sitio en blanco.
 */
function arrancar() {
  const pasos = [
    iniciarEntrada,
    iniciarScroll,
    iniciarTitulares,
    iniciarReveals,
    iniciarCuenta,
    iniciarMenu,
  ];

  for (const paso of pasos) {
    try {
      paso();
    } catch (error) {
      console.error(`[motion] falló ${paso.name}:`, error);
      if (paso === iniciarReveals) destapar();
    }
  }
}

/** Último recurso: quitar los estados ocultos y dejar el contenido visible. */
function destapar() {
  document.documentElement.classList.remove('js');
}

arrancar();
