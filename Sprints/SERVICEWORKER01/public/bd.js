
// Nome da base de dados que será criada no navegador.
const NOME_BD = 'sugestoes-bd';

// Versão da estrutura da base de dados.
// Se futuramente alterarmos a estrutura, podemos aumentar esta versão.
const VERSAO_BD = 1;


// --------------------------------------------------
// ABRIR A BASE DE DADOS
// --------------------------------------------------

export function abrirBD() {

    // Uma Promise permite aguardar pelo resultado da abertura da base de dados.
    return new Promise((resolve, reject) => {

        // Tenta abrir a base de dados com o nome e a versão definidos.
        const pedido = indexedDB.open(NOME_BD, VERSAO_BD);

        // Este evento é executado quando a base de dados é criada
        // pela primeira vez ou quando a sua versão é atualizada.
        pedido.onupgradeneeded = () => {

            // Obtém a referência à base de dados.
            const bd = pedido.result;

            // Verifica se a tabela "sugestoes" ainda não existe.
            if (!bd.objectStoreNames.contains('sugestoes')) {

                // Cria a tabela sugestões.
                // O campo "id" funciona como chave primária.
                const sugestoes = bd.createObjectStore('sugestoes', {
                    keyPath: 'id'
                });

                // Cria um índice para permitir pesquisar por estado.
                sugestoes.createIndex('porEstado', 'estado');

                // Cria um índice para permitir pesquisar por data de criação.
                sugestoes.createIndex('porData', 'dataCriacao');
            }

            // Verifica se a tabela "pendentes" ainda não existe.
            if (!bd.objectStoreNames.contains('pendentes')) {

                // Cria a tabela pendentes.
                // O campo idLocal identifica cada registo.
                // autoIncrement gera automaticamente um novo identificador.
                bd.createObjectStore('pendentes', {
                    keyPath: 'idLocal',
                    autoIncrement: true
                });
            }

            // Verifica se a tabela "meta" ainda não existe.
            if (!bd.objectStoreNames.contains('meta')) {

                // Cria a tabela meta.
                // A chave primária é o campo "chave".
                // Guarda informações adicionais da aplicação.
                bd.createObjectStore('meta', {
                    keyPath: 'chave'
                });
            }
        };

        // Se a abertura for bem-sucedida, devolve a base de dados.
        pedido.onsuccess = () => resolve(pedido.result);

        // Se ocorrer um erro ao abrir a base de dados, devolve o erro.
        pedido.onerror = () => reject(pedido.error);
    });
}


// --------------------------------------------------
// EXECUTAR UMA TRANSAÇÃO
// --------------------------------------------------

function executarTransacao(lojas, modo, operacao) {

    // Primeiro abre a base de dados.
    return abrirBD().then((bd) => {

        // Cria uma Promise para controlar o resultado da transação.
        return new Promise((resolve, reject) => {

            // Cria uma transação nas tabelas indicadas.
            // O modo pode ser readonly (leitura) ou readwrite (leitura e escrita).
            const transacao = bd.transaction(lojas, modo);

            // Variável que guarda o resultado da operação.
            let resultado;

            try {

                // Executa a operação recebida como parâmetro.
                // A função operacao contém aquilo que queremos fazer na base de dados.
                resultado = operacao(transacao);

            } catch (erro) {

                // Se ocorrer um erro durante a operação,
                // cancela a transação.
                transacao.abort();

                // Fecha a ligação à base de dados.
                bd.close();

                // Devolve o erro.
                reject(erro);
                return;
            }

            // Este evento ocorre quando a transação termina com sucesso.
            transacao.oncomplete = () => {

                // Fecha a ligação à base de dados.
                bd.close();

                // Devolve o resultado da operação.
                resolve(resultado);
            };

            // Este evento ocorre quando existe um erro na transação.
            transacao.onerror = () => {

                // Fecha a ligação.
                bd.close();

                // Devolve o erro ocorrido.
                reject(transacao.error);
            };

            // Este evento ocorre quando a transação é cancelada.
            transacao.onabort = () => {

                // Fecha a ligação.
                bd.close();

                // Devolve o erro ou uma mensagem de transação cancelada.
                reject(transacao.error || new Error('Transação cancelada.'));
            };
        });
    });
}


// --------------------------------------------------
// SUBSTITUIR A LISTA LOCAL E ATUALIZAR A DATA
// --------------------------------------------------

export function substituirSugestoes(lista) {

    // Executa uma transação de escrita em duas tabelas:
    // sugestões e meta.
    return executarTransacao(
        ['sugestoes', 'meta'],
        'readwrite',
        (transacao) => {

            // Obtém a tabela onde estão guardadas as sugestões.
            const lojaSugestoes = transacao.objectStore('sugestoes');

            // Obtém a tabela onde estão guardadas as informações adicionais.
            const lojaMeta = transacao.objectStore('meta');

            // Apaga as sugestões antigas para evitar duplicações.
            lojaSugestoes.clear();

            // Percorre todas as sugestões recebidas do servidor.
            lista.forEach((sugestao) => {

                // Guarda cada sugestão na tabela local.
                lojaSugestoes.put(sugestao);
            });

            // Guarda a data e hora da atualização.
            // toISOString() converte a data para um formato normalizado.
            lojaMeta.put({
                chave: 'atualizadoEm',
                valor: new Date().toISOString()
            });
        }
    );
}


// --------------------------------------------------
// LER SUGESTÕES COM ORDENAÇÃO
// --------------------------------------------------

export function lerSugestoes(ordenacao = 'recentes') {

    // Abre uma transação apenas de leitura na tabela sugestões.
    return executarTransacao(
        'sugestoes',
        'readonly',
        (transacao) => {

            // Obtém a tabela sugestões.
            const loja = transacao.objectStore('sugestoes');

            // Cria um array vazio para guardar os resultados.
            const resultados = [];

            // Solicita todos os registos existentes na tabela.
            const pedido = loja.getAll();

            // Este evento é executado quando os registos são recebidos.
            pedido.onsuccess = () => {

                // Copia os resultados recebidos para o array.
                resultados.push(...pedido.result);

                // Se o utilizador escolheu ordenar por estado:
                if (ordenacao === 'estado') {

                    // Define a ordem de apresentação dos estados.
                    const ordemEstados = {
                        em_analise: 1,
                        submetida: 2,
                        aprovada: 3,
                        rejeitada: 4
                    };

                    // Compara os estados de duas sugestões.
                    resultados.sort((a, b) => {

                        // Obtém a posição de cada estado na ordem definida.
                        // Se não existir, utiliza 99.
                        const estadoA = ordemEstados[a.estado] ?? 99;
                        const estadoB = ordemEstados[b.estado] ?? 99;

                        // Devolve a diferença para determinar a ordem.
                        return estadoA - estadoB;
                    });

                } else {

                    // Caso contrário, ordena pelas datas de criação.
                    // A data mais recente aparece primeiro.
                    resultados.sort((a, b) =>
                        new Date(b.dataCriacao) - new Date(a.dataCriacao)
                    );
                }
            };

            // Devolve o array de resultados.
            return resultados;
        }
    );
}


// --------------------------------------------------
// ACRESCENTAR UMA SUGESTÃO PENDENTE
// --------------------------------------------------

export function acrescentarPendente(dados, utilizador) {

    // Variável que irá guardar o identificador criado automaticamente.
    let idCriado;

    // Abre uma transação de escrita na tabela pendentes.
    return executarTransacao('pendentes', 'readwrite', (transacao) => {

        // Obtém a tabela pendentes.
        const loja = transacao.objectStore('pendentes');

        // Adiciona um novo registo com os dados da sugestão.
        const pedido = loja.add({

            // Identifica o utilizador a quem pertence a sugestão.
            utilizador,

            // Guarda o título.
            titulo: dados.titulo,

            // Guarda a descrição.
            descricao: dados.descricao,

            // Guarda a categoria.
            categoria: dados.categoria,

            // Guarda a data e hora em que a sugestão foi criada localmente.
            criadaEm: new Date().toISOString(),

            // Inicialmente, ainda não existe qualquer erro.
            erro: null
        });

        // Quando o registo é adicionado com sucesso:
        pedido.onsuccess = () => {

            // Guarda o identificador atribuído automaticamente.
            idCriado = pedido.result;
        };

        // Devolve um objeto com uma função que permite obter esse identificador.
        return {
            obterId: () => idCriado
        };

    }).then((resultado) => resultado.obterId());
}


// --------------------------------------------------
// LER TODAS AS SUGESTÕES PENDENTES
// --------------------------------------------------

export function lerPendentes() {

    // Abre uma transação apenas de leitura na tabela pendentes.
    return executarTransacao('pendentes', 'readonly', (transacao) => {

        // Cria um array vazio para guardar os registos.
        const resultados = [];

        // Obtém todos os registos da tabela pendentes.
        const pedido = transacao.objectStore('pendentes').getAll();

        // Quando os resultados estiverem disponíveis:
        pedido.onsuccess = () => {

            // Adiciona todos os registos ao array.
            resultados.push(...pedido.result);
        };

        // Devolve o array com as sugestões pendentes.
        return resultados;
    }).then((resultados) => resultados);
}


// --------------------------------------------------
// MARCAR UMA PENDENTE COM ERRO
// --------------------------------------------------

export function marcarErro(idLocal, mensagem) {

    // Abre uma transação de escrita na tabela pendentes.
    return executarTransacao('pendentes', 'readwrite', (transacao) => {

        // Obtém a tabela pendentes.
        const loja = transacao.objectStore('pendentes');

        // Procura o registo através do seu identificador local.
        const pedido = loja.get(idLocal);

        // Quando o registo for encontrado:
        pedido.onsuccess = () => {

            // Verifica se o registo existe.
            if (pedido.result) {

                // Atualiza o campo erro com a mensagem recebida.
                pedido.result.erro = mensagem;

                // Guarda novamente o registo com a alteração.
                loja.put(pedido.result);
            }
        };
    });
}


// --------------------------------------------------
// REMOVER UMA PENDENTE E GUARDAR A SUGESTÃO CRIADA
// --------------------------------------------------

export function confirmarPendente(idLocal, sugestao) {

    // Executa uma transação de escrita em duas tabelas:
    // pendentes e sugestões.
    return executarTransacao(
        ['pendentes', 'sugestoes'],
        'readwrite',
        (transacao) => {

            // Remove a sugestão da tabela pendentes,
            // porque já foi enviada com sucesso.
            transacao.objectStore('pendentes').delete(idLocal);

            // Guarda a sugestão recebida do servidor
            // na tabela de sugestões.
            transacao.objectStore('sugestoes').put(sugestao);
        }
    );
}


// --------------------------------------------------
// LER O PROPRIETÁRIO DA CÓPIA LOCAL
// --------------------------------------------------

export function lerProprietario() {

    // Abre uma transação apenas de leitura na tabela meta.
    return executarTransacao('meta', 'readonly', (transacao) => {

        // Inicializa a variável sem proprietário.
        let proprietario = null;

        // Procura o registo cuja chave é "proprietario".
        const pedido = transacao.objectStore('meta').get('proprietario');

        // Quando o resultado estiver disponível:
        pedido.onsuccess = () => {

            // Guarda os dados encontrados.
            // Se não existir registo, mantém null.
            proprietario = pedido.result || null;
        };

        // Devolve um objeto com uma função para obter o proprietário.
        return {
            obter: () => proprietario
        };

    }).then((resultado) => resultado.obter());
}


// --------------------------------------------------
// GUARDAR O PROPRIETÁRIO DA CÓPIA LOCAL
// --------------------------------------------------

export function guardarProprietario(sessao) {

    // Abre uma transação de escrita na tabela meta.
    return executarTransacao('meta', 'readwrite', (transacao) => {

        // Guarda os dados do utilizador associado à cópia local.
        transacao.objectStore('meta').put({

            // Identificador utilizado como chave primária.
            chave: 'proprietario',

            // Guarda o nome de utilizador.
            utilizador: sessao.utilizador,

            // Guarda o nome apresentado ao utilizador.
            nome: sessao.nome,

            // Guarda o papel ou tipo de utilizador.
            papel: sessao.papel,

            // Guarda a data de expiração da sessão.
            expiracao: sessao.expiracao,

            // Guarda a data e hora em que esta informação foi atualizada.
            atualizadoEm: new Date().toISOString()
        });
    });
}


// --------------------------------------------------
// APAGAR TODOS OS DADOS LOCAIS
// --------------------------------------------------

export function limparBD() {

    // Executa uma transação de escrita nas três tabelas.
    return executarTransacao(
        ['sugestoes', 'pendentes', 'meta'],
        'readwrite',
        (transacao) => {

            // Apaga todas as sugestões guardadas.
            transacao.objectStore('sugestoes').clear();

            // Apaga todas as sugestões pendentes.
            transacao.objectStore('pendentes').clear();

            // Apaga os dados adicionais, incluindo o proprietário.
            transacao.objectStore('meta').clear();
        }
    );
}


// --------------------------------------------------
// FUNÇÕES DE COMPATIBILIDADE COM O CÓDIGO ANTERIOR
// --------------------------------------------------

// Esta função guarda uma sugestão na tabela sugestões.
export function guardarSugestao(sugestao) {

    // Abre uma transação de escrita.
    return executarTransacao('sugestoes', 'readwrite', (transacao) => {

        // put() adiciona um novo registo ou atualiza um existente
        // caso já tenha a mesma chave primária.
        transacao.objectStore('sugestoes').put(sugestao);
    });
}

// Esta função devolve todas as sugestões guardadas localmente.
export function listarSugestoes() {

    // Abre uma transação apenas de leitura.
    return executarTransacao('sugestoes', 'readonly', (transacao) => {

        // Inicializa o array de resultados.
        let resultados = [];

        // Solicita todos os registos da tabela.
        const pedido = transacao.objectStore('sugestoes').getAll();

        // Quando os resultados estiverem disponíveis:
        pedido.onsuccess = () => {

            // Guarda os resultados no array.
            resultados = pedido.result;
        };

        // Devolve uma função para consultar os resultados.
        return {
            obter: () => resultados
        };
    }).then((resultado) => resultado.obter());
}

// Função alternativa para limpar os dados locais.
// Reutiliza a função limparBD() para evitar repetir código.
export function limparDadosLocais() {
    return limparBD();
}

// Consulta um registo da tabela meta através da sua chave.
export function obterMeta(chave) {

    // Abre uma transação de leitura na tabela meta.
    return executarTransacao('meta', 'readonly', (transacao) => {

        // Inicializa o resultado.
        let resultado = null;

        // Procura o registo através da chave recebida.
        const pedido = transacao.objectStore('meta').get(chave);

        // Quando o resultado estiver disponível:
        pedido.onsuccess = () => {

            // Guarda o registo encontrado ou null se não existir.
            resultado = pedido.result || null;
        };

        // Devolve uma função para obter o resultado.
        return {
            obter: () => resultado
        };
    }).then((resultado) => resultado.obter());
}

// Guarda ou atualiza um registo na tabela meta.
export function guardarMeta(registo) {

    // Abre uma transação de escrita na tabela meta.
    return executarTransacao('meta', 'readwrite', (transacao) => {

        // put() adiciona ou atualiza o registo.
        transacao.objectStore('meta').put(registo);
    });
}
