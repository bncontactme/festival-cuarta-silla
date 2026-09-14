/**
 * Las descripciones: escribirlas, publicarlas e imprimir su cartela.
 *
 * El trato con el equipo es éste: el texto que iría impreso en la pared se
 * escribe aquí, el sitio le da una página, y lo que se imprime y se pega es una
 * etiqueta de un tercio de hoja con un QR. Treinta y dos actividades son once
 * hojas en vez del taco de trescientas que nadie iba a pagar ni a pegar ni a
 * corregir cuando cambiara algo.
 *
 * **Se llamaba «texto de sala» y ahora se llama «descripción»**, y eso cambió
 * en la pantalla y en ningún otro sitio. El archivo sigue siendo `sala.ts`, el
 * campo sigue siendo `sala`, el tipo sigue siendo `TextoDeSala` y la página
 * sigue siendo `/sala/<id>` — a propósito, y no por pereza:
 *
 *   · **la dirección es papel.** `/sala/<id>` es lo que va dentro de un QR que
 *     se imprime y se pega a una pared. Mover la ruta por un cambio de rótulo
 *     es dejar sin página todo lo que ya esté pegado. Es la misma regla que
 *     sostiene `acunar()` aquí abajo: la dirección se acuña una vez y no se
 *     mueve, ni cuando cambia el título ni cuando cambia el nombre de la cosa.
 *   · **el campo es un almacén.** `sala` es una clave dentro de lo que hay
 *     guardado en KV y lo que valida el Worker. Renombrarla es una migración de
 *     datos y un `CONTRATO` nuevo a cambio de nada — lo mismo que ya se decidió
 *     con `archivo`, que se rotula «Galería» desde hace meses. Ver PANEL.md.
 *
 * Lo único delicado de todo esto es la dirección, y está explicado donde toca:
 * ver `acunar()` aquí abajo y `TextoDeSala` en `src/data/tipos.ts`.
 */
import { el } from './dom';
import { qr } from './qr';

/** Hasta dónde llega el texto. Mismo número que en `validar.js`; si cambia en
 *  uno, cambia en el otro — aquí sólo sirve para avisar antes de mandarlo. */
export const TOPE_CUERPO = 6000;

/**
 * Las dos cosas que salen por la impresora, y cuántas caben en una hoja.
 *
 * **Cartela**: la etiqueta de un tercio de hoja que se pega al lado de la obra.
 * Tres por hoja, que es de lo que va todo esto.
 *
 * **QR**: la hoja entera con un solo código, para colgar en la entrada de una
 * sala o al lado de una pieza grande — lo que se escanea a dos metros y no a
 * dos palmos. Una por hoja, y eso no es un descuido: es un cartel, no una
 * etiqueta, y no hay forma de que dos quepan en una hoja siendo un cartel.
 *
 * Los números sólo sirven para decir cuántas hojas van a salir antes de
 * mandarlas. Quien de verdad lo decide es el CSS —el alto fijo de `.cartela`,
 * el salto de página de `.hoja-qr`—. Si cambia allí, cambia aquí.
 */
const POR_HOJA = { cartela: 3, qr: 1 } as const;
export type Formato = keyof typeof POR_HOJA;

/**
 * De un título a una dirección.
 *
 * **Se llama una sola vez en la vida de una descripción**, cuando se activa, y
 * a partir de ahí el `id` guardado manda: `abrirSala()` nunca lo vuelve a
 * calcular. Ésa es toda la garantía de que un QR impreso siga funcionando
 * cuando alguien corrija una tilde del título tres días después.
 *
 * La forma tiene que pasar el validador del Worker: minúsculas, números y
 * guiones. El corte en 40 deja sitio para el sufijo sin pasarse de los 48 que
 * acepta `validar.js`.
 */
export function acunar(titulo: string, usados: Set<string>): string {
  const base = String(titulo || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40).replace(/-+$/, '') || 'texto-de-sala';

  if (!usados.has(base)) return base;
  // Dos actividades con el mismo título pasa —«Recorrido: Marcha del Arte» está
  // el sábado y el domingo—, y cada una necesita su página.
  for (let n = 2; n < 100; n++) {
    const otro = `${base}-${n}`;
    if (!usados.has(otro)) return otro;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Las direcciones ya tomadas, para no repetir. El validador lo rechaza como
 *  error, así que más vale no llegar a mandarlo. */
export const idsUsados = (actividades: any[], menos?: any): Set<string> =>
  new Set(actividades.filter((a) => a !== menos && a.sala?.id).map((a) => a.sala.id));

/** La dirección entera, la que va dentro del QR. Sale de `Astro.site`, no de
 *  `location`: el panel se abre desde varios sitios —la vista previa de Pages,
 *  localhost— y lo que se imprime tiene que apuntar al dominio de verdad. */
export const rutaDe = (raiz: string, id: string) => raiz.replace(/\/$/, '') + '/sala/' + id;

/** Mete un QR dentro de un nodo. Si el texto no cupiera —no puede, pero—, se
 *  enseña la dirección en vez de un hueco: un cuadro vacío no dice qué pasó. */
function ponQR(nodo: HTMLElement, url: string) {
  try {
    nodo.innerHTML = qr(url);
  } catch {
    nodo.textContent = url.replace(/^https?:\/\//, '');
    nodo.classList.add('qr--falla');
  }
}

export function qrChico(url: string): HTMLElement {
  const caja = el('div', { class: 'qr qr--chico', title: url });
  ponQR(caja, url);
  return caja;
}

// ── El formulario ────────────────────────────────────────────────────────────

/** Cuántos se han abierto en esta sesión. Sólo sirve para que los `id` de un
 *  modal no choquen con los del anterior mientras se solapan. */
let abiertos = 0;

/**
 * Un `<dialog>` del panel, listo para llenar.
 *
 * Dos cosas, y las dos por lo mismo: `close` tira el nodo en el turno siguiente
 * del bucle de eventos, así que cerrar uno y abrir otro en el mismo gesto los
 * deja solapados un instante. Se barre lo que haya quedado antes de montar, y
 * el nodo nuevo se apunta a tirarse solo — se cierre como se cierre, por el
 * botón, por Escape o por donde sea.
 */
function nuevoDialogo(): HTMLDialogElement {
  document.querySelectorAll('dialog.dialogo').forEach((d) => d.remove());
  const dialogo = el('dialog', { class: 'dialogo' });
  dialogo.addEventListener('close', () => dialogo.remove());
  return dialogo;
}

type Ctx = {
  dias: () => string[];
  raiz: () => string;
  actividades: () => any[];
  cambiado: () => void;
  avisar: (mensaje: string, clase?: 'error' | 'ojo' | 'bien') => void;
};

/**
 * Abre la descripción de una actividad.
 *
 * Se monta el `<dialog>` al vuelo y se tira al cerrar. Es un formulario que se
 * abre de uno en uno: dejarlo vivo en el DOM sería guardar estado de algo que
 * no lo tiene.
 */
export function abrirSala(a: any, ctx: Ctx, alGuardar: () => void) {
  const nuevo = !a.sala;
  const id = a.sala?.id ?? acunar(a.titulo, idsUsados(ctx.actividades(), a));
  const publicado = Boolean(a.sala?.publicado);
  const url = rutaDe(ctx.raiz(), id);

  const dialogo = nuevoDialogo();

  // Y los `id` son únicos por si acaso: es una etiqueta que tiene que llevar a
  // SU campo, y eso no puede depender de que el barrido de arriba llegue antes.
  const marca = 'sala-' + (++abiertos);

  const cuerpo = el('textarea', {
    id: marca + '-cuerpo',
    value: a.sala?.cuerpo ?? '',
    placeholder: 'De qué va esta pieza, qué hay que mirar, qué no es evidente…',
    oninput: () => contar(),
  });
  const firma = el('input', {
    type: 'text', id: marca + '-firma', value: a.sala?.firma ?? '',
    placeholder: 'Texto: nombre de quien lo firma',
  });
  const cuenta = el('p', { class: 'cuentaletras' });

  function contar() {
    const n = cuerpo.value.length;
    cuenta.textContent = `${n.toLocaleString('es-MX')} / ${TOPE_CUERPO.toLocaleString('es-MX')} caracteres`;
    cuenta.classList.toggle('pasado', n > TOPE_CUERPO);
  }
  contar();

  /** Lo que había al abrir, para saber si hay algo que perder al cerrar. */
  const inicial = { cuerpo: a.sala?.cuerpo ?? '', firma: a.sala?.firma ?? '' };
  const hayCambios = () =>
    cuerpo.value.trim() !== inicial.cuerpo.trim() || firma.value.trim() !== inicial.firma.trim();

  /** Cerrar de verdad. El nodo se tira en el `close`, pase lo que pase. */
  const cerrar = () => dialogo.close();

  /**
   * Cerrar sin guardar, que es lo que hacen la ✕ y el Escape.
   *
   * Una descripción son diez minutos de escribir mirando la obra. Perderlo por
   * rozar Escape es de las cosas que no se perdonan a un panel, así que se
   * pregunta — pero sólo cuando hay algo escrito que no se ha guardado: un
   * «¿seguro?» que sale siempre se aprende a despachar sin leerlo.
   */
  const cerrarSinGuardar = () => {
    if (hayCambios() && !confirm(
      'Lo que escribiste en esta descripción no se ha guardado y se va a perder.\n\n¿Cerrar igual?',
    )) return;
    cerrar();
  };

  function guardar(publicar: boolean) {
    const texto = cuerpo.value.trim();
    if (publicar && !texto) {
      ctx.avisar('Una descripción publicada no puede estar vacía: el QR llevaría a una página en blanco.', 'error');
      cuerpo.focus();
      return;
    }
    if (texto.length > TOPE_CUERPO) {
      ctx.avisar(`La descripción tiene ${texto.length.toLocaleString('es-MX')} caracteres y el tope son ${TOPE_CUERPO.toLocaleString('es-MX')}.`, 'error');
      cuerpo.focus();
      return;
    }
    // El `id` que se guarda es el que ya había. Sólo se acuña cuando no hay.
    a.sala = { id, cuerpo: texto, ...(firma.value.trim() ? { firma: firma.value.trim() } : {}), ...(publicar ? { publicado: true } : {}) };
    cerrar();
    ctx.cambiado();
    alGuardar();
    if (publicar) {
      ctx.avisar(
        'Publicado en el panel. La página todavía no existe: aparece cuando el sitio se reconstruya, un minuto y medio después de guardar. No imprimas la cartela antes de eso.',
        'ojo',
      );
    }
  }

  function quitar() {
    if (publicado && !confirm(
      `Vas a quitar la descripción de «${a.titulo}».\n\n` +
      `Si su cartela ya está impresa y pegada, el QR de ese papel se queda sin página: ` +
      `${url}\n\n¿Seguro?`,
    )) return;
    delete a.sala;
    cerrar();
    ctx.cambiado();
    alGuardar();
  }

  // Un `<div>` y no un `<form method="dialog">`, que es lo que había.
  //
  // Aquí no hay nada que enviar —los tres botones son `type="button"` y el
  // guardado lo hace `guardar()` a mano— pero el navegador no lo sabía: un
  // formulario sin botón de envío y con EXACTAMENTE un campo de texto que
  // bloquea el envío implícito —«Firma»— se manda solo al pulsar Enter. Y
  // mandarlo, con `method="dialog"`, cerraba el diálogo. Es decir: escribías el
  // descripción, pasabas a la firma, dabas Enter por costumbre y se cerraba
  // todo sin guardar nada. Sin formulario no hay envío implícito que valga.
  dialogo.append(
    el('div', { class: 'modal' },
      el('div', { class: 'modal-cabeza' },
        el('div', {},
          el('p', { class: 'rotulo rojo' }, nuevo ? 'Nuevo descripción' : 'Descripción'),
          el('h3', {}, a.titulo || 'Sin título'),
          el('p', { class: 'modal-donde' },
            [a.sede, ctx.dias()[a.dia], a.inicio && a.fin ? `${a.inicio}–${a.fin}` : null]
              .filter(Boolean).join(' · ')),
        ),
        el('button', { type: 'button', class: 'modal-cerrar', 'aria-label': 'Cerrar', onclick: cerrarSinGuardar }, '✕'),
      ),

      el('div', { class: 'modal-cuerpo' },
        el('div', { class: 'campo' },
          el('label', { for: marca + '-cuerpo' }, 'La descripción'),
          el('span', { class: 'ayuda' },
            'Lo que estaría impreso en la pared. Deja una línea en blanco entre párrafos. ' +
            'Se lee de pie y en un teléfono: tres o cuatro párrafos cortos se leen enteros, dos mil palabras no.'),
          cuerpo,
          cuenta,
        ),
        el('div', { class: 'campo' },
          el('label', { for: marca + '-firma' }, 'Firma'),
          el('span', { class: 'ayuda' }, 'Quién lo escribe. Va al pie de la página, en pequeño. Puede quedarse vacío.'),
          firma,
        ),
        el('div', { class: 'campo' },
          el('label', {}, 'Dirección pública'),
          el('div', { class: 'direccion' },
            el('code', {}, url.replace(/^https?:\/\//, '')),
            el('span', { class: 'candado' }, a.sala ? '🔒 Ya acuñada' : '🔓 Se acuña al guardar'),
          ),
          el('span', { class: 'ayuda' },
            a.sala
              ? 'Es lo que va dentro del QR y ya no cambia, pase lo que pase con el título. Si esta cartela está impresa, esta dirección vive en una pared.'
              : 'Es lo que va a ir dentro del QR. Sale del título de ahora y se queda fija: cambiar el título después no la mueve.'),
        ),
      ),

      el('div', { class: 'modal-pie' },
        a.sala && el('button', { type: 'button', class: 'boton peligro', onclick: quitar }, 'Quitar la descripción'),
        el('span', { class: 'empuje' }),
        el('button', { type: 'button', class: 'boton', onclick: () => guardar(false) },
          publicado ? 'Pasar a borrador' : 'Guardar borrador'),
        el('button', { type: 'button', class: 'boton fuerte', onclick: () => guardar(true) },
          publicado ? 'Guardar cambios' : 'Publicar descripción'),
      ),
    ),
  );

  document.body.append(dialogo);
  dialogo.showModal();

  // Escape también es cerrar sin guardar, así que también pregunta.
  dialogo.addEventListener('cancel', (e) => {
    if (!hayCambios()) return;
    e.preventDefault();
    cerrarSinGuardar();
  });

  cuerpo.focus();
}

// ── Las cartelas ─────────────────────────────────────────────────────────────

/**
 * Elegir qué cartelas se imprimen antes de mandarlas.
 *
 * Antes el botón mandaba las treinta y nueve a la impresora de un tirón, y eso
 * sólo sirve el primer día. Después lo normal es lo contrario: corriges un
 * texto y quieres **esa** etiqueta, o vas a montar una sede y quieres las
 * cuatro de esa sede. Reimprimir el pliego entero para recortar una etiqueta es
 * justo el taco de papel del que veníamos huyendo.
 *
 * Empiezan todas marcadas, que es como estaba: quien quiera el pliego completo
 * le da a Imprimir y ya. Quien quiera tres, desmarca.
 */
export function elegirCartelas(actividades: any[], dias: string[], avisar: Ctx['avisar'], raiz: string) {
  const publicadas = actividades.filter((a) => a.sala?.publicado && a.sala.cuerpo);
  if (!publicadas.length) {
    avisar('Todavía no hay ninguna descripción publicada. Las cartelas salen de las publicadas: un QR impreso que lleva a un 404 es peor que no tener QR.', 'ojo');
    return;
  }

  const elegidas = new Set<any>(publicadas);
  const dialogo = nuevoDialogo();
  const marca = 'cartelas-' + (++abiertos);

  const contador = el('span', { class: 'rotulo' });
  const imprimir = el('button', { type: 'button', class: 'boton fuerte' });
  const todasNinguna = el('button', { type: 'button', class: 'boton' });

  /** Qué se va a imprimir. Empieza en cartela: es lo que se hace treinta veces
   *  y la hoja de QR es el caso suelto. */
  let formato: Formato = 'cartela';

  /* El mismo conmutador de Programa/Horarios —burbuja que se desliza, no dos
     botones que se encienden—, y por la misma razón: no son dos ajustes que se
     pueden dar los dos a la vez, es una cosa o la otra. Va en el pie y no en la
     cabecera porque lo que cambia está en el pie: cuántas hojas salen y qué
     dice el botón. */
  const conmutador = el('div', {
    class: 'conmutador', role: 'tablist', 'aria-label': 'Qué se imprime',
    style: '--celdas:2;--activa:0',
  }, el('span', { class: 'burbuja', 'aria-hidden': 'true' }));

  const FORMATOS = [
    ['cartela', 'Cartela', 'La etiqueta de un tercio de hoja, para pegar al lado de la obra'],
    ['qr', 'Sólo QR', 'Una hoja entera con el código, para colgar en la entrada de la sala'],
  ] as const;

  FORMATOS.forEach(([clave, texto, ayuda], i) => {
    conmutador.append(el('button', {
      type: 'button', role: 'tab', title: ayuda,
      'aria-selected': String(formato === clave),
      onclick: () => {
        formato = clave;
        conmutador.style.setProperty('--activa', String(i));
        conmutador.querySelectorAll('button').forEach((b, j) =>
          b.setAttribute('aria-selected', String(i === j)));
        estado();
      },
    }, texto));
  });

  function estado() {
    const n = elegidas.size;
    const cosa = formato === 'cartela'
      ? (n === 1 ? 'cartela' : 'cartelas')
      : (n === 1 ? 'hoja de QR' : 'hojas de QR');
    contador.textContent = `${n} de ${publicadas.length}`;
    imprimir.textContent = `Imprimir ${n} ${cosa}`;
    imprimir.toggleAttribute('disabled', n === 0);
    // El botón dice lo que va a hacer, no las dos cosas que podría hacer.
    todasNinguna.textContent = n === publicadas.length ? 'Ninguna' : 'Todas';
    // Cuántas hojas van a salir, que es lo que de verdad se pregunta quien está
    // delante de una impresora compartida — y con «Sólo QR» es justo lo que hay
    // que ver antes de darle: siete textos son siete hojas y no dos.
    const h = Math.ceil(n / POR_HOJA[formato]);
    hojas.textContent = n ? `${h} ${h === 1 ? 'hoja' : 'hojas'}` : '';
  }

  const hojas = el('span', { class: 'rotulo', style: 'opacity:.55' });

  todasNinguna.addEventListener('click', () => {
    if (elegidas.size === publicadas.length) elegidas.clear();
    else publicadas.forEach((a) => elegidas.add(a));
    lista.querySelectorAll('input[type=checkbox]').forEach((c: any) => {
      c.checked = elegidas.has(publicadas[Number(c.dataset.n)]);
    });
    estado();
  });

  imprimir.addEventListener('click', () => {
    // El orden del pliego es el del programa, no el de lo que marcaste: así dos
    // tandas impresas en momentos distintos se apilan igual.
    const salida = publicadas.filter((a) => elegidas.has(a));
    dialogo.close();
    if (formato === 'qr') imprimirQR(salida, avisar, raiz);
    else imprimirCartelas(salida, dias, avisar, raiz);
  });

  const lista = el('div', { class: 'elegir' });

  dias.forEach((nombre, d) => {
    const delDia = publicadas
      .filter((a) => Number(a.dia) === d)
      .sort((x, y) => String(x.inicio ?? '').localeCompare(String(y.inicio ?? '')));
    if (!delDia.length) return;

    lista.append(el('p', { class: 'elegir-dia' },
      el('span', {}, nombre.split(' ')[0]),
      el('span', { class: 'elegir-dia-nota' },
        `${delDia.length} ${delDia.length === 1 ? 'cartela' : 'cartelas'}`)));

    for (const a of delDia) {
      const n = publicadas.indexOf(a);
      const casilla = el('input', {
        type: 'checkbox', checked: true, 'data-n': String(n),
        id: `${marca}-${n}`,
        onchange: (e: any) => {
          if (e.target.checked) elegidas.add(a); else elegidas.delete(a);
          estado();
        },
      });
      lista.append(el('label', { class: 'elegir-fila', for: `${marca}-${n}` },
        casilla,
        el('span', { class: 'elegir-hora' }, a.inicio || '—'),
        el('span', { class: 'elegir-que' },
          el('strong', {}, a.titulo || 'Sin título'),
          el('span', { class: 'elegir-donde' },
            [a.sede, a.artista].filter(Boolean).join(' · ')),
        ),
        el('span', { class: 'ruta' }, '/sala/' + a.sala.id),
      ));
    }
  });

  dialogo.append(
    el('div', { class: 'modal' },
      el('div', { class: 'modal-cabeza' },
        el('div', {},
          el('p', { class: 'rotulo rojo' }, 'Imprimir'),
          el('h3', {}, 'Cuáles'),
          el('p', { class: 'modal-donde' },
            'La cartela es una etiqueta de un tercio de hoja, tres por hoja, y las marcas rojas de ' +
            'las esquinas son por dónde se corta. La hoja de QR es una hoja entera por descripción, para colgar.'),
        ),
        el('button', {
          type: 'button', class: 'modal-cerrar', 'aria-label': 'Cerrar',
          onclick: () => dialogo.close(),
        }, '✕'),
      ),
      el('div', { class: 'modal-cuerpo' }, lista),
      el('div', { class: 'modal-pie' },
        conmutador,
        todasNinguna,
        contador,
        hojas,
        el('span', { class: 'empuje' }),
        imprimir,
      ),
    ),
  );

  estado();
  document.body.append(dialogo);
  dialogo.showModal();
}

/**
 * Las que se pueden imprimir, que son sólo las publicadas.
 *
 * Un borrador no tiene página, así que su QR llevaría a un 404 — y eso no se
 * descubre en la pantalla, se descubre delante de la obra, con alguien mirando
 * el teléfono. Es la misma regla que sostiene `actividadesConSala` en el sitio.
 */
const paraImprimir = (actividades: any[]) =>
  actividades.filter((a) => a.sala?.publicado && a.sala.cuerpo);

const SIN_NADA =
  'Todavía no hay ninguna descripción publicada. Lo que se imprime sale de las publicadas: ' +
  'un QR impreso que lleva a un 404 es peor que no tener QR.';

/**
 * Mandar un pliego a la impresora y no dejarlo tirado en el DOM.
 *
 * Lo comparten las dos salidas —la cartela y la hoja de QR— porque el baile es
 * el mismo y las dos veces tiene truco: `@media print` en `panel.css` esconde
 * todo lo que no sea `#pliego`, así que mientras existe es literalmente lo
 * único que hay en la hoja.
 */
function mandarAImprimir(pliego: HTMLElement) {
  document.getElementById('pliego')?.remove();
  document.body.append(pliego);

  // El diálogo del navegador es síncrono, así que al volver ya se imprimió (o
  // se canceló, que da igual): en los dos casos el pliego sobra.
  const limpiar = () => pliego.remove();
  window.addEventListener('afterprint', limpiar, { once: true });
  window.print();
  // Respaldo: hay navegadores que no disparan `afterprint`. Un pliego olvidado
  // en el DOM no se ve —sólo existe al imprimir— pero volvería a salir pegado
  // al siguiente, duplicado.
  setTimeout(() => { if (document.getElementById('pliego') === pliego) limpiar(); }, 1000);
}

/**
 * El pliego de cartelas: una etiqueta por texto publicado, tres por hoja.
 */
export function imprimirCartelas(actividades: any[], dias: string[], avisar: Ctx['avisar'], raiz: string) {
  const publicadas = paraImprimir(actividades);
  if (!publicadas.length) return avisar(SIN_NADA, 'ojo');

  const pliego = el('div', { id: 'pliego', class: 'pliego' });

  for (const a of publicadas) {
    const dia = dias[a.dia] ?? `Día ${Number(a.dia) + 1}`;
    const caja = el('div', { class: 'qr' });
    ponQR(caja, rutaDe(raiz, a.sala.id));

    pliego.append(el('article', { class: 'cartela' },
      // Las marcas de las esquinas son por dónde se corta. Tres etiquetas por
      // hoja, todas del mismo alto, y unas tijeras: no hay troquel ni hay
      // presupuesto para uno. Como miden lo mismo, el taco se corta de una vez
      // en vez de hoja por hoja.
      el('i', { class: 'mc mc1' }), el('i', { class: 'mc mc2' }),
      el('i', { class: 'mc mc3' }), el('i', { class: 'mc mc4' }),
      // El cabecero va SUELTO y no dentro de `.cartela-texto`, que es la
      // columna estrecha. Dentro, «Descripción» se alineaba a la derecha de
      // esa columna: acababa a un dedo del QR y a cuatro centímetros del canto
      // del papel, en mitad de la nada. Un cabecero se alinea con el papel o no
      // es un cabecero — así que cruza las dos columnas y sus dos extremos caen
      // en los dos cantos.
      el('p', { class: 'cartela-cab' },
        el('span', {}, 'Cuarta Silla'), el('span', {}, 'Descripción')),
      // Dos columnas y no una pila: la etiqueta es apaisada —un tercio de hoja
      // de canto a canto— y en una pila el QR se iba a una esquina con un
      // palmo de blanco encima. El texto a la izquierda, el QR a la derecha a
      // media altura, y los dos centrados: así no hay hueco que explicar.
      el('div', { class: 'cartela-texto' },
        el('h6', {}, a.titulo || 'Sin título'),
        a.artista && el('p', { class: 'cartela-aut' }, a.artista),
        el('div', { class: 'cartela-filete' }),
        el('p', { class: 'cartela-meta' },
          el('b', {}, 'Dónde'), a.sede || '—',
          el('b', {}, 'Cuándo'), `${dia} · ${a.inicio}–${a.fin}`),
      ),
      el('div', { class: 'cartela-qr' }, caja, el('p', { class: 'cartela-lee' }, 'Escanea y lee')),
    ));
  }

  mandarAImprimir(pliego);
}

/**
 * La otra salida: una hoja entera por texto, con el QR grande y nada más.
 *
 * La cartela se pega al lado de la obra y se lee a dos palmos. Esto es otra
 * cosa: el cartel de la entrada de una sala, o el que va al lado de una pieza
 * que ocupa una pared — el que alguien escanea desde donde está, sin acercarse.
 * Por eso el código mide quince centímetros y por eso va uno por hoja: dos no
 * caben siendo un cartel, y hacerlos caber sería devolverlos al tamaño de la
 * cartela, que ya existe.
 *
 * **Lleva el título**, aunque sea una hoja entera para un cuadro negro. Treinta
 * y dos hojas sin una letra no se pueden repartir por cinco sedes: hay que
 * saber cuál es cuál sin escanearlas una por una.
 */
export function imprimirQR(actividades: any[], avisar: Ctx['avisar'], raiz: string) {
  const publicadas = paraImprimir(actividades);
  if (!publicadas.length) return avisar(SIN_NADA, 'ojo');

  const pliego = el('div', { id: 'pliego', class: 'pliego pliego--qr' });

  for (const a of publicadas) {
    const caja = el('div', { class: 'qr' });
    ponQR(caja, rutaDe(raiz, a.sala.id));

    pliego.append(el('article', { class: 'hoja-qr' },
      el('p', { class: 'cartela-cab' },
        el('span', {}, 'Cuarta Silla'), el('span', {}, 'Descripción')),
      el('div', { class: 'hoja-qr-medio' },
        el('h6', {}, a.titulo || 'Sin título'),
        caja,
        el('p', { class: 'cartela-lee' }, 'Escanea y lee'),
      ),
    ));
  }

  mandarAImprimir(pliego);
}
