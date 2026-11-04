// Variável de módulo que conserva o token em memória volátil
// (Nunca armazenado em localStorage ou sessionStorage)
let tokenAtual = null;
let temporizadorExpiracao = null;

// Elementos da interface
const zonaMensagens = document.getElementById('zona-mensagens');
const textoMensagem = document.getElementById('texto-mensagem');

const areaEntrada = document.getElementById('area-entrada');
const formLogin = document.getElementById('form-login');
const campoUtilizador = document.getElementById('campo-utilizador');
const campoPalavraPasse = document.getElementById('campo-palavra-passe');

const areaSessao = document.getElementById('area-sessao');
const sessaoSub = document.getElementById('sessao-sub');
const sessaoNome = document.getElementById('sessao-nome');
const sessaoPapel = document.getElementById('sessao-papel');
const sessaoExpiracao = document.getElementById('sessao-expiracao');
const sessaoContagem = document.getElementById('sessao-contagem');

const btnSugestoes = document.getElementById('btn-sugestoes');
const btnTerminar = document.getElementById('btn-terminar');
const listaSugestoes = document.getElementById('lista-sugestoes');

/**
 * Apresenta uma mensagem na zona de alertas
 */
function mostrarMensagem(texto) {
  textoMensagem.textContent = texto;
  zonaMensagens.hidden = false;
}

/**
 * Limpa a zona de mensagens
 */
function limparMensagem() {
  textoMensagem.textContent = '';
  zonaMensagens.hidden = true;
}

/**
 * Descodifica o payload de um token JWT em formato UTF-8
 * @param {string} token
 * @returns {Object} Payload em formato JSON
 */
export function descodificarPayload(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token ausente ou com tipo incorreto.');
  }

  const partes = token.split('.');
  if (partes.length !== 3) {
    throw new Error('Estrutura de token JWT inválida (deve conter 3 partes).');
  }

  // Converter base64url para base64 com padding adequado
  let base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }

  // Descodificar e tratar os bytes como UTF-8
  const binaryString = atob(base64);
  const bytes = Uint8Array.from(binaryString, char => char.charCodeAt(0));
  const jsonString = new TextDecoder('utf-8').decode(bytes);

  return JSON.parse(jsonString);
}

/**
 * Efetua um pedido HTTP autenticado com o esquema Bearer
 * @param {string} url
 * @returns {Promise<any|null>}
 */
export async function pedidoAutenticado(url) {
  if (!tokenAtual) {
    terminarSessao('Sessão expirada. É necessária nova autenticação.');
    return null;
  }

  try {
    const resposta = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': Bearer ${tokenAtual}
      }
    });

    if (resposta.status === 401) {
      terminarSessao('Sessão expirada. É necessária nova autenticação.');
      return null;
    }

    if (!resposta.ok) {
      const corpoErro = await resposta.json().catch(() => ({ erro: 'Falha no pedido.' }));
      mostrarMensagem(corpoErro.erro || Erro HTTP ${resposta.status});
      return null;
    }

    return await resposta.json();
  } catch (erroRede) {
    mostrarMensagem('Erro de comunicação de rede ao contactar a API.');
    return null;
  }
}

/**
 * Inicia o relógio decrescente até à expiração do token
 * @param {number} instanteExpSegundos
 */
function iniciarContador(instanteExpSegundos) {
  if (temporizadorExpiracao) {
    clearInterval(temporizadorExpiracao);
  }

  const atualizar = () => {
    const agoraSegundos = Math.floor(Date.now() / 1000);
    const segundosRestantes = instanteExpSegundos - agoraSegundos;

    if (segundosRestantes <= 0) {
      clearInterval(temporizadorExpiracao);
      sessaoContagem.textContent = '00:00 (Expirado)';
      terminarSessao('Sessão expirada. É necessária nova autenticação.');
      return;
    }

    const min = Math.floor(segundosRestantes / 60);
    const seg = segundosRestantes % 60;
    sessaoContagem.textContent = ${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')};
  };

  atualizar();
  temporizadorExpiracao = setInterval(atualizar, 1000);
}

/**
 * Termina a sessão do utilizador e restaura o ecrã de entrada
 * @param {string|null} mensagemAviso
 */
function terminarSessao(mensagemAviso = null) {
  tokenAtual = null;
  if (temporizadorExpiracao) {
    clearInterval(temporizadorExpiracao);
    temporizadorExpiracao = null;
  }

  // Repor formulário
  campoPalavraPasse.value = '';
  areaSessao.hidden = true;
  areaEntrada.hidden = false;

  // Limpar lista de sugestões
  listaSugestoes.replaceChildren();
  const avisoLista = document.createElement('p');
  avisoLista.className = 'estado-lista';
  avisoLista.textContent = 'Clique no botão acima para carregar as sugestões.';
  listaSugestoes.appendChild(avisoLista);

  if (mensagemAviso) {
    mostrarMensagem(mensagemAviso);
  } else {
    limparMensagem();
  }
}

// Submissão do formulário de autenticação
formLogin.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  limparMensagem();

  const utilizador = campoUtilizador.value.trim();
  const palavraPasse = campoPalavraPasse.value;

  try {
    const resposta = await fetch('/v2/tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ utilizador, palavraPasse })
    });

    if (resposta.status === 200) {
      const dados = await resposta.json();
      tokenAtual = dados.token;

      // Limpar campo da palavra-passe de imediato
      campoPalavraPasse.value = '';

      // Descodificar e apresentar dados do payload
      const payload = descodificarPayload(tokenAtual);
      sessaoSub.textContent = payload.sub;
      sessaoNome.textContent = payload.nome;
      sessaoPapel.textContent = payload.papel;

      const dataExp = new Date(payload.exp * 1000);
      sessaoExpiracao.textContent = dataExp.toLocaleTimeString();

      // Ajustar texto do botão de acordo com o papel
      if (payload.papel === 'servicos') {
        btnSugestoes.textContent = 'Todas as sugestões';
      } else {
        btnSugestoes.textContent = 'As minhas sugestões';
      }

      // Alternar ecrãs
      areaEntrada.hidden = true;
      areaSessao.hidden = false;

      // Iniciar temporizador
      iniciarContador(payload.exp);
    } else if (resposta.status === 400 || resposta.status === 401) {
      const erroJson = await resposta.json().catch(() => ({ erro: 'Erro na autenticação' }));
      // Apresenta mensagem do Erro sem distinguir utilizador inexistente de palavra-passe errada
      mostrarMensagem(erroJson.erro || 'Falha na autenticação.');
    } else {
      mostrarMensagem('Ocorreu um erro inesperado no servidor.');
    }
  } catch (erroRede) {
    mostrarMensagem('Não foi possível estabelecer ligação ao servidor. Verifique a rede.');
  }
});

// Botão para listar sugestões
btnSugestoes.addEventListener('click', async () => {
  limparMensagem();
  const dados = await pedidoAutenticado('/v2/sugestoes');

  if (!dados || !dados.itens) {
    return;
  }

  listaSugestoes.replaceChildren();

  if (dados.itens.length === 0) {
    const pVazio = document.createElement('p');
    pVazio.className = 'estado-lista';
    pVazio.textContent = 'Nenhuma sugestão encontrada.';
    listaSugestoes.appendChild(pVazio);
    return;
  }

  // Apresentar título, categoria e estado EXCLUSIVAMENTE com textContent (segurança contra XSS)
  dados.itens.forEach(sugestao => {
    const cartao = document.createElement('div');
    cartao.className = 'cartao-sugestao';

    const tituloEl = document.createElement('h4');
    tituloEl.className = 'cartao-titulo';
    tituloEl.textContent = sugestao.titulo;

    const metaEl = document.createElement('div');
    metaEl.className = 'cartao-meta';

    const categoriaEl = document.createElement('span');
    categoriaEl.className = 'cartao-categoria';
    categoriaEl.textContent = Categoria: ${sugestao.categoria};

    const estadoEl = document.createElement('span');
    estadoEl.className = 'cartao-estado';
    estadoEl.textContent = Estado: ${sugestao.estado};

    metaEl.appendChild(categoriaEl);
    metaEl.appendChild(estadoEl);

    cartao.appendChild(tituloEl);
    cartao.appendChild(metaEl);

    listaSugestoes.appendChild(cartao);
  });
});

// Botão para terminar sessão
btnTerminar.addEventListener('click', () => {
  terminarSessao();
});