/**
 * Los campos alternos del sitio, para las listas que se pintan como tarjetas.
 *
 * Los campos son dos —amarillo y rojo— y se turnan. Salen del feed del
 * festival, donde las publicaciones se alternan, y son los mismos que se
 * turnan en las cuatro puertas de la portada del móvil y en las bandas de
 * todas las páginas. Ni el papel ni la tinta visten un campo: el papel es el
 * marco de una foto y la tinta es con lo que se escribe.
 *
 * Vive aquí y no en cada página porque lo usan dos —`/registro` y la lista de
 * días de `/programa` en el teléfono—, y dos listas que se turnan con distinto
 * pie se leen como dos sistemas.
 */
const campos = ['rojo', 'amarillo'] as const;

export const campoDe = (i: number) => campos[i % campos.length];

/**
 * Clase y estilo de una tarjeta según su posición en la lista.
 *
 * `--fondo` y `--texto` viajan como variables porque de ellas cuelga también
 * la puerta, que así nunca es del color de lo que tiene detrás sin que nadie
 * lo decida dos veces.
 *
 * El modificador vuelca la letra chica a papel sobre el campo rojo: amarillo
 * sobre rojo son 3,67:1 de partida, y bajarle la opacidad —que es lo que se
 * hace sobre el campo amarillo— lo deja por debajo de 3. Es la misma regla que
 * ya sigue la barra de las pantallas de móvil.
 */
export const tarjetaAlterna = (i: number, forma: 'fila' | 'bloque') => {
  const rojo = campoDe(i) === 'rojo';
  return {
    clase: `evento evento--${forma}${rojo ? ' evento--campo-oscuro' : ''}`,
    estilo: rojo
      ? '--fondo:var(--color-rojo);--texto:var(--color-amarillo)'
      : '--fondo:var(--color-amarillo);--texto:var(--color-tinta)',
  };
};
