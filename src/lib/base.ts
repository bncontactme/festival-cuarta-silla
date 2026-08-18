/**
 * Antepone la base del sitio a una ruta absoluta.
 *
 * En producción la base es `/` y `conBase()` devuelve la misma cadena que
 * recibe. Sirve para los despliegues que cuelgan el sitio de un
 * subdirectorio —GitHub Pages lo publica bajo `/festival-cuarta-silla/`—,
 * donde un `/logos/…` a secas apuntaría fuera del sitio.
 *
 * Sólo toca rutas absolutas: las externas (`https://…`, `mailto:`) y las
 * relativas pasan intactas.
 */
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export const conBase = (p: string): string => (p.startsWith('/') ? base + p : p);
