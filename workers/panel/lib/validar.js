// La puerta. Nada entra a KV sin pasar por aquí.
//
// Por qué esto es la mitad del Worker: hoy `src/data/site.ts` termina con un
// bloque que REVIENTA el build si una actividad nombra una sede que no existe
// —ya pasó, con «Taller Industria Grafica» sin tilde—. Ese `throw` está bien
// mientras el dato lo escribe alguien que ve la consola. El día que lo escribe
// el festival desde el panel, ese mismo `throw` significa que el sitio deja de
// poder desplegarse y nadie se entera hasta que alguien va a mirar.
//
// Así que la puerta se cierra al entrar y no al salir: aquí se rechaza, con el
// «¿querías decir…?» puesto, y el build de allá se queda sólo como red.
//
// Además de validar, NORMALIZA: recorta espacios, tira campos vacíos y ordena
// las claves. Lo que queda en KV siempre está limpio, y así el JSON que se
// comitea al repo no cambia por un espacio de más.

import { pelar, masParecido } from './slug.js';

/** Cuánto cabe. No son límites de diseño, son frenos: KV aguanta 25 MB por
 *  valor y un panel no debería poder acercarse ni de lejos. */
const TOPES = {
  sedes: 100,
  actividades: 400,
  artistas: 300,
  ediciones: 20,
  fotosPorEdicion: 300,
  marcas: 100,
  aportes: 1000,
  /** Lo que pidió el festival: «máximo 5 fotos por post», y desde el 28/09,
   *  quince. */
  fotosPorAporte: 15,
};

/** Cuánto cabe en la descripción de una entrada de la galería abierta. Es un
 *  pie largo, no un ensayo: en la ficha se lee en cuatro renglones y entero en
 *  el visor. El formulario de `/galeria` corta en el mismo número. */
export const TOPE_DESCRIPCION = 800;

/**
 * La forma del `id` de una entrada de la galería abierta.
 *
 * No lo escribe nadie: lo acuña el Worker al abrir un envío (`nuevoId()` en
 * `index.js`) y es también la carpeta de sus fotos en Cloudinary,
 * `cuartasilla/aportes/<id>/`. Por eso es aleatorio y largo —nadie tiene que
 * poder adivinar el de otro envío para mandarle fotos— y por eso sólo lleva
 * minúsculas y números, que es lo que no hay que escapar en ninguna parte.
 */
export const ID_APORTE = /^[a-z0-9]{12,40}$/;

/** El centro de Guadalajara, con holgura. Fuera de aquí no es un error —una
 *  sede puede estar en Tlaquepaque o fuera del estado— pero sí un aviso: casi
 *  siempre significa latitud y longitud cambiadas de lugar. */
const CUADRO_GDL = { lat: [20.55, 20.80], lon: [-103.50, -103.20] };

const TIPOS = ['taller', 'charla', 'muestra', 'escena'];

/** La sede que no es una sede. Los recorridos guiados pasan por todas, así que
 *  el programa tiene que poder decirlo sin inventarse una fila en `sedes` — que
 *  traería dirección, coordenada y una estrella en el plano de la portada, tres
 *  cosas que un recorrido no tiene. Mismo texto que `SEDE_TODAS` en
 *  `src/data/tipos.ts`; si cambia allí, cambia aquí. */
const SEDE_TODAS = 'Todas las sedes';

/**
 * La dirección del texto de sala del festival: `/sala/festival`.
 *
 * Es fija y no se acuña: el festival es uno, su texto es uno, y su página no
 * puede cambiar de sitio porque su QR se cuelga en una puerta. Por eso aquí
 * hace falta reservarla — una actividad titulada «Festival» acuñaría ese mismo
 * `id` sin querer, y entonces habría dos cosas peleándose por una página: la
 * suya y la del festival. Gana la estática de Astro, así que el que se queda
 * sin página es el que nadie está mirando. Mejor decirlo al guardar.
 *
 * Mismo texto que `SALA_FESTIVAL` en `src/data/tipos.ts`; si cambia allí,
 * cambia aquí — y sólo se puede cambiar mientras no haya nada impreso.
 */
const SALA_FESTIVAL = 'festival';

/**
 * @param nombre  cuál de las colecciones
 * @param datos   lo que mandó el panel
 * @param ctx     { sedes: string[] } — los nombres de sede vigentes, para
 *                emparejar. Los lee index.js de KV antes de llamar.
 * @returns { datos, errores, avisos } — con errores, index.js contesta 400 y
 *          no se guarda nada.
 */
export function validar(nombre, datos, ctx = {}) {
  const v = new Verificador(ctx);
  const limpio = {
    sedes:    () => v.sedes(datos),
    programa: () => v.programa(datos),
    artistas: () => v.artistas(datos),
    archivo:  () => v.archivo(datos),
    aportes:  () => v.aportes(datos),
    marcas:   () => v.marcas(datos),
    festival: () => v.festival(datos),
  }[nombre];

  if (!limpio) {
    return { datos: null, errores: ['No existe la colección «' + nombre + '»'], avisos: [] };
  }

  let salida = null;
  try {
    salida = limpio();
  } catch (e) {
    v.error('', String(e.message || e));
  }
  return { datos: v.errores.length ? null : salida, errores: v.errores, avisos: v.avisos };
}

/**
 * La puerta del público: una entrada mandada desde el formulario de `/galeria`.
 *
 * Es la misma forma que una entrada ya aceptada —pasa por `aporte()`, con los
 * mismos topes— más las dos cosas que sólo se piden al mandar:
 *
 *   · **el permiso.** Quien sube una foto dice que es suya o que tiene permiso,
 *     y que el festival la puede publicar con su nombre. Sin esa casilla no se
 *     guarda nada: publicar la foto de otra persona sin preguntar es justo lo
 *     que un archivo no puede hacer.
 *   · **que las fotos sean de este envío.** Llegan como URLs, y una URL la
 *     puede escribir cualquiera. Se aceptan sólo las de la cuenta de Cloudinary
 *     del festival y dentro de la carpeta que se firmó para este envío
 *     (`aportes/<id>/`): ni fotos enlazadas de otra parte ni las de otro envío.
 *
 * El `id` y la `fecha` no los manda el público: los pone el Worker.
 *
 * @param datos lo que llegó del formulario
 * @param ctx   { id, fecha, cloud } — el envío abierto, el día de hoy en
 *              Guadalajara y la cuenta de Cloudinary
 */
export function validarEnvio(datos, { id, fecha, cloud }) {
  const v = new Verificador({});
  const x = datos && typeof datos === 'object' ? datos : {};

  if (x.permiso !== true) {
    v.error('permiso', 'hace falta decir que las fotos se pueden publicar');
  }

  const bruto = Array.isArray(x.fotos) ? x.fotos : [];
  const prefijo = 'https://res.cloudinary.com/' + cloud + '/image/upload/';
  bruto.forEach((src, j) => {
    const s = String(src ?? '');
    if (!s.startsWith(prefijo) || !s.includes('/aportes/' + id + '/')) {
      v.error('fotos[' + j + ']', 'no es una foto de este envío');
    }
  });

  const aporte = v.aporte({
    id,
    fecha,
    titulo: x.titulo,
    nombre: x.nombre,
    instagram: x.instagram,
    descripcion: x.descripcion,
    fotos: bruto.map((src) => ({ src: String(src ?? '') })),
  }, 'envio');

  return { datos: v.errores.length ? null : aporte, errores: v.errores };
}

class Verificador {
  constructor(ctx) {
    this.errores = [];
    this.avisos = [];
    this.sedesValidas = Array.isArray(ctx.sedes) ? ctx.sedes : [];
  }

  error(donde, msg) { this.errores.push(donde ? donde + ': ' + msg : msg); }
  aviso(donde, msg) { this.avisos.push(donde ? donde + ': ' + msg : msg); }

  // ── Piezas ────────────────────────────────────────────────────────────────

  texto(valor, donde, { max = 200, requerido = false } = {}) {
    const s = String(valor ?? '').replace(/\s+/g, ' ').trim();
    if (!s) {
      if (requerido) this.error(donde, 'hace falta');
      return undefined;
    }
    if (s.length > max) {
      this.error(donde, 'son ' + s.length + ' caracteres y caben ' + max);
      return undefined;
    }
    return s;
  }

  /** Enlaces: o `https://` o nada. Un `http://` en 2026 es un enlace roto que
   *  todavía no se enteró, y un `javascript:` es otra cosa. */
  enlace(valor, donde) {
    const s = String(valor ?? '').trim();
    if (!s) return undefined;
    if (!/^https:\/\/[^\s<>"']+$/.test(s)) {
      this.error(donde, 'tiene que ser una dirección https:// completa');
      return undefined;
    }
    if (s.length > 500) { this.error(donde, 'la dirección es larguísima'); return undefined; }
    return s;
  }

  /** Una imagen: o una ruta del propio sitio (`/logos/x.png`) o una URL
   *  entera, que es lo que devuelve Cloudinary. `src/lib/imagen.ts` sabe
   *  distinguirlas y trata cada una como toca. */
  imagen(valor, donde) {
    const s = String(valor ?? '').trim();
    if (!s) return undefined;
    if (s.startsWith('/')) {
      if (s.includes('..')) { this.error(donde, 'la ruta no puede salirse del sitio'); return undefined; }
      return s;
    }
    return this.enlace(s, donde);
  }

  entero(valor, donde, { min = 0, max = 9999 } = {}) {
    if (valor === undefined || valor === null || valor === '') return undefined;
    const n = Number(valor);
    if (!Number.isInteger(n) || n < min || n > max) {
      this.error(donde, 'tiene que ser un número entero entre ' + min + ' y ' + max);
      return undefined;
    }
    return n;
  }

  hora(valor, donde) {
    const s = String(valor ?? '').trim();
    const m = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (!m || +m[1] > 23 || +m[2] > 59) {
      this.error(donde, 'la hora se escribe HH:MM en 24 h (p. ej. 19:30)');
      return undefined;
    }
    return String(+m[1]).padStart(2, '0') + ':' + m[2];
  }

  /** El corazón del asunto: `sedeDe()` empareja por nombre EXACTO. Una tilde
   *  de más y la ficha sale sin dirección y sin mapa. */
  sede(valor, donde, { requerido = false, todas = false } = {}) {
    const s = this.texto(valor, donde, { max: 80, requerido });
    if (!s) return undefined;
    // Sólo el programa: una ficha de artista no puede estar «en todas».
    if (todas && s === SEDE_TODAS) return s;
    if (this.sedesValidas.includes(s)) return s;

    const parecida = masParecido(s, this.sedesValidas);
    this.error(
      donde,
      '«' + s + '» no está en la lista de sedes' +
        (parecida ? ' — ¿querías decir «' + parecida + '»?' : ''),
    );
    return undefined;
  }

  /** Un sí o un no. Sólo se guarda el sí: un `false` en el JSON del repo es
   *  una clave que no dice nada y que ensucia el diff. */
  bandera(valor) {
    return valor === true ? true : undefined;
  }

  /**
   * Texto largo, de varios párrafos. Es `texto()` con dos diferencias que
   * importan: aguanta miles de caracteres y **conserva los saltos de línea**,
   * porque son los párrafos.
   *
   * `texto()` aplasta todo espacio en blanco a uno solo, que es justo lo que
   * hay que hacer con un título y justo lo que no hay que hacer con esto: un
   * descripción pasada por ahí llega al muro como un ladrillo de trescientas
   * palabras sin un solo punto y aparte.
   *
   * Lo que sí se limpia: los retornos de Windows, los espacios al final de cada
   * renglón —invisibles y eternos en el diff— y las tandas de tres o más líneas
   * en blanco, que se quedan en una.
   */
  parrafo(valor, donde, { max = 6000 } = {}) {
    const s = String(valor ?? '')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!s) return undefined;
    if (s.length > max) {
      this.error(donde, 'son ' + s.length + ' caracteres y caben ' + max);
      return undefined;
    }
    return s;
  }

  /**
   * La descripción de una actividad.
   *
   * El `id` es lo delicado: es la dirección que va impresa dentro de un QR
   * pegado a una pared. Aquí se comprueba la forma —minúsculas, números y
   * guiones— y arriba, en `programa()`, que no se repita entre actividades.
   *
   * Lo que este validador **no puede** comprobar es que no haya cambiado. Las
   * actividades son una lista sin identidad propia: si alguien reordena dos y
   * cambia un `id`, desde aquí eso se ve exactamente igual que borrar una
   * actividad y añadir otra, que es una cosa legítima. Quien acuña el `id` una
   * sola vez es el panel; lo que hace el Worker cuando un `id` publicado
   * desaparece es **decirlo** —ver el aviso de `index.js`—, que es la parte que
   * de verdad hace falta: significa que hay un papel en una pared apuntando a
   * una página que ya no existe.
   */
  sala(valor, donde) {
    if (!valor || typeof valor !== 'object') return undefined;

    // Se rechaza, no se arregla. Es lo contrario de lo que hace el resto de
    // este archivo —que recorta, aplasta espacios y ordena claves— y es a
    // propósito: un `id` en mayúsculas bajado a minúsculas en silencio deja al
    // panel dibujando el QR de `/sala/Burdo` mientras el sitio construye
    // `/sala/burdo`. Rutas distintas, el código ya impreso, y un 404 que sólo
    // se descubre delante de la obra. Aquí normalizar es mentir.
    const id = String(valor.id ?? '').trim();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id) || id.length > 48) {
      this.error(donde + '.sala.id', 'la dirección sólo lleva minúsculas, números y guiones sueltos, y no pasa de 48: «' + id + '»');
      return undefined;
    }

    const cuerpo = this.parrafo(valor.cuerpo, donde + '.sala.cuerpo');
    const publicado = this.bandera(valor.publicado);

    // Publicado y en blanco es la única combinación que no puede pasar: el
    // sitio construiría una página vacía con un QR apuntándole.
    if (publicado && !cuerpo) {
      this.error(donde + '.sala', 'está marcado como publicado y no tiene texto');
      return undefined;
    }
    if (!cuerpo) return undefined;

    return podar({ id, cuerpo, firma: this.texto(valor.firma, donde + '.sala.firma', { max: 160 }), publicado });
  }

  lista(datos, donde, tope) {
    if (!Array.isArray(datos)) {
      this.error(donde, 'esperaba una lista');
      return [];
    }
    if (datos.length > tope) {
      this.error(donde, 'son ' + datos.length + ' y el tope son ' + tope);
      return [];
    }
    return datos;
  }

  // ── Colecciones ───────────────────────────────────────────────────────────

  sedes(datos) {
    const salida = this.lista(datos, 'sedes', TOPES.sedes).map((s, i) => {
      const d = 'sedes[' + i + ']';
      const sede = {
        nombre:    this.texto(s.nombre, d + '.nombre', { max: 80, requerido: true }),
        direccion: this.texto(s.direccion, d + '.direccion', { max: 200, requerido: true }),
        instagram: this.enlace(s.instagram, d + '.instagram'),
        mapa:      this.enlace(s.mapa, d + '.mapa'),
        notaMapa:  this.texto(s.notaMapa, d + '.notaMapa', { max: 300 }),
      };

      // Sin coordenada no hay estrella en el plano de la portada, y eso es un
      // estado legítimo: es lo que toca cuando una sede no está en el centro.
      if (Array.isArray(s.coord) && s.coord.length === 2) {
        const [lat, lon] = s.coord.map(Number);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
            Math.abs(lat) > 90 || Math.abs(lon) > 180) {
          this.error(d + '.coord', 'la coordenada es [latitud, longitud] en grados');
        } else {
          sede.coord = [lat, lon];
          const dentro = lat >= CUADRO_GDL.lat[0] && lat <= CUADRO_GDL.lat[1] &&
                         lon >= CUADRO_GDL.lon[0] && lon <= CUADRO_GDL.lon[1];
          if (!dentro) {
            this.aviso(
              d + '.coord',
              'cae fuera de Guadalajara. Si no es a propósito, casi siempre es ' +
              'que latitud y longitud están cambiadas de lugar.',
            );
          }
        }
      }
      return podar(sede);
    });

    // Dos sedes con el mismo nombre rompen `sedeDe()` en silencio: siempre
    // gana la primera y la segunda no se puede referenciar nunca.
    const vistos = new Set();
    salida.forEach((s, i) => {
      if (!s.nombre) return;
      // Pelado y no `===`: con la comparación exacta, «Todas Las Sedes» pasaba
      // el filtro y entraba como sede de verdad —con «Todas» de dirección—,
      // que es justo lo que este aviso venía a impedir. Así lo caza escrito
      // como se escriba.
      if (pelar(s.nombre) === pelar(SEDE_TODAS)) {
        this.error('sedes[' + i + '].nombre', '«' + SEDE_TODAS + '» es un nombre reservado: es lo que el programa usa para los recorridos que pasan por todas. Ponle otro.');
      }
      const k = pelar(s.nombre);
      if (vistos.has(k)) this.error('sedes[' + i + '].nombre', '«' + s.nombre + '» está repetida');
      vistos.add(k);
    });

    return salida;
  }

  programa(datos) {
    const bruto = (datos && datos.actividades) || datos;
    const actividades = this.lista(bruto, 'programa', TOPES.actividades).map((a, i) => {
      const d = 'programa[' + i + ']';
      const act = {
        titulo:   this.texto(a.titulo, d + '.titulo', { max: 120, requerido: true }),
        dia:      this.entero(a.dia, d + '.dia', { min: 0, max: 3 }),
        inicio:   this.hora(a.inicio, d + '.inicio'),
        fin:      this.hora(a.fin, d + '.fin'),
        sede:     this.sede(a.sede, d + '.sede', { requerido: true, todas: true }),
        tipo:     TIPOS.includes(a.tipo) ? a.tipo : undefined,
        artista:  this.texto(a.artista, d + '.artista', { max: 120 }),
        registro: this.enlace(a.registro, d + '.registro'),
        libre:    this.bandera(a.libre),
        sala:     this.sala(a.sala, d),
      };
      // Las dos a la vez no significan nada: o se apunta uno o se entra y ya.
      // Casi siempre es que se marcó «entrada libre» y después llegó el
      // formulario, así que manda el formulario y se dice.
      if (act.registro && act.libre) {
        delete act.libre;
        this.aviso(d, '«' + (act.titulo || 'sin título') + '» estaba marcada como entrada libre y tiene formulario: manda el formulario');
      }
      if (act.dia === undefined) this.error(d + '.dia', 'hace falta el día (0 = jueves … 3 = domingo)');
      if (!act.tipo) this.error(d + '.tipo', 'tiene que ser uno de: ' + TIPOS.join(', '));
      if (act.inicio && act.fin && minutos(act.fin) <= minutos(act.inicio)) {
        this.error(d, 'termina («' + act.fin + '») antes o a la misma hora que empieza («' + act.inicio + '»)');
      }
      return podar(act);
    });

    // Aquí había un aviso por cada par de actividades que se encimaran en su
    // sede, y se quitó. No porque encimarse dé igual —no es un error, una sede
    // puede tener dos cosas a la vez, pero casi siempre es una hora mal
    // escrita— sino porque el sitio de decirlo no es éste.
    //
    // El programa de verdad son ocho pares encimados, así que CADA Guardar
    // sacaba ocho renglones de lo mismo, y debajo, en el mismo tono y la misma
    // caja, el aviso que sí hay que leer: «/sala/… estaba publicado y ya no lo
    // está. Si su cartela está impresa, ese QR se queda sin página» (lo da
    // `index.js`, no esto). Una caja que sale siempre y siempre dice lo mismo
    // se aprende a despachar sin leerla, y el día que trae algo se despacha
    // igual. Por callar ocho renglones se lee el noveno.
    //
    // Y no se pierde nada, porque el panel ya lo dice tres veces y en el sitio
    // donde se puede hacer algo al respecto: en el renglón de la actividad y
    // con el nombre de la otra delante (`bloque.ts`), en la cabecera del día
    // (`esquema.ts`), y en Horarios, que es el cuadro que existe justo para
    // eso (`previa.ts`). Aquí se veía al guardar; allí se ve al mirar.

    // Dos descripciones no pueden compartir dirección: `/sala/<id>` es una
    // página y sólo puede enseñar una cosa. Esto sí es un error y no un aviso —
    // con dos iguales, uno de los dos QR impresos lleva a la obra del otro, y
    // no hay forma de saber cuál desde fuera.
    const vistos = new Map();
    actividades.forEach((a, i) => {
      if (!a.sala) return;

      // `/sala/festival` es del festival y no de una actividad. Si alguien
      // titula una «Festival», el panel acuña ese mismo `id` sin querer y
      // entonces hay dos cosas peleándose por una página — y gana la ruta
      // estática de Astro, así que el que se queda sin página es justo el que
      // nadie está mirando. Ver `SALA_FESTIVAL`.
      if (a.sala.id === SALA_FESTIVAL) {
        this.error(
          'programa[' + i + '].sala.id',
          '«' + SALA_FESTIVAL + '» es la dirección del texto de sala del festival, no de una actividad. ' +
            'Cámbiale la dirección a «' + (a.titulo || 'sin título') + '».',
        );
        return;
      }

      const antes = vistos.get(a.sala.id);
      if (antes !== undefined) {
        this.error(
          'programa[' + i + '].sala.id',
          '«' + a.sala.id + '» ya es la dirección de «' + (actividades[antes].titulo || 'sin título') +
            '». Dos descripciones no pueden compartir página.',
        );
        return;
      }
      vistos.set(a.sala.id, i);
    });

    // Sin la clave, se asume que SÍ es ejemplo. Errar hacia decir «esto todavía
    // no es la programación» es barato; lo caro es pasar por buena una rejilla
    // de mentira.
    const esEjemplo = bruto === datos ? true : datos.esEjemplo !== false;

    // Publicado y sin una sola actividad: el sitio saca la rejilla vacía. Se
    // avisa y no se bloquea —vaciar el programa para rehacerlo es un paso
    // normal— pero que quede dicho, porque desde el panel no se ve.
    if (!esEjemplo && !actividades.length) {
      this.aviso('programa', 'queda publicado y sin ninguna actividad: el sitio va a enseñar la rejilla vacía. Si estás rehaciéndolo, marca «esto todavía es la rejilla de ejemplo».');
    }

    // El registro no tiene ajustes que guardar: se apunta uno por actividad, y
    // el formulario de cada una se valida arriba con el resto de su fila. Hubo
    // un `registro` con interruptor de «abierto», formulario general y nota, y
    // se quitó — pegarle el formulario a una actividad ES abrirle el registro.
    return podar({ actividades, esEjemplo });
  }

  artistas(datos) {
    return this.lista(datos, 'artistas', TOPES.artistas).map((a, i) => {
      const d = 'artistas[' + i + ']';
      return podar({
        nombre:     this.texto(a.nombre, d + '.nombre', { max: 120, requerido: true }),
        disciplina: this.texto(a.disciplina, d + '.disciplina', { max: 80 }),
        foto:       this.imagen(a.foto, d + '.foto'),
        instagram:  this.enlace(a.instagram, d + '.instagram'),
        sede:       this.sede(a.sede, d + '.sede'),
      });
    });
  }

  archivo(datos) {
    const ediciones = this.lista(datos, 'archivo', TOPES.ediciones).map((e, i) => {
      const d = 'archivo[' + i + ']';
      const anio = this.texto(e.anio, d + '.anio', { max: 4, requerido: true });
      if (anio && !/^\d{4}$/.test(anio)) this.error(d + '.anio', 'son cuatro cifras, en texto');

      const fotos = this.lista(e.fotos || [], d + '.fotos', TOPES.fotosPorEdicion).map((f, j) => {
        const df = d + '.fotos[' + j + ']';
        const src = this.imagen(f.src, df + '.src');
        if (!src) this.error(df + '.src', 'hace falta la foto');
        return podar({ src, pie: this.texto(f.pie, df + '.pie', { max: 300 }) });
      });

      return podar({
        edicion:     this.texto(e.edicion, d + '.edicion', { max: 80, requerido: true }),
        anio,
        lema:        this.texto(e.lema, d + '.lema', { max: 200 }),
        sedes:       this.entero(e.sedes, d + '.sedes', { min: 0, max: 999 }),
        actividades: this.entero(e.actividades, d + '.actividades', { min: 0, max: 9999 }),
        fotos,
      });
    });

    // El orden de la lista es el que se pinta, y se lee de lo más reciente a lo
    // más viejo. Si está al revés, se avisa: es un archivo, no un diario.
    const anios = ediciones.map(e => Number(e.anio)).filter(Number.isFinite);
    const ordenado = anios.every((a, i) => i === 0 || anios[i - 1] >= a);
    if (anios.length > 1 && !ordenado) {
      this.aviso('archivo', 'las ediciones no van de la más reciente a la más vieja');
    }

    return ediciones;
  }

  /**
   * La galería abierta: las entradas que mandó el público y el festival ya
   * aceptó.
   *
   * Entran por `moderar` —que valida la lista entera con esto antes de poner
   * la nueva arriba— y después se editan en la pestaña Galería como cualquier
   * otra colección: corregir un título, quitar una foto, reordenar, borrar.
   *
   * El `id` no se repite, y no por prolijidad: es la carpeta de sus fotos en
   * Cloudinary. Dos entradas con la misma carpeta se estarían repartiendo las
   * fotos, y rechazar una borraría las de la otra.
   */
  aportes(datos) {
    const vistos = new Set();
    return this.lista(datos, 'aportes', TOPES.aportes).map((a, i) => {
      const d = 'aportes[' + i + ']';
      const aporte = this.aporte(a, d);
      if (aporte.id && vistos.has(aporte.id)) {
        this.error(d + '.id', 'repetido: dos entradas no pueden compartir carpeta de fotos');
      }
      vistos.add(aporte.id);
      return aporte;
    });
  }

  /**
   * Una entrada de la galería abierta. La usan la colección de aquí arriba y
   * `validarEnvio()`, la puerta del público: son la misma forma, y así un tope
   * no puede ser uno al mandar y otro al aceptar.
   */
  aporte(a, d) {
    const x = a && typeof a === 'object' ? a : {};

    const id = String(x.id ?? '').trim();
    if (!ID_APORTE.test(id)) this.error(d + '.id', 'falta, o no tiene forma de id');

    const fecha = String(x.fecha ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) this.error(d + '.fecha', 'la fecha va AAAA-MM-DD');

    if (Array.isArray(x.fotos) && x.fotos.length === 0) {
      this.error(d + '.fotos', 'una entrada lleva al menos una foto');
    }
    const fotos = this.lista(x.fotos, d + '.fotos', TOPES.fotosPorAporte).map((f, j) => {
      const df = d + '.fotos[' + j + ']';
      const src = this.imagen(f && f.src, df + '.src');
      if (!src) this.error(df + '.src', 'hace falta la foto');
      return podar({ src, pie: this.texto(f && f.pie, df + '.pie', { max: 300 }) });
    });

    return podar({
      id,
      titulo:      this.texto(x.titulo, d + '.titulo', { max: 120, requerido: true }),
      nombre:      this.texto(x.nombre, d + '.nombre', { max: 80, requerido: true }),
      instagram:   this.cuenta(x.instagram, d + '.instagram'),
      descripcion: this.parrafo(x.descripcion, d + '.descripcion', { max: TOPE_DESCRIPCION }),
      fecha,
      fotos,
    });
  }

  /**
   * Una cuenta de Instagram, guardada como la cuenta a secas: `lacuartasilla`.
   *
   * Se acepta como la escriba la gente —con arroba, sin ella, o pegando el
   * enlace del perfil— porque en un formulario del público las tres llegan el
   * mismo día. Aquí sí se normaliza, al revés que con las direcciones de sala:
   * de una cuenta no cuelga ningún papel impreso, y lo único que se hace con
   * ella es pintarla con su arroba y enlazarla.
   */
  cuenta(valor, donde) {
    const bruto = String(valor ?? '').trim();
    if (!bruto) return undefined;
    const s = bruto
      .replace(/^https?:\/\//i, '')
      .replace(/^(www\.)?instagram\.com\//i, '')
      .replace(/^@+/, '')
      .replace(/[/?#].*$/, '')
      .toLowerCase();
    if (!/^[a-z0-9._]{1,30}$/.test(s)) {
      this.error(donde, 'no parece una cuenta de Instagram: «' + bruto.slice(0, 60) + '»');
      return undefined;
    }
    return s;
  }

  /* Una sola lista. Hubo un `colaboradores` al lado que se turnaba la cinta de
     la portada con éste; se fue del sitio y se va de aquí. Lo que quede escrito
     en KV con esa clave se ignora y desaparece en el primer guardado. */
  marcas(datos) {
    const lista = this.lista(
      (datos && datos.patrocinadores) || [], 'patrocinadores', TOPES.marcas,
    ).map((m, i) => {
      const d = 'patrocinadores[' + i + ']';
      return podar({
        nombre: this.texto(m.nombre, d + '.nombre', { max: 80, requerido: true }),
        logo:   this.imagen(m.logo, d + '.logo'),
        url:    this.enlace(m.url, d + '.url'),
      });
    });

    return { patrocinadores: lista };
  }

  /**
   * Los dos textos del festival entero: el de sala y el manifiesto.
   *
   * Es la única colección que no es una lista, y por eso no se parece al resto
   * de este archivo: en los mensajes no hay índices porque no hay un tercer
   * elemento al que señalar. Son dos textos, uno de cada.
   *
   * Lo que sí cambia entre los dos es qué pasa si se quedan en blanco, y sale
   * de dónde se pinta cada uno:
   *
   *   · el **texto de sala** tiene página propia y un QR que se cuelga en una
   *     puerta. Vacío es legítimo —todavía no lo han escrito— pero *publicado y
   *     vacío* no: sería colgar un código que abre una hoja en blanco. Es la
   *     misma regla de `sala()`, aquí arriba.
   *   · el **manifiesto** no tiene página propia: es una sección de la portada
   *     que lleva ahí desde el primer día. Vaciarlo no deja un hueco honesto,
   *     deja una banda roja con un titular y nada debajo. Así que es requerido.
   */
  festival(datos) {
    const d = datos && typeof datos === 'object' ? datos : {};
    return podar({
      sala: this.salaFestival(d.sala),
      manifiesto: this.manifiesto(d.manifiesto),
    });
  }

  /** El texto de sala del festival. Es `sala()` con dos diferencias: no lleva
   *  `id` —la dirección es fija, ver `SALA_FESTIVAL`— y sí lleva título, que
   *  allí lo pone la actividad y aquí no lo pone nadie. */
  salaFestival(valor) {
    if (!valor || typeof valor !== 'object') return undefined;

    const cuerpo = this.parrafo(valor.cuerpo, 'festival.sala.cuerpo');
    const publicado = this.bandera(valor.publicado);

    if (publicado && !cuerpo) {
      this.error(
        'festival.sala',
        'está marcado como publicado y no tiene texto: el QR de la puerta abriría una página en blanco',
      );
      return undefined;
    }
    if (!cuerpo) return undefined;

    return podar({
      titulo: this.texto(valor.titulo, 'festival.sala.titulo', { max: 120 }),
      cuerpo,
      firma: this.texto(valor.firma, 'festival.sala.firma', { max: 160 }),
      publicado,
    });
  }

  /**
   * El manifiesto de la portada: título, párrafos y cierre.
   *
   * `cierre` es la frase que se pinta dos veces —de subtítulo en la banda roja
   * y de remate al final del modal— así que es una línea y no un párrafo. El
   * tope de 400 lo dice mejor que cualquier ayuda: a partir de ahí deja de
   * caber donde va.
   *
   * Sin nada escrito no se queja: mientras nadie lo haya tocado, la clave no
   * existe y el sitio tira del texto que trae de fábrica. Lo que no se puede es
   * BORRARLO, que es otra cosa — y ésa sí se rechaza.
   */
  manifiesto(valor) {
    if (!valor || typeof valor !== 'object') return undefined;

    const titulo = this.texto(valor.titulo, 'festival.manifiesto.titulo', { max: 160, requerido: true });
    const cuerpo = this.parrafo(valor.cuerpo, 'festival.manifiesto.cuerpo');
    if (!cuerpo) {
      this.error(
        'festival.manifiesto.cuerpo',
        'hace falta: el manifiesto es una sección de la portada y no puede quedarse en blanco',
      );
      return undefined;
    }

    return podar({
      titulo,
      cuerpo,
      cierre: this.texto(valor.cierre, 'festival.manifiesto.cierre', { max: 400 }),
    });
  }
}

const minutos = h => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));

/** Fuera las claves vacías: un `instagram: undefined` en el JSON del repo es
 *  ruido en el diff cada vez que alguien guarda. */
function podar(obj) {
  const salida = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v === undefined || v === null || v === '') continue;
    salida[k] = v;
  }
  return salida;
}
