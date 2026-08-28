import { conBase } from './base';

/**
 * Por dónde pasan las fotos de artistas y del archivo.
 *
 * Hoy no hace casi nada: devuelve la ruta local tal cual, con la base del sitio
 * puesta. Existe por lo que viene después.
 *
 * **El plan es Cloudinary** —lo mismo que usa la página de Guadalajara de
 * Noche—, cuando se mueva el dominio de Wix y se monte el panel de edición. Un
 * archivo fotográfico de varias ediciones son cientos de imágenes: metidas en
 * git se quedan ahí para siempre y clonar el repo se vuelve lento; en una
 * librería externa no entran nunca al repo y encima llegan al navegador ya
 * redimensionadas al ancho que hace falta.
 *
 * Ese día, todo el cambio ocurre en este archivo: se rellena `CLOUDINARY` y las
 * plantillas ni se enteran. Sin esta capa habría que ir a tocar `FichaArtista`,
 * `/archivo`, la pantalla móvil del archivo y lo que haya para entonces.
 *
 * Cómo se usará: `imagen('/archivo/2024/inauguracion.jpg', 800)` →
 * `https://res.cloudinary.com/<cuenta>/image/upload/f_auto,q_auto,w_800/…`.
 * `f_auto` sirve AVIF o WebP según el navegador y `q_auto` ajusta la compresión
 * a lo que la imagen aguanta.
 */

/** Vacío = sigue todo en local. Al llegar el día, aquí va el nombre de la
 *  cuenta de Cloudinary y esto se enciende solo. */
const CLOUDINARY = '';

/**
 * @param ruta  Ruta absoluta dentro de `public/`, p. ej. `/archivo/2024/x.jpg`.
 * @param ancho Ancho pedido en píxeles. Sin librería externa se ignora: no se
 *              puede redimensionar un archivo estático al vuelo.
 */
export const imagen = (ruta: string, ancho?: number): string => {
  // Lo que ya es una URL entera se deja en paz: una foto que alguien pegó
  // desde otro sitio no se toca.
  if (/^https?:\/\//.test(ruta)) return ruta;

  if (!CLOUDINARY) return conBase(ruta);

  const trans = ['f_auto', 'q_auto', ancho ? `w_${ancho}` : '']
    .filter(Boolean)
    .join(',');
  return `https://res.cloudinary.com/${CLOUDINARY}/image/upload/${trans}${ruta}`;
};

/**
 * El `srcset` para una foto, con los anchos que de verdad se usan en el sitio.
 * Sin librería externa devuelve cadena vacía y el `<img>` se queda con su `src`
 * de siempre — que es exactamente lo que hace hoy.
 */
export const juegoDeImagenes = (
  ruta: string,
  anchos = [480, 800, 1200],
): string =>
  CLOUDINARY && !/^https?:\/\//.test(ruta)
    ? anchos.map((w) => `${imagen(ruta, w)} ${w}w`).join(', ')
    : '';
