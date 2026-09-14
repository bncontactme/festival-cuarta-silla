/**
 * Cuánta gente entra, y nada más que eso.
 *
 * **Qué es.** El faro de Cloudflare Web Analytics: un `<script type="module">`
 * de unos pocos KB que, al terminar de cargar la página, manda una línea —qué ruta, de
 * qué país, desde qué tipo de aparato, y si vino de un enlace, de dónde—. Con
 * eso el panel de Cloudflare dibuja las visitas por página y por día.
 *
 * **Por qué Cloudflare y no otro.** Tres razones, en orden:
 *
 *   1. *Ya es nuestro.* El Worker del panel vive en esa cuenta. Una herramienta
 *      menos que dar de alta, que pagar y que recordar renovar.
 *   2. *No pone cookies ni huella.* No hay identificador que siga a nadie entre
 *      páginas ni entre días: cada visita se cuenta y se olvida. Eso es lo que
 *      deja al sitio **sin banner de consentimiento**, que es la diferencia
 *      entre esto y Google Analytics — y un banner en la portada de un festival
 *      es la primera cosa que ve quien llega y la primera que tiene que cerrar.
 *   3. *No cambia el sitio.* No hace falta mover el DNS ni meter el dominio
 *      detrás de Cloudflare: el faro va en el HTML y ya. Importa, porque el
 *      dominio sigue atrapado en Wix hasta el 24/09 (ver `publicar.yml`).
 *
 * **Lo que de verdad se quiere saber está en `/sala/…`.** Las cartelas y las
 * hojas de QR son papel pegado a una pared: hasta ahora no había forma de saber
 * si alguien las escaneaba. Con esto, cada página de sala cuenta sus visitas —
 * cuántos escaneos tuvo la obra del fondo, y si el cartel de la entrada sirvió
 * de algo. Es el número por el que se decide si el año que viene se imprimen
 * más o menos.
 *
 * ── Cómo se enciende ────────────────────────────────────────────────────────
 *
 *   1. En el panel de Cloudflare: Analytics & Logs → Web Analytics → Add a
 *      site, y se escribe `www.festivaldearteconceptual.com`.
 *   2. Cloudflare devuelve un fragmento de HTML con un `token` de 32 caracteres
 *      hexadecimales. Sólo hace falta ese token.
 *   3. Se pega aquí abajo, se comitea, y el siguiente build lo lleva.
 *
 * Hecho el 14/09/2026 para `www.festivaldearteconceptual.com`. Los números
 * salen en el mismo sitio: Analytics → Web analytics.
 *
 * **El token no es un secreto** y por eso se comitea sin más: viaja en el HTML
 * de todas las páginas, así que cualquiera que abra el código fuente del sitio
 * lo ve. Lo único que permite es mandar visitas a esa cuenta.
 *
 * **Vacío no pinta nada.** Mientras esté en blanco, el `<script>` no se escribe
 * en ninguna página: ni una petición de más, ni un hueco en el HTML. Es la
 * misma regla que el enlace de donaciones — lo que no existe todavía no se
 * anuncia a medias.
 */
export const FARO =
  (import.meta as any).env?.PUBLIC_CF_BEACON ||
  '63eb78fd34dd40bf8f15959bd1d77b9b';

/** Si hay faro que encender. Un token de Cloudflare son 32 hex; se comprueba la
 *  forma para que un «pon-aqui-el-token» a medio pegar no acabe mandando
 *  peticiones a ninguna parte ni ensuciando el HTML. */
export const hayFaro = /^[0-9a-f]{32}$/i.test(FARO);
