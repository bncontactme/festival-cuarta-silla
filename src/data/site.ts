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

export type { Sede, Marca, ActividadGantt };

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
