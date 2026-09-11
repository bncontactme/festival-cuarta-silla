/**
 * El renglón plegado de una actividad, cuando una línea de texto no basta.
 *
 * **Esto fue una vista y ya no lo es.** Hubo un momento en que el programa se
 * enseñaba dos veces en la misma pantalla: una lista de bloques bonita arriba,
 * de sólo mirar, y debajo la tabla de siempre con las treinta y nueve otra vez
 * —que era la que de verdad servía, porque es donde se editan los campos, se
 * duplica, se borra y se añade—. Dos listas de lo mismo, una encima de la otra,
 * y la duda en cada cambio de cuál de las dos es la buena.
 *
 * Son la misma. El bloque no era una vista: era un renglón mejor. Así que vive
 * aquí, la tabla lo usa como resumen plegado, y debajo del mismo bloque se abren
 * los campos de siempre. Una lista, con lo viejo y lo nuevo dentro.
 *
 * Lo que aporta sobre el renglón de texto que había antes:
 *   · la hora de entrada y de salida, y cuánto dura;
 *   · el tipo con su tinta, que es como se lee la rejilla del sitio;
 *   · **con qué se encima**, por su nombre — lo que sólo decía el cuadro de
 *     horarios, y que en una lista hay que escribir porque no se ve;
 *   · el texto de sala: su estado, su dirección, su QR y sus botones.
 */
import { el } from './dom';
import { qrChico, rutaDe } from './sala';

export type MandosSala = {
  raiz: () => string;
  /** Abrir el texto de sala de esta actividad. */
  alSala: (a: any) => void;
  /** Mandar esta cartela a la impresora. */
  alImprimir: (a: any) => void;
};

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

/**
 * Lo que va dentro del botón que pliega y despliega la fila.
 *
 * Devuelve hijos y no un nodo suelto porque quien lo llama es `pintarTabla`, y
 * lo mete en su propio `<button>`: aquí dentro no puede haber nada que se pulse
 * —un botón dentro de otro botón no es HTML—, y por eso los mandos del texto de
 * sala se devuelven aparte, en `mandoSala()`.
 */
export function bloqueActividad(a: any, choca?: any[]): HTMLElement[] {
  return [
    // Las dos horas y no sólo la de entrada: el cuadro de horarios enseñaba el
    // largo de la barra, y aquí eso es «hasta cuándo». Sin el fin, saber si una
    // actividad sigue abierta a las nueve pedía abrir la fila.
    el('p', { class: 'acto-hora' },
      a.inicio || '—',
      el('span', { class: 'acto-fin-hora' }, a.fin ? `–${a.fin}` : ''),
      el('small', {}, dura(a.inicio, a.fin)),
    ),

    el('div', { class: 'acto-med' },
      el('span', { class: 'acto-tipo', 'data-tipo': a.tipo ?? '' }, a.tipo ?? 'sin tipo'),
      el('h5', {}, a.titulo || 'Sin título'),
      a.artista ? el('p', { class: 'acto-quien' }, a.artista) : null,
      el('p', { class: 'acto-donde' }, a.sede || 'sin sede'),

      // Con quién se encima, por su nombre. En el cuadro de horarios esto es un
      // marco rojo alrededor de dos barras y se entiende de un golpe; en una
      // lista, dos cosas a la misma hora en la misma sede están separadas por
      // renglones y no se ven. Así que aquí se dice.
      choca ? el('p', { class: 'acto-choque' },
        choca.length === 1
          ? `⚠ Se encima con «${choca[0].titulo || 'sin título'}» en ${a.sede}`
          : `⚠ Se encima con ${choca.length} actividades en ${a.sede}: ` +
            choca.map((x: any) => `«${x.titulo || 'sin título'}»`).join(', ')) : null,
    ) as HTMLElement,
  ].filter(Boolean) as HTMLElement[];
}

/**
 * Los mandos del texto de sala, a la derecha del renglón.
 *
 * Tres estados y ninguno es un botón apagado: lo que no tiene texto enseña la
 * puerta de crearlo, no la de que no hay.
 */
export function mandoSala(a: any, mandos: MandosSala): HTMLElement {
  if (!a.sala) {
    return el('div', { class: 'acto-fin' },
      el('button', {
        type: 'button', class: 'sala-off',
        onclick: () => mandos.alSala(a),
      }, '+ Texto de sala'),
    );
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
    ),
  );

  // El QR sólo cuando hay página detrás. En borrador sería enseñar un código
  // que se puede fotografiar y que no lleva a ningún sitio.
  return el('div', { class: 'acto-fin' },
    publicado ? el('div', { class: 'sala-on' }, qrChico(url), datos) : datos,
  );
}
