import type { APIRoute } from 'astro';
import { nav, inicio, accionPrincipal, privacidad } from '../data/site';

/**
 * El mapa del sitio, escrito a mano y sin dependencia.
 *
 * `@astrojs/sitemap` haría lo mismo, pero aquí son siete rutas fijas que ya
 * están listadas en `site.ts`: meter un paquete para recorrer una lista de
 * siete elementos es más cosas que mantener, no menos. Si algún día el
 * programa genera una página por actividad, entonces sí toca el paquete.
 *
 * Las redirecciones de las URLs viejas de Wix se quedan fuera a propósito: son
 * 301 y lo que tiene que indexarse es el destino, no el atajo.
 */
export const GET: APIRoute = ({ site }) => {
  const rutas = [
    inicio,
    ...nav,
    accionPrincipal,
    { label: privacidad.titulo, href: '/privacidad' },
  ];

  // `site` sale de `astro.config.mjs`; en la vista previa de GitHub Pages ya
  // trae el subdirectorio, así que `new URL` compone bien en los dos sitios.
  const url = (href: string) =>
    new URL(import.meta.env.BASE_URL.replace(/\/$/, '') + href, site).toString();

  const cuerpo = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rutas
  .map(
    (r) => `  <url>
    <loc>${url(r.href)}</loc>
    <changefreq>weekly</changefreq>
    <priority>${r.href === '/' ? '1.0' : '0.7'}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;

  return new Response(cuerpo, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
