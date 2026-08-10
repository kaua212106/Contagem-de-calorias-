const CACHE_NAME = 'contador-de-calorias-v4';

const ARQUIVOS = [
    './',
    './index.html',
    './manifest.json',
    './icone.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ARQUIVOS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(nomes => Promise.all(
                nomes
                    .filter(nome => nome !== CACHE_NAME)
                    .map(nome => caches.delete(nome))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then(resposta => resposta || fetch(event.request))
    );
});
