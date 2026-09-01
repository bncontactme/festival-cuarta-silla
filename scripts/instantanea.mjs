#!/usr/bin/env node
/**
 * Baja el contenido del panel y lo deja en `src/data/contenido.json`.
 *
 * Corre antes de cada `astro build` (ver `package.json`). También se puede
 * llamar a mano mientras se trabaja:
 *
 *     npm run contenido
 *
 * Por qué el JSON se comitea en vez de pedirlo el sitio al vuelo: está
 * explicado en `src/data/contenido.ts` y en PANEL.md. En corto, tres cosas de
 * un tiro — el sitio nunca se cae por culpa del panel, el contenido se lee en
 * cualquier diff, y el histórico de git es el histórico del contenido.
 *
 * **Este script nunca tumba el build por su cuenta.** Si el Worker no contesta
 * —está caído, no hay red, el despliegue corre desde un sitio sin salida— se
 * queda lo que ya había y lo dice bien fuerte. Lo único que sí es fatal es no
 * tener ni respuesta ni copia: ahí no hay sitio que construir.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PANEL_URL } from '../src/lib/panel.ts';

// La variable de entorno gana, para poder construir contra un Worker local.
const PANEL = process.env.PANEL_URL || PANEL_URL;

const DESTINO = fileURLToPath(new URL('../src/data/contenido.json', import.meta.url));

/** Si el Worker tarda más que esto, no vale la pena esperarlo: hay copia. */
const ESPERA_MS = 10_000;

const COLECCIONES = ['sedes', 'programa', 'artistas', 'archivo', 'marcas'];

const log = (icono, msg) => console.log(`${icono}  contenido: ${msg}`);

async function bajar() {
  const corte = AbortSignal.timeout(ESPERA_MS);
  const res = await fetch(`${PANEL}/contenido`, { signal: corte });
  if (!res.ok) throw new Error(`el panel contestó ${res.status}`);
  const datos = await res.json();

  // Una respuesta a medias es peor que ninguna: sobrescribir la copia buena con
  // un JSON incompleto vacía el sitio y encima borra el respaldo.
  const faltan = COLECCIONES.filter((c) => datos[c] === undefined);
  if (faltan.length) throw new Error(`la respuesta viene sin: ${faltan.join(', ')}`);

  return datos;
}

/**
 * Un panel recién desplegado contesta 200 con todo a cero.
 *
 * `version: 0` no quiere decir «el festival lo dejó vacío»: quiere decir que en
 * KV no se ha escrito NUNCA — el contador sube en cada guardado, así que la
 * única forma de estar en cero es no haber guardado jamás. Y entre el momento
 * en que el Worker existe y el momento en que se siembra hay un rato en el que
 * cualquier build publicaría un sitio sin sedes, sin marcas y sin programa.
 *
 * Así que el cero no pisa nada. En cuanto se siembre, la versión es 1 o más y
 * el panel manda para siempre — incluido el día que legítimamente se quiera
 * dejar una lista vacía, porque entonces la versión ya no será cero.
 *
 * No es una regla sobre «está vacío»: vacío es un estado legítimo en artistas y
 * en archivo, y el sitio los pinta bien. Es una regla sobre «nunca se ha
 * escrito», que es otra cosa.
 */
function reciennacido(datos, copia) {
  if ((datos.version ?? 0) > 0) return false;
  if (!copia) return false;
  const cuenta = (d) =>
    d.sedes.length + d.programa.actividades.length + d.artistas.length +
    d.archivo.length + d.marcas.patrocinadores.length + d.marcas.colaboradores.length;
  return cuenta(datos) < cuenta(copia);
}

async function copia() {
  try {
    return JSON.parse(await readFile(DESTINO, 'utf8'));
  } catch {
    return null;
  }
}

const guardado = await copia();

let datos;
try {
  datos = await bajar();
} catch (e) {
  if (!guardado) {
    console.error(
      `\n⛔  contenido: no hay respuesta del panel (${e.message}) y tampoco hay copia en\n` +
      `    ${DESTINO}\n` +
      `    Sin una de las dos no hay nada que construir.\n`,
    );
    process.exit(1);
  }
  log('⚠️ ', `el panel no contestó (${e.message}).`);
  log('  ', `se construye con la copia del repo, versión ${guardado.version ?? '?'}` +
            (guardado.actualizado ? ` del ${guardado.actualizado}` : '') + '.');
  process.exit(0);
}

if (reciennacido(datos, guardado)) {
  log('⚠️ ', 'el panel contesta, pero está sin sembrar (versión 0 y más vacío que el repo).');
  log('  ', 'no se pisa la copia buena. Siémbralo y esto deja de salir:');
  log('  ', "CLAVE='…' node workers/panel/semilla.mjs");
  process.exit(0);
}

const nuevo = JSON.stringify(datos, null, 2) + '\n';
const viejo = guardado ? JSON.stringify(guardado, null, 2) + '\n' : '';

if (nuevo === viejo) {
  log('✓', `sin cambios (versión ${datos.version}).`);
  process.exit(0);
}

await writeFile(DESTINO, nuevo, 'utf8');

const cuenta = [
  `${datos.sedes.length} sedes`,
  `${datos.programa.actividades.length} actividades`,
  `${datos.artistas.length} artistas`,
  `${datos.archivo.length} ediciones`,
  `${datos.marcas.patrocinadores.length + datos.marcas.colaboradores.length} marcas`,
].join(' · ');

log('✓', `versión ${datos.version} — ${cuenta}`);
