// Lo que comparten `index.js` y `lib/instagram.js`: la contraseña del panel y el
// token de Instagram se comparan por su huella, nunca en claro.

export async function sha256(texto) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
