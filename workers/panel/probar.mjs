#!/usr/bin/env node
/**
 * Las pruebas del validador. `node workers/panel/probar.mjs`, o `npm run probar`.
 *
 * Existe por un susto de esta misma tarde: al cambiar el «¿querías decir…?» por
 * uno que también caza las letras de menos, se quedó fuera un `import` y el
 * Worker empezó a contestar «pelar is not defined» a cada guardado de sedes. No
 * lo vio ningún tipo —esto es JavaScript suelto en un Worker— y sólo salió al
 * darle a Guardar con el panel delante. Una semana antes del festival eso es
 * exactamente lo que no puede pasar.
 *
 * Son diecinueve comprobaciones y tardan medio segundo. No pretenden cubrirlo
 * todo: cubren lo que rompe el sitio si falla —las sedes que no emparejan, las
 * horas al revés, el registro— y lo que se acaba de tocar.
 */
import { validar } from './lib/validar.js';
import { masParecido } from './lib/slug.js';

let fallos = 0;
const ok = (que, cond, extra = '') => {
  console.log((cond ? '  ✓ ' : '  ✗ ') + que + (cond ? '' : '  ← ' + extra));
  if (!cond) fallos++;
};

const SEDES = ['Cuerpos Parlantes', 'Foro AM', 'Taller Industria Gráfica', 'No Museo'];

console.log('\n«¿querías decir…?»');
ok('tilde de menos', masParecido('Taller Industria Grafica', SEDES) === 'Taller Industria Gráfica');
ok('letra de menos', masParecido('Cuerpos Parlante', SEDES) === 'Cuerpos Parlantes',
   String(masParecido('Cuerpos Parlante', SEDES)));
ok('letra cambiada', masParecido('No Musso', SEDES) === 'No Museo', String(masParecido('No Musso', SEDES)));
ok('nombre corto, dos letras de error: no sugiere', masParecido('Foro XY', SEDES) === undefined,
   String(masParecido('Foro XY', SEDES)));
ok('nada que ver: no sugiere', masParecido('Casa Feria', SEDES) === undefined,
   String(masParecido('Casa Feria', SEDES)));

console.log('\nprograma › registro y libre');
const base = (extra = {}) => ({
  titulo: 'Taller', dia: 0, inicio: '10:00', fin: '12:00',
  sede: 'Foro AM', tipo: 'taller', ...extra,
});

let r = validar('programa', { actividades: [base({ libre: true })], esEjemplo: false }, { sedes: SEDES });
ok('libre se guarda', r.errores.length === 0 && r.datos.actividades[0].libre === true, JSON.stringify(r.errores));

r = validar('programa', { actividades: [base({ libre: false })], esEjemplo: false }, { sedes: SEDES });
ok('libre:false no se guarda', !('libre' in r.datos.actividades[0]));

r = validar('programa', {
  actividades: [base({ libre: true, registro: 'https://tally.so/r/x' })], esEjemplo: false,
}, { sedes: SEDES });
ok('formulario manda sobre libre', !('libre' in r.datos.actividades[0]) && r.avisos.length === 1,
   JSON.stringify(r.avisos));

r = validar('programa', {
  actividades: [base()], esEjemplo: false, registro: { abierto: true, nota: '  hola   mundo ' },
}, { sedes: SEDES });
ok('registro.abierto se guarda', r.datos.registro.abierto === true, JSON.stringify(r.datos.registro));
ok('registro.nota se normaliza', r.datos.registro.nota === 'hola mundo', JSON.stringify(r.datos.registro));
ok('abierto sin ninguna puerta avisa', r.avisos.some((a) => a.includes('ninguna actividad')),
   JSON.stringify(r.avisos));

r = validar('programa', {
  actividades: [base({ registro: 'https://tally.so/r/x' })], esEjemplo: true, registro: { abierto: true },
}, { sedes: SEDES });
ok('abierto sobre rejilla de ejemplo avisa', r.avisos.some((a) => a.includes('rejilla de ejemplo')),
   JSON.stringify(r.avisos));

r = validar('programa', {
  actividades: [base()], esEjemplo: false, registro: { general: 'http://inseguro.com' },
}, { sedes: SEDES });
ok('general en http se rechaza', r.errores.some((e) => e.startsWith('registro.general')), JSON.stringify(r.errores));

r = validar('programa', { actividades: [base()], esEjemplo: false }, { sedes: SEDES });
ok('sin registro no se guarda la clave', !('registro' in r.datos), JSON.stringify(r.datos));
ok('esEjemplo:false sobrevive a podar', r.datos.esEjemplo === false, JSON.stringify(r.datos));
ok('la lista de actividades sobrevive', r.datos.actividades.length === 1);

console.log('\nlo de siempre, que no se rompió');
r = validar('programa', { actividades: [base({ sede: 'Cuerpos Parlante' })] }, { sedes: SEDES });
ok('sede mal escrita se rechaza con sugerencia',
   r.errores.some((e) => e.includes('¿querías decir «Cuerpos Parlantes»?')), JSON.stringify(r.errores));

r = validar('sedes', [
  { nombre: 'Foro AM', direccion: 'C. Pedro Loza 344' },
  { nombre: 'foro am', direccion: 'otra' },
], {});
ok('sede repetida se rechaza', r.errores.some((e) => e.includes('está repetida')), JSON.stringify(r.errores));

r = validar('sedes', [{ nombre: 'X', direccion: 'Y', coord: [20.67, -103.35] }], {});
ok('coordenada buena pasa', r.errores.length === 0 && r.datos[0].coord.length === 2, JSON.stringify(r.errores));

r = validar('programa', { actividades: [base({ fin: '09:00' })] }, { sedes: SEDES });
ok('fin antes que inicio se rechaza', r.errores.some((e) => e.includes('termina')), JSON.stringify(r.errores));

r = validar('marcas', { patrocinadores: [{ nombre: 'X', logo: '/patrocinadores/x.png' }], colaboradores: [] }, {});
ok('logo del repo pasa', r.errores.length === 0 && r.datos.patrocinadores[0].logo === '/patrocinadores/x.png');

console.log(fallos ? `\n${fallos} fallo(s)\n` : '\nTodo bien\n');
process.exit(fallos ? 1 : 0);
