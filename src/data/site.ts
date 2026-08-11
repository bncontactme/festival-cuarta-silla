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
  convocatoriaPDF:
    'https://www.festivaldearteconceptual.com/_files/ugd/985416_d240424c19c14ea4ad0fbeeff5a22e4a.pdf',
  creditoFooter:
    '© 2026 Creado por Festival De Arte Conceptual La Cuarta Silla',
};

export const nav = [
  { label: 'Inicio', href: '/' },
  { label: 'Programa', href: '/programa' },
  { label: 'Registro a eventos', href: '/registro' },
  { label: 'Sedes', href: '/sedes' },
];

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
  instagram: string;
  mapa: string;
};

export const sedes = {
  titulo: 'Sedes',
  acciones: { conoce: 'Conoce más', ubicacion: 'Ubicación' },
  lista: [
    {
      nombre: 'Salón Liminal',
      direccion: 'C. Independencia 795, Zona Centro, 44100 Guadalajara, Jal.',
      instagram: 'https://www.instagram.com/salonliminal/',
      mapa: 'https://maps.app.goo.gl/17i56g378cvg5t7j9',
    },
    {
      nombre: 'Staditche',
      direccion:
        'C. Manuel López Cotilla 858, Col Americana, Americana, 44160 Guadalajara, Jal.',
      instagram: 'https://www.instagram.com/staditche/',
      mapa: 'https://maps.app.goo.gl/436QGVLkPj3ZSueU6',
    },
    {
      nombre: 'Ala Rota',
      direccion: 'Juan Manuel 823, Zona Centro, 44200 Guadalajara, Jal.',
      instagram: 'https://www.instagram.com/alarota.cultura/',
      mapa: 'https://maps.app.goo.gl/hB6KDRMnp6TxrJBD7',
    },
    {
      nombre: 'Temporal',
      direccion: 'C. Independencia 795, Zona Centro, 44100 Guadalajara, Jal.',
      instagram: 'https://www.instagram.com/temporal___________/',
      mapa: 'https://maps.app.goo.gl/Fsu7vg12MzBCtbxD8',
    },
    {
      nombre: 'Ánima Galería',
      direccion:
        'C. Miguel Blanco 1405, Col Americana, Americana, 44160 Guadalajara, Jal.',
      instagram: 'https://www.instagram.com/animagaleria/',
      mapa: 'https://maps.app.goo.gl/D2y3qeR19Qc2G2ND8',
    },
    {
      nombre: 'Estallido Art Project',
      direccion: 'Calle, Av. Alcalde 159, Zona Centro, 44100 Guadalajara, Jal.',
      instagram: 'https://www.instagram.com/estallidoartproject/',
      mapa: 'https://maps.app.goo.gl/SuKhGPMVaB7ZeRve9',
    },
    {
      nombre: 'Palma Galería',
      direccion:
        'C. Manuel López Cotilla 1360, Col Americana, Americana, 44160 Guadalajara, Jal.',
      instagram: 'https://www.instagram.com/palmagaleria/',
      mapa: 'https://maps.app.goo.gl/9LFY63xj1kpyzuncA',
    },
    {
      nombre: 'Estudio Arrechiga',
      direccion:
        'Camarena 118, Col Americana, Americana, 44160 Guadalajara, Jal.',
      instagram: 'https://www.instagram.com/estudioarechiga/',
      mapa: 'https://maps.app.goo.gl/C1F4Us1jy6buYTJJA',
    },
  ] satisfies Sede[],
};

export const patrocinadores = {
  titulo: 'Patrocinadores',
  // El original sólo tiene placeholders de stock: sin logos reales todavía.
  lista: [] as { nombre: string; logo: string; url?: string }[],
};

export const privacidad = {
  titulo: 'Política de Privacidad',
  subtitulo: 'Aviso legal',
  cuerpo:
    'Todo lo antes expuesto en esta pagina es responsabilidad del Festival de Arte Conceptual La Cuarta Silla',
};

export const cta = {
  convocatoria: 'Convocatoria',
};
