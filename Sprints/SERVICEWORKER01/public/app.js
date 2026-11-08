
import { CONFIG } from './configuracoes.js';

import {
    abrirBD,
    substituirSugestoes,
    lerSugestoes,
    acrescentarPendente,
    lerPendentes,
    lerProprietario,
    guardarProprietario,
    limparBD,
    obterMeta
} from './bd.js';

import { enviarPendentes } from './pendente.js';

// --------------------------------------------------
// ELEMENTOS E VARIÁVEIS
// --------------------------------------------------

let estadoAplicacao = 'a-verificar';
let sessaoAtual = null;
let temporizadorSessao = null;
let registoSW = null;
let aRecarregar = false;

const elementoEstado = document.getElementById('estado-sessao');
const elementoAutenticacao = document.getElementById('autenticacao');
const elementoSugestoes = document.getElementById('area-sugestoes');

const formularioLogin = document.getElementById('form-login');
const formularioSugestao = document.getElementById('form-sugestao');

const mensagemLogin = document.getElementById('mensagem-login');
const mensagemSugestao = document.getElementById('mensagem-sugestao');

const campoUtilizador = document.getElementById('utilizador');
const campoPalavraPasse = document.getElementById('palavra-passe');

const campoTitulo = document.getElementById('titulo');
const campoDescricao = document.getElementById('descricao');

const seletorCategoria = document.getElementById('categoria');
const listaSugestoes = document.getElementById('lista-sugestoes');
const seletorOrdenacao = document.getElementById('ordenacao');
const botaoTerminar = document.getElementById('btn-terminar-sessao');
const botaoEntrar = formularioLogin.querySelector('button[type="submit"]');

const CHAVE_RASCUNHO = 'rascunho-sugestao';

// Elementos adicionais
const tituloSessao = elementoSugestoes.querySelector('h2');
tituloSessao.id = 'titulo-area-sessao';
tituloSessao.tabIndex = -1;

const elementoTempo = document.createElement('p');
elementoTempo.id = 'tempo-sessao';
elementoSugestoes.insertBefore(elementoTempo, formularioSugestao);

const elementoAtualizacao = document.createElement('p');
elementoAtualizacao.id = 'ultima-atualizacao';
elementoSugestoes.appendChild(elementoAtualizacao);

const elementoProprietario = document.createElement('p');
elementoProprietario.id = 'proprietario-copia';
elementoSugestoes.appendChild(elementoProprietario);

const botaoAtualizar = document.createElement('button');
botaoAtualizar.type = 'button';
botaoAtualizar.textContent = 'Atualizar a aplicação';
botaoAtualizar.hidden = true;
document.querySelector('header').appendChild(botaoAtualizar);

// Diálogo de confirmação
const dialogo = document.createElement('dialog');
dialogo.id = 'dialogo-terminar';

const textoDialogo = document.createElement('p');
textoDialogo.id = 'texto-dialogo';

const formularioDialogo = document.createElement('form');
formularioDialogo.method = 'dialog';

const botaoCancelar = document.createElement('button');
botaoCancelar.type = 'submit';
botaoCancelar.value = 'cancelar';
botaoCancelar.textContent = 'Cancelar';

const botaoConfirmar = document.createElement('button');
botaoConfirmar.type = 'submit';
botaoConfirmar.value = 'confirmar';
botaoConfirmar.textContent = 'Terminar sessão';

formularioDialogo.append(
    textoDialogo,
    botaoCancelar,
    botaoConfirmar
);

dialogo.appendChild(formularioDialogo);
document.body.appendChild(dialogo);

// --------------------------------------------------
// ESTADOS DA APLICAÇÃO
// --------------------------------------------------

function mudarEstado(estado, mensagem = '') {
    estadoAplicacao = estado;

    document.body.dataset.estado = estado;
    elementoEstado.textContent = mensagem;

    elementoAutenticacao.hidden = estado !== 'sem-sessao';

    elementoSugestoes.hidden =
        estado !== 'com-sessao' &&
        estado !== 'sem-ligacao';

    botaoTerminar.disabled = estado !== 'com-sessao';

    if (estado !== 'com-sessao') {
        pararContagemSessao();
    }

    if (estado === 'sem-ligacao') {
        botaoTerminar.title =
            'Não é possível terminar a sessão sem ligação ao servidor.';
    } else {
        botaoTerminar.title = '';
    }
}

// --------------------------------------------------
// RASCUNHO EM SESSION STORAGE
// --------------------------------------------------

function guardarRascunho() {
    const rascunho = {
        titulo: campoTitulo.value,
        descricao: campoDescricao.value,
        categoria: seletorCategoria.value
    };

    sessionStorage.setItem(
        CHAVE_RASCUNHO,
        JSON.stringify(rascunho)
    );
}

function recuperarRascunho() {
    const dados = sessionStorage.getItem(CHAVE_RASCUNHO);

    if (!dados) return;

    try {
        const rascunho = JSON.parse(dados);

        campoTitulo.value = rascunho.titulo || '';
        campoDescricao.value = rascunho.descricao || '';
        seletorCategoria.value = rascunho.categoria || '';

    } catch (erro) {
        console.error('Erro ao recuperar rascunho:', erro);
    }
}

function apagarRascunho() {
    sessionStorage.removeItem(CHAVE_RASCUNHO);
}

formularioSugestao.addEventListener('input', guardarRascunho);
seletorCategoria.addEventListener('change', guardarRascunho);

// --------------------------------------------------
// PROPRIETÁRIO DA CÓPIA LOCAL
// --------------------------------------------------

async function prepararUtilizador(sessao) {
    const proprietarioAnterior = await lerProprietario();

    if (
        proprietarioAnterior &&
        proprietarioAnterior.utilizador !== sessao.utilizador
    ) {
        await limparBD();
    }

    await guardarProprietario(sessao);
}

// --------------------------------------------------
// EXPIRAÇÃO DA SESSÃO
// --------------------------------------------------

function obterExpiracao(expiracao) {
    if (typeof expiracao === 'number') {
        return expiracao < 1000000000000
            ? expiracao * 1000
            : expiracao;
    }

    return new Date(expiracao).getTime();
}

function pararContagemSessao() {
    if (temporizadorSessao) {
        clearInterval(temporizadorSessao);
        temporizadorSessao = null;
    }

    elementoTempo.textContent = '';
}

function iniciarContagemSessao(expiracao) {
    pararContagemSessao();

    if (!expiracao) return;

    const atualizar = async () => {
        const restante = obterExpiracao(expiracao) - Date.now();

        if (restante <= 0) {
            await tratarSessaoExpirada();
            return;
        }

        const segundos = Math.floor(restante / 1000);
        const minutos = Math.floor(segundos / 60);
        const segundosRestantes = segundos % 60;

        elementoTempo.textContent =
            `Tempo restante da sessão: ${minutos} min ${segundosRestantes} s`;
    };

    atualizar();
    temporizadorSessao = setInterval(atualizar, 1000);
}

async function tratarSessaoExpirada(mensagem = 'A sessão expirou. Entre de novo.') {
    sessaoAtual = null;

    pararContagemSessao();

    mudarEstado('sem-sessao', mensagem);

    mensagemLogin.textContent = mensagem;

    await mostrarPendentes();
}

// --------------------------------------------------
// CATEGORIAS
// --------------------------------------------------

async function carregarCategorias() {
    try {
        const resposta = await fetch(`${CONFIG.API_URL}/categorias`, {
            method: 'GET',
            cache: 'no-store'
        });

        if (!resposta.ok) {
            throw new Error('Não foi possível carregar as categorias.');
        }

        const resultado = await resposta.json();

        const categorias = Array.isArray(resultado)
            ? resultado
            : resultado.categorias || resultado.itens || [];

        preencherCategorias(categorias);

    } catch (erro) {
        console.error(erro);

        seletorCategoria.replaceChildren();

        const opcao = document.createElement('option');
        opcao.value = '';
        opcao.textContent = 'Categorias indisponíveis';

        seletorCategoria.appendChild(opcao);
        seletorCategoria.disabled = true;

        mensagemSugestao.textContent =
            'Não foi possível carregar as categorias.';
    }
}

function preencherCategorias(categorias) {
    seletorCategoria.replaceChildren();

    const opcaoInicial = document.createElement('option');
    opcaoInicial.value = '';
    opcaoInicial.textContent = 'Escolhe uma categoria';

    seletorCategoria.appendChild(opcaoInicial);

    if (!categorias.length) {
        seletorCategoria.disabled = true;
        mensagemSugestao.textContent =
            'Não existem categorias disponíveis.';
        return;
    }

    seletorCategoria.disabled = false;

    categorias.forEach((categoria) => {
        const opcao = document.createElement('option');

        opcao.value = categoria.codigo ?? categoria.id;
        opcao.textContent = categoria.descricao ?? categoria.nome;

        seletorCategoria.appendChild(opcao);
    });

    recuperarRascunho();
}

// --------------------------------------------------
// VERIFICAR SESSÃO
// --------------------------------------------------

async function verificarSessao() {
    mudarEstado('a-verificar', 'A verificar sessão…');

    try {
        const resposta = await fetch(`${CONFIG.API_URL}/sessao`, {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store'
        });

        if (resposta.status === 401) {
            sessaoAtual = null;
            mudarEstado('sem-sessao', 'Não tens sessão iniciada.');
            return;
        }

        if (!resposta.ok) {
            throw new Error('Erro ao verificar a sessão.');
        }

        const sessao = await resposta.json();

        if (
            sessao.expiracao &&
            obterExpiracao(sessao.expiracao) <= Date.now()
        ) {
            await tratarSessaoExpirada();
            return;
        }

        await prepararUtilizador(sessao);

        sessaoAtual = sessao;

        mudarEstado(
            'com-sessao',
            `Sessão iniciada: ${sessao.nome}`
        );

        iniciarContagemSessao(sessao.expiracao);

        recuperarRascunho();

        await carregarSugestoes();

        if (estadoAplicacao === 'com-sessao') {
            await enviarPendentes();
        }

        await mostrarPendentes();

    } catch (erro) {
        console.error(erro);

        sessaoAtual = null;

        mudarEstado('sem-ligacao', 'Sem ligação ao servidor.');

        await mostrarCopiaLocal();
    }
}

// --------------------------------------------------
// INICIAR SESSÃO
// --------------------------------------------------

formularioLogin.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    botaoEntrar.disabled = true;
    botaoEntrar.textContent = 'A entrar…';

    mensagemLogin.textContent = 'A iniciar sessão…';

    const utilizador = campoUtilizador.value.trim();
    const palavraPasse = campoPalavraPasse.value;

    try {
        const resposta = await fetch(`${CONFIG.API_URL}/sessao`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                utilizador,
                palavraPasse
            })
        });

        if (resposta.status === 400 || resposta.status === 401) {
            let mensagem = 'Utilizador ou palavra-passe incorretos.';

            try {
                const dadosErro = await resposta.json();

                mensagem =
                    dadosErro.erro?.mensagem ||
                    dadosErro.erro ||
                    dadosErro.mensagem ||
                    mensagem;

            } catch {}

            mensagemLogin.textContent = mensagem;

            campoPalavraPasse.value = '';
            campoPalavraPasse.focus();

            return;
        }

        if (!resposta.ok) {
            throw new Error('Erro ao iniciar sessão.');
        }

        const sessao = await resposta.json();

        await prepararUtilizador(sessao);

        sessaoAtual = sessao;

        mensagemLogin.textContent = '';

        mudarEstado(
            'com-sessao',
            `Sessão iniciada: ${sessao.nome}`
        );

        iniciarContagemSessao(sessao.expiracao);

        recuperarRascunho();

        tituloSessao.focus();

        await carregarSugestoes();

        if (estadoAplicacao === 'com-sessao') {
            await enviarPendentes();
        }

        await mostrarPendentes();

    } catch (erro) {
        console.error(erro);

        sessaoAtual = null;

        mudarEstado(
            'sem-ligacao',
            'Sem ligação: não é possível entrar.'
        );

        mensagemLogin.textContent =
            'Sem ligação: não é possível entrar.';

        await mostrarCopiaLocal();

    } finally {
        botaoEntrar.disabled = false;
        botaoEntrar.textContent = 'Entrar';
    }
});

// --------------------------------------------------
// CARREGAR SUGESTÕES DO SERVIDOR
// --------------------------------------------------

async function carregarSugestoes() {
    try {
        const resposta = await fetch(`${CONFIG.API_URL}/sugestoes`, {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store'
        });

        if (resposta.status === 401) {
            await tratarSessaoExpirada();
            return;
        }

        if (!resposta.ok) {
            throw new Error('Erro ao carregar sugestões.');
        }

        const resultado = await resposta.json();

        const sugestoes = Array.isArray(resultado)
            ? resultado
            : resultado.itens || resultado.dados || resultado.sugestoes || [];

        await substituirSugestoes(sugestoes);

        await atualizarDataLocal();

        await apresentarSugestoesLocais();

    } catch (erro) {
        console.error(erro);

        await apresentarSugestoesLocais();
    }
}

// --------------------------------------------------
// APRESENTAR SUGESTÕES LOCAIS
// --------------------------------------------------

async function atualizarDataLocal() {
    const registo = await obterMeta('atualizadoEm');

    if (!registo || !registo.valor) {
        elementoAtualizacao.textContent = '';
        return;
    }

    const data = new Date(registo.valor);

    elementoAtualizacao.textContent =
        `Última atualização: ${data.toLocaleString('pt-PT')}`;
}

async function apresentarSugestoesLocais() {
    const ordenacao = localStorage.getItem('ordenacao') || 'recentes';

    const sugestoes = await lerSugestoes(ordenacao);

    apresentarSugestoes(sugestoes);
}

seletorOrdenacao.value = localStorage.getItem('ordenacao') || 'recentes';


seletorOrdenacao.addEventListener('change', async () => {
    localStorage.setItem('ordenacao', seletorOrdenacao.value);

    await mostrarPendentes();
});

function criarArtigo(tituloTexto, descricaoTexto, estadoTexto) {
    const artigo = document.createElement('article');

    const titulo = document.createElement('h3');
    titulo.textContent = tituloTexto || '';

    const descricao = document.createElement('p');
    descricao.textContent = descricaoTexto || '';

    const estado = document.createElement('p');
    estado.textContent = estadoTexto || '';

    artigo.append(titulo, descricao, estado);

    return artigo;
}

function apresentarSugestoes(sugestoes) {
    const artigosPendentes = Array.from(listaSugestoes.children)
        .filter((artigo) => artigo.dataset.tipo === 'pendente');

    listaSugestoes.replaceChildren();

    artigosPendentes.forEach((artigo) => {
        listaSugestoes.appendChild(artigo);
    });

    if (!sugestoes.length) {
        const mensagem = document.createElement('p');
        mensagem.textContent = 'Ainda não existem sugestões.';

        listaSugestoes.appendChild(mensagem);
        return;
    }

    sugestoes.forEach((sugestao) => {
        const artigo = criarArtigo(
            sugestao.titulo,
            sugestao.descricao,
            `Categoria: ${sugestao.categoria || ''} | Estado: ${sugestao.estado || 'Sem estado indicado'}`
        );

        artigo.dataset.tipo = 'sugestao';

        listaSugestoes.appendChild(artigo);
    });
}

// --------------------------------------------------
// SUGESTÕES PENDENTES
// --------------------------------------------------

async function mostrarPendentes() {
    const pendentes = await lerPendentes();
    const proprietario = await lerProprietario();

    const pendentesDoUtilizador = proprietario
        ? pendentes.filter(
            (pendente) =>
                pendente.utilizador === proprietario.utilizador
        )
        : [];

    const sugestoes = await lerSugestoes(
        localStorage.getItem('ordenacao') || 'recentes'
    );

    listaSugestoes.replaceChildren();

    pendentesDoUtilizador.forEach((pendente) => {
        const artigo = criarArtigo(
            pendente.titulo,
            pendente.descricao,
            pendente.erro
                ? `Erro: ${pendente.erro}`
                : 'Por enviar'
        );

        artigo.dataset.tipo = 'pendente';

        const botaoDescartar = document.createElement('button');
        botaoDescartar.type = 'button';
        botaoDescartar.textContent = 'Descartar';

        botaoDescartar.addEventListener('click', async () => {
            await descartarPendente(pendente.idLocal);
            await mostrarPendentes();
        });

        artigo.appendChild(botaoDescartar);
        listaSugestoes.appendChild(artigo);
    });

    if (!sugestoes.length) {
        const mensagem = document.createElement('p');
        mensagem.textContent = 'Ainda não existem sugestões.';

        listaSugestoes.appendChild(mensagem);
    } else {
        sugestoes.forEach((sugestao) => {
            const artigo = criarArtigo(
                sugestao.titulo,
                sugestao.descricao,
                `Categoria: ${sugestao.categoria || ''} | Estado: ${sugestao.estado || 'Sem estado indicado'}`
            );

            artigo.dataset.tipo = 'sugestao';

            listaSugestoes.appendChild(artigo);
        });
    }
}

async function descartarPendente(idLocal) {
    const bd = await abrirBD();

    return new Promise((resolve, reject) => {
        const transacao = bd.transaction('pendentes', 'readwrite');

        transacao.objectStore('pendentes').delete(idLocal);

        transacao.oncomplete = () => {
            bd.close();
            resolve();
        };

        transacao.onerror = () => {
            bd.close();
            reject(transacao.error);
        };

        transacao.onabort = () => {
            bd.close();
            reject(transacao.error);
        };
    });
}

// --------------------------------------------------
// CÓPIA LOCAL SEM LIGAÇÃO
// --------------------------------------------------

async function mostrarCopiaLocal() {
    const proprietario = await lerProprietario();

    if (
        !proprietario ||
        !proprietario.expiracao ||
        obterExpiracao(proprietario.expiracao) <= Date.now()
    ) {
        elementoSugestoes.hidden = true;
        return;
    }

    elementoSugestoes.hidden = false;

    elementoProprietario.textContent =
        `Cópia local de ${proprietario.nome}. Pode estar desatualizada.`;

    await atualizarDataLocal();

    await mostrarPendentes();
}

// --------------------------------------------------
// CRIAR SUGESTÃO
// --------------------------------------------------

formularioSugestao.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const sugestao = {
        titulo: campoTitulo.value.trim(),
        descricao: campoDescricao.value.trim(),
        categoria: seletorCategoria.value
    };

    if (
        !sugestao.titulo ||
        !sugestao.descricao ||
        !sugestao.categoria
    ) {
        mensagemSugestao.textContent =
            'Preenche todos os campos.';
        return;
    }

    // Criar offline
    if (
        estadoAplicacao === 'sem-ligacao' ||
        !navigator.onLine
    ) {
        const proprietario = await lerProprietario();

        if (
            !proprietario ||
            !proprietario.utilizador ||
            !proprietario.expiracao ||
            obterExpiracao(proprietario.expiracao) <= Date.now()
        ) {
            mensagemSugestao.textContent =
                'Não existe uma sessão válida para guardar sugestões offline.';
            return;
        }

        await acrescentarPendente(
            sugestao,
            proprietario.utilizador
        );

        apagarRascunho();
        formularioSugestao.reset();

        mensagemSugestao.textContent =
            'Sugestão guardada para envio posterior.';

        await mostrarPendentes();
        return;
    }

    if (!sessaoAtual) {
        mensagemSugestao.textContent =
            'É necessário iniciar sessão.';
        return;
    }

    mensagemSugestao.textContent = 'A enviar sugestão…';

    try {
        const resposta = await fetch(`${CONFIG.API_URL}/sugestoes`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sugestao)
        });

        if (resposta.status === 401) {
            await tratarSessaoExpirada();
            return;
        }

        if (resposta.status === 400) {
            const dadosErro = await resposta.json();

            mensagemSugestao.textContent =
                dadosErro.erro?.mensagem ||
                dadosErro.erro ||
                'Dados inválidos.';

            return;
        }

        if (resposta.status !== 201) {
            throw new Error('Não foi possível enviar a sugestão.');
        }

        const resultado = await resposta.json();

        await guardarSugestaoLocal(resultado);

        apagarRascunho();
        formularioSugestao.reset();

        mensagemSugestao.textContent =
            'Sugestão enviada com sucesso!';

        await carregarSugestoes();
        await mostrarPendentes();

    } catch (erro) {
        console.error(erro);

        await acrescentarPendente(
            sugestao,
            sessaoAtual.utilizador
        );

        apagarRascunho();
        formularioSugestao.reset();

        mensagemSugestao.textContent =
            'Sem ligação. A sugestão ficou guardada para envio posterior.';

        await mostrarPendentes();
    }
});

async function guardarSugestaoLocal(sugestao) {
    const { guardarSugestao } = await import('./bd.js');
    await guardarSugestao(sugestao);
}

// --------------------------------------------------
// TERMINAR SESSÃO
// --------------------------------------------------

botaoTerminar.addEventListener('click', async () => {
    const pendentes = await lerPendentes();
    const proprietario = await lerProprietario();

    const quantidade = proprietario
        ? pendentes.filter(
            (pendente) =>
                pendente.utilizador === proprietario.utilizador
        ).length
        : 0;

    if (quantidade > 0) {
        textoDialogo.textContent =
            `Há ${quantidade} sugestões por enviar, que serão apagadas. Terminar sessão?`;

        dialogo.showModal();

        const resultado = await new Promise((resolve) => {
            dialogo.addEventListener(
                'close',
                () => resolve(dialogo.returnValue),
                { once: true }
            );
        });

        if (resultado !== 'confirmar') {
            return;
        }
    }

    try {
        const resposta = await fetch(`${CONFIG.API_URL}/sessao`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });

        if (resposta.status === 401) {
            await tratarSessaoExpirada();
            return;
        }

        if (resposta.status !== 204) {
            throw new Error('Não foi possível terminar a sessão.');
        }

        sessaoAtual = null;

        pararContagemSessao();

        await limparBD();
        apagarRascunho();

        mudarEstado('sem-sessao', 'Sessão terminada.');

        mensagemLogin.textContent = '';
        campoUtilizador.focus();

    } catch (erro) {
        console.error(erro);

        mudarEstado(
            'sem-ligacao',
            'Sem ligação: não é possível terminar sessão.'
        );

        await mostrarCopiaLocal();
    }
});

// --------------------------------------------------
// EVENTO DE SESSÃO EXPIRADA NAS PENDENTES
// --------------------------------------------------

window.addEventListener('sessao-expirada', async (evento) => {
    const quantidade = evento.detail?.quantidade || 0;

    await tratarSessaoExpirada(
        `Há ${quantidade} sugestões por enviar. Entre de novo para as enviar.`
    );
});

// --------------------------------------------------
// EVENTOS DE LIGAÇÃO
// --------------------------------------------------

window.addEventListener('online', async () => {
    elementoEstado.textContent =
        'Ligação disponível. A verificar sessão…';

    await verificarSessao();
});

window.addEventListener('offline', () => {
    elementoEstado.textContent = 'Sem ligação à Internet.';
    botaoTerminar.disabled = true;
});

// --------------------------------------------------
// SERVICE WORKER E ATUALIZAÇÕES
// --------------------------------------------------

async function prepararAtualizacao() {
    if (!('serviceWorker' in navigator)) {
        return;
    }

    try {
        registoSW = await navigator.serviceWorker.register('/sw.js');

        if (registoSW.waiting) {
            botaoAtualizar.hidden = false;
        }

        registoSW.addEventListener('updatefound', () => {
            const novoWorker = registoSW.installing;

            if (!novoWorker) return;

            novoWorker.addEventListener('statechange', () => {
                if (
                    novoWorker.state === 'installed' &&
                    navigator.serviceWorker.controller
                ) {
                    botaoAtualizar.hidden = false;
                }
            });
        });

        navigator.serviceWorker.addEventListener(
            'controllerchange',
            () => {
                if (aRecarregar) {
                    window.location.reload();
                }
            }
        );

    } catch (erro) {
        console.error('Erro ao registar Service Worker:', erro);
    }
}

botaoAtualizar.addEventListener('click', () => {
    if (!registoSW || !registoSW.waiting) {
        return;
    }

    aRecarregar = true;

    registoSW.waiting.postMessage({
        tipo: 'ativar'
    });
});

// --------------------------------------------------
// INICIAR A APLICAÇÃO
// --------------------------------------------------

async function iniciarAplicacao() {
    mudarEstado('a-verificar', 'A verificar sessão…');

    await prepararAtualizacao();

    await carregarCategorias();

    await verificarSessao();
}

iniciarAplicacao();


