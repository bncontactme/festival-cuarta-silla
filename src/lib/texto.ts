/**
 * Aplanar un texto para poder compararlo.
 *
 * Existe por el buscador de `/artistas`, y existe como archivo suelto —en vez
 * de dentro del componente— porque hacen falta las DOS mitades de la misma
 * regla en dos sitios distintos: la plantilla aplana el nombre del artista al
 * construir el sitio, y el script del navegador aplana lo que se teclea. Si
 * cada uno lo hiciera a su manera, la búsqueda fallaría exactamente en los
 * nombres que más lo necesitan.
 *
 * Y son muchos: de los dieciocho artistas, la mitad lleva tilde o eñe —Alí,
 * Fabián, Gutiérrez, Cárdenas, Poiré, García, Muñoz, Ávila, Yü—. Nadie escribe
 * «Alí» en un buscador; se escribe «ali». Una búsqueda que exige la tilde no
 * es una búsqueda, es un examen de ortografía.
 *
 * `NFD` separa la letra de su acento y `\p{Diacritic}` se lleva los acentos,
 * que quedan sueltos como caracteres propios. La eñe pasa por lo mismo: se
 * descompone en `n` + tilde.
 */
export const aplanar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
