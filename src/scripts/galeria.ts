/**
 * La galería abierta, del lado del navegador: el formulario de subir y el visor.
 *
 * Los dos viven en `<dialog>`s que abre y cierra `iniciarModales()` de
 * `motion.ts` —con su animación, Esc y clic fuera—. Aquí sólo está lo de dentro.
 *
 * ── Cómo viaja una entrada ──────────────────────────────────────────────────
 *
 *   1. Se eligen las fotos y cada una se **rehace aquí** —ver `preparar()`—.
 *   2. Al mandar, se le pide al Worker que abra un envío (`envio-abrir`): da un
 *      id y una firma de Cloudinary POR FOTO, cada una con su nombre puesto.
 *   3. Cada foto sube directo del navegador a Cloudinary con su firma. Por el
 *      Worker no pasa ni un byte de foto: con diez milisegundos de CPU no se
 *      mueven treinta megas.
 *   4. Con las URLs que devolvió Cloudinary se manda el resto (`envio-mandar`).
 *      El Worker lo valida y lo deja en la fila de revisión del panel.
 *
 * Si algo falla a medias, lo escrito y lo elegido sigue en pantalla y el
 * siguiente intento abre un envío nuevo. Las fotos que llegaron a subir en el
 * intento fallido se quedan huérfanas en Cloudinary y las barre el cron del
 * Worker: mejor eso que reintentar sobre una firma que a lo mejor ya caducó.
 */
import { PANEL_URL } from '../lib/panel';
import { reducir } from '../lib/reducir';

/** Lo que pidió el festival: «máximo 5 fotos por post». El Worker lo vuelve a
 *  mirar; esto sólo evita subir la sexta para que la rechacen. */
const MAXIMO = 5;

/** Lo que Cloudinary acepta si una foto no se puede rehacer aquí y hay que
 *  mandarla tal cual. Coincide con `allowed_formats` de la firma. */
const TAL_CUAL = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const PESO_MAX = 10 * 1024 * 1024;

const rellenar = (plantilla: string, datos: Record<string, string | number>) =>
  plantilla.replace(/\{(\w+)\}/g, (_, k) => String(datos[k] ?? ''));

/** Misma regla que `cuenta()` en `workers/panel/lib/validar.js`: con arroba, sin
 *  ella o el enlace del perfil. Se mira aquí para decirlo en el campo y no
 *  después de subir cinco fotos. */
const cuentaValida = (s: string) =>
  /^[a-z0-9._]{1,30}$/.test(
    s.trim()
      .replace(/^https?:\/\//i, '')
      .replace(/^(www\.)?instagram\.com\//i, '')
      .replace(/^@+/, '')
      .replace(/[/?#].*$/, '')
      .toLowerCase(),
  );

// ── Subir ────────────────────────────────────────────────────────────────────

type Elegida = { nombre: string; foto: Blob; vista: string; nodo: HTMLLIElement };

type Abierto = {
  id: string;
  cloud_name: string;
  api_key: string;
  fotos: Record<string, string>[];
};

/**
 * Rehace la foto antes de subirla —ver `reducir()` en `src/lib/reducir.ts`: a
 * 2000 px, en JPEG y sin metadatos—. Una foto de teléfono de 12 MB sube en
 * medio mega, que por el wifi de una sede es la diferencia entre segundos y
 * minutos.
 *
 * Si el navegador no sabe abrirla —un HEIC en Chrome— y el formato es de los
 * que Cloudinary acepta, se manda tal cual: la transformación de entrada que
 * firma el Worker la deja igual a 2000 px al llegar. Si tampoco, no se sube.
 */
async function preparar(archivo: File): Promise<Blob> {
  try {
    return await reducir(archivo);
  } catch (e) {
    if (TAL_CUAL.includes(archivo.type) && archivo.size <= PESO_MAX) return archivo;
    throw e;
  }
}

const esHeic = (f: File) => /hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name);

function iniciarSubida() {
  const forma = document.querySelector<HTMLFormElement>('[data-subir]');
  const dialogo = forma?.closest('dialog');
  if (forma && dialogo) montarSubida(forma, dialogo);
}

function montarSubida(forma: HTMLFormElement, dialogo: HTMLDialogElement) {
  const T: Record<string, string> = JSON.parse(forma.dataset.textos || '{}');
  const $ = <E extends Element>(sel: string, raiz: ParentNode = forma) => raiz.querySelector<E>(sel)!;

  const lista = $<HTMLUListElement>('[data-subir-fotos]');
  const hueco = $<HTMLLIElement>('[data-subir-hueco]');
  const archivo = $<HTMLInputElement>('[data-subir-archivo]');
  const cuenta = $<HTMLElement>('[data-subir-cuenta]');
  const queja = $<HTMLElement>('[data-subir-queja]');
  const estado = $<HTMLElement>('[data-subir-estado]');
  const mandar = $<HTMLButtonElement>('[data-subir-mandar]');
  const contador = $<HTMLElement>('[data-subir-contador]');
  const descripcion = $<HTMLTextAreaElement>('[name="descripcion"]');
  const listo = $<HTMLElement>('[data-subir-listo]', dialogo);
  const caja = $<HTMLElement>('.modal-caja', dialogo);

  let elegidas: Elegida[] = [];
  let ocupado = false;

  const decir = (texto: string) => { queja.textContent = texto; };
  const avanzar = (texto: string) => { estado.textContent = texto; };

  function pintarCuenta() {
    cuenta.textContent = elegidas.length ? `${elegidas.length} de ${MAXIMO}` : T.fotosNota;
    hueco.hidden = elegidas.length >= MAXIMO;
    hueco.closest('fieldset')?.removeAttribute('aria-invalid');
  }

  function agregar(nombre: string, foto: Blob) {
    const vista = URL.createObjectURL(foto);
    const nodo = document.createElement('li');
    nodo.className = 'subir-foto';
    const img = document.createElement('img');
    img.src = vista;
    img.alt = '';
    const quitar = document.createElement('button');
    quitar.type = 'button';
    quitar.className = 'subir-quitar';
    quitar.setAttribute('aria-label', `${T.quitar}: ${nombre}`);
    quitar.textContent = '✕';
    const avance = document.createElement('i');
    avance.className = 'subir-avance';
    avance.setAttribute('aria-hidden', 'true');
    nodo.append(img, quitar, avance);
    lista.insertBefore(nodo, hueco);

    const elegida: Elegida = { nombre, foto, vista, nodo };
    elegidas.push(elegida);
    quitar.addEventListener('click', () => {
      if (ocupado) return;
      URL.revokeObjectURL(vista);
      nodo.remove();
      elegidas = elegidas.filter((e) => e !== elegida);
      pintarCuenta();
      // El foco se iba con el botón borrado; se queda en el hueco de añadir.
      archivo.focus();
    });
  }

  async function anadir(archivos: File[]) {
    if (ocupado || !archivos.length) return;
    const caben = MAXIMO - elegidas.length;
    const tomadas = archivos.slice(0, Math.max(0, caben));
    const quejas: string[] = [];
    if (archivos.length > tomadas.length) {
      const sobran = archivos.length - tomadas.length;
      quejas.push(sobran === 1 ? T.topeUna : rellenar(T.tope, { n: sobran }));
    }
    decir('');
    avanzar(T.preparando);
    for (const f of tomadas) {
      try {
        agregar(f.name, await preparar(f));
      } catch {
        quejas.push(rellenar(esHeic(f) ? T.heic : T.noImagen, { nombre: f.name }));
      }
    }
    avanzar('');
    decir(quejas.join(' '));
    pintarCuenta();
  }

  archivo.addEventListener('change', () => {
    anadir([...(archivo.files ?? [])]);
    archivo.value = '';
  });

  // Soltar fotos encima del formulario entero, no sólo del hueco: en un
  // escritorio el blanco a acertar es el diálogo, no un cuadrado de 100 px.
  const traeArchivos = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files');
  forma.addEventListener('dragover', (e) => {
    if (!traeArchivos(e)) return;
    e.preventDefault();
    hueco.classList.add('soltando');
  });
  forma.addEventListener('dragleave', (e) => {
    if (!forma.contains(e.relatedTarget as Node)) hueco.classList.remove('soltando');
  });
  forma.addEventListener('drop', (e) => {
    if (!traeArchivos(e)) return;
    e.preventDefault();
    hueco.classList.remove('soltando');
    anadir([...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/') || esHeic(f)));
  });

  descripcion.addEventListener('input', () => {
    contador.textContent = String(descripcion.value.length);
  });

  // Al tocar un campo marcado en rojo se le quita la marca: ya lo está
  // arreglando, y seguir gritándole mientras escribe no ayuda.
  forma.addEventListener('input', (e) => {
    (e.target as HTMLElement).removeAttribute?.('aria-invalid');
  });

  /** Una llamada al Worker. Los errores salen con el texto que manda él —que ya
   *  está escrito para leerlo el público— o con el de la red. */
  async function pedir<R = any>(cuerpo: Record<string, unknown>): Promise<R> {
    let res: Response;
    try {
      res = await fetch(PANEL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
    } catch {
      throw new Error(T.red);
    }
    const datos = await res.json().catch(() => ({}));
    if (!res.ok || !datos.ok) throw new Error(datos.error || T.red);
    return datos as R;
  }

  /** Una foto a Cloudinary, con su firma. XMLHttpRequest y no `fetch` por la
   *  barra de avance: subir por el wifi de una sede sin ver que avanza es lo
   *  que hace que se cierre la pestaña a la mitad. */
  function subir(elegida: Elegida, abierto: Abierto, firma: Record<string, string>): Promise<string> {
    const cuerpo = new FormData();
    cuerpo.append('file', elegida.foto, `${firma.public_id}.jpg`);
    cuerpo.append('api_key', abierto.api_key);
    for (const [k, v] of Object.entries(firma)) cuerpo.append(k, v);

    return new Promise((listo, falla) => {
      const x = new XMLHttpRequest();
      x.open('POST', `https://api.cloudinary.com/v1_1/${abierto.cloud_name}/image/upload`);
      x.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          elegida.nodo.style.setProperty('--avance', `${Math.round((e.loaded / e.total) * 100)}%`);
        }
      };
      x.onload = () => {
        try {
          const r = JSON.parse(x.responseText);
          if (x.status >= 200 && x.status < 300 && r.secure_url) {
            elegida.nodo.style.setProperty('--avance', '100%');
            listo(r.secure_url);
          } else falla(new Error(T.red));
        } catch {
          falla(new Error(T.red));
        }
      };
      x.onerror = () => falla(new Error(T.red));
      x.send(cuerpo);
    });
  }

  function marcar(nombre: string) {
    const campo = forma.querySelector<HTMLElement>(`[name="${nombre}"]`);
    campo?.setAttribute('aria-invalid', 'true');
    return campo;
  }

  function ocupar(si: boolean) {
    ocupado = si;
    mandar.disabled = si;
    forma.toggleAttribute('aria-busy', si);
    forma.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
      .forEach((c) => { c.readOnly = si; });
    archivo.disabled = si;
  }

  forma.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (ocupado) return;

    const datos = new FormData(forma);
    const texto = (k: string) => String(datos.get(k) ?? '').trim();
    const titulo = texto('titulo');
    const nombre = texto('nombre');
    const instagram = texto('instagram');

    // Lo que falta, en el orden en que está en pantalla, y el foco al primero.
    const faltas: [string, HTMLElement | null][] = [];
    if (!elegidas.length) {
      hueco.closest('fieldset')?.setAttribute('aria-invalid', 'true');
      faltas.push([T.sinFotos, archivo]);
    }
    if (!titulo) faltas.push([T.sinTitulo, marcar('titulo')]);
    if (!nombre) faltas.push([T.sinNombre, marcar('nombre')]);
    if (instagram && !cuentaValida(instagram)) faltas.push([T.cuenta, marcar('instagram')]);
    if (!datos.get('permiso')) faltas.push([T.sinPermiso, marcar('permiso')]);
    if (faltas.length) {
      decir(faltas.map(([m]) => m).join(' '));
      faltas[0][1]?.focus();
      return;
    }

    decir('');
    ocupar(true);
    try {
      const abierto = await pedir<Abierto>({ accion: 'envio-abrir', fotos: elegidas.length });
      const fotos: string[] = [];
      for (const [i, elegida] of elegidas.entries()) {
        avanzar(rellenar(T.subiendo, { n: i + 1, total: elegidas.length }));
        fotos.push(await subir(elegida, abierto, abierto.fotos[i]));
      }
      avanzar(T.guardando);
      await pedir({
        accion: 'envio-mandar',
        id: abierto.id,
        titulo,
        nombre,
        instagram,
        descripcion: String(datos.get('descripcion') ?? ''),
        permiso: true,
        fotos,
        web: texto('web'),
      });
      terminar();
    } catch (err: any) {
      elegidas.forEach((el) => el.nodo.style.removeProperty('--avance'));
      decir(err?.message || T.red);
    } finally {
      ocupar(false);
      avanzar('');
    }
  });

  function terminar() {
    forma.hidden = true;
    listo.hidden = false;
    caja.scrollTop = 0;
    listo.querySelector<HTMLElement>('[data-subir-otra]')?.focus();
  }

  function reiniciar() {
    elegidas.forEach((el) => { URL.revokeObjectURL(el.vista); el.nodo.remove(); });
    elegidas = [];
    forma.reset();
    forma.querySelectorAll('[aria-invalid]').forEach((c) => c.removeAttribute('aria-invalid'));
    contador.textContent = '0';
    decir('');
    pintarCuenta();
    forma.hidden = false;
    listo.hidden = true;
  }

  listo.querySelector('[data-subir-otra]')?.addEventListener('click', () => {
    reiniciar();
    caja.scrollTop = 0;
    archivo.focus();
  });

  // Cerrar después de mandar deja el formulario limpio para la siguiente vez.
  // Cerrar a medio llenar, no: se cerró sin querer, y al volver todo sigue ahí.
  dialogo.addEventListener('close', () => {
    if (!listo.hidden) reiniciar();
  });
}

// ── Visor ────────────────────────────────────────────────────────────────────

type EntradaVisor = {
  titulo: string;
  nombre: string;
  instagram: string | null;
  parrafos: string[];
  fotos: { src: string; srcset: string; pie: string | null }[];
};

function iniciarVisor() {
  const dialogo = document.querySelector<HTMLDialogElement>('[data-modal="visor"]');
  const bruto = document.getElementById('galeria-aportes');
  if (!dialogo || !bruto) return;

  const entradas: EntradaVisor[] = JSON.parse(bruto.textContent || '[]');
  const $ = <E extends Element>(sel: string) => dialogo.querySelector<E>(sel)!;
  const foto = $<HTMLImageElement>('[data-visor-foto]');
  const escena = $<HTMLElement>('[data-visor-escena]');
  const cuenta = $<HTMLElement>('[data-visor-cuenta]');
  const titulo = $<HTMLElement>('[data-visor-titulo]');
  const nombre = $<HTMLElement>('[data-visor-nombre]');
  const pieFoto = $<HTMLElement>('[data-visor-pie-foto]');
  const texto = $<HTMLElement>('[data-visor-texto]');
  const ig = $<HTMLAnchorElement>('[data-visor-ig]');
  const pasos = dialogo.querySelectorAll<HTMLButtonElement>('[data-visor-paso]');

  let entrada = 0;
  let cual = 0;

  const dos = (n: number) => String(n).padStart(2, '0');

  function pintarFoto() {
    const e = entradas[entrada];
    const f = e.fotos[cual];
    // Se esconde hasta que llega la nueva: si no, durante medio segundo se ve la
    // foto anterior con el número de la siguiente.
    foto.classList.add('cargando');
    foto.srcset = f.srcset;
    foto.sizes = '(min-width: 64rem) 70vw, 100vw';
    foto.src = f.src;
    foto.alt = `${e.titulo} — ${cual + 1} / ${e.fotos.length}`;
    cuenta.textContent = `${dos(cual + 1)} / ${dos(e.fotos.length)}`;
    pieFoto.textContent = f.pie ?? '';
    pieFoto.hidden = !f.pie;

    // La de al lado se pide ya: pasar de foto no tiene que esperar a la red.
    const siguiente = e.fotos[(cual + 1) % e.fotos.length];
    if (siguiente !== f) {
      const pre = new Image();
      pre.sizes = foto.sizes;
      pre.srcset = siguiente.srcset;
      pre.src = siguiente.src;
    }
  }

  foto.addEventListener('load', () => foto.classList.remove('cargando'));
  foto.addEventListener('error', () => foto.classList.remove('cargando'));

  function abrir(a: number, f: number) {
    const e = entradas[a];
    if (!e) return;
    entrada = a;
    cual = Math.min(Math.max(0, f), e.fotos.length - 1);
    titulo.textContent = e.titulo;
    nombre.textContent = e.nombre;
    texto.replaceChildren(...e.parrafos.map((p) => {
      const nodo = document.createElement('p');
      nodo.textContent = p;
      return nodo;
    }));
    ig.hidden = !e.instagram;
    if (e.instagram) {
      ig.href = `https://www.instagram.com/${e.instagram}/`;
      ig.textContent = `@${e.instagram} ↗`;
    }
    pasos.forEach((b) => { b.hidden = e.fotos.length < 2; });
    pintarFoto();
  }

  function paso(d: number) {
    const n = entradas[entrada].fotos.length;
    if (n < 2) return;
    cual = (cual + d + n) % n;
    pintarFoto();
  }

  // Quien abre el diálogo es `iniciarModales()`; esto pone la entrada y la foto
  // y frena el enlace, que sin JS es lo que abre la foto en grande.
  document.querySelectorAll<HTMLAnchorElement>('a[data-abre="visor"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      abrir(Number(a.dataset.aporte), Number(a.dataset.foto));
    }),
  );

  pasos.forEach((b) => b.addEventListener('click', () => paso(Number(b.dataset.visorPaso))));

  dialogo.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); paso(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); paso(1); }
  });

  // Deslizar el dedo sobre la foto. Sólo dedo y lápiz: con el ratón, arrastrar
  // es seleccionar, y para eso están las flechas.
  let x0: number | null = null;
  escena.addEventListener('pointerdown', (e) => {
    x0 = e.pointerType === 'mouse' ? null : e.clientX;
  });
  escena.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 40) paso(dx < 0 ? 1 : -1);
  });
  escena.addEventListener('pointercancel', () => { x0 = null; });
}

// Cada pieza por separado: si una falla, la otra sigue. Es lo mismo que hace
// `arrancar()` en `motion.ts`.
for (const iniciar of [iniciarSubida, iniciarVisor]) {
  try {
    iniciar();
  } catch (e) {
    console.error(e);
  }
}
