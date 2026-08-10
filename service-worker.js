const CACHE_NAME = 'contador-de-calorias-auto';
const CACHE_PREFIX = 'contador-de-calorias-';

const OFFLINE_FILES = [
  './index.html',
  './manifest.json',
  './icone.png'
];

// Instala e busca os arquivos direto da rede, evitando reutilizar
// uma cópia HTTP antiga durante a instalação.
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    for (const arquivo of OFFLINE_FILES) {
      try {
        const resposta = await fetch(new Request(arquivo, { cache: 'reload' }));
        if (resposta.ok) {
          await cache.put(arquivo, resposta);
        }
      } catch (e) {}
    }

    await self.skipWaiting();
  })());
});

// Assume o controle imediatamente e remove SOMENTE caches antigos
// deste app, sem apagar localStorage nem caches de outros apps.
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const nomes = await caches.keys();

    await Promise.all(
      nomes
        .filter(nome => nome.startsWith(CACHE_PREFIX) && nome !== CACHE_NAME)
        .map(nome => caches.delete(nome))
    );

    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Não interfere nas APIs externas, como Open Food Facts/Tesseract.
  if (url.origin !== self.location.origin) return;

  // Páginas: internet primeiro; offline usa o último Index salvo.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const resposta = await fetch(request, { cache: 'no-store' });

        if (resposta && resposta.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('./index.html', resposta.clone());
        }

        return resposta;
      } catch (e) {
        const salvo = await caches.match('./index.html');
        return salvo || Response.error();
      }
    })());
    return;
  }

  // Demais arquivos locais: rede primeiro e atualiza a cópia offline.
  event.respondWith((async () => {
    try {
      const resposta = await fetch(request, { cache: 'no-cache' });

      if (resposta && resposta.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, resposta.clone());
      }

      return resposta;
    } catch (e) {
      const salvo = await caches.match(request);
      return salvo || Response.error();
    }
  })());
});
