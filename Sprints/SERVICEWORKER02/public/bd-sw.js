
const NOME_BD = 'sugestoes-bd';
const VERSAO_BD = 2;

let avisoVersaoNova = null;

// Permite à página registar uma função para mostrar o aviso.
// O service worker pode usar bd.js sem depender de window ou document.
function definirAvisoVersaoNova(funcao) {
  avisoVersaoNova = funcao;
}

// --------------------------------------------------
// ABRIR BASE DE DADOS E MIGRAR PARA A VERSÃO 2
// --------------------------------------------------

function abrirBD() {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(NOME_BD, VERSAO_BD);

    pedido.onupgradeneeded = (evento) => {
      const bd = pedido.result;
      const transacao = pedido.transaction;

      if (!bd.objectStoreNames.contains('sugestoes')) {
        const loja = bd.createObjectStore('sugestoes', {
          keyPath: 'id'
        });

        loja.createIndex('porEstado', 'estado');
        loja.createIndex('porData', 'dataCriacao');
      }

      let pendentes;

      if (!bd.objectStoreNames.contains('pendentes')) {
        pendentes = bd.createObjectStore('pendentes', {
          keyPath: 'idLocal',
          autoIncrement: true
        });
      } else {
        pendentes = transacao.objectStore('pendentes');
      }

      if (!bd.objectStoreNames.contains('meta')) {
        bd.createObjectStore('meta', {
          keyPath: 'chave'
        });
      }

      // Migração da versão 1 para a versão 2.
      if (evento.oldVersion < 2) {
        if (!pendentes.indexNames.contains('porUtilizador')) {
          pendentes.createIndex('porUtilizador', 'utilizador');
        }

        // Atualiza os registos antigos sem os apagar.
        const cursor = pendentes.openCursor();

        cursor.onsuccess = () => {
          const resultado = cursor.result;

          if (!resultado) return;

          const registo = resultado.value;

          if (!registo.chave) {
            registo.chave = crypto.randomUUID();
          }

          if (registo.tentativas === undefined) {
            registo.tentativas = 0;
          }

          if (registo.ultimaTentativa === undefined) {
            registo.ultimaTentativa = null;
          }

          resultado.update(registo);
          resultado.continue();
        };
      }
    };

    pedido.onsuccess = () => {
      const bd = pedido.result;

      bd.onversionchange = () => {
        bd.close();

        if (typeof avisoVersaoNova === 'function') {
          avisoVersaoNova();
        }
      };

      resolve(bd);
    };

    pedido.onerror = () => reject(pedido.error);

    pedido.onblocked = () => {
      console.warn(
        'A atualização da IndexedDB está bloqueada por outra ligação.'
      );
    };
  });
}

// --------------------------------------------------
// EXECUTAR TRANSAÇÕES
// --------------------------------------------------

function executarTransacao(lojas, modo, operacao) {
  return abrirBD().then((bd) => {
    return new Promise((resolve, reject) => {
      let transacao;

      try {
        transacao = bd.transaction(lojas, modo);
      } catch (erro) {
        bd.close();
        reject(erro);
        return;
      }

      let resultado;

      try {
        // O resultado pode ser atualizado pelos eventos dos pedidos.
        const definirResultado = (valor) => {
          resultado = valor;
        };

        operacao(transacao, definirResultado);
      } catch (erro) {
        try {
          transacao.abort();
        } catch (_) {
          // A transação pode já ter terminado.
        }

        bd.close();
        reject(erro);
        return;
      }

      // Só resolve quando a transação estiver concluída.
      transacao.oncomplete = () => {
        bd.close();
        resolve(resultado);
      };

      transacao.onerror = () => {
        reject(transacao.error);
      };

      transacao.onabort = () => {
        bd.close();
        reject(
          transacao.error || new Error('Transação cancelada.')
        );
      };
    });
  });
}

// --------------------------------------------------
// SUGESTÕES
// --------------------------------------------------

function substituirSugestoes(lista) {
  return executarTransacao(
    ['sugestoes', 'meta'],
    'readwrite',
    (transacao) => {
      const loja = transacao.objectStore('sugestoes');

      loja.clear();

      for (const sugestao of lista) {
        loja.put(sugestao);
      }

      transacao.objectStore('meta').put({
        chave: 'atualizadoEm',
        valor: new Date().toISOString()
      });
    }
  );
}

function lerSugestoes(ordenacao = 'recentes') {
  return executarTransacao(
    'sugestoes',
    'readonly',
    (transacao, definirResultado) => {
      const pedido = transacao.objectStore('sugestoes').getAll();

      pedido.onsuccess = () => {
        const resultados = pedido.result;

        if (ordenacao === 'estado') {
          const ordem = {
            em_analise: 1,
            submetida: 2,
            aprovada: 3,
            aceite: 3,
            rejeitada: 4,
            resolvida: 5
          };

          resultados.sort((a, b) =>
            (ordem[a.estado] ?? 99) - (ordem[b.estado] ?? 99)
          );
        } else {
          resultados.sort((a, b) =>
            new Date(b.dataCriacao) - new Date(a.dataCriacao)
          );
        }

        definirResultado(resultados);
      };
    }
  );
}

function guardarSugestao(sugestao) {
  return executarTransacao(
    'sugestoes',
    'readwrite',
    (transacao) => {
      transacao.objectStore('sugestoes').put(sugestao);
    }
  );
}

function listarSugestoes() {
  return executarTransacao(
    'sugestoes',
    'readonly',
    (transacao, definirResultado) => {
      const pedido = transacao.objectStore('sugestoes').getAll();

      pedido.onsuccess = () => {
        definirResultado(pedido.result);
      };
    }
  );
}

// --------------------------------------------------
// SUGESTÕES PENDENTES
// --------------------------------------------------

function acrescentarPendente(dados, utilizador) {
  return executarTransacao(
    'pendentes',
    'readwrite',
    (transacao, definirResultado) => {
      const pedido = transacao.objectStore('pendentes').add({
        utilizador,
        titulo: dados.titulo,
        descricao: dados.descricao,
        categoria: dados.categoria,
        criadaEm: new Date().toISOString(),
        erro: null,
        chave: crypto.randomUUID(),
        tentativas: 0,
        ultimaTentativa: null
      });

      pedido.onsuccess = () => {
        definirResultado(pedido.result);
      };
    }
  );
}

function lerPendentes() {
  return executarTransacao(
    'pendentes',
    'readonly',
    (transacao, definirResultado) => {
      const pedido = transacao.objectStore('pendentes').getAll();

      pedido.onsuccess = () => {
        definirResultado(pedido.result);
      };
    }
  );
}

// Lê apenas as pendentes do utilizador indicado,
// sem erro e por ordem crescente de idLocal.
function lerPendentesDe(utilizador) {
  return executarTransacao(
    'pendentes',
    'readonly',
    (transacao, definirResultado) => {
      const loja = transacao.objectStore('pendentes');
      const indice = loja.index('porUtilizador');
      const resultados = [];

      const pedido = indice.openCursor(
        IDBKeyRange.only(utilizador)
      );

      pedido.onsuccess = () => {
        const cursor = pedido.result;

        if (cursor) {
          if (!cursor.value.erro) {
            resultados.push(cursor.value);
          }

          cursor.continue();
        } else {
          resultados.sort((a, b) => a.idLocal - b.idLocal);
          definirResultado(resultados);
        }
      };
    }
  );
}

// Conta as pendentes do utilizador que não têm erro.
function contarPendentes(utilizador) {
  return lerPendentesDe(utilizador).then(
    (pendentes) => pendentes.length
  );
}

// Regista uma tentativa de envio.
function registarTentativa(idLocal) {
  return executarTransacao(
    'pendentes',
    'readwrite',
    (transacao, definirResultado) => {
      const loja = transacao.objectStore('pendentes');
      const pedido = loja.get(idLocal);

      pedido.onsuccess = () => {
        const pendente = pedido.result;

        if (!pendente) {
          definirResultado(null);
          return;
        }

        pendente.tentativas =
          (pendente.tentativas || 0) + 1;

        pendente.ultimaTentativa = new Date().toISOString();

        loja.put(pendente);
        definirResultado(pendente);
      };
    }
  );
}

function marcarErro(idLocal, mensagem) {
  return executarTransacao(
    'pendentes',
    'readwrite',
    (transacao) => {
      const loja = transacao.objectStore('pendentes');
      const pedido = loja.get(idLocal);

      pedido.onsuccess = () => {
        if (pedido.result) {
          const pendente = pedido.result;
          pendente.erro = mensagem;
          loja.put(pendente);
        }
      };
    }
  );
}

function confirmarPendente(idLocal, sugestao) {
  return executarTransacao(
    ['pendentes', 'sugestoes'],
    'readwrite',
    (transacao) => {
      transacao.objectStore('pendentes').delete(idLocal);
      transacao.objectStore('sugestoes').put(sugestao);
    }
  );
}

// --------------------------------------------------
// CURSORES DE SINCRONIZAÇÃO
// --------------------------------------------------

// Devolve zero quando ainda não existe cursor.
function lerCursor(utilizador) {
  return executarTransacao(
    'meta',
    'readonly',
    (transacao, definirResultado) => {
      const pedido = transacao.objectStore('meta').get(
        `cursor:${utilizador}`
      );

      pedido.onsuccess = () => {
        definirResultado(pedido.result?.valor ?? 0);
      };
    }
  );
}

// Guarda as alterações e o cursor numa única transação.
function aplicarAlteracoes(utilizador, alteracoes, cursor) {
  return executarTransacao(
    ['sugestoes', 'meta'],
    'readwrite',
    (transacao) => {
      const lojaSugestoes = transacao.objectStore('sugestoes');
      const lojaMeta = transacao.objectStore('meta');

      for (const sugestao of alteracoes) {
        lojaSugestoes.put(sugestao);
      }

      lojaMeta.put({
        chave: `cursor:${utilizador}`,
        valor: cursor
      });
    }
  );
}

// --------------------------------------------------
// PROPRIETÁRIO DA CÓPIA LOCAL
// --------------------------------------------------

function lerProprietario() {
  return executarTransacao(
    'meta',
    'readonly',
    (transacao, definirResultado) => {
      const pedido = transacao.objectStore('meta').get(
        'proprietario'
      );

      pedido.onsuccess = () => {
        definirResultado(pedido.result || null);
      };
    }
  );
}

function guardarProprietario(sessao) {
  return executarTransacao(
    'meta',
    'readwrite',
    (transacao) => {
      transacao.objectStore('meta').put({
        chave: 'proprietario',
        utilizador: sessao.utilizador,
        nome: sessao.nome,
        papel: sessao.papel,
        expiracao: sessao.expiracao,
        atualizadoEm: new Date().toISOString()
      });
    }
  );
}

// --------------------------------------------------
// METADADOS
// --------------------------------------------------

function obterMeta(chave) {
  return executarTransacao(
    'meta',
    'readonly',
    (transacao, definirResultado) => {
      const pedido = transacao.objectStore('meta').get(chave);

      pedido.onsuccess = () => {
        definirResultado(pedido.result || null);
      };
    }
  );
}

function guardarMeta(registo) {
  return executarTransacao(
    'meta',
    'readwrite',
    (transacao) => {
      transacao.objectStore('meta').put(registo);
    }
  );
}

// --------------------------------------------------
// LIMPEZA
// --------------------------------------------------

function limparBD() {
  return executarTransacao(
    ['sugestoes', 'pendentes', 'meta'],
    'readwrite',
    (transacao) => {
      transacao.objectStore('sugestoes').clear();
      transacao.objectStore('pendentes').clear();

      // Inclui proprietário, metadados e todos os cursores.
      transacao.objectStore('meta').clear();
    }
  );
}

function limparDadosLocais() {
  return limparBD();
}

self.BD = {abrirBD, lerProprietario, lerPendentesDe, contarPendentes, registarTentativa, marcarErro, confirmarPendente, lerCursor, aplicarAlteracoes};
