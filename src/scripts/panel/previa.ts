/**
 * **Horarios**: qué hay a la vez y en qué sede, un día por vez.
 *
 * Se llamaba «Rejilla» y era un mal nombre, porque prometía lo que no es. Esto
 * no es el programa —el programa es la lista, y la pestaña ya se llama
 * Programa—: es el cuadro de horarios, y sirve para una pregunta que una lista
 * no contesta nunca por muy ordenada que esté: **qué se encima con qué**. Cada
 * sede es un carril, el tiempo corre de izquierda a derecha, y dos cosas en la
 * misma sede a la misma hora se ven pisándose.
 *
 * Lo que ve aquí no es exclusivo suyo: los choques que detecta se los pasa
 * también a la lista, que los dice con palabras. Aquí se ven; allá se leen.
 *
 * **Un día a la vez.** Antes se pintaban los cuatro apilados. Con catorce
 * actividades eso cabía; con treinta y nueve son ocho carriles por día y la
 * pestaña se convirtió en metro y medio de scroll donde lo que se quería ver
 * —si el viernes a las siete hay tres cosas en la misma sede— quedaba a la
 * altura de la rodilla. Las pestañas de día son las mismas que ya tiene la
 * rejilla del sitio, y por la misma razón.
 */
import { COLOR_TIPO } from './esquema';
import { el } from './dom';
import { cruces } from './choques';

const ABRE = 10 * 60;   // 10:00 — el recorrido de los fines de semana empieza aquí
const CIERRA = 24 * 60; // 24:00
const LARGO = CIERRA - ABRE;

const min = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));


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
    'aria-label': 'Qué día de los horarios',
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
    el('span', { class: 'rotulo' }, 'Qué hay a la vez'),
    mando,
  ));

  const choca = new Set(cruces(actividades).keys());
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
        // Una barra que abre su propio descripción: aquí es donde se ve «esta
        // pieza está sola toda la tarde», que es justo cuando alguien se
        // acuerda de que le falta la cartela.
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
  leyenda.append(el('span', { class: 'leyenda-sala' }, '▣ con descripción'));
  if (choca.size) {
    leyenda.append(el('span', { style: 'color:#ff0100' },
      `⚠ ${choca.size} actividades se enciman en su sede`));
  }
  caja.append(leyenda);

  return caja;
}
