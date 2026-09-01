// Todo lo que toca KV vive aquí. Si algún día esto se muda a D1 o a R2, se
// reescribe este archivo y ninguno más.
//
// Mapa de claves (binding: env.CONTENIDO)
//   cs:col:<coleccion>   la lista, tal cual la consume el sitio
//   cs:meta              { version, actualizado, ultimoDeploy }
//   cs:hist:<version>    instantánea completa de las cinco colecciones
//   cs:build             marca de tiempo del último rebuild disparado
//   fail:<ip>            intentos fallidos de contraseña (lo usa index.js)
//
// Las cinco colecciones son listas de menos de cien elementos: se guardan y se
// leen enteras. Nada de paginar ni de índices — sería complicar un JSON de 30 KB.

/**
 * El contrato. La forma de cada colección es EXACTAMENTE la de los tipos de
 * `src/data/*.ts` del sitio; `vacio` es lo que se devuelve cuando esa clave
 * todavía no existe, para que el sitio construya igual con KV en blanco.
 */
export const COLECCIONES = {
  sedes:    { clave: 'cs:col:sedes',    vacio: [] },
  programa: { clave: 'cs:col:programa', vacio: { actividades: [] } },
  artistas: { clave: 'cs:col:artistas', vacio: [] },
  archivo:  { clave: 'cs:col:archivo',  vacio: [] },
  marcas:   { clave: 'cs:col:marcas',   vacio: { patrocinadores: [], colaboradores: [] } },
};

export const NOMBRES = Object.keys(COLECCIONES);

const K_META  = 'cs:meta';
const K_BUILD = 'cs:build';
const kHist   = v => 'cs:hist:' + String(v).padStart(6, '0');

/** Cuántas instantáneas se conservan. Veinte guardados hacia atrás es más de lo
 *  que nadie recuerda haber hecho mal, y cada una pesa unos pocos KB. */
const HISTORIAL_MAX = 20;

// ── Lectura ──────────────────────────────────────────────────────────────────

export async function leerColeccion(env, nombre) {
  const def = COLECCIONES[nombre];
  if (!def) throw new Error('No existe la colección «' + nombre + '»');
  const raw = await env.CONTENIDO.get(def.clave, 'json');
  return raw ?? estructuraClonada(def.vacio);
}

export async function leerMeta(env) {
  const raw = await env.CONTENIDO.get(K_META, 'json');
  return raw ?? { version: 0, actualizado: null, ultimoDeploy: null };
}

/** Todo de una: es lo que pide el build del sitio, en un solo viaje. */
export async function leerTodo(env) {
  const [meta, ...listas] = await Promise.all([
    leerMeta(env),
    ...NOMBRES.map(n => leerColeccion(env, n)),
  ]);
  const salida = { version: meta.version, actualizado: meta.actualizado };
  NOMBRES.forEach((n, i) => { salida[n] = listas[i]; });
  return salida;
}

// ── Escritura ────────────────────────────────────────────────────────────────

/**
 * Guarda una colección ya validada y sube la versión.
 *
 * La instantánea del historial se toma ANTES de escribir: lo que se guarda en
 * `cs:hist:<version>` es el estado al que se vuelve si el guardado nuevo
 * resultó ser un error. Deshacer es restaurar la instantánea de la versión
 * anterior, no la de ésta.
 */
export async function guardarColeccion(env, nombre, datos) {
  const def = COLECCIONES[nombre];
  if (!def) throw new Error('No existe la colección «' + nombre + '»');

  const anterior = await leerTodo(env);
  const meta = { 
    version: (anterior.version || 0) + 1,
    actualizado: new Date().toISOString(),
    ultimoDeploy: (await leerMeta(env)).ultimoDeploy ?? null,
  };

  await env.CONTENIDO.put(kHist(anterior.version || 0), JSON.stringify(anterior));
  await env.CONTENIDO.put(def.clave, JSON.stringify(datos));
  await env.CONTENIDO.put(K_META, JSON.stringify(meta));

  // Podar el historial va después de contestar: que el guardado no espere a
  // una limpieza que a nadie le urge.
  return meta;
}

/** Deja sólo las últimas HISTORIAL_MAX instantáneas. */
export async function podarHistorial(env) {
  const { keys } = await env.CONTENIDO.list({ prefix: 'cs:hist:' });
  if (keys.length <= HISTORIAL_MAX) return 0;
  const sobran = keys
    .map(k => k.name)
    .sort()                                  // el padStart hace que ordenar texto ordene números
    .slice(0, keys.length - HISTORIAL_MAX);
  await Promise.all(sobran.map(k => env.CONTENIDO.delete(k)));
  return sobran.length;
}

export async function listarHistorial(env) {
  const { keys } = await env.CONTENIDO.list({ prefix: 'cs:hist:' });
  const versiones = await Promise.all(
    keys.map(async k => {
      const snap = await env.CONTENIDO.get(k.name, 'json');
      if (!snap) return null;
      return {
        version: snap.version,
        actualizado: snap.actualizado,
        // Un resumen para poder elegir sin abrir cada una.
        cuenta: {
          sedes:     (snap.sedes || []).length,
          programa:  ((snap.programa || {}).actividades || []).length,
          artistas:  (snap.artistas || []).length,
          archivo:   (snap.archivo || []).length,
          marcas:    ((snap.marcas || {}).patrocinadores || []).length +
                     ((snap.marcas || {}).colaboradores || []).length,
        },
      };
    }),
  );
  return versiones.filter(Boolean).sort((a, b) => b.version - a.version);
}

/** Vuelve a una instantánea. Es un guardado más: sube la versión en vez de
 *  borrar historia, para que restaurar también se pueda deshacer. */
export async function restaurar(env, version) {
  const snap = await env.CONTENIDO.get(kHist(version), 'json');
  if (!snap) return null;

  const anterior = await leerTodo(env);
  const meta = {
    version: (anterior.version || 0) + 1,
    actualizado: new Date().toISOString(),
    ultimoDeploy: (await leerMeta(env)).ultimoDeploy ?? null,
  };

  await env.CONTENIDO.put(kHist(anterior.version || 0), JSON.stringify(anterior));
  await Promise.all(
    NOMBRES.map(n =>
      env.CONTENIDO.put(
        COLECCIONES[n].clave,
        JSON.stringify(snap[n] ?? estructuraClonada(COLECCIONES[n].vacio)),
      ),
    ),
  );
  await env.CONTENIDO.put(K_META, JSON.stringify(meta));
  return meta;
}

// ── Freno del rebuild ────────────────────────────────────────────────────────
//
// Corregir diez renglones seguidos no debe lanzar diez builds. Se guarda cuándo
// se disparó el último y durante ese rato se contesta que ya hay uno en camino.

export const FRENO_SEGUNDOS = 60;

export async function puedeDisparar(env) {
  const ultimo = Number(await env.CONTENIDO.get(K_BUILD)) || 0;
  const faltan = FRENO_SEGUNDOS - Math.floor((Date.now() - ultimo) / 1000);
  return faltan <= 0 ? { ok: true } : { ok: false, faltan };
}

export async function anotarDisparo(env) {
  const ahora = Date.now();
  await env.CONTENIDO.put(K_BUILD, String(ahora));
  const meta = await leerMeta(env);
  meta.ultimoDeploy = new Date(ahora).toISOString();
  await env.CONTENIDO.put(K_META, JSON.stringify(meta));
  return meta;
}

// Los `vacio` son objetos compartidos del módulo: devolverlos tal cual sería
// prestar el mismo array a todo el mundo.
function estructuraClonada(v) {
  return JSON.parse(JSON.stringify(v));
}
