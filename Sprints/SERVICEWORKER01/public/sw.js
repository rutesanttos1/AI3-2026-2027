
const CACHE_INTERFACE = 'interface-v1';
const CACHE_DADOS = 'dados-publicos';

const FICHEIROS_INTERFACE = [
    '/',
    '/index.html',
    '/estilos.css',
    '/app.js',
    '/configuracoes.js',
    '/bd.js',
    '/pendente.js'
];

// Instalação
self.addEventListener('install', (evento) => {
    evento.waitUntil(
        caches.open(CACHE_INTERFACE).then((cache) => {
            return cache.addAll(FICHEIROS_INTERFACE);
        })
    );
});

// Ativação
self.addEventListener('activate', (evento) => {
    evento.waitUntil(
        caches.keys()
            .then((nomes) => {
                return Promise.all(
                    nomes
                        .filter((nome) =>
                            nome !== CACHE_INTERFACE &&
                            nome !== CACHE_DADOS
                        )
                        .map((nome) => caches.delete(nome))
                );
            })
            .then(() => self.clients.claim())
    );
});

// Intercetação dos pedidos
self.addEventListener('fetch', (evento) => {
    const pedido = evento.request;
    const url = new URL(pedido.url);

    if (
        pedido.method !== 'GET' ||
        url.origin !== self.location.origin
    ) {
        return;
    }

    // Categorias: stale-while-revalidate
    if (url.pathname === '/v2/categorias') {
        const atualizacao = caches.open(CACHE_DADOS)
            .then(async (cache) => {
                const resposta = await fetch(pedido);

                if (resposta.ok) {
                    await cache.put(pedido, resposta.clone());
                }

                return resposta;
            });

        evento.waitUntil(atualizacao.then(
            () => undefined,
            () => undefined
        ));

        evento.respondWith(
            caches.open(CACHE_DADOS).then(async (cache) => {
                const respostaEmCache = await cache.match(pedido);

                if (respostaEmCache) {
                    return respostaEmCache;
                }

                return atualizacao;
            })
        );

        return;
    }

    // Restantes pedidos da API: apenas rede
    if (url.pathname.startsWith('/v2/')) {
        return;
    }

    // Interface: cache primeiro
    evento.respondWith(
        caches.open(CACHE_INTERFACE).then(async (cache) => {
            const respostaEmCache = await cache.match(pedido);

            if (respostaEmCache) {
                return respostaEmCache;
            }

            const resposta = await fetch(pedido);

            if (resposta.ok) {
                await cache.put(pedido, resposta.clone());
            }

            return resposta;
        })
    );
});

// Ativar nova versão
self.addEventListener('message', (evento) => {
    if (evento.data?.tipo === 'ativar') {
        self.skipWaiting();
    }
});
