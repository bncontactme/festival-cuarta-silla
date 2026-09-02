// Worker — cuartasilla-panel
//
// El contenido del festival: sedes, programa, artistas, archivo y marcas.
// Vive en KV, lo edita `/admin` y lo lee el build de Astro.
//
// Hermano del `archivo-upload` de Guadalajara de Noche, y a propósito: es el
// mismo esquema (contraseña con hash, bloqueo por intentos, firmas de
// Cloudinary que nunca sueltan la llave) porque ahí lleva meses aguantando.
// Las diferencias son dos: aquí sólo hay una contraseña —no hay comunidad
// mandando material, hay un comité que edita— y aquí lo que se guarda es
// contenido estructurado, no texto libre, así que se valida antes de entrar.
//
// Rutas públicas (GET, abiertas a cualquier origen — sirven al sitio):
//   GET /contenido               las cinco colecciones, en un viaje
//   GET /contenido/<coleccion>   una sola
//
// Rutas de admin (POST JSON, origen en lista blanca, contraseña):
//   ping          probar la contraseña
//   guardar       { coleccion, datos }         valida, guarda, versiona, publica
//   firmar        { carpeta, content_type }    firma una subida a Cloudinary
//   medios        { carpeta }                  lo que ya está subido
//   borrar-medio  { public_id }                sólo dentro de cuartasilla/
//   publicar      dispara el rebuild a mano
//   historial     las últimas 20 versiones
//   restaurar     { version }                  vuelve atrás
//
// Cinco contraseñas falladas dejan a esa IP fuera 15 minutos (KV: fail:<ip>).
//
// Desplegar:  npx wrangler deploy      (desde workers/panel/)
// Ver el README de esta carpeta para el alta de KV y de los secrets.

import {
  COLECCIONES,
  leerTodo, leerColeccion, leerMeta,
  guardarColeccion, podarHistorial, listarHistorial, restaurar,
  puedeDisparar, anotarDisparo, FRENO_SEGUNDOS,
} from './lib/contenido.js';
import { validar } from './lib/validar.js';
import { slug } from './lib/slug.js';

const ORIGENES = new Set([
  'https://www.festivaldearteconceptual.com',
  'https://festivaldearteconceptual.com',
  'https://bncontactme.github.io',          // la vista previa de GitHub Pages
]);

/** Cloudflare Pages le da a cada despliegue su propio subdominio
 *  (`a1b2c3.cuartasilla.pages.dev`), así que no se pueden listar uno por uno.
 *  Se acota al proyecto en vez de abrir todo `.pages.dev`: si el proyecto de
 *  Pages acaba llamándose de otra forma, se cambia el nombre aquí. */
const PAGES = /^https:\/\/([a-z0-9-]+\.)?cuartasilla\.pages\.dev$/;

/** Todo lo del festival cuelga de aquí dentro de Cloudinary. La cuenta es la
 *  misma de GDN: este prefijo es lo único que separa los dos archivos, y es lo
 *  que impide que la contraseña de este panel borre fotos del otro. */
const RAIZ = 'cuartasilla';

/** Dónde se puede subir. Cualquier otra carpeta se rechaza: sin esto, el panel
 *  firma subidas a donde le pidan y deja de ser un panel para ser un disco
 *  duro abierto. */
const CARPETAS = /^(artistas|marcas|sedes|archivo\/\d{4})$/;

const MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/avif']);

/** Un guardado son unos pocos KB. Un megabyte ya es alguien probando cosas. */
const CUERPO_MAX = 1_000_000;

export default {
  async fetch(request, env, ctx) {
    const origen = request.headers.get('Origin') || '';
    const permitido =
      ORIGENES.has(origen) ||
      PAGES.test(origen) ||
      origen.startsWith('http://localhost') ||
      origen.startsWith('http://127.0.0.1');
    const cors = permitido ? origen : 'https://www.festivaldearteconceptual.com';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cabecerasCors(cors) });
    }

    // ── Lectura pública ───────────────────────────────────────────────────────
    // Abierta a cualquier origen: es lo que consume el build del sitio, y un
    // build corre desde donde sea. No hay nada secreto en el contenido — es
    // exactamente lo que se va a publicar.
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const partes = url.pathname.split('/').filter(Boolean);

      if (partes[0] === 'contenido' && partes.length === 1) {
        return json(await leerTodo(env), 200, '*', { cache: 30 });
      }
      if (partes[0] === 'contenido' && COLECCIONES[partes[1]]) {
        return json(await leerColeccion(env, partes[1]), 200, '*', { cache: 30 });
      }
      return new Response('Not Found', { status: 404 });
    }

    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    if (!permitido) return new Response('Forbidden', { status: 403 });

    if (Number(request.headers.get('Content-Length') || 0) > CUERPO_MAX) {
      return json({ error: 'El envío es demasiado grande' }, 413, cors);
    }

    let cuerpo;
    try {
      cuerpo = await request.json();
    } catch {
      return json({ error: 'JSON inválido' }, 400, cors);
    }

    // ── Contraseña ────────────────────────────────────────────────────────────
    // Antes de comparar nada: si esta IP ya falló demasiado, ni se le escucha.
    // Sin esto, adivinar una contraseña es dejar un script corriendo.
    const ip = request.headers.get('CF-Connecting-IP') || 'sin-ip';
    if (await bloqueada(env, ip)) {
      return json({ error: 'Demasiados intentos fallidos. Espera unos minutos.' }, 429, cors);
    }
    const hash = await sha256(String(cuerpo.password || ''));
    if (!env.ADMIN_HASH || hash !== env.ADMIN_HASH) {
      await anotarFallo(env, ip);
      return json({ error: 'Contraseña incorrecta' }, 401, cors);
    }
    await limpiarFallos(env, ip);

    try {
      switch (cuerpo.accion) {
        case 'ping':         return json({ ok: true, ...(await leerMeta(env)) }, 200, cors);
        case 'guardar':      return await guardar(cuerpo, env, ctx, cors);
        case 'firmar':       return await firmar(cuerpo, env, cors);
        case 'medios':       return await medios(cuerpo, env, cors);
        case 'borrar-medio': return await borrarMedio(cuerpo, env, cors);
        case 'publicar':     return await publicar(env, cors, true);
        case 'estado-build': return await estadoBuild(env, cors);
        case 'historial':    return json({ ok: true, versiones: await listarHistorial(env) }, 200, cors);
        case 'restaurar':    return await volver(cuerpo, env, ctx, cors);
        default:             return json({ error: 'No sé hacer «' + cuerpo.accion + '»' }, 400, cors);
      }
    } catch (e) {
      console.error('panel:', e);
      return json({ error: String(e.message || e) }, 500, cors);
    }
  },

  // Respaldo semanal a Cloudinary (ver [triggers] en wrangler.toml). Es la
  // tercera copia: KV, el JSON comiteado en el repo, y esto.
  async scheduled(evento, env, ctx) {
    ctx.waitUntil(
      respaldar(env)
        .then(r => console.log('Respaldo semanal: versión ' + r.version))
        .catch(e => console.error('El respaldo semanal falló:', e)),
    );
  },
};

// ── Guardar ───────────────────────────────────────────────────────────────────

async function guardar(cuerpo, env, ctx, cors) {
  const nombre = String(cuerpo.coleccion || '');
  if (!COLECCIONES[nombre]) {
    return json({ error: 'No existe la colección «' + nombre + '»' }, 400, cors);
  }

  // ── Que no se pisen ───────────────────────────────────────────────────────
  //
  // Guardar era un `put` a secas: el último que le daba borraba lo del otro sin
  // que ninguno de los dos se enterara. Con un comité editando y la semana del
  // festival por delante —dos personas con el panel abierto en dos sedes es el
  // caso normal, no el raro— eso es perder trabajo en silencio.
  //
  // El panel manda la versión que tenía al cargar. Si en KV hay otra, alguien
  // guardó en medio: se contesta 409 y el panel ofrece recargar. Sin versión no
  // se comprueba nada, y eso es a propósito: `semilla.mjs` pisa el panel a
  // sabiendas, que es justo lo que se le pide.
  const vista = cuerpo.version;
  if (Number.isFinite(vista)) {
    const { version } = await leerMeta(env);
    if ((version || 0) !== vista) {
      return json({
        error: 'Alguien más guardó mientras editabas (ibas por la versión ' + vista +
               ' y ya va la ' + version + '). No se guardó nada para no pisarle el trabajo.',
        conflicto: { tuya: vista, actual: version },
      }, 409, cors);
    }
  }

  // El programa y los artistas nombran sedes, así que hay que tener la lista
  // vigente a mano. Si lo que se está guardando SON las sedes, la lista es la
  // nueva: cambiar el nombre de una sede y sus actividades a la vez tiene que
  // poder hacerse en dos guardados, en cualquier orden.
  const sedes = nombre === 'sedes'
    ? (Array.isArray(cuerpo.datos) ? cuerpo.datos.map(s => String(s.nombre || '').trim()) : [])
    : (await leerColeccion(env, 'sedes')).map(s => s.nombre);

  const { datos, errores, avisos } = validar(nombre, cuerpo.datos, { sedes });
  if (errores.length) {
    return json({ error: 'No se guardó: hay ' + errores.length + ' cosa(s) que revisar', errores, avisos }, 400, cors);
  }

  // Renombrar una sede deja huérfanas a sus actividades. No se bloquea el
  // guardado —a lo mejor es justo el primer paso de dos— pero se dice, porque
  // en el sitio esas fichas se quedan sin dirección y sin mapa.
  if (nombre === 'sedes') {
    const nombres = datos.map(s => s.nombre);
    const { actividades } = await leerColeccion(env, 'programa');
    const huerfanas = (actividades || []).filter(a => !nombres.includes(a.sede));
    for (const a of huerfanas) {
      avisos.push('programa: «' + a.titulo + '» apunta a «' + a.sede + '», que ya no está en sedes');
    }
  }

  const meta = await guardarColeccion(env, nombre, datos);
  ctx.waitUntil(podarHistorial(env).catch(e => console.error('podar historial:', e)));

  // Guardar y publicar son dos cosas. Ésta ya pasó: lo de KV es inmediato y el
  // panel lo ve al momento. El rebuild se dispara si el freno lo deja.
  const despliegue = await publicarSilencioso(env);

  return json({ ok: true, ...meta, avisos, despliegue }, 200, cors);
}

async function volver(cuerpo, env, ctx, cors) {
  const version = Number(cuerpo.version);
  if (!Number.isFinite(version)) return json({ error: 'Falta la versión' }, 400, cors);
  const meta = await restaurar(env, version);
  if (!meta) return json({ error: 'No existe la versión ' + version }, 404, cors);
  ctx.waitUntil(podarHistorial(env).catch(() => {}));
  return json({ ok: true, ...meta, despliegue: await publicarSilencioso(env) }, 200, cors);
}

// ── Publicar (rebuild) ────────────────────────────────────────────────────────

/** Hay dos maneras de pedir un build y el panel sirve para las dos, porque el
 *  sitio va a cambiar de casa: hoy vive en GitHub Pages —el dominio no pudo
 *  salir de Wix a tiempo para el festival, ver el workflow `publicar.yml`— y el
 *  día que se mueva a Cloudflare Pages basta con poner el otro secret.
 *
 *  GitHub manda: si están sus dos variables, se usa `repository_dispatch`, que
 *  necesita cabeceras y cuerpo. El hook de Cloudflare es un POST pelón. */
function destinoBuild(env) {
  if (env.GITHUB_TOKEN && env.GITHUB_REPO) return 'github';
  if (env.DEPLOY_HOOK) return 'hook';
  return null;
}

/** Dispara el build donde toque. Devuelve `null` si salió bien, o un motivo. */
async function dispararBuild(env) {
  if (destinoBuild(env) === 'github') {
    // El evento tiene que coincidir con el `types:` de `publicar.yml`.
    const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.GITHUB_TOKEN,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        // GitHub rechaza sin User-Agent, y el error que da no lo dice.
        'User-Agent': 'cuartasilla-panel',
      },
      body: JSON.stringify({ event_type: 'publicar' }),
    });
    // Un dispatch aceptado contesta 204 sin cuerpo.
    return res.ok ? null : 'github-' + res.status;
  }
  const res = await fetch(env.DEPLOY_HOOK, { method: 'POST' });
  return res.ok ? null : 'hook-' + res.status;
}

async function publicar(env, cors, aMano) {
  if (!destinoBuild(env)) {
    return json({ ok: false, motivo: 'sin-hook', mensaje: 'Todavía no hay hook de despliegue configurado. El contenido está guardado; el sitio se actualizará en el siguiente build.' }, 200, cors);
  }
  const freno = await puedeDisparar(env);
  if (!freno.ok && !aMano) {
    return json({ ok: false, motivo: 'freno', faltan: freno.faltan }, 200, cors);
  }
  const falló = await dispararBuild(env);
  if (falló) return json({ ok: false, motivo: falló }, 200, cors);
  const meta = await anotarDisparo(env);
  return json({ ok: true, ultimoDeploy: meta.ultimoDeploy }, 200, cors);
}

/** Lo mismo, pero devolviendo el dato en vez de una respuesta: es lo que se
 *  cuelga del resultado de «guardar». Nunca tira: que el rebuild falle no
 *  puede hacer que parezca que no se guardó, porque sí se guardó. */
async function publicarSilencioso(env) {
  try {
    if (!destinoBuild(env)) return { disparado: false, motivo: 'sin-hook' };
    const freno = await puedeDisparar(env);
    if (!freno.ok) return { disparado: false, motivo: 'freno', faltan: freno.faltan, freno: FRENO_SEGUNDOS };
    const falló = await dispararBuild(env);
    if (falló) return { disparado: false, motivo: falló };
    await anotarDisparo(env);
    return { disparado: true };
  } catch (e) {
    return { disparado: false, motivo: String(e.message || e) };
  }
}

/** Cómo TERMINÓ el último intento de publicar.
 *
 *  Hasta aquí el panel sabía sólo cuándo se había DISPARADO un build —eso es
 *  `ultimoDeploy`— y lo enseñaba como «publicado hace 3 min». La noche que la
 *  portada tumbó la construcción, el festival guardó diez veces y diez veces
 *  leyó que sí, con el sitio congelado desde hacía hora y media. Decirle que
 *  algo se publicó sin haberlo comprobado es la peor de las mentiras que puede
 *  contar un panel: la que hace cerrar la pestaña tranquilo.
 *
 *  Así que se le pregunta a quien lo sabe. El repositorio es público y la API
 *  de Actions contesta sin credenciales; el token se manda si está, porque el
 *  límite por IP es corto y las de un Worker son compartidas.
 *
 *  Nunca tira: si GitHub no contesta, el panel se queda como estaba —sin saber—
 *  y eso es lo que dice. Un «desconocido» honesto vale más que un ✓ inventado. */
async function estadoBuild(env, cors) {
  if (!env.GITHUB_REPO) return json({ ok: true, estado: 'sin-actions' }, 200, cors);

  const cabeceras = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'cuartasilla-panel',
  };
  if (env.GITHUB_TOKEN) cabeceras.Authorization = 'Bearer ' + env.GITHUB_TOKEN;

  let runs;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPO}/actions/runs?per_page=10`,
      { headers: cabeceras },
    );
    if (!res.ok) return json({ ok: true, estado: 'desconocido', motivo: 'github-' + res.status }, 200, cors);
    runs = (await res.json()).workflow_runs || [];
  } catch (e) {
    return json({ ok: true, estado: 'desconocido', motivo: String(e.message || e) }, 200, cors);
  }

  // Los cancelados no cuentan: el propio workflow cancela el build en curso
  // cuando entra otro (`concurrency: cancel-in-progress`), así que la mitad de
  // la lista son cancelaciones que no dicen nada de cómo quedó el sitio.
  const run = runs.find((r) => r.conclusion !== 'cancelled');
  if (!run) return json({ ok: true, estado: 'desconocido' }, 200, cors);

  const estado = run.status !== 'completed'
    ? 'corriendo'
    : run.conclusion === 'success' ? 'ok' : 'falló';

  return json({
    ok: true,
    estado,
    cuando: run.updated_at,
    url: run.html_url,
  }, 200, cors);
}

// ── Cloudinary ────────────────────────────────────────────────────────────────

/** Firma una subida. El navegador recibe una firma para UNA carpeta concreta,
 *  nunca la llave: el secreto no sale de aquí. */
async function firmar(cuerpo, env, cors) {
  const mime = String(cuerpo.content_type || '').toLowerCase();
  if (mime && !MIMES.has(mime)) {
    return json({ error: 'Ese tipo de archivo no se sube: ' + mime }, 400, cors);
  }

  const carpeta = String(cuerpo.carpeta || '').trim();
  if (!CARPETAS.test(carpeta)) {
    return json({ error: 'Carpeta no permitida. Válidas: artistas, marcas, sedes, archivo/<año>' }, 400, cors);
  }

  // Dentro de artistas cada quien tiene la suya, para poder mirar la cuenta de
  // Cloudinary y entender qué hay sin abrir el sitio.
  const sub = cuerpo.nombre ? '/' + slug(cuerpo.nombre) : '';
  const folder = RAIZ + '/' + carpeta + sub;

  const timestamp = String(Math.floor(Date.now() / 1000));
  const params = {
    asset_folder: folder,
    folder,
    timestamp,
    upload_preset: env.CLOUDINARY_UPLOAD_PRESET,
  };
  const firma = await sha256(cadenaFirma(params) + env.CLOUDINARY_API_SECRET);

  return json({
    ok: true,
    signature: firma,
    timestamp,
    api_key: env.CLOUDINARY_API_KEY,
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    upload_preset: env.CLOUDINARY_UPLOAD_PRESET,
    folder,
    asset_folder: folder,
  }, 200, cors);
}

async function medios(cuerpo, env, cors) {
  const carpeta = String(cuerpo.carpeta || '').trim();
  const prefijo = carpeta
    ? (CARPETAS.test(carpeta) ? RAIZ + '/' + carpeta + '/' : null)
    : RAIZ + '/';
  if (!prefijo) return json({ error: 'Carpeta no permitida' }, 400, cors);

  const recursos = await listarCloudinary(env, prefijo);
  const entradas = recursos.map(r => ({
    public_id: r.public_id,
    url: `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/v${r.version}/${r.public_id}.${r.format}`,
    miniatura: `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/c_thumb,w_160,h_160,q_auto,f_auto/v${r.version}/${r.public_id}.${r.format}`,
    ancho: r.width,
    alto: r.height,
    peso: r.bytes,
    subida: r.created_at,
  }));
  return json({ ok: true, entradas }, 200, cors);
}

async function borrarMedio(cuerpo, env, cors) {
  const ids = (Array.isArray(cuerpo.public_ids) ? cuerpo.public_ids : [cuerpo.public_id])
    .filter(Boolean).map(String).slice(0, 100);
  if (!ids.length) return json({ error: 'No dijiste qué borrar' }, 400, cors);

  // El cerrojo que importa: la cuenta de Cloudinary es compartida con GDN.
  // Sin esto, la contraseña de este panel podría borrar el archivo del otro.
  const fuera = ids.filter(id => !id.startsWith(RAIZ + '/'));
  if (fuera.length) {
    return json({ error: 'Sólo se puede borrar dentro de ' + RAIZ + '/', fuera }, 400, cors);
  }

  const params = new URLSearchParams();
  ids.forEach(id => params.append('public_ids[]', id));
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/image/upload?${params}`,
    { method: 'DELETE', headers: { Authorization: 'Basic ' + basica(env) } },
  );
  const datos = await res.json().catch(() => ({}));
  return json(datos, res.ok ? 200 : 502, cors);
}

async function listarCloudinary(env, prefijo) {
  const recursos = [];
  let cursor = null;
  do {
    const params = new URLSearchParams({ type: 'upload', prefix: prefijo, max_results: '500' });
    if (cursor) params.set('next_cursor', cursor);
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/image?${params}`,
      { headers: { Authorization: 'Basic ' + basica(env) } },
    );
    if (!res.ok) throw new Error('Cloudinary contestó ' + res.status);
    const datos = await res.json();
    recursos.push(...(datos.resources || []));
    cursor = datos.next_cursor || null;
  } while (cursor);
  return recursos;
}

/** Vuelca el contenido entero a Cloudinary como archivo suelto. Se sobrescribe
 *  el mismo `public_id` cada semana: lo que se quiere es que exista una copia
 *  fuera de Cloudflare, no un museo de copias. */
async function respaldar(env) {
  const todo = await leerTodo(env);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const public_id = RAIZ + '/respaldo/contenido';
  const params = { overwrite: 'true', public_id, timestamp };
  const firma = await sha256(cadenaFirma(params) + env.CLOUDINARY_API_SECRET);

  const forma = new FormData();
  forma.append('file', new Blob([JSON.stringify(todo, null, 2)], { type: 'application/json' }), 'contenido.json');
  forma.append('api_key', env.CLOUDINARY_API_KEY);
  Object.entries(params).forEach(([k, v]) => forma.append(k, v));
  forma.append('signature', firma);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/raw/upload`,
    { method: 'POST', body: forma },
  );
  if (!res.ok) throw new Error('Cloudinary contestó ' + res.status + ' al respaldar');
  return todo;
}

const basica = env => btoa(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`);
const cadenaFirma = p => Object.keys(p).sort().map(k => k + '=' + p[k]).join('&');

// ── Bloqueo por intentos ──────────────────────────────────────────────────────

const INTENTOS = 5;
const CASTIGO  = 900;   // segundos

const kFail = ip => 'fail:' + ip;

async function bloqueada(env, ip) {
  return Number(await env.CONTENIDO.get(kFail(ip))) >= INTENTOS;
}
async function anotarFallo(env, ip) {
  const n = Number(await env.CONTENIDO.get(kFail(ip))) || 0;
  await env.CONTENIDO.put(kFail(ip), String(n + 1), { expirationTtl: CASTIGO });
}
async function limpiarFallos(env, ip) {
  await env.CONTENIDO.delete(kFail(ip)).catch(() => {});
}

// ── Plomería ──────────────────────────────────────────────────────────────────

async function sha256(texto) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function cabecerasCors(origen) {
  return {
    'Access-Control-Allow-Origin': origen,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(datos, estado, origen, { cache = 0 } = {}) {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Medio minuto de caché en la lectura pública: el build la pide una vez
      // y el panel refresca a mano. Sin esto, un bucle de recargas pega en KV.
      'Cache-Control': cache ? 'public, max-age=' + cache : 'no-store',
      ...cabecerasCors(origen),
    },
  });
}
