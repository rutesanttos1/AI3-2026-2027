import jwt from 'jsonwebtoken';
import { lerCookie } from './cookie.js';

const SEGREDO = process.env.JWT_SEGREDO;
const VALIDADE_PADRAO = 900;

if (!SEGREDO || SEGREDO.length < 32) {
  console.error(
    'ERRO FATAL: JWT_SEGREDO deve estar definida e ter pelo menos 32 caracteres.'
  );
  process.exit(1);
}

const validade = parseInt(process.env.JWT_VALIDADE, 10) || VALIDADE_PADRAO;

// Emitir token JWT
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

// Construir objeto Sessao
export function construirSessao(claims) {
  return {
    utilizador: claims.sub,
    nome: claims.nome,
    papel: claims.papel,
    expiracao: new Date(claims.exp * 1000).toISOString()
  };
}

// Obter sessão a partir de um token
export function sessaoDoToken(token) {
  return construirSessao(jwt.decode(token));
}

// Responder a pedidos não autenticados
function responderNaoAutenticado(res, wwwAuthenticate, mensagem) {
  return res.status(401)
    .set('WWW-Authenticate', wwwAuthenticate)
    .set('Cache-Control', 'no-store')
    .json({ erro: mensagem });
}

// Verificar token JWT
export function exigirToken(req, res, next) {
  const authHeader = req.get('Authorization');
  let token;

  if (authHeader) {
    const partes = authHeader.split(' ');

    if (partes.length !== 2 || partes[0] !== 'Bearer' || !partes[1]) {
      return responderNaoAutenticado(
        res,
        'Bearer',
        'Cabeçalho Authorization com formato incorreto.'
      );
    }

    token = partes[1];
  } else {
    token = lerCookie(req, 'sessao');

    if (!token) {
      return responderNaoAutenticado(
        res,
        'Bearer',
        'Autenticação necessária. Token ausente.'
      );
    }
  }

  try {
    const payload = jwt.verify(token, SEGREDO, {
      algorithms: ['HS256']
    });

    req.utilizador = {
      sub: payload.sub,
      nome: payload.nome,
      papel: payload.papel,
      exp: payload.exp
    };

    next();
  } catch {
    return responderNaoAutenticado(
      res,
      'Bearer error="invalid_token"',
      'Token inválido ou expirado.'
    );
  }
}

// Verificar papel do utilizador
export function exigirPapel(papelEsperado) {
  return (req, res, next) => {
    if (!req.utilizador || req.utilizador.papel !== papelEsperado) {
      return res.status(403)
        .set('Cache-Control', 'no-store')
        .json({
          erro: `Acesso proibido: operação reservada ao papel '${papelEsperado}'.`
        });
    }

    next();
  };
}