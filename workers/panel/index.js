// Worker — cuartasilla-panel
//
// El contenido del festival: sedes, programa, artistas, archivo y marcas.
// Vive en KV, lo edita `/admin` y lo lee el build de Astro.
//
// Hermano del `archivo-upload` de Guadalajara de Noche, y a propósito: es el
// mismo esquema (contraseña con hash, bloqueo por intentos, firmas de
// Cloudinary que nunca sueltan la llave) porque ahí lleva meses aguantando.
// Las diferencias eran dos: aquí sólo hay una contraseña —hay un comité que
// edita— y aquí lo que se guarda es contenido estructurado, no texto libre, así
// que se valida antes de entrar.
//
// Desde el 28/09 sí hay público mandando material, pero por una sola puerta y
// sin contraseña: la galería abierta. Cualquiera sube hasta cinco fotos con su
// título desde `/galeria`, y nada de eso sale en el sitio hasta que el festival
// lo acepta en el panel. Ver «Galería abierta», más abajo.
//
// Rutas públicas (GET, abiertas a cualquier origen — sirven al sitio):
//   GET /contenido               las colecciones, en un viaje
//   GET /contenido/<coleccion>   una sola
//
// Rutas del público (POST JSON, origen en lista blanca, SIN contraseña):
//   envio-abrir   { fotos }                    firma de 1 a 5 fotos para un envío
//   envio-mandar  { id, titulo, nombre, … }    manda el envío a revisión
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
//   envios        lo que el público mandó y espera revisión
//   moderar       { id, decision, datos? }     aceptar (→ aportes) o rechazar
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
  abrirSubida, subidaAbierta, cerrarSubida, subidasAbandonadas,
  guardarEnvio, leerEnvio, borrarEnvio, contarEnvios, listarEnvios,
} from './lib/contenido.js';
import { validar, validarEnvio, ID_APORTE } from './lib/validar.js';
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
const CARPETAS = /^(artistas|marcas|sedes|archivo\/\d{4}|aportes\/[a-z0-9]{12,40})$/;

// ── Galería abierta ───────────────────────────────────────────────────────────
//
// Los topes de la única puerta sin contraseña. No son de diseño: son frenos,
// y están puestos pensando en un script, no en una persona. Una persona manda
// una entrada, dos, cinco si estuvo los cuatro días.

/** Lo que pidió el festival: «máximo 5 fotos por post». El validador lo
 *  vuelve a mirar al mandar y al aceptar (`TOPES.fotosPorAporte`). */
const FOTOS_POR_ENVIO = 5;

/** Envíos que puede abrir una misma conexión en una hora. Cuenta los que se
 *  abren, no los que se mandan: firmar es lo que deja subir a Cloudinary, y es
 *  eso lo que hay que frenar. */
const ENVIOS_POR_HORA = 5;

/** Envíos que se abren al día entre TODO el mundo. El de arriba frena a una
 *  conexión; éste, a muchas a la vez — que es como se llena una cuenta de
 *  Cloudinary en una noche. Sesenta al día son trescientas fotos y unos
 *  doscientos megas en el peor caso: la cuenta ni lo nota, y un festival de
 *  cuatro días no manda tanto. Se reinicia a medianoche de Guadalajara. */
const ENVIOS_POR_DIA = 60;

/** Cuántos pueden esperar revisión a la vez. Pasado esto la puerta se cierra
 *  sola hasta que el festival revise: una fila de cien no la revisa nadie, y si
 *  llega a cien es que no la está mandando gente. */
const COLA_MAX = 60;

/**
 * Lo que Cloudinary le hace a una foto AL RECIBIRLA, antes de guardarla — la
 * «transformación de entrada». Va dentro de la firma, así que quien sube no
 * puede quitarla.
 *
 * Es el segundo freno contra llenar la cuenta, y el que no se puede saltar. El
 * primero es el navegador, que ya achica cada foto a 2000 px en JPEG antes de
 * mandarla (`src/lib/reducir.ts`); pero eso corre en la máquina de quien sube,
 * y un script con una firma en la mano manda lo que quiera. Con esto, lo que se
 * guarda nunca pasa de 2000 px, venga de donde venga: una foto de 48
 * megapíxeles se queda en una de 4.
 *
 *   · Las fotos de la galería (`archivo/…`, `aportes/…`) además se guardan en
 *     JPEG a calidad 85. Es la que ya pone el navegador, así que a una foto que
 *     llega por el formulario no le pasa nada; a la que llega de otra parte, sí.
 *   · Retratos y fotos de sedes: el tope de tamaño y la calidad, sin tocar el
 *     formato.
 *   · Los logos (`marcas`), sólo el tope. Bajarle la calidad a un PNG lo pasa a
 *     paleta de colores y le mancha los cantos, y un logo es cantos.
 *
 * El sitio nunca pide nada más grande: la ficha va a 800 y el visor a pantalla
 * entera, a 1600 (2000 en doble densidad).
 */
function alRecibir(carpeta) {
  const tope = 'c_limit,w_2000,h_2000';
  if (/^(archivo|aportes)\//.test(carpeta)) return { format: 'jpg', transformation: tope + ',q_85' };
  if (carpeta === 'marcas') return { transformation: tope };
  return { transformation: tope + ',q_85' };
}

/** Pasado este rato, un envío abierto que nunca se mandó se da por perdido y el
 *  cron borra sus fotos. La firma de Cloudinary caduca a la hora; dos es margen
 *  para una subida lenta desde el wifi de una sede. */
const SUBIDA_CADUCA_MS = 2 * 3600 * 1000;

/** El cron del respaldo semanal. Tiene que ser el mismo texto que en
 *  `wrangler.toml`: con ése, `scheduled()` respalda; con el diario, sólo barre. */
const CRON_RESPALDO = '0 9 * * 1';

const MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/avif']);

/** Un guardado son unos pocos KB. Un megabyte ya es alguien probando cosas. */
const CUERPO_MAX = 1_000_000;

/**
 * Qué campos entiende este Worker. **Se sube a mano cada vez que el validador
 * aprende un campo nuevo.**
 *
 * Existe por una tarde concreta. El 14/09, con el festival a diez días, se
 * escribió una descripción en el panel, se guardó, la versión subió, el sitio
 * se reconstruyó en verde — y el texto no estaba en ninguna parte. El sitio se
 * había actualizado al mezclar el PR; el Worker no, porque vive en Cloudflare y
 * entonces sólo se desplegaba a mano. Y el Worker es la puerta: `validar.js`
 * construye un objeto limpio con los campos que conoce, así que uno viejo tira
 * los que no conoce por el desagüe sin decir nada.
 *
 * Un panel que contesta «guardado» y pierde la mitad de lo guardado es peor que
 * uno que falla: el que falla te deja el texto en la pantalla para copiarlo.
 *
 * Así que ahora este número viaja en cada respuesta y el panel lo mira antes de
 * dejar tocar nada. Si el Worker va por detrás, sale un cartel rojo que no se
 * quita y el botón de guardar se queda apagado. Ver `CONTRATO_NECESARIO` en
 * `src/scripts/panel/panel.ts`.
 *
 *   1 → sedes, programa, artistas, archivo, marcas
 *   2 → + `sala` en las actividades (descripciones)
 *   3 → + `festival`: el texto de sala del festival y el manifiesto
 *   4 → + `aportes` y los envíos del público: la galería abierta
 */
const CONTRATO = 4;

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
        // El contrato viaja también aquí, sin contraseña: así el despliegue de
        // Actions puede comprobar desde fuera que el Worker que quedó puesto es
        // el que se acaba de subir. Ver `.github/workflows/worker.yml`.
        return json({ contrato: CONTRATO, ...(await leerTodo(env)) }, 200, '*', { cache: 30 });
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

    const ip = request.headers.get('CF-Connecting-IP') || 'sin-ip';

    // ── El público ────────────────────────────────────────────────────────────
    // Las dos únicas escrituras sin contraseña: abrir un envío de fotos para la
    // galería y mandarlo a revisión. Van antes del cerrojo de la contraseña, que
    // si no contaría cada foto mandada como un intento fallido de entrar al
    // panel — y a la quinta dejaría fuera a esa conexión, que en una sede es la
    // del wifi de todo el mundo.
    if (cuerpo.accion === 'envio-abrir' || cuerpo.accion === 'envio-mandar') {
      try {
        return cuerpo.accion === 'envio-abrir'
          ? await envioAbrir(cuerpo, env, ip, cors)
          : await envioMandar(cuerpo, env, cors);
      } catch (e) {
        console.error('galería:', e);
        return json({ error: 'Algo falló de nuestro lado. Vuelve a intentarlo en un rato.' }, 500, cors);
      }
    }

    // ── Contraseña ────────────────────────────────────────────────────────────
    // Antes de comparar nada: si esta IP ya falló demasiado, ni se le escucha.
    // Sin esto, adivinar una contraseña es dejar un script corriendo.
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
        case 'ping':         return json({ ok: true, contrato: CONTRATO, ...(await leerMeta(env)) }, 200, cors);
        case 'guardar':      return await guardar(cuerpo, env, ctx, cors);
        case 'firmar':       return await firmar(cuerpo, env, cors);
        case 'medios':       return await medios(cuerpo, env, cors);
        case 'borrar-medio': return await borrarMedio(cuerpo, env, cors);
        case 'publicar':     return await publicar(env, cors, true);
        case 'estado-build': return await estadoBuild(env, cors);
        case 'historial':    return json({ ok: true, versiones: await listarHistorial(env) }, 200, cors);
        case 'restaurar':    return await volver(cuerpo, env, ctx, cors);
        case 'envios':       return json({ ok: true, envios: await listarEnvios(env) }, 200, cors);
        case 'moderar':      return await moderar(cuerpo, env, ctx, cors);
        default:             return json({ error: 'No sé hacer «' + cuerpo.accion + '»' }, 400, cors);
      }
    } catch (e) {
      console.error('panel:', e);
      return json({ error: String(e.message || e) }, 500, cors);
    }
  },

  // Respaldo semanal a Cloudinary (ver [triggers] en wrangler.toml). Es la
  // tercera copia: KV, el JSON comiteado en el repo, y esto.
  //
  // Y la escoba de la galería abierta: las fotos de los envíos que se abrieron
  // y nunca se mandaron. Pasa todos los días (el otro cron de wrangler.toml):
  // no las ve nadie, pero ocupan sitio en la cuenta, y una semana de fotos
  // huérfanas es justo lo que no se quiere juntar.
  async scheduled(evento, env, ctx) {
    if (evento.cron === CRON_RESPALDO) {
      ctx.waitUntil(
        respaldar(env)
          .then(r => console.log('Respaldo semanal: versión ' + r.version))
          .catch(e => console.error('El respaldo semanal falló:', e)),
      );
    }
    ctx.waitUntil(
      barrerSubidas(env)
        .then(n => n && console.log('Galería: ' + n + ' envío(s) abandonado(s) barridos'))
        .catch(e => console.error('Barrer los envíos abandonados falló:', e)),
    );
  },
};

// ── Galería abierta ───────────────────────────────────────────────────────────
//
// Cualquiera puede subir fotos desde `/galeria`: hasta cinco por entrada, con su
// título, su nombre y, si quiere, su Instagram y unas líneas. Nada de eso se ve
// en el sitio hasta que el festival lo acepta en el panel.
//
// Por qué las fotos no pasan por aquí: un Worker gratis tiene diez milisegundos
// de CPU por petición, y cinco fotos de teléfono son treinta megas. Se hace lo
// mismo que en el panel: el Worker firma y el navegador sube directo a
// Cloudinary. La llave no sale nunca de aquí.
//
// Lo que cambia respecto al panel es qué se firma. Allí se firma una carpeta, y
// con esa firma se puede subir cuanto se quiera durante una hora —da igual, el
// que la pide tiene la contraseña—. Aquí la pide cualquiera, así que se firma
// **cada foto por separado, con su nombre puesto** (`aportes/<id>/1` … `/5`) y
// `overwrite=false`: cada firma sirve para una foto, una sola vez, y no puede
// pisar la que ya está. Sin eso, una firma pedida para mandar una foto serviría
// para llenar la cuenta de Cloudinary en una tarde, o para cambiar una foto ya
// aceptada por otra que nadie revisó.

async function envioAbrir(cuerpo, env, ip, cors) {
  if (!env.CLOUDINARY_API_SECRET || !env.CLOUDINARY_UPLOAD_PRESET) {
    return json({ error: 'La galería todavía no recibe fotos.' }, 503, cors);
  }

  const n = Number(cuerpo.fotos);
  if (!Number.isInteger(n) || n < 1 || n > FOTOS_POR_ENVIO) {
    return json({ error: 'Son de una a ' + FOTOS_POR_ENVIO + ' fotos por entrada.' }, 400, cors);
  }

  // El tope por conexión. La IP se guarda hecha hash: lo único que hace falta
  // es contar, no saber quién es.
  const clave = 'cs:tope:' + (await sha256(ip)).slice(0, 32);
  const hechos = Number(await env.CONTENIDO.get(clave)) || 0;
  if (hechos >= ENVIOS_POR_HORA) {
    return json({ error: 'Ya mandaste varias entradas seguidas. Espera un rato y vuelve a intentarlo.' }, 429, cors);
  }

  // El tope de todo el mundo, por día de Guadalajara. Caduca solo al segundo
  // día: no hace falta barrerlo.
  const claveDia = 'cs:tope:dia:' + hoyEnGDL();
  const delDia = Number(await env.CONTENIDO.get(claveDia)) || 0;
  if (delDia >= ENVIOS_POR_DIA) {
    return json({ error: 'Hoy ya llegaron muchas fotos. Vuelve a intentarlo mañana.' }, 429, cors);
  }

  if ((await contarEnvios(env)) >= COLA_MAX) {
    return json({ error: 'Hay muchas fotos esperando revisión. Vuelve a intentarlo en unos días.' }, 503, cors);
  }

  await env.CONTENIDO.put(clave, String(hechos + 1), { expirationTtl: 3600 });
  await env.CONTENIDO.put(claveDia, String(delDia + 1), { expirationTtl: 2 * 86400 });

  const id = nuevoId();
  await abrirSubida(env, id);

  const folder = RAIZ + '/aportes/' + id;
  const comunes = {
    ...alRecibir('aportes/' + id),
    allowed_formats: 'jpg,png,webp,avif',
    asset_folder: folder,
    folder,
    overwrite: 'false',
    timestamp: String(Math.floor(Date.now() / 1000)),
    upload_preset: env.CLOUDINARY_UPLOAD_PRESET,
  };
  const fotos = await Promise.all(
    Array.from({ length: n }, async (_, i) => {
      const params = { ...comunes, public_id: String(i + 1) };
      return { ...params, signature: await sha256(cadenaFirma(params) + env.CLOUDINARY_API_SECRET) };
    }),
  );

  return json({
    ok: true,
    id,
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    fotos,
  }, 200, cors);
}

async function envioMandar(cuerpo, env, cors) {
  const id = String(cuerpo.id || '');
  if (!ID_APORTE.test(id)) return json({ error: 'Falta el envío.' }, 400, cors);

  // La trampa: un campo que una persona no ve y un robot rellena. Se le contesta
  // que sí —enseñarle que se le cazó sólo le enseña a esquivarlo— y no se guarda
  // nada. Sus fotos, si subió alguna, se las lleva la escoba del cron.
  if (String(cuerpo.web || '').trim()) return json({ ok: true }, 200, cors);

  // Un reintento de uno que ya entró —se cortó la red justo al contestar— no es
  // un error: el envío está, y eso es lo que hay que decir.
  if (await leerEnvio(env, id)) return json({ ok: true }, 200, cors);
  if (!(await subidaAbierta(env, id))) {
    return json({ error: 'Este envío caducó. Vuelve a mandarlo: las fotos siguen en tu pantalla.' }, 410, cors);
  }

  const { datos, errores } = validarEnvio(cuerpo, {
    id,
    fecha: hoyEnGDL(),
    cloud: env.CLOUDINARY_CLOUD_NAME,
  });
  if (errores.length) {
    return json({ error: 'Falta algo por llenar.', errores }, 400, cors);
  }

  await guardarEnvio(env, { ...datos, recibido: new Date().toISOString() });
  return json({ ok: true }, 200, cors);
}

/**
 * Aceptar o rechazar un envío.
 *
 * **Pasa en el momento, no al darle a Guardar.** Es lo único del panel que
 * funciona así, y es a propósito: una cola de revisión que se queda «aceptada
 * pero sin guardar» es una cola en la que no se sabe qué está hecho. El panel lo
 * pinta en su propia pestaña, lejos del botón de Guardar, por lo mismo.
 *
 *   · **rechazar** borra el envío y sus fotos de Cloudinary. No queda nada: lo
 *     que no se publica no se guarda.
 *   · **aceptar** pone la entrada ARRIBA de `aportes` —con lo que el festival
 *     haya corregido: títulos, nombre, las fotos que se quitaron— y lanza el
 *     rebuild. Es un guardado de verdad: sube la versión y deja su instantánea
 *     en el historial, así que también se deshace.
 *
 * Al aceptar se pueden quitar y reordenar fotos, pero no añadir: una foto que no
 * vino en el envío no es parte de lo que se está revisando.
 *
 * Y se comprueba la versión igual que al guardar. No por la entrada —se pone
 * encima de lo que haya en KV, no pisa nada—, sino por lo que el panel hace con
 * la respuesta: se queda con el número de versión nuevo. Si alguien guardó en
 * medio y el panel adoptara ese número sin enterarse, su siguiente Guardar
 * pasaría el control de choques con datos viejos y pisaría lo del otro.
 */
async function moderar(cuerpo, env, ctx, cors) {
  const id = String(cuerpo.id || '');
  const envio = ID_APORTE.test(id) ? await leerEnvio(env, id) : null;
  if (!envio) {
    return json({
      error: 'Ese envío ya no está en la fila: puede que alguien lo haya revisado desde otra pestaña.',
      noEsta: true,
    }, 404, cors);
  }

  if (cuerpo.decision === 'rechazar') {
    await borrarEnvio(env, id);
    ctx.waitUntil(borrarFotosDeAporte(env, id, envio.fotos));
    return json({ ok: true }, 200, cors);
  }
  if (cuerpo.decision !== 'aceptar') {
    return json({ error: 'La decisión es «aceptar» o «rechazar».' }, 400, cors);
  }

  const vista = cuerpo.version;
  if (Number.isFinite(vista)) {
    const { version } = await leerMeta(env);
    if ((version || 0) !== vista) {
      return json({
        error: 'Alguien más guardó mientras revisabas (ibas por la versión ' + vista +
               ' y ya va la ' + version + ').',
        conflicto: { tuya: vista, actual: version },
      }, 409, cors);
    }
  }

  const propuesta = cuerpo.datos && typeof cuerpo.datos === 'object' ? cuerpo.datos : {};
  const originales = new Set(envio.fotos.map(f => f.src));
  const fotos = Array.isArray(propuesta.fotos)
    ? propuesta.fotos.filter(f => f && originales.has(f.src)).map(f => ({ src: f.src, pie: f.pie }))
    : envio.fotos;

  const aporte = { id, fecha: envio.fecha, fotos };
  for (const k of ['titulo', 'nombre', 'instagram', 'descripcion']) {
    aporte[k] = k in propuesta ? propuesta[k] : envio[k];
  }

  const actuales = await leerColeccion(env, 'aportes');
  const { datos, errores, avisos } = validar('aportes', [aporte, ...actuales.filter(a => a.id !== id)]);
  if (errores.length) {
    return json({ error: 'No se aceptó: hay ' + errores.length + ' cosa(s) que revisar', errores, avisos }, 400, cors);
  }

  const meta = await guardarColeccion(env, 'aportes', datos);
  await borrarEnvio(env, id);
  ctx.waitUntil(podarHistorial(env).catch(e => console.error('podar historial:', e)));

  const quedan = new Set(fotos.map(f => f.src));
  const fuera = envio.fotos.filter(f => !quedan.has(f.src));
  if (fuera.length) ctx.waitUntil(borrarFotosDeAporte(env, null, fuera));

  const despliegue = await publicarSilencioso(env);
  return json({ ok: true, ...meta, aportes: datos, avisos, despliegue }, 200, cors);
}

/** Un id de envío: dieciséis caracteres al azar. Es también el nombre de su
 *  carpeta en Cloudinary, y nadie tiene que poder adivinar el de otro. */
function nuevoId() {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return [...bytes].map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 16);
}

/** El día de hoy en Guadalajara, `AAAA-MM-DD`. Es la fecha que lleva la entrada:
 *  una foto mandada el sábado a las once de la noche es del sábado, aunque en
 *  UTC ya sea domingo. */
function hoyEnGDL() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

/** El `public_id` de una URL de entrega: lo que va entre la versión y la
 *  extensión. `…/upload/v17/cuartasilla/aportes/abc/1.jpg` → `cuartasilla/aportes/abc/1`. */
function idDeUrl(url) {
  const m = /\/image\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]{2,5})?$/i.exec(String(url));
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Borra fotos de la galería abierta en Cloudinary: las que se nombran y, si se
 * pasa el `id`, cualquier otra que haya quedado en su carpeta.
 *
 * Nunca tira. Se llama después de contestar, y que Cloudinary no conteste no
 * puede deshacer una decisión que ya se tomó: lo peor que pasa es una foto de
 * más en la cuenta, que no enlaza nadie.
 *
 * El cerrojo es el de siempre, más estrecho: sólo dentro de `cuartasilla/aportes/`.
 */
async function borrarFotosDeAporte(env, id, fotos = []) {
  const dentro = RAIZ + '/aportes/';
  const ids = fotos.map(f => idDeUrl(f.src)).filter(p => p && p.startsWith(dentro));
  const pedidos = [];
  if (ids.length) {
    const params = new URLSearchParams();
    ids.forEach(p => params.append('public_ids[]', p));
    pedidos.push(borrarEnCloudinary(env, params));
  }
  if (id && ID_APORTE.test(id)) {
    pedidos.push(borrarEnCloudinary(env, new URLSearchParams({ prefix: dentro + id + '/' })));
  }
  const hechos = await Promise.allSettled(pedidos);
  for (const h of hechos) {
    if (h.status === 'rejected') console.error('borrar fotos:', h.reason);
    else if (!h.value.ok) console.error('borrar fotos: Cloudinary contestó ' + h.value.status);
  }
}

/** Los envíos que se abrieron y nunca se mandaron: sus fotos y su marca. */
async function barrerSubidas(env) {
  const perdidas = await subidasAbandonadas(env, SUBIDA_CADUCA_MS);
  for (const id of perdidas) {
    await borrarFotosDeAporte(env, id);
    await cerrarSubida(env, id);
  }
  return perdidas.length;
}

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

  // Una descripción publicada tiene una dirección impresa dentro de un QR que
  // está pegado a una pared. Si al guardar desaparece —se borró la actividad,
  // se quitó el texto, se volvió a borrador— ese papel se queda apuntando a una
  // página que el próximo build ya no va a construir.
  //
  // No se bloquea, porque las tres cosas son legítimas. Se dice, con la ruta
  // delante, que es lo único que hace falta para saber qué papel hay que ir a
  // despegar. El validador no puede dar este aviso: sólo ve lo que llega, y
  // esto es la diferencia entre lo que llega y lo que había.
  if (nombre === 'programa') {
    const antes = (await leerColeccion(env, 'programa')).actividades || [];
    const vivos = new Set(
      (datos.actividades || []).filter(a => a.sala && a.sala.publicado).map(a => a.sala.id),
    );
    for (const a of antes) {
      if (!a.sala || !a.sala.publicado || vivos.has(a.sala.id)) continue;
      avisos.push(
        'programa: /sala/' + a.sala.id + ' («' + a.titulo + '») estaba publicado y ya no lo está. ' +
        'Si su cartela está impresa, ese QR se queda sin página.',
      );
    }
  }

  // Lo mismo, con el texto de sala del festival. Sólo hay uno y su dirección es
  // fija, así que no hace falta comparar listas: o estaba publicado y ya no, o
  // no. Y si estaba, su hoja de QR no está en una pared cualquiera — está en la
  // puerta de entrada, que es la única que ve todo el mundo.
  if (nombre === 'festival') {
    const antes = (await leerColeccion(env, 'festival')).sala;
    if (antes && antes.publicado && !(datos.sala && datos.sala.publicado)) {
      avisos.push(
        'festival: /sala/festival estaba publicado y ya no lo está. ' +
        'Si la hoja de QR está colgada, ese código se queda sin página.',
      );
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
    // **Sólo los de `publicar.yml`**, y esto es el arreglo de un susto de
    // verdad. Antes se pedían los runs de TODOS los workflows y se cogía el
    // más reciente. Mientras sólo hubo uno eso era lo mismo; desde que existe
    // `worker.yml` ya no, porque los dos se disparan con el mismo push y el del
    // Worker termina antes. El 14/09 el del Worker falló —le faltaba el
    // secreto— y el panel anunció «La publicación falló: el sitio no está
    // enseñando lo que guardaste» con el sitio publicado y en verde.
    //
    // Decirle a alguien que su trabajo no salió cuando sí salió es peor que no
    // decir nada: manda a revisar lo que está bien, y a la tercera vez ya nadie
    // lee el aviso. Se pregunta por el workflow que de verdad publica el sitio y
    // por ninguno más. Si se renombra el archivo, esto contesta 404 y el panel
    // dice «desconocido», que es el fallo honesto de siempre.
    const res = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/publicar.yml/runs?per_page=10`,
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
    return json({ error: 'Carpeta no permitida. Válidas: artistas, marcas, sedes, archivo/<año>, aportes/<id>' }, 400, cors);
  }

  // Dentro de artistas cada quien tiene la suya, para poder mirar la cuenta de
  // Cloudinary y entender qué hay sin abrir el sitio.
  const sub = cuerpo.nombre ? '/' + slug(cuerpo.nombre) : '';
  const folder = RAIZ + '/' + carpeta + sub;

  // La transformación de entrada (`alRecibir`) va sólo si el panel dice que
  // sabe mandarla. Firmada y no mandada, Cloudinary rechaza la subida por firma
  // mala; así que un panel de antes —que no la conoce— sigue subiendo como
  // siempre en vez de dejar de subir, y el orden en que se desplieguen el sitio
  // y el Worker da igual.
  const entrada = cuerpo.entrada === true ? alRecibir(carpeta) : {};

  const timestamp = String(Math.floor(Date.now() / 1000));
  const params = {
    ...entrada,
    asset_folder: folder,
    folder,
    timestamp,
    upload_preset: env.CLOUDINARY_UPLOAD_PRESET,
  };
  const firma = await sha256(cadenaFirma(params) + env.CLOUDINARY_API_SECRET);

  return json({
    ok: true,
    ...entrada,
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
  const res = await borrarEnCloudinary(env, params);
  const datos = await res.json().catch(() => ({}));
  return json(datos, res.ok ? 200 : 502, cors);
}

/** Un DELETE a la API de administración de Cloudinary: por `public_ids[]` o
 *  por `prefix`. El cerrojo de carpeta lo pone quien llama. */
function borrarEnCloudinary(env, params) {
  return fetch(
    `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/image/upload?${params}`,
    { method: 'DELETE', headers: { Authorization: 'Basic ' + basica(env) } },
  );
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
