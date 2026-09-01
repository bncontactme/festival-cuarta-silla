/**
 * Una colección entera: sus filas, el orden y los botones de añadir.
 *
 * El orden importa en casi todas —las sedes van como nos las pasaron, el
 * archivo de lo más reciente a lo más viejo, las marcas por peso—, así que se
 * puede arrastrar. Y también hay flechas: arrastrar no funciona con teclado ni
 * en algunos teléfonos, y este panel se va a usar desde un teléfono.
 */
import type { Tabla } from './esquema';
import type { Ctx } from './campos';
import { pintarCampo } from './campos';
import { el, vaciar } from './dom';

export function pintarTabla(tabla: Tabla, estado: any, ctx: Ctx, errores: string[] = []): HTMLElement {
  const seccion = el('section', { style: 'margin-bottom:1.5rem' });
  const cuerpo = el('div', { class: 'filas' });

  const lista = () => tabla.leer(estado) as any[];

  const cabecera = el('div', { class: 'cabecera' },
    el('h2', {}, tabla.titulo),
    el('span', { class: 'rotulo', style: 'opacity:.5' }, `${lista().length} ${tabla.esquema.plural}`),
  );
  if (tabla.nota) cabecera.append(el('p', {}, tabla.nota));
  seccion.append(cabecera);

  // ── Reordenar ─────────────────────────────────────────────────────────────
  let arrastrando: number | null = null;

  function mover(de: number, a: number) {
    const l = lista();
    if (a < 0 || a >= l.length || de === a) return;
    l.splice(a, 0, l.splice(de, 1)[0]);
    tabla.escribir(estado, l);
    repintar();
    ctx.cambiado();
  }

  function fila(dato: any, i: number) {
    const nodo = el('article', { class: 'fila', 'data-i': String(i) });

    const asa = el('div', { class: 'asa', title: 'Arrastra para reordenar' },
      el('button', { type: 'button', class: 'mover', title: 'Subir', disabled: i === 0,
        onclick: () => mover(i, i - 1) }, '▲'),
      el('span', { class: 'puntos' }, '⠿'),
      el('span', { class: 'num' }, String(i + 1).padStart(2, '0')),
      el('button', { type: 'button', class: 'mover', title: 'Bajar', disabled: i === lista().length - 1,
        onclick: () => mover(i, i + 1) }, '▼'),
    );

    // El truco de siempre: la fila sólo se vuelve arrastrable mientras el dedo
    // está en el asa. Si no, arrastrar para seleccionar texto dentro de un
    // campo se lleva la fila por delante.
    asa.addEventListener('pointerdown', () => { nodo.draggable = true; });
    nodo.addEventListener('dragend', () => { nodo.draggable = false; arrastrando = null; limpiarMarcas(); });
    nodo.addEventListener('dragstart', (e: DragEvent) => {
      arrastrando = i;
      nodo.classList.add('arrastrando');
      e.dataTransfer?.setData('text/plain', String(i));
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    });
    nodo.addEventListener('dragover', (e: DragEvent) => {
      if (arrastrando === null) return;
      e.preventDefault();
      limpiarMarcas();
      nodo.classList.add('destino');
    });
    nodo.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      limpiarMarcas();
      if (arrastrando !== null) mover(arrastrando, i);
      arrastrando = null;
    });

    const rejilla = el('div', { class: 'rejilla' });
    for (const campo of tabla.esquema.campos) rejilla.append(pintarCampo(campo, dato, ctx, i === 0));

    const acciones = el('div', { class: 'acciones' },
      el('button', { type: 'button', class: 'boton suave', onclick: () => {
        const l = lista();
        l.splice(i + 1, 0, JSON.parse(JSON.stringify(dato)));
        tabla.escribir(estado, l); repintar(); ctx.cambiado();
      } }, 'Duplicar'),
      el('button', { type: 'button', class: 'boton suave', onclick: () => {
        if (!confirm(`¿Borrar «${tabla.esquema.titula(dato, i)}»?\n\nTodavía se puede deshacer: mientras no guardes, recargar la página lo devuelve todo.`)) return;
        const l = lista(); l.splice(i, 1);
        tabla.escribir(estado, l); repintar(); ctx.cambiado();
      } }, 'Borrar'),
    );

    nodo.append(asa, el('div', { class: 'cuerpo' }, rejilla, acciones));
    return nodo;
  }

  function limpiarMarcas() {
    cuerpo.querySelectorAll('.destino').forEach((n) => n.classList.remove('destino'));
  }

  function repintar() {
    vaciar(cuerpo);
    const l = lista();
    if (!l.length) {
      cuerpo.append(el('div', { class: 'vacio' },
        el('p', {}, `Todavía no hay ${tabla.esquema.plural}. El sitio ya sabe qué enseñar mientras tanto.`),
        el('button', { type: 'button', class: 'boton fuerte', onclick: anadir }, `Añadir ${tabla.esquema.singular}`),
      ));
    } else {
      l.forEach((d, i) => cuerpo.append(fila(d, i)));
    }
    (cabecera.querySelector('.rotulo') as HTMLElement).textContent =
      `${l.length} ${tabla.esquema.plural}`;
    marcar();
  }

  function anadir() {
    const l = lista();
    l.push(tabla.esquema.nuevo());
    tabla.escribir(estado, l);
    repintar();
    ctx.cambiado();
    // La nueva va al final: llevar la vista hasta ella evita el «no pasó nada»
    // cuando la lista es larga.
    cuerpo.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (cuerpo.lastElementChild?.querySelector('input, select, textarea') as HTMLElement)?.focus();
  }

  /**
   * Pinta en rojo lo que el Worker rechazó.
   *
   * Los errores llegan como «programa[3].sede: …». Se lee el índice y el campo
   * y se marca esa casilla concreta: un listado de quejas arriba está bien para
   * saber cuántas hay, pero lo que arregla el problema es ver cuál de las
   * cuarenta filas está mal.
   */
  function marcar() {
    if (!errores.length) return;
    // `actividades` es la tabla; `programa` es como la nombra el validador.
    const prefijo = tabla.clave === 'actividades' ? 'programa' : tabla.clave;
    for (const queja of errores) {
      const m = new RegExp('^' + prefijo + '\\[(\\d+)\\](?:\\.([a-zA-Z]+))?(?:\\[(\\d+)\\])?').exec(queja);
      if (!m) continue;
      const nodo = cuerpo.querySelector(`.fila[data-i="${m[1]}"]`);
      if (!nodo) continue;
      nodo.classList.add('mala');
      const campo = m[2] && nodo.querySelector(`.campo[data-clave="${m[2]}"]`);
      const destino = campo || nodo.querySelector('.cuerpo');
      if (campo) campo.classList.add('malo');
      destino?.append(el('span', { class: 'queja' }, queja.slice(queja.indexOf(':') + 1).trim()));
    }
  }

  seccion.append(cuerpo);
  seccion.append(el('div', { style: 'margin-top:.6rem' },
    el('button', { type: 'button', class: 'boton', onclick: anadir }, `+ Añadir ${tabla.esquema.singular}`),
  ));

  repintar();
  return seccion;
}
