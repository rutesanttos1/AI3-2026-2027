
// Nome da cache onde ficam guardados os ficheiros da interface.
// A interface inclui os ficheiros necessários para apresentar a aplicação.
const CACHE_INTERFACE = 'interface-v1';

// Nome da cache onde ficam guardados os dados públicos da API,
// neste caso, as categorias.
const CACHE_DADOS = 'dados-publicos';

// Lista dos ficheiros necessários para a aplicação funcionar.
// Estes ficheiros são guardados na cache durante a instalação do Service Worker.
const FICHEIROS_INTERFACE = [
    '/',
    '/index.html',
    '/estilos.css',
    '/app.js',
    '/configuracoes.js',
    '/bd.js',
    '/pendente.js'
];

// INSTALAÇÃO DO SERVICE WORKER
// O evento install é executado quando o navegador instala uma nova versão
// do Service Worker.
self.addEventListener('install', (evento) => {

    // waitUntil() informa o navegador de que deve esperar
    // pela conclusão das operações de instalação.
    evento.waitUntil(

        // Abre a cache destinada aos ficheiros da interface.
        caches.open(CACHE_INTERFACE).then((cache) => {

            // Adiciona todos os ficheiros da lista à cache.
            // Se algum ficheiro falhar, a operação addAll() também falha.
            return cache.addAll(FICHEIROS_INTERFACE);
        })
    );
});

// ATIVAÇÃO DO SERVICE WORKER
// O evento activate é executado quando a nova versão do Service Worker
// passa a estar ativa.
self.addEventListener('activate', (evento) => {

    // Espera que a limpeza das caches antigas e a ativação terminem.
    evento.waitUntil(

        // Obtém os nomes de todas as caches existentes no navegador.
        caches.keys()

            .then((nomes) => {

                // Promise.all() permite esperar pela eliminação
                // de todas as caches que já não são necessárias.
                return Promise.all(

                    nomes

                        // Seleciona as caches que não correspondem
                        // às duas caches atualmente utilizadas.
                        .filter((nome) =>
                            nome !== CACHE_INTERFACE &&
                            nome !== CACHE_DADOS
                        )

                        // Elimina as caches antigas.
                        .map((nome) => caches.delete(nome))
                );
            })

            // claim() permite que o Service Worker ativo passe
            // a controlar imediatamente as páginas abertas
            // dentro da sua origem.
            .then(() => self.clients.claim())
    );
});

// INTERCETAÇÃO DOS PEDIDOS
// O evento fetch é executado quando a página faz pedidos de recursos.
// O Service Worker pode decidir se responde através da cache ou da rede.
self.addEventListener('fetch', (evento) => {

    // Obtém o pedido que está a ser realizado.
    const pedido = evento.request;

    // Cria um objeto URL para conseguir consultar
    // informações como a origem e o caminho do pedido.
    const url = new URL(pedido.url);

    // Só queremos intercetar pedidos GET da mesma origem.
    // Os restantes pedidos seguem diretamente para a rede.
    if (
        pedido.method !== 'GET' ||
        url.origin !== self.location.origin
    ) {
        return;
    }

    // ESTRATÉGIA STALE-WHILE-REVALIDATE
    // Utilizada para obter as categorias.
    // Primeiro tenta apresentar os dados guardados na cache
    // e, ao mesmo tempo, procura obter uma versão atualizada da rede.
    if (url.pathname === '/v2/categorias') {

        // Abre a cache dos dados públicos e inicia um pedido à rede.
        const atualizacao = caches.open(CACHE_DADOS)
            .then(async (cache) => {

                // Pede as categorias ao servidor.
                const resposta = await fetch(pedido);

                // Só guarda na cache respostas bem-sucedidas.
                if (resposta.ok) {

                    // clone() cria uma cópia da resposta.
                    // É necessário porque a resposta original
                    // também será devolvida ao pedido.
                    await cache.put(pedido, resposta.clone());
                }

                // Devolve a resposta recebida da rede.
                return resposta;
            });

        // Permite que a atualização em segundo plano continue
        // mesmo depois de a resposta principal já ter sido entregue.
        // Se a atualização falhar, o erro é tratado para não provocar
        // uma rejeição não tratada desta operação.
        evento.waitUntil(atualizacao.then(
            () => undefined,
            () => undefined
        ));

        // Define a resposta que será enviada à página.
        evento.respondWith(

            // Abre a cache dos dados públicos.
            caches.open(CACHE_DADOS).then(async (cache) => {

                // Procura as categorias guardadas na cache.
                const respostaEmCache = await cache.match(pedido);

                // Se existirem dados guardados,
                // devolve-os imediatamente.
                if (respostaEmCache) {
                    return respostaEmCache;
                }

                // Se ainda não existir uma cópia em cache,
                // espera pela resposta da rede.
                return atualizacao;
            })
        );

        // Termina aqui o tratamento deste pedido,
        // impedindo que seja aplicado outro tipo de estratégia.
        return;
    }

    // RESTANTES PEDIDOS DA API: APENAS REDE
    // Os restantes pedidos da API não são guardados em cache.
    // Por exemplo, pedidos relacionados com sessões e sugestões.
    if (url.pathname.startsWith('/v2/')) {
        return;
    }

    // INTERFACE: CACHE FIRST
    // Para os ficheiros da interface, a aplicação procura primeiro
    // uma resposta na cache antes de recorrer à rede.
    evento.respondWith(

        // Abre a cache da interface.
        caches.open(CACHE_INTERFACE).then(async (cache) => {

            // Procura o ficheiro solicitado na cache.
            const respostaEmCache = await cache.match(pedido);

            // Se o ficheiro estiver guardado,
            // devolve a cópia local sem precisar da rede.
            if (respostaEmCache) {
                return respostaEmCache;
            }

            // Se não existir na cache, tenta obter o ficheiro da rede.
            const resposta = await fetch(pedido);

            // Só guarda na cache se o pedido tiver sido bem-sucedido.
            if (resposta.ok) {

                // Guarda uma cópia da resposta para utilização futura.
                // clone() permite conservar a resposta original.
                await cache.put(pedido, resposta.clone());
            }

            // Devolve a resposta à página.
            return resposta;
        })
    );
});

// ATIVAÇÃO DE UMA NOVA VERSÃO
// O evento message permite receber mensagens enviadas
// pela página para o Service Worker.
self.addEventListener('message', (evento) => {

    // Verifica se a mensagem recebida tem o tipo "ativar".
    // O operador ?. evita erros caso evento.data não exista.
    if (evento.data?.tipo === 'ativar') {

        // skipWaiting() permite que a nova versão do Service Worker
        // deixe de esperar pelo encerramento das páginas controladas
        // pela versão anterior e avance para a ativação.
        self.skipWaiting();
    }
});
