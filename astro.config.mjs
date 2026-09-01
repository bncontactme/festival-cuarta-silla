// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// El sitio de producción vive en la raíz de su dominio. Mientras el dominio no
// apunte aquí, GitHub Pages sirve el repo desde `/festival-cuarta-silla/` y un
// sitio construido para la raíz se ve sin estilos: las rutas de los assets
// salen de `/` y ahí no hay nada.
//
// Por eso estas dos se inyectan desde el workflow, y su valor son variables del
// repositorio (`vars.PAGES_SITE` / `vars.PAGES_BASE`) en vez de estar escritas
// en el YAML: el día que el dominio resuelva, se borran las variables y el
// mismo workflow vuelve a construir para la raíz sin tocar una línea de código.
//
// `||` y no `??`: una variable de repositorio que no existe llega como cadena
// vacía, no como `undefined`, y `??` la dejaría pasar.
const site = process.env.PAGES_SITE || 'https://www.festivaldearteconceptual.com';
const base = process.env.PAGES_BASE || undefined;

export default defineConfig({
  site,
  base,

  // La barra flotante de Astro en desarrollo. No sale nunca en `build`,
  // pero estorba para revisar el diseño.
  devToolbar: { enabled: false },

  // Las URLs viejas de Wix siguen circulando (redes, el PDF de convocatoria,
  // resultados de búsqueda). Se preservan como redirecciones permanentes.
  // Astro no le aplica la base al destino de una redirección, así que se le
  // pone aquí; en producción `base` es undefined y quedan como estaban.
  redirects: Object.fromEntries(
    Object.entries({
      '/agenda': '/programa',
      '/lugar': '/sedes',
      '/event-list': '/registro',
      // La sección se llamaba «Archivo» hasta que pasó a «Galería».
      '/archivo': '/galeria',
      '/política-de-privacidad': '/privacidad',
      '/pol%C3%ADtica-de-privacidad': '/privacidad',
    }).map(([de, a]) => [de, base ? base + a : a]),
  ),

  vite: {
    plugins: [tailwindcss()],
  },
});
