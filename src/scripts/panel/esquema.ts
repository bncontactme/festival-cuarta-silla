/**
 * Qué campos tiene cada cosa.
 *
 * Es la tercera copia del mismo contrato —`src/data/tipos.ts` lo dice en
 * TypeScript, `workers/panel/lib/validar.js` lo comprueba de verdad, y esto
 * dibuja los formularios—, y las tres tienen que coincidir. Cuando se añada un
 * campo hay que tocar los tres archivos; están enlazados entre sí a propósito
 * para que se note.
 *
 * Los textos de `ayuda` salen casi literales de los comentarios de `tipos.ts`.
 * Eso no es pereza: esa documentación se escribió para explicarle a alguien qué
 * poner en cada hueco, y ese alguien es justo quien va a estar mirando este
 * formulario.
 */

export type TipoCampo =
  | 'texto' | 'area' | 'url' | 'imagen' | 'sede'
  | 'dia' | 'hora' | 'tipoActividad' | 'numero' | 'coord' | 'fotos';

export type Campo = {
  clave: string;
  etiqueta: string;
  tipo: TipoCampo;
  ayuda?: string;
  requerido?: boolean;
  /** Cuántas columnas de la rejilla ocupa. Por defecto una. */
  ancho?: number;
  /** Carpeta de Cloudinary. Puede depender de la fila (el año, en el archivo). */
  carpeta?: string | ((fila: any) => string);
  /** De dónde sale la subcarpeta con el nombre propio. */
  nombreDe?: (fila: any) => string | undefined;
};

export type Esquema = {
  singular: string;
  plural: string;
  campos: Campo[];
  nuevo(): any;
  /** El renglón que resume la fila cuando está plegada o en un mensaje. */
  titula(fila: any, i: number): string;
};

export type Tabla = {
  clave: string;
  titulo: string;
  /** Qué colección se manda al Worker al guardar esta tabla. */
  coleccion: 'sedes' | 'programa' | 'artistas' | 'archivo' | 'marcas';
  nota?: string;
  esquema: Esquema;
  leer(estado: any): any[];
  escribir(estado: any, lista: any[]): void;
};

export const TIPOS_ACTIVIDAD = ['taller', 'charla', 'muestra', 'escena'] as const;

/** Los colores de la rejilla, para la vista previa. Copiados de `coloresGantt`
 *  en `site.ts`: aquí no se puede importar el sitio, y de todas formas la
 *  previa es un boceto, no la rejilla de verdad. */
export const COLOR_TIPO: Record<string, { fondo: string; texto: string }> = {
  taller:  { fondo: '#ff0100', texto: '#fffd00' },
  charla:  { fondo: '#fffd00', texto: '#1e1e1e' },
  muestra: { fondo: '#ffffff', texto: '#1e1e1e' },
  escena:  { fondo: '#99272d', texto: '#fffd00' },
};

// ── Esquemas ─────────────────────────────────────────────────────────────────

const actividades: Esquema = {
  singular: 'actividad',
  plural: 'actividades',
  campos: [
    { clave: 'titulo', etiqueta: 'Título', tipo: 'texto', requerido: true, ancho: 2 },
    { clave: 'dia', etiqueta: 'Día', tipo: 'dia', requerido: true, ancho: 2 },
    { clave: 'inicio', etiqueta: 'Empieza', tipo: 'hora', requerido: true },
    { clave: 'fin', etiqueta: 'Termina', tipo: 'hora', requerido: true },
    { clave: 'sede', etiqueta: 'Sede', tipo: 'sede', requerido: true, ancho: 2 },
    { clave: 'tipo', etiqueta: 'Tipo', tipo: 'tipoActividad', requerido: true },
    { clave: 'artista', etiqueta: 'Quién la da', tipo: 'texto', ancho: 2,
      ayuda: 'Sale en la ficha, debajo del título.' },
    { clave: 'registro', etiqueta: 'Formulario de registro', tipo: 'url', ancho: 3,
      ayuda: 'El Tally de esta actividad. Sin él la ficha sale sin botón.' },
  ],
  nuevo: () => ({ titulo: '', dia: 0, inicio: '10:00', fin: '12:00', sede: '', tipo: 'taller' }),
  titula: (a) => a.titulo || 'Sin título',
};

const sedes: Esquema = {
  singular: 'sede',
  plural: 'sedes',
  campos: [
    { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, ancho: 2,
      ayuda: 'Ojo al cambiarlo: el programa y las fichas de artistas apuntan a la sede POR ESTE NOMBRE.' },
    { clave: 'direccion', etiqueta: 'Dirección', tipo: 'texto', requerido: true, ancho: 3 },
    { clave: 'coord', etiqueta: 'Coordenada', tipo: 'coord', ancho: 2,
      ayuda: 'Latitud, longitud. Es lo que clava la estrella en el plano de la portada. Sin ella no hay estrella, y está bien: es lo que toca cuando la sede no está en el centro.' },
    { clave: 'instagram', etiqueta: 'Instagram', tipo: 'url', ancho: 2 },
    { clave: 'mapa', etiqueta: 'Pin de Google Maps', tipo: 'url', ancho: 2,
      ayuda: 'El enlace corto al pin exacto. Sin él, «Ubicación» busca por dirección.' },
    { clave: 'notaMapa', etiqueta: 'Nota del mapa', tipo: 'texto', ancho: 3,
      ayuda: 'Qué contar cuando no hay estrella que enseñar.' },
  ],
  nuevo: () => ({ nombre: '', direccion: '' }),
  titula: (s) => s.nombre || 'Sede sin nombre',
};

const artistas: Esquema = {
  singular: 'artista',
  plural: 'artistas',
  campos: [
    { clave: 'foto', etiqueta: 'Retrato', tipo: 'imagen', ancho: 2,
      carpeta: 'artistas', nombreDe: (a) => a.nombre,
      ayuda: 'Recortado a 4:5 (p. ej. 1000×1250). Sin foto la ficha sale con la caja en amarillo y el nombre en grande, que es un hueco honesto.' },
    { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, ancho: 2 },
    { clave: 'disciplina', etiqueta: 'Disciplina', tipo: 'texto', ancho: 2,
      ayuda: 'Dos o tres palabras: «performance», «gráfica expandida», «instalación sonora».' },
    { clave: 'instagram', etiqueta: 'Instagram', tipo: 'url', ancho: 2 },
    { clave: 'sede', etiqueta: 'Sede', tipo: 'sede', ancho: 2 },
  ],
  nuevo: () => ({ nombre: '' }),
  titula: (a) => a.nombre || 'Artista sin nombre',
};

const archivo: Esquema = {
  singular: 'edición',
  plural: 'ediciones',
  campos: [
    { clave: 'edicion', etiqueta: 'Cómo se llamó', tipo: 'texto', requerido: true, ancho: 2,
      ayuda: '«Primera Silla», «Segunda Silla»…' },
    { clave: 'anio', etiqueta: 'Año', tipo: 'texto', requerido: true },
    { clave: 'lema', etiqueta: 'Lema', tipo: 'texto', ancho: 2 },
    { clave: 'sedes', etiqueta: 'Nº de sedes', tipo: 'numero',
      ayuda: 'Va al índice. Si no se sabe, se deja vacío y la columna no se pinta.' },
    { clave: 'actividades', etiqueta: 'Nº de actividades', tipo: 'numero' },
    { clave: 'fotos', etiqueta: 'Fotos', tipo: 'fotos', ancho: 4,
      carpeta: (e) => `archivo/${/^\d{4}$/.test(String(e.anio)) ? e.anio : '0000'}`,
      ayuda: 'Apaisadas (4:3). El pie es opcional, pero es lo que convierte un álbum en un archivo: quién, dónde, qué se ve.' },
  ],
  nuevo: () => ({ edicion: '', anio: String(new Date().getFullYear() - 1), fotos: [] }),
  titula: (e) => [e.edicion, e.anio].filter(Boolean).join(' · ') || 'Edición sin nombre',
};

const marcas: Esquema = {
  singular: 'marca',
  plural: 'marcas',
  campos: [
    { clave: 'logo', etiqueta: 'Logo', tipo: 'imagen', ancho: 2, carpeta: 'marcas',
      nombreDe: (m) => m.nombre,
      ayuda: 'Sin logo se pinta el nombre en display, que es un hueco honesto. Mejor eso que un archivo inventado.' },
    { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, ancho: 2 },
    { clave: 'url', etiqueta: 'Su sitio', tipo: 'url', ancho: 2 },
  ],
  nuevo: () => ({ nombre: '' }),
  titula: (m) => m.nombre || 'Marca sin nombre',
};

// ── Tablas ───────────────────────────────────────────────────────────────────

export const TABLAS: Record<string, Tabla> = {
  actividades: {
    clave: 'actividades', titulo: 'Programa', coleccion: 'programa', esquema: actividades,
    nota: 'Las barras de la rejilla. Cada una tiene que apuntar a una sede que exista: si el nombre no coincide letra por letra, el panel no deja guardar y te dice cuál querías.',
    leer: (e) => e.programa.actividades,
    escribir: (e, l) => { e.programa.actividades = l; },
  },
  sedes: {
    clave: 'sedes', titulo: 'Sedes', coleccion: 'sedes', esquema: sedes,
    nota: 'El orden es el que se pinta, y no es alfabético. Arrastra para cambiarlo.',
    leer: (e) => e.sedes,
    escribir: (e, l) => { e.sedes = l; },
  },
  artistas: {
    clave: 'artistas', titulo: 'Artistas', coleccion: 'artistas', esquema: artistas,
    nota: 'Vacío está bien: la portada y /artistas se pintan solas en su estado «Por anunciar». Con la primera ficha aparece la reja.',
    leer: (e) => e.artistas,
    escribir: (e, l) => { e.artistas = l; },
  },
  archivo: {
    clave: 'archivo', titulo: 'Galería', coleccion: 'archivo', esquema: archivo,
    nota: 'De la edición más reciente a la más vieja, que es como se lee un archivo.',
    leer: (e) => e.archivo,
    escribir: (e, l) => { e.archivo = l; },
  },
  patrocinadores: {
    clave: 'patrocinadores', titulo: 'Patrocinadores', coleccion: 'marcas', esquema: marcas,
    leer: (e) => e.marcas.patrocinadores,
    escribir: (e, l) => { e.marcas.patrocinadores = l; },
  },
  colaboradores: {
    clave: 'colaboradores', titulo: 'Colaboradores', coleccion: 'marcas', esquema: marcas,
    leer: (e) => e.marcas.colaboradores,
    escribir: (e, l) => { e.marcas.colaboradores = l; },
  },
};

export const PESTANAS: { clave: string; titulo: string; tablas: string[] }[] = [
  { clave: 'programa', titulo: 'Programa', tablas: ['actividades'] },
  { clave: 'sedes', titulo: 'Sedes', tablas: ['sedes'] },
  { clave: 'artistas', titulo: 'Artistas', tablas: ['artistas'] },
  { clave: 'archivo', titulo: 'Galería', tablas: ['archivo'] },
  { clave: 'marcas', titulo: 'Marcas', tablas: ['patrocinadores', 'colaboradores'] },
];
