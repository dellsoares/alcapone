/* Al Capone Admin PWA — internet necessária para sincronizar com o Supabase. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(request).catch(() => new Response(
      '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#17110d"><title>Sem conexão | Al Capone</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#17110d;color:#f3e8dc;font:16px Arial,sans-serif;text-align:center;padding:24px"><main><h1>Sem conexão</h1><p>Conecte-se à internet para acessar a agenda e sincronizar os dados.</p><p>Depois, feche e abra o aplicativo novamente.</p></main></body></html>',
      {status: 503, headers: {'Content-Type': 'text/html; charset=utf-8'}}
    ))
  );
});
