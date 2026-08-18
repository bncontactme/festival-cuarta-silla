// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// El sitio de producción vive en la raíz de su dominio. Las vistas previas
// de GitHub Pages cuelgan de un subdirectorio, así que ahí se inyectan
// `PAGES_SITE` y `PAGES_BASE` desde el workflow en vez de tocar esto.
const site = process.env.PAGES_SITE ?? 'https://www.festivaldearteconceptual.com';
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
      '/política-de-privacidad': '/privacidad',
      '/pol%C3%ADtica-de-privacidad': '/privacidad',
    }).map(([de, a]) => [de, base ? base + a : a]),
  ),

  vite: {
    plugins: [tailwindcss()],
  },
});
