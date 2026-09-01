/**
 * Todo lo que habla con el Worker.
 *
 * La contraseña vive en `sessionStorage` y no en `localStorage`: se cierra la
 * pestaña y se acabó la sesión. En un panel que se usa desde el teléfono de
 * quien esté en la sede, eso importa más que la comodidad de no volver a
 * escribirla.
 */
import { PANEL_URL } from '../../lib/panel';

const LLAVE = 'cs:panel:clave';

let clave = '';

export const recordada = () => sessionStorage.getItem(LLAVE) ?? '';
export const hayClave = () => Boolean(clave);

export function ponerClave(nueva: string, recordar = true) {
  clave = nueva;
  if (recordar) sessionStorage.setItem(LLAVE, nueva);
}

export function olvidarClave() {
  clave = '';
  sessionStorage.removeItem(LLAVE);
}

export class ErrorPanel extends Error {
  errores: string[];
  avisos: string[];
  estado: number;
  constructor(mensaje: string, estado = 0, errores: string[] = [], avisos: string[] = []) {
    super(mensaje);
    this.estado = estado;
    this.errores = errores;
    this.avisos = avisos;
  }
}

/** Una llamada de admin. Todas son POST con la contraseña dentro. */
export async function pedir<T = any>(accion: string, extra: Record<string, unknown> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(PANEL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: clave, accion, ...extra }),
    });
  } catch (e) {
    // Sin red, o el Worker no está desplegado todavía. Distinguirlo del «me
    // dijo que no» ahorra media hora de buscar la contraseña buena.
    throw new ErrorPanel(
      'No se pudo hablar con el panel. ¿Hay internet? ¿Está desplegado el Worker?',
    );
  }

  let datos: any = {};
  try { datos = await res.json(); } catch { /* algunas respuestas van vacías */ }

  if (!res.ok) {
    throw new ErrorPanel(
      datos.error || `El panel contestó ${res.status}`,
      res.status,
      datos.errores || [],
      datos.avisos || [],
    );
  }
  return datos as T;
}

/** La lectura pública: lo mismo que consume el build del sitio. */
export async function leerContenido() {
  const res = await fetch(`${PANEL_URL}/contenido`, { cache: 'no-store' });
  if (!res.ok) throw new ErrorPanel(`El panel contestó ${res.status} al leer el contenido`, res.status);
  return res.json();
}

/**
 * Sube una imagen a Cloudinary.
 *
 * Dos pasos y ninguno de ellos ve la llave: el Worker firma una subida a UNA
 * carpeta concreta, y el navegador manda el archivo con esa firma. Se usa
 * XMLHttpRequest y no `fetch` por una sola razón: la barra de progreso. Subir
 * treinta fotos de una edición por el wifi de una sede sin saber si avanza es
 * lo que hace que la gente cierre la pestaña a medias.
 */
export async function subirImagen(
  archivo: File,
  carpeta: string,
  nombre: string | undefined,
  alAvanzar?: (porcentaje: number) => void,
): Promise<string> {
  const firma = await pedir<any>('firmar', {
    carpeta,
    nombre,
    content_type: archivo.type,
  });

  const forma = new FormData();
  forma.append('file', archivo);
  forma.append('api_key', firma.api_key);
  forma.append('timestamp', firma.timestamp);
  forma.append('signature', firma.signature);
  forma.append('upload_preset', firma.upload_preset);
  forma.append('folder', firma.folder);
  forma.append('asset_folder', firma.asset_folder);

  return new Promise((listo, falla) => {
    const x = new XMLHttpRequest();
    x.open('POST', `https://api.cloudinary.com/v1_1/${firma.cloud_name}/image/upload`);
    x.upload.onprogress = (e) => {
      if (e.lengthComputable && alAvanzar) alAvanzar(Math.round((e.loaded / e.total) * 100));
    };
    x.onload = () => {
      try {
        const r = JSON.parse(x.responseText);
        if (x.status >= 200 && x.status < 300 && r.secure_url) listo(r.secure_url as string);
        else falla(new ErrorPanel(r?.error?.message || `Cloudinary contestó ${x.status}`, x.status));
      } catch {
        falla(new ErrorPanel(`Cloudinary contestó ${x.status}`, x.status));
      }
    };
    x.onerror = () => falla(new ErrorPanel('Se cortó la subida'));
    x.send(forma);
  });
}

/** Qué archivos aceptamos. Se comprueba aquí para poder decirlo antes de
 *  gastar la subida, aunque el Worker lo vuelva a mirar. */
export const MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'];
export const PESO_MAX = 10 * 1024 * 1024;

export function revisarArchivo(f: File): string | null {
  if (!MIMES.includes(f.type)) return `«${f.name}» no es una imagen (${f.type || 'sin tipo'}). Sirven JPG, PNG, WebP y AVIF.`;
  if (f.size > PESO_MAX) return `«${f.name}» pesa ${(f.size / 1048576).toFixed(1)} MB y el tope son 10 MB.`;
  return null;
}
