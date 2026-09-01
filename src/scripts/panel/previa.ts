/**
 * La rejilla del programa, en chiquito.
 *
 * Es lo que una tabla no te dice: si dos cosas se encimaron en la misma sede, o
 * si un día quedó vacío. No pretende parecerse a la rejilla del sitio —esa la
 * pinta `Gantt.astro` y son 1685 líneas—: es un boceto para mirar de un golpe
 * antes de guardar.
 */
import { COLOR_TIPO } from './esquema';
import { el } from './dom';

const ABRE = 8 * 60;    // 08:00
const CIERRA = 24 * 60; // 24:00
const LARGO = CIERRA - ABRE;

const min = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));

export function pintarPrevia(actividades: any[], dias: string[]): HTMLElement {
  const caja = el('div', { class: 'previa' });
  caja.append(el('div', { class: 'rotulo', style: 'opacity:.55;margin-bottom:.4rem' },
    'Vista previa — dónde y cuándo'));

  const validas = actividades.filter((a) => a.inicio && a.fin && a.sede);
  if (!validas.length) {
    caja.append(el('p', { style: 'font-size:.8rem;opacity:.55' },
      'Cuando haya actividades con hora y sede, aquí se ve si algo se encima.'));
    return caja;
  }

  // Se marcan las que chocan: misma sede, mismo día y horas que se solapan.
  const choca = new Set<any>();
  for (let i = 0; i < validas.length; i++) {
    for (let j = i + 1; j < validas.length; j++) {
      const a = validas[i], b = validas[j];
      if (a.sede !== b.sede || a.dia !== b.dia) continue;
      if (min(a.inicio) < min(b.fin) && min(b.inicio) < min(a.fin)) { choca.add(a); choca.add(b); }
    }
  }

  dias.forEach((nombre, d) => {
    const delDia = validas.filter((a) => Number(a.dia) === d);
    const bloque = el('div', { class: 'dia' },
      el('h4', {}, `${nombre} — ${delDia.length || 'nada'} ${delDia.length === 1 ? 'actividad' : 'actividades'}`));

    // Una sede por carril, en el orden en que aparecen: así se lee como la
    // rejilla del sitio y no hace falta buscar.
    const sedes = [...new Set(delDia.map((a) => a.sede))];
    for (const sede of sedes) {
      const pista = el('div', { class: 'pista' });
      for (const a of delDia.filter((x) => x.sede === sede)) {
        const i = Math.max(ABRE, min(a.inicio));
        const f = Math.min(CIERRA, Math.max(min(a.fin), i + 15));
        const color = COLOR_TIPO[a.tipo] ?? { fondo: '#ddd', texto: '#1e1e1e' };
        pista.append(el('div', {
          class: 'bloque' + (choca.has(a) ? ' choca' : ''),
          style: `left:${((i - ABRE) / LARGO) * 100}%;width:${((f - i) / LARGO) * 100}%;` +
                 `background:${color.fondo};color:${color.texto}`,
          title: `${a.titulo} · ${a.inicio}–${a.fin} · ${a.sede}`,
        }, a.titulo || '—'));
      }
      bloque.append(el('div', { class: 'carril' }, el('span', { title: sede }, sede), pista));
    }

    if (!delDia.length) {
      bloque.append(el('p', { style: 'font-size:.7rem;opacity:.45;padding:.2rem 0' },
        'Este día está vacío.'));
    }
    caja.append(bloque);
  });

  caja.append(el('div', { class: 'horas' }, el('div'), el('div',
    {}, ...['08:00', '12:00', '16:00', '20:00', '24:00'].map((h) => el('span', {}, h)))));

  const leyenda = el('div', { class: 'leyenda' });
  for (const [tipo, color] of Object.entries(COLOR_TIPO)) {
    leyenda.append(el('span', {},
      el('i', { style: `background:${color.fondo}` }), tipo));
  }
  if (choca.size) {
    leyenda.append(el('span', { style: 'color:#ff0100' },
      `⚠ ${choca.size} actividades se enciman en su sede`));
  }
  caja.append(leyenda);

  return caja;
}
