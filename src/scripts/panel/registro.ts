/**
 * La pestaña de Registro. Una columna: el formulario de cada actividad.
 *
 * No es una colección: es **el programa mirado por la puerta de entrar**. La
 * lista de eventos es la misma —`programa.actividades`— y lo que se edita aquí
 * es, de cada una, su formulario. Nada más.
 *
 * Ese «nada más» costó una vuelta. Hubo también un interruptor de «el registro
 * está abierto», un formulario general y una nota de la página, copiando el
 * interruptor de la rejilla de ejemplo. Sobraba: **aquí no hay un registro al
 * festival que abrir o cerrar** —se apunta uno por actividad—, así que pegarle
 * el formulario a una actividad ES abrirle el registro. Lo único que hacía el
 * interruptor era dejar la página en «Próximamente» con tres formularios ya
 * cargados, esperando a que alguien se acordara de marcar una casilla.
 *
 * Por qué esto y no una lista propia de «eventos con registro»: dos listas de lo
 * mismo se separan el primer día que alguien cambia una hora en una sola de las
 * dos, y entonces el sitio dice una cosa en /programa y otra en /registro. Al
 * ser la misma lista, mover un taller de las 12 a las 13 lo mueve en los dos
 * sitios y no hay nada que sincronizar.
 *
 * La forma sí es distinta a propósito. En Programa cada actividad es una ficha
 * de nueve campos porque ahí se escribe; aquí no se escribe una actividad, se
 * repasa una columna de cuarenta —«¿a cuál le falta el formulario?»—, y para eso
 * lo que sirve es un renglón por actividad y todas a la vista.
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

  const actos: any[] = programa.actividades;
  const cuenta = (p: Puerta) => actos.filter((a) => puertaDe(a) === p).length;

  /** Qué se está mirando. Vive fuera del repintado para que filtrar no lo
   *  pierda. */
  let filtro: Puerta | 'todas' = 'todas';

  const cabecera = el('div', { class: 'cabecera' },
    el('h2', {}, 'Registro a eventos'),
    el('span', { class: 'rotulo', style: 'opacity:.5' },
      `${cuenta('formulario')} de ${actos.length} con formulario`),
    el('p', {},
      'Pega aquí el formulario de cada actividad y sale en /registro. No hay nada más que darle: ' +
      'el registro es a los eventos, no al festival.'),
  );
  seccion.append(cabecera);

  // ── La lista ───────────────────────────────────────────────────────────────
  const barraFiltro = el('div', { class: 'filtros' });
  const cuerpo = el('div', { class: 'renglones' });
  seccion.append(barraFiltro, cuerpo);

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
      cabecera.querySelector('.rotulo')!.textContent =
        `${cuenta('formulario')} de ${actos.length} con formulario`;
    }

    nodo.append(cuando, quien, enlace, libre, marca);
    nodo.dataset.i = String(i);
    return nodo;
  }

  pintarFiltros();
  pintarLista();
  return seccion;
}
