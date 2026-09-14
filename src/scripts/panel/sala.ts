/**
 * Los textos de sala: escribirlos, publicarlos e imprimir su cartela.
 *
 * El trato con el equipo es éste: el texto que iría impreso en la pared se
 * escribe aquí, el sitio le da una página, y lo que se imprime y se pega es una
 * etiqueta de un tercio de hoja con un QR. Treinta y dos actividades son once
 * hojas en vez del taco de trescientas que nadie iba a pagar ni a pegar ni a
 * corregir cuando cambiara algo.
 *
 * Lo único delicado de todo esto es la dirección, y está explicado donde toca:
 * ver `acunar()` aquí abajo y `TextoDeSala` en `src/data/tipos.ts`.
 */
import { el } from './dom';
import { qr } from './qr';

/** Hasta dónde llega el texto. Mismo número que en `validar.js`; si cambia en
 *  uno, cambia en el otro — aquí sólo sirve para avisar antes de mandarlo. */
export const TOPE_CUERPO = 6000;

/** Cuántas etiquetas caben en una hoja. Aquí sólo sirve para decir cuántas
 *  hojas van a salir antes de mandarlas; quien de verdad lo decide es el alto
 *  fijo de `.cartela` en `panel.css`. Si cambia allí, cambia aquí. */
const POR_HOJA = 3;

/**
 * De un título a una dirección.
 *
 * **Se llama una sola vez en la vida de un texto de sala**, cuando se activa, y
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
 * Abre el texto de sala de una actividad.
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
   * Un texto de sala son diez minutos de escribir mirando la obra. Perderlo por
   * rozar Escape es de las cosas que no se perdonan a un panel, así que se
   * pregunta — pero sólo cuando hay algo escrito que no se ha guardado: un
   * «¿seguro?» que sale siempre se aprende a despachar sin leerlo.
   */
  const cerrarSinGuardar = () => {
    if (hayCambios() && !confirm(
      'Lo que escribiste en este texto de sala no se ha guardado y se va a perder.\n\n¿Cerrar igual?',
    )) return;
    cerrar();
  };

  function guardar(publicar: boolean) {
    const texto = cuerpo.value.trim();
    if (publicar && !texto) {
      ctx.avisar('Un texto de sala publicado no puede estar vacío: el QR llevaría a una página en blanco.', 'error');
      cuerpo.focus();
      return;
    }
    if (texto.length > TOPE_CUERPO) {
      ctx.avisar(`El texto son ${texto.length.toLocaleString('es-MX')} caracteres y el tope son ${TOPE_CUERPO.toLocaleString('es-MX')}.`, 'error');
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
      `Vas a quitar el texto de sala de «${a.titulo}».\n\n` +
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
  // texto de sala, pasabas a la firma, dabas Enter por costumbre y se cerraba
  // todo sin guardar nada. Sin formulario no hay envío implícito que valga.
  dialogo.append(
    el('div', { class: 'modal' },
      el('div', { class: 'modal-cabeza' },
        el('div', {},
          el('p', { class: 'rotulo rojo' }, nuevo ? 'Nuevo texto de sala' : 'Texto de sala'),
          el('h3', {}, a.titulo || 'Sin título'),
          el('p', { class: 'modal-donde' },
            [a.sede, ctx.dias()[a.dia], a.inicio && a.fin ? `${a.inicio}–${a.fin}` : null]
              .filter(Boolean).join(' · ')),
        ),
        el('button', { type: 'button', class: 'modal-cerrar', 'aria-label': 'Cerrar', onclick: cerrarSinGuardar }, '✕'),
      ),

      el('div', { class: 'modal-cuerpo' },
        el('div', { class: 'campo' },
          el('label', { for: marca + '-cuerpo' }, 'El texto'),
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
        a.sala && el('button', { type: 'button', class: 'boton peligro', onclick: quitar }, 'Quitar el texto'),
        el('span', { class: 'empuje' }),
        el('button', { type: 'button', class: 'boton', onclick: () => guardar(false) },
          publicado ? 'Pasar a borrador' : 'Guardar borrador'),
        el('button', { type: 'button', class: 'boton fuerte', onclick: () => guardar(true) },
          publicado ? 'Guardar cambios' : 'Publicar texto'),
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
    avisar('Todavía no hay ningún texto de sala publicado. Las cartelas salen de los publicados: un QR impreso que lleva a un 404 es peor que no tener QR.', 'ojo');
    return;
  }

  const elegidas = new Set<any>(publicadas);
  const dialogo = nuevoDialogo();
  const marca = 'cartelas-' + (++abiertos);

  const contador = el('span', { class: 'rotulo' });
  const imprimir = el('button', { type: 'button', class: 'boton fuerte' });
  const todasNinguna = el('button', { type: 'button', class: 'boton' });

  function estado() {
    const n = elegidas.size;
    contador.textContent = `${n} de ${publicadas.length}`;
    imprimir.textContent = n === 1 ? 'Imprimir 1 cartela' : `Imprimir ${n} cartelas`;
    imprimir.toggleAttribute('disabled', n === 0);
    // El botón dice lo que va a hacer, no las dos cosas que podría hacer.
    todasNinguna.textContent = n === publicadas.length ? 'Ninguna' : 'Todas';
    // Cuántas hojas van a salir, que es lo que de verdad se pregunta quien está
    // delante de una impresora compartida. Tres por hoja —lo decide el alto
    // fijo de `.cartela` en `panel.css`; si cambia allí, cambia aquí—.
    hojas.textContent = n ? `${Math.ceil(n / POR_HOJA)} ${Math.ceil(n / POR_HOJA) === 1 ? 'hoja' : 'hojas'}` : '';
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
    imprimirCartelas(salida, dias, avisar, raiz);
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
          el('p', { class: 'rotulo rojo' }, 'Imprimir cartelas'),
          el('h3', {}, 'Cuáles'),
          el('p', { class: 'modal-donde' },
            'Una etiqueta por texto, tres por hoja. Las marcas rojas de las esquinas son por dónde se corta.'),
        ),
        el('button', {
          type: 'button', class: 'modal-cerrar', 'aria-label': 'Cerrar',
          onclick: () => dialogo.close(),
        }, '✕'),
      ),
      el('div', { class: 'modal-cuerpo' }, lista),
      el('div', { class: 'modal-pie' },
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
 * El pliego para imprimir: una etiqueta por texto publicado, tres por hoja.
 *
 * **Sólo las publicadas.** Un borrador no tiene página, así que su QR llevaría
 * a un 404 — y eso no se descubre en la pantalla, se descubre delante de la
 * obra, con alguien mirando el teléfono. Es la misma regla que sostiene
 * `actividadesConSala` en el sitio.
 *
 * El pliego se cuelga del `<body>` y se tira al terminar: `@media print` en
 * `panel.css` esconde todo lo demás, así que mientras existe es literalmente lo
 * único que hay en la hoja.
 */
export function imprimirCartelas(actividades: any[], dias: string[], avisar: Ctx['avisar'], raiz: string) {
  const publicadas = actividades.filter((a) => a.sala?.publicado && a.sala.cuerpo);
  if (!publicadas.length) {
    avisar('Todavía no hay ningún texto de sala publicado. Las cartelas salen de los publicados: un QR impreso que lleva a un 404 es peor que no tener QR.', 'ojo');
    return;
  }

  document.getElementById('pliego')?.remove();
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
      // Dos columnas y no una pila: la etiqueta es apaisada —un tercio de hoja
      // de canto a canto— y en una pila el QR se iba a una esquina con un
      // palmo de blanco encima. El texto a la izquierda, el QR a la derecha a
      // media altura, y los dos centrados: así no hay hueco que explicar.
      el('div', { class: 'cartela-texto' },
        el('p', { class: 'cartela-cab' },
          el('span', {}, 'Cuarta Silla'), el('span', {}, 'Texto de sala')),
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
