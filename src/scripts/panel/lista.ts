/**
 * El programa por bloques, agrupado por día. La otra vista de la pestaña.
 *
 * La rejilla contesta «qué se pisa con qué». Esto contesta «qué le falta a esta
 * actividad», que es la pregunta de la semana antes del festival y la que no
 * tenía dónde hacerse: en la tabla, con las filas plegadas, el texto de sala de
 * la actividad diecisiete estaba a diecisiete clics de distancia, y saber
 * cuántas lo llevaban ya requería abrirlas todas.
 *
 * Aquí cada actividad es un bloque con su hora a la izquierda —como en la
 * rejilla— y su texto de sala a la derecha, y cada día dice en su cabecera
 * cuántos van. Eso último es lo que de verdad se venía a ver.
 */
import { el } from './dom';
import { qrChico, rutaDe } from './sala';

export type MandosLista = {
  dias: () => string[];
  raiz: () => string;
  busqueda: () => string;
  soloConSala: () => boolean;
  /** Abrir el texto de sala de esta actividad. */
  alSala: (a: any) => void;
  /** Llevar a esta fila de la tabla, para tocar el resto de sus campos. */
  alEditar: (a: any) => void;
  /** Mandar esta cartela a la impresora. */
  alImprimir: (a: any) => void;
};

const pelar = (s: string) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Cuánto dura, dicho como lo diría una persona. */
function dura(inicio: string, fin: string): string {
  if (!inicio || !fin) return '';
  const m = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
  const t = m(fin) - m(inicio);
  if (t <= 0) return '';
  if (t < 60) return `${t} min`;
  const h = Math.floor(t / 60), r = t % 60;
  return r ? `${h} h ${r}` : `${h} h`;
}

export function pintarLista(actividades: any[], mandos: MandosLista): HTMLElement {
  const caja = el('div', { class: 'lista' });
  const dias = mandos.dias();
  const q = pelar(mandos.busqueda().trim());
  const solo = mandos.soloConSala();

  const pasa = (a: any) => {
    if (solo && !a.sala) return false;
    if (!q) return true;
    return pelar([a.titulo, a.artista, a.sede, a.tipo].filter(Boolean).join(' ')).includes(q);
  };

  dias.forEach((nombre, d) => {
    const delDia = actividades
      .filter((a) => Number(a.dia) === d)
      .sort((x, y) => String(x.inicio ?? '').localeCompare(String(y.inicio ?? '')));
    const vistas = delDia.filter(pasa);
    const conSala = delDia.filter((a) => a.sala).length;

    const bloque = el('section', { class: 'dia-bloque' });

    bloque.append(el('header', { class: 'dia-cabeza' },
      el('span', { class: 'n' }, String(d + 1).padStart(2, '0')),
      el('h4', {}, nombre.split(' ')[0]),
      el('span', { class: 'f' }, nombre.split(' ').slice(1).join(' ')),
      el('span', { class: 'cuenta' },
        delDia.length === 0
          ? 'sin actividades'
          : `${delDia.length} ${delDia.length === 1 ? 'actividad' : 'actividades'}` +
            (conSala ? ` · ${conSala} con texto de sala` : '')),
    ));

    if (!vistas.length) {
      bloque.append(el('p', { class: 'lista-vacia' },
        delDia.length
          ? `Ninguna de las ${delDia.length} de este día cuadra con lo que buscas.`
          : 'Este día está vacío.'));
      caja.append(bloque);
      return;
    }

    const actos = el('div', { class: 'actos' });
    for (const a of vistas) actos.append(pintarActo(a, mandos));
    bloque.append(actos);
    caja.append(bloque);
  });

  return caja;
}

function pintarActo(a: any, mandos: MandosLista): HTMLElement {
  const estado = a.sala ? (a.sala.publicado ? 'publicado' : 'borrador') : 'no';

  return el('article', { class: 'acto', 'data-sala': estado },
    el('p', { class: 'acto-hora' },
      a.inicio || '—',
      el('small', {}, dura(a.inicio, a.fin)),
    ),

    el('div', { class: 'acto-med' },
      el('span', { class: 'acto-tipo', 'data-tipo': a.tipo ?? '' }, a.tipo ?? 'sin tipo'),
      el('h5', {}, a.titulo || 'Sin título'),
      a.artista && el('p', { class: 'acto-quien' }, a.artista),
      el('p', { class: 'acto-donde' }, a.sede || 'sin sede'),
    ),

    el('div', { class: 'acto-fin' }, ...mandoSala(a, mandos)),
  );
}

/** El control del texto de sala. Tres estados, y ninguno es un botón apagado:
 *  lo que no tiene texto enseña la puerta de crearlo, no la de que no hay. */
function mandoSala(a: any, mandos: MandosLista): HTMLElement[] {
  const editar = el('button', {
    type: 'button', class: 'acto-mini', title: 'Abrir la fila de esta actividad',
    onclick: () => mandos.alEditar(a),
  }, 'Campos');

  if (!a.sala) {
    return [
      el('button', {
        type: 'button', class: 'sala-off',
        onclick: () => mandos.alSala(a),
      }, '+ Texto de sala'),
      editar,
    ];
  }

  const publicado = Boolean(a.sala.publicado);
  const url = rutaDe(mandos.raiz(), a.sala.id);

  const datos = el('div', { class: 'sala-datos' },
    el('span', { class: 'estado ' + (publicado ? 'estado--pub' : 'estado--bor') },
      publicado ? '▣ Publicado' : '▢ Borrador'),
    el('span', { class: 'ruta', title: url }, '/sala/' + a.sala.id),
    el('span', { class: 'acto-acciones' },
      el('button', { type: 'button', onclick: () => mandos.alSala(a) }, 'Texto'),
      publicado
        ? el('button', { type: 'button', onclick: () => mandos.alImprimir(a) }, 'Cartela')
        : null,
      editar,
    ),
  );

  // El QR sólo cuando hay página detrás. En borrador sería enseñar un código
  // que se puede fotografiar y que no lleva a ningún sitio.
  return publicado ? [el('div', { class: 'sala-on' }, qrChico(url), datos)] : [datos];
}
