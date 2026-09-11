/**
 * La rejilla del programa, en chiquito. Una de las dos vistas de la pestaña.
 *
 * Es lo que una tabla no te dice: si dos cosas se encimaron en la misma sede, o
 * si un día quedó vacío. No pretende parecerse a la rejilla del sitio —esa la
 * pinta `Gantt.astro` y son 1791 líneas—: es un boceto para mirar de un golpe
 * antes de guardar.
 *
 * **Un día a la vez.** Antes se pintaban los cuatro apilados. Con catorce
 * actividades eso cabía; con treinta y dos son ocho carriles por día y la
 * pestaña se convirtió en metro y medio de scroll donde lo que se quería ver
 * —si el viernes a las siete hay tres cosas en la misma sede— quedaba a la
 * altura de la rodilla. Las pestañas de día son las mismas que ya tiene la
 * rejilla del sitio, y por la misma razón.
 */
import { COLOR_TIPO } from './esquema';
import { el } from './dom';

const ABRE = 10 * 60;   // 10:00 — el recorrido de los fines de semana empieza aquí
const CIERRA = 24 * 60; // 24:00
const LARGO = CIERRA - ABRE;

const min = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));

/** Las que se pisan: misma sede, mismo día y horas que se solapan. Se calcula
 *  sobre TODO el programa y no sobre el día que se está viendo, porque el
 *  rótulo de abajo cuenta las de los cuatro días: cambiar de pestaña no puede
 *  hacer que un choque deje de existir. */
function choques(actividades: any[]): Set<any> {
  const validas = actividades.filter((a) => a.inicio && a.fin && a.sede);
  const choca = new Set<any>();
  for (let i = 0; i < validas.length; i++) {
    for (let j = i + 1; j < validas.length; j++) {
      const a = validas[i], b = validas[j];
      if (a.sede !== b.sede || Number(a.dia) !== Number(b.dia)) continue;
      if (min(a.inicio) < min(b.fin) && min(b.inicio) < min(a.fin)) { choca.add(a); choca.add(b); }
    }
  }
  return choca;
}

export function pintarPrevia(
  actividades: any[],
  dias: string[],
  diaActivo: number,
  alCambiarDia: (d: number) => void,
  alTocar?: (a: any) => void,
): HTMLElement {
  const caja = el('div', { class: 'previa' });

  // ── Mando de día ──────────────────────────────────────────────────────────
  const mando = el('div', {
    class: 'conmutador conmutador--dias',
    role: 'tablist',
    'aria-label': 'Qué día de la rejilla',
    style: `--celdas:${dias.length};--activa:${diaActivo}`,
  }, el('span', { class: 'burbuja', 'aria-hidden': 'true' }));

  dias.forEach((nombre, i) => {
    const cuantas = actividades.filter((a) => Number(a.dia) === i).length;
    mando.append(el('button', {
      type: 'button', role: 'tab', 'aria-selected': String(i === diaActivo),
      onclick: () => alCambiarDia(i),
    },
      el('span', { class: 'dia' }, nombre.split(' ')[0]),
      el('span', { class: 'nota' }, `${nombre.split(' ').slice(1).join(' ')} · ${cuantas}`),
    ));
  });

  caja.append(el('div', { class: 'previa-cabeza' },
    el('span', { class: 'rotulo' }, 'Dónde y cuándo'),
    mando,
  ));

  const choca = choques(actividades);
  const validas = actividades.filter((a) => a.inicio && a.fin && a.sede);

  if (!validas.length) {
    caja.append(el('p', { class: 'previa-vacia' },
      'Cuando haya actividades con hora y sede, aquí se ve si algo se encima.'));
    return caja;
  }

  const delDia = validas.filter((a) => Number(a.dia) === diaActivo);
  const pista = el('div', { class: 'previa-cuerpo' });

  if (!delDia.length) {
    pista.append(el('p', { class: 'previa-vacia' }, 'Este día está vacío.'));
  } else {
    pista.append(el('div', { class: 'horas' }, el('div'), el('div', {},
      ...['10:00', '13:00', '16:00', '19:00', '22:00', '24:00'].map((h) => el('span', {}, h)))));

    // Una sede por carril, en el orden en que aparecen: así se lee como la
    // rejilla del sitio y no hace falta buscar.
    const sedes = [...new Set(delDia.map((a) => a.sede))];
    for (const sede of sedes) {
      const carril = el('div', { class: 'pista' });
      for (const a of delDia.filter((x) => x.sede === sede)) {
        const i = Math.max(ABRE, min(a.inicio));
        const f = Math.min(CIERRA, Math.max(min(a.fin), i + 15));
        const color = COLOR_TIPO[a.tipo] ?? { fondo: '#ddd', texto: '#1e1e1e' };
        // Una barra que abre su propio texto de sala: en la rejilla es donde se
        // ve «esta pieza está sola toda la tarde», que es justo cuando alguien
        // se acuerda de que le falta la cartela.
        carril.append(el('button', {
          type: 'button',
          class: 'bloque' + (choca.has(a) ? ' choca' : ''),
          style: `left:${((i - ABRE) / LARGO) * 100}%;width:${((f - i) / LARGO) * 100}%;` +
                 `background:${color.fondo};color:${color.texto}`,
          title: `${a.titulo} · ${a.inicio}–${a.fin} · ${a.sede}`,
          onclick: () => alTocar?.(a),
        }, (a.sala ? (a.sala.publicado ? '▣ ' : '▢ ') : '') + (a.titulo || '—')));
      }
      pista.append(el('div', { class: 'carril' }, el('span', { title: sede }, sede), carril));
    }
  }

  caja.append(pista);

  const leyenda = el('div', { class: 'leyenda' });
  for (const [tipo, color] of Object.entries(COLOR_TIPO)) {
    leyenda.append(el('span', {}, el('i', { style: `background:${color.fondo}` }), tipo));
  }
  leyenda.append(el('span', { class: 'leyenda-sala' }, '▣ con texto de sala'));
  if (choca.size) {
    leyenda.append(el('span', { style: 'color:#ff0100' },
      `⚠ ${choca.size} actividades se enciman en su sede`));
  }
  caja.append(leyenda);

  return caja;
}
