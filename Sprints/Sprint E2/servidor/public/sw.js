// bd.js — acesso à base IndexedDB reporta-bd.
// Partilhado pela página (<script>) e pelo service worker (importScripts):
// não pode usar window, document nem localStorage.
// Sprint 1: apenas constantes e funções provisórias (implementação na etapa 4.3).

'use strict';

const NOME_BD = 'reporta-bd';
const VERSAO_BD = 1;

function porImplementar(nome) {
  return Promise.reject(new Error(`${nome}: por implementar (etapa 4.3)`));
}

function abrirBd() { return porImplementar('abrirBd'); }
function acrescentarPendente(dados, cidadao) { return porImplementar('acrescentarPendente'); }
function lerPendentesDe(cidadao) { return porImplementar('lerPendentesDe'); }
function registarTentativa(idLocal) { return porImplementar('registarTentativa'); }
function marcarErro(idLocal, mensagem) { return porImplementar('marcarErro'); }
function confirmarPendente(idLocal, resultado, ocorrencia) { return porImplementar('confirmarPendente'); }
function aplicarAlteracoes(cidadao, alteracoes, cursor) { return porImplementar('aplicarAlteracoes'); }
