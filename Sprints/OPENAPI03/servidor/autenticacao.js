import jwt from 'jsonwebtoken';
import { lerCookie } from './Cookies.js';

const SEGREDO = process.env.JWT_SEGREDO;
const VALIDADE_PADRAO = 900; // 15 minutos em segundos

if (!SEGREDO || SEGREDO.length < 32) {
  console.error('ERRO FATAL: A variável de ambiente JWT_SEGREDO deve estar definida e ter pelo menos 32 caracteres.');
  process.exit(1);
}

const validade = parseInt(process.env.JWT_VALIDADE, 10) || VALIDADE_PADRAO;

/**
 * Emite um token JWT assinado com HS256 e o payload definido no contrato.
 * @param {Object} utilizador - Objeto do utilizador com utilizador, nome e papel
 * @returns {Object} Objeto conforme o schema Token { token, tipo, expiraEm }
 */
export function emitirToken(utilizador) {
  const payload = {
    sub: utilizador.utilizador,
    nome: utilizador.nome,
    papel: utilizador.papel
  };

  const token = jwt.sign(payload, SEGREDO, {
    algorithm: 'HS256',
    expiresIn: validade
  });

  return {
    token,
    tipo: 'Bearer',
    expiraEm: validade
  };
}

/**
 * Constrói um objeto conforme o schema Sessao a partir das claims do token.
 * @param {Object} claims - Objeto com sub, nome, papel e exp
 * @returns {Object} { utilizador, nome, papel, expiracao }
 */
export function construirSessao(claims) {
  return {
    utilizador: claims.sub,
    nome: claims.nome,
    papel: claims.papel,
    // exp está em segundos; Date trabalha em milissegundos
    expiracao: new Date(claims.exp * 1000).toISOString()
  };
}

/**
 * Constrói a Sessao a partir de um token acabado de emitir (já assinado pelo servidor).
 * @param {string} token - Token JWT
 * @returns {Object} Objeto conforme o schema Sessao
 */
export function sessaoDoToken(token) {
  return construirSessao(jwt.decode(token));
}

/**
 * Responde 401 com os cabeçalhos definidos no contrato (NaoAutenticado).
 */
function responderNaoAutenticado(res, wwwAuthenticate, mensagem) {
  return res.status(401)
    .set('WWW-Authenticate', wwwAuthenticate)
    .set('Cache-Control', 'no-store')
    .json({ erro: mensagem });
}

/**
 * Middleware para exigir e verificar o token JWT.
 * O token é procurado:
 *   1. no cabeçalho Authorization (Bearer), se este existir;
 *   2. caso contrário, no cookie sessao.
 * - Ausente ou formato incorreto -> 401 com WWW-Authenticate: Bearer
 * - Inválido, adulterado, algoritmo diferente de HS256 ou expirado -> 401 com WWW-Authenticate: Bearer error="invalid_token"
 * - Sucesso -> guarda sub, nome, papel e exp em req.utilizador e invoca next()
 */
export function exigirToken(req, res, next) {
  const authHeader = req.get('Authorization');
  let token;

  if (authHeader) {
    // Comportamento da API02: token no cabeçalho Authorization
    const partes = authHeader.split(' ');
    if (partes.length !== 2 || partes[0] !== 'Bearer' || !partes[1]) {
      return responderNaoAutenticado(res, 'Bearer',
        'Autenticação necessária. Cabeçalho Authorization com formato incorreto.');
    }
    token = partes[1];
  } else {
    // Novo na API03: sem cabeçalho Authorization, o token é lido do cookie sessao
    token = lerCookie(req, 'sessao');
    if (!token) {
      return responderNaoAutenticado(res, 'Bearer',
        'Autenticação necessária. Token ausente (cabeçalho Authorization ou cookie sessao).');
    }
  }

  try {
    // Opção algorithms: ['HS256'] é mandatória para impedir ataques de 'none' e confusão de algoritmos
    const payload = jwt.verify(token, SEGREDO, { algorithms: ['HS256'] });
    req.utilizador = {
      sub: payload.sub,
      nome: payload.nome,
      papel: payload.papel,
      exp: payload.exp
    };
    next();
  } catch (err) {
    return responderNaoAutenticado(res, 'Bearer error="invalid_token"', 'Token inválido ou expirado.');
  }
}

/**
 * Middleware para autorização de papel específico.
 * @param {string} papelEsperado - 'aluno' ou 'servicos'
 */
export function exigirPapel(papelEsperado) {
  return (req, res, next) => {
    if (!req.utilizador || req.utilizador.papel !== papelEsperado) {
      return res.status(403)
        .set('Cache-Control', 'no-store')
        .json({ erro: `Acesso proibido: operação reservada ao papel '${papelEsperado}'.` });
    }
    next();
  };
}