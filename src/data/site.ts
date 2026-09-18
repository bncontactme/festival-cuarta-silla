/**
 * Todo el texto del sitio, en un solo lugar.
 * Migrado literalmente desde el sitio Wix original (festivaldearteconceptual.com).
 * No inventar copy aquí: si algo falta, es porque el original lo tiene vacío.
 *
 * Lo que SÍ sale de aquí son las listas que carga el festival desde `/admin`:
 * sedes, programa y marcas llegan de `contenido.ts`. El texto se queda; el
 * contenido se va. Ver PANEL.md para por qué se parte justo por ahí.
 */

import { contenido, delPanel } from './contenido';
import { aplanar } from '../lib/texto';
import type { Sede, Marca, ActividadGantt, TextoDeSala } from './tipos';
import { SEDE_TODAS, SALA_FESTIVAL } from './tipos';

export type { Sede, Marca, ActividadGantt, TextoDeSala };
export { SEDE_TODAS, SALA_FESTIVAL };

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

/** Convocatoria externa para sumarse al festival como voluntarix.
 *
 *  **Cerrada: hoy no la pinta nadie.** Estaba en el CTA de la portada de
 *  escritorio y en los accesos secundarios del teléfono, y se quitó de los dos.
 *  El enlace se queda aquí y no en el historial de git porque el formulario es
 *  el mismo cada año: volver a abrirla es devolver el botón, no ir a buscar la
 *  URL. */
export const convocatoriaVoluntarixs = {
  label: 'Convocatoria voluntarixs',
  href: 'https://docs.google.com/forms/d/e/1FAIpQLSc1mk-gt7o50qyvpBsFJqBphMQeWPKlJj9Ok7HYvex9FAn9dQ/viewform',
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
  { label: 'Galería', href: '/galeria' },
  registroEventos,
];

/** La acción destacada de la barra: el bloque rojo del extremo derecho.
 *  Era la convocatoria, y cerrada ésa pasó un rato por el registro. Ahora es
 *  artistas, que es lo que hay que enseñar. */
export const accionPrincipal = { label: 'Artistas', href: '/artistas' };

/**
 * Manifiesto — el texto íntegro del original.
 *
 * **Hay dos, y el día que no haga falta habrá uno.** Éste es el que está
 * escrito aquí, migrado literal del Wix, y es el que pinta la portada: la banda
 * roja, su modal y la pantalla del móvil. Abajo, `manifiestoDeSala` es el mismo
 * texto pero pudiendo venir del panel, y es el que se lee en la página que abre
 * el QR del festival.
 *
 * Que la portada NO lea el del panel es una decisión, no un olvido: ahí el
 * título va a `9vw` de Anton sobre una estrella y el cierre hace de subtítulo:
 * un texto tres veces más largo escrito desde el teléfono, una noche, no
 * rompería el sitio pero sí esa banda. Cuando se quiera, es una línea — abajo
 * está dicho dónde.
 */
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

/**
 * El manifiesto que se lee en `/sala/festival`: el del panel si lo han escrito,
 * y si no, el de aquí arriba.
 *
 * `parrafos` sale de partir el cuerpo por las líneas en blanco, que es como se
 * escribe y como se guarda — la misma `parrafosDe()` que usan las descripciones.
 *
 * **Para que la portada lea también el del panel** basta con que `manifiesto`
 * sea esto en vez del literal. Una línea, y `index.astro` y `movil/Portada`
 * no se enteran: la forma es la misma, `{ titulo, parrafos, cierre }`.
 */
export const manifiestoDeSala: { titulo: string; parrafos: string[]; cierre?: string } =
  (() => {
    const m = contenido.festival?.manifiesto;
    if (!m?.cuerpo) return manifiesto;
    return {
      titulo: m.titulo || manifiesto.titulo,
      parrafos: m.cuerpo.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
      cierre: m.cierre,
    };
  })();

/**
 * El texto de sala del festival: el que iría en la pared de la entrada.
 *
 * `undefined` hasta que esté **publicado y con texto**, igual que las
 * descripciones de las actividades. La diferencia es qué pasa mientras tanto:
 * una actividad sin texto publicado no tiene página, y ésta sí —`/sala/festival`
 * se construye siempre, porque también es la casa del manifiesto—. Así que sin
 * publicar no hay un 404, hay una página que enseña el manifiesto y ya.
 *
 * Eso es lo que hace que el QR de la puerta no pueda llevar nunca a una página
 * muerta, ni siquiera el día que alguien lo pase a borrador con el papel ya
 * colgado. Lo que se pierde es el texto de sala, no la página.
 */
export const salaFestival = (() => {
  const s = contenido.festival?.sala;
  if (!s?.publicado || !s.cuerpo) return undefined;
  return {
    titulo: s.titulo,
    parrafos: s.cuerpo.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
    firma: s.firma,
  };
})();

/** La dirección de esa página. Fija y acuñada una sola vez: va dentro de un QR
 *  que se cuelga en la puerta. Ver `SALA_FESTIVAL` en `tipos.ts`. */
export const rutaSalaFestival = `/sala/${SALA_FESTIVAL}`;

export type Dia = { dia: string; fecha: string };

/**
 * Los cuatro días.
 *
 * Aquí ya no hay horarios. Los había —doce, de las 8:00 a las 16:15, con la
 * actividad vacía— y venían tal cual del Wix, donde tampoco tenían nada dentro.
 * La vista «Por días» de `/programa` los pintaba: cuarenta y ocho renglones que
 * decían «Por anunciar», los mismos cuatro días seguidos, con catorce
 * actividades de verdad cargadas en el panel y ninguna de ellas a la vista.
 *
 * La lista de horas de un día es el día, y el día lo dicen las actividades: sale
 * de `agendaPorDia`, más abajo, cuando `actividades` ya existe.
 */
export const programa = {
  titulo: 'Programa',
  estado: '(Próximamente)',
  // "Domingo, 24" es un typo del sitio original; corregido a 27 para que la
  // fecha coincida con el rango anunciado del festival.
  dias: [
    { dia: 'Jueves', fecha: '24 de septiembre' },
    { dia: 'Viernes', fecha: '25 de septiembre' },
    { dia: 'Sábado', fecha: '26 de septiembre' },
    { dia: 'Domingo', fecha: '27 de septiembre' },
  ] as Dia[],
};

/**
 * El texto de `/registro`.
 *
 * La `nota` de antes decía «La fecha y la hora se muestran como A determinar»:
 * no era contenido, era la descripción del hueco, arrastrada del Wix con el
 * resto. La página que la enseñaba tampoco lo era — una tarjeta con «Fecha: a
 * determinar», «Hora: a determinar» y un botón apagado—, y desde el día que hay
 * panel eso ya no hace falta: aquí se apunta uno **por actividad**, y las
 * actividades están en el programa. Lo que se enseña ahora es la lista de
 * verdad, y este objeto se queda sólo con el texto que la envuelve.
 */
export const registro = {
  titulo: 'Registro a eventos',
  estado: 'Próximamente',
  ciudad: 'Guadalajara',
  /**
   * El renglón que acompaña al cartel de espera.
   *
   * Uno solo desde que se fue el interruptor: ya no hay dos situaciones que
   * distinguir —«falta el programa» y «falta abrir»—, porque abrir dejó de ser
   * un acto aparte. Falta lo mismo en los dos casos: que las actividades traigan
   * su formulario.
   *
   * Corto a propósito. Va debajo de un PRÓXIMAMENTE de sesenta píxeles, y un
   * párrafo explicando lo mismo por segunda vez no es información, es relleno.
   */
  espera: 'Cada actividad tiene su formulario. En cuanto los tengamos, salen aquí.',
  /* Aquí vivían «Entrada libre» y su coletilla, que se pintaban en el sitio del
     botón de las actividades sin formulario. Se van con ellas: esta página es
     la de apuntarse, y una actividad a la que se entra sin apuntarse no tiene
     nada que hacer en una lista de puertas. Que sea libre se dice en su ficha
     de la rejilla, que es donde alguien pregunta «¿y a ésta cómo entro?». */
  acciones: {
    registro: 'Registrarme',
    programa: 'Ver el programa',
    mapa: 'Ubicación',
  },
};

/* `Sede` vive ahora en `tipos.ts` y se re-exporta arriba. */

/** A dónde lleva «Ubicación»: al pin exacto si lo tenemos, y si no a la
 *  búsqueda por dirección. Nunca se inventa un pin que no nos dieron. */
export const enlaceMapa = (sede: Sede) =>
  sede.mapa ??
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    sede.direccion,
  )}`;

/** Sin tildes, sin mayúsculas y sin dobles espacios: así se comparan nombres
 *  de sede que alguien teclea en el panel, donde «Todas Las Sedes» y «todas
 *  las sedes» son la misma cosa escrita dos veces. */
const pelar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Si una actividad es de las que pasan por todas — un recorrido guiado. No
 *  tiene dirección ni mapa a los que llevar, y eso no es un hueco: es lo que
 *  es.
 *
 *  Compara pelado y no con `===` porque esto se escribe a mano en el panel:
 *  el nombre reservado es «Todas las sedes» y en el contenido apareció como
 *  «Todas Las Sedes», que con una comparación exacta son dos cosas distintas
 *  —y una de ellas, un recorrido sin carril—. */
export const enTodasLasSedes = (nombre: string) =>
  pelar(nombre) === pelar(SEDE_TODAS);

export const sedes = {
  titulo: 'Sedes',
  acciones: {
    conoce: 'Conoce más',
    ubicacion: 'Ubicación',
    /** El de la ficha del plano de la portada. Ahí se llama por su nombre y no
     *  «Conoce más» como en `/sedes`: en la ficha del plano hay dos botones
     *  juntos y uno de ellos ya dice a dónde va —Ubicación—, así que el otro
     *  tiene que decirlo también o se convierte en una lotería. */
    instagram: 'Instagram',
    verMapa: 'Ver en el mapa',
    sinMapa: 'Elegí una sede para verla en el mapa',
    // Rótulos del plano de la portada.
    todas: 'Todas',
    acercar: 'Acercar',
    alejar: 'Alejar',
    credito: 'Cartografía © OpenStreetMap',
  },
  /**
   * Las sedes de verdad. **Se editan en `/admin`**, no aquí.
   *
   * El orden es el que se pinta y no es alfabético: es el de la lista que nos
   * pasaron, y el panel deja arrastrar para cambiarlo.
   *
   * El filtro saca «Todas las sedes» de la lista. Es un nombre reservado para
   * los recorridos que pasan por varias —lo dice `SEDE_TODAS` en `tipos.ts`—,
   * pero en el panel alguien lo dio de alta como sede, con «Todas» de
   * dirección. Como fila de `sedes` ponía una tarjeta con dirección en
   * `/sedes`, una estrella en el plano y un lugar de más en todas las cuentas
   * del sitio: quince donde hay catorce. Sirve para decir dónde pasa un
   * evento, no es un sitio al que se pueda ir.
   *
   * Se filtra aquí y no borrando la fila en `contenido.json` porque ese
   * archivo lo regenera `scripts/instantanea.mjs` en cada build: la fila
   * volvería en la siguiente instantánea del panel.
   */
  lista: contenido.sedes.filter((s) => !enTodasLasSedes(s.nombre)),
};

/* `Marca` vive ahora en `tipos.ts` y se re-exporta arriba. */

/** Quién pone. **Se edita en `/admin`.**
 *
 *  Una sola lista. Hubo un segundo grupo —Colaboradores— que se turnaba la
 *  cinta de la portada con éste, pero el festival metía todo aquí y la
 *  distinción no la usaba nadie.
 *
 *  Los logos que ya estaban salen del sitio viejo (Wix), reescalados a 600 px
 *  de lado y servidos desde `public/`; los que suba el festival van a
 *  Cloudinary. `imagen()` trata igual a los dos.
 *
 *  Las marcas sin logo se pintan con el nombre en display: prefiero un hueco
 *  honesto a inventar un archivo que no nos dieron. */
export const patrocinadores = {
  titulo: 'Patrocinadores',
  lista: contenido.marcas.patrocinadores,
};

export const privacidad = {
  titulo: 'Política de Privacidad',
  subtitulo: 'Aviso legal',
  cuerpo:
    'Todo lo antes expuesto en esta pagina es responsabilidad del Festival de Arte Conceptual La Cuarta Silla',
  /**
   * Lo que hace el sitio con los datos de quien lo visita, que es casi nada.
   *
   * **Se pinta sólo cuando el faro está encendido** (ver `src/lib/analitica.ts`
   * y `privacidad.astro`): sin token no se mide nada, y entonces este párrafo
   * sería un aviso de algo que no pasa. Una política que promete de más se
   * parece mucho a una que promete de menos — las dos mienten.
   *
   * Y dice exactamente lo que hace el faro de Cloudflare, ni más ni menos: no
   * hay cookie, no hay identificador, no se sigue a nadie de una página a otra.
   * Por eso este sitio no tiene banner de consentimiento, y no por olvido.
   */
  datos: {
    titulo: 'Sobre las visitas',
    cuerpo:
      'Contamos cuántas personas entran a cada página con Cloudflare Web Analytics. No usamos cookies, ' +
      'no guardamos tu dirección IP y no hay ningún identificador que te siga de una página a otra ni ' +
      'de un día para otro: cada visita se cuenta y se olvida. Lo que vemos es un número por página, ' +
      'el país y el tipo de aparato, y nos sirve para saber si los códigos QR de las sedes se usan.',
  },
};

/** ── Rejilla del programa (Gantt) ─────────────────────────────────────────
 *
 * Las barras del programa. **Se editan en `/admin`** y llegan de
 * `contenido.ts`; el tipo vive en `tipos.ts`.
 *
 * Mientras el festival no dé el programa por bueno (`ganttEsEjemplo`), esta
 * rejilla no sale a la calle: `/programa` y la portada enseñan el cartel de
 * «Próximamente» en su lugar. La de ejemplo que sembró el repo sigue aquí para
 * ver y probar la vista de barras, pero se queda de puertas adentro.
 *
 * Va aparte de `programa` y no dentro: `programa.dias` son los cuatro días
 * con sus horarios tal y como vinieron de Wix, y de ahí cuelgan la tabla de
 * la portada y la lista del móvil. Esto no los toca.
 */

/** La sede completa de una actividad: nombre, dirección y enlace al mapa
 *  salen de `sedes.lista`, que ya los tiene. No se repiten aquí. */
export const sedeDe = (nombre: string) =>
  sedes.lista.find((s) => s.nombre === nombre);

/* `enTodasLasSedes` se define arriba, junto a `sedes`: la lista lo necesita
   para filtrarse a sí misma. */

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


/** Si lo de abajo todavía es el andamio o ya es la programación.
 *
 *  Lo decide el festival con un interruptor en `/admin`, no se deduce de nada:
 *  sembrar el panel con los eventos de ejemplo también es «usar el panel», así
 *  que atarlo a eso lo habría apagado el primer día, con la rejilla de mentira
 *  todavía puesta. Sin la clave se asume que sí es ejemplo: decir de más que
 *  esto no es el programa es barato, pasar por bueno lo que no lo es no. */
export const ganttEsEjemplo = contenido.programa.esEjemplo !== false;

/** La misma decisión, dicha por su nombre: si el programa ya se enseña o si
 *  todavía sale el cartel de «Próximamente».
 *
 *  Es una sola llave y a propósito. Antes hubo dos ideas: enseñar la rejilla
 *  de ejemplo con un aviso al pie, o esconderla entera hasta el anuncio. Se
 *  eligió esconderla —un andamio publicado se lee como programa por mucho que
 *  lo desmienta la letra chica— y quedó una única señal, la del panel, para
 *  que quien publique sea el festival y no un commit. */
export const programaPublicado = !ganttEsEjemplo;

export const actividades: ActividadGantt[] = contenido.programa.actividades;

/**
 * Los cuatro días con lo que pasa en cada uno, en orden de reloj.
 *
 * Es la otra lectura de la misma lista: la rejilla contesta «qué se pisa con
 * qué» y esto contesta «qué hay a tal hora», que es la pregunta que se hace uno
 * ya estando en la calle. Las dos salen de `actividades` — antes esta segunda
 * salía de doce horas escritas a mano que no tenían nada dentro y nunca iban a
 * tenerlo, así que la vista «Por días» decía «Por anunciar» cuarenta y ocho
 * veces con el programa ya cargado.
 */
export const agendaPorDia = programa.dias.map((d, i) => ({
  ...d,
  indice: i,
  actividades: actividades
    .filter((a) => a.dia === i)
    .sort((a, b) => a.inicio.localeCompare(b.inicio)),
}));

/** ── Lo que pasa en cada sede ─────────────────────────────────────────────
 *
 * La tercera lectura de la misma lista. La rejilla contesta «qué se pisa con
 * qué», `agendaPorDia` contesta «qué hay el sábado», y esto contesta «qué pasa
 * en este local» — la pregunta de quien ya eligió a dónde ir, o la de quien
 * está parado en la puerta con el teléfono en la mano.
 *
 * Sale de `actividades` como las otras dos, y no de una lista de «eventos por
 * sede» guardada aparte. No puede haberla, por lo de siempre: dos listas de lo
 * mismo se separan el primer día que alguien cambia una hora en una sola.
 */

/** «Vie 25 sep». El día entero no cabe en la columna de un tablero. */
const diaCorto = (i: number) =>
  `${programa.dias[i].dia.slice(0, 3)} ${programa.dias[i].fecha.replace(' de septiembre', ' sep')}`;

/**
 * Los recorridos: las actividades que no son de ninguna sede porque pasan por
 * todas.
 *
 * Se pintan DENTRO del programa de cada sede, marcados, y no se suman a su
 * cuenta. Las dos mitades de esa regla hacen falta: sin la marca, un recorrido
 * de ocho horas se lee como una obra de esa sede; sumado a la cuenta, una sola
 * Marcha del Arte inventa dieciséis actividades que no existen.
 */
export const recorridos = actividades
  .filter((a) => enTodasLasSedes(a.sede))
  .sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio));

/** Un día de una sede. Sólo existe si tiene algo: un día vacío con su titular
 *  y nada debajo se lee como un error del sitio. */
export type DiaDeSede = {
  dia: string;
  fecha: string;
  indice: number;
  corto: string;
  actividades: ActividadGantt[];
};

export type AgendaDeSede = {
  sede: Sede;
  /** Su número en la lista: el 01…16 que se pinta, no un id. */
  indice: number;
  ruta: string;
  /** Las suyas, y sólo las suyas — los recorridos no cuentan. */
  total: number;
  /** «6 actividades · Vie · Sáb · Dom», ya escrito. */
  resumen: string;
  dias: DiaDeSede[];
};

/**
 * El trozo final de `/sedes/<…>`. **Se calcula del nombre en cada build**, y
 * ahí está la gracia: manda el panel. Se corrige una tilde en `/admin` y la
 * dirección la sigue sola, sin un segundo sitio que actualizar a mano.
 *
 * Lo que se paga: renombrar una sede cambia su dirección y el enlace viejo deja
 * de existir. Es asumible mientras el enlace viva dentro del sitio. El día que
 * se imprima un QR por puerta habrá que acuñarlo UNA vez y dejar de deducirlo,
 * exactamente por lo que explica `TextoDeSala` en `tipos.ts`: una dirección
 * pegada a una pared ya no es un detalle de implementación.
 */
export const ranuraDeSede = (nombre: string) =>
  aplanar(nombre)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const rutaDeSede = (nombre: string) => `/sedes/${ranuraDeSede(nombre)}`;

const cuantasActividades = (n: number) => `${n} ${n === 1 ? 'actividad' : 'actividades'}`;

/** Lo que pasa en una sede, por días y en orden de reloj. */
export const agendaDeSede = (sede: Sede, indice: number): AgendaDeSede => {
  const suyas = actividades
    .filter((a) => a.sede === sede.nombre)
    .sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio));

  /* Los recorridos entran en los días, no en la cuenta. */
  const conRecorridos = [...suyas, ...recorridos];

  /* Los días en los que esta sede tiene algo PROPIO. Sin esta distinción, una
     sede vacía anunciaría «Sáb · Dom» por los dos días que pasa la Marcha. */
  const suyosDias = [...new Set(suyas.map((a) => programa.dias[a.dia].dia.slice(0, 3)))];

  return {
    sede,
    indice,
    ruta: rutaDeSede(sede.nombre),
    total: suyas.length,
    resumen: suyas.length
      ? `${cuantasActividades(suyas.length)} · ${suyosDias.join(' · ')}`
      : recorridos.length
        ? 'Sólo pasa el recorrido'
        : 'Sin actividades en el programa',
    dias: programa.dias
      .map((d, i) => ({
        ...d,
        indice: i,
        corto: diaCorto(i),
        actividades: conRecorridos
          .filter((a) => a.dia === i)
          .sort((a, b) => a.inicio.localeCompare(b.inicio)),
      }))
      .filter((d) => d.actividades.length > 0),
  };
};

export const agendaPorSede: AgendaDeSede[] = sedes.lista.map((s, i) => agendaDeSede(s, i));

/**
 * El instante exacto de una hora del programa, con el huso de Guadalajara.
 *
 * Las actividades guardan `dia` (0…3) y `'HH:MM'`, que es lo que se escribe en
 * el panel y lo único que hace falta para pintarlas. Pero para saber si algo
 * **está pasando ahora** hace falta una fecha de verdad, y tiene que llevar el
 * huso puesto: sin él, el navegador de quien mire desde Madrid interpretaría
 * «19:00» en su hora y diría que la inauguración terminó hace rato.
 *
 * Sale de `festival.inicioISO` —la misma fecha que ya mueve la cuenta regresiva
 * de la portada— así que el día que el festival se mueva, se mueve en un sitio.
 */
const HUSO = festival.inicioISO.slice(-6);
const DIA_UNO = festival.inicioISO.slice(0, 10);

export const instanteDe = (dia: number, hhmm: string) => {
  const d = new Date(`${DIA_UNO}T12:00:00${HUSO}`);
  d.setUTCDate(d.getUTCDate() + dia);
  return `${d.toISOString().slice(0, 10)}T${hhmm}:00${HUSO}`;
};

/** ── Qué tengo cerca ──────────────────────────────────────────────────────
 *
 * Las dieciséis caben en 2,8 km y hay dos que están a 31 metros una de otra:
 * a esa escala, «al lado» no es un adorno, es la mitad de la decisión de la
 * noche. Sale de las coordenadas que cada sede ya trae para el plano de la
 * portada, así que no hay dato nuevo que mantener.
 *
 * **En línea recta, y se dice.** Andando por calles siempre es más, y pedirle
 * rutas a un servicio de mapas rompería la regla de la casa: este sitio no le
 * pide nada a nadie. A 90 metros la diferencia no existe; a 800 sí, y por eso
 * el rótulo la nombra en vez de prometer una caminata que no midió.
 */
const RADIO = 6371000;
const enRadianes = (g: number) => (g * Math.PI) / 180;

const metrosEntre = (a: [number, number], b: [number, number]) => {
  const dLat = enRadianes(b[0] - a[0]);
  const dLon = enRadianes(b[1] - a[1]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(enRadianes(a[0])) * Math.cos(enRadianes(b[0])) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * RADIO * Math.asin(Math.sqrt(x)));
};

export type SedeCerca = { agenda: AgendaDeSede; metros: number; minutos: number };

/** Las más cercanas a una sede, de la más próxima en adelante. Una sede sin
 *  coordenada no empareja con nadie: antes que inventarle un punto, no sale. */
export const cercaDe = (agenda: AgendaDeSede, cuantas = 3): SedeCerca[] => {
  const desde = agenda.sede.coord;
  if (!desde) return [];

  return agendaPorSede
    .filter((o) => o.sede.nombre !== agenda.sede.nombre && o.sede.coord)
    .map((o) => {
      const metros = metrosEntre(desde, o.sede.coord!);
      /* 75 m por minuto: el paso de alguien que va mirando escaparates, no el
         de una app de fitness. Redondeado hacia arriba, que es como se cuenta
         el tiempo que falta para llegar. */
      return { agenda: o, metros, minutos: Math.max(1, Math.ceil(metros / 75)) };
    })
    .sort((a, b) => a.metros - b.metros)
    .slice(0, cuantas);
};

/**
 * Lo que se lee al lado del rótulo «Programa»: en la marquesina de `/programa`,
 * en su cabecera de móvil y en el índice de la portada del móvil.
 *
 * Era `programa.estado`, escrito a mano y siempre «(Próximamente)». Eso estaba
 * bien mientras no hubiera programa; el día que el festival desmarcara la
 * casilla, la rejilla saldría publicada con tres carteles alrededor diciendo
 * que todavía no hay. Ahora lo dice el dato.
 */
export const estadoPrograma = programaPublicado
  ? `${actividades.length} ${actividades.length === 1 ? 'actividad' : 'actividades'} · ${programa.dias.length} días`
  : programa.estado;

/** ── El registro a eventos ────────────────────────────────────────────────
 *
 * Aquí uno se apunta **por actividad**: cada `ActividadGantt` trae su propio
 * `registro` —su formulario— y la ficha de la rejilla abre ése. `/registro` es la
 * otra puerta a la misma cosa: las mismas actividades, ordenadas por cuándo se
 * entra en vez de por dónde caen en la rejilla.
 *
 * No hay una lista aparte de «eventos con registro» y eso es lo que importa del
 * diseño: dos listas de lo mismo se separan el primer día que alguien cambia
 * una hora en una sola de las dos.
 */
/**
 * Si `/registro` enseña la lista o el cartel de espera.
 *
 * **Se deduce, no se declara, y eso es una corrección.** Hubo un interruptor de
 * «el registro está abierto», con su formulario general y su nota, copiando el
 * de la rejilla de ejemplo. Sobraba, y estorbaba: aquí no hay un registro al
 * festival que abrir o cerrar —se apunta uno por actividad—, así que pegarle el
 * formulario a una actividad ES abrirle el registro. Un interruptor que sólo
 * puede decir que sí cuando ya hay formularios no decide nada; lo único que
 * hacía era dejar la página en «Próximamente» con tres formularios cargados
 * esperando a que alguien se acordara de marcar una casilla.
 *
 * Queda la única condición que sí es una condición: **el programa publicado**.
 * Enseñar aquí las actividades de una rejilla que `/programa` esconde sería
 * publicarla por la puerta de atrás, y ésa no es una decisión nueva — es la
 * misma, y ya está tomada en el otro sitio.
 */
export const registroAbierto = programaPublicado && actividades.some((a) => a.registro);

/**
 * De quién es un formulario.
 *
 * El festival usa Google Forms; Tally se soporta porque el sitio ya lo abría
 * encima de la página —tiene una API de ventana— y quitarlo sería quitar algo
 * que funciona. Cualquier otra dirección se abre en otra pestaña, que es lo que
 * hace un enlace normal.
 *
 * Sirve para dos cosas y las dos importan: el panel puede decir de qué es cada
 * enlace —pegar el de otra actividad es el error de todos los días— y el botón
 * del sitio sólo pinta la flechita cuando de verdad se va a otra pestaña.
 */
export const proveedorDeFormulario = (url?: string): 'tally' | 'google' | 'otro' | null => {
  if (!url) return null;
  try {
    const { hostname } = new URL(url);
    if (/(^|\.)tally\.so$/.test(hostname)) return 'tally';
    if (/(^|\.)(forms\.gle|docs\.google\.com)$/.test(hostname)) return 'google';
    return 'otro';
  } catch {
    return 'otro';
  }
};

/** Si el formulario se abre encima de la página en vez de en otra pestaña. Hoy
 *  sólo Tally: Google Forms reparte enlaces cortos (`forms.gle`) que sólo se
 *  resuelven siguiendo la redirección, así que no hay forma de incrustarlos sin
 *  pedirle a Google la página antes de que nadie haya pulsado nada. */
export const abreEncima = (url?: string) => proveedorDeFormulario(url) === 'tally';

/** Cómo se entra a una actividad. `pendiente` no sale en el sitio: es lo que
 *  todavía no nos han pasado, y una actividad sin puerta no se anuncia con una
 *  puerta vacía. */
export const puertaDe = (a: ActividadGantt): 'formulario' | 'libre' | 'pendiente' =>
  a.registro ? 'formulario' : a.libre ? 'libre' : 'pendiente';

/**
 * Las que salen en `/registro`: **sólo las que tienen formulario**.
 *
 * Las de entrada libre no. Se listaban, con su etiqueta de «entrada libre» en
 * el sitio del botón, y era mezclar dos cosas: esto es la página de apuntarse,
 * y una actividad a la que se entra sin apuntarse no tiene nada que hacer en
 * una lista de puertas. Que sea de entrada libre se dice donde toca — en su
 * ficha de la rejilla, que es donde alguien pregunta «¿y a ésta cómo entro?».
 */
export const actividadesConRegistro = actividades
  .filter((a) => Boolean(a.registro))
  .sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio));

/** Agrupadas por día, saltándose los días en los que no hay nada: un día vacío
 *  con su titular y nada debajo se lee como un error del sitio. */
export const registroPorDia = programa.dias
  .map((dia, i) => ({
    ...dia,
    indice: i,
    actividades: actividadesConRegistro.filter((a) => a.dia === i),
  }))
  .filter((d) => d.actividades.length > 0);

/** ── Las descripciones ───────────────────────────────────────────────────
 *
 * La cartela de museo, sin la cartela. Cada actividad puede llevar el texto que
 * estaría impreso en la pared; el sitio le da una página y el panel imprime una
 * etiqueta con el QR que la abre.
 *
 * Por qué no se imprimen los textos: son 32 actividades. Las cartelas de todas
 * son un taco de papel que ni se paga ni se pega ni se corrige cuando cambia
 * algo. Una etiqueta con un código sí, y se reimprime una sola cuando hace
 * falta.
 */

/** Una actividad con su descripción ya publicada. El tipo se estrecha para
 *  que las páginas no tengan que preguntar dos veces por lo mismo. */
export type ConSala = ActividadGantt & { sala: TextoDeSala };

/**
 * Las que tienen página. **Publicado y con texto**, las dos cosas.
 *
 * El borrador no cuenta y ésa es la regla que sostiene todo lo demás: de aquí
 * salen las páginas que construye Astro, los botones del sitio y las cartelas
 * que se pueden imprimir. Si un borrador colara, se podría imprimir un QR para
 * una página que no existe — y eso no se descubre en la pantalla, se descubre
 * en la pared.
 */
export const actividadesConSala: ConSala[] = actividades
  .filter((a): a is ConSala => Boolean(a.sala?.publicado && a.sala.cuerpo))
  /* Y nunca la dirección del festival. El validador del panel ya no deja
     acuñarla —ver `SALA_FESTIVAL`— pero sólo mira lo que se guarda: una que
     hubiera entrado antes de esa regla sigue en KV, y aquí generaría
     `/sala/festival` a la vez que la página fija del festival. Astro no se
     cae: da prioridad a la estática, deja un WARN en el log del build que no
     lee nadie, y esa descripción se queda sin página —con su QR impreso
     apuntando a ella—. Así que se descarta aquí y se dice abajo, en la red de
     seguridad, con el título delante. */
  .filter((a) => a.sala.id !== SALA_FESTIVAL)
  .sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio));

/** La ruta de una descripción. Una sola función para las cuatro cosas que la
 *  necesitan —el QR del panel, el botón de la ficha, la página y el sitemap—:
 *  si alguna vez cambia el prefijo, que no haya cuatro sitios donde no cambió. */
export const rutaSala = (sala: TextoDeSala) => `/sala/${sala.id}`;

/** El cuerpo partido en párrafos. Se guarda como un texto con líneas en blanco
 *  —que es como se escribe— y se pinta como `<p>`, que es como se lee. */
export const parrafosDe = (sala: TextoDeSala) =>
  sala.cuerpo.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

/** ── Red de seguridad ─────────────────────────────────────────────────────
 *
 * `sedeDe()` empareja por nombre EXACTO, así que una tilde de más o de menos en
 * el campo `sede` de una actividad no rompe nada a la vista: simplemente la
 * ficha de esa actividad sale sin dirección y sin enlace al mapa, y nadie se
 * entera hasta que un visitante la abre. Ya pasó una vez, con «Taller Industria
 * Grafica» contra «Taller Industria Gráfica».
 *
 * Se lista todo lo que no empareja de una vez —no sólo lo primero— y se sugiere
 * el nombre bueno cuando se parece, que es lo que ahorra el viaje de ida y
 * vuelta al arreglarlo.
 *
 * **Revienta el build o sólo avisa, según de dónde venga el dato**, y esa
 * diferencia es deliberada:
 *
 *   · Si el contenido es la semilla del repo, lo escribí yo y un error mío
 *     tiene que doler antes de desplegar. `throw`.
 *   · Si vino del panel, lo escribió el festival. Aquí un `throw` significaría
 *     que una tilde de más deja el sitio SIN PODER PUBLICARSE, y de noche,
 *     durante el festival, sin nadie que lea la consola de un build. Se avisa y
 *     se sigue: esa ficha sale sin dirección —que es feo— en vez de tumbar el
 *     despliegue —que es peor—.
 *
 * La puerta de verdad está antes: `workers/panel/lib/validar.js` rechaza esto
 * mismo al guardar, con el «¿querías decir…?» puesto, y el festival lo ve en la
 * pantalla mientras todavía se acuerda de lo que escribió. Esto de aquí es la
 * red por debajo, no el filtro.
 */
{
  const nombres = sedes.lista.map((s) => s.nombre);

  /* «Todas las sedes» no está en `nombres` —se filtra de la lista, porque no
     es una sede— y aquí no es un error: es el nombre reservado con el que un
     recorrido dice que pasa por varias. Sin esta salvedad, cada recorrido del
     programa saldría en el aviso como una sede mal escrita. */
  const sueltas = actividades
    .filter((a) => !enTodasLasSedes(a.sede) && !nombres.includes(a.sede))
    .map((a) => {
      const parecida = nombres.find((n) => pelar(n) === pelar(a.sede));
      return `  · «${a.sede}» (en «${a.titulo}»)${
        parecida ? ` — ¿querías decir «${parecida}»?` : ''
      }`;
    });

  /* La otra cosa que este bloque vigila: una descripción que se llame como la
     página del festival. Se filtró arriba para que no rompa el sitio; aquí se
     dice, que es la parte que hace falta — alguien tiene que ir a cambiarle la
     dirección desde el panel. */
  const chocanConElFestival = actividades.filter((a) => a.sala?.id === SALA_FESTIVAL);
  if (chocanConElFestival.length) {
    const cuales = chocanConElFestival.map((a) => `  · «${a.titulo}»`).join('\n');
    const parte =
      `hay ${chocanConElFestival.length} descripción(es) con la dirección ` +
      `«${SALA_FESTIVAL}», que es la del texto de sala del festival. No se ` +
      `construye su página: la del festival gana.\n${cuales}\n\n` +
      `Se arregla desde /admin: quítale la descripción y vuelve a crearla, que ` +
      `acuña otra dirección.`;
    if (delPanel) console.warn(`\n⚠️  Contenido del panel: ${parte}\n`);
    else throw new Error(`site.ts: ${parte}`);
  }

  /* Y la tercera: dos sedes que caigan en la misma dirección. Las direcciones
     se deducen del nombre —ver `ranuraDeSede`—, así que «Casa Feria» y «Casa
     Feria.» son dos filas del panel y una sola página. Astro no avisa de forma
     entendible: `getStaticPaths` revienta con la ruta repetida y sin decir de
     quién es. Aquí se dice con los dos nombres delante, que es lo que hace
     falta para ir a cambiar uno. */
  const ranuras = new Map<string, string[]>();
  for (const n of nombres) {
    const r = ranuraDeSede(n);
    ranuras.set(r, [...(ranuras.get(r) ?? []), n]);
  }
  const chocadas = [...ranuras].filter(([, quienes]) => quienes.length > 1);
  if (chocadas.length) {
    const parte =
      `hay ${chocadas.length} dirección(es) de sede repetida(s). Dos sedes no ` +
      `pueden compartir página.\n` +
      chocadas.map(([r, quienes]) => `  · /sedes/${r} — ${quienes.join(' · ')}`).join('\n') +
      `\n\nSe arregla desde /admin, cambiándole el nombre a una de las dos.`;
    if (delPanel) console.warn(`\n⚠️  Contenido del panel: ${parte}\n`);
    else throw new Error(`site.ts: ${parte}`);
  }

  if (sueltas.length) {
    const parte =
      `hay ${sueltas.length} actividad(es) que nombran una sede que no está en ` +
      `sedes.lista. La ficha de la rejilla se queda sin dirección ni mapa.\n` +
      sueltas.join('\n') +
      `\n\nSedes válidas:\n${nombres.map((n) => `  · ${n}`).join('\n')}`;

    if (delPanel) {
      console.warn(`\n⚠️  Contenido del panel: ${parte}\n`);
    } else {
      throw new Error(`site.ts: ${parte}`);
    }
  }
}
