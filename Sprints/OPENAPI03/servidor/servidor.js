import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { emitirToken, exigirToken, exigirPapel } from './autenticacao.js';

const __filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Carregar dados de teste
const utilizadoresPath = path.join(__dirname, 'dados', 'utilizadores.json');
const sugestoesPath = path.join(__dirname, 'dados', 'sugestoes.json');

const utilizadores = JSON.parse(fs.readFileSync(utilizadoresPath, 'utf-8'));
const sugestoes = JSON.parse(fs.readFileSync(sugestoesPath, 'utf-8'));

// Hash fictício de custo 10 para prevenção de timing attacks quando utilizador não existe
const HASH_FICTICIO = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

// Interpretar corpos JSON
app.use(express.json());

// Servir a aplicação cliente a partir da pasta public
app.use(express.static(path.join(__dirname, 'public')));

// Publicar o contrato OpenAPI v2
app.get('/v2/openapi.yaml', (req, res) => {
  const caminhoContrato = path.resolve(__dirname, '..', 'sugestoes.openapi.yaml');
  res.sendFile(caminhoContrato, {
    headers: {
      'Content-Type': 'text/yaml; charset=utf-8'
    }
  });
});

/**
 * POST /v2/tokens (criarToken)
 * Emite token JWT mediante validação de credenciais
 */
app.post('/v2/tokens', (req, res) => {
  const { utilizador, palavraPasse } = req.body || {};
  const detalhes = [];

  // Validação do campo 'utilizador'
  const regexUtilizador = /^([0-9]{5,8}|[a-z]+\.[a-z]+)$/;
  if (utilizador === undefined || utilizador === null) {
    detalhes.push('O campo utilizador é obrigatório.');
  } else if (typeof utilizador !== 'string' || !regexUtilizador.test(utilizador)) {
    detalhes.push('O campo utilizador deve ser uma string com número de aluno (5 a 8 algarismos) ou nome.apelido em minúsculas.');
  }

  // Validação do campo 'palavraPasse'
  if (palavraPasse === undefined || palavraPasse === null) {
    detalhes.push('O campo palavraPasse é obrigatório.');
  } else if (typeof palavraPasse !== 'string' || palavraPasse.length < 8 || palavraPasse.length > 128) {
    detalhes.push('O campo palavraPasse deve ser uma string entre 8 e 128 caracteres.');
  }

  if (detalhes.length > 0) {
    return res.status(400)
      .set('Cache-Control', 'no-store')
      .json({
        erro: 'Corpo do pedido não conforme com Credenciais',
        detalhes
      });
  }

  // Procura de utilizador
  const utilizadorEncontrado = utilizadores.find(u => u.utilizador === utilizador);

  // Executar sempre a comparação de hash com bcrypt para garantir tempo de resposta constante
  const hashAComparar = utilizadorEncontrado ? utilizadorEncontrado.hashPalavraPasse : HASH_FICTICIO;
  const palavraPasseValida = bcrypt.compareSync(palavraPasse, hashAComparar);

  if (!utilizadorEncontrado || !palavraPasseValida) {
    // 401 sem cabeçalho WWW-Authenticate e com no-store
    return res.status(401)
      .set('Cache-Control', 'no-store')
      .json({ erro: 'Credenciais inválidas' });
  }

  // Emissão do token com sucesso
  const tokenPayload = emitirToken(utilizadorEncontrado);
  return res.status(200)
    .set('Cache-Control', 'no-store')
    .json(tokenPayload);
});

/**
 * GET /v2/sugestoes (listarSugestoes)
 * Operação protegida para efeitos de demonstração
 * Um aluno obtém apenas as suas; os serviços obtêm todas.
 */
app.get('/v2/sugestoes', exigirToken, (req, res) => {
  const { sub, papel } = req.utilizador;
  let itensFiltrados = sugestoes;

  if (papel === 'aluno') {
    itensFiltrados = sugestoes.filter(s => s.numeroAluno === sub);
  }

  return res.status(200)
    .set('Cache-Control', 'private, no-cache')
    .json({
      pagina: 1,
      tamanhoPagina: 20,
      total: itensFiltrados.length,
      itens: itensFiltrados
    });
});

// Middleware final de tratamento de erros
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400)
      .set('Cache-Control', 'no-store')
      .json({ erro: 'Corpo do pedido em formato JSON inválido' });
  }

  console.error('Exceção não tratada:', err);
  return res.status(500)
    .set('Cache-Control', 'no-store')
    .json({ erro: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(Servidor Express da API de Sugestões a correr em http://localhost:${PORT});
});