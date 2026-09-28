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
// Y las de la galería abierta, que no son contenido todavía — ver abajo:
//   cs:subida:<id>       un envío abierto, con sus fotos firmadas y sin mandar
//   cs:envio:<id>        un envío mandado, esperando que alguien lo revise
//   cs:tope:<ip>         cuántos envíos abrió esa conexión en la última hora
//                        (la IP va pasada por SHA-256: no se guarda en claro)
//
// Las cinco listas son de menos de cien elementos: se guardan y se leen enteras.
// Nada de paginar ni de índices — sería complicar un JSON de 30 KB. La sexta,
// `festival`, no es una lista: son dos textos y uno de cada.

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
  marcas:   { clave: 'cs:col:marcas',   vacio: { patrocinadores: [] } },
  /* Los dos textos del festival entero, los que no son de ninguna actividad: el
     texto de sala de la entrada y el manifiesto de la portada. Va en una
     colección y no en dos claves sueltas porque se editan juntos, en la misma
     pestaña, y así el guardado es uno. `vacio` es un objeto pelado: sin sembrar
     no hay ninguno de los dos, y cada lado lo dice a su manera. */
  festival: { clave: 'cs:col:festival', vacio: {} },
  /* La galería abierta: las entradas del público que el festival aceptó. Es una
     colección como las otras —se versiona, entra en el historial y la baja el
     build— porque desde que se acepta ya es contenido del sitio. Lo que todavía
     NO se ha revisado no vive aquí: vive en `cs:envio:<id>`, fuera del
     historial y fuera de `GET /contenido`, que es público. */
  aportes:  { clave: 'cs:col:aportes',  vacio: [] },
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
          marcas:    ((snap.marcas || {}).patrocinadores || []).length,
          aportes:   (snap.aportes || []).length,
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
  // Una colección que no existía cuando se tomó la instantánea se queda como
  // está. Volver a una versión de antes de la galería abierta es volver atrás
  // el programa o las sedes, no borrar de un plumazo las fotos que el público
  // mandó después — que ni siquiera estaban ahí para poder «volver» a ellas.
  await Promise.all(
    NOMBRES.filter(n => n in snap).map(n =>
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

// ── Galería abierta: los envíos del público ──────────────────────────────────
//
// Un envío pasa por tres claves, y ninguna es una colección:
//
//   1. `cs:subida:<id>` — se abre al firmar las fotos. Dice «este id lo dio el
//      Worker y todavía no se usó». Sin ella, `envio-mandar` no acepta el id: no
//      se puede mandar una entrada con un id inventado ni mandar dos veces la
//      misma. Si nunca se manda —se cortó la red, se cerró la pestaña— queda
//      aquí con sus fotos ya subidas, y el cron semanal las borra.
//   2. `cs:envio:<id>` — el envío mandado y validado, esperando revisión. Una
//      clave por envío y no una lista: dos personas mandando a la vez serían
//      dos lecturas y dos escrituras de la misma lista, y una de las dos
//      entradas se perdería sin que nadie se enterara.
//   3. Al revisarlo, o se borra (rechazado) o pasa a la colección `aportes` y
//      se borra de aquí (aceptado). Lo que se ve en `/galeria` sale sólo de
//      `aportes`.
//
// Nada de esto entra en el historial ni en `GET /contenido`: lo que no se ha
// revisado no es contenido, y `GET /contenido` es público.

const kSubida = id => 'cs:subida:' + id;
const kEnvio  = id => 'cs:envio:' + id;

export async function abrirSubida(env, id) {
  // La hora va en los metadatos para que el cron la lea al listar, sin un `get`
  // por clave.
  await env.CONTENIDO.put(kSubida(id), '', { metadata: { t: Date.now() } });
}

export async function subidaAbierta(env, id) {
  return (await env.CONTENIDO.get(kSubida(id))) !== null;
}

export async function cerrarSubida(env, id) {
  await env.CONTENIDO.delete(kSubida(id));
}

/** Las subidas que se abrieron hace más de `edad` ms y nunca se mandaron. */
export async function subidasAbandonadas(env, edad) {
  const { keys } = await env.CONTENIDO.list({ prefix: 'cs:subida:' });
  const corte = Date.now() - edad;
  return keys
    .filter(k => Number(k.metadata?.t || 0) < corte)
    .map(k => k.name.slice('cs:subida:'.length));
}

export async function guardarEnvio(env, envio) {
  await env.CONTENIDO.put(kEnvio(envio.id), JSON.stringify(envio));
  await cerrarSubida(env, envio.id);
}

export async function leerEnvio(env, id) {
  return env.CONTENIDO.get(kEnvio(id), 'json');
}

export async function borrarEnvio(env, id) {
  await env.CONTENIDO.delete(kEnvio(id));
}

/** Cuántos esperan. Sólo cuenta claves: no abre ninguna. */
export async function contarEnvios(env) {
  const { keys } = await env.CONTENIDO.list({ prefix: 'cs:envio:' });
  return keys.length;
}

/** Los que esperan revisión, del más viejo al más nuevo: es una fila, y el que
 *  lleva más tiempo esperando va primero. */
export async function listarEnvios(env) {
  const { keys } = await env.CONTENIDO.list({ prefix: 'cs:envio:' });
  const envios = await Promise.all(keys.map(k => env.CONTENIDO.get(k.name, 'json')));
  return envios
    .filter(Boolean)
    .sort((a, b) => String(a.recibido).localeCompare(String(b.recibido)));
}

// Los `vacio` son objetos compartidos del módulo: devolverlos tal cual sería
// prestar el mismo array a todo el mundo.
function estructuraClonada(v) {
  return JSON.parse(JSON.stringify(v));
}
