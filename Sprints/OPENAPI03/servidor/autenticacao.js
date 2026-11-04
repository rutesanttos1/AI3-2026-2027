import jwt from 'jsonwebtoken';

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
 * Middleware para exigir e verificar o token JWT no cabeçalho Authorization.
 * - Ausente ou formato incorreto -> 401 com WWW-Authenticate: Bearer
 * - Inválido, adulterado, algoritmo diferente de HS256 ou expirado -> 401 com WWW-Authenticate: Bearer error="invalid_token"
 * - Sucesso -> guarda sub, nome e papel em req.utilizador e invoca next()
 */
export function exigirToken(req, res, next) {
  const authHeader = req.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401)
      .set('WWW-Authenticate', 'Bearer')
      .set('Cache-Control', 'no-store')
      .json({ erro: 'Autenticação necessária. Cabeçalho Authorization ausente ou com formato incorreto.' });
  }

  const partes = authHeader.split(' ');
  if (partes.length !== 2 || !partes[1]) {
    return res.status(401)
      .set('WWW-Authenticate', 'Bearer')
      .set('Cache-Control', 'no-store')
      .json({ erro: 'Cabeçalho Authorization mal formatado.' });
  }

  const token = partes[1];

  try {
    // Opção algorithms: ['HS256'] é mandatória para impedir ataques de 'none' e confusão de algoritmos
    const payload = jwt.verify(token, SEGREDO, { algorithms: ['HS256'] });
    req.utilizador = {
      sub: payload.sub,
      nome: payload.nome,
      papel: payload.papel
    };
    next();
  } catch (err) {
    return res.status(401)
      .set('WWW-Authenticate', 'Bearer error="invalid_token"')
      .set('Cache-Control', 'no-store')
      .json({ erro: 'Token inválido ou expirado.' });
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
        .json({ erro: Acesso proibido: operação reservada ao papel '${papelEsperado}'. });
    }
    next();
  };
}