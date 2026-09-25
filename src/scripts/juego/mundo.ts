/**
 * El mundo del juego: física, sillas y choques. Sin DOM y sin reloj.
 *
 * Todo avanza de a un paso de 1/60 s (`paso()`) y quien pinta decide cuántos
 * pasos tocan por cuadro. Separarlo así hace que la física sea la misma en una
 * pantalla de 60 Hz y en una de 120, y que se pueda jugar sin navegador: un
 * script puede meterle teclas y ver si una fila de sillas se puede saltar.
 *
 * Las cuentas son las del dino de Chrome —gravedad, impulso, aceleración, la
 * fórmula de los huecos—, que llevan años afinadas y son las que la mano ya
 * conoce. Lo que cambia son los obstáculos y el tamaño: una silla es más ancha
 * que un cactus, así que las filas de tres sillas grandes esperan a que el
 * juego vaya lo bastante rápido para que el salto las cubra.
 *
 * Unidades: el mundo mide 150 de alto y lo que dé de ancho la pantalla. El
 * eje y crece hacia abajo, como en el lienzo; la altura del salto (`h`) crece
 * hacia arriba, porque así se lee mejor la física.
 */
import { DINO, SILLA, SILLA_EN_EL_AIRE, type Sprite } from './sprites';

/** Unidades por píxel gordo. */
export const P = 2;
/** Alto del mundo. */
export const ALTO = 150;
/** Donde pisan el dino y las sillas. */
export const SUELO = 140;
/** Donde está plantado el dino. */
export const X_DINO = 50;

/**
 * Con un mundo más angosto que esto se ve venir menos, así que el juego va
 * más despacio en la misma proporción. Es lo que hace el de Chrome en el
 * teléfono.
 */
const ANCHO_DE_REFERENCIA = 600;
/**
 * Pero no menos que esto. Más despacio, el salto cubre menos suelo, y por
 * debajo de 4,5 una fila de sillas chicas ya no se puede saltar: la ventana
 * para pasarla se queda en cero. Un teléfono de 320 px cae justo en el tope;
 * lo más angosto —una ventana estrecha, un plegable cerrado— se queda en 4,5
 * en vez de bajar a 4.
 */
const FACTOR_MIN = 0.75;
/** Pasos que tarda el suelo en ponerse a velocidad al arrancar (0,3 s). */
const PASOS_ARRANQUE = 18;

// ── Física, por paso ──────────────────────────────────────────────────────
const GRAVEDAD = 0.6;
/** Impulso del salto; se le suma una décima de la velocidad. */
const IMPULSO = 10;
/** Por muy poco que se toque, el salto llega hasta aquí. */
const ALTURA_MIN = 30;
/** Y a partir de aquí deja de empujar aunque se mantenga pulsado. */
const ALTURA_MAX = 63;
/** A lo que baja la subida cuando se suelta la tecla: un salto corto. */
const FRENO = 5;
/** ↓ en el aire: cae así de más rápido. */
const CAIDA_RAPIDA = 3;

const VELOCIDAD = 6;
const VELOCIDAD_MAX = 13;
const ACELERACION = 0.001;

const COEF_HUECO = 0.6;
const HUECO_MAX = 1.5;
/** Las mismas veces seguidas que puede salir un tipo de obstáculo. */
const REPETICIONES = 2;

const PUNTOS_POR_UNIDAD = 0.025;
export const PUNTOS_MAX = 99999;

/** Cada cuántos pasos cambia de pata el dino al correr, y agachado. */
const PASOS_POR_ZANCADA = 5;
const PASOS_POR_ZANCADA_AGACHADO = 8;
/** Cada cuántos pasos da un cuarto de vuelta la silla que vuela. */
const PASOS_POR_GIRO = 6;

/** Las estrellas del fondo van a esta fracción de la velocidad del suelo. */
const PARALAJE = 0.1;
/** Cada cuánto se repite el dibujo de motas bajo la línea del suelo. */
export const PERIODO_SUELO = 720;

// ── Obstáculos ────────────────────────────────────────────────────────────

export type Clase = 'chica' | 'grande' | 'voladora';

interface Tipo {
  clase: Clase;
  sprite: Sprite;
  /** Velocidad a partir de la que puede salir. */
  desde: number;
  /** Velocidad a partir de la que puede venir en fila, de dos o de tres. */
  enFila: number;
  /** Separación mínima con la siguiente, antes del coeficiente. */
  hueco: number;
  /** Cuánto avanza cada silla sobre la anterior dentro de una fila: se
   *  montan un poco, la pata de atrás de una bajo el asiento de la otra. */
  paso: number;
}

// Los umbrales de las filas están medidos, no puestos a ojo: por debajo, la
// fila no tiene ninguna manera de saltarse (ver «El juego de la 404» en el
// README).
const TIPOS: Tipo[] = [
  { clase: 'chica', sprite: SILLA.chica, desde: 0, enFila: 5, hueco: 120, paso: 24 },
  { clase: 'grande', sprite: SILLA.grande, desde: 0, enFila: 7, hueco: 120, paso: 32 },
  // Una fila de sillas volando no se puede esquivar; sale siempre sola.
  { clase: 'voladora', sprite: SILLA.chica, desde: 8.5, enFila: Infinity, hueco: 150, paso: 0 },
];

/**
 * Alturas de la silla que vuela, medidas en su centro. La baja da en las
 * piernas y hay que saltarla; la media da en la cabeza y hay que agacharse
 * (o saltarla con todo); la alta pasa por encima y sólo pega si se salta. Da
 * igual cómo esté girada: las tres están medidas con la silla parada y
 * acostada.
 */
const ALTURAS_EN_EL_AIRE = { baja: 122, media: 98, alta: 74 };
/** El lado más largo de la silla que vuela, girada como esté. */
const LADO_EN_EL_AIRE = Math.max(SILLA.chica.ancho, SILLA.chica.alto) * P;

export interface Obstaculo {
  clase: Clase;
  /** Borde izquierdo, y dónde estaba un paso antes (para interpolar). */
  x: number;
  xAntes: number;
  /** Las del suelo: su borde de arriba. La que vuela: su centro. */
  y: number;
  /** Cuántas sillas en fila. */
  n: number;
  ancho: number;
  /** Distancia hasta la siguiente. */
  hueco: number;
  /** Ya se creó la siguiente. */
  relevo: boolean;
  /** La que vuela: cuál de sus cuatro posturas toca. */
  giro: number;
}

/** Una silla suelta dentro de un obstáculo, lista para pintar o para chocar. */
export interface Pieza {
  sprite: Sprite;
  x: number;
  y: number;
}

export interface Estrella {
  x: number;
  xAntes: number;
  y: number;
  /** Cuánto espera la siguiente. */
  hueco: number;
}

export interface Mota {
  x: number;
  y: number;
  ancho: number;
}

/**
 * ¿Se tocan dos sprites? Píxel a píxel y no por cajas: la silla es casi toda
 * hueco —entre el respaldo y el asiento, entre las patas— y una caja la haría
 * chocar contra el aire.
 *
 * Se pide que las dos celdas se monten al menos `HOLGURA` en los dos ejes.
 * Rozarse por un canto no cuenta: lo que se ve como un roce no puede acabar
 * la partida.
 */
const HOLGURA = 0.5;

function chocan(a: Sprite, ax: number, ay: number, b: Sprite, bx: number, by: number): boolean {
  const x0 = Math.max(ax, bx), x1 = Math.min(ax + a.ancho * P, bx + b.ancho * P);
  const y0 = Math.max(ay, by), y1 = Math.min(ay + a.alto * P, by + b.alto * P);
  if (x1 - x0 <= HOLGURA || y1 - y0 <= HOLGURA) return false;

  // Sólo las celdas de `b` que caen en la zona común, y por cada una, las (a
  // lo sumo) cuatro de `a` que puede pisar.
  const i0 = Math.max(0, Math.floor((x0 - bx) / P)), i1 = Math.min(b.ancho, Math.ceil((x1 - bx) / P));
  const j0 = Math.max(0, Math.floor((y0 - by) / P)), j1 = Math.min(b.alto, Math.ceil((y1 - by) / P));
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      if (!b.celdas[j * b.ancho + i]) continue;
      const cx = bx + i * P, cy = by + j * P;
      const ai = Math.floor((cx - ax) / P), aj = Math.floor((cy - ay) / P);
      for (let dj = 0; dj < 2; dj++) {
        for (let di = 0; di < 2; di++) {
          const u = ai + di, v = aj + dj;
          if (u < 0 || v < 0 || u >= a.ancho || v >= a.alto || !a.celdas[v * a.ancho + u]) continue;
          const sx = Math.min(cx + P, ax + (u + 1) * P) - Math.max(cx, ax + u * P);
          const sy = Math.min(cy + P, ay + (v + 1) * P) - Math.max(cy, ay + v * P);
          if (sx > HOLGURA && sy > HOLGURA) return true;
        }
      }
    }
  }
  return false;
}

export type Estado = 'inicio' | 'corriendo' | 'fin';

export class Mundo {
  /** Ancho del mundo en unidades; lo pone quien pinta, según la pantalla. */
  ancho: number;
  /** En táctil no hay manera de agacharse: la silla no sale a media altura. */
  sinAgacharse = false;
  /** Las estrellas del fondo no se mueven (menos movimiento, por petición). */
  estrellasQuietas = false;

  estado: Estado = 'inicio';
  velocidad = VELOCIDAD;
  distancia = 0;
  pasos = 0;
  /**
   * Cuánto se mueve el mundo, de 0 a 1. Como en el de Chrome, el primer
   * salto es en el sitio: el suelo no arranca hasta que el dino vuelve a
   * pisarlo, y entonces se pone a velocidad en `PASOS_ARRANQUE`, sin
   * tirón. Tras un choque se empieza sin salto, y arranca en el primer paso.
   */
  arranque = 0;
  private arrancado = false;
  /** Lo que ha corrido el suelo, para las motas. */
  recorrido = 0;
  recorridoAntes = 0;

  // El dino. `h` es la altura de los pies sobre el suelo.
  h = 0;
  hAntes = 0;
  vh = 0;
  saltando = false;
  agachado = false;
  /** Se soltó la tecla: el salto se corta en cuanto llegue a la altura mínima. */
  private soltado = false;
  private alcanzoMin = false;
  private caidaRapida = false;
  /** ↓ sigue pulsada: al aterrizar, se agacha. */
  private abajo = false;

  obstaculos: Obstaculo[] = [];
  private historial: Clase[] = [];
  estrellas: Estrella[] = [];
  motas: Mota[] = [];

  constructor(ancho: number, private azar: () => number = Math.random) {
    this.ancho = ancho;
    for (let x = 0; x < PERIODO_SUELO; x += 12 + this.azar() * 40) {
      this.motas.push({ x, y: SUELO + 3 + Math.floor(this.azar() * 3) * 2, ancho: this.azar() < 0.7 ? 2 : 4 });
    }
    this.reiniciar();
  }

  /** La velocidad con la que se mueve de verdad el suelo en esta pantalla. */
  get velocidadReal(): number {
    return this.velocidad * Math.min(1, Math.max(FACTOR_MIN, (this.ancho / ANCHO_DE_REFERENCIA) * 1.2));
  }

  get puntos(): number {
    return Math.min(PUNTOS_MAX, Math.floor(this.distancia * PUNTOS_POR_UNIDAD));
  }

  /** El dibujo del dino que toca ahora (el parpadeo lo decide quien pinta). */
  get dino(): Sprite {
    if (this.estado === 'fin') return DINO.choque;
    if (this.estado === 'inicio' || this.saltando) return DINO.quieto;
    if (this.agachado) return DINO.agachado[Math.floor(this.pasos / PASOS_POR_ZANCADA_AGACHADO) % 2];
    return DINO.corre[Math.floor(this.pasos / PASOS_POR_ZANCADA) % 2];
  }

  /** Borde de arriba del dino, a una altura dada (por defecto, la de ahora). */
  yDino(h = this.h, sprite = this.dino): number {
    return SUELO - sprite.alto * P - h;
  }

  /**
   * Vuelve a la escena de espera: el dino de pie y, a la derecha, la primera
   * silla ya plantada. Así, antes de tocar nada, la pantalla ya cuenta de qué
   * va el juego.
   */
  reiniciar() {
    this.estado = 'inicio';
    this.velocidad = VELOCIDAD;
    this.distancia = 0;
    this.pasos = 0;
    this.arranque = 0;
    this.arrancado = false;
    this.h = this.hAntes = this.vh = 0;
    this.saltando = this.agachado = this.soltado = this.alcanzoMin = this.caidaRapida = false;
    this.obstaculos = [];
    this.historial = [];
    // Una chica sola, que se salta de un toque: la primera no puede pedir
    // oficio. Llega un segundo y pico después de empezar.
    this.nuevo(Math.min(this.ancho - 40, X_DINO + 44 + VELOCIDAD * 75), TIPOS[0], 1);

    this.estrellas = [];
    for (let x = this.ancho * (0.2 + this.azar() * 0.2); x < this.ancho; x += 160 + this.azar() * 200) {
      this.estrellas.push(this.estrella(x));
    }
  }

  empezar() {
    if (this.estado === 'inicio') this.estado = 'corriendo';
  }

  saltar() {
    if (this.estado === 'inicio') this.empezar();
    if (this.estado !== 'corriendo' || this.saltando || this.agachado) return;
    this.saltando = true;
    this.vh = IMPULSO + this.velocidadReal / 10;
    this.soltado = this.alcanzoMin = this.caidaRapida = false;
  }

  soltarSalto() {
    this.soltado = true;
  }

  agacharse(si: boolean) {
    this.abajo = si;
    if (this.estado !== 'corriendo') return;
    if (!si) {
      this.agachado = this.caidaRapida = false;
    } else if (this.saltando) {
      this.caidaRapida = true;
      this.vh = -1;
    } else {
      this.agachado = true;
    }
  }

  /** Un paso de 1/60 s. */
  paso() {
    if (this.estado !== 'corriendo') return;
    this.pasos++;

    this.hAntes = this.h;
    if (this.saltando) this.moverSalto();

    // El suelo espera a que el dino pise; luego entra suave (smoothstep).
    if (!this.saltando) this.arrancado = true;
    if (this.arrancado && this.arranque < 1) this.arranque = Math.min(1, this.arranque + 1 / PASOS_ARRANQUE);
    const suave = this.arranque * this.arranque * (3 - 2 * this.arranque);
    const v = this.velocidadReal * suave;

    this.recorridoAntes = this.recorrido;
    this.recorrido += v;
    this.distancia += this.velocidad * suave;
    if (this.arranque === 1 && this.velocidad < VELOCIDAD_MAX) this.velocidad += ACELERACION;

    for (const o of this.obstaculos) {
      o.xAntes = o.x;
      o.x -= v;
      if (o.clase === 'voladora' && this.pasos % PASOS_POR_GIRO === 0) o.giro = (o.giro + 1) % 4;
    }
    while (this.obstaculos.length && this.obstaculos[0].x + this.obstaculos[0].ancho < 0) {
      this.obstaculos.shift();
    }
    const ultimo = this.obstaculos[this.obstaculos.length - 1];
    if (!ultimo) {
      this.nuevo(this.ancho);
    } else if (!ultimo.relevo && ultimo.x + ultimo.ancho + ultimo.hueco < this.ancho) {
      ultimo.relevo = true;
      this.nuevo(this.ancho);
    }

    this.moverEstrellas(v);

    if (this.choco()) this.estado = 'fin';
  }

  /** Las sillas sueltas de un obstáculo, a una x dada (por defecto, la de ahora). */
  piezas(o: Obstaculo, x = o.x): Pieza[] {
    if (o.clase === 'voladora') {
      const sprite = SILLA_EN_EL_AIRE[o.giro];
      return [{
        sprite,
        x: x + (LADO_EN_EL_AIRE - sprite.ancho * P) / 2,
        y: o.y - (sprite.alto * P) / 2,
      }];
    }
    const tipo = TIPOS.find((t) => t.clase === o.clase)!;
    return Array.from({ length: o.n }, (_, k) => ({ sprite: tipo.sprite, x: x + k * tipo.paso, y: o.y }));
  }

  private moverSalto() {
    this.h += this.vh * (this.caidaRapida ? CAIDA_RAPIDA : 1);
    this.vh -= GRAVEDAD;
    if (this.h >= ALTURA_MIN || this.caidaRapida) this.alcanzoMin = true;
    if (this.h >= ALTURA_MAX || this.caidaRapida || this.soltado) this.cortarSalto();
    if (this.h <= 0) {
      this.h = this.vh = 0;
      this.saltando = this.caidaRapida = false;
      // Si ↓ sigue pulsada, la caída rápida acaba agachado.
      if (this.abajo) this.agachado = true;
    }
  }

  private cortarSalto() {
    if (this.alcanzoMin && this.vh > FRENO) this.vh = FRENO;
  }

  private nuevo(x: number, tipo?: Tipo, n?: number) {
    const v = this.velocidadReal;
    if (!tipo) {
      const posibles = TIPOS.filter((t) => v >= t.desde && !this.repetido(t.clase));
      tipo = posibles[Math.floor(this.azar() * posibles.length)];
    }
    n ??= v >= tipo.enFila ? 1 + Math.floor(this.azar() * 3) : 1;

    let ancho: number, y: number;
    if (tipo.clase === 'voladora') {
      ancho = LADO_EN_EL_AIRE;
      const alturas = this.sinAgacharse
        ? [ALTURAS_EN_EL_AIRE.baja, ALTURAS_EN_EL_AIRE.alta]
        : [ALTURAS_EN_EL_AIRE.baja, ALTURAS_EN_EL_AIRE.media, ALTURAS_EN_EL_AIRE.alta];
      y = alturas[Math.floor(this.azar() * alturas.length)];
    } else {
      ancho = tipo.sprite.ancho * P + (n - 1) * tipo.paso;
      y = SUELO - tipo.sprite.alto * P;
    }

    const minimo = Math.round(ancho * v + tipo.hueco * COEF_HUECO);
    const hueco = minimo + Math.floor(this.azar() * (Math.round(minimo * HUECO_MAX) - minimo + 1));

    this.obstaculos.push({ clase: tipo.clase, x, xAntes: x, y, n, ancho, hueco, relevo: false, giro: 0 });
    this.historial.unshift(tipo.clase);
    this.historial.length = Math.min(this.historial.length, REPETICIONES);
  }

  /** ¿Ya salió este tipo las veces seguidas que puede salir? */
  private repetido(clase: Clase): boolean {
    return this.historial.length >= REPETICIONES && this.historial.every((c) => c === clase);
  }

  /** Entre el renglón del marcador (arriba, hasta ~30) y el letrero de en
   *  medio (desde 84): así ninguna estrella se mete debajo de una letra. */
  private estrella(x: number): Estrella {
    return { x, xAntes: x, y: 32 + this.azar() * 28, hueco: 160 + this.azar() * 260 };
  }

  private moverEstrellas(v: number) {
    if (this.estrellasQuietas) return;
    for (const e of this.estrellas) {
      e.xAntes = e.x;
      e.x -= v * PARALAJE;
    }
    this.estrellas = this.estrellas.filter((e) => e.x > -20);
    const ultima = this.estrellas[this.estrellas.length - 1];
    if (!ultima || ultima.x < this.ancho - ultima.hueco) this.estrellas.push(this.estrella(this.ancho + 10));
  }

  private choco(): boolean {
    const sprite = this.dino;
    const x = X_DINO, y = this.yDino(this.h, sprite);
    const derecha = x + sprite.ancho * P;
    for (const o of this.obstaculos) {
      if (o.x > derecha) break;
      if (o.x + o.ancho < x) continue;
      for (const p of this.piezas(o)) {
        if (chocan(sprite, x, y, p.sprite, p.x, p.y)) return true;
      }
    }
    return false;
  }
}
