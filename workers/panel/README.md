# `cuartasilla-panel`

El Worker que guarda el contenido del festival. Lo edita `/admin` del sitio y lo
lee el build de Astro.

El plan entero, con el porqué de cada pieza, está en [`PANEL.md`](../../PANEL.md).
Esto son los comandos.

---

## Alta (una vez)

Todo esto se corre desde esta carpeta y con la cuenta de Cloudflare de siempre
(la misma de Guadalajara de Noche).

```bash
cd workers/panel
npx wrangler login          # si no lo estabas ya
```

### 1. El almacén

```bash
npx wrangler kv namespace create CONTENIDO
```

Pega el `id` que imprime en `wrangler.toml`, donde dice `PEGAR_AQUI_EL_ID_DE_KV`.

### 2. La contraseña

Se elige una, se le saca el SHA-256, y **sólo el hash** viaja a Cloudflare. La
contraseña en claro no se guarda en ningún sitio: si se pierde, se pone otra.

```bash
printf 'la-contraseña-que-elijas' | shasum -a 256
npx wrangler secret put ADMIN_HASH        # y se pega el hash de arriba
```

Que no sea la misma de GDN. Son dos archivos distintos y dos grupos de gente
distintos.

### 3. Cloudinary

Los mismos cuatro valores que ya tiene el Worker de GDN — es la misma cuenta,
sólo cambia la carpeta (`cuartasilla/`).

```bash
npx wrangler secret put CLOUDINARY_CLOUD_NAME
npx wrangler secret put CLOUDINARY_API_KEY
npx wrangler secret put CLOUDINARY_API_SECRET
npx wrangler secret put CLOUDINARY_UPLOAD_PRESET
```

En el panel de Cloudinary hace falta un preset **firmado** llamado como lo que
pusiste ahí (p. ej. `cuartasilla_signed`). Firmado, no `unsigned`: lo que hace
que el secreto no salga nunca del Worker es justamente eso.

### 4. Publicar el sitio al guardar (opcional, y va al final)

El sitio vive en GitHub Pages y se publica con un `repository_dispatch` contra
`.github/workflows/publicar.yml`. Hacen falta dos: un token de GitHub con
permiso de escritura sobre el repo (uno *fine-grained* con el permiso
**Contents: read and write** sobre `festival-cuarta-silla` basta) y el nombre
del repo.

```bash
npx wrangler secret put GITHUB_TOKEN
```

```bash
npx wrangler secret put GITHUB_REPO     # bncontactme/festival-cuarta-silla
```

El día que el sitio se mude a Cloudflare Pages —cuando el dominio salga de Wix,
ver `publicar.yml`— se crea allá un *Deploy hook* y se pone su URL en
`DEPLOY_HOOK`; si están los de GitHub, ganan ellos.

Sin ninguno de estos secrets todo lo demás funciona igual: se guarda, y el sitio
se actualiza en el siguiente build. El panel lo dice con todas sus letras en vez
de fingir que publicó.

### 5. Desplegar y sembrar

```bash
npx wrangler deploy
cd ../..
CLAVE='la-contraseña-que-elegiste' node workers/panel/semilla.mjs
```

La semilla sube lo que hoy está en `src/data/contenido.json`, que salió de los
`.ts` del sitio: las 14 sedes, la rejilla de ejemplo y las 18 marcas. Pasa por
la misma validación que usará el panel, así que si algo no cuadra sale ahí.

### 6. Instagram → Galería (opcional, y se puede hacer cuando sea)

Con esto `/galeria` se llena sola con lo que publica
[@festivaldearteconceptual](https://www.instagram.com/festivaldearteconceptual/):
el Worker mira la cuenta cada cuarto de hora, copia a Cloudinary la portada de
cada publicación nueva y reconstruye el sitio. Sin esto no pasa nada: la
galería enseña su ficha de «Todavía no hay fotos» con un botón a Instagram.

Lo único que hace falta es un **token de larga duración de la cuenta**, de la
API de Instagram con inicio de sesión de Instagram. Los nombres de los menús de
Meta cambian seguido; lo que se busca es eso.

1. **La cuenta tiene que ser profesional** (de empresa o de creador). En la app
   de Instagram: Configuración → Tipo de cuenta y herramientas → Cambiar a
   cuenta profesional. Es gratis, se puede deshacer y no toca nada de lo
   publicado.
2. En [developers.facebook.com](https://developers.facebook.com/apps) → Crear
   app, con el caso de uso de Instagram («Administrar mensajes y contenido en
   Instagram»). El permiso que se usa es sólo `instagram_business_basic`: leer
   las publicaciones propias.
3. En la app: Instagram → *Configuración de la API con inicio de sesión de
   Instagram* → *Generar identificadores de acceso* → Agregar cuenta, entrar con
   @festivaldearteconceptual y aceptar. Sale el token; se copia.
   Si pide que la cuenta tenga un rol en la app: Roles de la app → Agregar
   personas → Evaluador de Instagram, y aceptar la invitación desde la cuenta.
4. Se le da al Worker:

   ```bash
   npx wrangler secret put INSTAGRAM_TOKEN
   ```

Y ya. El token caduca a los 60 días, pero el Worker lo refresca solo cada tres
y guarda el nuevo en KV: no hay que volver a tocarlo. Si algún día se muere de
todas formas —cambiar la contraseña de Instagram, por ejemplo, invalida los
tokens—, se saca otro y se pone con el mismo comando.

Para ver si está vivo, en el navegador:

```
https://cuartasilla-panel.guadalajaradenoxe.workers.dev/instagram
```

`encendido`, cuántas publicaciones hay y, si algo falla, `error` con el motivo
que da Instagram. Para no esperar al cuarto de hora la primera vez:

```bash
curl -X POST https://cuartasilla-panel.guadalajaradenoxe.workers.dev \
  -H 'Origin: https://www.festivaldearteconceptual.com' \
  -H 'Content-Type: application/json' \
  -d '{"password":"la-contraseña-del-panel","accion":"instagram"}'
```

La primera vuelta copia 25 fotos como mucho; una cuenta con cien publicaciones
queda entera en una hora, sola.

Para apagarlo: `npx wrangler secret delete INSTAGRAM_TOKEN`. Deja de traer, pero
lo ya traído se queda en la galería; quitarlo también es borrar la clave
`cs:ig:lista` de KV y `instagram` de `src/data/contenido.json`.

---

## Probar en local

```bash
cd workers/panel
cp .dev.vars.ejemplo .dev.vars     # y se edita
npx wrangler dev --port 8787
```

En otra terminal, el sitio apuntando a ese Worker:

```bash
PUBLIC_PANEL_URL=http://localhost:8787 npm run dev
```

Y para llenarlo:

```bash
PANEL_URL=http://localhost:8787 CLAVE=… node workers/panel/semilla.mjs
```

KV corre en local (no toca el de verdad) y las subidas a Cloudinary no funcionan
salvo que pongas las credenciales buenas en `.dev.vars`.

---

## Qué hay aquí

| | |
|---|---|
| `index.js` | Rutas, contraseña, bloqueo por intentos, Cloudinary, disparo del build, los dos relojes |
| `lib/contenido.js` | Todo lo que toca KV: leer, guardar, versionar, historial |
| `lib/validar.js` | La puerta. Nada entra sin pasar por aquí |
| `lib/instagram.js` | El feed de la cuenta: leerlo, refrescar el token, qué entra y qué sale de la galería |
| `lib/slug.js` | Nombres de carpeta y comparación sin tildes |
| `lib/cripto.js` | El SHA-256 que comparten la contraseña y el token |
| `semilla.mjs` | Volcado inicial desde el repo |
| `probar.mjs` | Las pruebas: el validador, y el feed contra un Instagram de mentira |

## Cambios que hay que hacer en tres sitios a la vez

Añadir un campo a cualquier colección toca:

1. `src/data/tipos.ts` — el tipo
2. `workers/panel/lib/validar.js` — la comprobación
3. `src/scripts/panel/esquema.ts` — el formulario

Están enlazados con comentarios entre sí a propósito. Si sólo tocas uno, el
campo o no se puede escribir, o no se guarda, o se guarda sin comprobar.
