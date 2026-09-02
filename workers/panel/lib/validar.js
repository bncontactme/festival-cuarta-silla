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
};

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
 * @param nombre  cuál de las cinco colecciones
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
    marcas:   () => v.marcas(datos),
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
      if (s.nombre === SEDE_TODAS) {
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

    // Encimarse no es un error: una sede puede tener dos cosas a la vez y la
    // rejilla las apila. Pero casi siempre es una hora mal escrita, así que se
    // avisa y que decida quien está mirando.
    for (let i = 0; i < actividades.length; i++) {
      for (let j = i + 1; j < actividades.length; j++) {
        const a = actividades[i], b = actividades[j];
        // Un recorrido que pasa por todas se cruza con medio programa por
        // definición: avisarlo sería avisar de lo que es.
        if (!a.sede || a.sede === SEDE_TODAS || a.sede !== b.sede || a.dia !== b.dia) continue;
        if (!a.inicio || !a.fin || !b.inicio || !b.fin) continue;
        if (minutos(a.inicio) < minutos(b.fin) && minutos(b.inicio) < minutos(a.fin)) {
          this.aviso('programa', '«' + a.titulo + '» y «' + b.titulo + '» se enciman en ' + a.sede);
        }
      }
    }

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

  marcas(datos) {
    const una = (lista, quienes) =>
      this.lista(lista || [], quienes, TOPES.marcas).map((m, i) => {
        const d = quienes + '[' + i + ']';
        return podar({
          nombre: this.texto(m.nombre, d + '.nombre', { max: 80, requerido: true }),
          logo:   this.imagen(m.logo, d + '.logo'),
          url:    this.enlace(m.url, d + '.url'),
        });
      });

    return {
      patrocinadores: una(datos && datos.patrocinadores, 'patrocinadores'),
      colaboradores:  una(datos && datos.colaboradores, 'colaboradores'),
    };
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
