import type { APIRoute } from 'astro';
import {
  nav, inicio, accionPrincipal, privacidad, actividadesConSala, rutaSala,
} from '../data/site';

/**
 * El mapa del sitio, escrito a mano y sin dependencia.
 *
 * Aquí decía que si algún día el programa generaba una página por actividad
 * entonces sí tocaba meter `@astrojs/sitemap`. Ese día llegó —los textos de
 * sala son una página cada uno— y sigue sin tocar: lo que hacía falta era
 * concatenar una segunda lista, cuatro líneas más abajo. El paquete se
 * justificaría si hubiera que descubrir rutas; estas dos listas ya las tiene
 * `site.ts` en la mano.
 *
 * Las páginas de sala van con `priority` más baja y `changefreq` mensual: son
 * hojas, se escriben una vez y se leen desde un QR, no desde Google.
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

  const salas = actividadesConSala.map((a) => ({ label: a.titulo, href: rutaSala(a.sala) }));

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
  .concat(
    salas.map(
      (r) => `  <url>
    <loc>${url(r.href)}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>`,
    ),
  )
  .join('\n')}
</urlset>
`;

  return new Response(cuerpo, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
