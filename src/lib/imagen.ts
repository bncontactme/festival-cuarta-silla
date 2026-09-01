import { conBase } from './base';

/**
 * Por dónde pasan todas las fotos del sitio: los retratos de artistas, el
 * archivo y los logos de las marcas.
 *
 * Hay dos clases de foto conviviendo, y esta capa existe para que las
 * plantillas no tengan que saber cuál es cuál:
 *
 *   · **Las del repo** — `/patrocinadores/minerva.png`. Son las que venían del
 *     sitio de Wix. Se sirven tal cual, con la base del sitio puesta. No se
 *     pueden redimensionar al vuelo: son archivos estáticos.
 *
 *   · **Las del panel** — la URL entera que devuelve Cloudinary al subir desde
 *     `/admin`. Éstas SÍ se redimensionan, y es la mitad del motivo de usar
 *     Cloudinary: una página de archivo con cien fotos no puede servir cien
 *     originales de cámara.
 *
 * Por qué Cloudinary y no meter las fotos al repo: un archivo fotográfico de
 * cuatro ediciones son cientos de imágenes, y en git se quedan para siempre —
 * clonar el repo se vuelve lento y no hay forma de sacarlas—. Ahí no entran
 * nunca al repo y encima llegan en AVIF o WebP según lo que aguante el
 * navegador.
 */

/** Una URL de entrega de Cloudinary, con el hueco donde van las transformaciones:
 *  `https://res.cloudinary.com/<cuenta>/image/upload/` ← aquí ← `v123/carpeta/x.jpg` */
const ENTREGA = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

/** `f_auto` sirve AVIF o WebP según el navegador y `q_auto` ajusta la
 *  compresión a lo que la imagen aguanta sin que se note. */
const transformaciones = (ancho?: number) =>
  ['f_auto', 'q_auto', ancho ? `w_${ancho}` : ''].filter(Boolean).join(',');

/**
 * @param ruta  Ruta dentro de `public/` (`/archivo/2024/x.jpg`) o la URL entera
 *              que dio Cloudinary.
 * @param ancho Ancho pedido en píxeles. Se ignora en las fotos del repo: no se
 *              puede redimensionar un archivo estático al vuelo.
 */
export const imagen = (ruta: string, ancho?: number): string => {
  const cloudinary = ENTREGA.exec(ruta);
  if (cloudinary) {
    const [, base, resto] = cloudinary;
    // Si ya trae transformaciones puestas a mano, se respetan: alguien las
    // escribió por algo (un recorte, una marca de agua) y no toca pisarlas.
    if (/^[a-z]{1,3}_[^/]+\//.test(resto)) return ruta;
    return base + transformaciones(ancho) + '/' + resto;
  }

  // Cualquier otra URL entera se deja en paz: una foto que alguien pegó desde
  // otro sitio no se toca.
  if (/^https?:\/\//.test(ruta)) return ruta;

  return conBase(ruta);
};

/**
 * El `srcset` de una foto, con los anchos que de verdad se usan en el sitio.
 *
 * Sólo tiene sentido en las de Cloudinary: para una foto del repo devuelve
 * cadena vacía y el `<img>` se queda con su `src` de siempre, que es lo
 * correcto —tres copias del mismo archivo estático no son tres tamaños—.
 */
export const juegoDeImagenes = (ruta: string, anchos = [480, 800, 1200]): string =>
  ENTREGA.test(ruta) ? anchos.map((w) => `${imagen(ruta, w)} ${w}w`).join(', ') : '';
