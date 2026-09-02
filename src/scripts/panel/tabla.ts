/**
 * Una colección entera: sus filas, el orden y los botones de añadir.
 *
 * El orden importa en casi todas —las sedes van como nos las pasaron, el
 * archivo de lo más reciente a lo más viejo, las marcas por peso—, así que se
 * puede arrastrar. Y también hay flechas: arrastrar no funciona con teclado ni
 * en algunos teléfonos, y este panel se va a usar desde un teléfono.
 *
 * **Las filas se pliegan.** `titula()` estaba escrito desde el principio para
 * «el renglón que resume la fila cuando está plegada» y no se plegaba ninguna:
 * diecinueve actividades eran cinco mil píxeles de scroll, y para cambiar la
 * hora de la última había que pasar por delante de las dieciocho anteriores.
 * Plegadas caben todas en una pantalla, que es lo que hace falta para lo que de
 * verdad se hace aquí — buscar una y tocarla.
 *
 * Y por eso mismo la ayuda de cada campo ya no se pinta sólo en la primera
 * fila. Esa regla existía porque cuarenta copias del mismo texto son ruido; con
 * las filas plegadas nunca hay cuarenta abiertas, y quien abre una fila por
 * primera vez es justo quien necesita leerla.
 */
import type { Tabla } from './esquema';
import type { Ctx } from './campos';
import { pintarCampo } from './campos';
import { el, vaciar } from './dom';

/** A partir de aquí la lista se pliega sola. Por debajo no compensa: tres
 *  marcas plegadas son tres clics para ver lo que ya cabía. */
const PLIEGA_DESDE = 4;

export function pintarTabla(tabla: Tabla, estado: any, ctx: Ctx, errores: string[] = []): HTMLElement {
  const seccion = el('section', { style: 'margin-bottom:1.5rem' });
  const cuerpo = el('div', { class: 'filas' });

  const lista = () => tabla.leer(estado) as any[];

  /** Qué filas están abiertas. Se guarda la fila misma y no su posición:
   *  reordenar, filtrar o borrar mueven los números de sitio, y lo que tiene
   *  que seguir abierto es lo que estabas mirando, no el hueco donde estaba.
   *
   *  Una lista corta empieza entera abierta: tres marcas plegadas son tres
   *  clics para ver lo que ya cabía. */
  const abiertas = new Set<any>();
  if (lista().length < PLIEGA_DESDE) lista().forEach((d) => abiertas.add(d));

  let busqueda = '';

  // ── Cabecera ──────────────────────────────────────────────────────────────

  const conteo = el('span', { class: 'rotulo', style: 'opacity:.5' },
    `${lista().length} ${tabla.esquema.plural}`);

  const buscador = el('input', {
    type: 'search', class: 'buscador', placeholder: `Buscar en ${tabla.esquema.plural}…`,
    spellcheck: false, value: busqueda,
    oninput: (e: any) => { busqueda = e.target.value; repintar(); },
  });

  const todasAbiertas = () => {
    const l = visibles();
    return l.length > 0 && l.every(({ dato }) => abiertas.has(dato));
  };

  const desplegar = el('button', {
    type: 'button', class: 'boton suave',
    onclick: () => {
      const l = visibles();
      // El botón dice lo que va a hacer, no las dos cosas que podría hacer.
      if (todasAbiertas()) l.forEach(({ dato }) => abiertas.delete(dato));
      else l.forEach(({ dato }) => abiertas.add(dato));
      repintar();
    },
  }, 'Abrir todas');

  const cabecera = el('div', { class: 'cabecera' },
    el('h2', {}, tabla.titulo),
    conteo,
    el('span', { class: 'cabecera-mandos' }, buscador, desplegar),
  );
  if (tabla.nota) cabecera.append(el('p', {}, tabla.nota));
  seccion.append(cabecera);

  // ── Qué se ve ─────────────────────────────────────────────────────────────

  /** Lo que se busca de una fila: su título, su resumen y lo que el esquema
   *  quiera añadir. Sin tildes, para que «grafica» encuentre «gráfica». */
  function texto(dato: any, i: number) {
    return [
      tabla.esquema.titula(dato, i),
      tabla.esquema.resume?.(dato, ctx.dias()) ?? '',
      tabla.esquema.busca?.(dato) ?? '',
    ].join(' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function visibles(): { dato: any; i: number }[] {
    const todas = lista().map((dato, i) => ({ dato, i }));
    const q = busqueda.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (!q) return todas;
    return todas.filter(({ dato, i }) => texto(dato, i).includes(q));
  }

  const filtrando = () => busqueda.trim().length > 0;

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
    const abierta = abiertas.has(dato);
    const nodo = el('article', { class: 'fila' + (abierta ? ' abierta' : ''), 'data-i': String(i) });

    // Filtrando, el orden de la pantalla no es el de la lista: arrastrar la
    // tercera de cuatro resultados movería la fila 17 al sitio de la 3. Se
    // apaga y se dice, en vez de dejar que reordene mal.
    const bloqueado = filtrando();

    const asa = el('div', { class: 'asa', title: bloqueado ? 'Para reordenar, vacía la búsqueda' : 'Arrastra para reordenar' },
      el('button', { type: 'button', class: 'mover', title: 'Subir', disabled: bloqueado || i === 0,
        onclick: () => mover(i, i - 1) }, '▲'),
      el('span', { class: 'puntos' }, '⠿'),
      el('span', { class: 'num' }, String(i + 1).padStart(2, '0')),
      el('button', { type: 'button', class: 'mover', title: 'Bajar', disabled: bloqueado || i === lista().length - 1,
        onclick: () => mover(i, i + 1) }, '▼'),
    );

    if (!bloqueado) {
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
    }

    // ── El renglón plegado ───────────────────────────────────────────────
    const resumen = el('button', {
      type: 'button', class: 'resumen', 'aria-expanded': String(abierta),
      onclick: () => {
        if (abiertas.has(dato)) abiertas.delete(dato);
        else abiertas.add(dato);
        repintar();
        // Abrir una fila del final no sirve de nada si la vista se queda
        // arriba: se busca precisamente para llegar a ella.
        if (abiertas.has(dato)) {
          cuerpo.querySelector(`.fila[data-i="${i}"]`)
            ?.scrollIntoView({ block: 'nearest' });
        }
      },
    },
      el('span', { class: 'resumen-signo', 'aria-hidden': 'true' }, abierta ? '−' : '+'),
      el('span', { class: 'resumen-texto' },
        el('strong', {}, tabla.esquema.titula(dato, i)),
        el('span', { class: 'resumen-nota' }, tabla.esquema.resume?.(dato, ctx.dias()) ?? ''),
      ),
    );

    /** El renglón plegado es el nombre de la fila: si dice «Sin título»
     *  mientras escribes el título dos centímetros más abajo, deja de ser el
     *  nombre de nada. Se refresca al vuelo. */
    const refrescarResumen = () => {
      (resumen.querySelector('strong') as HTMLElement).textContent = tabla.esquema.titula(dato, i);
      (resumen.querySelector('.resumen-nota') as HTMLElement).textContent =
        tabla.esquema.resume?.(dato, ctx.dias()) ?? '';
    };
    const ctxFila: Ctx = { ...ctx, cambiado: () => { refrescarResumen(); ctx.cambiado(); } };

    const dentro = el('div', { class: 'cuerpo', hidden: !abierta });
    if (abierta) {
      const rejilla = el('div', { class: 'rejilla' });
      for (const campo of tabla.esquema.campos) rejilla.append(pintarCampo(campo, dato, ctxFila));

      const acciones = el('div', { class: 'acciones' },
        el('button', { type: 'button', class: 'boton suave', onclick: () => {
          const l = lista();
          const copia = JSON.parse(JSON.stringify(dato));
          l.splice(i + 1, 0, copia);
          abiertas.add(copia);
          tabla.escribir(estado, l); repintar(); ctx.cambiado();
        } }, 'Duplicar'),
        el('button', { type: 'button', class: 'boton suave', onclick: () => {
          if (!confirm(`¿Borrar «${tabla.esquema.titula(dato, i)}»?\n\nTodavía se puede deshacer: mientras no guardes, recargar la página lo devuelve todo.`)) return;
          const l = lista(); l.splice(i, 1);
          abiertas.delete(dato);
          tabla.escribir(estado, l); repintar(); ctx.cambiado();
        } }, 'Borrar'),
      );
      dentro.append(rejilla, acciones);
    }

    nodo.append(asa, el('div', { class: 'columna' }, resumen, dentro));
    return nodo;
  }

  function limpiarMarcas() {
    cuerpo.querySelectorAll('.destino').forEach((n) => n.classList.remove('destino'));
  }

  function repintar() {
    vaciar(cuerpo);
    const l = lista();
    const aLaVista = visibles();

    if (!l.length) {
      // Un solo botón de añadir y no dos: el estado vacío tenía el suyo y
      // debajo, a dos centímetros, otro exactamente igual.
      cuerpo.append(el('div', { class: 'vacio' },
        el('p', {}, `Todavía no hay ${tabla.esquema.plural}. El sitio ya sabe qué enseñar mientras tanto.`),
        el('button', { type: 'button', class: 'boton fuerte', onclick: anadir }, `Añadir ${tabla.esquema.singular}`),
      ));
    } else if (!aLaVista.length) {
      cuerpo.append(el('div', { class: 'vacio' },
        el('p', {}, `Ninguna de las ${l.length} ${tabla.esquema.plural} dice «${busqueda.trim()}».`),
        el('button', { type: 'button', class: 'boton', onclick: () => {
          busqueda = ''; buscador.value = ''; repintar();
        } }, 'Ver todas'),
      ));
    } else {
      aLaVista.forEach(({ dato, i }) => cuerpo.append(fila(dato, i)));
    }

    conteo.textContent = filtrando() && l.length
      ? `${aLaVista.length} de ${l.length} ${tabla.esquema.plural}`
      : `${l.length} ${tabla.esquema.plural}`;

    anadirBoton.hidden = !l.length;
    buscador.hidden = l.length < PLIEGA_DESDE;
    desplegar.hidden = l.length < PLIEGA_DESDE;
    desplegar.textContent = todasAbiertas() ? 'Plegar todas' : 'Abrir todas';
    marcar();
  }

  function anadir() {
    const l = lista();
    const nueva = tabla.esquema.nuevo();
    l.push(nueva);
    abiertas.add(nueva);
    // Una fila nueva que sale filtrada es una fila que no aparece: se limpia la
    // búsqueda antes de añadirla, que es menos raro que buscarla.
    busqueda = ''; buscador.value = '';
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
   *
   * Y se abre la fila. Con las filas plegadas, marcar en rojo una casilla que
   * está dentro de un pliegue cerrado es no marcar nada.
   */
  function marcar() {
    if (!errores.length) return;
    // `actividades` es la tabla; `programa` es como la nombra el validador.
    const prefijo = tabla.clave === 'actividades' ? 'programa' : tabla.clave;

    const malas = new Set<number>();
    for (const queja of errores) {
      const m = new RegExp('^' + prefijo + '\\[(\\d+)\\]').exec(queja);
      if (m) malas.add(Number(m[1]));
    }
    // Si lo que falla está escondido —plegado o filtrado—, no se puede enseñar
    // sin sacarlo a la vista primero.
    let hayQueRepintar = false;
    for (const i of malas) {
      const dato = lista()[i];
      if (dato && !abiertas.has(dato)) { abiertas.add(dato); hayQueRepintar = true; }
    }
    if (filtrando() && malas.size) { busqueda = ''; buscador.value = ''; hayQueRepintar = true; }
    if (hayQueRepintar) { repintar(); return; }

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

  const anadirBoton = el('div', { style: 'margin-top:.6rem' },
    el('button', { type: 'button', class: 'boton', onclick: anadir }, `+ Añadir ${tabla.esquema.singular}`),
  );

  seccion.append(cuerpo);
  seccion.append(anadirBoton);

  repintar();
  return seccion;
}
