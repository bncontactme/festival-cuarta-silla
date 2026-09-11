/**
 * El programa, por días y en bloques. **Es la vista del programa**: la única.
 *
 * Hubo un momento en que esto y el cuadro de horarios se turnaban como «dos
 * lecturas de la misma lista», copiando lo que hace `/programa` en el sitio. En
 * el sitio está bien —son dos formas de leer, y quien mira elige—; en el panel
 * no, porque aquí no se lee: aquí se trabaja. Tener el programa en dos sitios
 * planteaba en cada cambio la misma duda de siempre, cuál de los dos es el
 * bueno, y dejaba media información en cada uno.
 *
 * Así que el programa está aquí entero. Lo que enseñaba el cuadro de horarios y
 * una lista no suele decir —**con qué choca cada actividad**— se dice aquí con
 * palabras, y el cuadro se queda con lo suyo: verlo, que para eso sirve una
 * línea de tiempo y no una lista.
 *
 * Cada actividad es un bloque: la hora a la izquierda, qué es y dónde en medio,
 * su texto de sala a la derecha. Y cada día dice en su cabecera cuántas van y
 * cuántas llevan cartela, que es lo que de verdad se venía a ver.
 */
import { el } from './dom';
import { cruces } from './previa';
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
  // Los choques salen del programa entero y no del día que se esté mirando ni
  // de lo que el filtro deje ver: buscar «taller» no puede hacer desaparecer el
  // aviso de que ese taller se encima con otra cosa.
  const choques = cruces(actividades);

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
    const chocan = delDia.filter((a) => choques.has(a)).length;

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
      // El día que algo se encima, la cabecera lo dice antes de que nadie baje a
      // buscarlo. Es el aviso que antes sólo existía en el cuadro de horarios.
      chocan ? el('span', { class: 'dia-choques' }, `⚠ ${chocan} se enciman`) : null,
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
    for (const a of vistas) actos.append(pintarActo(a, mandos, choques.get(a)));
    bloque.append(actos);
    caja.append(bloque);
  });

  return caja;
}

function pintarActo(a: any, mandos: MandosLista, choca?: any[]): HTMLElement {
  const estado = a.sala ? (a.sala.publicado ? 'publicado' : 'borrador') : 'no';

  return el('article', {
    class: 'acto' + (choca ? ' acto--choca' : ''),
    'data-sala': estado,
  },
    // Las dos horas y no sólo la de entrada: el cuadro de horarios enseñaba el
    // largo de la barra, y aquí eso es «hasta cuándo». Sin el fin, saber si una
    // actividad sigue abierta a las nueve pedía abrir su fila en la tabla.
    el('p', { class: 'acto-hora' },
      a.inicio || '—',
      el('span', { class: 'acto-fin-hora' }, a.fin ? `–${a.fin}` : ''),
      el('small', {}, dura(a.inicio, a.fin)),
    ),

    el('div', { class: 'acto-med' },
      el('span', { class: 'acto-tipo', 'data-tipo': a.tipo ?? '' }, a.tipo ?? 'sin tipo'),
      el('h5', {}, a.titulo || 'Sin título'),
      a.artista && el('p', { class: 'acto-quien' }, a.artista),
      el('p', { class: 'acto-donde' }, a.sede || 'sin sede'),

      // Con quién se encima, por su nombre. En el cuadro de horarios esto es un
      // marco rojo alrededor de dos barras y se entiende de un golpe; en una
      // lista, dos cosas a la misma hora en la misma sede están separadas por
      // renglones y no se ven. Así que aquí se dice.
      choca && el('p', { class: 'acto-choque' },
        choca.length === 1
          ? `⚠ Se encima con «${choca[0].titulo || 'sin título'}» en ${a.sede}`
          : `⚠ Se encima con ${choca.length} actividades en ${a.sede}: ` +
            choca.map((x: any) => `«${x.titulo || 'sin título'}»`).join(', ')),
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
