/**
 * El panel. Arranca aquí.
 *
 * Cómo funciona, en corto: se baja el contenido del Worker una vez, se edita
 * un objeto en memoria, y al guardar se manda de vuelta SÓLO lo que cambió.
 * Nada se guarda solo: en un panel que edita lo que ve el público, el guardado
 * automático es una forma elegante de publicar un error a medio escribir.
 */
import { PESTANAS, TABLAS } from './esquema';
import { pintarTabla } from './tabla';
import { pintarPrevia } from './previa';
import { pintarRegistro } from './registro';
import { el, vaciar, cuando } from './dom';
import {
  pedir, leerContenido, ponerClave, olvidarClave, recordada, ErrorPanel,
} from './api';

// ── Lo que el sitio le pasa al panel ─────────────────────────────────────────
// Los cuatro días con su fecha salen de `programa.dias` en `site.ts`, que es
// texto del sitio y no contenido del panel. Viajan en un <script> de la página
// en vez de estar escritos otra vez aquí.
const config = JSON.parse(document.getElementById('panel-config')!.textContent || '{}');
const DIAS: string[] = config.dias ?? ['Día 1', 'Día 2', 'Día 3', 'Día 4'];

const COLECCIONES = ['sedes', 'programa', 'artistas', 'archivo', 'marcas'] as const;
type Coleccion = (typeof COLECCIONES)[number];

// ── Estado ───────────────────────────────────────────────────────────────────

let estado: any = null;
/** Copia de lo último confirmado por el Worker, para saber qué cambió. */
let limpio: Record<string, string> = {};
let meta: { version: number; actualizado: string | null; ultimoDeploy?: string | null } =
  { version: 0, actualizado: null };
let pestanaActiva = PESTANAS[0].clave;
let erroresPorColeccion: Record<string, string[]> = {};
let guardando = false;

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

const sucia = (c: string) => estado && JSON.stringify(estado[c]) !== limpio[c];
const haySucias = () => COLECCIONES.some(sucia);

// ── Avisos ───────────────────────────────────────────────────────────────────

function avisar(mensaje: string, clase: 'error' | 'ojo' | 'bien' = 'ojo', titulo?: string, detalle: string[] = []) {
  const zona = $('#avisos');
  const nodo = el('div', { class: 'aviso ' + clase, role: clase === 'error' ? 'alert' : 'status' });
  if (titulo) nodo.append(el('h3', {}, titulo));
  nodo.append(el('p', {}, mensaje));
  if (detalle.length) {
    nodo.append(el('ul', {}, ...detalle.slice(0, 30).map((d) => el('li', {}, d))));
    if (detalle.length > 30) nodo.append(el('p', {}, `…y ${detalle.length - 30} más.`));
  }
  nodo.append(el('button', {
    type: 'button', class: 'boton suave', style: 'margin-top:.5rem',
    onclick: () => nodo.remove(),
  }, 'Vale'));
  zona.prepend(nodo);
  if (clase === 'bien') setTimeout(() => nodo.remove(), 6000);
}

// ── Entrar ───────────────────────────────────────────────────────────────────

async function entrar(pass: string) {
  ponerClave(pass);
  const boton = $<HTMLButtonElement>('#entrar-boton');
  boton.disabled = true;
  boton.textContent = 'Comprobando…';
  try {
    meta = await pedir('ping');
    $('#entrada').hidden = true;
    $('#armazon').hidden = false;
    await cargar();
  } catch (e: any) {
    olvidarClave();
    $('#entrada-queja').textContent = e.message || 'No entró';
    $<HTMLInputElement>('#entrada-clave').select();
  } finally {
    boton.disabled = false;
    boton.textContent = 'Entrar';
  }
}

async function cargar() {
  try {
    const datos = await leerContenido();
    estado = datos;
    meta = { version: datos.version, actualizado: datos.actualizado, ultimoDeploy: meta.ultimoDeploy };
    for (const c of COLECCIONES) limpio[c] = JSON.stringify(datos[c]);
    erroresPorColeccion = {};
    pintar();
  } catch (e: any) {
    avisar(e.message || String(e), 'error', 'No se pudo leer el contenido');
  }
}

// ── Pintar ───────────────────────────────────────────────────────────────────

const ctx = {
  sedes: () => (estado?.sedes ?? []).map((s: any) => s.nombre).filter(Boolean),
  dias: () => DIAS,
  cambiado: () => { estadoBarras(); refrescarPrevia(); },
  avisar: (m: string, c?: 'error' | 'ojo' | 'bien') => avisar(m, c ?? 'ojo'),
  irA: (clave: string) => { pestanaActiva = clave; pintar(); window.scrollTo({ top: 0 }); },
};

/** Qué colecciones toca una pestaña, para el punto de «sin guardar». */
const colecciones = (p: (typeof PESTANAS)[number]): string[] =>
  p.colecciones ?? [...new Set(p.tablas.map((t) => TABLAS[t].coleccion))];

const cuentaDe = (p: (typeof PESTANAS)[number]): string =>
  p.cuenta ? p.cuenta(estado)
           : String(p.tablas.reduce((n, t) => n + TABLAS[t].leer(estado).length, 0));

function pintar() {
  pintarPestanas();
  pintarLienzo();
  estadoBarras();
}

function pintarPestanas() {
  const barra = $('#pestanas');
  vaciar(barra);
  for (const p of PESTANAS) {
    const boton = el('button', {
      type: 'button', role: 'tab',
      'aria-selected': String(p.clave === pestanaActiva),
      class: colecciones(p).some(sucia) ? 'sucia' : '',
      onclick: () => { pestanaActiva = p.clave; pintar(); },
    }, p.titulo, el('span', { class: 'cuenta' }, cuentaDe(p)));
    barra.append(boton);
  }
}

/**
 * La rejilla en chiquito de la pestaña de Programa.
 *
 * Se guarda aparte para poder cambiarla sola. Antes se pintaba una vez con el
 * lienzo y no se volvía a tocar: se editaba una hora y la previa seguía
 * enseñando la de antes hasta que cambiabas de pestaña y volvías. Eso vacía la
 * pestaña de sentido — está ahí para ver si algo se encima ANTES de guardar, y
 * lo que enseñaba era el estado anterior.
 */
let nodoPrevia: HTMLElement | null = null;
let previaPedida: ReturnType<typeof setTimeout> | null = null;

function refrescarPrevia() {
  if (!nodoPrevia || pestanaActiva !== 'programa') return;
  // Se llama en cada tecla. Rehacer cuarenta barras por letra escrita es
  // trabajo tirado, así que se juntan las que caigan seguidas.
  //
  // Con `requestAnimationFrame` no: en una pestaña de fondo no corre, y esto
  // tiene que quedar al día aunque nadie esté mirando —se mira al volver—.
  if (previaPedida) clearTimeout(previaPedida);
  previaPedida = setTimeout(() => {
    previaPedida = null;
    if (!nodoPrevia || pestanaActiva !== 'programa') return;
    const nueva = pintarPrevia(estado.programa.actividades, DIAS);
    nodoPrevia.replaceWith(nueva);
    nodoPrevia = nueva;
  }, 120);
}

function pintarLienzo() {
  const lienzo = $('#lienzo');
  vaciar(lienzo);
  nodoPrevia = null;
  const p = PESTANAS.find((x) => x.clave === pestanaActiva)!;

  if (p.clave === 'programa') {
    lienzo.append(interruptorEjemplo());
    nodoPrevia = pintarPrevia(estado.programa.actividades, DIAS);
    lienzo.append(nodoPrevia);
  }
  if (p.clave === 'registro') {
    lienzo.append(pintarRegistro(estado, ctx, DIAS));
  }
  for (const t of p.tablas) {
    const tabla = TABLAS[t];
    lienzo.append(pintarTabla(tabla, estado, ctx, erroresPorColeccion[tabla.coleccion] ?? []));
  }
}

/**
 * «Esto todavía es la rejilla de ejemplo». Es el botón de publicar.
 *
 * Vive aquí y no en una fila porque no es de una actividad: es de la rejilla
 * entera. Mientras esté marcado, el sitio **no enseña el programa** — ni en
 * /programa ni en la portada: sale el cartel de «Próximamente». Al desmarcarlo
 * se publica entero.
 *
 * Es lo único del panel que no es contenido sino una declaración, y por eso se
 * pregunta en vez de deducirse: quien está mirando la rejilla es el único que
 * sabe si eso de ahí ya es el programa.
 */
function interruptorEjemplo() {
  const marcado = estado.programa.esEjemplo !== false;
  const casilla = el('input', {
    type: 'checkbox', checked: marcado, id: 'es-ejemplo',
    style: 'width:auto;margin-right:.5rem',
    onchange: (e: any) => {
      estado.programa.esEjemplo = e.target.checked;
      pintarLienzo();
      estadoBarras();
    },
  });
  // Desmarcado y sin una sola actividad es la combinación que no quiere nadie:
  // el sitio publica el conmutador de vistas sobre una rejilla vacía. Pasa al
  // vaciar el programa para meter el de verdad, que es un momento normal — por
  // eso se avisa fuerte en vez de prohibirlo.
  const vacio = !estado.programa.actividades.length;
  const peligro = !marcado && vacio;

  return el('div', { class: 'aviso ' + (peligro ? 'error' : marcado ? 'ojo' : 'bien') },
    el('label', { for: 'es-ejemplo', style: 'display:flex;align-items:flex-start;cursor:pointer' },
      casilla,
      el('span', {},
        el('strong', {}, 'Esto todavía es la rejilla de ejemplo.'),
        ' ',
        marcado
          ? 'Mientras esté marcado, el sitio no enseña el programa: ni aquí, ni en la portada, ni en /registro —que son estos mismos eventos—. En su lugar sale el cartel de «Próximamente». Desmárcalo cuando la rejilla ya sea la buena: eso la publica, y deja que el registro se pueda abrir.'
          : peligro
            ? 'Está desmarcado y no hay ni una actividad: si guardas así, el sitio publica el programa VACÍO — la rejilla sin nada dentro. Vuelve a marcarlo mientras cargas el programa de verdad; con él marcado sale el cartel de «Próximamente».'
            : 'El programa está publicado: el sitio lo enseña entero. Vuelve a marcarlo si todavía es un andamio y prefieres esconderlo.',
      ),
    ),
  );
}

function estadoBarras() {
  const n = COLECCIONES.filter(sucia).length;
  $('#guardar-boton').toggleAttribute('disabled', n === 0 || guardando);
  $('#estado-cambios').textContent = guardando
    ? 'guardando…'
    : n === 0
      ? 'todo guardado'
      : `${n} ${n === 1 ? 'sección' : 'secciones'} sin guardar`;
  $('#estado-version').textContent =
    `versión ${meta.version} · guardado ${cuando(meta.actualizado)}` +
    (meta.ultimoDeploy ? ` · publicado ${cuando(meta.ultimoDeploy)}` : '');
  // Refresca el punto rojo y la cuenta de las pestañas sin repintar el
  // formulario, que borraría lo que se está escribiendo.
  //
  // La cuenta hay que tocarla aquí y no en `pintarPestanas()`: añadir o borrar
  // una fila no repinta la barra, así que si no, la pestaña seguía diciendo 19
  // con la tabla ya vacía. Dos números distintos para lo mismo en la misma
  // pantalla es peor que no poner ninguno: parece que se perdió algo.
  [...$('#pestanas').children].forEach((nodo, i) => {
    nodo.classList.toggle('sucia', colecciones(PESTANAS[i]).some(sucia));
    const cuenta = nodo.querySelector('.cuenta');
    if (cuenta) cuenta.textContent = cuentaDe(PESTANAS[i]);
  });
}

// ── Guardar ──────────────────────────────────────────────────────────────────

/**
 * En qué pestaña se ve una colección.
 *
 * `marcas` sale en dos tablas de la misma pestaña y `programa` en dos pestañas
 * —Programa y Registro—; las marcas rojas de una fila las pinta la tabla, así
 * que para el programa la buena es siempre Programa.
 */
function pestanaDe(coleccion: string, clave = false): string {
  const p = PESTANAS.find((x) => x.tablas.some((t) => TABLAS[t].coleccion === coleccion));
  return p ? (clave ? p.clave : p.titulo) : coleccion;
}

/** Lleva la vista a la primera casilla en rojo. Un listado de quejas arriba
 *  dice cuántas hay; lo que las arregla es ver cuál de las cuarenta filas. */
function aLaPrimeraMala() {
  const mala = document.querySelector('.campo.malo, .fila.mala');
  mala?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  (mala?.querySelector('input, select, textarea') as HTMLElement)?.focus();
}

async function guardar() {
  if (guardando || !haySucias()) return;
  guardando = true;
  estadoBarras();

  // Las sedes van primero siempre. Si alguien renombró una sede Y cambió el
  // programa para que apunte al nombre nuevo, guardar al revés haría que el
  // programa se validara contra los nombres viejos y lo rechazara entero.
  const orden = (['sedes', ...COLECCIONES.filter((c) => c !== 'sedes')] as Coleccion[])
    .filter(sucia);

  const avisos: string[] = [];
  let despliegue: any = null;
  /** Un 409 no deja errores de contenido que marcar, así que sin esto el
   *  «Guardado.» del final salía igual — encima del aviso que decía que no. */
  let choque = false;
  erroresPorColeccion = {};

  for (const c of orden) {
    try {
      // La versión viaja para que el Worker pueda decir «alguien guardó en
      // medio» en vez de dejar que uno pise al otro sin enterarse.
      const r: any = await pedir('guardar', { coleccion: c, datos: estado[c], version: meta.version });
      limpio[c] = JSON.stringify(estado[c]);
      meta = { version: r.version, actualizado: r.actualizado, ultimoDeploy: r.ultimoDeploy ?? meta.ultimoDeploy };
      if (r.avisos?.length) avisos.push(...r.avisos);
      if (r.despliegue) despliegue = r.despliegue;
    } catch (e: any) {
      const err = e as ErrorPanel;

      // ── Alguien más guardó ─────────────────────────────────────────────
      // No es un dato malo: es que hay otra pestaña abierta con el panel. No
      // se pierde nada de lo escrito —sigue en pantalla— pero hay que mirar
      // qué cambió antes de volver a mandarlo encima.
      if (err.estado === 409) {
        avisar(
          err.message + ' Lo que escribiste sigue aquí. Abre el sitio o recarga en otra pestaña para ver qué cambió; ' +
          'si tu versión es la buena, vuelve a darle a Guardar y esta vez entra.',
          'error', 'Alguien más guardó',
        );
        // Se sube al día para que el siguiente intento no vuelva a chocar: el
        // aviso ya se dio, y repetirlo en bucle no ayuda a nadie.
        meta.version = err.conflicto?.actual ?? meta.version;
        choque = true;
        break;
      }

      erroresPorColeccion[c] = err.errores ?? [];
      avisar(
        err.errores?.length
          ? `Nada de esta sección se guardó. Te dejo en «${pestanaDe(c)}» con lo que falta marcado en rojo.`
          : err.message,
        'error',
        `No se guardó «${c}»`,
        err.errores ?? [],
      );
      // La queja dice «marcado en rojo» y las marcas viven en la pestaña de esa
      // colección: si el fallo es del programa y estabas en Sedes, el aviso
      // señalaba a una pantalla en la que no hay nada rojo que ver. Se va a
      // donde está el problema.
      if (err.errores?.length) pestanaActiva = pestanaDe(c, true);
      // Se corta aquí: si las sedes no entraron, seguir con el programa sólo
      // produce una segunda tanda de quejas sobre lo mismo.
      break;
    }
  }

  guardando = false;
  pintar();
  if (Object.keys(erroresPorColeccion).length) aLaPrimeraMala();

  if (avisos.length) {
    avisar('Se guardó, pero hay cosas que mirar:', 'ojo', 'Ojo', avisos);
  }
  if (!choque && !Object.keys(erroresPorColeccion).length) {
    avisar(
      despliegue?.disparado
        ? 'Guardado. El sitio se está reconstruyendo: tarda un minuto y medio en verse.'
        : despliegue?.motivo === 'freno'
          ? `Guardado. Ya hay una publicación en camino; la siguiente se puede lanzar en ${despliegue.faltan} s.`
          : despliegue?.motivo === 'sin-hook'
            ? 'Guardado. Todavía no hay despliegue automático configurado: el sitio se actualizará en el siguiente build.'
            : 'Guardado.',
      'bien',
    );
  }
}

async function publicar() {
  // Publicar sube lo que hay GUARDADO, no lo que hay en pantalla. Decir
  // «el contenido está guardado» con cambios sin guardar encima es mentir, y
  // es justo el momento en que alguien cierra la pestaña tranquilo.
  if (haySucias()) {
    avisar(
      'Publicar sube lo último GUARDADO, y tienes cambios sin guardar: no entrarían. Guarda primero.',
      'ojo', 'Ojo antes de publicar',
    );
    return;
  }

  const boton = $<HTMLButtonElement>('#publicar-boton');
  boton.disabled = true;
  try {
    const r: any = await pedir('publicar');
    if (r.ok) {
      meta.ultimoDeploy = r.ultimoDeploy;
      avisar('Se lanzó la publicación. En un minuto y medio el sitio ya la trae.', 'bien');
    } else {
      avisar(r.mensaje || `No se pudo publicar (${r.motivo}).`, 'ojo');
    }
  } catch (e: any) {
    avisar(e.message || String(e), 'error');
  } finally {
    boton.disabled = false;
    estadoBarras();
  }
}

// ── Historial ────────────────────────────────────────────────────────────────

async function historial() {
  let versiones: any[] = [];
  try {
    const r: any = await pedir('historial');
    versiones = r.versiones ?? [];
  } catch (e: any) {
    avisar(e.message || String(e), 'error');
    return;
  }

  const fondo = el('div', { class: 'panelillo', onclick: (e: any) => { if (e.target === fondo) fondo.remove(); } });
  const tabla = el('table', {},
    el('thead', {}, el('tr', {},
      el('th', {}, 'Versión'), el('th', {}, 'Cuándo'), el('th', {}, 'Qué había'), el('th', {}))),
  );
  const cuerpo = el('tbody');
  for (const v of versiones) {
    cuerpo.append(el('tr', {},
      el('td', {}, String(v.version)),
      el('td', {}, cuando(v.actualizado)),
      el('td', {}, `${v.cuenta.sedes} sedes · ${v.cuenta.programa} act. · ${v.cuenta.artistas} art. · ${v.cuenta.archivo} ed. · ${v.cuenta.marcas} marcas`),
      el('td', {}, el('button', {
        type: 'button', class: 'boton suave',
        onclick: async () => {
          if (!confirm(`¿Volver a la versión ${v.version}?\n\nSe queda como estaba entonces TODO: sedes, programa, artistas, archivo y marcas. Y esto también se puede deshacer.`)) return;
          try {
            await pedir('restaurar', { version: v.version });
            fondo.remove();
            await cargar();
            avisar(`Se volvió a la versión ${v.version}.`, 'bien');
          } catch (e: any) { avisar(e.message || String(e), 'error'); }
        },
      }, 'Volver aquí')),
    ));
  }
  tabla.append(cuerpo);

  fondo.append(el('div', {},
    el('h3', {}, 'Historial'),
    el('p', { style: 'font-size:.8rem;opacity:.7;margin-bottom:.6rem' },
      'Cada guardado deja una copia de todo. Se conservan las últimas veinte. Volver a una es otro guardado, así que también se deshace.'),
    versiones.length ? tabla : el('p', {}, 'Todavía no hay historial: no se ha guardado nunca desde el panel.'),
    el('div', { style: 'margin-top:.8rem;text-align:right' },
      el('button', { type: 'button', class: 'boton', onclick: () => fondo.remove() }, 'Cerrar')),
  ));
  document.body.append(fondo);
}

// ── Cableado ─────────────────────────────────────────────────────────────────

$('#entrada-forma').addEventListener('submit', (e) => {
  e.preventDefault();
  $('#entrada-queja').textContent = '';
  entrar($<HTMLInputElement>('#entrada-clave').value);
});

$('#guardar-boton').addEventListener('click', guardar);
$('#publicar-boton').addEventListener('click', publicar);
$('#historial-boton').addEventListener('click', historial);
$('#recargar-boton').addEventListener('click', async () => {
  if (haySucias() && !confirm('Hay cambios sin guardar. Si recargas, se pierden. ¿Seguir?')) return;
  await cargar();
});
$('#salir-boton').addEventListener('click', () => {
  if (haySucias() && !confirm('Hay cambios sin guardar. ¿Salir de todas formas?')) return;
  olvidarClave();
  location.reload();
});

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); guardar(); }
});

// Lo que se escribió y no se guardó no se pierde por un clic mal dado.
addEventListener('beforeunload', (e) => {
  if (haySucias()) { e.preventDefault(); e.returnValue = ''; }
});

// La barra de estado dice «hace 3 min» y eso envejece solo.
setInterval(() => { if (estado) estadoBarras(); }, 30_000);

// Si la sesión sigue viva —la pestaña no se cerró—, no se vuelve a preguntar.
const guardadaEnSesion = recordada();
if (guardadaEnSesion) {
  entrar(guardadaEnSesion);
} else {
  $<HTMLInputElement>('#entrada-clave').focus();
}
