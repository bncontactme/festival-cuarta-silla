// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://www.festivaldearteconceptual.com',

  // La barra flotante de Astro en desarrollo. No sale nunca en `build`,
  // pero estorba para revisar el diseño.
  devToolbar: { enabled: false },

  // Las URLs viejas de Wix siguen circulando (redes, el PDF de convocatoria,
  // resultados de búsqueda). Se preservan como redirecciones permanentes.
  redirects: {
    '/agenda': '/programa',
    '/lugar': '/sedes',
    '/event-list': '/registro',
    '/política-de-privacidad': '/privacidad',
    '/pol%C3%ADtica-de-privacidad': '/privacidad',
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
