/**
 * Quiénes exponen. Pedido del cliente el 26/08: «un apartado de artistas… tipo
 * lo que están poniendo en su insta con las fotos».
 *
 * **La lista está vacía a propósito.** Rige la misma regla que `site.ts`: aquí
 * no se inventa contenido. Mientras no lleguen los nombres, la sección de la
 * portada y la página `/artistas` se pintan en su estado vacío —el rótulo, el
 * titular y una ficha que dice «Por anunciar»— y en cuanto se pegue la primera
 * ficha aquí, la reja aparece sola. No hay que tocar ni una plantilla.
 *
 * Qué hace falta por artista, en orden de importancia:
 *   1. `nombre`      — obligatorio, es lo único que no puede faltar.
 *   2. `foto`        — a `public/artistas/`, recortada a 4:5 (p. ej. 1000×1250).
 *                      Sin foto la ficha sale con la caja en amarillo y el
 *                      nombre en grande, que es un hueco honesto, no un error.
 *   3. `disciplina`  — dos o tres palabras: «performance», «gráfica
 *                      expandida», «instalación sonora».
 *   4. `instagram`   — la URL entera. Sin ella la ficha sale sin el botón «IG».
 *   5. `sede`        — tiene que coincidir LETRA POR LETRA con un `nombre` de
 *                      `sedes.lista`, que es como empareja `sedeDe()`.
 */

export type Artista = {
  nombre: string;
  disciplina?: string;
  /** Ruta absoluta dentro de `public/`, en 4:5. */
  foto?: string;
  instagram?: string;
  /** Debe existir en `sedes.lista`. */
  sede?: string;
};

export const artistas = {
  titulo: 'Artistas',
  estado: 'Por anunciar',
  /** Lo que se lee en el hueco mientras no haya lista. */
  vacio:
    'La selección se anuncia junto con el programa. Se irá publicando también en la cuenta del festival.',
  acciones: {
    ver: 'Ver a todxs',
    instagram: 'IG',
  },
  lista: [] satisfies Artista[],
};
