
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcryptjs';

import {
  emitirToken,
  exigirToken,
  construirSessao
} from './autenticacao.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Caminhos dos ficheiros de dados
const utilizadoresPath = path.join(__dirname, 'dados', 'utilizadores.json');
const sugestoesPath = path.join(__dirname, 'dados', 'sugestoes.json');

// Carregar dados
const utilizadores = JSON.parse(
  fs.readFileSync(utilizadoresPath, 'utf-8')
);

let sugestoes = JSON.parse(
  fs.readFileSync(sugestoesPath, 'utf-8')
);

// Categorias disponíveis
const categorias = [
  { id: 'infraestruturas', nome: 'Infraestruturas' },
  { id: 'pedagogia', nome: 'Pedagogia' },
  { id: 'cantina', nome: 'Cantina' },
  { id: 'convivio', nome: 'Convívio' },
  { id: 'outros', nome: 'Outros' }
];

const HASH_FICTICIO =
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

const CATEGORIAS_VALIDAS = categorias.map(c => c.id);

// Interpretar pedidos JSON
app.use(express.json());

// Servir a interface a partir da pasta public
app.use(express.static(path.join(__dirname, '..', 'public')));

// Publicar o contrato OpenAPI
app.get('/v2/openapi.yaml', (req, res) => {
  const caminhoContrato = path.resolve(
    __dirname,
    '..',
    'sugestoes.openapi.yaml'
  );

  res.sendFile(caminhoContrato, {
    headers: {
      'Content-Type': 'text/yaml; charset=utf-8'
    }
  });
});

// --------------------------------------------------
// POST /v2/tokens - API03: criar token Bearer
// --------------------------------------------------

app.post('/v2/tokens', (req, res) => {
  const { utilizador, palavraPasse } = req.body || {};
  const detalhes = [];

  const regexUtilizador = /^([0-9]{5,8}|[a-z]+\.[a-z]+)$/;

  if (typeof utilizador !== 'string' ||
      !regexUtilizador.test(utilizador)) {
    detalhes.push('O campo utilizador é inválido.');
  }

  if (typeof palavraPasse !== 'string' ||
      palavraPasse.length < 8 ||
      palavraPasse.length > 128) {
    detalhes.push('A palavraPasse deve ter entre 8 e 128 caracteres.');
  }

  if (detalhes.length > 0) {
    return res.status(400)
      .set('Cache-Control', 'no-store')
      .json({
        erro: 'Corpo do pedido não conforme com Credenciais',
        detalhes
      });
  }

  const encontrado = utilizadores.find(
    u => u.utilizador === utilizador
  );

  const hash = encontrado
    ? encontrado.hashPalavraPasse
    : HASH_FICTICIO;

  const valida = bcrypt.compareSync(palavraPasse, hash);

  if (!encontrado || !valida) {
    return res.status(401)
      .set('Cache-Control', 'no-store')
      .json({ erro: 'Credenciais inválidas' });
  }

  return res.status(200)
    .set('Cache-Control', 'no-store')
    .json(emitirToken(encontrado));
});

// --------------------------------------------------
// POST /v2/sessao - Iniciar sessão com cookie
// --------------------------------------------------

app.post('/v2/sessao', (req, res) => {
  const { utilizador, palavraPasse } = req.body || {};

  if (typeof utilizador !== 'string' ||
      typeof palavraPasse !== 'string') {
    return res.status(400)
      .set('Cache-Control', 'no-store')
      .json({ erro: 'Credenciais inválidas.' });
  }

  const encontrado = utilizadores.find(
    u => u.utilizador === utilizador
  );

  const hash = encontrado
    ? encontrado.hashPalavraPasse
    : HASH_FICTICIO;

  const valida = bcrypt.compareSync(palavraPasse, hash);

  if (!encontrado || !valida) {
    return res.status(401)
      .set('Cache-Control', 'no-store')
      .json({ erro: 'Credenciais inválidas.' });
  }

  const resultado = emitirToken(encontrado);

  const sessao = construirSessao({
    sub: encontrado.utilizador,
    nome: encontrado.nome,
    papel: encontrado.papel,
    exp: Math.floor(Date.now() / 1000) + resultado.expiraEm
  });

  res.cookie('sessao', resultado.token, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/v2',
    maxAge: resultado.expiraEm * 1000
  });

  return res.status(200)
    .set('Cache-Control', 'no-store')
    .json(sessao);
});

// --------------------------------------------------
// GET /v2/sessao - Consultar sessão atual
// --------------------------------------------------

app.get('/v2/sessao', exigirToken, (req, res) => {
  const sessao = construirSessao(req.utilizador);

  return res.status(200)
    .set('Cache-Control', 'no-store')
    .json(sessao);
});

// --------------------------------------------------
// DELETE /v2/sessao - Terminar sessão
// --------------------------------------------------

app.delete('/v2/sessao', (req, res) => {
  res.clearCookie('sessao', {
    httpOnly: true,
    sameSite: 'strict',
    path: '/v2'
  });

  return res.status(204).end();
});

// --------------------------------------------------
// GET /v2/categorias - Consultar categorias públicas
// --------------------------------------------------

app.get('/v2/categorias', (req, res) => {
  return res.status(200)
    .set('Cache-Control', 'public, max-age=86400')
    .json(categorias);
});

// --------------------------------------------------
// GET /v2/sugestoes - Listar sugestões
// --------------------------------------------------

app.get('/v2/sugestoes', exigirToken, (req, res) => {
  const { sub, papel } = req.utilizador;

  let itensFiltrados = sugestoes;

  if (papel === 'aluno') {
    itensFiltrados = sugestoes.filter(
      s => s.numeroAluno === sub
    );
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

// --------------------------------------------------
// POST /v2/sugestoes - Criar uma sugestão
// --------------------------------------------------

app.post('/v2/sugestoes', exigirToken, (req, res) => {
  const { titulo, descricao, categoria } = req.body || {};
  const detalhes = [];

  if (typeof titulo !== 'string' ||
      titulo.length < 3 ||
      titulo.length > 100) {
    detalhes.push('O título deve ter entre 3 e 100 caracteres.');
  }

  if (typeof descricao !== 'string' ||
      descricao.length < 10 ||
      descricao.length > 1000) {
    detalhes.push('A descrição deve ter entre 10 e 1000 caracteres.');
  }

  if (typeof categoria !== 'string' ||
      !CATEGORIAS_VALIDAS.includes(categoria)) {
    detalhes.push('A categoria indicada não é válida.');
  }

  if (detalhes.length > 0) {
    return res.status(400)
      .set('Cache-Control', 'no-store')
      .json({
        erro: 'Corpo do pedido não conforme com SugestaoNova',
        detalhes
      });
  }

  const novaSugestao = {
    id: sugestoes.length > 0
      ? Math.max(...sugestoes.map(s => s.id)) + 1
      : 1,
    numeroAluno: req.utilizador.sub,
    titulo,
    descricao,
    categoria,
    estado: 'submetida',
    dataCriacao: new Date().toISOString()
  };

  sugestoes.push(novaSugestao);

  fs.writeFileSync(
    sugestoesPath,
    JSON.stringify(sugestoes, null, 2),
    'utf-8'
  );

  return res.status(201)
    .set('Location', `/v2/sugestoes/${novaSugestao.id}`)
    .set('Cache-Control', 'no-store')
    .json(novaSugestao);
});

// --------------------------------------------------
// Tratamento de erros
// --------------------------------------------------

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError &&
      err.status === 400 &&
      'body' in err) {
    return res.status(400)
      .set('Cache-Control', 'no-store')
      .json({ erro: 'Corpo do pedido em formato JSON inválido.' });
  }

  console.error('Erro no servidor:', err);

  return res.status(500)
    .set('Cache-Control', 'no-store')
    .json({ erro: 'Erro interno do servidor.' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(
    `Servidor da API04 a correr em http://localhost:${PORT}`
  );
});
