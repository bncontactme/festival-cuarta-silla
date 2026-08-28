#!/usr/bin/env python3
"""
Dibuja el plano de Guadalajara que usa el mapa de sedes — y lo deja escrito
en `src/data/mapa.ts`.

Por qué un plano propio y no un mapa de terceros: el iframe de Google que
había antes enseñaba una sede a la vez, pintaba el mapa con la paleta de
Google encima de una sección que es negra y amarilla, y metía una petición
a un tercero en la portada. Aquí las catorce se ven juntas, el dibujo se
hereda de la identidad del festival y no sale del sitio ni un byte.

De dónde salen los datos: OpenStreetMap, vía Overpass. Se bajan las calles,
los parques y las plazas del recuadro que cubre las sedes, se proyectan a las
unidades del SVG, se simplifican con Douglas–Peucker y se escriben como cuatro
caminos —uno por capa— dentro de un módulo de TypeScript. El navegador no
pide nada: el plano viaja en el HTML.

    python3 scripts/plano.py

Tarda un minuto (Overpass es lento a ratos) y sólo hay que volver a correrlo
si cambia el encuadre o si se quiere refrescar el callejero. La licencia de
los datos es ODbL: el crédito a OpenStreetMap va a la vista, en el pie del
mapa.
"""

import json
import math
import urllib.parse
import urllib.request

# ── Encuadre ─────────────────────────────────────────────────────────────
# El recuadro que se le pide a Overpass es más ancho que lo que se ve: el
# sobrante es lo que rellena los márgenes cuando la caja del mapa es más
# cuadrada que el dibujo, y lo que queda por descubrir al arrastrar.
BBOX = (20.6675, -103.3715, 20.6865, -103.3430)

# Las sedes con coordenada, tal y como están en `src/data/site.ts`. Aquí sólo
# sirven para encuadrar: el dibujo tiene que caber alrededor de todas ellas.
SEDES = [
    (20.678024, -103.357493),  # Cuerpos Parlante
    (20.681676, -103.348404),  # Foro AM
    (20.675938, -103.350449),  # Temporal
    (20.674647, -103.357670),  # Estudio Arrechiga
    (20.679379, -103.354601),  # Casa Dos Guayabos
    (20.679340, -103.356823),  # Taller Industria Gráfica
    (20.674100, -103.358570),  # No Museo — andador Palestina Libre
    (20.681953, -103.348427),  # Casa Feria
    (20.678578, -103.354777),  # Ala Rota
    (20.674168, -103.357894),  # Staditche
    (20.678963, -103.347828),  # Estallido Art Project
    (20.678033, -103.354007),  # Salón Liminal
    (20.672186, -103.357879),  # Ánima Galería
    (20.673916, -103.366453),  # Palma Galería
]

ANCHO, ALTO = 1000.0, 720.0   # unidades del viewBox
PAD = 1.16                    # aire alrededor de la sede más extrema
EPS = 0.45                    # simplificación, en unidades (≈ 1 m)
SALIDA = "src/data/mapa.ts"

OVERPASS = "https://overpass-api.de/api/interpreter"
UA = "cuartasilla-plano/1.0 (mapa de sedes del Festival de Arte Conceptual)"

CALLES = """
[out:json][timeout:180];
(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian)$"](%s););
out geom;
"""
VERDE = """
[out:json][timeout:180];
(
  way["leisure"~"^(park|garden)$"](%s);
  way["landuse"~"^(grass|cemetery)$"](%s);
  way["place"="square"](%s);
);
out geom;
"""


def overpass(consulta: str) -> list:
    datos = urllib.parse.urlencode({"data": consulta}).encode()
    pet = urllib.request.Request(OVERPASS, data=datos, headers={"User-Agent": UA})
    with urllib.request.urlopen(pet, timeout=300) as r:
        return json.load(r)["elements"]


# ── Proyección ───────────────────────────────────────────────────────────
# Equirectangular centrada en las sedes: a dos kilómetros de lado la
# diferencia con Mercator es de centímetros, y así la fórmula cabe en una
# línea tanto aquí como en el componente.
lats = [s[0] for s in SEDES]
lons = [s[1] for s in SEDES]
LAT0 = (min(lats) + max(lats)) / 2
LON0 = (min(lons) + max(lons)) / 2
COS = math.cos(math.radians(LAT0))

ancho_geo = (max(lons) - min(lons)) * COS * PAD
alto_geo = ancho_geo * ALTO / ANCHO
alto_min = (max(lats) - min(lats)) * PAD
if alto_geo < alto_min:            # el encuadre nunca recorta una sede
    alto_geo = alto_min
    ancho_geo = alto_geo * ANCHO / ALTO
ESCALA = ANCHO / ancho_geo         # unidades de SVG por grado de latitud


def proy(lat: float, lon: float) -> tuple[float, float]:
    return ((lon - LON0) * COS * ESCALA + ANCHO / 2,
            (LAT0 - lat) * ESCALA + ALTO / 2)


def fmt(v: float) -> str:
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s


# ── Simplificación ───────────────────────────────────────────────────────
def dp(pts: list, eps: float) -> list:
    """Douglas–Peucker. Cuatro mil vértices bajan a la mitad sin que se note:
    a esta escala una unidad son dos metros y pico."""
    if len(pts) < 3:
        return pts
    (x0, y0), (x1, y1) = pts[0], pts[-1]
    dx, dy = x1 - x0, y1 - y0
    den = math.hypot(dx, dy)
    peor, idx = 0.0, 0
    for i in range(1, len(pts) - 1):
        x, y = pts[i]
        d = (abs(dy * x - dx * y + x1 * y0 - y1 * x0) / den) if den else math.hypot(x - x0, y - y0)
        if d > peor:
            peor, idx = d, i
    if peor > eps:
        return dp(pts[:idx + 1], eps)[:-1] + dp(pts[idx:], eps)
    return [pts[0], pts[-1]]


def camino(geom: list, cerrar: bool = False) -> str:
    pts = dp([proy(p["lat"], p["lon"]) for p in geom], EPS)
    if len(pts) < 2:
        return ""
    if cerrar:
        # Todos los anillos en el mismo sentido: con `fill-rule` por defecto,
        # un parque dentro de otro se restaría y saldría un agujero.
        area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1]))
        if area < 0:
            pts.reverse()
    d = "M" + " ".join(f"{fmt(x)} {fmt(y)}" for x, y in pts)
    return d + "Z" if cerrar else d


# ── Rótulos de calle ─────────────────────────────────────────────────────
ABREVIA = [
    ("Avenida ", "Av. "), ("Calzada ", "Calz. "), ("Calle ", ""),
    ("Miguel Hidalgo y Costilla", "Hidalgo"),
    ("Enrique Díaz de León", "Díaz de León"),
    ("Fray Antonio Alcalde", "Alcalde"),
    ("Manuel López Cotilla", "López Cotilla"),
    (" Norte", ""), (" Sur", ""),
]


def abrevia(nombre: str) -> str:
    for a, b in ABREVIA:
        nombre = nombre.replace(a, b)
    return nombre.strip().upper()


def rotulos(vias: list) -> list:
    """Un nombre por calle, tumbado sobre ella y en su ángulo.

    No es cartografía: son ocho o diez anclas para saber dónde estás. Se
    quedan las más largas, sin repetir nombre y sin pisarse entre ellas."""
    cands = []
    for w in vias:
        tipo = w["tags"].get("highway")
        nombre = w["tags"].get("name")
        if tipo not in ("motorway", "trunk", "primary", "secondary", "tertiary") or not nombre:
            continue
        pts = [proy(p["lat"], p["lon"]) for p in w.get("geometry", [])]
        if len(pts) < 2:
            continue
        total = sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))
        if total < 60:
            continue

        acum = 0.0
        for i, (a, b) in enumerate(zip(pts, pts[1:])):   # el punto medio real
            paso = math.dist(a, b)
            if acum + paso >= total / 2:
                t = (total / 2 - acum) / paso if paso else 0
                x, y = a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])
                break
            acum += paso
        if not (30 <= x <= ANCHO - 30 and 24 <= y <= ALTO - 24):
            continue

        def desplaza(idx, signo):
            j, resto, p = idx, 40.0, (x, y)
            while 0 <= j < len(pts) - 1:
                q = pts[j + 1] if signo > 0 else pts[j]
                paso = math.dist(p, q)
                if paso >= resto:
                    t = resto / paso
                    return (p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1]))
                resto -= paso
                p = q
                j += signo
            return p

        # El ángulo se toma a cuarenta unidades a cada lado y no del segmento
        # de al lado: en una esquina, el segmento suelto tumba el rótulo.
        a2, b2 = desplaza(i, -1), desplaza(i, 1)
        giro = math.degrees(math.atan2(b2[1] - a2[1], b2[0] - a2[0]))
        giro = giro - 180 if giro > 90 else giro + 180 if giro < -90 else giro
        peso = total * (1.6 if tipo in ("motorway", "trunk", "primary", "secondary") else 1.0)
        cands.append((peso, {"texto": abrevia(nombre), "x": round(x, 1),
                             "y": round(y, 1), "giro": round(giro, 1)}))

    cands.sort(key=lambda c: -c[0])
    elegidos, vistos = [], set()
    for _, c in cands:
        if c["texto"] in vistos:
            continue
        if any(math.dist((c["x"], c["y"]), (e["x"], e["y"])) < 130 for e in elegidos):
            continue
        vistos.add(c["texto"])
        elegidos.append(c)
        if len(elegidos) == 12:
            break
    return elegidos


# ── A trabajar ───────────────────────────────────────────────────────────
def main() -> None:
    caja = ",".join(str(v) for v in BBOX)
    print("· pidiendo calles a Overpass…")
    vias = overpass(CALLES % caja)
    print(f"  {len(vias)} trazos")
    print("· pidiendo parques y plazas…")
    verde = overpass(VERDE % (caja, caja, caja))
    print(f"  {len(verde)} polígonos")

    capas = {
        "vias": {"motorway", "trunk", "primary", "secondary"},
        "calles": {"tertiary", "residential", "unclassified", "living_street"},
        "peatonal": {"pedestrian"},
    }
    trazos = {capa: [] for capa in capas}
    for w in vias:
        tipo = w["tags"].get("highway")
        for capa, tipos in capas.items():
            if tipo in tipos:
                d = camino(w.get("geometry", []))
                if d:
                    trazos[capa].append(d)

    # Por debajo de un par de canchas de tenis no se distingue del ruido: son
    # parterres y camellones que sólo ensucian el dibujo y engordan el módulo.
    poligonos = []
    for w in verde:
        pts = [proy(p["lat"], p["lon"]) for p in w.get("geometry", [])]
        if len(pts) < 4:
            continue
        area = abs(sum(a[0] * b[1] - b[0] * a[1]
                       for a, b in zip(pts, pts[1:] + pts[:1]))) / 2
        if area < 60:                      # ≈ 300 m²
            continue
        d = camino(w.get("geometry", []), cerrar=True)
        if d:
            poligonos.append(d)

    # Hasta dónde llega el dibujo: es el tope del arrastre, para que nadie se
    # salga del papel.
    xs, ys = [], []
    for w in vias:
        for p in w.get("geometry", []):
            x, y = proy(p["lat"], p["lon"])
            xs.append(x)
            ys.append(y)
    limites = [round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys))]

    rot = "\n    ".join(
        "{ texto: %r, x: %r, y: %r, giro: %r }," % (r["texto"], r["x"], r["y"], r["giro"])
        for r in rotulos(vias))

    ts = f'''/**
 * El plano de Guadalajara sobre el que se clavan las sedes.
 *
 * GENERADO POR `scripts/plano.py` — no se edita a mano. Son las calles, las
 * plazas y los parques de OpenStreetMap proyectados a las unidades del SVG y
 * simplificados; cada capa es un solo `path` con muchos trazos dentro, que es
 * la diferencia entre setecientos nodos en el DOM y cuatro.
 *
 * Datos © colaboradores de OpenStreetMap (ODbL). El crédito va a la vista en
 * el pie del mapa, como pide la licencia.
 */

export const plano = {{
  /** El viewBox. El dibujo se sale de él por los cuatro costados a
   *  propósito: eso es lo que rellena la caja sea cual sea su proporción. */
  ancho: {ANCHO:.0f},
  alto: {ALTO:.0f},

  /** Centro geográfico del encuadre y escala de la proyección. */
  centro: {{ lat: {LAT0!r}, lon: {LON0!r} }},
  cos: {COS!r},
  escala: {ESCALA!r},

  /** Un grado de latitud son 111 320 m; de ahí sale cuánto mide una unidad,
   *  que es lo que necesita la barra de escala. */
  metrosPorUnidad: {111320 / ESCALA!r},

  /** Extensión real de lo dibujado: el tope del arrastre. */
  limites: {{ x0: {limites[0]}, y0: {limites[1]}, x1: {limites[2]}, y1: {limites[3]} }},

  /** Avenidas: las gordas, las que se leen a lo lejos. */
  vias: '{" ".join(trazos["vias"])}',

  /** El damero: calles de barrio. Es la textura del centro. */
  calles: '{" ".join(trazos["calles"])}',

  /** Andadores y calles peatonales. */
  peatonal: '{" ".join(trazos["peatonal"])}',

  /** Parques, jardines y plazas, en relleno. */
  verde: '{" ".join(poligonos)}',

  /** Anclas para orientarse: el nombre tumbado encima de la calle. */
  rotulos: [
    {rot}
  ],
}} as const;

/** De coordenadas del mundo a coordenadas del dibujo. */
export const proyecta = (lat: number, lon: number) => ({{
  x: (lon - plano.centro.lon) * plano.cos * plano.escala + plano.ancho / 2,
  y: (plano.centro.lat - lat) * plano.escala + plano.alto / 2,
}});
'''
    with open(SALIDA, "w", encoding="utf-8") as f:
        f.write(ts)
    peso = len(ts.encode()) / 1024
    print(f"· escrito {SALIDA} — {peso:.1f} KB")


if __name__ == "__main__":
    main()
