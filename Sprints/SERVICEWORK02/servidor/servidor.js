// Importar o Express, utilizado para criar o servidor e definir as rotas da API.
import express from 'express';

// Importar o módulo path para trabalhar com caminhos de ficheiros e pastas.
import path from 'path';

// Importar fileURLToPath para obter o caminho real deste ficheiro.
import { fileURLToPath } from 'url';

// Importar o módulo fs para ler e escrever ficheiros.
import fs from 'fs';

// Importar bcryptjs para comparar palavras-passe com os seus hashes.
import bcrypt from 'bcryptjs';

// Importar funções do ficheiro de autenticação.
// emitirToken: cria um token JWT.
// exigirToken: verifica se o pedido está autenticado.
// construirSessao: constrói os dados da sessão do utilizador.
import {
  emitirToken,
  exigirToken,
  construirSessao
} from './autenticacao.js';

// Obter o caminho completo do ficheiro servidor.js.
const __filename = fileURLToPath(import.meta.url);

// Obter o caminho da pasta onde está o servidor.js.
const __dirname = path.dirname(__filename);

// Criar a aplicação Express.
const app = express();

// Definir a porta do servidor.
// Se não existir uma porta configurada no ambiente, utiliza a 3000.
const PORT = process.env.PORT || 3000;


// --------------------------------------------------
// CAMINHOS DOS FICHEIROS DE DADOS
// --------------------------------------------------

// Construir o caminho até ao ficheiro que contém os utilizadores.
const utilizadoresPath = path.join(__dirname, 'dados', 'utilizadores.json');

// Construir o caminho até ao ficheiro que contém as sugestões.
const sugestoesPath = path.join(__dirname, 'dados', 'sugestoes.json');


// --------------------------------------------------
// CARREGAR DADOS
// --------------------------------------------------

// Ler o ficheiro utilizadores.json e converter o seu conteúdo JSON
// para um objeto JavaScript.
const utilizadores = JSON.parse(
  fs.readFileSync(utilizadoresPath, 'utf-8')
);

// Ler o ficheiro sugestoes.json e guardar as sugestões numa variável.
// Utilizamos let porque a lista vai ser alterada quando forem criadas sugestões.
let sugestoes = JSON.parse(
  fs.readFileSync(sugestoesPath, 'utf-8')
);


// --------------------------------------------------
// CATEGORIAS DISPONÍVEIS
// --------------------------------------------------

// Criar a lista de categorias que podem ser escolhidas nas sugestões.
// Cada categoria tem um identificador e um nome apresentado ao utilizador.
const categorias = [
  { id: 'infraestruturas', nome: 'Infraestruturas' },
  { id: 'pedagogia', nome: 'Pedagogia' },
  { id: 'cantina', nome: 'Cantina' },
  { id: 'convivio', nome: 'Convívio' },
  { id: 'outros', nome: 'Outros' }
];

// Hash fictício utilizado quando o utilizador não existe.
// Permite realizar a comparação com bcrypt mesmo quando não encontramos
// o utilizador, ajudando a evitar diferenças de comportamento na autenticação.
const HASH_FICTICIO =
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

// Criar um array apenas com os identificadores das categorias.
// Este array será utilizado para validar as categorias recebidas.
const CATEGORIAS_VALIDAS = categorias.map(c => c.id);


// --------------------------------------------------
// CONFIGURAÇÃO DO EXPRESS
// --------------------------------------------------

// Middleware que permite interpretar pedidos com corpo em formato JSON.
// Assim, conseguimos aceder aos dados através de req.body.
app.use(express.json());

// Disponibilizar os ficheiros da interface ao navegador.
// A pasta public contém os ficheiros HTML, CSS e JavaScript do cliente.
app.use(express.static(path.join(__dirname, '..', 'public')));


// --------------------------------------------------
// PUBLICAR O CONTRATO OPENAPI
// --------------------------------------------------

// Criar uma rota para disponibilizar o contrato OpenAPI da API.
// O contrato descreve as rotas, os pedidos e as respostas da API.
app.get('/v2/openapi.yaml', (req, res) => {

  // Construir o caminho até ao ficheiro sugestões.openapi.yaml.
  const caminhoContrato = path.resolve(
    __dirname,
    '..',
    'sugestoes.openapi.yaml'
  );

  // Enviar o ficheiro ao cliente com o tipo de conteúdo YAML.
  res.sendFile(caminhoContrato, {
    headers: {
      'Content-Type': 'text/yaml; charset=utf-8'
    }
  });
});


// --------------------------------------------------
// POST /v2/tokens - API03: criar token Bearer
// --------------------------------------------------

// POST é utilizado quando o cliente envia dados para o servidor.
// Nesta rota, o objetivo é autenticar o utilizador e devolver um token.
app.post('/v2/tokens', (req, res) => {

  // Obter o utilizador e a palavra-passe enviados no corpo do pedido.
  const { utilizador, palavraPasse } = req.body || {};

  // Array onde são guardadas as mensagens de erro de validação.
  const detalhes = [];

  // Expressão regular que valida o formato do nome de utilizador.
  // Aceita entre 5 e 8 algarismos ou um formato nome.apelido em minúsculas.
  const regexUtilizador = /^([0-9]{5,8}|[a-z]+\.[a-z]+)$/;

  // Verificar se o utilizador é uma string e respeita o formato definido.
  if (typeof utilizador !== 'string' ||
      !regexUtilizador.test(utilizador)) {
    detalhes.push('O campo utilizador é inválido.');
  }

  // Verificar se a palavra-passe é uma string com 8 a 128 caracteres.
  if (typeof palavraPasse !== 'string' ||
      palavraPasse.length < 8 ||
      palavraPasse.length > 128) {
    detalhes.push('A palavraPasse deve ter entre 8 e 128 caracteres.');
  }

  // Se existirem erros de validação, devolver o estado HTTP 400.
  // 400 significa que o pedido enviado pelo cliente é inválido.
  if (detalhes.length > 0) {
    return res.status(400)
      .set('Cache-Control', 'no-store')
      .json({
        erro: 'Corpo do pedido não conforme com Credenciais',
        detalhes
      });
  }

  // Procurar na lista de utilizadores aquele que corresponde
  // ao nome de utilizador recebido.
  const encontrado = utilizadores.find(
    u => u.utilizador === utilizador
  );

  // Se o utilizador existir, utilizar o seu hash da palavra-passe.
  // Caso contrário, utilizar o hash fictício.
  const hash = encontrado
    ? encontrado.hashPalavraPasse
    : HASH_FICTICIO;

  // Comparar a palavra-passe recebida com o hash guardado.
  // O bcrypt trata da comparação sem precisarmos de descodificar o hash.
  const valida = bcrypt.compareSync(palavraPasse, hash);

  // Se o utilizador não existir ou a palavra-passe estiver incorreta,
  // devolver o estado HTTP 401 (não autenticado).
  if (!encontrado || !valida) {
    return res.status(401)
      .set('Cache-Control', 'no-store')
      .json({ erro: 'Credenciais inválidas' });
  }

  // Se as credenciais estiverem corretas, devolver o token JWT.
  // O estado HTTP 200 indica que o pedido foi concluído com sucesso.
  return res.status(200)
    .set('Cache-Control', 'no-store')
    .json(emitirToken(encontrado));
});


// --------------------------------------------------
// POST /v2/sessao - Iniciar sessão com cookie
// --------------------------------------------------

// Esta rota permite iniciar sessão utilizando um cookie.
// Ao contrário da rota anterior, o token não é apresentado diretamente
// como resposta: fica guardado num cookie do navegador.
app.post('/v2/sessao', (req, res) => {

  // Obter as credenciais enviadas pelo cliente.
  const { utilizador, palavraPasse } = req.body || {};

  // Verificar se os dois campos foram enviados como strings.
  if (typeof utilizador !== 'string' ||
      typeof palavraPasse !== 'string') {
    return res.status(400)
      .set('Cache-Control', 'no-store')
      .json({ erro: 'Credenciais inválidas.' });
  }

  // Procurar o utilizador na lista de utilizadores.
  const encontrado = utilizadores.find(
    u => u.utilizador === utilizador
  );

  // Obter o hash da palavra-passe ou utilizar o hash fictício
  // caso o utilizador não exista.
  const hash = encontrado
    ? encontrado.hashPalavraPasse
    : HASH_FICTICIO;

  // Comparar a palavra-passe recebida com o hash guardado.
  const valida = bcrypt.compareSync(palavraPasse, hash);

  // Se as credenciais forem incorretas, devolver erro 401.
  if (!encontrado || !valida) {
    return res.status(401)
      .set('Cache-Control', 'no-store')
      .json({ erro: 'Credenciais inválidas.' });
  }

  // Criar um token JWT para o utilizador autenticado.
  const resultado = emitirToken(encontrado);

  // Construir o objeto da sessão com os dados do utilizador.
  // A expiração é calculada através da data atual mais o tempo
  // de validade do token, convertido para segundos.
  const sessao = construirSessao({
    sub: encontrado.utilizador,
    nome: encontrado.nome,
    papel: encontrado.papel,
    exp: Math.floor(Date.now() / 1000) + resultado.expiraEm
  });

  // Guardar o token num cookie chamado "sessao".
  res.cookie('sessao', resultado.token, {
    httpOnly: true,       // Impede o acesso ao cookie através de JavaScript.
    sameSite: 'strict',   // Restringe o envio do cookie em pedidos de outros sites.
    path: '/v2',           // O cookie é enviado nos pedidos para caminhos /v2.
    maxAge: resultado.expiraEm * 1000 // Tempo de validade em milissegundos.
  });

  // Devolver os dados da sessão ao cliente.
  return res.status(200)
    .set('Cache-Control', 'no-store')
    .json(sessao);
});


// --------------------------------------------------
// GET /v2/sessao - Consultar sessão atual
// --------------------------------------------------

// GET é utilizado para consultar informação.
// O middleware exigirToken verifica primeiro se o pedido está autenticado.
app.get('/v2/sessao', exigirToken, (req, res) => {

  // Construir os dados da sessão com base no utilizador autenticado.
  const sessao = construirSessao(req.utilizador);

  // Devolver os dados da sessão ao cliente.
  return res.status(200)
    .set('Cache-Control', 'no-store')
    .json(sessao);
});


// --------------------------------------------------
// DELETE /v2/sessao - Terminar sessão
// --------------------------------------------------

// DELETE é utilizado para terminar a sessão.
// Aqui, removemos o cookie que guarda o token JWT.
app.delete('/v2/sessao', (req, res) => {

  // Limpar o cookie "sessao".
  // As opções devem corresponder às utilizadas quando foi criado.
  res.clearCookie('sessao', {
    httpOnly: true,
    sameSite: 'strict',
    path: '/v2'
  });

  // Devolver o estado HTTP 204, que indica sucesso sem conteúdo na resposta.
  return res.status(204).end();
});


// --------------------------------------------------
// GET /v2/categorias - Consultar categorias públicas
// --------------------------------------------------

// Esta rota permite consultar as categorias disponíveis.
// É pública, por isso não necessita de autenticação.
app.get('/v2/categorias', (req, res) => {

  // Devolver a lista de categorias com o estado HTTP 200.
  // max-age=86400 significa que a resposta pode ser guardada em cache
  // durante 86400 segundos, ou seja, 24 horas.
  return res.status(200)
    .set('Cache-Control', 'public, max-age=86400')
    .json(categorias);
});


// --------------------------------------------------
// GET /v2/sugestoes - Listar sugestões
// --------------------------------------------------

// Esta rota permite consultar as sugestões existentes.
// Exige autenticação através do middleware exigirToken.
app.get('/v2/sugestoes', exigirToken, (req, res) => {

  // Obter o identificador e o papel do utilizador autenticado.
  const { sub, papel } = req.utilizador;

  // Por defeito, considerar todas as sugestões.
  let itensFiltrados = sugestoes;

  // Se o utilizador tiver o papel de aluno,
  // mostrar apenas as sugestões que pertencem a esse aluno.
  if (papel === 'aluno') {
    itensFiltrados = sugestoes.filter(
      s => s.numeroAluno === sub
    );
  }

  // Devolver as sugestões juntamente com os dados de paginação.
  // private indica que a resposta é privada.
  // no-cache obriga a validar a resposta antes de reutilizar a cache.
  return res.status(200)
    .set('Cache-Control', 'private, no-cache')
    .json({
      pagina: 1,                    // Número da página atual.
      tamanhoPagina: 20,             // Número de sugestões por página.
      total: itensFiltrados.length,  // Quantidade total de sugestões encontradas.
      itens: itensFiltrados          // Lista de sugestões a apresentar.
    });
});


// --------------------------------------------------
// POST /v2/sugestoes - Criar uma sugestão
// --------------------------------------------------

// Esta rota permite criar uma nova sugestão.
// Exige autenticação para identificar quem está a submeter a sugestão.
app.post('/v2/sugestoes', exigirToken, (req, res) => {

  // Obter os dados enviados pelo cliente.
  const { titulo, descricao, categoria } = req.body || {};

  // Criar um array para guardar os erros encontrados na validação.
  const detalhes = [];

  // Verificar se o título é uma string com 3 a 100 caracteres.
  if (typeof titulo !== 'string' ||
      titulo.length < 3 ||
      titulo.length > 100) {
    detalhes.push('O título deve ter entre 3 e 100 caracteres.');
  }

  // Verificar se a descrição é uma string com 10 a 1000 caracteres.
  if (typeof descricao !== 'string' ||
      descricao.length < 10 ||
      descricao.length > 1000) {
    detalhes.push('A descrição deve ter entre 10 e 1000 caracteres.');
  }

  // Confirmar se a categoria recebida pertence à lista de categorias válidas.
  if (typeof categoria !== 'string' ||
      !CATEGORIAS_VALIDAS.includes(categoria)) {
    detalhes.push('A categoria indicada não é válida.');
  }

  // Se algum campo não cumprir as regras,
  // devolver o estado HTTP 400 com os erros encontrados.
  if (detalhes.length > 0) {
    return res.status(400)
      .set('Cache-Control', 'no-store')
      .json({
        erro: 'Corpo do pedido não conforme com SugestaoNova',
        detalhes
      });
  }

  // Criar o objeto que representa a nova sugestão.
  const novaSugestao = {

    // Gerar um novo identificador.
    // Se já existirem sugestões, encontrar o maior ID e somar 1.
    // Caso contrário, começar pelo ID 1.
    id: sugestoes.length > 0
      ? Math.max(...sugestoes.map(s => s.id)) + 1
      : 1,

    // Obter o número de aluno diretamente do token autenticado.
    // Assim, o cliente não consegue escolher outro número de aluno
    // através dos dados enviados no pedido.
    numeroAluno: req.utilizador.sub,

    // Guardar os dados recebidos e validados.
    titulo,
    descricao,
    categoria,

    // Definir o estado inicial da sugestão.
    estado: 'submetida',

    // Registar a data e hora de criação no formato ISO.
    dataCriacao: new Date().toISOString()
  };

  // Adicionar a nova sugestão ao array existente.
  sugestoes.push(novaSugestao);

  // Guardar a lista atualizada no ficheiro sugestoes.json.
  // JSON.stringify converte o array para texto JSON.
  // O valor 2 permite organizar o JSON com indentação.
  fs.writeFileSync(
    sugestoesPath,
    JSON.stringify(sugestoes, null, 2),
    'utf-8'
  );

  // Devolver o estado HTTP 201, que indica que foi criado um recurso.
  // Location indica o endereço da nova sugestão.
  // no-store impede que a resposta seja guardada em cache.
  return res.status(201)
    .set('Location', `/v2/sugestoes/${novaSugestao.id}`)
    .set('Cache-Control', 'no-store')
    .json(novaSugestao);
});


// --------------------------------------------------
// TRATAMENTO DE ERROS
// --------------------------------------------------

// Middleware utilizado para tratar erros que acontecem durante
// o processamento dos pedidos.
app.use((err, req, res, next) => {

  // Verificar se ocorreu um erro de sintaxe no JSON enviado pelo cliente.
  if (err instanceof SyntaxError &&
      err.status === 400 &&
      'body' in err) {

    // Se o JSON estiver mal escrito, devolver o estado HTTP 400.
    return res.status(400)
      .set('Cache-Control', 'no-store')
      .json({ erro: 'Corpo do pedido em formato JSON inválido.' });
  }

  // Mostrar os restantes erros na consola do servidor.
  console.error('Erro no servidor:', err);

  // Devolver o estado HTTP 500 para indicar um erro interno do servidor.
  return res.status(500)
    .set('Cache-Control', 'no-store')
    .json({ erro: 'Erro interno do servidor.' });
});


// --------------------------------------------------
// INICIAR SERVIDOR
// --------------------------------------------------

// Colocar o servidor a funcionar na porta definida anteriormente.
app.listen(PORT, () => {

  // Mostrar uma mensagem na consola quando o servidor estiver ativo.
  console.log(
    `Servidor da API04 a correr em http://localhost:${PORT}`
  );
});
