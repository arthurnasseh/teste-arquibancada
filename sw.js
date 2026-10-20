/* Diário de Arquibancada — guarda o app no aparelho para abrir sem internet */
/* a versão é preenchida pelo empacotar.mjs com um código do conteúdo do app: toda mudança vira um cache novo */
const CACHE = 'arquibancada-teste-acd6a885c1';
/* oficial e teste moram no mesmo domínio e dividem os caches: cada um só limpa os seus */
const MEU = (k) => ('arquibancada-teste' === 'arquibancada-teste') === k.startsWith('arquibancada-teste-');

/* O app inteiro está no index.html. Os outros arquivos são extras:
   se algum faltar, o cache continua valendo em vez de falhar inteiro. */
const ESSENCIAL = ['./', './index.html'];
const EXTRAS = ['./manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './badge-96.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      await c.addAll(ESSENCIAL);
      await Promise.all(EXTRAS.map((u) => c.add(u).catch(() => {})));
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && MEU(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => {
          if (hit) return hit;
          if (req.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        })
      )
  );
});

/* ------------------------------ notificações da Geral ------------------------------ */
/* chega do servidor já cifrada (Web Push); aqui só vira a notificação na tela */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'Diário de Arquibancada', body: e.data ? e.data.text() : '' }; }
  const titulo = String(d.title || 'Diário de Arquibancada').slice(0, 80);
  e.waitUntil(self.registration.showNotification(titulo, {
    body: String(d.body || '').slice(0, 200),
    /* ícone da barra de status: silhueta branca do escudo sobre transparente (o Android pinta só o contorno) */
    badge: './badge-96.png',
    tag: String(d.tag || 'geral').slice(0, 80),
    renotify: true,
    data: { url: typeof d.url === 'string' && d.url.startsWith('./') ? d.url : './' },
  }));
});

/* tocar na notificação abre o app (ou traz para frente) no lugar certo */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of abertas) {
      if (c.url.startsWith(self.registration.scope)) {
        await c.focus();
        c.postMessage({ tipo: 'abrir', url: destino });
        return;
      }
    }
    await self.clients.openWindow(destino);
  })());
});
