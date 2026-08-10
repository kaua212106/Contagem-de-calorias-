const CACHE_NAME = 'Contador-de-calorias-V1';

const ARQUIVOS = [
    './',
    './index.html',
    './manifest.json',
    './icone.png'
];


// Instala o Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(ARQUIVOS);
            })
    );

    self.skipWaiting();
});


// Ativa o Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(nomes => {
            return Promise.all(
                nomes
                    .filter(nome => nome !== CACHE_NAME)
                    .map(nome => caches.delete(nome))
            );
        })
    );

    self.clients.claim();
});


// Quando o app pedir um arquivo
self.addEventListener('fetch', event => {

    event.respondWith(
        caches.match(event.request)
            .then(resposta => {

                // Se estiver salvo no aparelho, usa a cópia offline
                if (resposta) {
                    return resposta;
                }

                // Se não estiver salvo, tenta buscar pela internet
                return fetch(event.request);
            })
    );

});
