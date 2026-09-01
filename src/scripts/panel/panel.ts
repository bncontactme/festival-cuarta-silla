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
  cambiado: () => { estadoBarras(); },
  avisar: (m: string, c?: 'error' | 'ojo' | 'bien') => avisar(m, c ?? 'ojo'),
};

function pintar() {
  pintarPestanas();
  pintarLienzo();
  estadoBarras();
}

function pintarPestanas() {
  const barra = $('#pestanas');
  vaciar(barra);
  for (const p of PESTANAS) {
    const cuantos = p.tablas.reduce((n, t) => n + TABLAS[t].leer(estado).length, 0);
    const cols = new Set(p.tablas.map((t) => TABLAS[t].coleccion));
    const boton = el('button', {
      type: 'button', role: 'tab',
      'aria-selected': String(p.clave === pestanaActiva),
      class: [...cols].some(sucia) ? 'sucia' : '',
      onclick: () => { pestanaActiva = p.clave; pintar(); },
    }, p.titulo, el('span', { class: 'cuenta' }, String(cuantos)));
    barra.append(boton);
  }
}

function pintarLienzo() {
  const lienzo = $('#lienzo');
  vaciar(lienzo);
  const p = PESTANAS.find((x) => x.clave === pestanaActiva)!;

  if (p.clave === 'programa') {
    lienzo.append(interruptorEjemplo());
    lienzo.append(pintarPrevia(estado.programa.actividades, DIAS));
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
          ? 'Mientras esté marcado, el sitio no enseña el programa: ni aquí ni en la portada. En su lugar sale el cartel de «Próximamente». Desmárcalo cuando la rejilla ya sea la buena — eso la publica.'
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
    const cols = new Set(PESTANAS[i].tablas.map((t) => TABLAS[t].coleccion));
    nodo.classList.toggle('sucia', [...cols].some(sucia));
    const cuenta = nodo.querySelector('.cuenta');
    if (cuenta) {
      cuenta.textContent = String(
        PESTANAS[i].tablas.reduce((n, t) => n + TABLAS[t].leer(estado).length, 0),
      );
    }
  });
}

// ── Guardar ──────────────────────────────────────────────────────────────────

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
  erroresPorColeccion = {};

  for (const c of orden) {
    try {
      const r: any = await pedir('guardar', { coleccion: c, datos: estado[c] });
      limpio[c] = JSON.stringify(estado[c]);
      meta = { version: r.version, actualizado: r.actualizado, ultimoDeploy: r.ultimoDeploy ?? meta.ultimoDeploy };
      if (r.avisos?.length) avisos.push(...r.avisos);
      if (r.despliegue) despliegue = r.despliegue;
    } catch (e: any) {
      const err = e as ErrorPanel;
      erroresPorColeccion[c] = err.errores ?? [];
      avisar(
        err.errores?.length
          ? 'Nada de esta sección se guardó. Lo que falta está marcado en rojo abajo.'
          : err.message,
        'error',
        `No se guardó «${c}»`,
        err.errores ?? [],
      );
      // Se corta aquí: si las sedes no entraron, seguir con el programa sólo
      // produce una segunda tanda de quejas sobre lo mismo.
      break;
    }
  }

  guardando = false;
  pintar();

  if (avisos.length) {
    avisar('Se guardó, pero hay cosas que mirar:', 'ojo', 'Ojo', avisos);
  }
  if (!Object.keys(erroresPorColeccion).length) {
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
