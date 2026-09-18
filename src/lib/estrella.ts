/**
 * La estrella que se clava en el plano: cinco puntas, radio 10, valle 4.1.
 *
 * No es la del feed —esa es `Estrella.astro`, un pegote decorativo con su path
 * pegado y su viewBox de 0 a 100—: ésta va centrada en el origen para poder
 * ponerla en un punto sin restar la mitad de nada, y sale de una cuenta para
 * poder tocarle el filo sin pelearse con una ristra de decimales.
 *
 * Vive aquí porque la dibujan dos: el plano de las dieciséis (`Mapa.astro`) y
 * el plano recortado de una sede que no tiene nada (`PlanoDeSede.astro`). Dos
 * copias de la misma estrella es la manera de acabar con dos estrellas
 * distintas en la misma página.
 */
export const estrella = (puntas = 5, radio = 10, valle = 4.1) =>
  'M' +
  Array.from({ length: puntas * 2 }, (_, i) => {
    const angulo = (Math.PI / puntas) * i - Math.PI / 2;
    const r = i % 2 ? valle : radio;
    return `${(Math.cos(angulo) * r).toFixed(2)} ${(Math.sin(angulo) * r).toFixed(2)}`;
  }).join(' L') +
  'Z';

/** La de siempre, ya dibujada. */
export const ESTRELLA = estrella();
