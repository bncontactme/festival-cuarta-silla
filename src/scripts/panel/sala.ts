/**
 * Los textos de sala: escribirlos, publicarlos e imprimir su cartela.
 *
 * El trato con el equipo es éste: el texto que iría impreso en la pared se
 * escribe aquí, el sitio le da una página, y lo que se imprime y se pega es una
 * etiqueta del tamaño de un naipe con un QR. Treinta y dos actividades son ocho
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

  const dialogo = el('dialog', { class: 'dialogo' });

  const cuerpo = el('textarea', {
    id: 'sala-cuerpo',
    value: a.sala?.cuerpo ?? '',
    placeholder: 'De qué va esta pieza, qué hay que mirar, qué no es evidente…',
    oninput: () => contar(),
  });
  const firma = el('input', {
    type: 'text', id: 'sala-firma', value: a.sala?.firma ?? '',
    placeholder: 'Texto: nombre de quien lo firma',
  });
  const cuenta = el('p', { class: 'cuentaletras' });

  function contar() {
    const n = cuerpo.value.length;
    cuenta.textContent = `${n.toLocaleString('es-MX')} / ${TOPE_CUERPO.toLocaleString('es-MX')} caracteres`;
    cuenta.classList.toggle('pasado', n > TOPE_CUERPO);
  }
  contar();

  const cerrar = () => { dialogo.close(); dialogo.remove(); };

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

  dialogo.append(
    el('form', { method: 'dialog', class: 'modal' },
      el('div', { class: 'modal-cabeza' },
        el('div', {},
          el('p', { class: 'rotulo rojo' }, nuevo ? 'Nuevo texto de sala' : 'Texto de sala'),
          el('h3', {}, a.titulo || 'Sin título'),
          el('p', { class: 'modal-donde' },
            [a.sede, ctx.dias()[a.dia], a.inicio && a.fin ? `${a.inicio}–${a.fin}` : null]
              .filter(Boolean).join(' · ')),
        ),
        el('button', { type: 'button', class: 'modal-cerrar', 'aria-label': 'Cerrar', onclick: cerrar }, '✕'),
      ),

      el('div', { class: 'modal-cuerpo' },
        el('div', { class: 'campo' },
          el('label', { for: 'sala-cuerpo' }, 'El texto'),
          el('span', { class: 'ayuda' },
            'Lo que estaría impreso en la pared. Deja una línea en blanco entre párrafos. ' +
            'Se lee de pie y en un teléfono: tres o cuatro párrafos cortos se leen enteros, dos mil palabras no.'),
          cuerpo,
          cuenta,
        ),
        el('div', { class: 'campo' },
          el('label', { for: 'sala-firma' }, 'Firma'),
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
  dialogo.addEventListener('cancel', () => dialogo.remove());
  cuerpo.focus();
}

// ── Las cartelas ─────────────────────────────────────────────────────────────

/**
 * El pliego para imprimir: una etiqueta por texto publicado, cuatro por hoja.
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
      // Las marcas de las esquinas son por dónde se corta. Cuatro etiquetas por
      // hoja y unas tijeras: no hay troquel ni hay presupuesto para uno.
      el('i', { class: 'mc mc1' }), el('i', { class: 'mc mc2' }),
      el('i', { class: 'mc mc3' }), el('i', { class: 'mc mc4' }),
      el('p', { class: 'cartela-cab' },
        el('span', {}, 'Cuarta Silla'), el('span', {}, 'Texto de sala')),
      el('h6', {}, a.titulo || 'Sin título'),
      a.artista && el('p', { class: 'cartela-aut' }, a.artista),
      el('div', { class: 'cartela-filete' }),
      el('div', { class: 'cartela-pie' },
        el('p', { class: 'cartela-meta' },
          el('b', {}, 'Dónde'), a.sede || '—',
          el('b', {}, 'Cuándo'), `${dia} · ${a.inicio}–${a.fin}`),
        el('div', {}, caja, el('p', { class: 'cartela-lee' }, 'Escanea y lee')),
      ),
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
