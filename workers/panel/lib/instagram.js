// Instagram → Galería.
//
// El registro de verdad del festival está en su cuenta, @festivaldearteconceptual:
// ahí se publica cada noche lo que pasó. Pedir que cada foto se suba dos veces
// —una a Instagram y otra al panel— es pedir que la segunda no se suba nunca.
// Así que la galería se llena sola con lo que publica la cuenta.
//
// Cómo, y por qué así:
//
//   · **Por la API oficial**, con un token de la cuenta. Leer el perfil público
//     a pelo no es opción: Instagram pide sesión para listar publicaciones,
//     cierra la puerta a las IP de los centros de datos —las de Cloudflare y las
//     de Actions lo son— y cambia su HTML sin avisar. Un build colgado de eso
//     se cae el día menos pensado, y siempre es el día del festival.
//
//   · **Las fotos se copian a Cloudinary.** Las URLs que da Instagram van
//     firmadas y caducan en días: enlazadas tal cual, la galería se llena de
//     cuadros rotos en cuanto el sitio pasa una semana sin construirse. Y
//     servirlas desde el CDN de Meta le regalaría la IP de cada visitante a
//     Meta, en un sitio que no pone ni una cookie. Copiadas son una foto más
//     del archivo, e `imagen()` las redimensiona como a todas.
//
//   · **El token vive aquí**, igual que la llave de Cloudinary: nunca sale del
//     Worker. Caduca a los 60 días, así que se refresca solo cada pocos y el
//     nuevo se guarda en KV. Se pone una vez con `wrangler secret put` y ya.
//
//   · **De cada publicación viaja la portada**, que es lo que enseña la
//     cuadrícula del perfil. Un carrusel de diez anuncios de artistas son diez
//     láminas de texto, y la galería se ahogaría en ellas; el resto del
//     carrusel está a un toque, en Instagram.
//
//   · **Lo que se borra en Instagram se va de la galería; lo que sólo es viejo,
//     se queda.** Ver `sincronizar()`.
//
// Claves de KV (el mapa completo está en `lib/contenido.js`):
//   cs:ig:lista       { actualizado, publicaciones }   lo que se publica
//   cs:ig:token       { token, origen, refrescado, expira }
//   cs:ig:estado      { error, desde }    sólo mientras la última vuelta falle
//   cs:ig:publicado   el `actualizado` que ya se mandó a construir

import { sha256 } from './cripto.js';

export const CUENTA = 'festivaldearteconceptual';

const API = 'https://graph.instagram.com';

const K_LISTA     = 'cs:ig:lista';
const K_TOKEN     = 'cs:ig:token';
const K_ESTADO    = 'cs:ig:estado';
const K_PUBLICADO = 'cs:ig:publicado';

/** Hasta dónde se mira hacia atrás en cada vuelta. Una cuenta de festival no
 *  llega a esto en años; si llega, lo más viejo se queda congelado tal como
 *  estaba, que para un archivo es lo correcto. */
const MAX_PUBLICACIONES = 300;
const POR_PAGINA = 50;

/**
 * Cuántas fotos se copian a Cloudinary en una vuelta, como mucho.
 *
 * El plan gratis de Workers deja 50 peticiones salientes por invocación, y una
 * vuelta gasta hasta seis en leer el feed, una en refrescar el token y otra en
 * disparar el build. Con 25 sobra margen. La primera vez que se enciende, una
 * cuenta con cien publicaciones tarda cuatro vueltas —una hora— en quedar
 * copiada entera; de ahí en adelante entra una o dos por vuelta.
 */
export const SUBIDAS_POR_VUELTA = 25;

/** Meta da el token por 60 días y deja refrescarlo a partir de las 24 horas.
 *  Cada tres días es de sobra para no llegar nunca al borde, y cuesta una
 *  petición cada tres días. */
const REFRESCO_MS = 3 * 24 * 3600 * 1000;

/** Lo más largo que deja escribir Instagram en un pie de foto. */
const TEXTO_MAX = 2200;

const CAMPOS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
/** Con los hijos del carrusel, para sacar la portada de la primera pieza. */
const CAMPOS_CON_HIJOS = CAMPOS + ',children{media_type,media_url,thumbnail_url}';

const PERMALINK = /^https:\/\/(www\.)?instagram\.com\//;

// ── Lectura ──────────────────────────────────────────────────────────────────

/** Lo que consume el sitio. Sin traer nunca nada, una lista vacía. */
export async function leerInstagram(env) {
  const raw = await env.CONTENIDO.get(K_LISTA, 'json');
  return raw ?? { actualizado: null, publicaciones: [] };
}

/** Para mirar desde el navegador si esto está vivo: `GET /instagram`. No lleva
 *  nada secreto — ni el token ni un trozo de él—, sólo cómo va. */
export async function estadoInstagram(env) {
  const [lista, tok, estado] = await Promise.all([
    leerInstagram(env),
    env.CONTENIDO.get(K_TOKEN, 'json'),
    env.CONTENIDO.get(K_ESTADO, 'json'),
  ]);
  return {
    cuenta: CUENTA,
    encendido: Boolean(env.INSTAGRAM_TOKEN),
    publicaciones: lista.publicaciones.length,
    actualizado: lista.actualizado,
    tokenCaduca: (tok && tok.expira) || null,
    error: (estado && estado.error) || null,
    errorDesde: (estado && estado.desde) || null,
  };
}

// ── La vuelta ────────────────────────────────────────────────────────────────

/**
 * Trae el feed y deja la lista al día. Nunca tira: lo que falle queda escrito
 * en `cs:ig:estado` y la lista se queda como estaba.
 *
 * `subir(url, id)` copia una foto a Cloudinary y devuelve `{ foto, ancho, alto }`.
 * Llega de fuera porque las credenciales de Cloudinary viven en `index.js`, y
 * así esto se prueba sin Cloudinary.
 *
 * Qué pasa con cada publicación:
 *
 *   · **Nueva** → se copia su portada y entra. Si en esta vuelta ya no quedan
 *     subidas, espera a la siguiente: las más nuevas van primero.
 *   · **Ya copiada** → no se vuelve a subir; se le actualiza el texto, que en
 *     Instagram se puede editar.
 *   · **Guardada y no vino** → depende de dónde cae. Si cae dentro de lo que se
 *     leyó, es que la borraron o la archivaron, y sale. Si es más vieja que lo
 *     más viejo que se leyó, no se sabe nada de ella: se queda.
 *
 * Y un feed vacío con fotos guardadas no borra nada. Una cuenta de festival no
 * se vacía de golpe; una respuesta rara de Instagram, sí puede llegar vacía, y
 * no vale dejar la galería en blanco por eso.
 */
export async function sincronizar(env, { subir, ahora = Date.now(), subidas = SUBIDAS_POR_VUELTA } = {}) {
  let tok = await tokenVigente(env, ahora);
  if (!tok) return { estado: 'apagado' };

  try {
    tok = await refrescarSiToca(env, tok, ahora);
    const { vistas, completo } = await leerFeed(tok.token);
    const antes = await leerInstagram(env);
    // Una publicación que llegue dos veces —dos páginas que se pisan— sería
    // dos fotos iguales en la galería. Cuenta la primera.
    const vistos = new Set();
    const frescas = vistas.map(normalizar).filter(p => p && !vistos.has(p.id) && vistos.add(p.id));

    if (frescas.length === 0 && antes.publicaciones.length > 0) {
      throw new Error('Instagram devolvió el feed vacío y aquí hay ' +
        antes.publicaciones.length + ' guardadas: no se borra nada por si acaso');
    }

    const guardadas = new Map(antes.publicaciones.map(p => [p.id, p]));
    const lista = [];
    let nuevas = 0, pendientes = 0, fallidas = 0, quitadas = 0;
    let quedan = subidas;

    for (const p of frescas) {
      const ya = guardadas.get(p.id);
      if (ya) { lista.push(ficha(p, ya)); continue; }
      if (quedan <= 0) { pendientes++; continue; }
      quedan--;
      try {
        lista.push(ficha(p, await subir(p.origen, p.id)));
        nuevas++;
      } catch (e) {
        // Se reintenta en la siguiente vuelta. Una que falle siempre gasta una
        // subida por vuelta y nada más: las demás siguen entrando.
        fallidas++;
        console.warn('instagram: no se pudo copiar ' + p.enlace + ': ' + (e.message || e));
      }
    }

    const leidas = new Set(frescas.map(p => p.id));
    const corte = completo ? -Infinity : Math.min(...frescas.map(p => Date.parse(p.fecha)));
    for (const p of antes.publicaciones) {
      if (leidas.has(p.id)) continue;
      if (Date.parse(p.fecha) < corte) lista.push(p);
      else quitadas++;
    }

    // ISO en UTC: ordenar el texto ordena las fechas.
    lista.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

    const cambio = JSON.stringify(lista) !== JSON.stringify(antes.publicaciones);
    let actualizado = antes.actualizado;
    if (cambio) {
      actualizado = new Date(ahora).toISOString();
      await env.CONTENIDO.put(K_LISTA, JSON.stringify({ actualizado, publicaciones: lista }));
    }
    await anotarError(env, null, ahora);

    return { estado: 'ok', cambio, nuevas, quitadas, pendientes, fallidas, total: lista.length, actualizado };
  } catch (e) {
    const error = String(e.message || e);
    await anotarError(env, error, ahora);
    return { estado: 'error', error };
  }
}

/**
 * Si hay una lista que el sitio todavía no enseña, su `actualizado`.
 *
 * Existe porque disparar el build puede no salir a la primera —el freno de
 * 60 s del panel, un GitHub que no contesta— y una publicación que entró en esa
 * vuelta se quedaría esperando al siguiente guardado del panel, que durante el
 * festival puede ser mañana. Con esto la vuelta siguiente lo vuelve a intentar.
 */
export async function porPublicar(env) {
  const [lista, publicado] = await Promise.all([leerInstagram(env), env.CONTENIDO.get(K_PUBLICADO)]);
  return lista.actualizado && lista.actualizado !== publicado ? lista.actualizado : null;
}

export async function anotarPublicado(env, actualizado) {
  await env.CONTENIDO.put(K_PUBLICADO, actualizado);
}

// ── El token ─────────────────────────────────────────────────────────────────

/**
 * El token con el que se trabaja: el refrescado de KV, o el secreto si es nuevo.
 *
 * Sin secreto no hay nada, aunque en KV quede uno: borrar el secreto es la
 * manera de apagar esto, y tiene que bastar.
 *
 * `origen` es la huella del secreto del que salió lo que hay en KV. Cuando no
 * coincide es que alguien puso un token nuevo —el viejo caducó, se cambió de
 * cuenta— y ése manda sobre el refrescado, que es del anterior.
 */
async function tokenVigente(env, ahora) {
  const secreto = env.INSTAGRAM_TOKEN;
  if (!secreto) return null;

  const origen = (await sha256(secreto)).slice(0, 16);
  const guardado = await env.CONTENIDO.get(K_TOKEN, 'json');
  if (guardado && guardado.origen === origen && guardado.token) return guardado;

  // Se anota desde cuándo se conoce: de ahí se cuenta el primer refresco, que
  // Meta no deja hacer antes de las 24 horas.
  const nuevo = { token: secreto, origen, refrescado: new Date(ahora).toISOString(), expira: null };
  await env.CONTENIDO.put(K_TOKEN, JSON.stringify(nuevo));
  return nuevo;
}

async function refrescarSiToca(env, tok, ahora) {
  if (ahora - Date.parse(tok.refrescado) < REFRESCO_MS) return tok;

  // Nada de esto tira, ni una respuesta mala ni una red caída: el token de
  // ahora vale hasta que caduque, y la vuelta siguiente lo intenta otra vez. Si
  // de verdad ya no sirve, el feed falla justo después y eso sí queda escrito.
  let res, datos;
  try {
    res = await fetch(
      `${API}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(tok.token)}`,
    );
    datos = await res.json().catch(() => ({}));
  } catch (e) {
    console.warn('instagram: no se pudo refrescar el token: ' + (e.message || e));
    return tok;
  }
  if (!res.ok || !datos.access_token) {
    console.warn('instagram: no se pudo refrescar el token: ' + mensaje(datos, res.status));
    return tok;
  }

  const nuevo = {
    token: datos.access_token,
    origen: tok.origen,
    refrescado: new Date(ahora).toISOString(),
    expira: datos.expires_in ? new Date(ahora + datos.expires_in * 1000).toISOString() : null,
  };
  await env.CONTENIDO.put(K_TOKEN, JSON.stringify(nuevo));
  return nuevo;
}

// ── El feed ──────────────────────────────────────────────────────────────────

/**
 * Las publicaciones de la cuenta, de la más nueva a la más vieja.
 *
 * `completo` dice si se llegó al final del feed. Sin él no se puede saber si
 * una publicación guardada que no vino se borró o sólo quedó más atrás.
 */
async function leerFeed(token) {
  let campos = CAMPOS_CON_HIJOS;
  let url = paginaUno(token, campos);
  const vistas = [];

  while (url && vistas.length < MAX_PUBLICACIONES) {
    const res = await fetch(url);
    const datos = await res.json().catch(() => ({}));

    if (!res.ok) {
      // La expansión `children{…}` es lo único de la petición que puede no
      // gustarle a la API (código 100: campo que no existe). Si es eso, se pide
      // sin ella y los carruseles salen con la foto que da el propio álbum, que
      // también es su primera pieza.
      const codigo = datos && datos.error && datos.error.code;
      if (codigo === 100 && campos === CAMPOS_CON_HIJOS && vistas.length === 0) {
        campos = CAMPOS;
        url = paginaUno(token, campos);
        continue;
      }
      throw new Error('Instagram contestó ' + res.status + ': ' + mensaje(datos, res.status));
    }

    vistas.push(...(Array.isArray(datos.data) ? datos.data : []));
    url = (datos.paging && datos.paging.next) || null;
  }

  return { vistas, completo: !url };
}

const paginaUno = (token, campos) =>
  `${API}/me/media?fields=${encodeURIComponent(campos)}&limit=${POR_PAGINA}&access_token=${encodeURIComponent(token)}`;

/**
 * Una publicación de la API, reducida a lo que usa la galería. `origen` es la
 * URL que caduca: sirve para copiarla a Cloudinary y no se guarda.
 *
 * Lo que no se puede enseñar se queda fuera: una historia, un video sin
 * portada —los reels con música con derechos a veces llegan sin ninguna de las
 * dos URLs—, algo sin fecha o sin enlace de vuelta a Instagram.
 */
export function normalizar(p) {
  if (!p || !p.id || !PERMALINK.test(String(p.permalink || ''))) return null;
  const fecha = new Date(p.timestamp);
  if (isNaN(fecha)) return null;

  let tipo, origen, piezas;
  if (p.media_type === 'IMAGE') {
    tipo = 'imagen';
    origen = p.media_url;
  } else if (p.media_type === 'VIDEO') {
    tipo = 'video';
    origen = p.thumbnail_url;
  } else if (p.media_type === 'CAROUSEL_ALBUM') {
    tipo = 'carrusel';
    const hijos = (p.children && Array.isArray(p.children.data)) ? p.children.data : [];
    const primera = hijos[0];
    origen = primera
      ? (primera.media_type === 'VIDEO' ? primera.thumbnail_url : primera.media_url)
      : p.media_url;
    piezas = hijos.length || undefined;
  } else {
    return null;
  }
  if (!origen) return null;

  return {
    id: String(p.id),
    enlace: String(p.permalink),
    fecha: fecha.toISOString(),
    tipo,
    piezas,
    texto: limpiar(p.caption),
    origen,
  };
}

/** Lo que se guarda de cada publicación. Siempre en el mismo orden de claves:
 *  la lista se compara como texto para saber si cambió. */
function ficha(p, copia) {
  const f = { id: p.id, enlace: p.enlace, fecha: p.fecha, tipo: p.tipo, foto: copia.foto };
  if (p.piezas > 1) f.piezas = p.piezas;
  if (copia.ancho && copia.alto) { f.ancho = copia.ancho; f.alto = copia.alto; }
  if (p.texto) f.texto = p.texto;
  return f;
}

function limpiar(texto) {
  if (typeof texto !== 'string') return undefined;
  const t = texto.replace(/\r\n?/g, '\n').trim().slice(0, TEXTO_MAX);
  return t || undefined;
}

// ── Plomería ─────────────────────────────────────────────────────────────────

/** Sólo se escribe cuando cambia: una vuelta cada cuarto de hora escribiendo
 *  «todo bien» se comería los mil guardados diarios del plan gratis de KV, que
 *  son de la cuenta entera y los comparte con el panel y con GDN. */
async function anotarError(env, error, ahora) {
  const antes = await env.CONTENIDO.get(K_ESTADO, 'json');
  if (!error) {
    if (antes) await env.CONTENIDO.delete(K_ESTADO);
    return;
  }
  if (antes && antes.error === error) return;
  console.error('instagram: ' + error);
  await env.CONTENIDO.put(K_ESTADO, JSON.stringify({ error, desde: new Date(ahora).toISOString() }));
}

/** El motivo que da la API, que es lo único que dice qué hay que arreglar
 *  («Error validating access token: Session has expired…»). */
function mensaje(datos, estado) {
  return (datos && datos.error && datos.error.message) || 'sin detalle (HTTP ' + estado + ')';
}
