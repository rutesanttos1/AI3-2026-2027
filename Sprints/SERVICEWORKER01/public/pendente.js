
 // Importa as configurações gerais da aplicação,
 // incluindo o endereço base da API.
import { CONFIG } from './configuracoes.js';

// Importa as funções necessárias para trabalhar com
// as sugestões pendentes e os dados guardados na IndexedDB.
import {
    acrescentarPendente,
    lerPendentes,
    marcarErro,
    confirmarPendente,
    lerProprietario
} from './bd.js';

// Variável que controla se já existe uma sincronização em execução.
// Evita que duas sincronizações aconteçam ao mesmo tempo.
let sincronizacaoEmCurso = false;

// Adicionar uma sugestão à fila de envio
// Esta função guarda localmente uma sugestão que ainda não foi enviada.
export function adicionarPendente(dados, utilizador) {

    // Chama a função do bd.js que guarda a sugestão
    // na loja "pendentes" da base de dados IndexedDB.
    return acrescentarPendente(dados, utilizador);
}

// Ler a mensagem de erro devolvida pelo servidor
// É uma função assíncrona porque precisa de ler a resposta da API.
async function obterMensagemErro(resposta) {
    try {
        // Converte o corpo da resposta do servidor de JSON para JavaScript.
        const dados = await resposta.json();

        // Tenta obter a mensagem de erro de diferentes propriedades.
        // O operador ?. permite aceder a uma propriedade
        // apenas se o objeto anterior existir.
        // Se não existir nenhuma mensagem, apresenta "Dados inválidos.".
        return dados.erro?.mensagem ||
            dados.erro ||
            dados.mensagem ||
            'Dados inválidos.';

    } catch {
        // Se a resposta não puder ser interpretada como JSON,
        // devolve uma mensagem de erro genérica.
        return 'Dados inválidos.';
    }
}

// Enviar sugestões pendentes
// Esta função tenta enviar para o servidor as sugestões
// que ficaram guardadas localmente.
export async function enviarPendentes() {

    // Se já estiver a decorrer uma sincronização,
    // termina a função para evitar envios duplicados.
    if (sincronizacaoEmCurso) {
        return;
    }

    // Indica que a sincronização começou.
    sincronizacaoEmCurso = true;

    try {
        // Obtém os dados do utilizador associado à cópia local.
        const proprietario = await lerProprietario();

        // Se não existir proprietário ou identificador de utilizador,
        // não é possível saber a quem pertencem as sugestões.
        if (!proprietario || !proprietario.utilizador) {
            return;
        }

        // Vai buscar todas as sugestões guardadas na loja "pendentes".
        const pendentes = await lerPendentes();

        // Enviar primeiro as sugestões mais antigas.
        // A ordenação compara as datas de criação.
        // A data mais antiga fica primeiro.
        pendentes.sort((a, b) => {
            return new Date(a.criadaEm) - new Date(b.criadaEm);
        });

        // Percorre uma a uma todas as sugestões pendentes.
        for (const pendente of pendentes) {

            // Só permite enviar sugestões que pertencem
            // ao utilizador atual e que ainda não tenham erros.
            if (
                pendente.utilizador !== proprietario.utilizador ||
                pendente.erro !== null
            ) {
                // Se não cumprir estas condições,
                // passa à próxima sugestão.
                continue;
            }

            // Variável que vai guardar a resposta do servidor.
            let resposta;

            try {
                // Faz um pedido HTTP POST à API para criar a sugestão.
                resposta = await fetch(`${CONFIG.API_URL}/sugestoes`, {

                    // POST é utilizado para enviar novos dados ao servidor.
                    method: 'POST',

                    // Envia os cookies da sessão atual juntamente com o pedido.
                    credentials: 'same-origin',

                    // Indica que os dados enviados estão no formato JSON.
                    headers: {
                        'Content-Type': 'application/json'
                    },

                    // Converte os dados da sugestão para uma string JSON.
                    // Envia apenas o título, a descrição e a categoria.
                    body: JSON.stringify({
                        titulo: pendente.titulo,
                        descricao: pendente.descricao,
                        categoria: pendente.categoria
                    })
                });

            } catch (erro) {
                // Se não existir ligação ao servidor ou ocorrer
                // uma falha de rede, apresenta o erro na consola.
                console.error('Falha de ligação ao enviar pendente:', erro);

                // Interrompe o envio.
                // A sugestão continua guardada localmente.
                return;
            }

            // Sugestão criada com sucesso
            // O estado HTTP 201 significa que o recurso foi criado.
            if (resposta.status === 201) {

                // Lê os dados da sugestão criada pelo servidor.
                const sugestao = await resposta.json();

                // Remove a sugestão da lista de pendentes
                // e guarda a versão criada pelo servidor na loja "sugestoes".
                await confirmarPendente(
                    pendente.idLocal,
                    sugestao
                );

                // Passa à próxima sugestão pendente.
                continue;
            }

            // Erro de validação: marcar e passar à seguinte
            // O estado HTTP 400 indica que os dados enviados
            // não cumprem os requisitos definidos pela API.
            if (resposta.status === 400) {

                // Obtém a mensagem de erro devolvida pelo servidor.
                const mensagem = await obterMensagemErro(resposta);

                // Guarda a mensagem de erro na sugestão pendente.
                // Assim, a aplicação pode informar o utilizador
                // de que essa sugestão precisa de ser corrigida.
                await marcarErro(
                    pendente.idLocal,
                    mensagem
                );

                // Continua a tentar enviar as restantes sugestões.
                continue;
            }

            // Sessão expirada ou inválida
            // O estado HTTP 401 indica que a autenticação falhou.
            if (resposta.status === 401) {

                // Volta a consultar as sugestões pendentes
                // para saber quantas ainda existem.
                const restantes = await lerPendentes();

                // Cria e envia um evento personalizado para a aplicação.
                // O app.js pode receber este evento e tratar a sessão expirada.
                window.dispatchEvent(
                    new CustomEvent('sessao-expirada', {
                        detail: {
                            // Envia a quantidade de sugestões pendentes
                            // como informação adicional do evento.
                            quantidade: restantes.length
                        }
                    })
                );

                // Interrompe a sincronização.
                return;
            }

            // Outros erros: parar e manter as pendentes
            // Se ocorrer outro erro HTTP, apresenta o respetivo código.
            console.error(
                'Erro ao enviar sugestão pendente:',
                resposta.status
            );

            // Interrompe o processo sem apagar a sugestão.
            return;
        }

    } finally {
        // Executa sempre no final, mesmo que exista um erro ou return.
        // Liberta o controlo para permitir uma futura sincronização.
        sincronizacaoEmCurso = false;
    }
}

// Nome utilizado pelo app.js atual
// Esta função funciona como um nome alternativo para enviarPendentes().
// Permite que o app.js chame sincronizarPendentes().
export function sincronizarPendentes() {

    // Chama e devolve o resultado da função principal.
    return enviarPendentes();
}
