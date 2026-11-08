
const NOME_BD = 'sugestoes-bd';
const VERSAO_BD = 1;

// Abrir a base de dados
export function abrirBD() {
    return new Promise((resolve, reject) => {
        const pedido = indexedDB.open(NOME_BD, VERSAO_BD);

        pedido.onupgradeneeded = () => {
            const bd = pedido.result;

            if (!bd.objectStoreNames.contains('sugestoes')) {
                const sugestoes = bd.createObjectStore('sugestoes', {
                    keyPath: 'id'
                });

                sugestoes.createIndex('porEstado', 'estado');
                sugestoes.createIndex('porData', 'dataCriacao');
            }

            if (!bd.objectStoreNames.contains('pendentes')) {
                bd.createObjectStore('pendentes', {
                    keyPath: 'idLocal',
                    autoIncrement: true
                });
            }

            if (!bd.objectStoreNames.contains('meta')) {
                bd.createObjectStore('meta', {
                    keyPath: 'chave'
                });
            }
        };

        pedido.onsuccess = () => resolve(pedido.result);
        pedido.onerror = () => reject(pedido.error);
    });
}

// Executar uma transação
function executarTransacao(lojas, modo, operacao) {
    return abrirBD().then((bd) => {
        return new Promise((resolve, reject) => {
            const transacao = bd.transaction(lojas, modo);

            let resultado;

            try {
                resultado = operacao(transacao);
            } catch (erro) {
                transacao.abort();
                bd.close();
                reject(erro);
                return;
            }

            transacao.oncomplete = () => {
                bd.close();
                resolve(resultado);
            };

            transacao.onerror = () => {
                bd.close();
                reject(transacao.error);
            };

            transacao.onabort = () => {
                bd.close();
                reject(transacao.error || new Error('Transação cancelada.'));
            };
        });
    });
}

// Substituir a lista local e atualizar a data
export function substituirSugestoes(lista) {
    return executarTransacao(
        ['sugestoes', 'meta'],
        'readwrite',
        (transacao) => {
            const lojaSugestoes = transacao.objectStore('sugestoes');
            const lojaMeta = transacao.objectStore('meta');

            lojaSugestoes.clear();

            lista.forEach((sugestao) => {
                lojaSugestoes.put(sugestao);
            });

            lojaMeta.put({
                chave: 'atualizadoEm',
                valor: new Date().toISOString()
            });
        }
    );
}

// Ler sugestões com ordenação

export function lerSugestoes(ordenacao = 'recentes') {
    return executarTransacao(
        'sugestoes',
        'readonly',
        (transacao) => {
            const loja = transacao.objectStore('sugestoes');
            const resultados = [];

            const pedido = loja.getAll();

            pedido.onsuccess = () => {
                resultados.push(...pedido.result);

                if (ordenacao === 'estado') {
                    const ordemEstados = {
                        em_analise: 1,
                        submetida: 2,
                        aprovada: 3,
                        rejeitada: 4
                    };

                    resultados.sort((a, b) => {
                        const estadoA = ordemEstados[a.estado] ?? 99;
                        const estadoB = ordemEstados[b.estado] ?? 99;

                        return estadoA - estadoB;
                    });
                } else {
                    resultados.sort((a, b) =>
                        new Date(b.dataCriacao) - new Date(a.dataCriacao)
                    );
                }
            };

            return resultados;
        }
    );
}

// Acrescentar uma sugestão pendente
export function acrescentarPendente(dados, utilizador) {
    let idCriado;

    return executarTransacao('pendentes', 'readwrite', (transacao) => {
        const loja = transacao.objectStore('pendentes');

        const pedido = loja.add({
            utilizador,
            titulo: dados.titulo,
            descricao: dados.descricao,
            categoria: dados.categoria,
            criadaEm: new Date().toISOString(),
            erro: null
        });

        pedido.onsuccess = () => {
            idCriado = pedido.result;
        };

        return {
            obterId: () => idCriado
        };
    }).then((resultado) => resultado.obterId());
}

// Ler todas as sugestões pendentes
export function lerPendentes() {
    return executarTransacao('pendentes', 'readonly', (transacao) => {
        const resultados = [];
        const pedido = transacao.objectStore('pendentes').getAll();

        pedido.onsuccess = () => {
            resultados.push(...pedido.result);
        };

        return resultados;
    }).then((resultados) => resultados);
}

// Marcar uma pendente com erro
export function marcarErro(idLocal, mensagem) {
    return executarTransacao('pendentes', 'readwrite', (transacao) => {
        const loja = transacao.objectStore('pendentes');
        const pedido = loja.get(idLocal);

        pedido.onsuccess = () => {
            if (pedido.result) {
                pedido.result.erro = mensagem;
                loja.put(pedido.result);
            }
        };
    });
}

// Remover uma pendente e guardar a sugestão criada
export function confirmarPendente(idLocal, sugestao) {
    return executarTransacao(
        ['pendentes', 'sugestoes'],
        'readwrite',
        (transacao) => {
            transacao.objectStore('pendentes').delete(idLocal);
            transacao.objectStore('sugestoes').put(sugestao);
        }
    );
}

// Ler o proprietário da cópia local
export function lerProprietario() {
    return executarTransacao('meta', 'readonly', (transacao) => {
        let proprietario = null;

        const pedido = transacao.objectStore('meta').get('proprietario');

        pedido.onsuccess = () => {
            proprietario = pedido.result || null;
        };

        return {
            obter: () => proprietario
        };
    }).then((resultado) => resultado.obter());
}

// Guardar o proprietário da cópia local
export function guardarProprietario(sessao) {
    return executarTransacao('meta', 'readwrite', (transacao) => {
        transacao.objectStore('meta').put({
            chave: 'proprietario',
            utilizador: sessao.utilizador,
            nome: sessao.nome,
            papel: sessao.papel,
            expiracao: sessao.expiracao,
            atualizadoEm: new Date().toISOString()
        });
    });
}

// Apagar todos os dados locais
export function limparBD() {
    return executarTransacao(
        ['sugestoes', 'pendentes', 'meta'],
        'readwrite',
        (transacao) => {
            transacao.objectStore('sugestoes').clear();
            transacao.objectStore('pendentes').clear();
            transacao.objectStore('meta').clear();
        }
    );
}

// Funções de compatibilidade com o código anterior

export function guardarSugestao(sugestao) {
    return executarTransacao('sugestoes', 'readwrite', (transacao) => {
        transacao.objectStore('sugestoes').put(sugestao);
    });
}

export function listarSugestoes() {
    return executarTransacao('sugestoes', 'readonly', (transacao) => {
        let resultados = [];

        const pedido = transacao.objectStore('sugestoes').getAll();

        pedido.onsuccess = () => {
            resultados = pedido.result;
        };

        return {
            obter: () => resultados
        };
    }).then((resultado) => resultado.obter());
}

export function limparDadosLocais() {
    return limparBD();
}

export function obterMeta(chave) {
    return executarTransacao('meta', 'readonly', (transacao) => {
        let resultado = null;

        const pedido = transacao.objectStore('meta').get(chave);

        pedido.onsuccess = () => {
            resultado = pedido.result || null;
        };

        return {
            obter: () => resultado
        };
    }).then((resultado) => resultado.obter());
}

export function guardarMeta(registo) {
    return executarTransacao('meta', 'readwrite', (transacao) => {
        transacao.objectStore('meta').put(registo);
    });
}
