/**
 * MAQUETA — datos de apoyo para probar «las actividades de cada sede».
 *
 * Todo lo de `src/pages/mock/` es desechable: se borra entero antes de
 * fusionar. Lo que sobreviva de aquí se muda a `src/data/site.ts`, junto a
 * `agendaPorDia`, que es la misma idea leída por el otro lado.
 *
 * El guion bajo del nombre es lo que impide que Astro le abra una ruta.
 */
import { actividades, programa, sedes, enTodasLasSedes } from '../../data/site';
import { aplanar } from '../../lib/texto';
import type { ActividadGantt, Sede } from '../../data/tipos';

export type DiaDeSede = {
  indice: number;
  dia: string;
  fecha: string;
  /** «Vie 25 sep»: lo que cabe en una lista dentro de una tarjeta. */
  corto: string;
  actividades: ActividadGantt[];
};

export type AgendaDeSede = {
  sede: Sede;
  ruta: string;
  total: number;
  /** Sólo los días con algo. Un día vacío dentro de una sede es ruido. */
  dias: DiaDeSede[];
};

const corto = (i: number) =>
  `${programa.dias[i].dia.slice(0, 3)} ${programa.dias[i].fecha.replace(' de septiembre', ' sep')}`;

/** El trozo de URL de una sede. Sólo lo usa la maqueta B. */
export const rutaDeSede = (nombre: string) =>
  `/sedes/${aplanar(nombre).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

/**
 * Lo que pasa en una sede, por días y en orden de reloj.
 *
 * Empareja por nombre exacto, igual que `sedeDe()`: la red de seguridad del
 * final de `site.ts` ya revienta el build si una actividad apunta a una sede
 * que no existe, así que aquí no hace falta volver a dudar.
 */
export const agendaDeSede = (sede: Sede): AgendaDeSede => {
  const mias = actividades
    .filter((a) => a.sede === sede.nombre)
    .sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio));

  return {
    sede,
    ruta: rutaDeSede(sede.nombre),
    total: mias.length,
    dias: programa.dias
      .map((d, i) => ({
        ...d,
        indice: i,
        corto: corto(i),
        actividades: mias.filter((a) => a.dia === i),
      }))
      .filter((d) => d.actividades.length > 0),
  };
};

export const agendaPorSede: AgendaDeSede[] = sedes.lista.map(agendaDeSede);

/**
 * Los recorridos: las actividades que no son de ninguna sede porque pasan por
 * todas. No se suman a la cuenta de nadie —serían una actividad de más en las
 * dieciséis— pero se dicen una vez, aparte, donde se está mirando una sede.
 */
export const recorridos = actividades
  .filter((a) => enTodasLasSedes(a.sede))
  .sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio));

/** «Sáb 26 sep · 10:00–18:00», para la línea de los recorridos. */
export const cuandoRecorrido = (a: ActividadGantt) =>
  `${corto(a.dia)} · ${a.inicio}–${a.fin}`;

/** «6 actividades · Vie · Sáb · Dom» — la línea que va en la tarjeta. */
export const resumenDeSede = (agenda: AgendaDeSede) =>
  agenda.total === 0
    ? null
    : `${agenda.total} ${agenda.total === 1 ? 'actividad' : 'actividades'} · ${agenda.dias
        .map((d) => d.dia.slice(0, 3))
        .join(' · ')}`;
