 // Importa a biblioteca jsonwebtoken, utilizada para criar,
 // assinar, descodificar e verificar tokens JWT.
import jwt from 'jsonwebtoken';

// Importa a função que permite ler cookies enviados pelo navegador.
import { lerCookie } from './cookie.js';

// Obtém o segredo utilizado para assinar e verificar os tokens.
// Este valor é definido numa variável de ambiente (.env).
const SEGREDO = process.env.JWT_SEGREDO;

// Define o tempo de validade padrão do token: 900 segundos (15 minutos).
const VALIDADE_PADRAO = 900;

// Verifica se o segredo existe e se tem pelo menos 32 caracteres.
// Esta verificação ajuda a evitar a utilização de um segredo demasiado curto.
if (!SEGREDO || SEGREDO.length < 32) {

  // Apresenta uma mensagem de erro na consola do servidor.
  console.error(
    'ERRO FATAL: JWT_SEGREDO deve estar definida e ter pelo menos 32 caracteres.'
  );

  // Termina a execução do servidor com código de erro.
  process.exit(1);
}

// Obtém a validade do token através da variável de ambiente JWT_VALIDADE.
// parseInt() converte o valor para um número inteiro.
// Se não existir um valor válido, utiliza os 900 segundos definidos anteriormente.
const validade = parseInt(process.env.JWT_VALIDADE, 10) || VALIDADE_PADRAO;

// EMITIR TOKEN JWT
// Esta função cria um token de autenticação para o utilizador.
export function emitirToken(utilizador) {

  // Payload é o conjunto de informações incluídas no token.
  // sub identifica o utilizador.
  // nome guarda o nome do utilizador.
  // papel identifica o tipo de utilizador/permissão.
  const payload = {
    sub: utilizador.utilizador,
    nome: utilizador.nome,
    papel: utilizador.papel
  };

  // Cria e assina o token JWT utilizando o segredo.
  // HS256 é o algoritmo utilizado para assinar o token.
  // expiresIn define o tempo até o token expirar.
  const token = jwt.sign(payload, SEGREDO, {
    algorithm: 'HS256',
    expiresIn: validade
  });

  // Devolve o token e algumas informações adicionais.
  return {
    token,

    // Indica o tipo de autenticação utilizado.
    tipo: 'Bearer',

    // Indica o tempo de validade do token em segundos.
    expiraEm: validade
  };
}

// CONSTRUIR OBJETO SESSÃO
// Converte as informações do token num objeto de sessão
// que pode ser utilizado pelo resto da aplicação.
export function construirSessao(claims) {
  return {

    // Identificador do utilizador.
    utilizador: claims.sub,

    // Nome do utilizador.
    nome: claims.nome,

    // Papel ou tipo de utilizador.
    papel: claims.papel,

    // Converte a data de expiração do token para formato ISO.
    // O valor claims.exp está em segundos, por isso multiplicamos por 1000
    // para o converter para milissegundos, utilizados pelo JavaScript.
    expiracao: new Date(claims.exp * 1000).toISOString()
  };
}

// OBTER SESSÃO A PARTIR DE UM TOKEN
// Descobre as informações guardadas no token e constrói uma sessão.
export function sessaoDoToken(token) {

  // jwt.decode() descodifica o conteúdo do token.
  // construirSessao() transforma esse conteúdo num objeto de sessão.
  return construirSessao(jwt.decode(token));
}

// RESPONDER A PEDIDOS NÃO AUTENTICADOS
// Função auxiliar utilizada quando um pedido não apresenta
// um token válido ou não apresenta autenticação.
function responderNaoAutenticado(res, wwwAuthenticate, mensagem) {

  // Devolve o estado HTTP 401 (Unauthorized).
  return res.status(401)

    // Indica o mecanismo de autenticação esperado ou o erro encontrado.
    .set('WWW-Authenticate', wwwAuthenticate)

    // Impede que a resposta seja guardada em cache.
    .set('Cache-Control', 'no-store')

    // Envia a mensagem de erro em formato JSON.
    .json({ erro: mensagem });
}

// VERIFICAR TOKEN JWT
// Middleware utilizado para proteger rotas da API.
// Antes de executar a rota, verifica se o utilizador está autenticado.
export function exigirToken(req, res, next) {

  // Tenta obter o cabeçalho Authorization do pedido HTTP.
  const authHeader = req.get('Authorization');

  // Variável onde será guardado o token encontrado.
  let token;

  // Se existir um cabeçalho Authorization, utiliza esse método de autenticação.
  if (authHeader) {

    // Divide o cabeçalho em duas partes, separadas por um espaço.
    // Exemplo: Bearer abc123...
    const partes = authHeader.split(' ');

    // Verifica se o formato está correto:
    // deve ter duas partes, começar por Bearer e conter um token.
    if (partes.length !== 2 || partes[0] !== 'Bearer' || !partes[1]) {

      // Se o formato estiver incorreto, devolve erro 401.
      return responderNaoAutenticado(
        res,
        'Bearer',
        'Cabeçalho Authorization com formato incorreto.'
      );
    }

    // Guarda a segunda parte, que corresponde ao token.
    token = partes[1];

  } else {

    // Se não existir Authorization, tenta obter o token
    // através do cookie chamado "sessao".
    token = lerCookie(req, 'sessao');

    // Se também não existir cookie, o utilizador não está autenticado.
    if (!token) {
      return responderNaoAutenticado(
        res,
        'Bearer',
        'Autenticação necessária. Token ausente.'
      );
    }
  }

  try {

    // Verifica a assinatura, a validade e a expiração do token.
    // Só aceita tokens assinados com o algoritmo HS256.
    const payload = jwt.verify(token, SEGREDO, {
      algorithms: ['HS256']
    });

    // Guarda os dados do utilizador no objeto req.
    // Assim, as rotas seguintes podem saber quem está autenticado.
    req.utilizador = {
      sub: payload.sub,
      nome: payload.nome,
      papel: payload.papel,
      exp: payload.exp
    };

    // next() permite continuar para o middleware seguinte
    // ou para a função que trata a rota.
    next();

  } catch {

    // Se a verificação falhar, devolve erro 401.
    // Pode acontecer se o token for inválido ou estiver expirado.
    return responderNaoAutenticado(
      res,
      'Bearer error="invalid_token"',
      'Token inválido ou expirado.'
    );
  }
}

// VERIFICAR PAPEL DO UTILIZADOR
// Esta função cria um middleware para verificar permissões.
// Recebe o papel que o utilizador precisa de ter para aceder à rota.
export function exigirPapel(papelEsperado) {

  // Devolve um middleware que será executado antes da rota.
  return (req, res, next) => {

    // Verifica se existe um utilizador autenticado
    // e se o seu papel corresponde ao papel exigido.
    if (!req.utilizador || req.utilizador.papel !== papelEsperado) {

      // Se não tiver as permissões necessárias,
      // devolve o estado HTTP 403 (Forbidden).
      return res.status(403)

        // Impede que a resposta seja guardada em cache.
        .set('Cache-Control', 'no-store')

        // Devolve uma mensagem a explicar que o acesso é proibido.
        .json({
          erro: `Acesso proibido: operação reservada ao papel '${papelEsperado}'.`
        });
    }

    // Se o utilizador tiver o papel correto,
    // permite que o pedido continue.
    next();
  };
}
