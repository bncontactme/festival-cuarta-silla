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
  setTimeout(terminar, 1700);
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
 * Las sillas del hero siguen al cursor.
 *
 * El vaivén de fondo es CSS y no se toca; esto suma la deriva hacia el
 * puntero, con retraso, como si al agua le costara transmitir el empujón, y
 * avisa a CSS cuando el cursor se acerca para que la órbita se ensanche.
 *
 * Ninguna silla sigue al cursor de entrada: hay que tocarla primero. Hasta
 * que el puntero le pasa por encima se queda en su vaivén, y a partir de ahí
 * lo acompaña. Mover algo que está al otro lado de la pantalla y que nadie
 * señaló se siente a fantasma; que reaccione a que la toquen, no.
 *
 * Y deja de acompañarlo en cuanto el cursor abandona su área —la mitad
 * derecha del hero para la silla grande, que es hasta donde llegan las
 * letras—. Sin ese límite bastaba rozarla una vez para que se quedara
 * pegada al puntero por todo el sitio: eso ya no es una silla flotando en
 * agua, es un cursor con silla.
 *
 * El alcance no es un número fijo: se mide del área de paseo (`[data-area]`)
 * lo que le sobra a la silla, se le descuenta lo que ya se come la órbita de
 * CSS y lo que sobresale por el giro, y lo que queda es hasta dónde puede
 * llevarla el cursor. Así la silla de la derecha nunca cruza la mitad de la
 * pantalla —el límite que marca el final del titular— en ninguna ventana, y
 * en pantallas anchas pasea mucho más que en una angosta.
 */
function iniciarIman() {
  if (reducido()) return;
  // En táctil no hay puntero al que seguir: el dedo llega ya tocando.
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const ORBITA = 0.1; // amplitud máxima del vaivén CSS, en fracción del área
  const NADO = 1.3; // cuánto la ensancha tener el cursor cerca
  const SOBRESALE = 28; // px que se salen de la caja por el giro y la escala
  const TOPE = 110; // por muy grande que sea la pantalla, tanto y no más
  const SUELTA = 26; // alcance de las sillas sin área que las limite
  const SUAVE = 0.05; // fracción del camino por cuadro ≈ 0.3 s de retraso
  const CERCA = 300; // radio en el que el cursor agita el agua
  const LEJOS = 380; // y radio al que se calma: la histéresis evita el parpadeo

  const capas = [...document.querySelectorAll<HTMLElement>('.sigue')]
    .map((capa) => ({
      capa,
      caja: capa.parentElement as HTMLElement,
      silla: capa.querySelector('img'),
      alcanceX: 0,
      alcanceY: 0,
      cx: 0,
      cy: 0,
      // Límites del área de paseo, cacheados: son la caja de la que hay que
      // salirse para que la silla suelte el cursor.
      areaI: 0,
      areaD: 0,
      areaA: 0,
      areaB: 0,
      destinoX: 0,
      destinoY: 0,
      x: 0,
      y: 0,
      cerca: false,
      despierta: false,
    }))
    .filter((c) => c.caja && c.silla);
  if (!capas.length) return;

  let vivo = false;
  let aLaVista = true;
  let medidasViejas = true;

  const medir = () => {
    if (!medidasViejas) return;
    for (const c of capas) {
      const r = c.caja.getBoundingClientRect();
      c.cx = r.x + r.width / 2;
      c.cy = r.y + r.height / 2;
      c.areaI = r.left;
      c.areaD = r.right;
      c.areaA = r.top;
      c.areaB = r.bottom;

      if (c.caja.dataset.area === undefined) {
        c.alcanceX = c.alcanceY = SUELTA;
        continue;
      }
      // offset* es la caja de maquetación: no la ensucian las animaciones.
      const libreX = (c.caja.offsetWidth - c.silla!.offsetWidth) / 2;
      const libreY = (c.caja.offsetHeight - c.silla!.offsetHeight) / 2;
      const orbitaX = ORBITA * c.caja.offsetWidth * NADO;
      const orbitaY = ORBITA * c.caja.offsetHeight * NADO;
      const cabe = (libre: number, orbita: number) =>
        Math.min(TOPE, Math.max(0, libre - orbita - SOBRESALE));
      c.alcanceX = cabe(libreX, orbitaX);
      c.alcanceY = cabe(libreY, orbitaY);
    }
    medidasViejas = false;
  };

  const cuadro = () => {
    let quieta = true;
    for (const c of capas) {
      c.x += (c.destinoX - c.x) * SUAVE;
      c.y += (c.destinoY - c.y) * SUAVE;
      c.capa.style.translate = `${c.x.toFixed(2)}px ${c.y.toFixed(2)}px`;
      // Un par de grados hacia el lado al que va: el arrastre del agua.
      c.capa.style.rotate = `${((c.x / (c.alcanceX || 1)) * 2.2).toFixed(3)}deg`;
      // Medio píxel ya no se ve: el bucle se corta en vez de perseguir
      // decimales para siempre.
      if (
        Math.abs(c.destinoX - c.x) > 0.05 ||
        Math.abs(c.destinoY - c.y) > 0.05
      ) {
        quieta = false;
      }
    }
    if (quieta) {
      vivo = false;
      return;
    }
    requestAnimationFrame(cuadro);
  };

  const despertar = () => {
    if (vivo || !aLaVista) return;
    vivo = true;
    requestAnimationFrame(cuadro);
  };

  window.addEventListener(
    'pointermove',
    (e) => {
      medir();
      // El destino sale de la posición del cursor en la ventana: aritmética
      // pura, sin leer geometría en cada movimiento.
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      for (const c of capas) {
        // Arranca dormida: no sigue al cursor hasta que el cursor le pasa
        // por encima. Como va por debajo del texto no puede escuchar un
        // `pointerenter` propio, así que se le pregunta a la geometría. Sólo
        // mientras duerme se mide la silla, que es lo caro: está animada y su
        // caja cambia en cada cuadro. Para soltarla basta el área, que no se
        // mueve y ya viene medida.
        if (!c.despierta) {
          const r = c.silla!.getBoundingClientRect();
          c.despierta =
            e.clientX >= r.left &&
            e.clientX <= r.right &&
            e.clientY >= r.top &&
            e.clientY <= r.bottom;
        } else if (
          e.clientX < c.areaI ||
          e.clientX > c.areaD ||
          e.clientY < c.areaA ||
          e.clientY > c.areaB
        ) {
          c.despierta = false;
        }

        if (c.despierta) {
          c.destinoX = nx * c.alcanceX;
          c.destinoY = ny * c.alcanceY;
        } else {
          // Suelta el cursor y vuelve al centro de su órbita.
          c.destinoX = c.destinoY = 0;
        }

        const d = Math.hypot(e.clientX - (c.cx + c.x), e.clientY - (c.cy + c.y));
        const cerca = d < (c.cerca ? LEJOS : CERCA);
        if (cerca !== c.cerca) {
          c.cerca = cerca;
          c.caja.style.setProperty('--nado', cerca ? String(NADO) : '1');
        }
      }
      despertar();
    },
    { passive: true },
  );

  // Al salir el puntero de la ventana, todo vuelve al centro de su órbita.
  document.addEventListener('pointerleave', () => {
    for (const c of capas) {
      c.destinoX = c.destinoY = 0;
      if (c.cerca) {
        c.cerca = false;
        c.caja.style.setProperty('--nado', '1');
      }
    }
    despertar();
  });

  const remedir = () => {
    medidasViejas = true;
  };
  window.addEventListener('resize', remedir, { passive: true });
  window.addEventListener('scroll', remedir, { passive: true });

  const io = new IntersectionObserver((entradas) => {
    aLaVista = entradas.some((entrada) => entrada.isIntersecting);
    if (aLaVista) despertar();
  });
  capas.forEach((c) => io.observe(c.caja));
}

/**
 * Modales.
 *
 * El `<dialog>` nativo ya resuelve lo difícil —capa superior, foco atrapado,
 * Esc, y el resto de la página inerte—, así que esto sólo agrega las dos
 * cosas que le faltan: la animación de cierre, que sin ayuda no se ve porque
 * el elemento desaparece en el mismo cuadro, y frenar a Lenis, que si no
 * sigue moviendo la página por detrás.
 */
function iniciarModales() {
  const modales = document.querySelectorAll<HTMLDialogElement>('[data-modal]');
  if (!modales.length) return;

  for (const modal of modales) {
    const nombre = modal.dataset.modal;

    const cerrar = () => {
      if (modal.dataset.cerrando) return;
      if (reducido()) {
        modal.close();
        return;
      }
      // Se marca, se deja correr la salida y recién ahí se cierra de verdad.
      // El temporizador es la red: si la animación no llega a correr —una
      // pestaña en segundo plano, un motor que la ignore— el modal se cerraría
      // igual. Nunca se queda abierto esperando un evento que no viene.
      modal.dataset.cerrando = 'si';
      const rematar = () => {
        clearTimeout(red);
        modal.removeEventListener('animationend', rematar);
        delete modal.dataset.cerrando;
        modal.close();
      };
      const red = setTimeout(rematar, 500);
      modal.addEventListener('animationend', rematar);
    };

    document
      .querySelectorAll<HTMLElement>(`[data-abre="${nombre}"]`)
      .forEach((boton) =>
        boton.addEventListener('click', () => {
          modal.showModal();
          lenis?.stop();
        }),
      );

    modal.querySelectorAll('[data-cierra]').forEach((boton) =>
      boton.addEventListener('click', cerrar),
    );

    // Clic en el fondo: el `<dialog>` recibe el clic sólo si cayó fuera de la
    // caja, porque la caja cubre todo el contenido.
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cerrar();
    });

    // Esc cierra solo y sin animación; se intercepta para que también salga
    // por la puerta.
    modal.addEventListener('cancel', (e) => {
      e.preventDefault();
      cerrar();
    });

    modal.addEventListener('close', () => lenis?.start());
  }
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
    iniciarModales,
    iniciarIman,
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
