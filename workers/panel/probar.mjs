#!/usr/bin/env node
/**
 * Las pruebas del validador. `node workers/panel/probar.mjs`, o `npm run probar`.
 *
 * Existe por un susto de esta misma tarde: al cambiar el «¿querías decir…?» por
 * uno que también caza las letras de menos, se quedó fuera un `import` y el
 * Worker empezó a contestar «pelar is not defined» a cada guardado de sedes. No
 * lo vio ningún tipo —esto es JavaScript suelto en un Worker— y sólo salió al
 * darle a Guardar con el panel delante. Una semana antes del festival eso es
 * exactamente lo que no puede pasar.
 *
 * Tardan medio segundo. No pretenden cubrirlo todo: cubren lo que rompe el
 * sitio si falla —las sedes que no emparejan, las horas al revés, el registro—
 * y lo que se acaba de tocar.
 *
 * Al final, el feed de Instagram, que es lo único de aquí que habla con el
 * mundo: con un Instagram, un Cloudinary y un GitHub de mentira, y un KV en
 * memoria. Es la única manera de probarlo antes de tener un token, y la única
 * de probar lo que importa —que una respuesta rara no vacíe la galería— sin
 * esperar a que Instagram la dé de verdad.
 */
import { validar } from './lib/validar.js';
import { masParecido } from './lib/slug.js';
import {
  sincronizar, normalizar, leerInstagram, estadoInstagram, porPublicar, anotarPublicado,
} from './lib/instagram.js';
import { sha256 } from './lib/cripto.js';
import worker from './index.js';

let fallos = 0;
const ok = (que, cond, extra = '') => {
  console.log((cond ? '  ✓ ' : '  ✗ ') + que + (cond ? '' : '  ← ' + extra));
  if (!cond) fallos++;
};

const SEDES = ['Cuerpos Parlantes', 'Foro AM', 'Taller Industria Gráfica', 'No Museo'];

console.log('\n«¿querías decir…?»');
ok('tilde de menos', masParecido('Taller Industria Grafica', SEDES) === 'Taller Industria Gráfica');
ok('letra de menos', masParecido('Cuerpos Parlante', SEDES) === 'Cuerpos Parlantes',
   String(masParecido('Cuerpos Parlante', SEDES)));
ok('letra cambiada', masParecido('No Musso', SEDES) === 'No Museo', String(masParecido('No Musso', SEDES)));
ok('nombre corto, dos letras de error: no sugiere', masParecido('Foro XY', SEDES) === undefined,
   String(masParecido('Foro XY', SEDES)));
ok('nada que ver: no sugiere', masParecido('Casa Feria', SEDES) === undefined,
   String(masParecido('Casa Feria', SEDES)));

console.log('\nprograma › registro y libre');
const base = (extra = {}) => ({
  titulo: 'Taller', dia: 0, inicio: '10:00', fin: '12:00',
  sede: 'Foro AM', tipo: 'taller', ...extra,
});

let r = validar('programa', { actividades: [base({ libre: true })], esEjemplo: false }, { sedes: SEDES });
ok('libre se guarda', r.errores.length === 0 && r.datos.actividades[0].libre === true, JSON.stringify(r.errores));

r = validar('programa', { actividades: [base({ libre: false })], esEjemplo: false }, { sedes: SEDES });
ok('libre:false no se guarda', !('libre' in r.datos.actividades[0]));

r = validar('programa', {
  actividades: [base({ libre: true, registro: 'https://tally.so/r/x' })], esEjemplo: false,
}, { sedes: SEDES });
ok('formulario manda sobre libre', !('libre' in r.datos.actividades[0]) && r.avisos.length === 1,
   JSON.stringify(r.avisos));

// El registro no tiene ajustes: se apunta uno por actividad y el formulario va
// en la fila. Lo que llegue en `registro` se cae por el desagüe, no se guarda.
r = validar('programa', {
  actividades: [base()], esEjemplo: false, registro: { abierto: true, nota: 'lo que sea' },
}, { sedes: SEDES });
ok('el registro de la página ya no se guarda', !('registro' in r.datos), JSON.stringify(r.datos));

r = validar('programa', {
  actividades: [base({ registro: 'https://forms.gle/abc' })], esEjemplo: false,
}, { sedes: SEDES });
ok('un Google Forms pasa', r.errores.length === 0 && r.datos.actividades[0].registro === 'https://forms.gle/abc',
   JSON.stringify(r.errores));

r = validar('programa', {
  actividades: [base({ registro: 'http://inseguro.com/form' })], esEjemplo: false,
}, { sedes: SEDES });
ok('un formulario en http se rechaza', r.errores.some((e) => e.includes('.registro')), JSON.stringify(r.errores));

r = validar('programa', { actividades: [base()], esEjemplo: false }, { sedes: SEDES });
ok('esEjemplo:false sobrevive a podar', r.datos.esEjemplo === false, JSON.stringify(r.datos));
ok('la lista de actividades sobrevive', r.datos.actividades.length === 1);

console.log('\nlo de siempre, que no se rompió');
r = validar('programa', { actividades: [base({ sede: 'Cuerpos Parlante' })] }, { sedes: SEDES });
ok('sede mal escrita se rechaza con sugerencia',
   r.errores.some((e) => e.includes('¿querías decir «Cuerpos Parlantes»?')), JSON.stringify(r.errores));

r = validar('sedes', [
  { nombre: 'Foro AM', direccion: 'C. Pedro Loza 344' },
  { nombre: 'foro am', direccion: 'otra' },
], {});
ok('sede repetida se rechaza', r.errores.some((e) => e.includes('está repetida')), JSON.stringify(r.errores));

// El nombre reservado, escrito como se escriba. Con `===` se colaba «Todas Las
// Sedes» y acababa de sede de verdad —con «Todas» de dirección— en el sitio.
for (const nombre of ['Todas las sedes', 'Todas Las Sedes', 'todas las sedes', 'Todas  Las  Sedes']) {
  r = validar('sedes', [{ nombre, direccion: 'Todas' }], {});
  ok(`«${nombre}» se rechaza como sede`,
     r.errores.some((e) => e.includes('nombre reservado')), JSON.stringify(r.errores));
}

r = validar('sedes', [{ nombre: 'X', direccion: 'Y', coord: [20.67, -103.35] }], {});
ok('coordenada buena pasa', r.errores.length === 0 && r.datos[0].coord.length === 2, JSON.stringify(r.errores));

r = validar('programa', { actividades: [base({ fin: '09:00' })] }, { sedes: SEDES });
ok('fin antes que inicio se rechaza', r.errores.some((e) => e.includes('termina')), JSON.stringify(r.errores));

r = validar('marcas', { patrocinadores: [{ nombre: 'X', logo: '/patrocinadores/x.png' }] }, {});
ok('logo del repo pasa', r.errores.length === 0 && r.datos.patrocinadores[0].logo === '/patrocinadores/x.png');

// Lo que llegue con la clave vieja se cae por el camino: una lista y ya.
r = validar('marcas', { patrocinadores: [{ nombre: 'X' }], colaboradores: [{ nombre: 'Y' }] }, {});
ok('colaboradores ya no se guarda', r.errores.length === 0 && !('colaboradores' in r.datos));

// ── Descripciones ───────────────────────────────────────────────────────────
//
// Lo que se prueba aquí es lo que acaba impreso en un papel pegado a una pared.
// Un `id` que no cuadra o un publicado sin texto no se descubren en la pantalla:
// se descubren delante de la obra, con alguien mirando su teléfono.

console.log('\nprograma › descripciones');

const conSala = (sala, extra = {}) => base({ sala, ...extra });

r = validar('programa', { actividades: [conSala({ id: 'burdo', cuerpo: 'Uno.\n\nDos.', publicado: true })] }, { sedes: SEDES });
ok('un texto publicado se guarda entero',
   r.errores.length === 0 && r.datos.actividades[0].sala.id === 'burdo' &&
   r.datos.actividades[0].sala.publicado === true, JSON.stringify(r.errores));

ok('los párrafos sobreviven al guardado',
   r.datos.actividades[0].sala.cuerpo === 'Uno.\n\nDos.',
   JSON.stringify(r.datos.actividades[0].sala.cuerpo));

r = validar('programa', { actividades: [conSala({ id: 'x', cuerpo: 'Hola.' })] }, { sedes: SEDES });
ok('sin publicar no se inventa un publicado:true', !('publicado' in r.datos.actividades[0].sala));

r = validar('programa', { actividades: [conSala({ id: 'x', cuerpo: '', publicado: true })] }, { sedes: SEDES });
ok('publicado y vacío se rechaza',
   r.errores.some((e) => e.includes('publicado y no tiene texto')), JSON.stringify(r.errores));

r = validar('programa', { actividades: [conSala({ id: 'x', cuerpo: '   \n\n  ' })] }, { sedes: SEDES });
ok('un cuerpo en blanco no deja una sala fantasma', !('sala' in r.datos.actividades[0]));

for (const malo of ['Burdo', 'con espacio', 'acción', '-empieza', 'termina-', 'doble--guion', '']) {
  r = validar('programa', { actividades: [conSala({ id: malo, cuerpo: 'Hola.' })] }, { sedes: SEDES });
  ok(`id «${malo}» se rechaza`, r.errores.some((e) => e.includes('.sala.id')), JSON.stringify(r.errores));
}

// Dos páginas no pueden compartir dirección: uno de los dos QR impresos llevaría
// a la obra del otro, y desde fuera no hay forma de saber cuál.
r = validar('programa', {
  actividades: [
    conSala({ id: 'recorrido', cuerpo: 'A.' }, { titulo: 'Recorrido sábado' }),
    conSala({ id: 'recorrido', cuerpo: 'B.' }, { titulo: 'Recorrido domingo' }),
  ],
}, { sedes: SEDES });
ok('dos salas con el mismo id se rechazan',
   r.errores.some((e) => e.includes('no pueden compartir página')), JSON.stringify(r.errores));

r = validar('programa', {
  actividades: [
    conSala({ id: 'recorrido', cuerpo: 'A.' }),
    conSala({ id: 'recorrido-2', cuerpo: 'B.' }),
  ],
}, { sedes: SEDES });
ok('dos salas distintas conviven', r.errores.length === 0, JSON.stringify(r.errores));

r = validar('programa', { actividades: [conSala({ id: 'x', cuerpo: 'a'.repeat(6001) })] }, { sedes: SEDES });
ok('un texto pasado de largo se rechaza',
   r.errores.some((e) => e.includes('caben 6000')), JSON.stringify(r.errores));

// Los saltos de línea SON los párrafos, así que `parrafo()` no los aplasta como
// hace `texto()`; lo que sí limpia son los excesos.
r = validar('programa', {
  actividades: [conSala({ id: 'x', cuerpo: 'Uno.   \r\n\n\n\n\nDos.' })],
}, { sedes: SEDES });
ok('se normalizan retornos y líneas de más',
   r.datos.actividades[0].sala.cuerpo === 'Uno.\n\nDos.',
   JSON.stringify(r.datos.actividades[0].sala.cuerpo));

r = validar('programa', { actividades: [base()] }, { sedes: SEDES });
ok('una actividad sin sala sigue siendo válida',
   r.errores.length === 0 && !('sala' in r.datos.actividades[0]), JSON.stringify(r.errores));

// ── Los textos del festival ─────────────────────────────────────────────────
//
// Dos textos y uno de cada, así que aquí no hay índices que probar: lo que se
// prueba es qué pasa cuando cada uno se queda en blanco, que es lo único que
// los separa. El de sala tiene página y QR colgado; el manifiesto es una banda
// de la portada que lleva ahí desde el primer día.

console.log('\nfestival › los dos textos');

const MANI = { titulo: '¿Qué entendemos por arte conceptual?', cuerpo: 'Uno.\n\nDos.', cierre: 'Preguntas.' };

r = validar('festival', {
  sala: { titulo: 'La Cuarta Silla', cuerpo: 'Uno.\n\nDos.', publicado: true },
  manifiesto: MANI,
}, {});
ok('los dos textos se guardan enteros',
   r.errores.length === 0 && r.datos.sala.publicado === true &&
   r.datos.sala.cuerpo === 'Uno.\n\nDos.' && r.datos.manifiesto.cierre === 'Preguntas.',
   JSON.stringify(r.errores));

r = validar('festival', { sala: { cuerpo: '', publicado: true }, manifiesto: MANI }, {});
ok('sala publicada y vacía se rechaza',
   r.errores.some((e) => e.includes('publicado y no tiene texto')), JSON.stringify(r.errores));

r = validar('festival', { sala: { titulo: 'Sólo el título' }, manifiesto: MANI }, {});
ok('sin cuerpo no queda una sala fantasma', r.errores.length === 0 && !('sala' in r.datos),
   JSON.stringify(r.datos));

r = validar('festival', { manifiesto: MANI }, {});
ok('el manifiesto solo vale: la sala llega después', r.errores.length === 0 && !('sala' in r.datos),
   JSON.stringify(r.errores));

r = validar('festival', { manifiesto: { titulo: 'Algo', cuerpo: '   \n\n ' } }, {});
ok('vaciar el manifiesto se rechaza',
   r.errores.some((e) => e.includes('no puede quedarse en blanco')), JSON.stringify(r.errores));

r = validar('festival', { manifiesto: { cuerpo: 'Uno.' } }, {});
ok('el manifiesto sin título se rechaza',
   r.errores.some((e) => e.includes('manifiesto.titulo')), JSON.stringify(r.errores));

r = validar('festival', {}, {});
ok('sin sembrar no se queja de nada', r.errores.length === 0 && Object.keys(r.datos).length === 0,
   JSON.stringify(r.datos));

r = validar('festival', { sala: { cuerpo: 'Uno.   \r\n\n\n\n\nDos.' }, manifiesto: MANI }, {});
ok('también aquí se normalizan los saltos', r.datos.sala.cuerpo === 'Uno.\n\nDos.',
   JSON.stringify(r.datos.sala.cuerpo));

// `/sala/festival` es del festival. Una actividad titulada «Festival» acuñaría
// ese mismo id sin querer, y la página que ganaría es la estática: el que se
// queda sin página es el que nadie está mirando.
r = validar('programa', {
  actividades: [conSala({ id: 'festival', cuerpo: 'Hola.' }, { titulo: 'Festival' })],
}, { sedes: SEDES });
ok('una actividad no puede acuñar /sala/festival',
   r.errores.some((e) => e.includes('texto de sala del festival')), JSON.stringify(r.errores));

// ── Instagram ───────────────────────────────────────────────────────────────
//
// Lo que se prueba es lo que se ve en /galeria: qué entra, qué sale y, sobre
// todo, qué NO sale cuando Instagram contesta algo raro.

const fetchDeVerdad = globalThis.fetch;

/** KV en memoria, con lo que usa el Worker. */
function kvFalso() {
  const m = new Map();
  return {
    m,
    async get(k, tipo) {
      if (!m.has(k)) return null;
      return tipo === 'json' ? JSON.parse(m.get(k)) : m.get(k);
    },
    async put(k, v) { m.set(k, String(v)); },
    async delete(k) { m.delete(k); },
    async list({ prefix = '' } = {}) {
      return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) };
    },
  };
}

const HORA = 3600_000;
const T0 = Date.UTC(2026, 8, 25, 18);

/** La n-ésima publicación, de la más nueva (0) a la más vieja. La fecha va
 *  como la manda Instagram: `+0000`, sin los dos puntos. */
const post = (n, extra = {}) => ({
  id: String(17900000 + n),
  media_type: 'IMAGE',
  media_url: `https://scontent.cdninstagram.com/v/${n}.jpg?oe=caduca`,
  permalink: `https://www.instagram.com/p/P${n}/`,
  timestamp: new Date(T0 - n * HORA).toISOString().replace('.000Z', '+0000'),
  caption: `Publicación ${n}`,
  ...extra,
});

const responder = (cuerpo, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } });

/**
 * Un graph.instagram.com de mentira, paginado como el de verdad: `paging.next`
 * es una URL entera, con los mismos campos y el token dentro. Lo demás que se
 * pida (Cloudinary, GitHub) lo contesta `otros`, o revienta.
 */
function instagramFalso({ feed = [], rechazaHijos = false, fallo = null, refresco = null, sinRed = false, otros = null } = {}) {
  const llamadas = [];
  globalThis.fetch = async (entrada, init) => {
    const url = new URL(String(entrada));
    llamadas.push({ url, init });
    if (url.hostname === 'graph.instagram.com') {
      if (url.pathname === '/refresh_access_token') {
        if (sinRed) throw new TypeError('Network connection lost.');
        return responder(refresco ?? { error: { message: 'no se pidió refresco' } }, refresco ? 200 : 400);
      }
      if (fallo) return responder(fallo.cuerpo, fallo.estado);
      const campos = url.searchParams.get('fields') || '';
      if (rechazaHijos && campos.includes('children')) {
        return responder({ error: { code: 100, message: '(#100) Tried accessing nonexisting field (children)' } }, 400);
      }
      const desde = Number(url.searchParams.get('after') || 0);
      const limite = Number(url.searchParams.get('limit') || 25);
      const siguiente = new URL(url);
      siguiente.searchParams.set('after', String(desde + limite));
      return responder({
        data: feed.slice(desde, desde + limite),
        paging: desde + limite < feed.length ? { next: siguiente.toString() } : {},
      });
    }
    if (otros) return otros(url, init);
    throw new Error('fetch que nadie esperaba: ' + url);
  };
  return llamadas;
}

/** Un Cloudinary de mentira para `sincronizar()`. */
function subidor({ falla = new Set() } = {}) {
  const subidas = [];
  return {
    subidas,
    subir: async (url, id) => {
      subidas.push({ url, id });
      if (falla.has(id)) throw new Error('Cloudinary contestó 400: Resource not found');
      return { foto: `https://res.cloudinary.com/demo/image/upload/v1/cuartasilla/instagram/${id}.jpg`, ancho: 1080, alto: 1350 };
    },
  };
}

const conToken = (extra = {}) => ({ CONTENIDO: kvFalso(), INSTAGRAM_TOKEN: 'IGQ-secreto', ...extra });
const ids = (lista) => lista.publicaciones.map((p) => p.id);

// Lo que el Worker escribe en su consola —los avisos de lo que falla a
// propósito aquí abajo— no se mezcla con las palomitas. Si algo sale mal, se
// enseña al final.
const bitacora = [];
const consolaDeVerdad = { log: console.log, warn: console.warn, error: console.error };
console.warn = console.error = (...a) => bitacora.push(a.join(' '));

console.log('\ninstagram › qué entra');

let env = { CONTENIDO: kvFalso() };
let llamadas = instagramFalso();
r = await sincronizar(env, { subir: subidor().subir, ahora: T0 });
ok('sin token no se hace nada', r.estado === 'apagado' && llamadas.length === 0, JSON.stringify(r));

const carrusel = (extra = {}) => post(1, {
  media_type: 'CAROUSEL_ALBUM', media_url: 'https://scontent.cdninstagram.com/v/album.mp4',
  children: { data: [
    { id: 'h1', media_type: 'VIDEO', media_url: 'https://x/h1.mp4', thumbnail_url: 'https://scontent.cdninstagram.com/v/h1.jpg' },
    { id: 'h2', media_type: 'IMAGE', media_url: 'https://scontent.cdninstagram.com/v/h2.jpg' },
  ] },
  ...extra,
});
const video = () => post(2, { media_type: 'VIDEO', media_url: 'https://x/2.mp4', thumbnail_url: 'https://scontent.cdninstagram.com/v/2-portada.jpg' });

env = conToken();
llamadas = instagramFalso({
  feed: [post(0), carrusel(), video(), post(3, { media_type: 'VIDEO', media_url: undefined }), post(4, { caption: undefined })],
});
let s = subidor();
r = await sincronizar(env, { subir: s.subir, ahora: T0 });
let lista = await leerInstagram(env);
ok('la primera vuelta copia las portadas', r.estado === 'ok' && r.nuevas === 4 && r.cambio === true, JSON.stringify(r));
ok('de la más nueva a la más vieja', ids(lista).join() === '17900000,17900001,17900002,17900004', ids(lista).join());
ok('el carrusel entra por la portada de su primera pieza, aunque sea video',
   s.subidas[1].url === 'https://scontent.cdninstagram.com/v/h1.jpg' &&
   lista.publicaciones[1].tipo === 'carrusel' && lista.publicaciones[1].piezas === 2,
   JSON.stringify(s.subidas[1]));
ok('el video entra por su portada', s.subidas[2].url.endsWith('2-portada.jpg') && lista.publicaciones[2].tipo === 'video');
ok('un video sin ninguna imagen se queda fuera', !ids(lista).includes('17900003'));
ok('la fecha llega en ISO aunque venga con +0000', lista.publicaciones[0].fecha === new Date(T0).toISOString(),
   lista.publicaciones[0].fecha);
ok('lo que caduca no se guarda: sólo la copia',
   !JSON.stringify(lista).includes('cdninstagram') && lista.publicaciones[0].foto.startsWith('https://res.cloudinary.com/'));
ok('sin pie no se inventa un texto', !('texto' in lista.publicaciones[3]));
ok('se sabe qué hay que construir', (await porPublicar(env)) === lista.actualizado);
await anotarPublicado(env, lista.actualizado);
ok('y cuando ya se mandó, no', (await porPublicar(env)) === null);

console.log('\ninstagram › la segunda vuelta y las que siguen');

s = subidor();
r = await sincronizar(env, { subir: s.subir, ahora: T0 + HORA });
ok('lo ya copiado no se vuelve a subir', s.subidas.length === 0 && r.cambio === false, JSON.stringify(r));
ok('y si nada cambió, no hay nada que construir', (await porPublicar(env)) === null);

// Borrar una pieza de un carrusel en Instagram le cambia la cuenta, no la foto
// ya copiada: la portada no se vuelve a subir.
llamadas = instagramFalso({
  feed: [post(0, { caption: 'Corregido' }), carrusel({ children: { data: [{ id: 'h2', media_type: 'IMAGE', media_url: 'https://x/h2.jpg' }] } }), video(), post(4, { caption: undefined })],
});
r = await sincronizar(env, { subir: s.subir, ahora: T0 + 2 * HORA });
lista = await leerInstagram(env);
ok('un pie editado en Instagram se actualiza sin volver a subir',
   r.cambio && s.subidas.length === 0 && lista.publicaciones[0].texto === 'Corregido', JSON.stringify(r));
ok('un carrusel que se queda en una pieza pierde la cuenta y conserva su foto',
   !('piezas' in lista.publicaciones[1]) && lista.publicaciones[1].foto.endsWith('17900001.jpg'),
   JSON.stringify(lista.publicaciones[1]));

llamadas = instagramFalso({ feed: [post(0), video(), post(4)] });
r = await sincronizar(env, { subir: s.subir, ahora: T0 + 3 * HORA });
lista = await leerInstagram(env);
ok('lo que se borra en Instagram se va de la galería', r.quitadas === 1 && !ids(lista).includes('17900001'),
   JSON.stringify(r));

llamadas = instagramFalso({ feed: [] });
r = await sincronizar(env, { subir: s.subir, ahora: T0 + 4 * HORA });
ok('un feed vacío no vacía la galería', r.estado === 'error' && (await leerInstagram(env)).publicaciones.length === 3,
   JSON.stringify(r));
ok('y lo dice en /instagram', (await estadoInstagram(env)).error?.includes('vacío'));

llamadas = instagramFalso({ feed: [post(0), video(), post(4)] });
r = await sincronizar(env, { subir: s.subir, ahora: T0 + 5 * HORA });
ok('la vuelta buena siguiente borra el error', r.estado === 'ok' && (await estadoInstagram(env)).error === null);

console.log('\ninstagram › de a poco, y sin atascarse');

env = conToken();
const cuarenta = Array.from({ length: 40 }, (_, n) => post(n));
llamadas = instagramFalso({ feed: cuarenta });
s = subidor();
r = await sincronizar(env, { subir: s.subir, ahora: T0 });
lista = await leerInstagram(env);
ok('cuarenta nuevas: entran 25 y esperan 15', r.nuevas === 25 && r.pendientes === 15, JSON.stringify(r));
ok('las que entran son las más nuevas', ids(lista)[24] === '17900024' && !ids(lista).includes('17900025'));
r = await sincronizar(env, { subir: s.subir, ahora: T0 + HORA });
ok('la vuelta siguiente trae las que faltaban', r.nuevas === 15 && r.total === 40 && r.pendientes === 0,
   JSON.stringify(r));

env = conToken();
llamadas = instagramFalso({ feed: [post(0), post(1), post(1), post(2)] });
s = subidor();
r = await sincronizar(env, { subir: s.subir, ahora: T0 });
ok('una publicación repetida en el feed entra una vez', r.total === 3 && s.subidas.length === 3,
   JSON.stringify(r));

env = conToken();
llamadas = instagramFalso({ feed: [post(0), post(1), post(2)] });
s = subidor({ falla: new Set(['17900001']) });
r = await sincronizar(env, { subir: s.subir, ahora: T0 });
ok('una foto que Cloudinary no puede copiar no frena a las demás',
   r.nuevas === 2 && r.fallidas === 1 && r.total === 2, JSON.stringify(r));
r = await sincronizar(env, { subir: subidor().subir, ahora: T0 + HORA });
ok('y se reintenta en la vuelta siguiente', r.nuevas === 1 && r.total === 3, JSON.stringify(r));

console.log('\ninstagram › lo viejo que no se leyó');

// 400 en el feed y se leen 300: lo guardado más viejo que la 300 no se sabe si
// existe, y se queda; lo que cae dentro y no vino, se borró.
env = conToken();
const guardadas = Array.from({ length: 300 }, (_, n) => post(n)).map((p) => ({
  id: p.id, enlace: p.permalink, fecha: new Date(p.timestamp).toISOString(), tipo: 'imagen',
  foto: `https://res.cloudinary.com/demo/image/upload/v1/cuartasilla/instagram/${p.id}.jpg`,
}));
const viejo = { ...guardadas[0], id: 'viejo', fecha: new Date(T0 - 999 * HORA).toISOString() };
const borrada = { ...guardadas[0], id: 'borrada', fecha: new Date(T0 - 10.5 * HORA).toISOString() };
await env.CONTENIDO.put('cs:ig:lista', JSON.stringify({ actualizado: 'antes', publicaciones: [...guardadas, borrada, viejo] }));
llamadas = instagramFalso({ feed: Array.from({ length: 400 }, (_, n) => post(n)) });
s = subidor();
r = await sincronizar(env, { subir: s.subir, ahora: T0 });
lista = await leerInstagram(env);
const paginas = llamadas.filter((l) => l.url.pathname === '/me/media').length;
ok('se leen seis páginas y se para', paginas === 6, String(paginas));
ok('lo más viejo que lo leído se queda', ids(lista).includes('viejo'));
ok('lo que cae dentro y no vino se va', !ids(lista).includes('borrada') && r.quitadas === 1, JSON.stringify(r));
ok('y no se sube nada de lo que ya estaba', s.subidas.length === 0);

console.log('\ninstagram › el token');

env = conToken();
llamadas = instagramFalso({ feed: [post(0)] });
await sincronizar(env, { subir: subidor().subir, ahora: T0 });
let tok = await env.CONTENIDO.get('cs:ig:token', 'json');
ok('el primer día no se refresca', !llamadas.some((l) => l.url.pathname === '/refresh_access_token') &&
   tok.token === 'IGQ-secreto', JSON.stringify(tok));

llamadas = instagramFalso({ feed: [post(0)], refresco: { access_token: 'IGQ-refrescado', token_type: 'bearer', expires_in: 5184000 } });
await sincronizar(env, { subir: subidor().subir, ahora: T0 + 4 * 24 * HORA });
tok = await env.CONTENIDO.get('cs:ig:token', 'json');
let media = llamadas.find((l) => l.url.pathname === '/me/media');
ok('a los cuatro días se refresca y se guarda el nuevo',
   tok.token === 'IGQ-refrescado' && tok.expira === new Date(T0 + 4 * 24 * HORA + 5184000 * 1000).toISOString(),
   JSON.stringify(tok));
ok('y el feed se pide ya con el nuevo', media.url.searchParams.get('access_token') === 'IGQ-refrescado');

llamadas = instagramFalso({ feed: [post(0)], sinRed: true });
r = await sincronizar(env, { subir: subidor().subir, ahora: T0 + 8 * 24 * HORA });
media = llamadas.find((l) => l.url.pathname === '/me/media');
ok('si el refresco se queda sin red, la vuelta sigue con el token de antes',
   r.estado === 'ok' && media && media.url.searchParams.get('access_token') === 'IGQ-refrescado',
   JSON.stringify(r));

env.INSTAGRAM_TOKEN = 'IGQ-otra-cuenta';
llamadas = instagramFalso({ feed: [post(0)] });
await sincronizar(env, { subir: subidor().subir, ahora: T0 + 5 * 24 * HORA });
media = llamadas.find((l) => l.url.pathname === '/me/media');
ok('un secreto nuevo manda sobre el refrescado del viejo',
   media.url.searchParams.get('access_token') === 'IGQ-otra-cuenta');

llamadas = instagramFalso({
  fallo: { estado: 400, cuerpo: { error: { code: 190, message: 'Error validating access token: Session has expired' } } },
});
r = await sincronizar(env, { subir: subidor().subir, ahora: T0 + 6 * 24 * HORA });
ok('un token caducado se dice con el motivo de Instagram',
   r.estado === 'error' && r.error.includes('Session has expired') &&
   (await estadoInstagram(env)).error.includes('Session has expired'), JSON.stringify(r));
ok('un error de token no se confunde con los campos: una sola petición',
   llamadas.filter((l) => l.url.pathname === '/me/media').length === 1);

env = conToken();
llamadas = instagramFalso({ feed: [post(0, { media_type: 'CAROUSEL_ALBUM' })], rechazaHijos: true });
r = await sincronizar(env, { subir: subidor().subir, ahora: T0 });
const pedidos = llamadas.filter((l) => l.url.pathname === '/me/media').map((l) => l.url.searchParams.get('fields'));
ok('si la API no acepta los hijos, se piden sin ellos',
   r.nuevas === 1 && pedidos.length === 2 && pedidos[0].includes('children') && !pedidos[1].includes('children'),
   JSON.stringify(pedidos));

const estadoPublico = JSON.stringify(await estadoInstagram(env));
ok('/instagram no suelta el token', !estadoPublico.includes('IGQ'), estadoPublico);

ok('un enlace que no es de Instagram no entra', normalizar(post(0, { permalink: 'https://evil.example/p/1' })) === null);
ok('sin fecha no entra', normalizar(post(0, { timestamp: 'ayer' })) === null);
ok('una historia no entra', normalizar(post(0, { media_type: 'STORY' })) === null);

console.log('\ninstagram › el Worker entero');

// Lo de arriba es la lógica. Esto es el Worker tal cual se despliega: el reloj,
// la subida a Cloudinary firmada, el build y lo que lee el sitio.
const subidasCloudinary = [];
const dispatches = [];
env = conToken({
  CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's',
  CLOUDINARY_UPLOAD_PRESET: 'cuartasilla_signed',
  GITHUB_TOKEN: 'gh', GITHUB_REPO: 'bncontactme/festival-cuarta-silla',
});
const otros = async (url, init) => {
  if (url.hostname === 'api.cloudinary.com') {
    const forma = init.body;
    const campos = Object.fromEntries([...forma.entries()].filter(([, v]) => typeof v === 'string'));
    const archivo = forma.get('file');
    subidasCloudinary.push({ ruta: url.pathname, campos, archivo: typeof archivo === 'string' ? archivo : await archivo.text() });
    return responder({
      secure_url: `https://res.cloudinary.com/demo/image/upload/v2/${campos.folder}/${campos.public_id}.jpg`,
      width: 1080, height: 1350,
    });
  }
  if (url.hostname === 'api.github.com') {
    dispatches.push(JSON.parse(init.body));
    return new Response(null, { status: 204 });
  }
  throw new Error('fetch que nadie esperaba: ' + url);
};
const reloj = async (cron) => {
  const esperas = [];
  console.log = (...a) => bitacora.push(a.join(' '));
  try {
    await worker.scheduled({ cron, scheduledTime: Date.now() }, env, { waitUntil: (p) => esperas.push(p) });
    await Promise.all(esperas);
  } finally {
    console.log = consolaDeVerdad.log;
  }
};

llamadas = instagramFalso({ feed: [post(0)], otros });
await reloj('*/15 * * * *');
const subida = subidasCloudinary[0];
ok('el reloj copia la foto a cuartasilla/instagram, firmada',
   subida && subida.ruta === '/v1_1/demo/image/upload' && subida.archivo.startsWith('https://scontent.cdninstagram.com/') &&
   subida.campos.folder === 'cuartasilla/instagram' && subida.campos.public_id === '17900000' &&
   subida.campos.overwrite === 'false' && /^[0-9a-f]{64}$/.test(subida.campos.signature || ''),
   JSON.stringify(subida));
ok('y manda a construir el sitio', dispatches.length === 1 && dispatches[0].event_type === 'publicar',
   JSON.stringify(dispatches));

const contenido = await (await worker.fetch(new Request('https://panel.test/contenido'), env, {})).json();
ok('/contenido trae el feed y el contrato 4',
   contenido.contrato === 4 && contenido.instagram.publicaciones.length === 1 &&
   contenido.instagram.publicaciones[0].foto.includes('/cuartasilla/instagram/17900000'),
   JSON.stringify(contenido.instagram));
ok('y las colecciones de siempre siguen ahí', Array.isArray(contenido.sedes) && 'programa' in contenido);

const publico = await (await worker.fetch(new Request('https://panel.test/instagram'), env, {})).json();
ok('/instagram dice que está encendido y cuántas hay',
   publico.encendido === true && publico.publicaciones === 1 && publico.cuenta === 'festivaldearteconceptual',
   JSON.stringify(publico));

await reloj('*/15 * * * *');
ok('la vuelta siguiente, sin nada nuevo, ni sube ni construye',
   subidasCloudinary.length === 1 && dispatches.length === 1, `${subidasCloudinary.length} / ${dispatches.length}`);

// A mano, desde el panel o un curl: con la contraseña, y `ok` dice si trajo.
env.ADMIN_HASH = await sha256('clave');
const aMano = async (entorno) => (await worker.fetch(new Request('https://panel.test/', {
  method: 'POST',
  headers: { Origin: 'https://www.festivaldearteconceptual.com', 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: 'clave', accion: 'instagram' }),
}), entorno, {})).json();
let manual = await aMano(env);
ok('«instagram» a mano trae el feed', manual.ok === true && manual.estado === 'ok' && manual.total === 1,
   JSON.stringify(manual));
manual = await aMano({ ...env, INSTAGRAM_TOKEN: undefined });
ok('y sin token contesta que no hizo nada', manual.ok === false && manual.estado === 'apagado',
   JSON.stringify(manual));

await reloj('0 9 * * 1');
const respaldo = subidasCloudinary[1];
ok('el reloj del lunes respalda, y con la lista de Instagram dentro',
   respaldo && respaldo.ruta === '/v1_1/demo/raw/upload' &&
   JSON.parse(respaldo.archivo).instagram.publicaciones.length === 1,
   JSON.stringify(respaldo && respaldo.ruta));
ok('y no se pone a leer Instagram',
   llamadas.filter((l) => l.url.hostname === 'graph.instagram.com').length === 3);

globalThis.fetch = fetchDeVerdad;
Object.assign(console, consolaDeVerdad);
if (fallos && bitacora.length) console.log('\nLo que dijo el Worker:\n  ' + bitacora.join('\n  '));

console.log(fallos ? `\n${fallos} fallo(s)\n` : '\nTodo bien\n');
process.exit(fallos ? 1 : 0);
