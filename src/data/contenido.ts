import bruto from './contenido.json';
import type { Contenido } from './tipos';

/**
 * El contenido que carga el festival desde `/admin`.
 *
 * Cómo llega hasta aquí:
 *
 *   1. El festival guarda en `/admin` → el Worker valida y escribe en KV.
 *   2. El Worker dispara el rebuild.
 *   3. `scripts/instantanea.mjs` pide `GET /contenido` y sobrescribe
 *      `contenido.json`.
 *   4. Astro construye. Este módulo lee ese JSON.
 *
 * **`contenido.json` está comiteado en el repo a propósito.** Hace tres cosas
 * de un tiro: si el Worker no contesta, el build usa la última copia buena y el
 * sitio no se cae nunca por culpa del panel; el contenido se lee en texto plano
 * en cualquier diff; y el histórico de git es el histórico del contenido, sin
 * montar nada.
 *
 * El `as unknown as` no es pereza: esto entra de fuera y TypeScript no puede
 * prometer nada de un JSON. Quien lo promete es `workers/panel/lib/validar.js`,
 * que es lo único que puede escribir ahí.
 */
export const contenido = bruto as unknown as Contenido;

/**
 * Si esta instantánea salió del panel o sigue siendo la semilla del repo.
 *
 * Cambia una sola cosa, y es importante: la comprobación de integridad del
 * final de `site.ts` **revienta el build** cuando el dato lo escribí yo en un
 * `.ts` —ahí un error mío tiene que doler antes de desplegar— y **sólo avisa**
 * cuando el dato vino del panel. Un renglón mal escrito por el festival no
 * puede dejar el sitio sin poder publicarse.
 */
export const delPanel = contenido.version > 0;
