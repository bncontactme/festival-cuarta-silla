/**
 * Dónde vive el Worker del panel.
 *
 * Lo leen dos sitios que tienen que coincidir o no funciona nada: el panel de
 * `/admin` (para guardar) y `scripts/instantanea.mjs` (para bajar el contenido
 * antes de cada build). Por eso está aquí y no escrito dos veces.
 *
 * `workers.dev` es el subdominio de la cuenta de Cloudflare —el mismo de GDN—.
 * Si algún día el Worker se pone detrás de una ruta del dominio propio
 * (p. ej. `https://www.festivaldearteconceptual.com/api`), se cambia aquí y ya.
 *
 * Para probar contra un Worker local:
 *
 *     cd workers/panel && npx wrangler dev            # queda en :8787
 *     PUBLIC_PANEL_URL=http://localhost:8787 npm run dev
 *
 * `PUBLIC_PANEL_URL` gana en el navegador (Astro la inyecta al construir) y
 * `PANEL_URL` gana en `scripts/instantanea.mjs`, que corre en Node y no ve
 * `import.meta.env`.
 */
export const PANEL_URL =
  (import.meta as any).env?.PUBLIC_PANEL_URL ||
  'https://cuartasilla-panel.guadalajaradenoxe.workers.dev';
