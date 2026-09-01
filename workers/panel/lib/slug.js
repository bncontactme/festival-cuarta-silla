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
