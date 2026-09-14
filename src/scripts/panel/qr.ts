/**
 * Un código QR, dibujado aquí.
 *
 * **Por qué no un paquete.** El panel se construye con `npm ci`, que exige que
 * `package-lock.json` y `package.json` coincidan al dedillo; una dependencia
 * añadida a medias no rompe el QR, rompe el despliegue entero del sitio. Y lo
 * que hace falta es esto: convertir una dirección de menos de cien caracteres
 * en una rejilla de puntos. Son doscientas líneas y no cambian nunca, porque la
 * norma es de 2006.
 *
 * **Qué implementa y qué no.** Modo byte, nivel de corrección Q, versiones 1 a
 * 10. Nada más, y a propósito:
 *
 *   - *Modo byte* porque una URL lleva letras y barras. Los modos numérico y
 *     alfanumérico aprietan más, pero sólo sirven para dígitos y mayúsculas.
 *   - *Nivel Q* —25 % de recuperación— porque esto se imprime, se corta con
 *     tijeras y se pega con cinta a una pared que la gente roza. El nivel M
 *     daría un código más chico; el papel manoseado no perdona igual.
 *   - *Hasta la versión 10* porque `https://www.festivaldearteconceptual.com/
 *     sala/<id>` con el `id` topado a 40 son 86 caracteres, y la 10 aguanta
 *     151. Si algún día no cabe, `qr()` avisa en vez de dibujar un código roto.
 *
 * **Comprobado contra otra implementación**, que es la única forma seria de dar
 * esto por bueno sin un teléfono en la mano: se generó cada rejilla con
 * `qrcodejs` —la de David Shim, una década en cdnjs— y se compararon los dos
 * mapas módulo a módulo, para doce cadenas, entre ellas las direcciones de sala
 * de verdad. Fijando la misma máscara, las doce salen **idénticas**.
 *
 * Hay que fijar la máscara porque las dos no la eligen igual, y ahí la rara es
 * la otra: `qrcodejs` mira un patrón de siete módulos donde la norma pide once
 * (regla 3 de penalización). También escoge versiones más grandes de la cuenta
 * —su medidor de longitud compara un número con una cadena y siempre suma
 * tres— y le mete un BOM a los textos con acentos. Ninguna de las tres cosas
 * hace ilegible su código ni el nuestro: la máscara viaja escrita en los bits
 * de formato y el lector la deshace. Se dicen aquí para que quien vuelva a
 * correr esa comparación no salga corriendo al ver que no cuadran los números.
 *
 * De paso, lo que cazó la comparación antes de que esto se imprimiera: los bits
 * de formato estaban puestos en espejo —fila por columna—, y con ellos el
 * separador blanco de los ojos salía oscuro por una esquina. Un QR que no lee
 * ninguna cámara. A ojo no se ve; comparado contra otro, sí.
 */

// ── Aritmética de Galois GF(256) ─────────────────────────────────────────────
// Reed-Solomon vive aquí dentro. El polinomio primitivo (0x11D) y el generador
// α = 2 los fija la norma; no son elecciones.

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** El polinomio generador de grado `n`: el producto de (x − α^i) para i < n.
 *  `g[0]` es el coeficiente de mayor grado. */
function generador(n: number): number[] {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const sig = new Array<number>(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      sig[j] ^= g[j];
      sig[j + 1] ^= mul(g[j], EXP[i]);
    }
    g = sig;
  }
  return g;
}

/** Los `n` bytes de corrección de un bloque: el resto de dividir los datos
 *  entre el generador. División sintética, tal cual. */
function correccion(datos: number[], n: number): number[] {
  const g = generador(n);
  const resto = datos.concat(new Array<number>(n).fill(0));
  for (let i = 0; i < datos.length; i++) {
    const coef = resto[i];
    if (coef === 0) continue;
    for (let j = 0; j < g.length; j++) resto[i + j] ^= mul(g[j], coef);
  }
  return resto.slice(datos.length);
}

// ── Las tablas de la norma ───────────────────────────────────────────────────
// Sólo la columna del nivel Q. Meter las cuatro columnas sería copiar tres
// tablas que nadie va a leer para elegir un nivel que ya está decidido.

/** Por versión: [bytes de corrección por bloque, bloques y datos del grupo 1,
 *  bloques y datos del grupo 2]. */
const BLOQUES: readonly (readonly number[])[] = [
  [13, 1, 13, 0, 0],  // 1
  [22, 1, 22, 0, 0],  // 2
  [18, 2, 17, 0, 0],  // 3
  [26, 2, 24, 0, 0],  // 4
  [18, 2, 15, 2, 16], // 5
  [24, 4, 19, 0, 0],  // 6
  [18, 2, 14, 4, 15], // 7
  [22, 4, 18, 2, 19], // 8
  [20, 4, 16, 4, 17], // 9
  [24, 6, 19, 2, 20], // 10
];

/** Dónde caen los centros de los patrones de alineación. La versión 1 no lleva. */
const ALINEACION: readonly (readonly number[])[] = [
  [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
];

const VERSIONES = BLOQUES.length;

/** Cuántos bytes de datos caben en una versión. */
const capacidad = (v: number) => {
  const [, g1b, g1d, g2b, g2d] = BLOQUES[v - 1];
  return g1b * g1d + g2b * g2d;
};

/** El contador de caracteres ocupa 8 bits hasta la versión 9 y 16 a partir de
 *  la 10. Es la única discontinuidad del rango que usamos. */
const bitsContador = (v: number) => (v < 10 ? 8 : 16);

/** Cuántos caracteres caben de verdad, descontando cabecera y contador. */
const cabe = (v: number) => Math.floor((capacidad(v) * 8 - 4 - bitsContador(v)) / 8);

// ── De texto a bytes ─────────────────────────────────────────────────────────

/** El flujo de datos ya troceado, entrelazado y con su corrección detrás.
 *  Es lo que se va escribiendo en la rejilla en zigzag. */
function codificar(bytes: number[], version: number): Uint8Array {
  const [ec, g1b, g1d, g2b, g2d] = BLOQUES[version - 1];
  const total = capacidad(version);

  // Cabecera: modo byte (0100), cuántos son, y los bytes.
  const bits: number[] = [];
  const empujar = (valor: number, cuantos: number) => {
    for (let i = cuantos - 1; i >= 0; i--) bits.push((valor >>> i) & 1);
  };
  empujar(0b0100, 4);
  empujar(bytes.length, bitsContador(version));
  for (const b of bytes) empujar(b, 8);

  // Terminador de hasta cuatro ceros, y hasta completar el byte.
  const hueco = total * 8 - bits.length;
  empujar(0, Math.min(4, hueco));
  while (bits.length % 8 !== 0) bits.push(0);

  // Relleno: 0xEC y 0x11 turnándose hasta llenar. Los fija la norma.
  const datos: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    datos.push(b);
  }
  for (let i = 0; datos.length < total; i++) datos.push(i % 2 === 0 ? 0xec : 0x11);

  // A bloques, cada uno con su corrección.
  const bloquesDatos: number[][] = [];
  const bloquesEc: number[][] = [];
  let corte = 0;
  for (const [cuantos, largo] of [[g1b, g1d], [g2b, g2d]]) {
    for (let i = 0; i < cuantos; i++) {
      const trozo = datos.slice(corte, corte + largo);
      corte += largo;
      bloquesDatos.push(trozo);
      bloquesEc.push(correccion(trozo, ec));
    }
  }

  // Entrelazado: primero el byte 0 de cada bloque, luego el 1 de cada uno…
  // Es lo que reparte un borrón entre todos los bloques en vez de comerse uno.
  const salida: number[] = [];
  const masLargo = Math.max(g1d, g2d);
  for (let i = 0; i < masLargo; i++) {
    for (const b of bloquesDatos) if (i < b.length) salida.push(b[i]);
  }
  for (let i = 0; i < ec; i++) {
    for (const b of bloquesEc) salida.push(b[i]);
  }
  return Uint8Array.from(salida);
}

// ── La rejilla ───────────────────────────────────────────────────────────────

type Rejilla = (0 | 1 | null)[][];

/** Las ocho máscaras. Se prueban todas y gana la menos fea: ver `fealdad()`. */
function enmascara(m: number, i: number, j: number): boolean {
  switch (m) {
    case 0: return (i + j) % 2 === 0;
    case 1: return i % 2 === 0;
    case 2: return j % 3 === 0;
    case 3: return (i + j) % 3 === 0;
    case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
    case 5: return ((i * j) % 2) + ((i * j) % 3) === 0;
    case 6: return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
    default: return (((i + j) % 2) + ((i * j) % 3)) % 2 === 0;
  }
}

/** BCH(15,5) para la información de formato, y BCH(18,6) para la de versión.
 *  Dos polinomios distintos, la misma división. */
function bch(valor: number, generador: number, grado: number): number {
  const bits = (n: number) => { let c = 0; while (n !== 0) { c++; n >>>= 1; } return c; };
  const largoGen = bits(generador);
  let resto = valor << grado;
  while (bits(resto) >= largoGen) resto ^= generador << (bits(resto) - largoGen);
  return (valor << grado) | resto;
}

/** Los quince bits de formato: nivel de corrección y máscara, con su BCH y el
 *  XOR que impide que salgan quince ceros. Q es `0b11`. */
const bitsFormato = (mascara: number) => bch((0b11 << 3) | mascara, 0b10100110111, 10) ^ 0b101010000010010;

/** Los dieciocho de versión. Sólo se pintan de la 7 en adelante. */
const bitsVersion = (v: number) => bch(v, 0b1111100100101, 12);

/** Monta la rejilla entera con una máscara dada: patrones fijos, datos y
 *  formato. Se llama ocho veces, una por máscara. */
function construir(version: number, datos: Uint8Array, mascara: number): Rejilla {
  const tam = version * 4 + 17;
  const m: Rejilla = Array.from({ length: tam }, () => new Array(tam).fill(null) as (0 | 1 | null)[]);

  const pon = (i: number, j: number, v: 0 | 1) => { m[i][j] = v; };

  // Los tres ojos, con su separador blanco alrededor.
  for (const [fi, fj] of [[0, 0], [0, tam - 7], [tam - 7, 0]]) {
    for (let i = -1; i <= 7; i++) {
      for (let j = -1; j <= 7; j++) {
        const y = fi + i, x = fj + j;
        if (y < 0 || y >= tam || x < 0 || x >= tam) continue;
        // El anillo de -1 y de 7 es el separador y va SIEMPRE en claro. Si se
        // deja que lo decida la regla del ojo, (7,0) cumple «j === 0» y sale
        // oscuro: el separador se come una esquina y el lector pierde el ojo.
        if (i < 0 || i > 6 || j < 0 || j > 6) { pon(y, x, 0); continue; }
        const borde = i === 0 || i === 6 || j === 0 || j === 6;
        const centro = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        pon(y, x, borde || centro ? 1 : 0);
      }
    }
  }

  // Las dos reglas de sincronía: la fila y la columna 6, alternando.
  for (let i = 8; i < tam - 8; i++) {
    const v: 0 | 1 = i % 2 === 0 ? 1 : 0;
    pon(6, i, v);
    pon(i, 6, v);
  }

  // Alineación: cuadros de 5×5 donde se cruzan los centros, salvo encima de
  // los ojos —ahí ya hay patrón y no caben dos.
  const centros = ALINEACION[version - 1];
  for (const ci of centros) {
    for (const cj of centros) {
      const enOjo =
        (ci <= 8 && cj <= 8) || (ci <= 8 && cj >= tam - 9) || (ci >= tam - 9 && cj <= 8);
      if (enOjo) continue;
      for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
          const borde = Math.max(Math.abs(i), Math.abs(j));
          pon(ci + i, cj + j, borde === 1 ? 0 : 1);
        }
      }
    }
  }

  // Se reservan los huecos de formato y versión antes de meter datos: el
  // zigzag sólo escribe donde todavía hay `null`, así que marcarlos ahora es
  // lo que impide que los datos se metan en su sitio.
  for (let i = 0; i < 15; i++) {
    const [a, b] = posFormato(i, tam);
    pon(a[0], a[1], 0);
    pon(b[0], b[1], 0);
  }
  pon(tam - 8, 8, 1); // el módulo que siempre está oscuro
  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      pon(Math.floor(i / 3), tam - 11 + (i % 3), 0);
      pon(tam - 11 + (i % 3), Math.floor(i / 3), 0);
    }
  }

  // Los datos, en zigzag de dos columnas desde abajo a la derecha. La columna 6
  // se salta entera: ahí vive la regla de sincronía.
  const bits = datos.length * 8;
  let n = 0;
  let sube = true;
  for (let col = tam - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let paso = 0; paso < tam; paso++) {
      const fila = sube ? tam - 1 - paso : paso;
      for (let c = 0; c < 2; c++) {
        const x = col - c;
        if (m[fila][x] !== null) continue;
        let oscuro = n < bits && ((datos[n >>> 3] >>> (7 - (n & 7))) & 1) === 1;
        if (enmascara(mascara, fila, x)) oscuro = !oscuro;
        m[fila][x] = oscuro ? 1 : 0;
        n++;
      }
    }
    sube = !sube;
  }

  // Y encima, el formato y la versión ya sin máscara.
  const f = bitsFormato(mascara);
  for (let i = 0; i < 15; i++) {
    const bit: 0 | 1 = ((f >>> i) & 1) === 1 ? 1 : 0;
    const [a, b] = posFormato(i, tam);
    pon(a[0], a[1], bit);
    pon(b[0], b[1], bit);
  }
  pon(tam - 8, 8, 1);
  if (version >= 7) {
    const v = bitsVersion(version);
    for (let i = 0; i < 18; i++) {
      const bit: 0 | 1 = ((v >>> i) & 1) === 1 ? 1 : 0;
      pon(Math.floor(i / 3), tam - 11 + (i % 3), bit);
      pon(tam - 11 + (i % 3), Math.floor(i / 3), bit);
    }
  }

  return m;
}

/** Dónde va el bit `i` de formato, en sus dos copias. Las coordenadas las fija
 *  la norma y no siguen ninguna fórmula bonita: son una lista. */
function posFormato(i: number, tam: number): [[number, number], [number, number]] {
  const uno: [number, number] =
    i < 6 ? [i, 8] : i === 6 ? [7, 8] : i === 7 ? [8, 8] : i === 8 ? [8, 7] : [8, 14 - i];
  const dos: [number, number] = i < 8 ? [8, tam - 1 - i] : [tam - 15 + i, 8];
  return [uno, dos];
}

/** Las cuatro penalizaciones de la norma. Gana la máscara con menos puntos:
 *  la idea es evitar rejillas que se parezcan a un ojo o que tengan manchones,
 *  que es lo que despista al lector del teléfono. */
function fealdad(m: Rejilla): number {
  const tam = m.length;
  let total = 0;

  // 1) Rachas de cinco o más del mismo color, en filas y en columnas.
  for (let vuelta = 0; vuelta < 2; vuelta++) {
    for (let i = 0; i < tam; i++) {
      let racha = 1;
      let previo = -1;
      for (let j = 0; j < tam; j++) {
        const v = vuelta === 0 ? m[i][j] : m[j][i];
        if (v === previo) racha++;
        else {
          if (racha >= 5) total += 3 + (racha - 5);
          racha = 1;
          previo = v as number;
        }
      }
      if (racha >= 5) total += 3 + (racha - 5);
    }
  }

  // 2) Cuadros de 2×2 de un solo color.
  for (let i = 0; i < tam - 1; i++) {
    for (let j = 0; j < tam - 1; j++) {
      const v = m[i][j];
      if (v === m[i][j + 1] && v === m[i + 1][j] && v === m[i + 1][j + 1]) total += 3;
    }
  }

  // 3) El dibujo que se confunde con un ojo, en los dos sentidos.
  const OJO = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const OJO_AL_REVES = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  for (let i = 0; i < tam; i++) {
    for (let j = 0; j <= tam - 11; j++) {
      for (const patron of [OJO, OJO_AL_REVES]) {
        let fila = true;
        let col = true;
        for (let k = 0; k < 11; k++) {
          if (m[i][j + k] !== patron[k]) fila = false;
          if (m[j + k][i] !== patron[k]) col = false;
          if (!fila && !col) break;
        }
        if (fila) total += 40;
        if (col) total += 40;
      }
    }
  }

  // 4) Que no haya mucho más negro que blanco.
  let oscuros = 0;
  for (const fila of m) for (const v of fila) if (v === 1) oscuros++;
  const porciento = (oscuros * 100) / (tam * tam);
  total += Math.floor(Math.abs(porciento - 50) / 5) * 10;

  return total;
}

// ── La puerta ────────────────────────────────────────────────────────────────

/** La rejilla de un texto: `true` es un módulo oscuro. Sin zona de silencio
 *  —eso lo pone quien dibuja—. */
export function rejilla(texto: string): boolean[][] {
  const bytes = [...new TextEncoder().encode(texto)];

  const version = Array.from({ length: VERSIONES }, (_, i) => i + 1)
    .find((v) => bytes.length <= cabe(v));
  if (!version) {
    throw new Error(
      `No cabe en un QR de los que dibuja el panel: son ${bytes.length} bytes y caben ${cabe(VERSIONES)}.`,
    );
  }

  const datos = codificar(bytes, version);

  // Se montan las ocho y se queda la menos fea. Cuesta ocho rejillas de 45×45,
  // que en un navegador es nada, y es lo que dice la norma que hay que hacer.
  let mejor: Rejilla | null = null;
  let menos = Infinity;
  for (let mascara = 0; mascara < 8; mascara++) {
    const m = construir(version, datos, mascara);
    const puntos = fealdad(m);
    if (puntos < menos) { menos = puntos; mejor = m; }
  }

  return mejor!.map((fila) => fila.map((v) => v === 1));
}

/**
 * El QR como SVG, listo para meter en el DOM o mandar a la impresora.
 *
 * Un solo `<path>` con todos los módulos en vez de mil `<rect>`: pesa la
 * cuarta parte y las impresoras no dejan pelo blanco entre cuadro y cuadro.
 *
 * `borde` son módulos de zona de silencio. La norma pide cuatro y no es
 * decorativo: sin margen, muchos lectores no encuentran el código.
 */
export function qr(texto: string, { borde = 4 } = {}): string {
  const m = rejilla(texto);
  const tam = m.length + borde * 2;

  let trazo = '';
  for (let i = 0; i < m.length; i++) {
    for (let j = 0; j < m.length; j++) {
      if (m[i][j]) trazo += `M${j + borde} ${i + borde}h1v1h-1z`;
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tam} ${tam}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="Código QR">` +
    `<rect width="${tam}" height="${tam}" fill="#ffffff"/>` +
    `<path d="${trazo}" fill="#1e1e1e"/>` +
    `</svg>`
  );
}
