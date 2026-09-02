/**
 * Las formas del contenido que carga el festival desde `/admin`.
 *
 * Estaban repartidas entre `site.ts`, `artistas.ts` y `archivo.ts`, cada una
 * junto a su lista. Se juntan aquí porque ahora hay tres sitios que tienen que
 * coincidir en ellas —los archivos de datos, el validador del Worker y los
 * formularios del panel— y con el tipo en un solo lugar el desacuerdo se ve.
 *
 * Los archivos de datos las siguen re-exportando, así que nada de lo que ya
 * importaba `Sede`, `Marca` o `Artista` se entera de este movimiento.
 *
 * Quien manda de verdad sobre estas formas es `workers/panel/lib/validar.js`:
 * TypeScript comprueba el código, pero el JSON llega de fuera y sólo el Worker
 * puede prometer que viene bien.
 */

export type Sede = {
  nombre: string;
  direccion: string;
  /** Vacío mientras no nos pasen la cuenta: la ficha oculta el enlace. */
  instagram?: string;
  /** Enlace corto al pin exacto. Sin él se busca por dirección. */
  mapa?: string;
  /**
   * `[latitud, longitud]`, para clavar la estrella en el plano de la portada.
   *
   * De dónde sale cada una: las que tienen `mapa` son el pin que nos pasaron,
   * leído del enlace corto de Google; las demás salen del número de puerta en
   * OpenStreetMap —el exacto si existe, y si no interpolando entre el anterior
   * y el siguiente de la misma calle—. Se comprobó el método contra las que sí
   * tienen pin: cae dentro de la manzana.
   *
   * Sin coordenada no hay estrella. Es lo que toca cuando una sede no está en
   * Guadalajara: antes que inventarle un punto, el mapa lo dice.
   */
  coord?: [number, number];
  /** Qué contar cuando no hay estrella que enseñar. */
  notaMapa?: string;
};

/** Una barra de la rejilla del programa. */
export type ActividadGantt = {
  titulo: string;
  /** Índice del día dentro de `programa.dias`: 0 = jueves … 3 = domingo. */
  dia: number;
  /** 24 h, 'HH:MM'. El fin es lo que le da largo a la barra. */
  inicio: string;
  fin: string;
  /** Tiene que coincidir con un `nombre` de `sedes.lista`. */
  sede: string;
  /** Colorea la barra: uno de `coloresGantt`. */
  tipo: 'taller' | 'charla' | 'muestra' | 'escena';
  /** Quién la da. Sale en la ficha, debajo del título. */
  artista?: string;
  /** Formulario de Tally de esta actividad. Sin él, la ficha sale sin botón. */
  registro?: string;
  /**
   * Se entra sin apuntarse.
   *
   * Existe para separar dos cosas que sin ella se leen igual —«esta actividad
   * no pide registro» y «todavía no nos han pasado el formulario»—, y que para
   * el visitante son opuestas. Marcada, `/registro` la lista como entrada
   * libre; sin marcar y sin formulario, la actividad se queda fuera de la
   * página y el panel la cuenta como pendiente.
   */
  libre?: boolean;
};

/**
 * Quién expone.
 *
 * Qué hace falta por artista, en orden de importancia:
 *   1. `nombre`      — obligatorio, es lo único que no puede faltar.
 *   2. `foto`        — recortada a 4:5 (p. ej. 1000×1250). Sin foto la ficha
 *                      sale con la caja en amarillo y el nombre en grande, que
 *                      es un hueco honesto, no un error.
 *   3. `disciplina`  — dos o tres palabras: «performance», «gráfica
 *                      expandida», «instalación sonora».
 *   4. `instagram`   — la URL entera. Sin ella la ficha sale sin el botón «IG».
 *   5. `sede`        — tiene que coincidir LETRA POR LETRA con un `nombre` de
 *                      `sedes.lista`, que es como empareja `sedeDe()`.
 */
export type Artista = {
  nombre: string;
  disciplina?: string;
  /** Ruta dentro de `public/`, o la URL que devuelve Cloudinary. En 4:5. */
  foto?: string;
  instagram?: string;
  /** Debe existir en `sedes.lista`. */
  sede?: string;
};

export type Foto = {
  /** Ruta dentro de `public/`, o la URL que devuelve Cloudinary. */
  src: string;
  /** Quién, dónde, qué se ve. Sale debajo de la foto. */
  pie?: string;
};

/**
 * Una edición anterior del festival.
 *
 * El `pie` de cada foto es opcional pero es lo que convierte un álbum en un
 * archivo. `sedes` y `actividades` son los números del índice: si no se saben,
 * se dejan fuera y la columna no se pinta.
 */
export type Edicion = {
  edicion: string;
  anio: string;
  lema?: string;
  sedes?: number;
  actividades?: number;
  fotos: Foto[];
};

/** Patrocinadores y colaboradores. Sin `logo` se pinta el nombre en display:
 *  prefiero un hueco honesto a inventar un archivo que no nos dieron. */
export type Marca = { nombre: string; logo?: string; url?: string };

/**
 * El registro a eventos, en lo que NO es de una actividad concreta.
 *
 * Aquí uno se apunta **por actividad**: cada `ActividadGantt` trae su propio
 * `registro` —su Tally— y es ahí donde vive el formulario. Esto de al lado son
 * las tres cosas que no caben en ninguna fila porque son de la página entera.
 *
 * `abierto` se declara, no se deduce, por lo mismo que `esEjemplo`: que haya
 * formularios pegados no quiere decir que el registro esté abierto —se pegan
 * mientras se preparan—, y anunciar un registro que todavía no lo está es el
 * error caro. Sin la clave, cerrado.
 */
export type Registro = {
  /** Si `/registro` enseña los eventos o el cartel de «Próximamente». */
  abierto?: boolean;
  /** Un formulario para todo el festival, si lo hay. Va aparte de los de cada
   *  actividad y sale arriba de la página. */
  general?: string;
  /** Qué contar sobre el registro: cupos, si hace falta llegar antes, qué
   *  actividades son de entrada libre. Sale debajo del titular. */
  nota?: string;
};

/** Lo que devuelve `GET /contenido` del Worker y lo que hay en
 *  `contenido.json`. Las cinco colecciones y de dónde viene la instantánea. */
export type Contenido = {
  /** Sube uno por cada guardado del panel. `0` = nunca se ha tocado el panel:
   *  lo que hay es la semilla que salió de los `.ts`. */
  version: number;
  actualizado: string | null;
  sedes: Sede[];
  programa: {
    actividades: ActividadGantt[];
    /** Si la rejilla todavía es el andamio de ejemplo. Lo apaga el festival
     *  desde el panel cuando mete su programación de verdad; mientras esté en
     *  `true`, el sitio no enseña el programa y pone el cartel de espera en su
     *  lugar. Desmarcarlo es, en la práctica, publicar.
     *
     *  No se deduce de si el panel se ha usado: sembrarlo con los eventos de
     *  ejemplo ya cuenta como usarlo. Es una decisión, y la toma quien sabe si
     *  eso de ahí es el programa o no. */
    esEjemplo?: boolean;
    /** El registro a eventos. Vive DENTRO del programa y no en una colección
     *  propia porque no es otra cosa: son los mismos eventos mirados por la
     *  puerta de entrar. Así, además, el interruptor de «abierto» y las
     *  actividades a las que se apunta se guardan de una sola vez, y no puede
     *  quedar un registro abierto sobre una programación que no entró. */
    registro?: Registro;
  };
  artistas: Artista[];
  archivo: Edicion[];
  marcas: { patrocinadores: Marca[]; colaboradores: Marca[] };
};
