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
import type { Sede, Marca, ActividadGantt } from './tipos';
import { SEDE_TODAS } from './tipos';

export type { Sede, Marca, ActividadGantt };
export { SEDE_TODAS };

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

/** Convocatoria externa para sumarse al festival como voluntarix. Vive en el
 *  CTA de la portada de escritorio y en los accesos secundarios de móvil. */
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
   * Las catorce sedes. **Se editan en `/admin`**, no aquí.
   *
   * El orden es el que se pinta y no es alfabético: es el de la lista que nos
   * pasaron, y el panel deja arrastrar para cambiarlo.
   */
  lista: contenido.sedes,
};

/* `Marca` vive ahora en `tipos.ts` y se re-exporta arriba. */

/** Quién pone. **Se edita en `/admin`.**
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

export const colaboradores = {
  titulo: 'Colaboradores',
  lista: contenido.marcas.colaboradores,
};

export const privacidad = {
  titulo: 'Política de Privacidad',
  subtitulo: 'Aviso legal',
  cuerpo:
    'Todo lo antes expuesto en esta pagina es responsabilidad del Festival de Arte Conceptual La Cuarta Silla',
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

/** Si una actividad es de las que pasan por todas — un recorrido guiado. No
 *  tiene dirección ni mapa a los que llevar, y eso no es un hueco: es lo que
 *  es. */
export const enTodasLasSedes = (nombre: string) => nombre === SEDE_TODAS;

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
