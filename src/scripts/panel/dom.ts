/** Cuatro ayudas para no escribir `document.createElement` doscientas veces.
 *  No es un framework y no quiere serlo: el panel son formularios y listas. */

type Hijo = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  etiqueta: K,
  props: Record<string, any> = {},
  ...hijos: Hijo[]
): HTMLElementTagNameMap[K] {
  const nodo = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') nodo.className = String(v);
    else if (k === 'html') nodo.innerHTML = String(v);
    else if (k.startsWith('on') && typeof v === 'function') {
      nodo.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (k in nodo && k !== 'list') {
      (nodo as any)[k] = v;
    } else {
      nodo.setAttribute(k, String(v));
    }
  }
  for (const h of hijos) {
    if (h === null || h === undefined || h === false) continue;
    nodo.append(typeof h === 'string' ? document.createTextNode(h) : h);
  }
  return nodo;
}

export const vaciar = (nodo: Element) => { while (nodo.firstChild) nodo.firstChild.remove(); };

/** Fechas en cristiano: «hace 2 min», «ayer 19:04». Un ISO en una barra de
 *  estado no lo lee nadie. */
export function cuando(iso: string | null | undefined): string {
  if (!iso) return 'nunca';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return 'nunca';
  const seg = Math.round((Date.now() - t.getTime()) / 1000);
  if (seg < 60) return 'hace un momento';
  if (seg < 3600) return `hace ${Math.round(seg / 60)} min`;
  const hora = t.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  if (seg < 86400) return `hace ${Math.round(seg / 3600)} h (${hora})`;
  return `${t.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} ${hora}`;
}
