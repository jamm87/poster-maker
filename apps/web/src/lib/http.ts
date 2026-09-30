/**
 * Redirección con Location relativa. No usar `new URL(path, req.url)`: detrás de Docker o un proxy,
 * req.url lleva el host interno (p. ej. http://0.0.0.0:3000) y el navegador no puede seguirlo.
 */
export function redirectTo(location: string, status: 302 | 303 = 303): Response {
  const headers = new Headers({ Location: location });
  return new Response(null, { status, headers });
}
