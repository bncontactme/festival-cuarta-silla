#!/usr/bin/env node
/**
 * Siembra el panel con lo que hoy está en el repo.
 *
 * Se corre UNA VEZ, después de desplegar el Worker y antes de darle la
 * contraseña a nadie. Lee `src/data/contenido.json` —que salió de los `.ts` del
 * sitio— y lo manda colección por colección, pasando por la misma validación
 * que usará el panel. Si algo no pasa, sale aquí y no el día del festival.
 *
 *     CLAVE='la-contraseña' node workers/panel/semilla.mjs
 *
 * Contra un Worker local:
 *
 *     PANEL_URL=http://localhost:8787 CLAVE=... node workers/panel/semilla.mjs
 *
 * Es idempotente en el sentido que importa: vuelve a dejar el contenido tal y
 * como está en el repo. Si el panel ya tenía cosas, esto las PISA —cada
 * guardado deja su copia en el historial, así que se puede volver, pero no lo
 * corras por costumbre—.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PANEL_URL } from '../../src/lib/panel.ts';

const PANEL = process.env.PANEL_URL || PANEL_URL;
const CLAVE = process.env.CLAVE;

if (!CLAVE) {
  console.error(
    '\nFalta la contraseña de admin:\n\n' +
    "    CLAVE='…' node workers/panel/semilla.mjs\n\n" +
    'Se manda en el cuerpo de la petición, sobre HTTPS, y no se guarda en ningún lado.\n',
  );
  process.exit(1);
}

const ORIGEN = fileURLToPath(new URL('../../src/data/contenido.json', import.meta.url));
const datos = JSON.parse(await readFile(ORIGEN, 'utf8'));

// Las sedes primero: el programa y las fichas de artistas se validan contra
// ellas, y contra un panel vacío no habría ninguna que emparejar.
const ORDEN = ['sedes', 'programa', 'artistas', 'archivo', 'marcas'];

console.log(`\nSembrando ${PANEL}\ndesde ${ORIGEN}\n`);

let fallos = 0;
for (const coleccion of ORDEN) {
  const res = await fetch(PANEL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    body: JSON.stringify({ password: CLAVE, accion: 'guardar', coleccion, datos: datos[coleccion] }),
  });
  const r = await res.json().catch(() => ({}));

  if (!res.ok) {
    fallos++;
    console.error(`  ⛔ ${coleccion}: ${r.error || res.status}`);
    (r.errores ?? []).forEach((e) => console.error(`       · ${e}`));
    if (res.status === 401) {
      console.error('\n     La contraseña no es la que tiene el Worker. Revisa ADMIN_HASH:\n' +
                    "     printf 'la-contraseña' | shasum -a 256\n");
      process.exit(1);
    }
    continue;
  }

  const cuantos = Array.isArray(datos[coleccion])
    ? datos[coleccion].length
    : Object.values(datos[coleccion]).filter(Array.isArray).flat().length;
  console.log(`  ✓ ${coleccion.padEnd(10)} ${String(cuantos).padStart(3)} elementos → versión ${r.version}`);
  (r.avisos ?? []).forEach((a) => console.log(`       ⚠ ${a}`));
}

console.log(fallos ? `\nQuedaron ${fallos} sin sembrar.\n` : '\nListo. El panel ya tiene lo que tenía el repo.\n');
process.exit(fallos ? 1 : 0);
