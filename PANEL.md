# Panel de administración

Cómo el festival va a cargar su propio contenido sin tocar el repo.

Este documento es el plan y el estado. Lo construido se marca con ✅; lo que no,
se lee como lo que es: la decisión tomada y por qué, para no volver a discutirla
a medio camino.

**Cómo va, al 1 de septiembre de 2026:** están hechas y probadas las fases 1 a 4
—el Worker, la semilla, el sitio leyendo del panel y el panel entero—. Falta la
fase 0, que es dar de alta lo que sólo puedes dar de alta tú (ver *Lo que
necesito de ti*), y con eso queda vivo. La 5 está escrita y se enciende sola
cuando existan `GITHUB_TOKEN` y `GITHUB_REPO`.

El hosting cambió de Cloudflare Pages a GitHub Pages, y no por gusto: el dominio
no puede salir de Wix antes del festival. Está explicado en la tabla de
decisiones, y no toca nada del panel — el Worker vive en Cloudflare igual.

Sustituye a la sección «Pendiente: panel de edición» del README, que proponía
Netlify + Decap CMS. Se descarta: en `gdldenoxe.github.io` ya hay montado un
panel propio sobre Cloudflare que funciona, que El Profe ya sabe usar y que no
mete un CMS entero de dependencia para editar cinco listas.

---

## El problema

Hoy, para publicar el programa hay que abrir `src/data/site.ts` y escribir
TypeScript. Para subir una foto del archivo hay que meterla al repo y hacer
commit. Eso significa que **todo pasa por mí**, y el festival es del 24 al 27
de septiembre: la semana del festival va a haber cambios de última hora, y no
puedo ser el cuello de botella de un cambio de hora de un taller.

Lo que se necesita: que entren a una dirección, escriban una contraseña y
carguen sedes, patrocinadores, programa, artistas y archivo. Y que el sitio se
llene solo conforme se llena eso.

---

## Las cuatro decisiones

| | Qué se eligió | Por qué |
|---|---|---|
| **Actualización** | Rebuild automático | El sitio sigue siendo HTML estático. El Gantt son 1685 líneas y el Mapa 1024: reescribirlos para que rendericen en el navegador es rehacer el sitio. Guardar tarda ~60-90 s en verse publicado; para un festival de cuatro días es de sobra. |
| **Fotos** | Cloudinary, reusando la cuenta de GDN | Carpeta aparte (`cuartasilla/`). Cero trámite, cero credenciales nuevas. Un archivo de cuatro ediciones son cientos de fotos: en git se quedan para siempre y clonar el repo se vuelve lento. |
| **Permisos** | Una sola contraseña de admin | Se descarta el esquema de dos niveles de GDN. Aquí no hay una comunidad mandando material: hay un comité chico que edita y publica. Menos que explicar y menos que mantener. |
| **Hosting** | GitHub Pages | Era Cloudflare Pages, y se cambió por el dominio: se registró en Wix el 26/07/2026, ICANN no deja transferirlo hasta el 24/09 —el día que arranca el festival— y Wix no deja cambiar los nameservers. Cloudflare Pages no puede servir el dominio raíz con el DNS fuera de Cloudflare; GitHub Pages sí, con registros A. Se paga con las redirecciones viejas en `<meta refresh>` en vez de 301. Cuando el dominio salga de Wix se puede revisar: `public/_redirects` ya está escrito. |

---

## Cómo queda

```
            ┌─────────────────────────────────────────┐
            │  /admin  (página del propio sitio)      │
            │  contraseña · 5 pestañas · arrastrar    │
            └──────────────┬──────────────────────────┘
                           │ fetch autenticado
                           ▼
   ┌───────────────────────────────────────────────────────┐
   │  Worker  cuartasilla-panel   (Cloudflare)             │
   │                                                       │
   │   · valida la contraseña (hash, nunca en claro)       │
   │   · VALIDA EL CONTENIDO antes de guardarlo            │
   │   · guarda en KV            ──────────► KV CONTENIDO  │
   │   · firma las subidas       ──────────► Cloudinary    │
   │   · dispara el rebuild      ──────────► CF Pages hook │
   └───────────────────────────────────────────────────────┘
                           │ GET /contenido (público)
                           ▼
   ┌───────────────────────────────────────────────────────┐
   │  Build de Astro                                       │
   │   scripts/instantanea.mjs  →  src/data/contenido.json │
   │   astro build              →  dist/                   │
   └───────────────────────────────────────────────────────┘
```

Cuatro piezas y ninguna base de datos que administrar. KV y Cloudinary en
plan gratis aguantan esto con muchísimo margen.

---

## Qué se mueve al panel y qué NO

Esto es lo que más importa del plan, porque es lo que evita que el panel se
convierta en un editor de sitio web mal hecho.

**Se mueve al panel** — lo que cambia solo, lo que el festival sabe y yo no:

| Colección | Sale hoy de | Qué edita |
|---|---|---|
| **Sedes** | `site.ts › sedes.lista` | nombre, dirección, coordenada, instagram, pin de Google |
| **Programa** | `site.ts › actividades` | las barras del Gantt: título, día, inicio, fin, sede, tipo, artista, formulario de registro |
| **Artistas** | `artistas.ts › lista` | nombre, disciplina, foto, instagram, sede |
| **Archivo** | `archivo.ts › lista` | ediciones anteriores y sus fotos con pie |
| **Marcas** | `site.ts › patrocinadores` + `colaboradores` | nombre, logo, enlace |

**NO se mueve** — esto es el sitio, no contenido:

- El manifiesto, los textos de cada sección, los estados vacíos, el aviso de
  privacidad, las etiquetas de la cuenta regresiva.
- La barra de navegación, las redirecciones, el sitemap.
- Los colores del Gantt, la tipografía, el movimiento.

Un panel que deja editar el manifiesto acaba con el manifiesto roto. Si hay
que cambiar copy, es un commit — y es correcto que lo sea.

Consecuencia práctica: `site.ts` **no desaparece**. Se queda con todo el texto
y pierde sólo las cinco listas, que pasan a llegar de fuera.

---

## El modelo de datos

Una clave de KV por colección. Sin `join`s, sin ids autoincrementales donde no
hacen falta: son listas de menos de cien elementos y se guardan enteras.

```
cs:col:sedes           Sede[]
cs:col:programa        { actividades: ActividadGantt[] }
cs:col:artistas        Artista[]
cs:col:archivo         Edicion[]
cs:col:marcas          { patrocinadores: Marca[], colaboradores: Marca[] }

cs:meta                { version, actualizado, ultimoDeploy }
cs:hist:<version>      instantánea completa (se conservan las últimas 20)
cs:build               marca de tiempo del último rebuild disparado
```

Los tipos son **exactamente** los que ya están en `src/data/*.ts`. No se
inventa un esquema nuevo: `Sede`, `ActividadGantt`, `Artista`, `Edicion`,
`Foto` y `Marca` son el contrato, ya están tipados y ya están comentados campo
por campo. Esa documentación se convierte, casi literal, en la ayuda que sale
al lado de cada campo del panel.

---

## El Worker

`workers/panel/` en este mismo repo, desplegado con `wrangler deploy`.

### Lecturas públicas (GET, abiertas)

```
GET /contenido              todo, en un solo fetch — es lo que consume el build
GET /contenido/<coleccion>  una sola
```

### Escrituras (POST JSON, origen restringido, contraseña)

```
ping         probar la contraseña
guardar      { coleccion, datos }  → valida, guarda, versiona
firmar       { carpeta, content_type } → parámetros firmados de Cloudinary
medios       { carpeta } → lo que ya hay subido, para reusarlo
borrar-medio { public_id } → sólo dentro de cuartasilla/
publicar     dispara el rebuild a mano
historial    las últimas 20 versiones
restaurar    { version } → vuelve atrás
```

### La validación es la mitad del trabajo

El Worker **no guarda lo que rompería el build**. Esto no es un lujo: hoy
`site.ts` termina con un bloque que revienta la construcción si una actividad
nombra una sede que no existe —ya pasó, con «Taller Industria Grafica» sin
tilde—. Ese `throw` es correcto mientras el dato lo escribo yo y veo el error
en la consola; el día que el dato lo escribe El Profe desde el panel, ese mismo
`throw` significa que **el sitio deja de poder desplegarse** y él no se entera.

Se invierte: la puerta se cierra al entrar, no al salir.

- `sede` de cada actividad tiene que existir en sedes → si no, 400 con el
  «¿querías decir…?» (se reusa el mismo `pelar()` que ya está escrito).
- Horas en `HH:MM`, y `fin` posterior a `inicio`.
- `dia` entre 0 y 3; `tipo` uno de los cuatro.
- Enlaces (instagram, registro, mapa): `https://` o nada.
- Coordenadas numéricas; fuera del centro de GDL **avisa pero deja pasar**,
  porque hay sedes que legítimamente no están ahí.
- Longitudes máximas en todo campo de texto.

Y el bloque de `site.ts` se queda, pero cuando el dato llega del panel **avisa
en vez de reventar**: si algo se coló, la actividad sale sin dirección —que es
feo— en lugar de tumbar el despliegue —que es peor.

### Seguridad

Se copia tal cual lo que ya funciona en GDN, que es lo sensato:

- La contraseña nunca viaja ni se guarda: se compara el SHA-256 contra un
  secret del Worker.
- Cinco intentos fallidos dejan a esa IP fuera 15 minutos (`fail:<ip>` en KV).
  Sin esto, adivinar una contraseña es dejar un script corriendo.
- CORS con lista blanca de orígenes; todo lo demás, 403.
- Las credenciales de Cloudinary **nunca salen del Worker**: el navegador
  recibe una firma para una carpeta concreta, no la llave.
- Borrar sólo funciona dentro de `cuartasilla/`. Sin ese cerrojo, la
  contraseña del panel del festival podría borrar el archivo de GDN, que vive
  en la misma cuenta de Cloudinary.
- La sesión del panel vive en `sessionStorage`, no en `localStorage`: se cierra
  al cerrar la pestaña.

`/admin` es una página pública del sitio y eso se asume: `noindex`, fuera del
sitemap, fuera de la barra de navegación y `Disallow` en `robots.txt`. Lo que
la protege es la contraseña y el bloqueo por intentos, no que esté escondida.

---

## Las fotos

Carpetas en Cloudinary, dentro de la cuenta que ya existe:

```
cuartasilla/artistas/<slug>          retratos, 4:5
cuartasilla/archivo/<anio>/          las ediciones anteriores, 4:3
cuartasilla/marcas/                  logos de patrocinadores y colaboradores
cuartasilla/sedes/                   por si algún día las sedes llevan foto
```

`src/lib/imagen.ts` ya está escrito para este día: hoy devuelve la ruta local
y encenderlo es **rellenar una constante**. Ninguna plantilla se entera. Las
fotos llegan al navegador ya redimensionadas y en AVIF o WebP según lo que
soporte, que es lo que hace que una página de archivo con cien fotos no pese
cien megas.

Las fotos que ya están en `public/` (los logos de patrocinadores) se quedan
donde están: funcionan, y `imagen()` las deja pasar intactas.

---

## Cómo lo lee el sitio

Astro construye una vez y sirve HTML. El contenido entra en el build:

1. `scripts/instantanea.mjs` pide `GET /contenido` al Worker y escribe
   `src/data/contenido.json`.
2. `astro build` construye con eso.

Y encima, **`src/data/contenido.json` está comiteado en el repo**. Eso hace
tres cosas de un tiro:

- Si el Worker no contesta, el build no falla: usa el último JSON bueno. El
  sitio nunca se cae por culpa del panel.
- El repo tiene siempre el contenido en texto plano, legible en un diff.
- El histórico de git **es** el histórico del contenido, gratis.

Una acción de GitHub nocturna vuelve a bajarlo y lo comitea si cambió. Es el
mismo patrón de `update-manifest.yml` en GDN, y ahí lleva meses funcionando.

Los archivos `site.ts`, `artistas.ts` y `archivo.ts` conservan sus tipos, sus
comentarios y todo su texto; las cinco listas pasan a leerse de la instantánea.
**Las páginas y los componentes no se tocan**: siguen importando `sedes`,
`actividades`, `artistas` y `archivo` de donde siempre.

---

## El panel

Una página, `/admin`, con la identidad del festival —Anton, Courier, rojo y
amarillo— y no un formulario de Bootstrap. Es una herramienta que van a usar
cuatro días seguidos a las once de la noche: que se vea del festival no es
decoración, es que se entienda de un vistazo dónde estás.

No usa el layout del sitio: nada de Lenis, ni cortinas, ni portada. Layout
propio, denso, de teclado.

**Cinco pestañas**, una por colección. Cada una:

- Tabla editable, una fila por elemento.
- Arrastrar para reordenar. El orden importa y no es alfabético: las sedes van
  en el orden en que nos las pasaron y así se pintan.
- Subir imagen arrastrándola encima (va firmada a Cloudinary, con barra de
  progreso).
- Duplicar una fila — el 80% de una actividad nueva es la anterior con otra
  hora.
- Deshacer antes de guardar, y `Cmd+S` para guardar.

**La pestaña de Programa es la que se lleva el cariño**, porque es la que se va
a usar de verdad: además de la tabla, la rejilla en chiquito, para ver de un
golpe si dos cosas se encimaron en la misma sede o si un día quedó vacío. Eso
es lo que una hoja de cálculo no te dice. Lo que se encima sale con un canto
rojo y contado en la leyenda.

Ahí vive también el interruptor **«esto todavía es la rejilla de ejemplo»**, que
es lo que enciende y apaga el aviso al pie del programa en el sitio. Es una
declaración y no un dato, y por eso se pregunta en vez de deducirse: sembrar el
panel con los eventos de mentira también es «usar el panel», así que atarlo a
eso lo habría apagado el primer día con el andamio todavía puesto. Quien mira la
rejilla es el único que sabe si eso ya es el programa.

**Barra de estado permanente**: versión, cuándo se guardó por última vez, si
hay un rebuild en curso y un enlace a ver el sitio.

---

## Publicar

Guardar y publicar son dos cosas distintas, y el panel lo dice:

- **Guardar** escribe en KV. Instantáneo. El panel ya muestra lo nuevo.
- **Publicar** dispara el hook de Cloudflare Pages → build → sitio actualizado
  en ~60-90 s.

Se dispara solo al guardar, con un freno de 60 s en KV: si alguien corrige diez
renglones seguidos, no se lanzan diez builds. Y hay un botón «Publicar ahora»
explícito, porque el día del festival quieres poder forzarlo y ver la barra
moverse.

---

## Respaldos y deshacer

- Cada guardado deja una instantánea `cs:hist:<version>`; se conservan 20.
  «Historial» las lista y «Restaurar» vuelve a cualquiera. Un panel sin
  deshacer es un panel que da miedo usar, y un panel que da miedo no se usa.
- Respaldo semanal por cron a Cloudinary, igual que GDN.
- Y el `contenido.json` comiteado, que es el respaldo que sobrevive incluso a
  que se borre la cuenta de Cloudflare.

Tres copias en tres sitios distintos. Es contenido que no se puede volver a
juntar: las fotos de tres ediciones anteriores no las tiene nadie más.

---

## Fases

| | Qué | Estado |
|---|---|---|
| **0** | Dar de alta: KV, secrets del Worker, token de GitHub, DNS del dominio | **Te toca** — comandos en [`workers/panel/README.md`](workers/panel/README.md) |
| **1** | El Worker: rutas, validación, Cloudinary, historial, hook | ✅ `workers/panel/` |
| **2** | Semilla: volcar a KV lo que hoy está en los `.ts` | ✅ `workers/panel/semilla.mjs` |
| **3** | El sitio lee del panel | ✅ `scripts/instantanea.mjs` + `src/data/contenido.{ts,json}` |
| **4** | El panel `/admin` | ✅ `src/pages/admin/` + `src/scripts/panel/` |
| **5** | Rebuild automático + respaldo comiteado | ✅ escrito; el rebuild se enciende al poner `GITHUB_TOKEN` y `GITHUB_REPO` |
| **6** | Extras: papelera, refresco en vivo de `/programa` | — |

El historial y la vista previa del programa, que estaban apuntados como extras
de la fase 6, acabaron entrando en la 4: los dos son de las cosas que deciden si
el panel se usa o se le tiene miedo, y eso no se deja para después.

### Probado contra un Worker de verdad

No es «debería funcionar». Corriendo `wrangler dev` en local y el sitio contra
él, se comprobó de punta a punta: sembrar las 14 sedes y las 19 actividades,
entrar con la contraseña, editar, guardar, el rechazo de una sede sin tilde con
el «¿querías decir…?» pintado en la casilla exacta de la fila exacta, el 401 con
la contraseña mala, el 403 desde un origen ajeno, el cerrojo que impide borrar
fuera de `cuartasilla/`, y el build del sitio bajando el contenido y también
aguantando que el Worker no conteste.

```bash
# el Worker en local, con KV simulado
cd workers/panel && npx wrangler dev --port 8787

# el sitio apuntando a ese Worker
PUBLIC_PANEL_URL=http://localhost:8787 npm run dev
```

Las fases 1 a 4 no dependen del dominio ni del hosting: se pueden montar y
probar contra la vista previa de GitHub Pages, y el día que el dominio se mueva
a Cloudflare Pages sólo cambia una constante de origen permitido.

Eso corrige el «el orden importa» del README viejo, que decía que primero iba
el dominio. Era cierto para Netlify + Decap, que se atan al hosting. Este panel
no: vive en su Worker y le da igual dónde esté el sitio.

---

## Lo que necesito de ti

Nada de esto lo puedo hacer yo, y es a propósito:

1. **La contraseña de admin.** La eliges tú y la conviertes en hash; el hash es
   lo único que se guarda. Que no sea la de GDN.
2. **Crear el namespace de KV** y pegar su id en `wrangler.toml`.
3. **Los secrets de Cloudinary** en el Worker nuevo (son los mismos cuatro
   valores que ya tiene el de GDN), y un preset **firmado** en Cloudinary.
4. **Un token de GitHub** con permiso de escritura sobre el repo, que es lo que
   dispara el build de `publicar.yml` al guardar. Sin él todo lo demás funciona:
   se guarda, y el sitio se actualiza en el siguiente build. El panel lo dice con
   todas sus letras en vez de fingir que publicó.
5. **El DNS del dominio, en Wix** — los registros A del dominio raíz a las
   cuatro IPs de GitHub Pages y el CNAME de `www`. Los MX no se tocan: el correo
   del festival es de Google y sigue vivo donde está.

Los comandos exactos, uno por uno, están en
[`workers/panel/README.md`](workers/panel/README.md).

---

## Riesgos, dichos de frente

- **`/admin` es público.** Lo protege una contraseña y un bloqueo por intentos.
  Es la misma postura que GDN y lleva meses aguantando. Si algún día hay que
  subir el nivel, se le pone Cloudflare Access delante y se acabó.
- **Un dato malo puede afear el sitio**, aunque ya no pueda tumbarlo. Una
  actividad con la sede mal escrita se pintará sin dirección. Es el precio de
  no reventar el build, y es el precio correcto.
- **La cuenta de Cloudinary es compartida con GDN.** Mitigado con el cerrojo de
  carpeta al borrar. Si algún día se separan los proyectos, hay que migrar
  assets: es un script, no un drama.
- **90 segundos de retraso** entre publicar y verlo. Si en la semana del
  festival resulta insoportable, la fase 6 puede refrescar `/programa` en vivo
  desde el navegador sin tocar el resto del sitio.
