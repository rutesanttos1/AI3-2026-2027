// sw.js — service worker do Reporta.
// Sprint 1: install e activate provisórios, ainda sem estratégia de cache.

'use strict';

importScripts('bd.js', 'sincronizacao.js');

const CACHE_INTERFACE = 'interface-v1'; // usada na etapa 4.4 (pré-carregamento)

self.addEventListener('install', (evento) => {
  console.log('[sw] install');
  // Provisório: ativa já a nova versão, sem esperar que as páginas antigas fechem.
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  console.log('[sw] activate');
  // Passa a controlar as páginas já abertas.
  evento.waitUntil(self.clients.claim());
});
