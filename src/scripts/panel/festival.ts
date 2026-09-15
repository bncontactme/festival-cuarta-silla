/**
 * Los dos textos que son del festival y no de ninguna actividad.
 *
 * Una pestaña, un conmutador y dos formularios:
 *
 *   · **Texto de sala** — el que iría en la pared de la entrada. Tiene página
 *     propia (`/sala/festival`) y de ahí sale la hoja de QR que se cuelga en la
 *     puerta. Es la cartela del festival entero, sin la cartela.
 *   · **Manifiesto** — el de la banda roja de la portada y el que se abre al
 *     pulsar «Leer el manifiesto». Existía desde el primer día, pero escrito a
 *     mano en `src/data/site.ts`: para cambiarle una coma había que tocar
 *     código y esperar un despliegue.
 *
 * **Los dos se leen juntos en `/sala/festival`**, que es adonde lleva el QR:
 * arriba el texto de sala —quien acaba de escanear está de pie en la puerta— y
 * debajo el manifiesto entero, para quien siga leyendo. La portada, en cambio,
 * sigue pintando el manifiesto que está escrito en `site.ts`: ahí el título va
 * a `9vw` sobre una estrella, y eso es una decisión de maqueta, no de dato. Está
 * explicado en `manifiestoDeSala`, en `site.ts`, con la línea que lo cambiaría.
 *
 * **Por qué los dos en una pestaña y no en dos.** Son el mismo dueño —el
 * festival— y se escriben en la misma sentada. Dos pestañas para dos textos
 * habrían sido dos pestañas que casi siempre están vacías, y el conmutador ya
 * existe en el panel para justo esto: una cosa o la otra, no dos ajustes que se
 * pueden dar a la vez. Es el mismo de Programa/Horarios y el de elegir cartelas,
 * y tiene que reconocerse como la misma cosa.
 *
 * **Por qué no son una lista.** Uno de cada. Una lista de textos de sala del
 * festival es una lista de la que sólo puede haber una fila buena, y el día que
 * haya dos nadie sabrá cuál se está leyendo en la puerta.
 *
 * Lo que aquí NO hay, y es a propósito:
 *
 *   · **Ningún `id` que acuñar.** La dirección es fija (`SALA_FESTIVAL`): el
 *     festival es uno y su página existe antes de que nadie escriba el título.
 *     Ver `src/data/tipos.ts`.
 *   · **Ningún borrador del manifiesto.** No tiene página que aparezca o
 *     desaparezca — es una sección de la portada. Lo que se puede hacer con él
 *     es escribirlo mejor, no apagarlo.
 */
import { el, vaciar } from './dom';
import { qrChico, rutaDe, imprimirHojasQR, TOPE_CUERPO } from './sala';

/** El trozo final de `/sala/<id>` del texto del festival. Mismo texto que
 *  `SALA_FESTIVAL` en `src/data/tipos.ts` y que la constante del validador; si
 *  cambia en uno, cambia en los tres — y sólo se puede cambiar mientras no haya
 *  nada impreso. */
const SALA_FESTIVAL = 'festival';

export type Ctx = {
  /** La raíz del sitio, absoluta. Sale de `Astro.site`, no de `location`. */
  raiz: () => string;
  cambiado: () => void;
  avisar: (mensaje: string, clase?: 'error' | 'ojo' | 'bien') => void;
  /** El manifiesto que hoy está publicado, tal cual sale de `site.ts`. Viaja
   *  desde la página del panel, como los días: el panel no puede importar el
   *  sitio. Sirve para no empezar de cero — ver `traerElPublicado()`. */
  manifiestoDelSitio: () => { titulo: string; cuerpo: string; cierre: string };
};

/**
 * Cuál de los dos se está mirando.
 *
 * Vive fuera de `pintarFestival()` —como `vistaPrograma` en `panel.ts`— para
 * que cambiar de pestaña y volver no te devuelva al otro texto con lo que
 * estabas leyendo a medias.
 */
let vista: 'sala' | 'manifiesto' = 'sala';

const palabras = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const parrafos = (t: string) => t.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

export function pintarFestival(estado: any, ctx: Ctx): HTMLElement {
  const f = (estado.festival ??= {});

  const seccion = el('section');
  const cuerpo = el('div');

  const pie = el('span', { class: 'mandos-nota' });

  /* El conmutador de siempre: las dos celdas miden lo mismo, así que la burbuja
     no se mide — se le dice en cuál está y CSS la desliza. */
  const conmutador = el('div', {
    class: 'conmutador', role: 'tablist', 'aria-label': 'Cuál de los dos textos',
    style: `--celdas:2;--activa:${vista === 'sala' ? 0 : 1}`,
  }, el('span', { class: 'burbuja', 'aria-hidden': 'true' }));

  const ROTULOS = [
    ['sala', 'Texto de sala', 'El de la pared de la entrada, con su página y su QR'],
    ['manifiesto', 'Manifiesto', 'El de la banda roja de la portada'],
  ] as const;

  const NOTA: Record<string, string> = {
    sala: 'Los dos son del festival entero y ninguno es de una actividad. El de sala tiene página propia; el manifiesto es el de la portada.',
    manifiesto: 'El mismo texto que hoy vive escrito en el código del sitio, ahora editable desde aquí.',
  };

  ROTULOS.forEach(([clave, texto, ayuda], i) => {
    conmutador.append(el('button', {
      type: 'button', role: 'tab', title: ayuda,
      'aria-selected': String(vista === clave),
      onclick: () => {
        if (vista === clave) return;
        vista = clave;
        conmutador.style.setProperty('--activa', String(i));
        conmutador.querySelectorAll('button').forEach((b, j) =>
          b.setAttribute('aria-selected', String(i === j)));
        repintar();
      },
    }, texto));
  });

  /** Sólo se rehace el cuerpo, nunca el lienzo entero: rehacer el lienzo desde
   *  dentro de un `onclick` de aquí sería tirar el nodo que está ejecutando
   *  esto — y de paso se llevaría el foco de donde estuviera. */
  function repintar() {
    vaciar(cuerpo);
    pie.textContent = NOTA[vista];
    cuerpo.append(vista === 'sala' ? vistaSala(f, ctx, repintar) : vistaManifiesto(f, ctx, repintar));
  }

  seccion.append(el('div', { class: 'mandos' }, conmutador, pie), cuerpo);
  repintar();
  return seccion;
}

// ── El texto de sala del festival ────────────────────────────────────────────

function vistaSala(f: any, ctx: Ctx, repintar: () => void): HTMLElement {
  /** La caja se crea al escribir la primera letra y no antes: un
   *  `sala: {}` guardado es una clave vacía en el JSON del repo que no dice
   *  nada. Misma idea que `podar()` en el validador. */
  const sala = () => (f.sala ??= {});

  const url = rutaDe(ctx.raiz(), SALA_FESTIVAL);
  const publicado = Boolean(f.sala?.publicado);

  const cuenta = el('p', { class: 'cuentaletras' });
  const cuerpo = el('textarea', {
    id: 'festival-sala-cuerpo', class: 'alto',
    value: f.sala?.cuerpo ?? '',
    placeholder: 'Qué es esta edición, qué va a encontrar quien entre, cómo se lee lo que hay dentro…',
    oninput: (e: any) => {
      sala().cuerpo = e.target.value;
      contar();
      ctx.cambiado();
    },
  });

  function contar() {
    const n = cuerpo.value.length;
    cuenta.textContent =
      `${n.toLocaleString('es-MX')} / ${TOPE_CUERPO.toLocaleString('es-MX')} caracteres` +
      (n ? ` · ${palabras(cuerpo.value)} palabras` : '');
    cuenta.classList.toggle('pasado', n > TOPE_CUERPO);
  }
  contar();

  const formulario = el('div', { class: 'festival-caja' },
    campo('festival-sala-titulo', 'Título',
      'Lo que va en grande arriba de la página. Si se deja vacío, sale el nombre del festival.',
      el('input', {
        type: 'text', id: 'festival-sala-titulo', value: f.sala?.titulo ?? '',
        placeholder: 'La Cuarta Silla',
        oninput: (e: any) => { sala().titulo = e.target.value; ctx.cambiado(); },
      })),

    campo('festival-sala-cuerpo', 'El texto',
      'Lo que estaría impreso en la pared. Deja una línea en blanco entre párrafos. ' +
      'Se lee de pie y en un teléfono: tres o cuatro párrafos cortos se leen enteros, dos mil palabras no.',
      cuerpo, cuenta),

    campo('festival-sala-firma', 'Firma',
      'Quién lo escribe. Va al pie de la página, en pequeño. Puede quedarse vacío.',
      el('input', {
        type: 'text', id: 'festival-sala-firma', value: f.sala?.firma ?? '',
        placeholder: 'Texto: nombre de quien lo firma',
        oninput: (e: any) => { sala().firma = e.target.value; ctx.cambiado(); },
      })),
  );

  // ── El lado derecho: la dirección, y qué se puede hacer con ella ──────────

  const lado = el('div', { class: 'festival-lado' });

  const tarjeta = el('div', { class: 'festival-caja' },
    el('span', { class: 'estado ' + (publicado ? 'estado--pub' : 'estado--bor') },
      publicado ? '▣ Publicado' : '▢ Borrador'),

    // El QR sólo cuando está publicado. La página existe de todos modos —debajo
    // vive el manifiesto— pero en borrador no lleva a tu texto, y un código que
    // se puede fotografiar de la pantalla es un código que alguien va a pegar.
    publicado ? qrChico(url) : el('div', { class: 'qr-hueco' }, 'Aquí va el QR'),

    el('div', { class: 'direccion' },
      el('code', {}, url.replace(/^https?:\/\//, '')),
      el('span', { class: 'candado' }, '🔒 No se mueve'),
    ),
    el('span', { class: 'ayuda' },
      'Es lo que va dentro del QR y no cambia nunca, pase lo que pase con el título. ' +
      'No se acuña como las de las actividades: el festival es uno, y su página existe antes ' +
      'de que nadie escriba nada.'),

    el('label', { class: 'sino', for: 'festival-sala-publicado' },
      el('input', {
        type: 'checkbox', id: 'festival-sala-publicado', checked: publicado,
        onchange: (e: any) => {
          // Publicado y en blanco es lo único que el Worker rechaza de esta
          // pestaña, y se sabe aquí mismo: dejar que se marque sería mandar la
          // colección entera para que vuelva con un error de guardado, en una
          // lista, lejos de la casilla que lo causó. Es la misma comprobación
          // que hace `guardar(publicar)` en el modal de las descripciones.
          if (e.target.checked && !cuerpo.value.trim()) {
            e.target.checked = false;
            ctx.avisar(
              'Para enseñarlo en el sitio hace falta escribir el texto: si no, el código de la ' +
              'puerta llevaría a una página con el manifiesto y nada tuyo.',
              'error',
            );
            cuerpo.focus();
            return;
          }
          if (e.target.checked) sala().publicado = true;
          else delete f.sala?.publicado;
          ctx.cambiado();
          // Publicar cambia media tarjeta —la pastilla, el QR aparece o se va, y
          // la hoja se enciende o se apaga—, así que se rehace entera en vez de
          // ir tocando nodos sueltos. Se pierde el foco de la casilla, y es el
          // precio justo: lo que se acaba de decidir tiene que verse.
          repintar();
        },
      }),
      'Enseñarlo en el sitio',
    ),
  );

  const imprimir = el('div', { class: 'festival-caja' },
    el('span', { class: 'rotulo', style: 'opacity:.65' }, 'Lo que sale por la impresora'),
    el('button', {
      type: 'button', class: 'boton fuerte', disabled: !publicado,
      title: publicado
        ? 'Una hoja entera con el código, para colgar en la entrada'
        : 'Publícalo primero: en borrador el código llevaría a una página sin tu texto',
      onclick: () => imprimirHojasQR(
        [{ titulo: f.sala?.titulo || 'Cuarta Silla', url, cab: 'Texto de sala' }],
        ctx.avisar,
      ),
    }, 'Hoja de QR — 1 hoja'),
    el('span', { class: 'ayuda' },
      'Una hoja entera con el código a quince centímetros y el título encima: el cartel de la ' +
      'puerta, el que se escanea desde donde estás sin acercarte. Cartela no hay —la etiqueta ' +
      'de un tercio de hoja es para ponerla al lado de una obra, y esto no es una obra—.'),
    el('a', {
      class: 'boton', href: url, target: '_blank', rel: 'noopener',
    }, 'Ver la página ↗'),
  );

  lado.append(tarjeta, imprimir);

  if (!publicado) {
    lado.append(el('div', { class: 'aviso ojo' },
      el('h3', {}, 'En borrador'),
      el('p', {},
        'La página existe igual —es la del manifiesto también, así que no hay forma de que ' +
        'ese código lleve a un 404— pero tu texto no sale en ella hasta que marques ' +
        '«Enseñarlo en el sitio». Por eso la hoja no se imprime todavía.'),
    ));
  } else {
    lado.append(el('div', { class: 'aviso ojo' },
      el('h3', {}, 'Antes de colgar la hoja'),
      el('p', {},
        'Publicado en el panel no es publicado en el sitio: la página se rehace un minuto y ' +
        'medio después de guardar. Dale a Guardar, espera a que la barra de arriba diga ' +
        '«publicado ✓», y entonces imprime.'),
    ));
  }

  return el('div', {},
    cabecera('Texto de sala del festival', 'Uno solo · toda la edición',
      'El que iría en la pared de la entrada: qué es esta edición y cómo se lee lo que hay ' +
      'dentro. No es de ninguna actividad —para eso está la descripción de cada una, en ' +
      'Programa— y por eso vive aquí. El sitio le da una página y de ahí sale la hoja de QR ' +
      'que se cuelga en la puerta.'),
    el('div', { class: 'festival-dos' }, formulario, lado),
  );
}

// ── El manifiesto ────────────────────────────────────────────────────────────

function vistaManifiesto(f: any, ctx: Ctx, repintar: () => void): HTMLElement {
  const mani = () => (f.manifiesto ??= {});
  const hay = Boolean(f.manifiesto?.cuerpo);

  const cuenta = el('p', { class: 'cuentaletras' });
  const cuerpo = el('textarea', {
    id: 'festival-mani-cuerpo', class: 'alto',
    value: f.manifiesto?.cuerpo ?? '',
    placeholder: 'Un párrafo, una línea en blanco, otro párrafo…',
    oninput: (e: any) => {
      mani().cuerpo = e.target.value;
      contar();
      previa();
      ctx.cambiado();
    },
  });

  function contar() {
    const n = cuerpo.value.length;
    const p = parrafos(cuerpo.value).length;
    cuenta.textContent =
      `${n.toLocaleString('es-MX')} / ${TOPE_CUERPO.toLocaleString('es-MX')} caracteres` +
      (p ? ` · ${p} ${p === 1 ? 'párrafo' : 'párrafos'}` : '');
    cuenta.classList.toggle('pasado', n > TOPE_CUERPO);
  }

  const titulo = el('input', {
    type: 'text', id: 'festival-mani-titulo', value: f.manifiesto?.titulo ?? '',
    placeholder: '¿Qué entendemos por arte conceptual?',
    oninput: (e: any) => { mani().titulo = e.target.value; previa(); ctx.cambiado(); },
  });

  const cierre = el('textarea', {
    id: 'festival-mani-cierre', rows: 3, value: f.manifiesto?.cierre ?? '',
    placeholder: 'La frase que resume todo lo de arriba.',
    oninput: (e: any) => { mani().cierre = e.target.value; previa(); ctx.cambiado(); },
  });

  contar();

  const formulario = el('div', { class: 'festival-caja' },
    campo('festival-mani-titulo', 'Título',
      'Va en display a dos líneas y muy grande. Una pregunta corta aguanta; un párrafo no.',
      titulo),

    campo('festival-mani-cuerpo', 'Los párrafos',
      'Una línea en blanco entre cada uno. Salen numerados dentro del modal, así que tres o ' +
      'cuatro se leen y ocho se hojean.',
      cuerpo, cuenta),

    campo('festival-mani-cierre', 'El cierre',
      'La frase que resume. Se pinta dos veces: de subtítulo en la banda roja de la portada y ' +
      'de remate al final del modal. Una línea, no un párrafo.',
      cierre),
  );

  // ── La banda de la portada, en chiquito ──────────────────────────────────
  //
  // Es lo único de esta pestaña que no se puede comprobar de otra forma: el
  // título va en display a un tamaño enorme y lo que importa no es cuánto mide,
  // es en cuántas líneas se parte. Eso no se ve escribiendo en una caja de
  // texto — se ve aquí, mientras se escribe.

  const banda = el('div', { class: 'mani-banda' });

  function previa() {
    vaciar(banda);
    banda.append(
      el('span', { class: 'mani-banda-rotulo' }, '01 / Manifiesto'),
      el('p', { class: 'mani-banda-titulo' }, titulo.value || 'Sin título'),
      el('p', { class: 'mani-banda-cierre' }, cierre.value || 'Sin cierre'),
    );
  }
  previa();

  const lado = el('div', { class: 'festival-lado' },
    el('div', { class: 'festival-caja' },
      el('span', { class: 'rotulo', style: 'opacity:.65' }, 'Dónde sale'),
      banda,
      el('span', { class: 'ayuda' },
        'La banda roja de la portada, en chiquito. Se rehace mientras escribes: el título de ' +
        'ahí arriba es el que se parte en dos líneas, y si crece se parte en tres.'),
    ),

    el('div', { class: 'aviso ojo' },
      el('h3', {}, 'Todavía no manda'),
      el('p', {},
        'Esto se guarda aquí, pero la portada sigue leyendo el texto que está escrito en el ' +
        'código del sitio. Se cambia el día que lo digas —es una línea— y hasta entonces lo ' +
        'de aquí y lo de allá dicen lo mismo.'),
    ),
  );

  // Si nunca se ha tocado, se ofrece el que está publicado en vez de una caja
  // en blanco. Empezar de cero un texto que ya existe y que está a la vista en
  // la portada es la clase de trabajo que nadie tiene por qué repetir.
  if (!hay) {
    lado.append(el('div', { class: 'festival-caja' },
      el('span', { class: 'rotulo', style: 'opacity:.65' }, 'Está en blanco'),
      el('span', { class: 'ayuda' },
        'Nadie lo ha escrito todavía desde el panel. El manifiesto que hay en el sitio no se ' +
        'ha perdido: sigue publicado y sigue viniendo del código. Tráelo aquí y edítalo desde ahí.'),
      el('button', {
        type: 'button', class: 'boton fuerte', style: 'margin-top:.5rem',
        onclick: () => {
          Object.assign(mani(), ctx.manifiestoDelSitio());
          ctx.cambiado();
          // Se rehace la vista entera y no sólo las tres cajas: con el texto
          // dentro, la tarjeta de «está en blanco» ya no tiene nada que decir y
          // dejarla ahí, con su botón, invita a darle otra vez.
          repintar();
          ctx.avisar(
            'Traído el que está publicado. Todavía no se ha guardado nada: míralo, cámbialo si ' +
            'quieres, y dale a Guardar.',
            'bien',
          );
        },
      }, 'Traer el que está publicado'),
    ));
  }

  return el('div', {},
    cabecera('Manifiesto', '01 / Portada',
      'El de la banda roja de la portada y el que se abre al pulsar «Leer el manifiesto». Tres ' +
      'párrafos y un cierre — el cierre es el que se lee dos veces: de subtítulo en la banda y ' +
      'de remate dentro del modal.'),
    el('div', { class: 'festival-dos' }, formulario, lado),
  );
}

// ── Dos piezas que se repiten ────────────────────────────────────────────────

/** La cabecera de una de las dos vistas. Se monta igual que la de las tablas
 *  —el `<p>` va DENTRO de `.cabecera`, que es lo que le da su cuerpo y su ancho
 *  de lectura— para que las dos pestañas empiecen con la misma forma. */
function cabecera(titulo: string, rotulo: string, nota: string): HTMLElement {
  const caja = el('div', { class: 'cabecera' },
    el('h2', {}, titulo),
    el('span', { class: 'rotulo rojo' }, rotulo),
  );
  caja.append(el('p', {}, nota));
  return caja;
}

/** Un campo con su etiqueta, su ayuda y lo que haga falta detrás.
 *
 *  No usa `pintarCampo()` de `campos.ts` a propósito: aquélla dibuja el campo de
 *  una FILA de una colección —lee y escribe `fila[campo.clave]` y se apoya en el
 *  esquema— y aquí no hay filas ni esquema, hay dos textos sueltos. Lo que se
 *  comparte es lo que importa, que son las clases: la etiqueta, la ayuda y el
 *  rojo de `.campo.malo` son los mismos de todo el panel. */
function campo(para: string, etiqueta: string, ayuda: string, ...detras: (Node | null)[]): HTMLElement {
  return el('div', { class: 'campo' },
    el('label', { for: para, title: ayuda }, etiqueta),
    el('span', { class: 'ayuda' }, ayuda),
    ...detras,
  );
}
