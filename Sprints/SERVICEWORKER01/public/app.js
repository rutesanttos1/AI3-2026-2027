
// Importa o objeto CONFIG, que contém as configurações da aplicação,
// nomeadamente o endereço base da API do servidor.
import { CONFIG } from './configuracoes.js';

// Importa as funções responsáveis por comunicar com a IndexedDB,
// que é a base de dados local do navegador.
import {
    abrirBD,               // Abre a ligação à base de dados local.
    substituirSugestoes,   // Substitui as sugestões guardadas localmente.
    lerSugestoes,          // Consulta as sugestões guardadas.
    acrescentarPendente,   // Guarda uma sugestão que ainda não foi enviada.
    lerPendentes,          // Consulta as sugestões pendentes.
    lerProprietario,       // Consulta o utilizador dono da cópia local.
    guardarProprietario,   // Guarda o utilizador associado à cópia local.
    limparBD,              // Limpa os dados da base de dados local.
    obterMeta              // Consulta informações adicionais da IndexedDB.
} from './bd.js';

// Importa a função que tenta enviar as sugestões pendentes para o servidor.
import { enviarPendentes } from './pendente.js';


// --------------------------------------------------
// ELEMENTOS E VARIÁVEIS
// --------------------------------------------------

// Guarda o estado atual da aplicação.
// Começa em "a-verificar", porque ainda é necessário verificar a sessão.
let estadoAplicacao = 'a-verificar';

// Guarda os dados do utilizador com sessão iniciada.
// Começa com null porque ainda não existe uma sessão confirmada.
let sessaoAtual = null;

// Guarda o identificador do temporizador da sessão.
// Permite atualizar a contagem decrescente e pará-la quando necessário.
let temporizadorSessao = null;

// Guarda o registo do Service Worker.
// É utilizado para controlar as atualizações da aplicação.
let registoSW = null;

// Indica se a aplicação está a aguardar uma atualização
// do Service Worker para depois recarregar a página.
let aRecarregar = false;


// Obtém os elementos HTML através dos seus IDs.
// O document.getElementById() permite aceder a elementos da página.

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

// Obtém o botão de submissão do formulário de login.
const botaoEntrar = formularioLogin.querySelector('button[type="submit"]');

// Define a chave utilizada para guardar o rascunho no sessionStorage.
// O sessionStorage permite guardar dados temporários durante a sessão do separador.
const CHAVE_RASCUNHO = 'rascunho-sugestao';


// Elementos adicionais criados através de JavaScript.

// Obtém o título da área das sugestões.
const tituloSessao = elementoSugestoes.querySelector('h2');

// Define um ID para o título, permitindo identificá-lo e focá-lo.
tituloSessao.id = 'titulo-area-sessao';

// Permite que o elemento receba foco através de JavaScript.
tituloSessao.tabIndex = -1;

// Cria um parágrafo para apresentar o tempo restante da sessão.
const elementoTempo = document.createElement('p');
elementoTempo.id = 'tempo-sessao';

// Insere o parágrafo antes do formulário de sugestões.
elementoSugestoes.insertBefore(elementoTempo, formularioSugestao);

// Cria um parágrafo para apresentar a data da última atualização.
const elementoAtualizacao = document.createElement('p');
elementoAtualizacao.id = 'ultima-atualizacao';
elementoSugestoes.appendChild(elementoAtualizacao);

// Cria um parágrafo para identificar o proprietário da cópia local.
const elementoProprietario = document.createElement('p');
elementoProprietario.id = 'proprietario-copia';
elementoSugestoes.appendChild(elementoProprietario);

// Cria dinamicamente o botão de atualização da aplicação.
const botaoAtualizar = document.createElement('button');
botaoAtualizar.type = 'button';
botaoAtualizar.textContent = 'Atualizar a aplicação';

// O botão começa escondido e só aparece quando existe uma atualização disponível.
botaoAtualizar.hidden = true;

// Adiciona o botão ao cabeçalho da página.
document.querySelector('header').appendChild(botaoAtualizar);


// Diálogo de confirmação para terminar a sessão.

// Cria um elemento HTML <dialog>, utilizado para apresentar uma janela de confirmação.
const dialogo = document.createElement('dialog');
dialogo.id = 'dialogo-terminar';

// Cria o texto que será apresentado dentro da janela.
const textoDialogo = document.createElement('p');
textoDialogo.id = 'texto-dialogo';

// Cria um formulário associado ao diálogo.
// method="dialog" permite fechar o diálogo quando um botão é submetido.
const formularioDialogo = document.createElement('form');
formularioDialogo.method = 'dialog';

// Cria o botão para cancelar a operação.
const botaoCancelar = document.createElement('button');
botaoCancelar.type = 'submit';
botaoCancelar.value = 'cancelar';
botaoCancelar.textContent = 'Cancelar';

// Cria o botão para confirmar o fim da sessão.
const botaoConfirmar = document.createElement('button');
botaoConfirmar.type = 'submit';
botaoConfirmar.value = 'confirmar';
botaoConfirmar.textContent = 'Terminar sessão';

// Adiciona o texto e os dois botões ao formulário do diálogo.
formularioDialogo.append(
    textoDialogo,
    botaoCancelar,
    botaoConfirmar
);

// Coloca o formulário dentro do diálogo.
dialogo.appendChild(formularioDialogo);

// Adiciona o diálogo ao corpo da página.
document.body.appendChild(dialogo);


// --------------------------------------------------
// ESTADOS DA APLICAÇÃO
// --------------------------------------------------

function mudarEstado(estado, mensagem = '') {

    // Atualiza a variável que guarda o estado atual.
    estadoAplicacao = estado;

    // Guarda o estado também como atributo data-estado no HTML.
    // Pode ser utilizado pelo CSS para alterar a aparência da aplicação.
    document.body.dataset.estado = estado;

    // Apresenta a mensagem correspondente ao estado.
    elementoEstado.textContent = mensagem;

    // O formulário de autenticação só aparece quando não existe sessão.
    elementoAutenticacao.hidden = estado !== 'sem-sessao';

    // A área das sugestões só aparece quando existe sessão
    // ou quando a aplicação está sem ligação à Internet.
    elementoSugestoes.hidden =
        estado !== 'com-sessao' &&
        estado !== 'sem-ligacao';

    // O botão de terminar sessão só fica ativo quando existe sessão.
    botaoTerminar.disabled = estado !== 'com-sessao';

    // Se deixar de existir uma sessão ativa,
    // interrompe a contagem decrescente.
    if (estado !== 'com-sessao') {
        pararContagemSessao();
    }

    // Se estiver sem ligação, explica porque não é possível terminar sessão.
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

    // Cria um objeto com os dados que o utilizador já escreveu.
    const rascunho = {
        titulo: campoTitulo.value,
        descricao: campoDescricao.value,
        categoria: seletorCategoria.value
    };

    // Converte o objeto JavaScript para texto JSON
    // e guarda-o no sessionStorage.
    sessionStorage.setItem(
        CHAVE_RASCUNHO,
        JSON.stringify(rascunho)
    );
}

function recuperarRascunho() {

    // Vai buscar ao sessionStorage o rascunho anteriormente guardado.
    const dados = sessionStorage.getItem(CHAVE_RASCUNHO);

    // Se não existir nenhum rascunho, termina a função.
    if (!dados) return;

    try {

        // Converte o texto JSON novamente num objeto JavaScript.
        const rascunho = JSON.parse(dados);

        // Preenche novamente os campos com os valores guardados.
        // O operador || '' evita deixar valores undefined ou null.
        campoTitulo.value = rascunho.titulo || '';
        campoDescricao.value = rascunho.descricao || '';
        seletorCategoria.value = rascunho.categoria || '';

    } catch (erro) {

        // Apresenta o erro na consola se não for possível recuperar o rascunho.
        console.error('Erro ao recuperar rascunho:', erro);
    }
}

function apagarRascunho() {

    // Remove o rascunho guardado no sessionStorage.
    sessionStorage.removeItem(CHAVE_RASCUNHO);
}

// Sempre que o utilizador escreve ou altera um campo do formulário,
// o rascunho é automaticamente guardado.
formularioSugestao.addEventListener('input', guardarRascunho);

// Guarda também o rascunho quando é alterada a categoria.
seletorCategoria.addEventListener('change', guardarRascunho);


// --------------------------------------------------
// PROPRIETÁRIO DA CÓPIA LOCAL
// --------------------------------------------------

async function prepararUtilizador(sessao) {

    // Consulta quem é o utilizador associado aos dados locais.
    const proprietarioAnterior = await lerProprietario();

    // Verifica se já existe um proprietário e se é diferente
    // do utilizador que acabou de iniciar sessão.
    if (
        proprietarioAnterior &&
        proprietarioAnterior.utilizador !== sessao.utilizador
    ) {

        // Se for outro utilizador, limpa a base de dados local
        // para impedir que este veja dados de outra conta.
        await limparBD();
    }

    // Guarda a sessão do utilizador atual como proprietário da cópia local.
    await guardarProprietario(sessao);
}


// --------------------------------------------------
// EXPIRAÇÃO DA SESSÃO
// --------------------------------------------------

function obterExpiracao(expiracao) {

    // Verifica se a data de expiração recebida é um número.
    if (typeof expiracao === 'number') {

        // Se for um número pequeno, considera que está em segundos
        // e converte para milissegundos.
        // Se já estiver em milissegundos, mantém o valor.
        return expiracao < 1000000000000
            ? expiracao * 1000
            : expiracao;
    }

    // Se for uma data em formato texto,
    // converte-a para milissegundos através de Date.
    return new Date(expiracao).getTime();
}

function pararContagemSessao() {

    // Verifica se existe um temporizador ativo.
    if (temporizadorSessao) {

        // clearInterval() interrompe a execução repetida do temporizador.
        clearInterval(temporizadorSessao);

        // Coloca novamente a variável a null.
        temporizadorSessao = null;
    }

    // Limpa o texto apresentado na contagem da sessão.
    elementoTempo.textContent = '';
}

function iniciarContagemSessao(expiracao) {

    // Interrompe uma contagem anterior antes de iniciar outra.
    pararContagemSessao();

    // Se não existir data de expiração, não inicia a contagem.
    if (!expiracao) return;

    // Função responsável por calcular e apresentar o tempo restante.
    const atualizar = async () => {

        // Calcula a diferença entre a data de expiração e a hora atual.
        const restante = obterExpiracao(expiracao) - Date.now();

        // Se o tempo restante for zero ou negativo,
        // significa que a sessão já expirou.
        if (restante <= 0) {
            await tratarSessaoExpirada();
            return;
        }

        // Converte o tempo restante de milissegundos para segundos.
        const segundos = Math.floor(restante / 1000);

        // Calcula os minutos completos.
        const minutos = Math.floor(segundos / 60);

        // Calcula os segundos que sobram depois de retirar os minutos.
        const segundosRestantes = segundos % 60;

        // Apresenta o tempo restante no ecrã.
        elementoTempo.textContent =
            `Tempo restante da sessão: ${minutos} min ${segundosRestantes} s`;
    };

    // Executa imediatamente a primeira atualização.
    atualizar();

    // Executa novamente a função a cada segundo (1000 milissegundos).
    temporizadorSessao = setInterval(atualizar, 1000);
}

async function tratarSessaoExpirada(mensagem = 'A sessão expirou. Entre de novo.') {

    // Elimina os dados da sessão atual da memória da aplicação.
    sessaoAtual = null;

    // Interrompe a contagem decrescente.
    pararContagemSessao();

    // Altera o estado para indicar que não existe sessão.
    mudarEstado('sem-sessao', mensagem);

    // Apresenta a mensagem no formulário de autenticação.
    mensagemLogin.textContent = mensagem;

    // Atualiza a apresentação das sugestões pendentes.
    await mostrarPendentes();
}


// --------------------------------------------------
// CATEGORIAS
// --------------------------------------------------

async function carregarCategorias() {

    try {

        // Faz um pedido GET à API para obter as categorias disponíveis.
        const resposta = await fetch(`${CONFIG.API_URL}/categorias`, {
            method: 'GET',

            // Solicita que o navegador não utilize uma resposta HTTP em cache.
            cache: 'no-store'
        });

        // Verifica se a resposta HTTP foi bem-sucedida.
        if (!resposta.ok) {
            throw new Error('Não foi possível carregar as categorias.');
        }

        // Converte a resposta do servidor de JSON para objeto JavaScript.
        const resultado = await resposta.json();

        // Aceita diferentes estruturas de resposta:
        // um array direto ou um objeto com categorias ou itens.
        const categorias = Array.isArray(resultado)
            ? resultado
            : resultado.categorias || resultado.itens || [];

        // Envia as categorias para a função que cria as opções do seletor.
        preencherCategorias(categorias);

    } catch (erro) {

        // Mostra o erro na consola do navegador.
        console.error(erro);

        // Remove as opções anteriores do seletor.
        seletorCategoria.replaceChildren();

        // Cria uma opção a informar que as categorias não estão disponíveis.
        const opcao = document.createElement('option');
        opcao.value = '';
        opcao.textContent = 'Categorias indisponíveis';

        // Adiciona a opção ao seletor.
        seletorCategoria.appendChild(opcao);

        // Desativa o seletor para impedir a escolha de categorias.
        seletorCategoria.disabled = true;

        // Informa o utilizador do problema.
        mensagemSugestao.textContent =
            'Não foi possível carregar as categorias.';
    }
}

function preencherCategorias(categorias) {

    // Remove todas as opções anteriores do seletor.
    seletorCategoria.replaceChildren();

    // Cria a primeira opção, que funciona como instrução para o utilizador.
    const opcaoInicial = document.createElement('option');
    opcaoInicial.value = '';
    opcaoInicial.textContent = 'Escolhe uma categoria';

    // Adiciona a opção inicial ao seletor.
    seletorCategoria.appendChild(opcaoInicial);

    // Verifica se o servidor devolveu pelo menos uma categoria.
    if (!categorias.length) {

        // Desativa o seletor caso não existam categorias.
        seletorCategoria.disabled = true;

        // Informa o utilizador.
        mensagemSugestao.textContent =
            'Não existem categorias disponíveis.';
        return;
    }

    // Se existirem categorias, ativa o seletor.
    seletorCategoria.disabled = false;

    // Percorre todas as categorias recebidas do servidor.
    categorias.forEach((categoria) => {

        // Cria uma nova opção HTML para cada categoria.
        const opcao = document.createElement('option');

        // Define o valor da opção.
        // Utiliza codigo ou, caso não exista, id.
        opcao.value = categoria.codigo ?? categoria.id;

        // Define o texto visível.
        // Utiliza descricao ou, caso não exista, nome.
        opcao.textContent = categoria.descricao ?? categoria.nome;

        // Adiciona a opção ao seletor.
        seletorCategoria.appendChild(opcao);
    });

    // Depois de carregar as categorias, tenta recuperar o rascunho.
    recuperarRascunho();
}


// --------------------------------------------------
// VERIFICAR SESSÃO
// --------------------------------------------------

async function verificarSessao() {

    // Informa que a aplicação está a verificar se existe uma sessão válida.
    mudarEstado('a-verificar', 'A verificar sessão…');

    try {

        // Faz um pedido GET ao servidor para verificar a sessão atual.
        const resposta = await fetch(`${CONFIG.API_URL}/sessao`, {
            method: 'GET',

            // Permite enviar os cookies associados ao mesmo site.
            credentials: 'same-origin',

            // Evita utilizar uma resposta antiga em cache.
            cache: 'no-store'
        });

        // O código HTTP 401 significa que não existe uma sessão válida.
        if (resposta.status === 401) {
            sessaoAtual = null;
            mudarEstado('sem-sessao', 'Não tens sessão iniciada.');
            return;
        }

        // Se a resposta não for bem-sucedida,
        // lança um erro para ser tratado no catch.
        if (!resposta.ok) {
            throw new Error('Erro ao verificar a sessão.');
        }

        // Converte os dados da sessão recebidos em JSON.
        const sessao = await resposta.json();

        // Verifica se a sessão já ultrapassou a data de expiração.
        if (
            sessao.expiracao &&
            obterExpiracao(sessao.expiracao) <= Date.now()
        ) {
            await tratarSessaoExpirada();
            return;
        }

        // Verifica se a cópia local pertence ao mesmo utilizador.
        await prepararUtilizador(sessao);

        // Guarda a sessão recebida do servidor.
        sessaoAtual = sessao;

        // Altera o estado para sessão iniciada.
        mudarEstado(
            'com-sessao',
            `Sessão iniciada: ${sessao.nome}`
        );

        // Inicia a contagem decrescente da sessão.
        iniciarContagemSessao(sessao.expiracao);

        // Recupera um possível rascunho guardado.
        recuperarRascunho();

        // Carrega as sugestões do servidor.
        await carregarSugestoes();

        // Se continuar autenticado, tenta enviar sugestões pendentes.
        if (estadoAplicacao === 'com-sessao') {
            await enviarPendentes();
        }

        // Atualiza a lista de sugestões e das que ainda estão pendentes.
        await mostrarPendentes();

    } catch (erro) {

        // Mostra o erro na consola.
        console.error(erro);

        // Remove a sessão da memória da aplicação.
        sessaoAtual = null;

        // Altera o estado para indicar falta de ligação.
        mudarEstado('sem-ligacao', 'Sem ligação ao servidor.');

        // Tenta apresentar os dados que existem guardados localmente.
        await mostrarCopiaLocal();
    }
}


// --------------------------------------------------
// INICIAR SESSÃO
// --------------------------------------------------

// Adiciona um evento ao formulário de login.
// É executado quando o utilizador carrega no botão Entrar.
formularioLogin.addEventListener('submit', async (evento) => {

    // Impede o comportamento normal do formulário,
    // que seria recarregar a página.
    evento.preventDefault();

    // Desativa temporariamente o botão para evitar vários pedidos.
    botaoEntrar.disabled = true;

    // Altera o texto do botão enquanto o pedido está a decorrer.
    botaoEntrar.textContent = 'A entrar…';

    // Apresenta uma mensagem de carregamento.
    mensagemLogin.textContent = 'A iniciar sessão…';

    // Obtém o nome de utilizador e remove espaços no início e no fim.
    const utilizador = campoUtilizador.value.trim();

    // Obtém a palavra-passe introduzida.
    const palavraPasse = campoPalavraPasse.value;

    try {

        // Envia um pedido POST ao servidor para iniciar sessão.
        const resposta = await fetch(`${CONFIG.API_URL}/sessao`, {
            method: 'POST',

            // Permite receber e enviar o cookie da sessão.
            credentials: 'same-origin',

            // Indica que os dados enviados estão em formato JSON.
            headers: {
                'Content-Type': 'application/json'
            },

            // Converte os dados de autenticação para texto JSON.
            body: JSON.stringify({
                utilizador,
                palavraPasse
            })
        });

        // Trata os erros de autenticação.
        // 400 representa dados inválidos e 401 representa falta de autorização.
        if (resposta.status === 400 || resposta.status === 401) {

            // Define uma mensagem de erro por defeito.
            let mensagem = 'Utilizador ou palavra-passe incorretos.';

            try {

                // Tenta obter a mensagem de erro enviada pelo servidor.
                const dadosErro = await resposta.json();

                // Procura a mensagem em diferentes formatos possíveis.
                mensagem =
                    dadosErro.erro?.mensagem ||
                    dadosErro.erro ||
                    dadosErro.mensagem ||
                    mensagem;

            } catch {}

            // Apresenta a mensagem de erro.
            mensagemLogin.textContent = mensagem;

            // Limpa o campo da palavra-passe por segurança.
            campoPalavraPasse.value = '';

            // Coloca novamente o cursor no campo da palavra-passe.
            campoPalavraPasse.focus();

            return;
        }

        // Se o pedido não for bem-sucedido, lança um erro.
        if (!resposta.ok) {
            throw new Error('Erro ao iniciar sessão.');
        }

        // Converte os dados da sessão recebidos do servidor.
        const sessao = await resposta.json();

        // Prepara a cópia local para o utilizador que acabou de entrar.
        await prepararUtilizador(sessao);

        // Guarda os dados da sessão atual.
        sessaoAtual = sessao;

        // Limpa a mensagem de login.
        mensagemLogin.textContent = '';

        // Atualiza o estado da aplicação para sessão iniciada.
        mudarEstado(
            'com-sessao',
            `Sessão iniciada: ${sessao.nome}`
        );

        // Inicia o temporizador da sessão.
        iniciarContagemSessao(sessao.expiracao);

        // Recupera os dados de um possível rascunho.
        recuperarRascunho();

        // Coloca o foco no título da área das sugestões.
        // Melhora a navegação por teclado e a acessibilidade.
        tituloSessao.focus();

        // Carrega as sugestões associadas ao utilizador.
        await carregarSugestoes();

        // Se a sessão continuar válida, envia as sugestões pendentes.
        if (estadoAplicacao === 'com-sessao') {
            await enviarPendentes();
        }

        // Atualiza a apresentação das sugestões pendentes.
        await mostrarPendentes();

    } catch (erro) {

        // Mostra o erro na consola.
        console.error(erro);

        // Remove a sessão da memória.
        sessaoAtual = null;

        // Altera o estado para sem ligação.
        mudarEstado(
            'sem-ligacao',
            'Sem ligação: não é possível entrar.'
        );

        // Apresenta a mensagem ao utilizador.
        mensagemLogin.textContent =
            'Sem ligação: não é possível entrar.';

        // Tenta apresentar a cópia local.
        await mostrarCopiaLocal();

    } finally {

        // O finally é executado independentemente de o pedido
        // ter sido bem-sucedido ou ter ocorrido um erro.

        // Volta a ativar o botão.
        botaoEntrar.disabled = false;

        // Repõe o texto original do botão.
        botaoEntrar.textContent = 'Entrar';
    }
});


// --------------------------------------------------
// CARREGAR SUGESTÕES DO SERVIDOR
// --------------------------------------------------

async function carregarSugestoes() {

    try {

        // Faz um pedido GET ao servidor para obter as sugestões.
        const resposta = await fetch(`${CONFIG.API_URL}/sugestoes`, {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store'
        });

        // Se o servidor responder 401, significa que a sessão
        // deixou de ser válida.
        if (resposta.status === 401) {
            await tratarSessaoExpirada();
            return;
        }

        // Verifica se o pedido foi bem-sucedido.
        if (!resposta.ok) {
            throw new Error('Erro ao carregar sugestões.');
        }

        // Converte a resposta JSON para objeto JavaScript.
        const resultado = await resposta.json();

        // Aceita diferentes estruturas de resposta:
        // array direto ou propriedades itens, dados ou sugestoes.
        const sugestoes = Array.isArray(resultado)
            ? resultado
            : resultado.itens || resultado.dados || resultado.sugestoes || [];

        // Guarda as sugestões recebidas na IndexedDB,
        // substituindo os dados anteriores.
        await substituirSugestoes(sugestoes);

        // Atualiza a data da última atualização local.
        await atualizarDataLocal();

        // Apresenta as sugestões guardadas localmente.
        await apresentarSugestoesLocais();

    } catch (erro) {

        // Mostra o erro na consola.
        console.error(erro);

        // Mesmo que o servidor falhe, tenta mostrar os dados locais.
        await apresentarSugestoesLocais();
    }
}


// --------------------------------------------------
// APRESENTAR SUGESTÕES LOCAIS
// --------------------------------------------------

async function atualizarDataLocal() {

    // Consulta a data da última atualização guardada na IndexedDB.
    const registo = await obterMeta('atualizadoEm');

    // Se não existir registo ou valor, não apresenta data.
    if (!registo || !registo.valor) {
        elementoAtualizacao.textContent = '';
        return;
    }

    // Converte o valor guardado para um objeto Date.
    const data = new Date(registo.valor);

    // Apresenta a data e hora no formato português.
    elementoAtualizacao.textContent =
        `Última atualização: ${data.toLocaleString('pt-PT')}`;
}

async function apresentarSugestoesLocais() {

    // Obtém a ordenação escolhida pelo utilizador.
    // Se ainda não existir uma preferência, utiliza "recentes".
    const ordenacao = localStorage.getItem('ordenacao') || 'recentes';

    // Consulta as sugestões locais já ordenadas.
    const sugestoes = await lerSugestoes(ordenacao);

    // Envia as sugestões para a função que as apresenta no HTML.
    apresentarSugestoes(sugestoes);
}

// Define o valor inicial do seletor de ordenação
// com base na preferência guardada no localStorage.
seletorOrdenacao.value = localStorage.getItem('ordenacao') || 'recentes';

// Quando o utilizador altera a ordenação:
seletorOrdenacao.addEventListener('change', async () => {

    // Guarda a nova preferência no localStorage.
    localStorage.setItem('ordenacao', seletorOrdenacao.value);

    // Atualiza a lista de sugestões e pendentes.
    await mostrarPendentes();
});

function criarArtigo(tituloTexto, descricaoTexto, estadoTexto) {

    // Cria um elemento HTML <article> para representar uma sugestão.
    const artigo = document.createElement('article');

    // Cria o título da sugestão.
    const titulo = document.createElement('h3');

    // Define o texto do título.
    titulo.textContent = tituloTexto || '';

    // Cria o parágrafo da descrição.
    const descricao = document.createElement('p');

    // Define o texto da descrição.
    descricao.textContent = descricaoTexto || '';

    // Cria o parágrafo do estado.
    const estado = document.createElement('p');

    // Define o texto do estado.
    estado.textContent = estadoTexto || '';

    // Junta os três elementos dentro do artigo.
    artigo.append(titulo, descricao, estado);

    // Devolve o artigo criado.
    return artigo;
}

function apresentarSugestoes(sugestoes) {

    // Guarda temporariamente os artigos que representam sugestões pendentes.
    const artigosPendentes = Array.from(listaSugestoes.children)
        .filter((artigo) => artigo.dataset.tipo === 'pendente');

    // Limpa o conteúdo atual da lista.
    listaSugestoes.replaceChildren();

    // Volta a adicionar os artigos pendentes.
    artigosPendentes.forEach((artigo) => {
        listaSugestoes.appendChild(artigo);
    });

    // Se não existirem sugestões, apresenta uma mensagem.
    if (!sugestoes.length) {
        const mensagem = document.createElement('p');
        mensagem.textContent = 'Ainda não existem sugestões.';

        listaSugestoes.appendChild(mensagem);
        return;
    }

    // Percorre todas as sugestões recebidas.
    sugestoes.forEach((sugestao) => {

        // Cria um artigo com o título, descrição e estado da sugestão.
        const artigo = criarArtigo(
            sugestao.titulo,
            sugestao.descricao,
            `Categoria: ${sugestao.categoria || ''} | Estado: ${sugestao.estado || 'Sem estado indicado'}`
        );

        // Identifica o artigo como uma sugestão já existente.
        artigo.dataset.tipo = 'sugestao';

        // Adiciona o artigo à lista apresentada na página.
        listaSugestoes.appendChild(artigo);
    });
}


// --------------------------------------------------
// SUGESTÕES PENDENTES
// --------------------------------------------------

async function mostrarPendentes() {

    // Consulta todas as sugestões que ainda estão pendentes.
    const pendentes = await lerPendentes();

    // Consulta o proprietário da cópia local.
    const proprietario = await lerProprietario();

    // Filtra as sugestões pendentes para mostrar apenas
    // as que pertencem ao utilizador atual.
    const pendentesDoUtilizador = proprietario
        ? pendentes.filter(
            (pendente) =>
                pendente.utilizador === proprietario.utilizador
        )
        : [];

    // Consulta as sugestões já guardadas localmente,
    // respeitando a ordenação escolhida.
    const sugestoes = await lerSugestoes(
        localStorage.getItem('ordenacao') || 'recentes'
    );

    // Limpa a lista antes de a voltar a construir.
    listaSugestoes.replaceChildren();

    // Percorre as sugestões que ainda não foram enviadas.
    pendentesDoUtilizador.forEach((pendente) => {

        // Cria um artigo com os dados da sugestão pendente.
        const artigo = criarArtigo(
            pendente.titulo,
            pendente.descricao,

            // Se existir um erro, apresenta-o.
            // Caso contrário, indica que está por enviar.
            pendente.erro
                ? `Erro: ${pendente.erro}`
                : 'Por enviar'
        );

        // Identifica o artigo como pendente.
        artigo.dataset.tipo = 'pendente';

        // Cria um botão para permitir descartar a sugestão.
        const botaoDescartar = document.createElement('button');
        botaoDescartar.type = 'button';
        botaoDescartar.textContent = 'Descartar';

        // Quando o botão é clicado:
        botaoDescartar.addEventListener('click', async () => {

            // Remove a sugestão pendente da IndexedDB.
            await descartarPendente(pendente.idLocal);

            // Atualiza novamente a lista.
            await mostrarPendentes();
        });

        // Adiciona o botão ao artigo.
        artigo.appendChild(botaoDescartar);

        // Adiciona o artigo à lista da página.
        listaSugestoes.appendChild(artigo);
    });

    // Se não existirem sugestões já enviadas, apresenta uma mensagem.
    if (!sugestoes.length) {
        const mensagem = document.createElement('p');
        mensagem.textContent = 'Ainda não existem sugestões.';

        listaSugestoes.appendChild(mensagem);

    } else {

        // Percorre as sugestões já guardadas.
        sugestoes.forEach((sugestao) => {

            // Cria um artigo com os dados de cada sugestão.
            const artigo = criarArtigo(
                sugestao.titulo,
                sugestao.descricao,
                `Categoria: ${sugestao.categoria || ''} | Estado: ${sugestao.estado || 'Sem estado indicado'}`
            );

            // Identifica o artigo como sugestão normal.
            artigo.dataset.tipo = 'sugestao';

            // Adiciona o artigo à lista.
            listaSugestoes.appendChild(artigo);
        });
    }
}

async function descartarPendente(idLocal) {

    // Abre a ligação à base de dados IndexedDB.
    const bd = await abrirBD();

    // Cria uma Promise para aguardar pelo resultado da operação.
    return new Promise((resolve, reject) => {

        // Cria uma transação de escrita na tabela pendentes.
        const transacao = bd.transaction('pendentes', 'readwrite');

        // Obtém a tabela pendentes e elimina o registo com o ID indicado.
        transacao.objectStore('pendentes').delete(idLocal);

        // Quando a transação termina com sucesso:
        transacao.oncomplete = () => {

            // Fecha a ligação à base de dados.
            bd.close();

            // Indica que a operação terminou corretamente.
            resolve();
        };

        // Se ocorrer um erro na transação:
        transacao.onerror = () => {

            // Fecha a ligação.
            bd.close();

            // Devolve o erro.
            reject(transacao.error);
        };

        // Se a transação for cancelada:
        transacao.onabort = () => {

            // Fecha a ligação.
            bd.close();

            // Devolve o erro.
            reject(transacao.error);
        };
    });
}


// --------------------------------------------------
// CÓPIA LOCAL SEM LIGAÇÃO
// --------------------------------------------------

async function mostrarCopiaLocal() {

    // Consulta o utilizador associado à cópia local.
    const proprietario = await lerProprietario();

    // Verifica se existe um proprietário,
    // se tem uma data de expiração e se a sessão continua válida.
    if (
        !proprietario ||
        !proprietario.expiracao ||
        obterExpiracao(proprietario.expiracao) <= Date.now()
    ) {

        // Se não existir uma sessão local válida,
        // esconde a área das sugestões.
        elementoSugestoes.hidden = true;
        return;
    }

    // Se existir uma cópia local válida, apresenta a área das sugestões.
    elementoSugestoes.hidden = false;

    // Informa a quem pertence a cópia e avisa que pode estar desatualizada.
    elementoProprietario.textContent =
        `Cópia local de ${proprietario.nome}. Pode estar desatualizada.`;

    // Apresenta a data da última atualização.
    await atualizarDataLocal();

    // Apresenta as sugestões guardadas e as pendentes.
    await mostrarPendentes();
}


// --------------------------------------------------
// CRIAR SUGESTÃO
// --------------------------------------------------

// Adiciona um evento ao formulário de criação de sugestões.
formularioSugestao.addEventListener('submit', async (evento) => {

    // Impede que o formulário recarregue a página.
    evento.preventDefault();

    // Recolhe os dados introduzidos pelo utilizador.
    const sugestao = {
        titulo: campoTitulo.value.trim(),
        descricao: campoDescricao.value.trim(),
        categoria: seletorCategoria.value
    };

    // Verifica se todos os campos foram preenchidos.
    if (
        !sugestao.titulo ||
        !sugestao.descricao ||
        !sugestao.categoria
    ) {
        mensagemSugestao.textContent =
            'Preenche todos os campos.';
        return;
    }

    // ----------------------------------------------
    // CRIAR SUGESTÃO SEM LIGAÇÃO À INTERNET
    // ----------------------------------------------

    // Verifica se a aplicação está sem ligação
    // ou se o navegador indica que não existe ligação à Internet.
    if (
        estadoAplicacao === 'sem-ligacao' ||
        !navigator.onLine
    ) {

        // Consulta o proprietário da cópia local.
        const proprietario = await lerProprietario();

        // Verifica se existe uma sessão local válida.
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

        // Guarda a sugestão na lista de pendentes da IndexedDB.
        // Fica associada ao utilizador atual.
        await acrescentarPendente(
            sugestao,
            proprietario.utilizador
        );

        // Apaga o rascunho porque a sugestão já foi guardada.
        apagarRascunho();

        // Limpa os campos do formulário.
        formularioSugestao.reset();

        // Informa que a sugestão será enviada mais tarde.
        mensagemSugestao.textContent =
            'Sugestão guardada para envio posterior.';

        // Atualiza a lista de sugestões pendentes.
        await mostrarPendentes();
        return;
    }

    // Se não existir uma sessão ativa, não permite enviar a sugestão.
    if (!sessaoAtual) {
        mensagemSugestao.textContent =
            'É necessário iniciar sessão.';
        return;
    }

    // Informa o utilizador de que a sugestão está a ser enviada.
    mensagemSugestao.textContent = 'A enviar sugestão…';

    try {

        // Envia a sugestão para o servidor através de um pedido POST.
        const resposta = await fetch(`${CONFIG.API_URL}/sugestoes`, {
            method: 'POST',

            // Envia o cookie que identifica a sessão.
            credentials: 'same-origin',

            // Indica que o conteúdo enviado está em formato JSON.
            headers: {
                'Content-Type': 'application/json'
            },

            // Converte o objeto da sugestão para JSON.
            body: JSON.stringify(sugestao)
        });

        // Se o servidor responder 401, a sessão deixou de ser válida.
        if (resposta.status === 401) {
            await tratarSessaoExpirada();
            return;
        }

        // Se responder 400, os dados enviados não são válidos.
        if (resposta.status === 400) {

            // Obtém os detalhes do erro enviados pelo servidor.
            const dadosErro = await resposta.json();

            // Apresenta a mensagem de erro.
            mensagemSugestao.textContent =
                dadosErro.erro?.mensagem ||
                dadosErro.erro ||
                'Dados inválidos.';

            return;
        }

        // A criação bem-sucedida de uma sugestão deve devolver HTTP 201.
        if (resposta.status !== 201) {
            throw new Error('Não foi possível enviar a sugestão.');
        }

        // Converte a resposta do servidor para JSON.
        const resultado = await resposta.json();

        // Guarda também a sugestão recebida na base de dados local.
        await guardarSugestaoLocal(resultado);

        // Apaga o rascunho e limpa o formulário.
        apagarRascunho();
        formularioSugestao.reset();

        // Informa que o envio foi concluído.
        mensagemSugestao.textContent =
            'Sugestão enviada com sucesso!';

        // Atualiza as sugestões recebidas do servidor.
        await carregarSugestoes();

        // Atualiza a lista de pendentes.
        await mostrarPendentes();

    } catch (erro) {

        // Se ocorrer um erro de comunicação,
        // apresenta-o na consola.
        console.error(erro);

        // Guarda a sugestão como pendente para envio posterior.
        await acrescentarPendente(
            sugestao,
            sessaoAtual.utilizador
        );

        // Apaga o rascunho e limpa o formulário.
        apagarRascunho();
        formularioSugestao.reset();

        // Informa o utilizador de que a sugestão ficou guardada localmente.
        mensagemSugestao.textContent =
            'Sem ligação. A sugestão ficou guardada para envio posterior.';

        // Atualiza a lista para mostrar a sugestão como pendente.
        await mostrarPendentes();
    }
});

async function guardarSugestaoLocal(sugestao) {

    // Importa dinamicamente a função guardarSugestao do ficheiro bd.js.
    // Uma importação dinâmica permite carregar um módulo durante a execução.
    const { guardarSugestao } = await import('./bd.js');

    // Guarda a sugestão na IndexedDB.
    await guardarSugestao(sugestao);
}


// --------------------------------------------------
// TERMINAR SESSÃO
// --------------------------------------------------

// Adiciona um evento ao botão de terminar sessão.
botaoTerminar.addEventListener('click', async () => {

    // Consulta todas as sugestões pendentes.
    const pendentes = await lerPendentes();

    // Consulta o proprietário da cópia local.
    const proprietario = await lerProprietario();

    // Conta apenas as sugestões pendentes que pertencem ao utilizador atual.
    const quantidade = proprietario
        ? pendentes.filter(
            (pendente) =>
                pendente.utilizador === proprietario.utilizador
        ).length
        : 0;

    // Se existirem sugestões pendentes, pede confirmação antes de terminar.
    if (quantidade > 0) {

        // Define a mensagem apresentada no diálogo.
        textoDialogo.textContent =
            `Há ${quantidade} sugestões por enviar, que serão apagadas. Terminar sessão?`;

        // Abre o diálogo de forma modal.
        dialogo.showModal();

        // Cria uma Promise que espera até o diálogo ser fechado.
        const resultado = await new Promise((resolve) => {

            // O evento close é executado quando o diálogo fecha.
            dialogo.addEventListener(
                'close',

                // Devolve o valor do botão selecionado.
                () => resolve(dialogo.returnValue),

                // O evento é executado apenas uma vez.
                { once: true }
            );
        });

        // Se o utilizador não confirmar, cancela a operação.
        if (resultado !== 'confirmar') {
            return;
        }
    }

    try {

        // Envia um pedido DELETE ao servidor para terminar a sessão.
        const resposta = await fetch(`${CONFIG.API_URL}/sessao`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });

        // Se o servidor responder 401, trata a sessão como expirada.
        if (resposta.status === 401) {
            await tratarSessaoExpirada();
            return;
        }

        // O código 204 significa que a operação foi concluída
        // sem necessidade de devolver conteúdo.
        if (resposta.status !== 204) {
            throw new Error('Não foi possível terminar a sessão.');
        }

        // Remove a sessão da memória.
        sessaoAtual = null;

        // Interrompe a contagem decrescente.
        pararContagemSessao();

        // Limpa os dados locais associados à sessão.
        await limparBD();

        // Remove o rascunho guardado.
        apagarRascunho();

        // Altera o estado para indicar que a sessão terminou.
        mudarEstado('sem-sessao', 'Sessão terminada.');

        // Limpa a mensagem de login.
        mensagemLogin.textContent = '';

        // Coloca o foco no campo de utilizador.
        campoUtilizador.focus();

    } catch (erro) {

        // Apresenta o erro na consola.
        console.error(erro);

        // Se não for possível comunicar com o servidor,
        // altera o estado para sem ligação.
        mudarEstado(
            'sem-ligacao',
            'Sem ligação: não é possível terminar sessão.'
        );

        // Tenta apresentar a cópia local.
        await mostrarCopiaLocal();
    }
});


// --------------------------------------------------
// EVENTO DE SESSÃO EXPIRADA NAS PENDENTES
// --------------------------------------------------

// Escuta um evento personalizado chamado "sessao-expirada".
// Este evento pode ser enviado pelo módulo responsável pelas pendentes.
window.addEventListener('sessao-expirada', async (evento) => {

    // Obtém a quantidade de sugestões pendentes indicada no evento.
    // Se não existir quantidade, utiliza zero.
    const quantidade = evento.detail?.quantidade || 0;

    // Trata a sessão como expirada e apresenta uma mensagem adequada.
    await tratarSessaoExpirada(
        `Há ${quantidade} sugestões por enviar. Entre de novo para as enviar.`
    );
});


// --------------------------------------------------
// EVENTOS DE LIGAÇÃO
// --------------------------------------------------

// O evento online é executado quando o navegador deteta
// que voltou a existir ligação à Internet.
window.addEventListener('online', async () => {

    // Apresenta uma mensagem de verificação.
    elementoEstado.textContent =
        'Ligação disponível. A verificar sessão…';

    // Volta a verificar a sessão e tenta recuperar os dados do servidor.
    await verificarSessao();
});

// O evento offline é executado quando o navegador deteta
// que deixou de existir ligação à Internet.
window.addEventListener('offline', () => {

    // Informa que não existe ligação à Internet.
    elementoEstado.textContent = 'Sem ligação à Internet.';

    // Desativa o botão de terminar sessão.
    botaoTerminar.disabled = true;
});


// --------------------------------------------------
// SERVICE WORKER E ATUALIZAÇÕES
// --------------------------------------------------

async function prepararAtualizacao() {

    // Verifica se o navegador suporta Service Workers.
    if (!('serviceWorker' in navigator)) {
        return;
    }

    try {

        // Regista o ficheiro sw.js como Service Worker da aplicação.
        registoSW = await navigator.serviceWorker.register('/sw.js');

        // Se já existir uma nova versão à espera de ser ativada,
        // apresenta o botão de atualização.
        if (registoSW.waiting) {
            botaoAtualizar.hidden = false;
        }

        // O evento updatefound é executado quando é encontrado
        // um novo Service Worker durante a atualização.
        registoSW.addEventListener('updatefound', () => {

            // Obtém o novo Service Worker que está a ser instalado.
            const novoWorker = registoSW.installing;

            // Se não existir um novo worker, termina a função.
            if (!novoWorker) return;

            // Acompanha as alterações de estado do novo worker.
            novoWorker.addEventListener('statechange', () => {

                // Se o novo worker estiver instalado e já existir
                // um Service Worker a controlar a página,
                // significa que existe uma atualização à espera.
                if (
                    novoWorker.state === 'installed' &&
                    navigator.serviceWorker.controller
                ) {

                    // Mostra o botão para o utilizador atualizar a aplicação.
                    botaoAtualizar.hidden = false;
                }
            });
        });

        // O evento controllerchange ocorre quando um novo
        // Service Worker passa a controlar a página.
        navigator.serviceWorker.addEventListener(
            'controllerchange',
            () => {

                // Se a aplicação estiver à espera de uma atualização,
                // recarrega a página para utilizar a nova versão.
                if (aRecarregar) {
                    window.location.reload();
                }
            }
        );

    } catch (erro) {

        // Apresenta um erro caso o registo do Service Worker falhe.
        console.error('Erro ao registar Service Worker:', erro);
    }
}

// Quando o utilizador clica no botão de atualização:
botaoAtualizar.addEventListener('click', () => {

    // Verifica se existe um registo e uma nova versão à espera.
    if (!registoSW || !registoSW.waiting) {
        return;
    }

    // Indica que a aplicação deverá ser recarregada
    // quando o novo Service Worker começar a controlar a página.
    aRecarregar = true;

    // Envia uma mensagem ao Service Worker que está à espera.
    // O ficheiro sw.js recebe esta mensagem e executa skipWaiting().
    registoSW.waiting.postMessage({
        tipo: 'ativar'
    });
});


// --------------------------------------------------
// INICIAR A APLICAÇÃO
// --------------------------------------------------

async function iniciarAplicacao() {

    // Define o estado inicial como "a-verificar".
    mudarEstado('a-verificar', 'A verificar sessão…');

    // Regista o Service Worker e prepara o mecanismo de atualização.
    await prepararAtualizacao();

    // Carrega as categorias disponíveis na API.
    await carregarCategorias();

    // Verifica se existe uma sessão válida e carrega os dados necessários.
    await verificarSessao();
}

// Chama a função principal para iniciar toda a aplicação.
iniciarAplicacao();
