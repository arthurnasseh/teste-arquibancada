/* Diário de Arquibancada — guarda o app no aparelho para abrir sem internet */
/* a versão é preenchida pelo empacotar.mjs com um código do conteúdo do app: toda mudança vira um cache novo */
const CACHE = 'arquibancada-teste-2321096b89';
/* Os dois ambientes moram no mesmo domínio e dividem os caches: cada um só limpa os seus.
   O empacotar.mjs preenche o padrão: o nome do cache é o prefixo do ambiente mais 10 letras da versão. */
const MEU = (k) => /^arquibancada-teste-[0-9a-f]{10}$/.test(k);

/* O começo do app está no index.html. As PARTES (a Geral e as abas, carregadas sob demanda) são arquivos
   ao lado dele, e a lista é preenchida pelo empacotar.mjs: o service worker baixa todas em segundo plano
   ao instalar, para o app continuar abrindo inteiro sem internet. Os outros arquivos são extras.
   Se um extra ou uma parte faltar, o cache continua valendo em vez de falhar inteiro. */
const ESSENCIAL = ['./', './index.html'];
const PARTES = ["./Album.f4488c0f.js", "./Arquivo.76c3ddd2.js", "./Carimbos.948aa5e7.js", "./ComoFoi.a9f70fec.js", "./CompletarIngresso.b74efebe.js", "./Conquistas.419e59ad.js", "./contornos.79b8a9db.js", "./FolhaPalpite.fd6041de.js", "./Geral.4f63ce31.js", "./Geral.6a84fbb2.js", "./Listas.4b7c6b06.js", "./Mantos.52b10efe.js", "./MarcarJogos.ff5dbf9c.js", "./MatchForm.9fd45981.js", "./Personalizacao.9c8c114b.js", "./Pitch.948f9d1e.js", "./Registro.a98299af.js", "./Retrospectiva.0b70a6b6.js", "./textosLegais.5f2a3294.js", "./escudo-brasileirao.webp", "./escudo-carioca.webp", "./escudo-copadobrasil.webp", "./escudo-flamengo.webp", "./escudo-intercontinental.webp", "./escudo-libertadores.webp", "./escudo-recopa.webp", "./escudo-supercopa.webp"].filter((u) => u.startsWith('./'));
const EXTRAS = ['./manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './badge-96.png', ...PARTES];

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
