/**
 * Dibuja un campo. Uno solo: la fila los junta y la pestaña junta las filas.
 *
 * Todos escriben directo sobre el objeto de la fila y avisan con `ctx.cambiado()`.
 * Sin estado intermedio ni reconciliación: el DOM que hay ES el formulario, y
 * lo que se guarda es el objeto. En un panel de listas cortas eso es más fácil
 * de seguir —y de arreglar a las once de la noche— que cualquier otra cosa.
 */
import type { Campo } from './esquema';
import { TIPOS_ACTIVIDAD, SEDE_TODAS } from './esquema';
import { el } from './dom';
import { subirImagen, revisarArchivo } from './api';

export type Ctx = {
  /** Los nombres de sede vigentes, para los desplegables. */
  sedes: () => string[];
  /** «Jueves 24 de septiembre», etc. Salen de `programa.dias` del sitio. */
  dias: () => string[];
  cambiado: () => void;
  avisar: (mensaje: string, clase?: 'error' | 'ojo' | 'bien') => void;
  /** Cambiar de pestaña desde dentro de una vista. Lo usa Registro para mandar
   *  al Programa cuando todavía no hay ni una actividad que registrar. */
  irA?: (pestana: string) => void;
};

/**
 * @param conAyuda La explicación del campo sólo se pinta en la primera fila.
 *   Repetida cuarenta veces deja de ser ayuda y pasa a ser ruido: se lee una
 *   vez, y a partir de ahí lo que se quiere es ver muchas filas de un vistazo.
 */
export function pintarCampo(campo: Campo, fila: any, ctx: Ctx, conAyuda = true): HTMLElement {
  const caja = el('div', { class: 'campo', 'data-clave': campo.clave });
  if (campo.ancho && campo.ancho > 1) caja.style.gridColumn = `span ${campo.ancho}`;

  caja.append(el('label', { title: campo.ayuda }, campo.etiqueta + (campo.requerido ? ' *' : '')));
  caja.append(control(campo, fila, ctx));
  if (campo.ayuda && conAyuda) caja.append(el('span', { class: 'ayuda' }, campo.ayuda));
  return caja;
}

function control(campo: Campo, fila: any, ctx: Ctx): HTMLElement {
  const escribe = (v: any) => {
    if (v === '' || v === undefined || v === null) delete fila[campo.clave];
    else fila[campo.clave] = v;
    ctx.cambiado();
  };

  switch (campo.tipo) {
    case 'area':
      return el('textarea', {
        value: fila[campo.clave] ?? '',
        oninput: (e: any) => escribe(e.target.value),
      });

    case 'numero':
      return el('input', {
        type: 'number', min: '0', inputmode: 'numeric',
        value: fila[campo.clave] ?? '',
        oninput: (e: any) => escribe(e.target.value === '' ? '' : Number(e.target.value)),
      });

    case 'hora':
      return el('input', {
        type: 'time', step: '300',
        value: fila[campo.clave] ?? '',
        oninput: (e: any) => escribe(e.target.value),
      });

    case 'url':
      return el('input', {
        type: 'url', placeholder: 'https://…', spellcheck: false,
        value: fila[campo.clave] ?? '',
        oninput: (e: any) => escribe(e.target.value.trim()),
      });

    case 'dia':
      return desplegable(
        ctx.dias().map((d, i) => ({ valor: String(i), texto: d })),
        String(fila[campo.clave] ?? 0),
        (v) => escribe(Number(v)),
      );

    case 'tipoActividad':
      return desplegable(
        TIPOS_ACTIVIDAD.map((t) => ({ valor: t, texto: t })),
        fila[campo.clave] ?? '',
        escribe,
        'elegir…',
      );

    case 'sede': {
      const nombres = ctx.sedes();
      const actual = fila[campo.clave] ?? '';
      const opciones = nombres.map((n) => ({ valor: n, texto: n }));

      // Los recorridos guiados pasan por todas, y eso no es una sede: no tiene
      // dirección, ni coordenada, ni tarjeta en /sedes. Va arriba del todo
      // porque es la excepción, no una más de la lista.
      if (campo.todas) {
        opciones.unshift({ valor: SEDE_TODAS, texto: `★ ${SEDE_TODAS}` });
      }

      // Una sede que ya no existe —porque la renombraron— no se puede esconder:
      // se enseña marcada para que se vea que hay que arreglarla.
      if (actual && actual !== SEDE_TODAS && !nombres.includes(actual)) {
        opciones.unshift({ valor: actual, texto: `⚠ ${actual} (ya no existe)` });
      }
      return desplegable(opciones, actual, escribe, campo.requerido ? 'elegir sede…' : 'sin sede');
    }

    case 'sino': {
      // Sólo se guarda el sí. Un `false` en el JSON del repo es una clave que
      // no dice nada y que mueve el diff cada vez que alguien toca la casilla.
      const casilla = el('input', {
        type: 'checkbox',
        checked: fila[campo.clave] === true,
        style: 'width:auto',
        onchange: (e: any) => {
          if (e.target.checked) fila[campo.clave] = true;
          else delete fila[campo.clave];
          ctx.cambiado();
        },
      });
      return el('label', { class: 'sino' }, casilla, el('span', {}, campo.siNo ?? 'Sí'));
    }

    case 'coord':
      return coordenada(fila, campo.clave, ctx);

    case 'imagen':
      return imagen(campo, fila, ctx);

    case 'fotos':
      return fotos(campo, fila, ctx);

    default:
      return el('input', {
        type: 'text', spellcheck: false,
        value: fila[campo.clave] ?? '',
        oninput: (e: any) => escribe(e.target.value),
      });
  }
}

function desplegable(
  opciones: { valor: string; texto: string }[],
  actual: string,
  alCambiar: (v: string) => void,
  vacio?: string,
) {
  const s = el('select', { onchange: (e: any) => alCambiar(e.target.value) });
  if (vacio) s.append(el('option', { value: '' }, vacio));
  for (const o of opciones) s.append(el('option', { value: o.valor }, o.texto));
  s.value = actual;
  return s;
}

/** Latitud y longitud en dos huecos, y un botón para pegar el enlace de Google
 *  Maps y sacarlas de ahí — que es de donde salen siempre. */
function coordenada(fila: any, clave: string, ctx: Ctx) {
  const caja = el('div', { style: 'display:grid;grid-template-columns:1fr 1fr auto;gap:.3rem' });
  const par: number[] = Array.isArray(fila[clave]) ? [...fila[clave]] : [];

  const guarda = () => {
    if (Number.isFinite(par[0]) && Number.isFinite(par[1])) fila[clave] = [par[0], par[1]];
    else delete fila[clave];
    ctx.cambiado();
  };

  const hueco = (i: number, marca: string) =>
    el('input', {
      type: 'text', inputmode: 'decimal', placeholder: marca, spellcheck: false,
      value: par[i] ?? '',
      oninput: (e: any) => {
        const n = Number(String(e.target.value).trim().replace(',', '.'));
        par[i] = Number.isFinite(n) ? n : NaN;
        guarda();
      },
    });

  const lat = hueco(0, 'latitud');
  const lon = hueco(1, 'longitud');

  caja.append(lat, lon, el('button', {
    type: 'button', class: 'boton suave', title: 'Pegar un enlace de Google Maps y sacarle el punto',
    onclick: async () => {
      const pegado = prompt('Pega aquí el enlace de Google Maps (el largo, el que trae @20.67,-103.35)');
      if (!pegado) return;
      const m = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(pegado) || /(-?\d+\.\d{4,}),\s*(-?\d+\.\d{4,})/.exec(pegado);
      if (!m) {
        ctx.avisar('De ese enlace no se saca el punto. Sirve el enlace largo de Google Maps, el que lleva «@20.67…,-103.35…» dentro. Los cortos (maps.app.goo.gl) hay que abrirlos primero.', 'ojo');
        return;
      }
      par[0] = Number(m[1]); par[1] = Number(m[2]);
      lat.value = String(par[0]); lon.value = String(par[1]);
      guarda();
    },
  }, '📍'));

  return caja;
}

/** Una imagen: miniatura, botón de subir, y el hueco con la dirección por si
 *  hay que pegarla a mano. Se puede soltar el archivo encima de la miniatura. */
function imagen(campo: Campo, fila: any, ctx: Ctx) {
  const caja = el('div', { class: 'imagen' });
  const marco = el('div', { class: 'marco' });
  const derecha = el('div', { style: 'display:grid;gap:.3rem;min-width:0' });
  const mandos = el('div', { style: 'display:flex;gap:.3rem' });
  const barra = el('div', { class: 'barrita', hidden: true }, el('i'));
  const relleno = barra.querySelector('i') as HTMLElement;

  const hueco = el('input', {
    type: 'text', spellcheck: false, placeholder: 'todavía sin imagen',
    value: fila[campo.clave] ?? '',
    oninput: (e: any) => {
      const v = e.target.value.trim();
      if (v) fila[campo.clave] = v; else delete fila[campo.clave];
      pintar();
      ctx.cambiado();
    },
  });

  /**
   * Miniatura y botones, los dos.
   *
   * Los botones se repintaban una sola vez, al construir el campo, así que la
   * foto que acababas de subir se veía pero no traía «Quitar»: para deshacer
   * una foto equivocada había que recargar el panel y perder todo lo demás sin
   * guardar. Es un caso de cada día —te confundes de archivo— y no tenía salida.
   */
  function pintar() {
    marco.replaceChildren(
      fila[campo.clave]
        ? el('img', { src: fila[campo.clave], alt: '', loading: 'lazy' })
        : el('span', { class: 'rotulo', style: 'opacity:.4' }, 'sin foto'),
    );
    mandos.replaceChildren(
      el('button', { type: 'button', class: 'boton suave', onclick: () => elegir.click() },
        fila[campo.clave] ? 'Cambiar' : 'Subir'),
      ...(fila[campo.clave]
        ? [el('button', {
            type: 'button', class: 'boton suave',
            onclick: () => {
              delete fila[campo.clave];
              hueco.value = '';
              pintar();
              ctx.cambiado();
            },
          }, 'Quitar')]
        : []),
    );
  }

  async function subir(archivo: File) {
    const queja = revisarArchivo(archivo);
    if (queja) { ctx.avisar(queja, 'ojo'); return; }

    const carpeta = typeof campo.carpeta === 'function' ? campo.carpeta(fila) : campo.carpeta || '';
    barra.hidden = false; relleno.style.width = '0';
    try {
      const url = await subirImagen(archivo, carpeta, campo.nombreDe?.(fila), (p) => {
        relleno.style.width = p + '%';
      });
      fila[campo.clave] = url;
      hueco.value = url;
      pintar();
      ctx.cambiado();
    } catch (e: any) {
      ctx.avisar('No se pudo subir: ' + (e.message || e), 'error');
    } finally {
      barra.hidden = true;
    }
  }

  const elegir = el('input', {
    type: 'file', accept: 'image/*', hidden: true,
    onchange: (e: any) => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = ''; },
  });

  marco.addEventListener('dragover', (e) => { e.preventDefault(); marco.classList.add('soltando'); });
  marco.addEventListener('dragleave', () => marco.classList.remove('soltando'));
  marco.addEventListener('drop', (e: DragEvent) => {
    e.preventDefault(); marco.classList.remove('soltando');
    const f = e.dataTransfer?.files?.[0]; if (f) subir(f);
  });

  derecha.append(mandos, hueco, barra, elegir);

  pintar();
  caja.append(marco, derecha);
  return caja;
}

/** Las fotos de una edición: una rejilla con su pie debajo, y un hueco al final
 *  para soltar muchas de golpe. Subir treinta fotos es el caso normal aquí. */
function fotos(campo: Campo, fila: any, ctx: Ctx) {
  const caja = el('div', { class: 'fotos' });
  if (!Array.isArray(fila[campo.clave])) fila[campo.clave] = [];

  function pintar() {
    caja.replaceChildren();
    for (const [i, foto] of (fila[campo.clave] as any[]).entries()) {
      caja.append(
        el('div', { class: 'foto' },
          el('img', { src: foto.src, alt: '', loading: 'lazy' }),
          el('input', {
            type: 'text', placeholder: 'pie: quién, dónde, qué se ve',
            value: foto.pie ?? '',
            oninput: (e: any) => {
              const v = e.target.value;
              if (v) foto.pie = v; else delete foto.pie;
              ctx.cambiado();
            },
          }),
          el('div', { style: 'display:flex;gap:.25rem;justify-content:space-between' },
            el('button', { type: 'button', class: 'boton suave', disabled: i === 0,
              onclick: () => { mover(i, i - 1); } }, '←'),
            el('button', { type: 'button', class: 'boton suave',
              onclick: () => {
                if (!confirm('¿Quitar esta foto de la edición?\n\nSe quita de la lista; el archivo sigue en Cloudinary.')) return;
                (fila[campo.clave] as any[]).splice(i, 1); pintar(); ctx.cambiado();
              } }, 'Quitar'),
            el('button', { type: 'button', class: 'boton suave',
              disabled: i === (fila[campo.clave] as any[]).length - 1,
              onclick: () => { mover(i, i + 1); } }, '→'),
          ),
        ),
      );
    }
    caja.append(soltadero());
  }

  function mover(de: number, a: number) {
    const l = fila[campo.clave] as any[];
    if (a < 0 || a >= l.length) return;
    l.splice(a, 0, l.splice(de, 1)[0]);
    pintar(); ctx.cambiado();
  }

  async function subirVarias(archivos: File[]) {
    const carpeta = typeof campo.carpeta === 'function' ? campo.carpeta(fila) : campo.carpeta || '';
    const zona = caja.querySelector('.soltar') as HTMLElement | null;
    let hechas = 0;
    for (const archivo of archivos) {
      const queja = revisarArchivo(archivo);
      if (queja) { ctx.avisar(queja, 'ojo'); continue; }
      if (zona) zona.textContent = `subiendo ${hechas + 1} de ${archivos.length}…`;
      try {
        const url = await subirImagen(archivo, carpeta, undefined, (p) => {
          if (zona) zona.textContent = `subiendo ${hechas + 1} de ${archivos.length} — ${p}%`;
        });
        (fila[campo.clave] as any[]).push({ src: url });
        hechas++;
      } catch (e: any) {
        ctx.avisar(`«${archivo.name}» no subió: ${e.message || e}`, 'error');
      }
    }
    pintar();
    if (hechas) { ctx.cambiado(); ctx.avisar(`${hechas} foto(s) subida(s). Falta guardar.`, 'bien'); }
  }

  function soltadero() {
    const elegir = el('input', {
      type: 'file', accept: 'image/*', multiple: true, hidden: true,
      onchange: (e: any) => { subirVarias([...e.target.files]); e.target.value = ''; },
    });
    const zona = el('button', {
      type: 'button', class: 'soltar', onclick: () => elegir.click(),
    }, 'Soltar fotos aquí, o pulsar para elegir');
    zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('soltando'); });
    zona.addEventListener('dragleave', () => zona.classList.remove('soltando'));
    zona.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault(); zona.classList.remove('soltando');
      subirVarias([...(e.dataTransfer?.files ?? [])]);
    });
    const envoltorio = el('div', { style: 'display:contents' }, zona, elegir);
    return envoltorio;
  }

  pintar();
  return caja;
}
