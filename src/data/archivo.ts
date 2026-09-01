import { contenido } from './contenido';
import type { Edicion, Foto } from './tipos';

/**
 * El registro histórico del festival: las ediciones anteriores con sus fotos.
 * Pedido del cliente el 26/08: «necesitamos un apartado de registro histórico
 * del festival, de que subir fotos y así… de las ediciones».
 *
 * La lista **la carga el festival desde `/admin`**; aquí sólo queda el texto de
 * la sección. Los tipos `Edicion` y `Foto` viven en `tipos.ts`, con qué hace
 * falta por edición.
 *
 * Puede estar vacía y no pasa nada: ésta es la cuarta edición, así que hubo
 * tres antes, pero de ninguna teníamos ni el año confirmado ni una sola foto.
 * Inventarlos sería peor que el hueco, y el hueco está diseñado. Con la primera
 * edición cargada, la banda de la portada pasa de la línea de «en construcción»
 * al índice y `/archivo` se llena sola.
 */

export type { Foto, Edicion };

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
  /** **Se edita en `/admin`.** El orden que se pinta es el de la lista: de la
   *  más reciente a la más vieja, que es como se lee un archivo. El panel
   *  avisa si se guarda al revés. */
  lista: contenido.archivo,
};
