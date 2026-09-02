/**
 * La pestaña de Registro.
 *
 * No es una colección: es **el programa mirado por la puerta de entrar**. La
 * lista de eventos es la misma —`programa.actividades`—, y lo que se edita aquí
 * es, de cada una, su formulario; más las tres cosas que son de la página
 * entera y no caben en ninguna fila.
 *
 * Por qué así y no una lista propia de «eventos con registro»: dos listas de lo
 * mismo se separan el primer día que alguien cambia una hora en una sola de las
 * dos, y entonces el sitio dice una cosa en /programa y otra en /registro. Al
 * ser la misma lista, mover un taller de las 12 a las 13 lo mueve en los dos
 * sitios y no hay nada que sincronizar.
 *
 * La forma también es distinta a propósito. En Programa cada actividad es una
 * ficha de ocho campos porque ahí se escribe; aquí no se escribe una actividad,
 * se repasa una columna de cuarenta —«¿a cuáles les falta el formulario?»—, y para
 * eso lo que sirve es un renglón por actividad y todas a la vista.
 */
import { el, vaciar } from './dom';
import type { Ctx } from './campos';

/** Los tres estados de la puerta de una actividad. En este orden: es el de
 *  «esto está resuelto» a «esto falta», que es como se repasa la lista. */
type Puerta = 'formulario' | 'libre' | 'pendiente';

const puertaDe = (a: any): Puerta =>
  a.registro ? 'formulario' : a.libre ? 'libre' : 'pendiente';

const ROTULO: Record<Puerta, string> = {
  formulario: 'Con formulario',
  libre: 'Entrada libre',
  pendiente: 'Pendiente',
};

/**
 * De quién es el formulario, para decirlo en el renglón.
 *
 * «Con formulario» a secas no distingue un Google Forms de un enlace pegado de
 * cualquier otro sitio, y pegar el de la actividad de al lado —o el del panel
 * de administración de Forms en vez del de responder— es el error de todos los
 * días cuando se cargan catorce seguidas. Diciendo cuál es, se ve de reojo.
 *
 * La misma regla que `proveedorDeFormulario()` en `site.ts`, escrita otra vez
 * porque el panel no puede importar el sitio. Son cuatro líneas y no se mueven.
 */
function proveedor(url: string): string {
  try {
    const { hostname } = new URL(url);
    if (/(^|\.)tally\.so$/.test(hostname)) return 'Tally';
    if (/(^|\.)(forms\.gle|docs\.google\.com)$/.test(hostname)) return 'Google Forms';
    return hostname.replace(/^www\./, '');
  } catch {
    return 'enlace raro';
  }
}

export function pintarRegistro(estado: any, ctx: Ctx, dias: string[]): HTMLElement {
  const seccion = el('section');
  const programa = estado.programa;

  /**
   * Los ajustes del registro, en una copia.
   *
   * No se hace `programa.registro ??= {}` sobre el estado: lo sucio se calcula
   * comparando el JSON con el que bajó del Worker, así que meterle una clave
   * vacía al entrar marcaba el programa como «sin guardar» por el solo hecho de
   * abrir la pestaña — con el punto rojo, el botón encendido y la pregunta al
   * cerrar, sin que nadie hubiera tocado nada.
   *
   * Se escribe al estado sólo cuando hay algo que escribir, y se quita entero
   * cuando se vacía el último campo. Vaciar los tres tiene que dejar el
   * programa exactamente como estaba.
   */
  const reg: any = { ...(programa.registro ?? {}) };

  function guardarAjustes() {
    if (Object.keys(reg).length) programa.registro = { ...reg };
    else delete programa.registro;
    ctx.cambiado();
  }

  // La lista de verdad, no una copia: lo que se escribe en un renglón se
  // escribe en la actividad del programa, que es de lo que va esta pestaña.
  if (!Array.isArray(programa.actividades)) programa.actividades = [];
  const actos: any[] = programa.actividades;
  const cuenta = (p: Puerta) => actos.filter((a) => puertaDe(a) === p).length;

  /** Qué se está mirando. Vive fuera del repintado para que filtrar no lo
   *  pierda. */
  let filtro: Puerta | 'todas' = 'todas';

  const cabecera = el('div', { class: 'cabecera' },
    el('h2', {}, 'Registro a eventos'),
    el('span', { class: 'rotulo', style: 'opacity:.5' },
      `${cuenta('formulario') + cuenta('libre')} de ${actos.length} con puerta`),
    el('p', {},
      'Aquí no se apunta uno al festival: se apunta a cada actividad. Esta pestaña es la misma lista del Programa, ' +
      'mirada por su formulario — cambiar una hora se hace allí y se ve aquí, porque es el mismo dato.'),
  );
  seccion.append(cabecera);

  // ── El interruptor y lo de la página entera ────────────────────────────────
  // El interruptor cambia de color y de texto según lo que haya debajo, así que
  // se guarda para poder cambiarlo en su sitio: repintar la pestaña entera cada
  // vez que se marca una casilla pierde el scroll y el foco.
  let nodoInterruptor = interruptor();
  seccion.append(nodoInterruptor);
  seccion.append(ajustes());

  function refrescarInterruptor() {
    const nuevo = interruptor();
    nodoInterruptor.replaceWith(nuevo);
    nodoInterruptor = nuevo;
  }

  // ── La lista ───────────────────────────────────────────────────────────────
  const barraFiltro = el('div', { class: 'filtros' });
  const cuerpo = el('div', { class: 'renglones' });
  seccion.append(barraFiltro, cuerpo);

  /**
   * «El registro está abierto». Es el botón de publicar de esta página, igual
   * que el de la rejilla de ejemplo lo es del programa, y por la misma razón se
   * pregunta en vez de deducirse: que haya formularios pegados no quiere decir
   * que el registro esté abierto — se pegan mientras se prepara.
   *
   * Y está atado al otro: no se puede abrir el registro de un programa que
   * todavía dice ser un andamio, porque enseñar sus actividades aquí sería
   * publicar por la puerta de atrás lo que la puerta de delante esconde.
   */
  function interruptor() {
    const abierto = reg.abierto === true;
    const esEjemplo = programa.esEjemplo !== false;
    const casilla = el('input', {
      type: 'checkbox', checked: abierto, id: 'registro-abierto',
      style: 'width:auto;margin-right:.5rem',
      onchange: (e: any) => {
        if (e.target.checked) reg.abierto = true;
        else delete reg.abierto;
        guardarAjustes();
        refrescarInterruptor();
      },
    });

    const sinPuerta = abierto && !esEjemplo && cuenta('formulario') + cuenta('libre') === 0;
    const clase = !abierto ? 'ojo' : esEjemplo || sinPuerta ? 'error' : 'bien';

    return el('div', { class: 'aviso ' + clase },
      el('label', { for: 'registro-abierto', style: 'display:flex;align-items:flex-start;cursor:pointer' },
        casilla,
        el('span', {},
          el('strong', {}, 'El registro está abierto.'),
          ' ',
          !abierto
            ? 'Mientras esté sin marcar, /registro enseña el cartel de «Próximamente» y no se ve ni una actividad, tengan formulario o no. Márcalo cuando ya se pueda entrar.'
            : esEjemplo
              ? 'Está marcado, pero el programa sigue marcado como «rejilla de ejemplo» y eso manda: /registro seguirá diciendo «Próximamente». No se puede abrir la entrada a un programa que todavía dice que no es el programa. Publica el programa y esto se abre solo.'
              : sinPuerta
                ? 'Está abierto y ninguna actividad tiene formulario ni está marcada como entrada libre: la página va a salir vacía. Rellena la columna de abajo antes de dejarlo así.'
                : `El registro está publicado: /registro enseña las ${cuenta('formulario') + cuenta('libre')} actividades a las que se puede entrar.`,
        ),
      ),
    );
  }

  /** Lo que no es de ninguna actividad: el formulario general y la nota. */
  function ajustes() {
    const caja = el('div', { class: 'fila fila--suelta' });
    const rejilla = el('div', { class: 'rejilla' });

    const general = el('div', { class: 'campo', style: 'grid-column:span 3' },
      el('label', {}, 'Formulario general'),
      el('input', {
        type: 'url', placeholder: 'https://…', spellcheck: false,
        value: reg.general ?? '',
        oninput: (e: any) => {
          const v = e.target.value.trim();
          if (v) reg.general = v; else delete reg.general;
          guardarAjustes();
        },
      }),
      el('span', { class: 'ayuda' },
        'Uno solo para todo el festival, si lo hay. Sale arriba de la página, encima de la lista. Sin él, cada quien se apunta actividad por actividad, que es lo normal.'),
    );

    const nota = el('div', { class: 'campo', style: 'grid-column:span 5' },
      el('label', {}, 'Nota del registro'),
      el('textarea', {
        value: reg.nota ?? '',
        placeholder: 'Cupos, si hay que llegar antes, qué pasa si no te apuntaste…',
        oninput: (e: any) => {
          const v = e.target.value.trim();
          if (v) reg.nota = v; else delete reg.nota;
          guardarAjustes();
        },
      }),
      el('span', { class: 'ayuda' }, 'Sale debajo del titular de /registro. Máximo 400 caracteres.'),
    );

    rejilla.append(general, nota);
    caja.append(el('div', { class: 'cuerpo' }, rejilla));
    return caja;
  }

  // ── Los renglones ──────────────────────────────────────────────────────────

  function pintarFiltros() {
    vaciar(barraFiltro);
    const opciones: { clave: Puerta | 'todas'; texto: string; n: number }[] = [
      { clave: 'todas', texto: 'Todas', n: actos.length },
      { clave: 'pendiente', texto: ROTULO.pendiente, n: cuenta('pendiente') },
      { clave: 'formulario', texto: ROTULO.formulario, n: cuenta('formulario') },
      { clave: 'libre', texto: ROTULO.libre, n: cuenta('libre') },
    ];
    for (const o of opciones) {
      barraFiltro.append(el('button', {
        type: 'button',
        class: 'filtro' + (filtro === o.clave ? ' puesto' : ''),
        'aria-pressed': String(filtro === o.clave),
        onclick: () => { filtro = o.clave; pintarFiltros(); pintarLista(); },
      }, o.texto, el('span', { class: 'cuenta' }, String(o.n))));
    }
  }

  function pintarLista() {
    vaciar(cuerpo);

    if (!actos.length) {
      cuerpo.append(el('div', { class: 'vacio' },
        el('p', {}, 'Todavía no hay actividades. El registro es a los eventos del programa: primero se cargan allí y aquí aparecen solas.'),
        el('button', {
          type: 'button', class: 'boton fuerte',
          onclick: () => ctx.irA?.('programa'),
        }, 'Ir al programa'),
      ));
      return;
    }

    // Por día y por hora, que es como se repasa un programa. La posición en la
    // lista del panel aquí no dice nada.
    const orden = actos
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => filtro === 'todas' || puertaDe(a) === filtro)
      .sort((x, y) =>
        (Number(x.a.dia) || 0) - (Number(y.a.dia) || 0) ||
        String(x.a.inicio ?? '').localeCompare(String(y.a.inicio ?? '')));

    if (!orden.length) {
      cuerpo.append(el('div', { class: 'vacio' },
        el('p', {}, filtro === 'pendiente'
          ? 'No queda ninguna pendiente: todas tienen formulario o están marcadas como entrada libre.'
          : 'Ninguna actividad en este estado.'),
      ));
      return;
    }

    let diaPintado = -1;
    for (const { a, i } of orden) {
      const d = Number(a.dia) || 0;
      if (d !== diaPintado) {
        diaPintado = d;
        cuerpo.append(el('h4', { class: 'dia-corte' }, dias[d] ?? `Día ${d + 1}`));
      }
      cuerpo.append(renglon(a, i));
    }
  }

  function renglon(a: any, i: number) {
    const estadoPuerta = puertaDe(a);
    const nodo = el('div', { class: 'renglon renglon--' + estadoPuerta });

    const cuando = el('div', { class: 'renglon-cuando mono' },
      a.inicio && a.fin ? `${a.inicio}–${a.fin}` : 'sin hora');

    const quien = el('div', { class: 'renglon-que' },
      el('strong', {}, a.titulo || 'Sin título'),
      el('span', { class: 'renglon-donde' },
        [a.sede, a.artista].filter(Boolean).join(' · ') || 'sin sede'),
    );

    const enlace = el('input', {
      type: 'url', spellcheck: false,
      placeholder: a.libre ? 'entrada libre — sin formulario' : 'https://forms.gle/… o https://tally.so/r/…',
      value: a.registro ?? '',
      disabled: Boolean(a.libre),
      oninput: (e: any) => {
        const v = e.target.value.trim();
        if (v) a.registro = v; else delete a.registro;
        ctx.cambiado();
        marcarEstado();
      },
    });

    const libre = el('label', { class: 'sino', title: 'Se entra sin apuntarse' },
      el('input', {
        type: 'checkbox', checked: a.libre === true, style: 'width:auto',
        onchange: (e: any) => {
          if (e.target.checked) {
            a.libre = true;
            // El formulario manda sobre la marca; si hay los dos, se guarda
            // sólo el formulario. Mejor decirlo aquí que dejar que lo corrija
            // el Worker al guardar.
            if (a.registro) {
              delete a.libre;
              e.target.checked = false;
              ctx.avisar('Esa actividad ya tiene formulario. Quítalo primero si de verdad es de entrada libre.', 'ojo');
            }
          } else {
            delete a.libre;
          }
          ctx.cambiado();
          pintarFiltros();
          pintarLista();
          refrescarInterruptor();
        },
      }),
      el('span', {}, 'Libre'),
    );

    const rotulo = (a: any) =>
      puertaDe(a) === 'formulario' ? proveedor(a.registro) : ROTULO[puertaDe(a)];

    const marca = el('span', { class: 'renglon-marca' }, rotulo(a));

    function marcarEstado() {
      const ahora = puertaDe(a);
      nodo.className = 'renglon renglon--' + ahora;
      marca.textContent = rotulo(a);
      enlace.disabled = Boolean(a.libre);
      // La cuenta de la pestaña y la de los filtros cuentan lo mismo: si una
      // se mueve y la otra no, parece que se perdió algo.
      pintarFiltros();
      refrescarInterruptor();
      cabecera.querySelector('.rotulo')!.textContent =
        `${cuenta('formulario') + cuenta('libre')} de ${actos.length} con puerta`;
    }

    nodo.append(cuando, quien, enlace, libre, marca);
    nodo.dataset.i = String(i);
    return nodo;
  }

  pintarFiltros();
  pintarLista();
  return seccion;
}
