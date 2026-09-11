/**
 * Qué se encima con qué.
 *
 * Vive en su propio archivo y no dentro de una de las dos vistas porque lo usan
 * las dos: el cuadro de horarios le pone marco rojo a las barras que chocan, y
 * la lista lo dice con palabras. Tenerlo en `previa.ts` dejaba a `esquema.ts`
 * importando de `previa.ts` mientras `previa.ts` importaba de `esquema.ts`, que
 * es un círculo que funciona por suerte —por el orden en que se cargan— hasta
 * el día que alguien mueve un `import` de sitio.
 */

const min = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));

/**
 * Las que se pisan: misma sede, mismo día y horas que se solapan.
 *
 * Devuelve **con quién** choca cada una y no sólo cuáles chocan, porque las dos
 * vistas lo necesitan distinto: al cuadro le basta con saber a cuál ponerle el
 * marco rojo, pero la lista lo tiene que decir con palabras —«se encima con
 * “X”»— y para eso hace falta el nombre del otro.
 *
 * Se calcula sobre TODO el programa y no sobre lo que se esté mirando: ni
 * cambiar de día ni buscar «taller» pueden hacer que un choque deje de existir.
 */
export function cruces(actividades: any[]): Map<any, any[]> {
  const validas = actividades.filter((a) => a.inicio && a.fin && a.sede);
  const mapa = new Map<any, any[]>();
  const anota = (a: any, b: any) => {
    const ya = mapa.get(a);
    if (ya) ya.push(b); else mapa.set(a, [b]);
  };
  for (let i = 0; i < validas.length; i++) {
    for (let j = i + 1; j < validas.length; j++) {
      const a = validas[i], b = validas[j];
      if (a.sede !== b.sede || Number(a.dia) !== Number(b.dia)) continue;
      if (min(a.inicio) < min(b.fin) && min(b.inicio) < min(a.fin)) { anota(a, b); anota(b, a); }
    }
  }
  return mapa;
}
