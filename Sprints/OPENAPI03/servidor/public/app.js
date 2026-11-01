import { lerConfiguracoes, guardarConfiguracoes } from './configuracoes.js';

// O token deixou de existir no cliente: está no cookie sessao (HttpOnly),
// que o browser envia sozinho e que o JavaScript não consegue ler.
// Do lado do cliente fica apenas a Sessao devolvida pelo servidor.

const CHAVE_RASCUNHO = 'rascunhoSugestao';
const ORDEM_ESTADOS = ['submetida', 'em_analise', 'aceite', 'rejeitada'];

let temporizadorExpiracao = null;
let sugestoesCarregadas = null; // última lista obtida, para reordenar sem novo pedido
let configuracoes = lerConfiguracoes();

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

const blocoNovaSugestao = document.getElementById('bloco-nova-sugestao');
const formNovaSugestao = document.getElementById('form-nova-sugestao');
const campoTitulo = document.getElementById('campo-titulo');
const campoDescricao = document.getElementById('campo-descricao');
const campoCategoria = document.getElementById('campo-categoria');
const estadoNovaSugestao = document.getElementById('estado-nova-sugestao');

const selectTema = document.getElementById('config-tema');
const selectOrdenacao = document.getElementById('config-ordenacao');

/* ------------------------------------------------------------------ */
/* Mensagens                                                           */
/* ------------------------------------------------------------------ */

function mostrarMensagem(texto, detalhes = []) {
  textoMensagem.textContent = detalhes.length > 0 ? `${texto} ${detalhes.join(' ')}` : texto;
  zonaMensagens.hidden = false;
}

function limparMensagem() {
  textoMensagem.textContent = '';
  zonaMensagens.hidden = true;
}

/* ------------------------------------------------------------------ */
/* Configurações (localStorage)                                        */
/* ------------------------------------------------------------------ */

function aplicarConfiguracoes() {
  document.documentElement.dataset.tema = configuracoes.tema;
  selectTema.value = configuracoes.tema;
  selectOrdenacao.value = configuracoes.ordenacao;

  // Se já houver sugestões no ecrã, voltar a mostrá-las com a nova ordenação
  if (sugestoesCarregadas) {
    mostrarSugestoes(sugestoesCarregadas);
  }
}

function alterarConfiguracao(opcao, valor) {
  configuracoes = { ...configuracoes, [opcao]: valor };
  guardarConfiguracoes(configuracoes); // guardar...
  aplicarConfiguracoes();               // ...e aplicar de imediato
}

selectTema.addEventListener('change', () => alterarConfiguracao('tema', selectTema.value));
selectOrdenacao.addEventListener('change', () => alterarConfiguracao('ordenacao', selectOrdenacao.value));

/* ------------------------------------------------------------------ */
/* Rascunho da nova sugestão (sessionStorage)                          */
/* ------------------------------------------------------------------ */

function guardarRascunho() {
  const rascunho = {
    titulo: campoTitulo.value,
    descricao: campoDescricao.value,
    categoria: campoCategoria.value
  };
  try {
    sessionStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(rascunho));
  } catch {
    // sessionStorage indisponível: o rascunho não é guardado
  }
}

function reporRascunho() {
  let rascunho = null;
  try {
    rascunho = JSON.parse(sessionStorage.getItem(CHAVE_RASCUNHO));
  } catch {
    rascunho = null;
  }

  if (!rascunho || typeof rascunho !== 'object') {
    return;
  }

  // O valor pode ter sido alterado à mão: aceitar apenas texto
  campoTitulo.value = typeof rascunho.titulo === 'string' ? rascunho.titulo : '';
  campoDescricao.value = typeof rascunho.descricao === 'string' ? rascunho.descricao : '';

  campoCategoria.value = typeof rascunho.categoria === 'string' ? rascunho.categoria : '';
  if (campoCategoria.value !== rascunho.categoria) {
    campoCategoria.value = ''; // categoria inexistente na lista
  }
}

function apagarRascunho() {
  try {
    sessionStorage.removeItem(CHAVE_RASCUNHO);
  } catch {
    // nada a fazer
  }
  formNovaSugestao.reset();
}

// Guardar enquanto o aluno escreve (input) e quando muda a categoria (change)
formNovaSugestao.addEventListener('input', guardarRascunho);
formNovaSugestao.addEventListener('change', guardarRascunho);

/* ------------------------------------------------------------------ */
/* Pedidos à API                                                       */
/* ------------------------------------------------------------------ */

/**
 * Faz um pedido à API. O cookie sessao é enviado automaticamente pelo browser
 * (mesma origem); não há cabeçalho Authorization.
 * @returns {Promise<Response|null>} null em caso de erro de rede
 */
async function pedirApi(url, opcoes = {}) {
  try {
    return await fetch(url, { credentials: 'same-origin', ...opcoes });
  } catch {
    mostrarMensagem('Não foi possível estabelecer ligação ao servidor. Verifique a rede.');
    return null;
  }
}

async function lerErro(resposta) {
  return resposta.json().catch(() => ({ erro: `Erro HTTP ${resposta.status}` }));
}

/* ------------------------------------------------------------------ */
/* Sessão (cookie)                                                     */
/* ------------------------------------------------------------------ */

/**
 * Inicia o relógio decrescente até à expiração da sessão
 * @param {number} instanteExpiracaoMs - instante de expiração em milissegundos
 */
function iniciarContador(instanteExpiracaoMs) {
  if (temporizadorExpiracao) {
    clearInterval(temporizadorExpiracao);
  }

  const atualizar = () => {
    const segundosRestantes = Math.floor((instanteExpiracaoMs - Date.now()) / 1000);

    if (segundosRestantes <= 0) {
      sessaoContagem.textContent = '00:00 (Expirado)';
      terminarSessao('Sessão expirada. É necessária nova autenticação.');
      return;
    }

    const min = Math.floor(segundosRestantes / 60);
    const seg = segundosRestantes % 60;
    sessaoContagem.textContent = `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
  };

  atualizar();
  temporizadorExpiracao = setInterval(atualizar, 1000);
}

/**
 * Mostra a área de sessão com os dados devolvidos pelo servidor (schema Sessao).
 * @param {{ utilizador: string, nome: string, papel: string, expiracao: string }} sessao
 */
function mostrarSessao(sessao) {
  campoPalavraPasse.value = '';

  sessaoSub.textContent = sessao.utilizador;
  sessaoNome.textContent = sessao.nome;
  sessaoPapel.textContent = sessao.papel;

  const dataExpiracao = new Date(sessao.expiracao);
  sessaoExpiracao.textContent = dataExpiracao.toLocaleTimeString('pt-PT');

  btnSugestoes.textContent = sessao.papel === 'servicos' ? 'Todas as sugestões' : 'As minhas sugestões';

  // Formulário «Nova sugestão» apenas para alunos; ao voltar a ser apresentado, repõe o rascunho
  const ehAluno = sessao.papel === 'aluno';
  blocoNovaSugestao.hidden = !ehAluno;
  estadoNovaSugestao.hidden = true;
  if (ehAluno) {
    reporRascunho();
  }

  areaEntrada.hidden = true;
  areaSessao.hidden = false;

  iniciarContador(dataExpiracao.getTime());
}

/**
 * Termina a sessão no cliente e volta ao ecrã de entrada.
 * O rascunho é apagado: pertence à sessão que terminou.
 * @param {string|null} mensagemAviso
 */
function terminarSessao(mensagemAviso = null) {
  if (temporizadorExpiracao) {
    clearInterval(temporizadorExpiracao);
    temporizadorExpiracao = null;
  }

  apagarRascunho();
  sugestoesCarregadas = null;

  campoPalavraPasse.value = '';
  areaSessao.hidden = true;
  areaEntrada.hidden = false;

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

/**
 * Ao abrir a página: GET /v2/sessao
 * - 200: já existe sessão (cookie válido) -> área de sessão
 * - 401: não existe sessão -> formulário de entrada
 */
async function verificarSessao() {
  const resposta = await pedirApi('/v2/sessao');

  if (resposta && resposta.status === 200) {
    mostrarSessao(await resposta.json());
  } else {
    terminarSessao();
  }
}

// Entrar: POST /v2/sessao (o servidor responde com Set-Cookie)
formLogin.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  limparMensagem();

  const utilizador = campoUtilizador.value.trim();
  const palavraPasse = campoPalavraPasse.value;

  const resposta = await pedirApi('/v2/sessao', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ utilizador, palavraPasse })
  });

  if (!resposta) {
    return;
  }

  if (resposta.status === 200) {
    mostrarSessao(await resposta.json());
  } else if (resposta.status === 400 || resposta.status === 401) {
    const erro = await lerErro(resposta);
    // Não distingue utilizador inexistente de palavra-passe errada
    mostrarMensagem(erro.erro || 'Falha na autenticação.', erro.detalhes || []);
  } else {
    mostrarMensagem('Ocorreu um erro inesperado no servidor.');
  }
});

// Terminar sessão: DELETE /v2/sessao (o servidor responde com Set-Cookie que apaga o cookie)
btnTerminar.addEventListener('click', async () => {
  await pedirApi('/v2/sessao', { method: 'DELETE' });
  terminarSessao();
});

/* ------------------------------------------------------------------ */
/* Sugestões                                                           */
/* ------------------------------------------------------------------ */

function ordenarSugestoes(itens) {
  const maisRecentePrimeiro = (a, b) => Date.parse(b.dataCriacao) - Date.parse(a.dataCriacao);
  const copia = [...itens];

  if (configuracoes.ordenacao === 'estado') {
    copia.sort((a, b) =>
      ORDEM_ESTADOS.indexOf(a.estado) - ORDEM_ESTADOS.indexOf(b.estado) || maisRecentePrimeiro(a, b));
  } else {
    copia.sort(maisRecentePrimeiro);
  }

  return copia;
}

function mostrarSugestoes(itens) {
  listaSugestoes.replaceChildren();

  if (itens.length === 0) {
    const pVazio = document.createElement('p');
    pVazio.className = 'estado-lista';
    pVazio.textContent = 'Nenhuma sugestão encontrada.';
    listaSugestoes.appendChild(pVazio);
    return;
  }

  // Conteúdo apresentado EXCLUSIVAMENTE com textContent (segurança contra XSS)
  ordenarSugestoes(itens).forEach(sugestao => {
    const cartao = document.createElement('div');
    cartao.className = 'cartao-sugestao';

    const tituloEl = document.createElement('h4');
    tituloEl.className = 'cartao-titulo';
    tituloEl.textContent = sugestao.titulo;

    const metaEl = document.createElement('div');
    metaEl.className = 'cartao-meta';

    const categoriaEl = document.createElement('span');
    categoriaEl.className = 'cartao-categoria';
    categoriaEl.textContent = `Categoria: ${sugestao.categoria}`;

    const estadoEl = document.createElement('span');
    estadoEl.className = 'cartao-estado';
    estadoEl.textContent = `Estado: ${sugestao.estado}`;

    const dataEl = document.createElement('span');
    dataEl.textContent = new Date(sugestao.dataCriacao).toLocaleDateString('pt-PT');

    metaEl.append(categoriaEl, estadoEl, dataEl);
    cartao.append(tituloEl, metaEl);
    listaSugestoes.appendChild(cartao);
  });
}

async function carregarSugestoes() {
  const resposta = await pedirApi('/v2/sugestoes');
  if (!resposta) {
    return;
  }

  if (resposta.status === 401) {
    terminarSessao('Sessão expirada. É necessária nova autenticação.');
    return;
  }

  if (!resposta.ok) {
    const erro = await lerErro(resposta);
    mostrarMensagem(erro.erro || `Erro HTTP ${resposta.status}`);
    return;
  }

  const dados = await resposta.json();
  sugestoesCarregadas = dados.itens || [];
  mostrarSugestoes(sugestoesCarregadas);
}

btnSugestoes.addEventListener('click', () => {
  limparMensagem();
  carregarSugestoes();
});

// Nova sugestão: POST /v2/sugestoes
formNovaSugestao.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  limparMensagem();
  estadoNovaSugestao.hidden = true;

  const resposta = await pedirApi('/v2/sugestoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      titulo: campoTitulo.value.trim(),
      descricao: campoDescricao.value.trim(),
      categoria: campoCategoria.value
    })
  });

  if (!resposta) {
    return; // erro de rede: o rascunho mantém-se
  }

  if (resposta.status === 201) {
    apagarRascunho(); // sugestão criada: o rascunho deixa de fazer sentido
    estadoNovaSugestao.textContent = 'Sugestão criada com sucesso.';
    estadoNovaSugestao.hidden = false;
    carregarSugestoes();
  } else if (resposta.status === 401) {
    terminarSessao('Sessão expirada. É necessária nova autenticação.');
  } else {
    const erro = await lerErro(resposta);
    mostrarMensagem(erro.erro || `Erro HTTP ${resposta.status}`, erro.detalhes || []);
  }
});

/* ------------------------------------------------------------------ */
/* Arranque                                                            */
/* ------------------------------------------------------------------ */

aplicarConfiguracoes();
verificarSessao();