
## API05 — Validação do contrato OpenAPI

O contrato OpenAPI foi atualizado para a versão 2.2.0.

A validação foi realizada com o comando:

`npx @redocly/cli lint .\Sprints\SERVICEWORKER02\sugestoes.openapi.yaml`

Resultado: contrato válido, sem erros e com 6 avisos.


## API05 — Testes da sincronização

- Login com sessão autenticada: OK
- GET /v2/sugestoes/alteracoes?desde=0: OK
- Criação de sugestão com versao=1: OK
- Cursor atualizado para 1: OK
- GET /v2/sugestoes/alteracoes?desde=1: OK
- Cursor inválido (desde=-1): rejeitado
- Pedido sem autenticação: rejeitado

Os testes confirmam o funcionamento inicial da rota de sincronização.


## API05 — Testes de idempotência

- Criação de sugestão com Idempotency-Key: OK (201).
- Sugestão criada com id=11 e versao=2.
- Repetição do mesmo pedido com a mesma chave: OK (201).
- Resposta repetida com o mesmo id e versão.
- Cabeçalho Idempotent-Replayed: true.
- Reutilização da chave com conteúdo diferente: OK (409).
- O servidor rejeitou corretamente o pedido diferente.

Conclusão: os testes básicos de idempotência foram realizados com sucesso.


## API05 — Persistência da idempotência

- Ficheiro idempotencia.json criado com sucesso.
- Chave UUID guardada no ficheiro.
- Servidor reiniciado com sucesso.
- Pedido repetido após reinício: 201.
- Sugestão original mantida: id=12, versao=3.
- Cabeçalho Idempotent-Replayed: true.

Conclusão: a persistência das chaves de idempotência após reinício foi confirmada.


### Testes de simulação de falhas — API05

**SIMULAR_503=2**

- Primeira tentativa: 503, Retry-After: 2.
- Segunda tentativa: 503, Retry-After: 2.
- Terceira tentativa: 201.
- Resultado: comportamento esperado confirmado.

**SIMULAR_PERDA_RESPOSTA=1**

- Primeira tentativa: ligação terminada inesperadamente.
- Segunda tentativa com a mesma Idempotency-Key: 201.
- Cabeçalho Idempotent-Replayed: true.
- Sugestão devolvida: ID 14, versão 5.
- Resultado: a repetição devolveu a sugestão original, sem criar uma duplicada.

## SERVICEWORKER02 — Teste de sincronização offline

**Objetivo:** Verificar se a aplicação permite criar sugestões sem ligação à Internet e sincronizá-las quando a ligação é restabelecida.

**Procedimento:**
1. Iniciou-se sessão na aplicação.
2. Ativou-se o modo Offline nas ferramentas de desenvolvimento do navegador.
3. Criaram-se duas sugestões sem ligação à Internet.
4. Confirmou-se que ambas ficaram guardadas na tabela `pendentes` da IndexedDB.
5. Restabeleceu-se a ligação à Internet.
6. Verificou-se que a tabela `pendentes` ficou vazia.
7. Iniciou-se novamente sessão após a expiração da sessão anterior.
8. Confirmou-se que as duas sugestões apareciam em «As minhas sugestões», com o estado `submetida`.

**Resultado:** O teste foi concluído com sucesso. As duas sugestões criadas offline ficaram disponíveis na aplicação após a recuperação da ligação.

**Evidência:** `teste_sincronizacao_offline.png`

**Conclusão:** A aplicação demonstrou capacidade de guardar sugestões localmente e sincronizá-las posteriormente com o servidor.