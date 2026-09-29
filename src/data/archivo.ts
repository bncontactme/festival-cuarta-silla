import { contenido } from './contenido';
import type { Aporte, Edicion, Foto } from './tipos';

/**
 * El registro histórico del festival: las ediciones anteriores con sus fotos,
 * y desde el 28/09 también las que manda el público.
 *
 * **Se llama «Galería» de cara al público y «archivo» por dentro**, y no es un
 * despiste. Lo que se guarda es un archivo —ediciones fechadas, con pie de
 * foto, ordenadas de lo más reciente a lo más viejo— pero lo que la gente ve y
 * viene a ver son fotos, y «Galería» es el rótulo que dice eso. Por dentro no
 * se toca nada: el módulo, la colección del panel, la clave de KV y la carpeta
 * de Cloudinary siguen diciendo `archivo`, porque renombrar el almacén por un
 * rótulo es una migración de datos a cambio de nada.
 * Pedido del cliente el 26/08: «necesitamos un apartado de registro histórico
 * del festival, de que subir fotos y así… de las ediciones».
 *
 * **El archivo abierto.** Pedido del 28/09: que sea «un archivo compartido» en
 * el que cualquiera suba fotos —hasta cinco por entrada, con título, nombre,
 * Instagram y descripción— y que el festival revise y acepte «sólo lo que tenga
 * sentido». Las entradas aceptadas son `aportes`, otra colección: una edición es
 * del festival y una entrada es de quien la manda. Ver `Aporte` en `tipos.ts`.
 *
 * Las dos listas **las carga el festival desde `/admin`** —las ediciones a mano,
 * las entradas aceptando lo que llega—; aquí sólo queda el texto de la sección.
 *
 * Puede estar vacía y no pasa nada. **Vacía no tiene hueco**: había una ficha
 * de «En construcción / Todavía no hay fotos» debajo de la banda de subir, y
 * se quitó el 28/09 a pedido del cliente. Con la galería abierta, lo que se lee
 * sin fotos es la invitación a subirlas, y una segunda caja diciendo que no hay
 * nada sobraba. Llena, las entradas y las ediciones salen debajo solas.
 */

export type { Foto, Edicion, Aporte };

export const archivo = {
  titulo: 'Galería',
  acciones: {
    ver: 'Ver la galería',
    sedes: 'sedes',
    actividades: 'actividades',
  },
  /** **Se edita en `/admin`.** El orden que se pinta es el de la lista: de la
   *  más reciente a la más vieja, que es como se lee un archivo. El panel
   *  avisa si se guarda al revés. */
  lista: contenido.archivo,
  /** **Se acepta en `/admin`**, pestaña Envíos, y se edita en la de Galería.
   *  La última aceptada va arriba; el orden se cambia arrastrando. */
  aportes: (contenido.aportes ?? []) as Aporte[],

  /** La banda que invita a subir, encima de todo lo demás. */
  abierto: {
    rotulo: 'Archivo abierto',
    titulo: 'Sube tus fotos',
    bajada:
      'Si estuviste en el festival, este archivo también es tuyo. Hasta cinco fotos por entrada, ' +
      'con un título y tu nombre. Las revisamos antes de publicarlas.',
    boton: 'Subir fotos',
    /** El rótulo de la sección de entradas. */
    entradas: 'Del público',
  },

  /**
   * El formulario de subir. Vive en un `<dialog>` —el mismo modal del
   * manifiesto— y se usa igual desde el teléfono y desde el escritorio.
   *
   * `mensajes` viaja entero al script (`src/scripts/galeria.ts`) en un atributo
   * del formulario: así los textos que sólo se leen cuando algo sale mal siguen
   * aquí, con el resto, y no escondidos en el código. `{nombre}`, `{n}` y
   * `{total}` los rellena el script.
   */
  subir: {
    rotulo: 'Galería / Archivo abierto',
    titulo: 'Sube tus fotos',
    bajada:
      'Hasta cinco fotos por entrada. La revisamos y, si entra, sale en la galería con tu nombre.',
    fotos: 'Fotos',
    fotosNota: 'De una a cinco',
    anadir: 'Añadir fotos',
    soltar: 'o suéltalas aquí',
    quitar: 'Quitar esta foto',
    tituloCampo: 'Título',
    tituloAyuda: 'Cómo lo llamarías',
    nombre: 'Tu nombre',
    nombreAyuda: 'Se publica',
    instagram: 'Instagram',
    opcional: 'opcional',
    descripcion: 'Descripción',
    descripcionAyuda: 'Dónde, cuándo, quién sale…',
    permiso:
      'Las fotos son mías, o tengo permiso de quien las tomó, y el festival puede publicarlas ' +
      'en su galería con mi nombre.',
    privacidad: 'Qué hacemos con estos datos',
    mandar: 'Mandar a revisión',
    listo: {
      titulo: '¡Recibido!',
      cuerpo:
        'Tu entrada está en la fila de revisión. Si la aceptamos, sale en la galería en los próximos días.',
      otra: 'Subir otra',
      cerrar: 'Cerrar',
    },
    mensajes: {
      sinFotos: 'Falta al menos una foto.',
      sinTitulo: 'Falta el título.',
      sinNombre: 'Falta tu nombre.',
      sinPermiso: 'Marca la casilla del permiso: sin ella no podemos publicarlas.',
      cuenta: 'Esa cuenta de Instagram no parece válida.',
      tope: 'Son cinco fotos como máximo por entrada: {n} se quedaron fuera.',
      topeUna: 'Son cinco fotos como máximo por entrada: una se quedó fuera.',
      noImagen: '«{nombre}» no es una foto que podamos abrir. Sirven JPG, PNG y WebP.',
      heic:
        '«{nombre}» viene en HEIC, el formato del iPhone, y este navegador no lo abre. ' +
        'Mándatela por WhatsApp o por correo y súbela otra vez: llega convertida.',
      preparando: 'Preparando las fotos…',
      subiendo: 'Subiendo foto {n} de {total}…',
      guardando: 'Mandando…',
      red: 'No se pudo mandar. Revisa tu conexión y vuelve a intentarlo: todo sigue aquí.',
    },
  },

  /** El visor: la entrada a pantalla entera, foto por foto. */
  visor: {
    anterior: 'Foto anterior',
    siguiente: 'Foto siguiente',
    cerrar: 'Cerrar',
    /** Lo que se lee delante del nombre, en la ficha y en el visor. */
    por: 'por',
  },
};
