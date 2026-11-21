/**
 * Proxy de API para Cloudflare Pages Functions.
 *
 * Mantiene el frontend y la API en el mismo origen (tu dominio de Pages),
 * evitando problemas de CORS y de cookies SameSite.
 *
 * Configurar en Cloudflare Pages:
 *   API_ORIGIN = https://tu-api.onrender.com
 *
 * Este archivo NO reemplaza al backend Express: solo reenvía /api/* al
 * servidor Node desplegado en Render, Railway, Fly.io o un VPS.
 */
export async function onRequest(context) {
  const apiOrigin = context.env.API_ORIGIN;
  if (!apiOrigin) {
    return new Response(
      JSON.stringify({ error: 'Falta configurar API_ORIGIN en Cloudflare Pages.' }),
      { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } },
    );
  }

  const incoming = new URL(context.request.url);
  const base = new URL(apiOrigin);
  const target = new URL(incoming.pathname + incoming.search, base);

  const headers = new Headers(context.request.headers);
  headers.set('host', base.host);

  const clientIp = context.request.headers.get('cf-connecting-ip');
  if (clientIp) headers.set('x-forwarded-for', clientIp);

  const init = {
    method: context.request.method,
    headers,
    redirect: 'manual',
  };

  if (!['GET', 'HEAD'].includes(context.request.method)) {
    init.body = context.request.body;
  }

  const response = await fetch(target, init);
  const responseHeaders = new Headers(response.headers);

  // Si el backend devuelve una URL absoluta, mantenerla relativa al proxy.
  const location = responseHeaders.get('location');
  if (location?.startsWith(base.origin)) {
    responseHeaders.set('location', location.slice(base.origin.length) || '/');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
