// Nombre de carpeta a partir de un nombre propio: sin tildes, sin mayúsculas y
// con guiones. Es lo que decide en qué carpeta de Cloudinary cae una foto, así
// que tiene que ser estable: «Zoe Nuño» y «zoe nuno» dan la misma carpeta.
//
// Copiado del Worker de GDN (lib/artistSlug.js) a propósito: es la misma regla
// y conviene que las dos cuentas ordenen igual.
export function slug(nombre) {
  const limpio = String(nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return limpio || 'sin-nombre';
}

// Compara dos nombres ignorando tildes, mayúsculas y dobles espacios. Es lo que
// permite decir «¿querías decir Taller Industria Gráfica?» cuando alguien
// escribió «Taller Industria Grafica».
export function pelar(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Distancia de edición, cortada en `tope`.
 *
 * `pelar()` sola sólo caza el error de la tilde, y ése no es el que más pasa:
 * probando la semilla, «Cuerpos Parlante» contra «Cuerpos Parlantes» —una letra
 * de menos— se rechazaba sin sugerir nada, que es el peor sitio donde dejar a
 * alguien: sabe que está mal y no sabe cuál era. Con esto, una letra de más, de
 * menos o cambiada también propone.
 *
 * Se corta en cuanto se pasa del tope porque el número no importa: sólo importa
 * si se parecen, y las listas son de catorce nombres.
 */
export function distancia(a, b, tope = 2) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > tope) return tope + 1;

  let fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const siguiente = [i];
    let mejor = i;
    for (let j = 1; j <= b.length; j++) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1;
      siguiente[j] = Math.min(fila[j] + 1, siguiente[j - 1] + 1, fila[j - 1] + coste);
      mejor = Math.min(mejor, siguiente[j]);
    }
    if (mejor > tope) return tope + 1;
    fila = siguiente;
  }
  return fila[b.length];
}

/** El nombre de `lista` que más se parece a `escrito`, o nada si ninguno se
 *  parece lo bastante como para que sugerirlo ayude en vez de despistar. */
export function masParecido(escrito, lista) {
  const s = pelar(escrito);
  if (!s) return undefined;
  // Un nombre corto aguanta menos error: en «Foro AM» dos letras cambiadas son
  // un tercio del nombre, y eso ya no es un desliz sino otro sitio. Proponer de
  // más es peor que no proponer — «¿querías decir Foro AM?» sobre algo que no
  // tenía nada que ver manda a corregir lo que no estaba mal.
  const tope = s.length <= 8 ? 1 : 2;
  let mejor;
  let mejorD = tope + 1;
  for (const n of lista) {
    const d = distancia(s, pelar(n), tope);
    if (d < mejorD) { mejorD = d; mejor = n; }
  }
  return mejorD <= tope ? mejor : undefined;
}
