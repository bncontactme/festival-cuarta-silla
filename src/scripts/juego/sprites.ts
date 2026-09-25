/**
 * Los dibujos del juego, a mano y en píxeles gordos.
 *
 * `#` es tinta, `.` es vacío y `o` es un hueco: se pinta del color del campo,
 * como el ojo del dino o las letras caladas del respaldo. No es transparente
 * a propósito: si el dino choca contra una silla, el ojo no puede dejar ver
 * el rojo de detrás.
 *
 * La silla no está inventada: sale de reducir `silla-roja.svg` a esta rejilla
 * y limpiarla a mano —respaldo, dos largueros, el asiento en perspectiva y la
 * pata de atrás abierta, como en el logo—. Los puntos calados del respaldo
 * son el «Cuarta Silla» del original: a este tamaño no se lee, pero se ve que
 * ahí va algo escrito, y eso es lo que la hace nuestra y no una silla
 * cualquiera.
 */

export interface Sprite {
  /** Ancho y alto en píxeles gordos. */
  ancho: number;
  alto: number;
  /** Fila a fila: 0 vacío, 1 tinta, 2 hueco. */
  celdas: Uint8Array;
}

const dibujo = (filas: string[]): Sprite => {
  const ancho = filas[0].length;
  const celdas = new Uint8Array(ancho * filas.length);
  filas.forEach((fila, j) => {
    if (fila.length !== ancho) throw new Error(`juego: la fila ${j} mide ${fila.length}, no ${ancho}`);
    for (let i = 0; i < ancho; i++) {
      celdas[j * ancho + i] = fila[i] === '#' ? 1 : fila[i] === 'o' ? 2 : 0;
    }
  });
  return { ancho, alto: filas.length, celdas };
};

/** Un cuarto de vuelta en el sentido de las agujas del reloj. Girar píxeles
 *  de 90 en 90 no pierde nada; a cualquier otro ángulo se deshace el dibujo. */
const girar = (s: Sprite): Sprite => {
  const celdas = new Uint8Array(s.celdas.length);
  for (let j = 0; j < s.alto; j++) {
    for (let i = 0; i < s.ancho; i++) {
      celdas[i * s.alto + (s.alto - 1 - j)] = s.celdas[j * s.ancho + i];
    }
  }
  return { ancho: s.alto, alto: s.ancho, celdas };
};

// ── El dino ───────────────────────────────────────────────────────────────
// Todas las poses de pie comparten cabeza y cuerpo; cambian las patas y el
// ojo. Mirando a la derecha, que es hacia donde corre.

const cabezaYCuerpo = (ojo: string) => [
  '............########..',
  `...........##${ojo}#######.`,
  '...........##########.',
  '...........##########.',
  '...........##########.',
  '...........#####......',
  '...........########...',
  '#.........#####.......',
  '#........######.......',
  '##......########......',
  '###....##########.....',
  '####..#########.#.....',
  '###############.......',
  '###############.......',
  '.#############........',
  '..###########.........',
  '...#########..........',
  '....#######...........',
];

const patas = {
  quietas: ['.....###.##...........', '.....##...#...........', '.....#....#...........', '.....##...##..........'],
  atras: ['.....###.##...........', '....##....#...........', '..........#...........', '..........##..........'],
  delante: ['.....###.###..........', '.....##.....#.........', '.....#................', '.....##...............'],
};

const agachado = (patasDeAbajo: string[]) =>
  dibujo([
    '...................########.',
    '#........#######..##o#######',
    '##.....#####################',
    '###.########################',
    '############################',
    '.######################.....',
    '..###############.########..',
    '...#############.#..........',
    '....#####..####.............',
    ...patasDeAbajo,
  ]);

export const DINO = {
  quieto: dibujo([...cabezaYCuerpo('o'), ...patas.quietas]),
  parpadeo: dibujo([...cabezaYCuerpo('#'), ...patas.quietas]),
  corre: [
    dibujo([...cabezaYCuerpo('o'), ...patas.atras]),
    dibujo([...cabezaYCuerpo('o'), ...patas.delante]),
  ],
  agachado: [
    agachado(['....##.....##...............', '...##.......................']),
    agachado(['...##.......#...............', '............##..............']),
  ],
  // Ojos en cruz y la quijada caída.
  choque: dibujo([
    '............########..',
    '...........##o#o#####.',
    '...........###o######.',
    '...........##o#o#####.',
    '...........##########.',
    '...........#####......',
    '...........#####......',
    '#.........######......',
    '#........#########....',
    '##......########......',
    ...cabezaYCuerpo('o').slice(10),
    ...patas.quietas,
  ]),
};

// ── La silla ──────────────────────────────────────────────────────────────

export const SILLA = {
  grande: dibujo([
    '.....#########....',
    '....###########...',
    '....###########...',
    '....#o#oo#o#o##...',
    '....###########...',
    '....###########...',
    '....#........#....',
    '....#........#....',
    '....#........#....',
    '....#........#.#..',
    '....#........#.#..',
    '....##########.#..',
    '...###########.#..',
    '..############..#.',
    '##############..#.',
    '.#############..#.',
    '.#..........#...#.',
    '.#..........#....#',
    '.#..........#....#',
    '.#..........#....#',
    '.#################',
    '.#...............#',
    '.#...............#',
    '.#...............#',
  ]),
  chica: dibujo([
    '....#######...',
    '...#########..',
    '...#o#oo#o##..',
    '...#########..',
    '...#########..',
    '...#......#...',
    '...#......#.#.',
    '...#......#.#.',
    '...########.#.',
    '..#########.#.',
    '###########..#',
    '.##########..#',
    '.#.......#...#',
    '.#.......#...#',
    '.#############',
    '.#...........#',
    '.#...........#',
    '.#...........#',
  ]),
};

/** La silla que vuela, en sus cuatro posturas: la chica, dando vueltas. */
export const SILLA_EN_EL_AIRE: Sprite[] = [SILLA.chica];
for (let i = 1; i < 4; i++) SILLA_EN_EL_AIRE.push(girar(SILLA_EN_EL_AIRE[i - 1]));

// ── El fondo ──────────────────────────────────────────────────────────────

/** La estrella del feed, en lugar de las nubes. */
export const ESTRELLA = dibujo([
  '....#....',
  '....#....',
  '...###...',
  '#########',
  '.#######.',
  '..#####..',
  '..##.##..',
  '.##...##.',
  '.#.....#.',
]);
