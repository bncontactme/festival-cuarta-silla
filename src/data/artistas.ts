import { contenido } from './contenido';
import type { Artista } from './tipos';

/**
 * Quiénes exponen. Pedido del cliente el 26/08: «un apartado de artistas… tipo
 * lo que están poniendo en su insta con las fotos».
 *
 * La lista **la carga el festival desde `/admin`**; aquí sólo queda el texto de
 * la sección. El tipo `Artista` vive en `tipos.ts` y las fotos pasan por
 * `imagen()`, así que da igual si están en `public/` o en Cloudinary.
 *
 * **La lista puede estar vacía y no pasa nada**: rige la misma regla que
 * `site.ts` —aquí no se inventa contenido—, y el estado vacío está diseñado.
 *
 * Qué hace falta por artista y por qué, campo a campo: `tipos.ts`.
 */

export type { Artista };

export const artistas = {
  titulo: 'Artistas',
  /** Lo que se lee en el hueco mientras no haya lista.
   *
   *  No lleva rótulo de estado —«Por anunciar», «Todavía no hay nombres»—:
   *  decir dos veces que la lista está vacía cuando se está viendo vacía no
   *  informa de nada. Lo único que el visitante no sabe es CUÁNDO, y eso es
   *  justo lo que dice este texto. */
  vacio: {
    titulo: 'La selección se anuncia junto con el programa',
    nota: 'Se irá publicando también en la cuenta del festival.',
  },
  acciones: {
    ver: 'Ver a todxs',
    instagram: 'IG',
  },
  /** **Se edita en `/admin`.** Vacía, la portada y `/artistas` se pintan solas
   *  en su estado vacío; con la primera ficha, la reja aparece sin tocar nada. */
  lista: contenido.artistas,
};
