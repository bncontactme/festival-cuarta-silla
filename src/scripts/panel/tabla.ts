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

  /** «Campos», desde la vista de lista del programa, pide una fila concreta.
   *  Sin esto, cambiar de vista te deja arriba del todo con treinta y dos filas
   *  plegadas y la que ibas a tocar perdida en mitad de la pila. */
  const pedida = ctx.destacada?.();
  if (pedida && lista().includes(pedida)) abiertas.add(pedida);

  let busqueda = '';
  /** Lo que devuelve `preparar()`, vigente durante un repintado. */
  let preparado: any = null;

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
    // El filtro de la barra de arriba —hoy «sólo con texto de sala»— se aplica
    // antes que la búsqueda: es del tipo «enséñame sólo estas», no del tipo
    // «busca esto». Vive fuera de la tabla porque lo manda un botón que no es
    // suyo, y entra por `ctx` para que esto no sepa de qué va.
    const extra = ctx.filtro?.();
    const todas = lista()
      .map((dato, i) => ({ dato, i }))
      .filter(({ dato }) => !extra || extra(dato));
    const q = busqueda.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (!q) return todas;
    return todas.filter(({ dato, i }) => texto(dato, i).includes(q));
  }

  const filtrando = () => busqueda.trim().length > 0 || Boolean(ctx.filtro?.());

  /**
   * Por qué no se ve nada, dicho como toca.
   *
   * Hay dos formas de esconder filas y antes sólo se contaba una: el mensaje era
   * siempre «ninguna dice “tal”», así que con el botón de «Sólo con texto de
   * sala» puesto y la búsqueda vacía salía **«Ninguna de las 39 actividades dice
   * “”»**. Un hueco entre comillas explicando por qué está vacío.
   */
  function porQueNoSeVe(): string {
    const q = busqueda.trim();
    const nombre = ctx.filtro?.() ? (ctx.filtroNombre?.() ?? 'el filtro de arriba') : null;
    if (q && nombre) return `dice «${q}» y pasa ${nombre}`;
    if (q) return `dice «${q}»`;
    return `pasa ${nombre ?? 'el filtro'}`;
  }

  /** Quita las dos cosas que esconden filas, no sólo la búsqueda: si el botón
   *  dice «Ver todas», lo que tiene que pasar al pulsarlo es que se vean todas. */
  function verTodas() {
    busqueda = '';
    buscador.value = '';
    ctx.limpiarFiltro?.();
    repintar();
  }

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

    /* Las listas que se agrupan no se reordenan a mano, y no es una limitación:
       el sitio pinta el programa por día y hora, así que el orden del array no
       llega a ninguna parte. Un asa con las dos flechas apagadas y un número de
       posición que va saltando —03, 17, 22 dentro del mismo jueves— sería
       ofrecer algo que no hace nada y encima leerse como un error. */
    const sinAsa = Boolean(tabla.esquema.porDia);

    const propias = tabla.esquema.clase?.(dato, preparado) ?? '';
    const nodo = el('article', {
      class: ['fila', abierta ? 'abierta' : '', sinAsa ? 'fila--sin-asa' : '', propias]
        .filter(Boolean).join(' '),
      'data-i': String(i),
    });

    // Filtrando, el orden de la pantalla no es el de la lista: arrastrar la
    // tercera de cuatro resultados movería la fila 17 al sitio de la 3. Se
    // apaga y se dice, en vez de dejar que reordene mal.
    const bloqueado = filtrando() || sinAsa;

    const asa = sinAsa ? null : el('div', {
      class: 'asa',
      title: bloqueado ? 'Para reordenar, vacía la búsqueda' : 'Arrastra para reordenar',
    },
      el('button', { type: 'button', class: 'mover', title: 'Subir', disabled: bloqueado || i === 0,
        onclick: () => mover(i, i - 1) }, '▲'),
      el('span', { class: 'puntos' }, '⠿'),
      el('span', { class: 'num' }, String(i + 1).padStart(2, '0')),
      el('button', { type: 'button', class: 'mover', title: 'Bajar', disabled: bloqueado || i === lista().length - 1,
        onclick: () => mover(i, i + 1) }, '▼'),
    );

    if (!bloqueado && asa) {
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
    //
    // Dos formas. Casi todas las colecciones son listas de nombres y les basta
    // «título · nota». El programa no: cuarenta actividades con día, hora,
    // sede, tipo, con qué se encima y si llevan cartela no caben en un renglón
    // de texto, así que su esquema trae un `bloque()`. Lo que no cambia es que
    // esto ES el botón que pliega y despliega — por eso el bloque no puede
    // traer nada que se pulse, y los mandos van fuera, en `extras()`.
    const contenido = (): (Node | string)[] =>
      tabla.esquema.bloque
        ? tabla.esquema.bloque(dato, preparado)
        : [el('span', { class: 'resumen-texto' },
            el('strong', {}, tabla.esquema.titula(dato, i)),
            el('span', { class: 'resumen-nota' }, tabla.esquema.resume?.(dato, ctx.dias()) ?? ''),
          )];

    const signo = el('span', { class: 'resumen-signo', 'aria-hidden': 'true' }, abierta ? '−' : '+');
    const resumen = el('button', {
      type: 'button',
      class: 'resumen' + (tabla.esquema.bloque ? ' resumen--bloque' : ''),
      'aria-expanded': String(abierta),
      'aria-label': tabla.esquema.titula(dato, i),
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
    }, signo, ...contenido());

    /** El renglón plegado es el nombre de la fila: si dice «Sin título»
     *  mientras escribes el título dos centímetros más abajo, deja de ser el
     *  nombre de nada. Se refresca al vuelo.
     *
     *  El bloque se rehace entero en vez de retocar dos nodos: es hora, tipo,
     *  sede y choques, y cualquiera de ellos puede haber cambiado con la tecla
     *  que se acaba de pulsar. */
    const refrescarResumen = () => {
      // Se recalcula lo de `preparar()` antes de repintar el renglón. Sin esto,
      // cambiar la hora de algo se miraba contra los choques de hace un rato:
      // corriges un solape y el aviso rojo sigue ahí, o te lo creas y no está.
      // Y justo al tocar una hora es cuando hay que mirarlo.
      preparado = tabla.esquema.preparar?.(lista());
      vaciar(resumen);
      resumen.setAttribute('aria-label', tabla.esquema.titula(dato, i));
      resumen.append(signo, ...contenido());
      nodo.className = ['fila', abiertas.has(dato) ? 'abierta' : '', sinAsa ? 'fila--sin-asa' : '',
        tabla.esquema.clase?.(dato, preparado) ?? ''].filter(Boolean).join(' ');
    };

    /** Cambiar el día de una actividad la manda a otro grupo, y hasta que no se
     *  repinta se queda debajo de la cabecera equivocada — diciendo «Viernes»
     *  dentro del jueves. Se repinta entero sólo en ese caso: es un
     *  desplegable, así que nadie está a media palabra cuando pasa. */
    const diaPintado = dato.dia;
    const ctxFila: Ctx = {
      ...ctx,
      cambiado: () => {
        if (tabla.esquema.porDia && dato.dia !== diaPintado) { repintar(); ctx.cambiado(); return; }
        refrescarResumen();
        ctx.cambiado();
      },
    };

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

    // Los mandos propios de la fila —hoy sólo el texto de sala del programa—
    // van al lado del botón y no dentro: un botón dentro de otro botón no es
    // HTML, y además pulsar «Cartela» no puede plegar la fila de paso.
    const extras = tabla.esquema.extras?.(dato, ctx) ?? null;
    const linea = extras
      ? el('div', { class: 'resumen-linea' }, resumen, extras)
      : resumen;

    if (asa) nodo.append(asa);
    nodo.append(el('div', { class: 'columna' }, linea, dentro));
    return nodo;
  }

  function limpiarMarcas() {
    cuerpo.querySelectorAll('.destino').forEach((n) => n.classList.remove('destino'));
  }

  /**
   * Las filas repartidas en los cuatro días, y dentro de cada día por la hora.
   *
   * **Aquí el orden de la pantalla no es el del array, y da igual**: el sitio
   * ordena el programa por día y hora —`agendaPorDia` en `site.ts`— así que el
   * orden en que estén guardadas las actividades no viaja a ningún sitio. Por
   * eso esta tabla no deja arrastrar (ver `bloqueado`): no habría nada que
   * reordenar, sólo una forma de creer que sí.
   *
   * En las otras cuatro colecciones el orden SÍ es el que se pinta —las sedes
   * como nos las pasaron, el archivo de lo más reciente a lo más viejo— y por
   * eso allí se arrastra y aquí no.
   */
  function porDias(aLaVista: { dato: any; i: number }[], todas: any[]) {
    const dias = ctx.dias();
    const hora = (x: any) => String(x?.inicio ?? '');

    dias.forEach((nombre, d) => {
      const delDia = aLaVista
        .filter(({ dato }) => Number(dato.dia) === d)
        .sort((x, y) => hora(x.dato).localeCompare(hora(y.dato)));
      const todasDelDia = todas.filter((x: any) => Number(x.dia) === d);

      const nota = tabla.esquema.notaGrupo?.(todasDelDia, preparado) ?? '';
      const seccion = el('section', { class: 'dia-bloque' });

      seccion.append(el('header', { class: 'dia-cabeza' },
        el('span', { class: 'n' }, String(d + 1).padStart(2, '0')),
        el('h4', {}, nombre.split(' ')[0]),
        el('span', { class: 'f' }, nombre.split(' ').slice(1).join(' ')),
        el('span', { class: 'cuenta' },
          todasDelDia.length === 0
            ? 'sin actividades'
            : `${todasDelDia.length} ${todasDelDia.length === 1 ? 'actividad' : 'actividades'}`),
        nota ? el('span', { class: 'dia-nota' }, nota) : null,
      ));

      if (!delDia.length) {
        seccion.append(el('p', { class: 'lista-vacia' },
          todasDelDia.length
            ? `Ninguna de las ${todasDelDia.length} de este día ${porQueNoSeVe()}.`
            : 'Este día está vacío.'));
      } else {
        const caja = el('div', { class: 'filas-dia' });
        for (const { dato, i } of delDia) caja.append(fila(dato, i));
        seccion.append(caja);
      }

      cuerpo.append(seccion);
    });
  }

  function repintar() {
    vaciar(cuerpo);
    const l = lista();
    const aLaVista = visibles();
    // Lo que sirve para todas las filas, calculado una vez. El programa mira
    // aquí qué se encima con qué: hacerlo fila por fila sería recorrer las
    // treinta y nueve, treinta y nueve veces.
    preparado = tabla.esquema.preparar?.(l);

    if (!l.length) {
      // Un solo botón de añadir y no dos: el estado vacío tenía el suyo y
      // debajo, a dos centímetros, otro exactamente igual.
      cuerpo.append(el('div', { class: 'vacio' },
        el('p', {}, `Todavía no hay ${tabla.esquema.plural}. El sitio ya sabe qué enseñar mientras tanto.`),
        el('button', { type: 'button', class: 'boton fuerte', onclick: anadir }, `Añadir ${tabla.esquema.singular}`),
      ));
    } else if (!aLaVista.length) {
      cuerpo.append(el('div', { class: 'vacio' },
        el('p', {}, `Ninguna de las ${l.length} ${tabla.esquema.plural} ${porQueNoSeVe()}.`),
        el('button', { type: 'button', class: 'boton', onclick: verTodas }, 'Ver todas'),
      ));
    } else if (tabla.esquema.porDia) {
      porDias(aLaVista, l);
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
    // Una fila nueva que sale filtrada es una fila que no aparece: se quitan
    // los dos filtros antes de añadirla, que es menos raro que buscarla. El de
    // fuera también —«Sólo con texto de sala» esconde a la recién nacida por
    // definición, porque todavía no tiene texto ninguno—.
    busqueda = ''; buscador.value = '';
    ctx.limpiarFiltro?.();
    tabla.escribir(estado, l);
    repintar();
    ctx.cambiado();
    // Llevar la vista hasta ella evita el «no pasó nada» cuando la lista es
    // larga. Se busca por su índice y no por «el último hijo del cuerpo»: con
    // las filas agrupadas por día, el último hijo es la sección del domingo y
    // la actividad nueva nace en el jueves.
    const nodo = cuerpo.querySelector(`.fila[data-i="${l.length - 1}"]`);
    nodo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (nodo?.querySelector('input, select, textarea') as HTMLElement)?.focus();
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

  // La fila pedida se enseña cuando ya está en la página. `pintarLienzo()`
  // engancha esto al DOM justo después de volver de aquí, así que el turno
  // siguiente del bucle de eventos es el primer momento en que se puede medir.
  if (pedida) {
    setTimeout(() => {
      const i = lista().indexOf(pedida);
      cuerpo.querySelector(`.fila[data-i="${i}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }

  return seccion;
}
