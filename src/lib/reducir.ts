/**
 * Achica una foto en el navegador antes de subirla: 2000 px de lado largo como
 * mucho, en JPEG a calidad 0,85.
 *
 * Lo usan las dos puertas de la galería —el formulario del público
 * (`src/scripts/galeria.ts`) y el panel cuando sube fotos de una edición o de
 * una entrada (`src/scripts/panel/campos.ts`)— y es lo que evita que la cuenta
 * de Cloudinary se llene de originales de cámara.
 *
 * **Cuánto se ahorra.** Una foto de teléfono de hoy son 12 a 48 megapíxeles y
 * de 4 a 12 MB. A 2000 px y 0,85 queda entre 400 y 900 KB: un 90 % menos. Y no
 * se nota, porque el sitio nunca la enseña más grande: la ficha la pide a 800 y
 * el visor a pantalla entera, a 1600 (2000 en una pantalla de doble densidad).
 * Subir más píxeles de los que alguien va a ver es pagar almacenamiento por
 * nada.
 *
 * De paso se le caen los metadatos —en una foto de teléfono, la coordenada GPS
 * de donde se tomó— y sale derecha: el navegador ya aplica la orientación de la
 * cámara al pintarla.
 *
 * No es el único freno, y no puede serlo: esto corre en el navegador de quien
 * sube, y un script se lo salta. El Worker firma además una transformación de
 * entrada que Cloudinary aplica al recibir (`c_limit` a 2000 px), así que lo
 * guardado nunca pasa de ese tamaño venga de donde venga.
 */

/** El lado largo. Coincide con el `c_limit` que firma el Worker. */
export const LADO = 2000;
const CALIDAD = 0.85;

/**
 * @returns un `File` JPEG achicado, con el mismo nombre y extensión `.jpg`.
 * @throws  si el navegador no sabe abrir la imagen (un HEIC en Chrome, un PDF
 *          con extensión de foto). Quien llama decide qué decir.
 */
export async function reducir(archivo: File): Promise<File> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const escala = Math.min(1, LADO / Math.max(img.naturalWidth, img.naturalHeight));
    const ancho = Math.max(1, Math.round(img.naturalWidth * escala));
    const alto = Math.max(1, Math.round(img.naturalHeight * escala));
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    const c = lienzo.getContext('2d');
    if (!c) throw new Error('sin lienzo');
    // Un PNG con transparencia pasado a JPEG sale con el fondo negro.
    c.fillStyle = '#fff';
    c.fillRect(0, 0, ancho, alto);
    c.imageSmoothingQuality = 'high';
    c.drawImage(img, 0, 0, ancho, alto);
    const foto = await new Promise<Blob | null>((listo) => lienzo.toBlob(listo, 'image/jpeg', CALIDAD));
    if (!foto) throw new Error('sin JPEG');
    // Siempre la rehecha, aunque el original ya viniera chico: el original
    // lleva sus metadatos, y el GPS de una foto chica es igual de privado.
    const nombre = archivo.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([foto], nombre, { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}
