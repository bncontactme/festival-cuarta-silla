/**
 * El registro histórico del festival: las ediciones anteriores con sus fotos.
 * Pedido del cliente el 26/08: «necesitamos un apartado de registro histórico
 * del festival, de que subir fotos y así… de las ediciones».
 *
 * **La lista está vacía a propósito**, igual que la de artistas: ésta es la
 * cuarta edición, así que hubo tres antes, pero de ninguna tenemos ni el año
 * confirmado ni una sola foto. Inventarlos sería peor que el hueco. En cuanto
 * se pegue la primera edición aquí, la banda de la portada pasa de la línea de
 * «en construcción» al índice, y `/archivo` se llena sola.
 *
 * Qué hace falta por edición:
 *   1. `edicion`     — cómo se llamó: «Primera Silla», «Segunda Silla»…
 *   2. `anio`        — cuatro cifras, en texto.
 *   3. `fotos`       — a `public/archivo/<anio>/`, apaisadas (4:3). El `pie` es
 *                      opcional pero es lo que convierte un álbum en un
 *                      archivo: quién, dónde, qué se ve.
 *   4. `sedes` / `actividades` — los números que van en el índice. Si no se
 *                      saben, se dejan fuera y la columna no se pinta.
 *   5. `lema`        — si esa edición tuvo uno.
 *
 * El orden de la lista es el que se pinta: **de la más reciente a la más
 * vieja**, que es como se lee un archivo.
 */

export type Foto = {
  /** Ruta absoluta dentro de `public/`. */
  src: string;
  /** Quién, dónde, qué se ve. Sale debajo de la foto. */
  pie?: string;
};

export type Edicion = {
  edicion: string;
  anio: string;
  lema?: string;
  sedes?: number;
  actividades?: number;
  fotos: Foto[];
};

export const archivo = {
  titulo: 'Archivo',
  estado: 'En construcción',
  /** Lo que se lee en el hueco mientras no haya ediciones cargadas. */
  vacio:
    'Estamos juntando las fotos de las tres ediciones anteriores. Si tienes material de alguna, escríbenos.',
  acciones: {
    ver: 'Ver el archivo',
    sedes: 'sedes',
    actividades: 'actividades',
  },
  lista: [] satisfies Edicion[],
};
