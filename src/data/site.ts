/**
 * Todo el texto del sitio, en un solo lugar.
 * Migrado literalmente desde el sitio Wix original (festivaldearteconceptual.com).
 * No inventar copy aquí: si algo falta, es porque el original lo tiene vacío.
 */

export const festival = {
  nombre: 'Festival de Arte Conceptual',
  nombreCorto: 'Cuarta Silla',
  nombreCompleto: 'Festival de Arte Conceptual La Cuarta Silla',
  edicion: 'Cuarta Silla',
  fechas: 'Del 24 al 27 de Septiembre, 2026',
  ciudad: 'Guadalajara, Jalisco',
  anio: '2026',
  // Fecha de arranque para la cuenta regresiva (24 sep 2026, 08:00 hora de GDL / UTC-6)
  inicioISO: '2026-09-24T08:00:00-06:00',
  /**
   * La convocatoria CERRÓ. Ya no hay ni un botón que lleve aquí —«ya ese botón
   * muere», 26/08— y por eso no se borra el dato: el PDF sigue circulando en
   * redes y en buscadores, y el día que haya que volver a enlazarlo está.
   */
  convocatoriaPDF:
    'https://www.festivaldearteconceptual.com/_files/ugd/985416_d240424c19c14ea4ad0fbeeff5a22e4a.pdf',
  /**
   * Donaciones. Vacío mientras no exista la cuenta: **todo lo que pinta un
   * botón de donar cuelga de que `paypal` tenga algo**, así que hoy no se
   * dibuja nada. Pegar aquí el enlace enciende de una vez el cierre de la
   * portada, la columna «Participa» del pie y el remate de /registro.
   *
   * `nota` es la línea que va debajo del botón —a qué se destina el dinero—.
   * Vacía a propósito: eso lo escriben ellos, no yo. Sin ella el botón sale
   * solo, que es como está ahora.
   */
  donaciones: {
    paypal: '',
    nota: '',
  },
  creditoFooter:
    '© 2026 Creado por Festival De Arte Conceptual La Cuarta Silla',
};

/** La portada no gasta pestaña: se va por el logo, que es donde todo el mundo
 *  la busca. Sigue entera en el pie. */
export const inicio = { label: 'Inicio', href: '/' };

/** El registro tiene nombre propio porque lo pintan tres sitios: su pestaña de
 *  la barra, la columna «Participa» del pie y el remate de `/programa`.
 *
 *  Ojo con lo que promete: aquí uno se registra **por actividad**, no al
 *  festival entero — cada `ActividadGantt` trae su propio `registro` y la ficha
 *  de la rejilla abre ese formulario. Esta página es la puerta general. */
export const registroEventos = {
  label: 'Registro a eventos',
  href: '/registro',
};

/** Las pestañas de la barra. El bloque rojo del final no sale de aquí: es la
 *  acción destacada y la pinta `Nav.astro` aparte.
 *
 *  Cuatro y la destacada, cada una contestando algo distinto: cuándo, dónde,
 *  qué hubo, cómo entro, quién. Artistas y archivo son pestañas y no secciones
 *  de la portada: cada uno tiene su página. */
export const nav = [
  { label: 'Programa', href: '/programa' },
  { label: 'Sedes', href: '/sedes' },
  { label: 'Archivo', href: '/archivo' },
  registroEventos,
];

/** La acción destacada de la barra: el bloque rojo del extremo derecho.
 *  Era la convocatoria, y cerrada ésa pasó un rato por el registro. Ahora es
 *  artistas, que es lo que hay que enseñar. */
export const accionPrincipal = { label: 'Artistas', href: '/artistas' };

/** Manifiesto — home. Texto íntegro del original. */
export const manifiesto = {
  titulo: '¿Qué entendemos por arte conceptual?',
  parrafos: [
    'Entendemos el arte conceptual como una práctica crítica en la que las ideas, las preguntas y las tensiones que una obra provoca tienen mayor relevancia que su apariencia material. Se trata de generar pensamiento, abrir diálogos y cuestionar las estructuras culturales, políticas y sociales que organizan nuestra realidad.',
    'Partimos de la tradición del conceptualismo latinoamericano, que transformó el arte conceptual en una herramienta de intervención social. Desde esta perspectiva, la obra deja de ser un fin en sí mismo para convertirse en un medio de reflexión, resistencia y construcción de nuevas formas de imaginar el mundo.',
    'Por ello, en este festival nos preguntamos qué pone en discusión la obra, qué relaciones activa y qué posibilidades de transformación abre.',
  ],
  cierre:
    'El arte conceptual propone preguntas capaces de alterar nuestra manera de mirar y habitar la realidad.',
};

/** Los horarios existen en el original pero sin contenido asignado todavía. */
const horarios = [
  '8:00',
  '9:00',
  '9:15',
  '10:15',
  '11:00',
  '11:30',
  '12:15',
  '14:00',
  '14:15',
  '15:00',
  '15:45',
  '16:15',
];

export type Slot = { hora: string; actividad: string };
export type Dia = { dia: string; fecha: string; slots: Slot[] };

const dia = (nombre: string, fecha: string): Dia => ({
  dia: nombre,
  fecha,
  slots: horarios.map((hora) => ({ hora, actividad: '' })),
});

export const programa = {
  titulo: 'Programa',
  estado: '(Próximamente)',
  // "Domingo, 24" es un typo del sitio original; corregido a 27 para que la
  // fecha coincida con el rango anunciado del festival.
  dias: [
    dia('Jueves', '24 de septiembre'),
    dia('Viernes', '25 de septiembre'),
    dia('Sábado', '26 de septiembre'),
    dia('Domingo', '27 de septiembre'),
  ],
};

export const registro = {
  titulo: 'Registro a eventos',
  estado: 'Próximamente',
  nota: 'La fecha y la hora se muestran como A determinar',
  ciudad: 'Guadalajara',
  acciones: { leerMas: 'Leer más', registro: 'Registro' },
};

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

/** A dónde lleva «Ubicación»: al pin exacto si lo tenemos, y si no a la
 *  búsqueda por dirección. Nunca se inventa un pin que no nos dieron. */
export const enlaceMapa = (sede: Sede) =>
  sede.mapa ??
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    sede.direccion,
  )}`;

export const sedes = {
  titulo: 'Sedes',
  acciones: {
    conoce: 'Conoce más',
    ubicacion: 'Ubicación',
    verMapa: 'Ver en el mapa',
    sinMapa: 'Elegí una sede para verla en el mapa',
    // Rótulos del plano de la portada.
    todas: 'Todas',
    acercar: 'Acercar',
    alejar: 'Alejar',
    credito: 'Cartografía © OpenStreetMap',
  },
  // El orden es el de la lista que nos pasaron, no alfabético.
  lista: [
    {
      nombre: 'Cuerpos Parlante',
      direccion: 'C. Cruz Verde 93, Zona Centro, 44200 Guadalajara, Jal.',
      coord: [20.678024, -103.357493],
    },
    {
      nombre: 'Foro AM',
      direccion: 'C. Pedro Loza 344, Zona Centro, 44200 Guadalajara, Jal.',
      coord: [20.681676, -103.348404],
    },
    {
      nombre: 'Temporal',
      // La dirección anterior repetía la de Salón Liminal; ésta es la buena.
      direccion: 'C. Donato Guerra 25, Zona Centro, 44100 Guadalajara, Jal.',
      coord: [20.675938, -103.350449],
      instagram: 'https://www.instagram.com/temporal___________/',
      mapa: 'https://maps.app.goo.gl/Fsu7vg12MzBCtbxD8',
    },
    {
      nombre: 'Estudio Arrechiga',
      direccion:
        'Camarena 118, Col Americana, Americana, 44160 Guadalajara, Jal.',
      coord: [20.674647, -103.35767],
      instagram: 'https://www.instagram.com/estudioarechiga/',
      mapa: 'https://maps.app.goo.gl/C1F4Us1jy6buYTJJA',
    },
    {
      nombre: 'Casa Dos Guayabos',
      direccion: 'C. San Felipe 731, Zona Centro, 44200 Guadalajara, Jal.',
      coord: [20.679379, -103.354601],
    },
    {
      /**
       * El andador es el tramo peatonal de Escorza que corre al este de la
       * Rectoría General de la UdeG, de Morelos a López Cotilla: el que el
       * ayuntamiento decretó Constancio Hernández Alvirde en 2015 y el que la
       * gente renombró Andador Palestina Libre. Va primero el nombre que se
       * usa y entre paréntesis el del papel, que es el orden en que sirven:
       * uno es para llegar andando y el otro para escribirlo en un sobre.
       *
       * La coordenada es el punto medio de ese tramo en OpenStreetMap
       * (`highway=pedestrian`, «Calle Escorza» + «Andador Escorza»), a media
       * cuadra de la Rectoría (20.67523, -103.35900) y del MUSA.
       */
      nombre: 'No Museo',
      direccion:
        'Andador Palestina Libre (Constancio Hernández Alvirde), Col. Americana, 44160 Guadalajara, Jal.',
      coord: [20.6741, -103.35857],
    },
    {
      nombre: 'Taller Industria Gráfica',
      direccion:
        'C. San Felipe 827, Capilla de Jesús, 44160 Guadalajara, Jal.',
      coord: [20.67934, -103.356823],
    },
    {
      nombre: 'Casa Feria',
      direccion: 'C. Pedro Loza 359, Zona Centro, 44100 Guadalajara, Jal.',
      coord: [20.681953, -103.348427],
    },
    {
      nombre: 'Ala Rota',
      direccion: 'Juan Manuel 823, Zona Centro, 44200 Guadalajara, Jal.',
      coord: [20.678578, -103.354777],
      instagram: 'https://www.instagram.com/alarota.cultura/',
      mapa: 'https://maps.app.goo.gl/hB6KDRMnp6TxrJBD7',
    },
    {
      nombre: 'Staditche',
      direccion:
        'C. Manuel López Cotilla 858, Col Americana, Americana, 44160 Guadalajara, Jal.',
      coord: [20.674168, -103.357894],
      instagram: 'https://www.instagram.com/staditche/',
      mapa: 'https://maps.app.goo.gl/436QGVLkPj3ZSueU6',
    },
    {
      nombre: 'Estallido Art Project',
      direccion: 'Calle, Av. Alcalde 159, Zona Centro, 44100 Guadalajara, Jal.',
      coord: [20.678963, -103.347828],
      instagram: 'https://www.instagram.com/estallidoartproject/',
      mapa: 'https://maps.app.goo.gl/SuKhGPMVaB7ZeRve9',
    },
    {
      nombre: 'Salón Liminal',
      direccion: 'C. Independencia 795, Zona Centro, 44100 Guadalajara, Jal.',
      coord: [20.678033, -103.354007],
      instagram: 'https://www.instagram.com/salonliminal/',
      mapa: 'https://maps.app.goo.gl/17i56g378cvg5t7j9',
    },
    {
      nombre: 'Ánima Galería',
      direccion:
        'C. Miguel Blanco 1405, Col Americana, Americana, 44160 Guadalajara, Jal.',
      coord: [20.672186, -103.357879],
      instagram: 'https://www.instagram.com/animagaleria/',
      mapa: 'https://maps.app.goo.gl/D2y3qeR19Qc2G2ND8',
    },
    {
      nombre: 'Palma Galería',
      direccion:
        'C. Manuel López Cotilla 1360, Col Americana, Americana, 44160 Guadalajara, Jal.',
      coord: [20.673916, -103.366453],
      instagram: 'https://www.instagram.com/palmagaleria/',
      mapa: 'https://maps.app.goo.gl/9LFY63xj1kpyzuncA',
    },
  ] satisfies Sede[],
};

export type Marca = { nombre: string; logo?: string; url?: string };

/** Los logos salen del sitio viejo (Wix), reescalados a 600 px de lado.
 *  Las marcas sin logo se pintan con el nombre en display: prefiero un hueco
 *  honesto a inventar un archivo que no nos dieron. */
export const patrocinadores = {
  titulo: 'Patrocinadores',
  lista: [
    { nombre: 'Minerva', logo: '/patrocinadores/minerva.png' },
    { nombre: 'Cielito Lindo', logo: '/patrocinadores/cielito-lindo.jpg' },
    { nombre: 'Clase 33', logo: '/patrocinadores/clase-33.jpg' },
    { nombre: 'Mezcania' },
    { nombre: 'RE.CREA.LAB', logo: '/patrocinadores/recrealab.png' },
    { nombre: 'MESH' },
    { nombre: '1800', logo: '/patrocinadores/1800.png' },
    { nombre: 'Capicua' },
    // Nos pidieron confirmar cómo se escribe.
    { nombre: 'Suero' },
    { nombre: 'DC Producciones' },
    // Apoyos institucionales: estaban en el sitio viejo y no en la lista que
    // nos pasaron, pero son de los que no se dejan fuera.
    {
      nombre: 'Universidad de Guadalajara',
      logo: '/patrocinadores/universidad-de-guadalajara.png',
    },
    { nombre: 'ITESO', logo: '/patrocinadores/iteso.jpg' },
    {
      nombre: 'Tecnológico de Monterrey',
      logo: '/patrocinadores/tec-de-monterrey.png',
    },
  ] satisfies Marca[],
};

export const colaboradores = {
  titulo: 'Colaboradores',
  lista: [
    { nombre: 'Ferazzz', logo: '/patrocinadores/ferazzz.png' },
    { nombre: 'Brumma', logo: '/patrocinadores/brumma.png' },
    { nombre: 'GDL de Noche', logo: '/patrocinadores/gdl-de-noche.png' },
    {
      nombre: 'Visual Negativo',
      logo: '/patrocinadores/visual-negativo.jpg',
    },
    { nombre: 'DC Producciones' },
  ] satisfies Marca[],
};

export const privacidad = {
  titulo: 'Política de Privacidad',
  subtitulo: 'Aviso legal',
  cuerpo:
    'Todo lo antes expuesto en esta pagina es responsabilidad del Festival de Arte Conceptual La Cuarta Silla',
};

/** ── Rejilla del programa (Gantt) ─────────────────────────────────────────
 *
 * ⚠️  ESTOS EVENTOS SON DE EJEMPLO Y HAY QUE REEMPLAZARLOS ENTEROS. ⚠️
 *
 * Están sólo para poder ver y probar la vista de barras antes de tener el
 * programa real. La regla de arriba —no inventar copy— sigue en pie: esto es
 * un andamio, no contenido, y la página lo anuncia como tal a la vista.
 *
 * Va aparte de `programa` y no dentro: `programa.dias` son los cuatro días
 * con sus horarios tal y como vinieron de Wix, y de ahí cuelgan la tabla de
 * la portada y la lista del móvil. Esto no los toca.
 */
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
};

/** La sede completa de una actividad: nombre, dirección y enlace al mapa
 *  salen de `sedes.lista`, que ya los tiene. No se repiten aquí. */
export const sedeDe = (nombre: string) =>
  sedes.lista.find((s) => s.nombre === nombre);

/** Los cuatro tipos, cada uno con su tinta. El color no pinta la barra entera
 *  —eso era un carnaval—: es el filete de 5 px del canto izquierdo y el
 *  cuadradito de la leyenda.
 *
 *  «Muestra» va en papel y no en una quinta tinta: sobre la barra negra un
 *  filete blanco se distingue del rojo, del amarillo y del ladrillo tan bien
 *  como cualquier color, y en la leyenda queda un cuadrado en hueco dentro de
 *  su canto de 2 px. Tres tintas y el papel, que es como se imprime un cartel. */
export const coloresGantt = {
  taller: { fondo: 'var(--color-rojo)', texto: 'var(--color-amarillo)' },
  charla: { fondo: 'var(--color-amarillo)', texto: 'var(--color-tinta)' },
  muestra: { fondo: 'var(--color-papel)', texto: 'var(--color-tinta)' },
  escena: { fondo: 'var(--color-ladrillo)', texto: 'var(--color-amarillo)' },
} as const;

export const ganttEsEjemplo = true;
/** Versión de un renglón, que es la que va al pie de la rejilla. La larga
 *  ocupaba una banda entera arriba de todo, antes de que se viera nada. */
export const ganttAviso = 'Rejilla de ejemplo — todavía no es la programación';

export const actividades: ActividadGantt[] = [
  // Jueves
  { titulo: 'Montaje y acreditaciones', dia: 0, inicio: '10:00', fin: '13:00', sede: 'Foro AM', tipo: 'muestra', artista: 'Equipo del festival' },
  { titulo: 'Inauguración', dia: 0, inicio: '18:00', fin: '20:00', sede: 'Foro AM', tipo: 'escena', artista: 'Comité organizador', registro: 'https://tally.so/r/ejemplo1' },
  { titulo: 'Muestra: archivo abierto', dia: 0, inicio: '12:00', fin: '20:00', sede: 'No Museo', tipo: 'muestra', artista: 'Colectivo Archivo Vivo' },
  { titulo: 'Cuerpo y espacio', dia: 0, inicio: '19:00', fin: '21:00', sede: 'Cuerpos Parlante', tipo: 'escena', artista: 'Mariana Ruvalcaba', registro: 'https://tally.so/r/ejemplo2' },

  // Viernes
  { titulo: 'Taller de risografía', dia: 1, inicio: '10:00', fin: '13:00', sede: 'Taller Industria Gráfica', tipo: 'taller', artista: 'Taller Industria Gráfica', registro: 'https://tally.so/r/ejemplo3' },
  { titulo: 'Conceptualismo hoy', dia: 1, inicio: '12:00', fin: '13:30', sede: 'Temporal', tipo: 'charla', artista: 'Panel invitado', registro: 'https://tally.so/r/ejemplo4' },
  { titulo: 'Muestra: archivo abierto', dia: 1, inicio: '11:00', fin: '20:00', sede: 'No Museo', tipo: 'muestra', artista: 'Colectivo Archivo Vivo' },
  { titulo: 'Lectura de portafolios', dia: 1, inicio: '15:00', fin: '18:00', sede: 'Estudio Arrechiga', tipo: 'taller', artista: 'Andrea Sandoval', registro: 'https://tally.so/r/ejemplo5' },
  { titulo: 'Mesa: arte y ciudad', dia: 1, inicio: '17:00', fin: '18:30', sede: 'Foro AM', tipo: 'charla', artista: 'Panel invitado', registro: 'https://tally.so/r/ejemplo6' },
  { titulo: 'Performance nocturno', dia: 1, inicio: '20:30', fin: '22:00', sede: 'Cuerpos Parlante', tipo: 'escena', artista: 'Kali Zurita' },

  // Sábado
  { titulo: 'Recorrido por el centro', dia: 2, inicio: '11:00', fin: '14:00', sede: 'No Museo', tipo: 'muestra', artista: 'Guía del festival', registro: 'https://tally.so/r/ejemplo7' },
  { titulo: 'Escritura sobre obra', dia: 2, inicio: '10:30', fin: '12:30', sede: 'Estudio Arrechiga', tipo: 'taller', artista: 'Ximena Prado', registro: 'https://tally.so/r/ejemplo8' },
  { titulo: 'Grabado expandido', dia: 2, inicio: '13:00', fin: '16:00', sede: 'Taller Industria Gráfica', tipo: 'taller', artista: 'Rubén Ortega', registro: 'https://tally.so/r/ejemplo9' },
  { titulo: 'Charla: qué pone en discusión', dia: 2, inicio: '16:30', fin: '18:00', sede: 'Temporal', tipo: 'charla', artista: 'Panel invitado', registro: 'https://tally.so/r/ejemplo10' },
  { titulo: 'Proyección al aire libre', dia: 2, inicio: '20:30', fin: '22:30', sede: 'Casa Dos Guayabos', tipo: 'escena', artista: 'Cine Errante' },

  // Domingo
  { titulo: 'Muestra: archivo abierto', dia: 3, inicio: '11:00', fin: '17:00', sede: 'No Museo', tipo: 'muestra', artista: 'Colectivo Archivo Vivo' },
  { titulo: 'Taller para público infantil', dia: 3, inicio: '11:30', fin: '13:00', sede: 'Casa Feria', tipo: 'taller', artista: 'Casa Feria', registro: 'https://tally.so/r/ejemplo11' },
  { titulo: 'Conversatorio de cierre', dia: 3, inicio: '16:00', fin: '17:30', sede: 'Foro AM', tipo: 'charla', artista: 'Comité organizador', registro: 'https://tally.so/r/ejemplo12' },
  { titulo: 'Clausura', dia: 3, inicio: '19:00', fin: '22:00', sede: 'Casa Feria', tipo: 'escena', artista: 'Todas las sedes' },
];

/** ── Red de seguridad ─────────────────────────────────────────────────────
 *
 * `sedeDe()` empareja por nombre EXACTO, así que una tilde de más o de menos en
 * el campo `sede` de una actividad no rompe nada a la vista: simplemente la
 * ficha de esa actividad sale sin dirección y sin enlace al mapa, y nadie se
 * entera hasta que un visitante la abre. Ya pasó una vez, con «Taller Industria
 * Grafica» contra «Taller Industria Gráfica».
 *
 * Astro evalúa este módulo al construir, así que esto revienta el build en vez
 * de dejar pasar el fallo. Importa sobre todo de aquí en adelante: cuando
 * llegue la programación de verdad van a ser decenas de renglones escritos a
 * mano contra catorce nombres con tildes, acentos y mayúsculas.
 *
 * Se lista todo lo que no empareja de una vez —no sólo lo primero— y se sugiere
 * el nombre bueno cuando se parece, que es lo que ahorra el viaje de ida y
 * vuelta al arreglarlo.
 */
{
  const nombres = sedes.lista.map((s) => s.nombre);
  /** Sin tildes, sin mayúsculas y sin dobles espacios: así se detecta el
   *  «quisiste decir…» sin depender de cómo se tecleó. */
  const pelar = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  const sueltas = actividades
    .filter((a) => !nombres.includes(a.sede))
    .map((a) => {
      const parecida = nombres.find((n) => pelar(n) === pelar(a.sede));
      return `  · «${a.sede}» (en «${a.titulo}»)${
        parecida ? ` — ¿querías decir «${parecida}»?` : ''
      }`;
    });

  if (sueltas.length) {
    throw new Error(
      `site.ts: hay ${sueltas.length} actividad(es) que nombran una sede que no está en ` +
        `sedes.lista. La ficha de la rejilla se queda sin dirección ni mapa.\n` +
        sueltas.join('\n') +
        `\n\nSedes válidas:\n${nombres.map((n) => `  · ${n}`).join('\n')}`,
    );
  }
}
