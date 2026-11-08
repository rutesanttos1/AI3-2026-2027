
import { CONFIG } from './configuracoes.js';

import {
    acrescentarPendente,
    lerPendentes,
    marcarErro,
    confirmarPendente,
    lerProprietario
} from './bd.js';

let sincronizacaoEmCurso = false;

// Adicionar uma sugestão à fila de envio
export function adicionarPendente(dados, utilizador) {
    return acrescentarPendente(dados, utilizador);
}

// Ler a mensagem de erro devolvida pelo servidor
async function obterMensagemErro(resposta) {
    try {
        const dados = await resposta.json();

        return dados.erro?.mensagem ||
            dados.erro ||
            dados.mensagem ||
            'Dados inválidos.';
    } catch {
        return 'Dados inválidos.';
    }
}

// Enviar sugestões pendentes
export async function enviarPendentes() {
    if (sincronizacaoEmCurso) {
        return;
    }

    sincronizacaoEmCurso = true;

    try {
        const proprietario = await lerProprietario();

        if (!proprietario || !proprietario.utilizador) {
            return;
        }

        const pendentes = await lerPendentes();

        // Enviar primeiro as sugestões mais antigas
        pendentes.sort((a, b) => {
            return new Date(a.criadaEm) - new Date(b.criadaEm);
        });

        for (const pendente of pendentes) {

            // Só enviar pendentes do utilizador atual e sem erros
            if (
                pendente.utilizador !== proprietario.utilizador ||
                pendente.erro !== null
            ) {
                continue;
            }

            let resposta;

            try {
                resposta = await fetch(`${CONFIG.API_URL}/sugestoes`, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        titulo: pendente.titulo,
                        descricao: pendente.descricao,
                        categoria: pendente.categoria
                    })
                });
            } catch (erro) {
                console.error('Falha de ligação ao enviar pendente:', erro);
                return;
            }

            // Sugestão criada com sucesso
            if (resposta.status === 201) {
                const sugestao = await resposta.json();

                await confirmarPendente(
                    pendente.idLocal,
                    sugestao
                );

                continue;
            }

            // Erro de validação: marcar e passar à seguinte
            if (resposta.status === 400) {
                const mensagem = await obterMensagemErro(resposta);

                await marcarErro(
                    pendente.idLocal,
                    mensagem
                );

                continue;
            }

            // Sessão expirada ou inválida
            if (resposta.status === 401) {
                const restantes = await lerPendentes();

                window.dispatchEvent(
                    new CustomEvent('sessao-expirada', {
                        detail: {
                            quantidade: restantes.length
                        }
                    })
                );

                return;
            }

            // Outros erros: parar e manter as pendentes
            console.error(
                'Erro ao enviar sugestão pendente:',
                resposta.status
            );

            return;
        }

    } finally {
        sincronizacaoEmCurso = false;
    }
}

// Nome utilizado pelo app.js atual
export function sincronizarPendentes() {
    return enviarPendentes();
}
