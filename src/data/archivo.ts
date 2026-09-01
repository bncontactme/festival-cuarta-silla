import { contenido } from './contenido';
import type { Edicion, Foto } from './tipos';

/**
 * El registro histórico del festival: las ediciones anteriores con sus fotos.
 *
 * **Se llama «Galería» de cara al público y «archivo» por dentro**, y no es un
 * despiste. Lo que se guarda es un archivo —ediciones fechadas, con pie de
 * foto, ordenadas de lo más reciente a lo más viejo— pero lo que la gente ve y
 * viene a ver son fotos, y «Galería» es el rótulo que dice eso. Por dentro no
 * se toca nada: el módulo, la colección del panel, la clave de KV y la carpeta
 * de Cloudinary siguen diciendo `archivo`, porque renombrar el almacén por un
 * rótulo es una migración de datos a cambio de nada.
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
 * al índice y `/galeria` se llena sola.
 */

export type { Foto, Edicion };

export const archivo = {
  titulo: 'Galería',
  estado: 'En construcción',
  /** Lo que se lee en el hueco mientras no haya ediciones cargadas. */
  vacio:
    'Estamos juntando las fotos de las tres ediciones anteriores. Si tienes material de alguna, escríbenos.',
  acciones: {
    ver: 'Ver la galería',
    sedes: 'sedes',
    actividades: 'actividades',
  },
  /** **Se edita en `/admin`.** El orden que se pinta es el de la lista: de la
   *  más reciente a la más vieja, que es como se lee un archivo. El panel
   *  avisa si se guarda al revés. */
  lista: contenido.archivo,
};
