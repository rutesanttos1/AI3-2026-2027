# Reporta — Registo do trabalho

Aplicações para a Internet III · Trabalho prático TP-OCORRENCIAS

## Arranque do servidor

```
cd servidor
npm install
copy .env.exemplo .env        (Windows; em Linux/macOS: cp .env.exemplo .env)
node --env-file=.env servidor.js
```

A aplicação fica disponível em `http://localhost:3000/`. O ficheiro `.env` tem de existir, porque a opção `--env-file` do Node termina com erro se o ficheiro não for encontrado.

---

## 1. Diagnóstico inicial (secção 2)

> **Nota do grupo:** rascunho a rever e a reescrever pelo grupo antes da entrega.

**(a) A Ana e o Bruno comunicam, sem rede e com dez minutos de diferença, o mesmo buraco. A Ana sincroniza primeiro. O que deve acontecer quando o Bruno sincronizar? E se for a Ana a comunicá-lo duas vezes?**

Quando a pendente da Ana chega ao servidor, não existe nenhuma ocorrência semelhante, pelo que é criada uma ocorrência nova com `comunicacoes = 1` (resposta `201`). Quando o Bruno sincroniza, o servidor volta a procurar semelhantes e encontra a ocorrência da Ana: tem a mesma categoria, não está resolvida e fica dentro do raio. Como o Bruno comunicou sem rede, nunca viu candidatas e o campo `recusadas` está vazio. A comunicação é, por isso, fundida nessa ocorrência, que passa a ter `comunicacoes = 2` (resposta `200` com `resultado: "reforcada"`). No dispositivo do Bruno, a comunicação passa a aparecer como «Juntada à n.º …».

Se for a Ana a comunicar duas vezes, existem duas pendentes distintas, cada uma com a sua `Idempotency-Key`. A primeira cria a ocorrência. A segunda encontra essa mesma ocorrência como semelhante, mas o servidor verifica que a Ana já a comunicou e responde `200` com `resultado: "ja-comunicada"`, sem alterar o contador: cada cidadão conta uma única vez. Se, em vez de duas comunicações, se tratar da mesma pendente reenviada após uma resposta perdida, é a `Idempotency-Key` que permite ao servidor devolver a resposta guardada, com `Idempotent-Replayed: true`.

**(b) O GPS do telemóvel indica uma precisão de 60 m e o raio da categoria buraco é 15 m. O que pode correr mal na deteção de duplicados, nos dois sentidos? Como deve a interface reagir?**

Com uma precisão de 60 m, o ponto registado pode estar até cerca de 60 m do local real, ou seja, o erro é quatro vezes superior ao raio. Pode correr mal em dois sentidos:

- **Falso negativo (duplicado não detetado):** o buraco é o mesmo de uma ocorrência existente, mas o ponto registado fica a mais de 15 m dela. O servidor cria uma ocorrência nova, e o problema fica dividido por duas ocorrências, cada uma com um contador inferior ao real.
- **Falso positivo (fusão indevida):** o ponto registado fica a menos de 15 m de um buraco diferente. A comunicação é fundida nessa ocorrência, e o problema realmente observado fica sem registo próprio.

A interface deve mostrar sempre a precisão obtida e, quando esta for pior do que o raio da categoria, avisar o cidadão. Com rede, deve pedir-lhe que ajuste o ponto no mapa e mostrar-lhe as candidatas, para que seja ele a decidir («É esta» ou «É outra»). Sem rede, a comunicação pode ser gravada, mas a precisão é enviada em `localizacao.precisao`, ficando registado que a localização é pouco fiável.

**(c) O Rui comunica um semáforo sem rede. Quando a comunicação chega ao servidor, é fundida na ocorrência 87. O que tem o dispositivo do Rui de fazer ao registo local, que nunca teve um id do servidor?**

O registo local existe apenas na loja `pendentes`, identificado por `idLocal`. Quando chega a resposta `200` com `resultado: "reforcada"` e a ocorrência 87, o dispositivo não deve criar uma ocorrência local nova nem tentar atribuir um id ao registo. Numa única transação, deve:

1. apagar a pendente da loja `pendentes`;
2. gravar na loja `minhas` o resultado, associando o `idLocal` à ocorrência 87 (`ocorrenciaId: 87`, `resultado: "reforcada"`, `enviadaEm`);
3. fazer `put` da ocorrência 87 recebida na loja `ocorrencias`, substituindo a versão anterior, caso já existisse.

A vista «As minhas comunicações» passa a mostrar «Juntada à n.º 87 (n comunicações)». Como o Rui reforçou a 87, as alterações posteriores dessa ocorrência, como a mudança de estado para resolvida, chegam-lhe nas sincronizações seguintes, através do pull.

**(d) Porque não basta o cliente perguntar `GET /v1/ocorrencias/semelhantes` antes de criar? Dê dois exemplos em que essa verificação não evita o duplicado.**

A consulta prévia apenas reflete o estado do servidor no momento em que é feita e só acontece quando há rede. Por isso, a decisão final tem de ser tomada pelo servidor, quando a pendente chega. Exemplos em que a consulta não evita o duplicado:

1. **Comunicação sem rede:** a Ana comunica o buraco sem ligação, pelo que a página nunca consulta as semelhantes e grava diretamente uma pendente. Se o servidor não repetisse a deteção, a pendente criaria uma segunda ocorrência.
2. **Comunicações simultâneas:** a Ana e o Bruno consultam as semelhantes ao mesmo tempo, antes de qualquer um deles ter gravado. Nenhum vê a comunicação do outro e ambos pedem a criação. Só o servidor, ao processar o segundo pedido, encontra a ocorrência criada pelo primeiro.

Outros casos: a consulta exceder 3 s e a página gravar a pendente diretamente; a comunicação ficar na fila durante horas, período em que outra pessoa cria a mesma ocorrência; ou um cliente modificado ignorar a verificação.

---

## 2. Etapa 4.1 · Contrato e estratégia

O contrato está em `reporta.openapi.yaml` (versão 1.0.0). Contém os esquemas `Categoria`, `Localizacao`, `Ocorrencia` e `Erro` (e os auxiliares `NovaOcorrencia`, `NovoReforco`, `ResultadoComunicacao`, `Candidatas`, `Alteracoes` e `MudancaEstado`) e as 8 operações da tabela 4.1. Foi validado no Swagger Editor sem erros.

Para além dos códigos da tabela 4.1, o contrato documenta mais três respostas que o servidor dá: `400` nos reforços (a 4.2 exige `400` para uma `Idempotency-Key` que não seja UUID), `400` no `PATCH` de administração (estado inválido) e `503` com `Retry-After` nos dois `POST` (ensaios com `SIMULAR_503`).

### Tabela de pedidos

| Pedido | Cache-Control | Quem o faz (página / SW) | Funciona sem rede? | Pode ser repetido sem efeitos adicionais? |
|---|---|---|---|---|
| `GET /v1/categorias` | `public, max-age=3600` | Página (ao arrancar, guarda o resultado na loja `meta`) | Não, mas a página usa a cópia guardada em `meta` | Sim: é um `GET`, só leitura |
| `GET /v1/ocorrencias/semelhantes` | `no-store` | Página (antes de gravar) | Não: sem rede ou ao fim de 3 s, a página grava diretamente uma pendente | Sim: só leitura |
| `GET /v1/ocorrencias?bbox=` | `no-store` | Página (mapa) | Não: o mapa não é mostrado; a lista continua a ler do IndexedDB | Sim: só leitura |
| `POST /v1/ocorrencias` sem `Idempotency-Key` | `no-store` | SW (fila de saída) | Não: a pendente fica na loja `pendentes` até haver rede | Não: se a resposta se perder, a repetição pode criar uma segunda ocorrência ou ser contada como uma nova comunicação |
| `POST /v1/ocorrencias` com `Idempotency-Key` | `no-store` | SW (fila de saída) | Não: fica na fila e é enviado quando houver rede | Sim: com a mesma chave e o mesmo corpo, o servidor devolve a resposta guardada (`Idempotent-Replayed: true`) durante 24 h |
| `POST /v1/ocorrencias/{id}/reforcos` com `Idempotency-Key` | `no-store` | SW (fila de saída) | Não: fica na fila e é enviado quando houver rede | Sim: a repetição devolve a resposta guardada e o contador não volta a subir |
| `GET /v1/ocorrencias/alteracoes` | `no-store` | SW (pull, depois de esvaziar a fila) | Não: o dispositivo mostra o último estado conhecido | Sim: só leitura; o cursor só avança no cliente, na transação que aplica as alterações |

**Justificação.** As categorias mudam raramente e são iguais para todos os cidadãos, pelo que podem ficar em cache HTTP durante algum tempo. As restantes respostas dependem do estado atual do servidor ou do cidadão (cabeçalho `X-Cidadao`) e não devem ser reutilizadas. Em qualquer caso, nenhuma resposta de `/v1/` entra na Cache API do service worker.

### Antes de avançar

**Que identifica o cidadão em cada pedido protegido, com e sem OAuth?**

Sem OAuth, o cidadão é identificado pelo cabeçalho `X-Cidadao`, com o UUID gerado no dispositivo na primeira utilização e guardado na loja `meta`. O service worker lê-o do IndexedDB e envia-o em cada `POST` e em `GET /v1/ocorrencias/alteracoes`. Com OAuth, o cidadão é identificado pela conta no fornecedor, através do cookie de sessão `HttpOnly` criado pelo servidor depois de trocar o código pelo token. O browser envia esse cookie automaticamente nos pedidos à mesma origem, incluindo os do service worker, e nem a página nem o service worker conseguem lê-lo. As pendentes mantêm a identidade com que foram criadas (regra a justificar na etapa 4.6).

**Pode uma resposta de `GET /v1/ocorrencias/semelhantes` ser servida da Cache API? Porquê?**

Não. A resposta só é útil se refletir o estado atual do servidor: entretanto podem ter surgido ocorrências novas, outras podem ter sido resolvidas e os contadores podem ter mudado. Uma resposta guardada poderia omitir a ocorrência que o cidadão está a ver ou propor-lhe uma já resolvida, induzindo-o num reforço errado (que daria `410`) ou numa criação desnecessária. Além disso, a pesquisa depende das coordenadas exatas, pelo que uma resposta guardada raramente voltaria a servir. Sem rede, o comportamento correto não é mostrar candidatas antigas, mas gravar diretamente uma pendente e deixar a decisão ao servidor, que repete sempre a deteção. Por isso, a regra do service worker é que os pedidos a `/v1/` nunca passam pela Cache API.

---

## 3. Etapa 4.2 · Servidor

_(a preencher no sprint seguinte: sequência Ana/Bruno em simultâneo e efeito de um `await` em `procurarSemelhantes`)_

### Justificação dos raios

| Categoria | Raio | Justificação |
|---|---|---|
| buraco | 15 m | _(valor inicial do enunciado; justificar ou alterar)_ |
| semaforo | 40 m | _(valor inicial do enunciado)_ |
| iluminacao | 20 m | _(valor inicial do enunciado)_ |
| sinalizacao | 20 m | _(valor inicial do enunciado)_ |
| outro | 10 m | _(valor inicial do enunciado)_ |

