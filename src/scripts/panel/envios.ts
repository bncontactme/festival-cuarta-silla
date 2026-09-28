/**
 * La fila de revisión de la galería abierta: lo que el público mandó desde
 * `/galeria` y todavía no ha visto nadie.
 *
 * **No es una colección y no pasa por Guardar.** Aceptar y rechazar ocurren en
 * el momento, en el Worker (`moderar`), y es lo único del panel que funciona
 * así. Es a propósito: una fila de revisión con cosas «aceptadas pero sin
 * guardar» es una fila en la que no se sabe qué está hecho, y si se cierra la
 * pestaña con tres aceptadas a medias, nadie se entera de que no salieron. Por
 * eso vive en su propia pestaña, lejos del botón de Guardar, y cada botón dice
 * lo que hace: «Aceptar y publicar».
 *
 * Lo que sí se puede hacer antes de aceptar: corregir los textos —una tilde en
 * el título, un nombre en mayúsculas sostenidas— y quitar fotos que no van. No
 * se pueden añadir: una foto que no vino en el envío no es parte de lo que se
 * está revisando. Después de aceptada, la entrada es una fila más de la tabla
 * «Entradas del público» de la pestaña Galería, y se edita allí como todo.
 *
 * Nada de lo escrito aquí se pierde al cambiar de pestaña: las correcciones y
 * las fotos quitadas viven fuera de `pintarEnvios()`, por envío.
 */
import { el, vaciar, cuando } from './dom';
import { pedir, ErrorPanel } from './api';

export type Envio = {
  id: string;
  titulo: string;
  nombre: string;
  instagram?: string;
  descripcion?: string;
  fecha: string;
  /** ISO, cuándo llegó. La fila va del más viejo al más nuevo. */
  recibido: string;
  fotos: { src: string; pie?: string }[];
};

type Texto = Pick<Envio, 'titulo' | 'nombre' | 'instagram' | 'descripcion'>;

let fila: Envio[] = [];
/** `null` mientras no se haya preguntado; el texto del error si falló. */
let problema: string | null = 'cargando';
/** Lo que el festival corrigió de cada envío, por id. */
const correcciones = new Map<string, Texto>();
/** Las fotos que quitó de cada envío, por id. */
const quitadas = new Map<string, Set<string>>();

/** Cuántos esperan. Es la cuenta de la pestaña. */
export const pendientes = () => fila.length;

export async function cargarEnvios(): Promise<void> {
  try {
    const r = await pedir<{ envios: Envio[] }>('envios');
    fila = r.envios ?? [];
    problema = null;
  } catch (e: any) {
    problema = e?.message || String(e);
  }
  // Lo corregido de envíos que ya no están —los revisó otra pestaña— sobra.
  for (const id of [...correcciones.keys()]) {
    if (!fila.some((e) => e.id === id)) { correcciones.delete(id); quitadas.delete(id); }
  }
}

/** Con un Worker de antes del contrato 4 no se pregunta —no sabría contestar—
 *  y la pestaña lo dice en vez de quedarse «preguntando» para siempre. */
export function sinFila(motivo: string) {
  fila = [];
  problema = motivo;
}

export type Ctx = {
  /** La versión que tiene el panel. `moderar` la comprueba como `guardar`. */
  version: () => number;
  /** Si hay entradas del público sin guardar en la pestaña Galería. */
  aportesSinGuardar: () => boolean;
  /** Si hay algo sin guardar en cualquier pestaña. */
  haySinGuardar: () => boolean;
  /** Vuelve a bajar el contenido, como el botón «Recargar». */
  recargar: () => Promise<void>;
  /** Lo que contestó el Worker al aceptar: la lista nueva y la versión. */
  aceptado: (respuesta: any) => void;
  /** Que la barra de pestañas cuente de nuevo. */
  cambiado: () => void;
  avisar: (mensaje: string, clase?: 'error' | 'ojo' | 'bien', titulo?: string, detalle?: string[]) => void;
  /** La raíz del sitio, para enlazar a `/galeria`. */
  sitio: () => string;
};

/** Una miniatura de Cloudinary: la foto entera pesa megas y aquí se ven de a
 *  diez. Las URLs de las entradas son siempre de Cloudinary —el Worker no deja
 *  pasar otras—, así que el hueco de las transformaciones está donde se espera. */
const miniatura = (src: string) =>
  src.replace('/image/upload/', '/image/upload/c_fill,w_360,h_270,q_auto,f_auto/');

export function pintarEnvios(ctx: Ctx): HTMLElement {
  const seccion = el('section', { class: 'envios' });
  const cuerpo = el('div', { class: 'envios-fila' });

  const recargar = el('button', {
    type: 'button', class: 'boton',
    onclick: async () => {
      recargar.disabled = true;
      await cargarEnvios();
      recargar.disabled = false;
      repintar();
      ctx.cambiado();
    },
  }, 'Recargar envíos');

  seccion.append(
    el('div', { class: 'cabecera' },
      el('h2', {}, 'Envíos'),
      el('p', {},
        'Lo que manda la gente desde /galeria. Nada sale en el sitio hasta que lo aceptas aquí. ' +
        'Aceptar lo pone arriba de las entradas de la Galería y publica; rechazar lo borra, fotos incluidas. ' +
        'Antes de aceptar puedes corregir los textos y quitar fotos.'),
      el('span', { class: 'empuje' }),
      recargar,
    ),
    cuerpo,
  );

  function repintar() {
    vaciar(cuerpo);
    if (problema === 'cargando') {
      cuerpo.append(el('div', { class: 'vacio' }, el('p', {}, 'Preguntando qué ha llegado…')));
      return;
    }
    if (problema) {
      cuerpo.append(el('div', { class: 'aviso error' },
        el('h3', {}, 'No se pudo leer la fila'),
        el('p', {}, problema)));
      return;
    }
    if (!fila.length) {
      cuerpo.append(el('div', { class: 'vacio' },
        el('p', {}, 'No hay nada esperando revisión. Lo que mande la gente desde la galería aparece aquí.'),
        el('a', { class: 'boton', href: ctx.sitio() + 'galeria', target: '_blank', rel: 'noopener' },
          'Ver la galería ↗')));
      return;
    }
    for (const envio of fila) cuerpo.append(tarjeta(envio));
  }

  function tarjeta(envio: Envio): HTMLElement {
    const texto: Texto = correcciones.get(envio.id) ?? {
      titulo: envio.titulo,
      nombre: envio.nombre,
      instagram: envio.instagram ?? '',
      descripcion: envio.descripcion ?? '',
    };
    correcciones.set(envio.id, texto);
    const fuera = quitadas.get(envio.id) ?? new Set<string>();
    quitadas.set(envio.id, fuera);

    const nodo = el('article', { class: 'envio' });

    const fotos = el('div', { class: 'envio-fotos' });
    function pintarFotos() {
      vaciar(fotos);
      envio.fotos.forEach((f, i) => {
        const quitada = fuera.has(f.src);
        fotos.append(el('figure', { class: 'envio-foto' + (quitada ? ' fuera' : '') },
          el('a', { href: f.src, target: '_blank', rel: 'noopener', title: 'Verla entera, en otra pestaña' },
            el('img', { src: miniatura(f.src), alt: `Foto ${i + 1}`, loading: 'lazy' })),
          el('button', {
            type: 'button', class: 'boton suave',
            onclick: () => {
              if (quitada) fuera.delete(f.src); else fuera.add(f.src);
              pintarFotos();
            },
          }, quitada ? 'Devolver' : 'Quitar'),
        ));
      });
    }
    pintarFotos();

    const caja = (clave: keyof Texto, etiqueta: string, ayuda = '', area = false) => {
      const id = `envio-${envio.id}-${clave}`;
      const control = el(area ? 'textarea' : 'input', {
        id,
        value: texto[clave] ?? '',
        rows: area ? 4 : undefined,
        maxLength: clave === 'descripcion' ? 800 : clave === 'titulo' ? 120 : 80,
        oninput: (e: any) => { texto[clave] = e.target.value; },
      });
      return el('div', { class: 'campo' },
        el('label', { for: id }, etiqueta),
        control,
        ayuda ? el('span', { class: 'ayuda' }, ayuda) : null);
    };

    const rechazar = el('button', { type: 'button', class: 'boton', onclick: () => decidir('rechazar') }, 'Rechazar');
    const aceptar = el('button', { type: 'button', class: 'boton fuerte', onclick: () => decidir('aceptar') }, 'Aceptar y publicar');

    const n = envio.fotos.length;
    nodo.append(
      fotos,
      el('div', { class: 'envio-campos' },
        el('p', { class: 'rotulo' }, `Llegó ${cuando(envio.recibido)} · ${n === 1 ? '1 foto' : `${n} fotos`}`),
        caja('titulo', 'Título'),
        el('div', { class: 'envio-par' },
          caja('nombre', 'Nombre', 'Sale publicado'),
          caja('instagram', 'Instagram')),
        caja('descripcion', 'Descripción', '', true),
        el('div', { class: 'envio-acciones' }, rechazar, aceptar),
      ),
    );

    async function decidir(decision: 'aceptar' | 'rechazar') {
      const quedan = envio.fotos.filter((f) => !fuera.has(f.src));

      if (decision === 'rechazar') {
        if (!confirm(
          `¿Rechazar «${texto.titulo || envio.titulo}», de ${texto.nombre || envio.nombre}?\n\n` +
          `Se borra el envío y ${n === 1 ? 'su foto' : `sus ${n} fotos`}. No se puede deshacer.`,
        )) return;
      } else {
        // Lo que el Worker rechazaría igual, dicho antes de preguntarle.
        if (!quedan.length) {
          ctx.avisar('Le quitaste todas las fotos. Si no se queda ninguna, recházalo.', 'ojo');
          return;
        }
        if (!texto.titulo?.trim() || !texto.nombre?.trim()) {
          ctx.avisar('Hacen falta el título y el nombre: son lo que sale en la ficha.', 'ojo');
          return;
        }
        // Aceptar escribe la lista de entradas entera. Con cambios sin guardar
        // en esa misma lista, lo de allí y lo de aquí no pueden salir los dos.
        if (ctx.aportesSinGuardar()) {
          ctx.avisar(
            'Tienes cambios sin guardar en las entradas de la Galería. Guárdalos —o recarga para descartarlos— ' +
            'antes de aceptar: aceptar escribe esa misma lista.',
            'ojo', 'Primero, guardar',
          );
          return;
        }
      }

      rechazar.disabled = aceptar.disabled = true;
      nodo.classList.add('ocupado');
      try {
        if (decision === 'rechazar') {
          await pedir('moderar', { id: envio.id, decision });
          ctx.avisar(`Rechazado y borrado: «${envio.titulo}».`, 'bien');
        } else {
          const r = await aceptarConReintento(envio.id, { ...texto, fotos: quedan });
          ctx.aceptado(r);
          const d = r.despliegue ?? {};
          ctx.avisar(
            d.disparado
              ? `Aceptada: «${texto.titulo}». El sitio se está reconstruyendo; en minuto y medio sale en la galería.`
              : d.motivo === 'freno'
                ? `Aceptada: «${texto.titulo}». Ya había una publicación en camino: sale con la siguiente, que se puede lanzar en ${d.faltan} s con «Publicar ahora».`
                : `Aceptada: «${texto.titulo}». Sale en la galería con el siguiente build.`,
            'bien',
          );
          if (r.avisos?.length) ctx.avisar('Se aceptó, pero hay cosas que mirar:', 'ojo', 'Ojo', r.avisos);
        }
        quitar(envio.id);
      } catch (e: any) {
        const err = e as ErrorPanel;
        if (err.estado === 404) {
          // Otra pestaña ya lo revisó. No es un error de quien está aquí.
          ctx.avisar(err.message, 'ojo');
          quitar(envio.id);
        } else if (err.estado === 409) {
          ctx.avisar(
            'Alguien más guardó mientras revisabas, y tienes cambios sin guardar en otra pestaña del panel. ' +
            'Guarda lo tuyo (o recarga) y vuelve a aceptar: este envío sigue aquí.',
            'error', 'No se aceptó',
          );
        } else {
          ctx.avisar(err.message || String(e), 'error',
            decision === 'aceptar' ? 'No se aceptó' : 'No se rechazó', err.errores ?? []);
        }
      } finally {
        rechazar.disabled = aceptar.disabled = false;
        nodo.classList.remove('ocupado');
      }
    }

    return nodo;
  }

  /**
   * Aceptar, y si alguien guardó en medio, ponerse al día y volver a intentar
   * una vez — pero sólo si en este panel no hay nada sin guardar. Recargar con
   * cambios pendientes sería tirarlos para poder aceptar una foto, y eso lo
   * decide quien los escribió, no este botón.
   */
  async function aceptarConReintento(id: string, datos: any, otra = true): Promise<any> {
    try {
      return await pedir('moderar', { id, decision: 'aceptar', datos, version: ctx.version() });
    } catch (e: any) {
      if (e?.estado === 409 && otra && !ctx.haySinGuardar()) {
        await ctx.recargar();
        return aceptarConReintento(id, datos, false);
      }
      throw e;
    }
  }

  function quitar(id: string) {
    fila = fila.filter((e) => e.id !== id);
    correcciones.delete(id);
    quitadas.delete(id);
    repintar();
    ctx.cambiado();
  }

  repintar();
  return seccion;
}
