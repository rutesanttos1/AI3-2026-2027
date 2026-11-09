# 4.1 — Contrato e estratégia

| Pedido | Cache-Control no contrato | Depende do cookie? | Estratégia no Service Worker | Guardado em IndexedDB? |
|---|---|---|---|---|
| Ficheiros da interface (/, /app.js, …) | — | Não | Cache primeiro (`interface-v1`) | Não |
| GET /v2/categorias | `public, max-age=86400` | Não | Cache e atualização em segundo plano (`dados-publicos`) | Não |
| POST /v2/sessao | `no-store` | Não | Só rede | Não |
| GET /v2/sessao | `no-store` | Sim | Só rede | Não |
| DELETE /v2/sessao | `no-store` | Sim | Só rede | Não |
| GET /v2/sugestoes | `private, no-cache` | Sim | Só rede | Sim |
| POST /v2/sugestoes | `no-store` | Sim | Só rede | Sim, quando fica pendente ou após criação |

**Verificação CA2:** Todos os pedidos que dependem de cookie utilizam a estratégia «só rede». Não são intercetados pelo Service Worker através de `respondWith`.

---

# 4.6 — Verificação

## Testes ao servidor

| Teste | Pedido | Resultado esperado | Resultado obtido |
|---|---|---|---|
| T1 | GET /v2/categorias sem cookie | 200 e `Cache-Control: public, max-age=86400` | Categorias apresentadas no navegador. Falta confirmar o cabeçalho através de `curl -i`. |
| T2 | POST /v2/sugestoes com cookie da Ana e título com 5 caracteres | 400, com detalhes | Foram testadas validações do formulário, mas falta confirmar este pedido diretamente ao servidor com o cookie da Ana. |
| T3 | POST /v2/sugestoes com cookie da Ana e `"numeroAluno": "99999"` | 201, Location e número de aluno da Ana | Foi criada uma sugestão válida através da aplicação. Falta confirmar diretamente a resposta e o número de aluno devolvido. |

## Testes no browser

| Teste | O que deve ser demonstrado | Resultado |
|---|---|---|
| (a) | Service Worker ativo, conteúdo das caches e ausência de sessões/sugestões em cache | Por verificar completamente |
| (b) | Pedidos servidos pelo Service Worker na coluna Tamanho | Por verificar |
| (c) | Estado `a-verificar` com rede lenta (3G lento) | Por verificar |
| (d) | Modo Offline, recarregamento e apresentação da cópia local | Parcialmente confirmado: a página abriu e as sugestões locais apareceram |
| (e) | Criar sugestão offline e enviá-la após recuperar a ligação | Confirmado: ficou «Por enviar» e depois foi enviada |
| (f) | Expiração da sessão com pendente e manutenção da pendente até nova entrada | Por verificar |
| (g) | Alterar a ordenação sem ligação | Por verificar |
| (h) | Ana termina sessão e Bruno entra sem ver os dados da Ana | Por verificar |
| (i) | Expiração da sessão da Ana e entrada do Bruno no mesmo browser | Por verificar |
| (j) | Atualização de `interface-v1` para `interface-v2` | Confirmado: a versão #105 ficou ativa. Falta confirmar a alteração do nome da cache para `interface-v2` e a eliminação da cache antiga. |

---

## Tabela — armazenamento dos dados

| Dado | Mecanismo usado | Quem escreve (servidor, página ou Service Worker) | Quando é apagado | Porque não se usou outro mecanismo |
|---|---|---|---|---|
| Token | Cookie HttpOnly | Servidor, através do cabeçalho Set-Cookie | Quando termina a sessão ou quando expira | Não se usa localStorage porque o token não deve estar diretamente acessível ao JavaScript. |
| Configurações | localStorage | Página | Quando o utilizador limpa os dados ou altera as configurações | Não se usa IndexedDB porque são dados simples e de pequena dimensão. |
| Rascunho | sessionStorage | Página | Quando é submetido ou quando termina a sessão com sucesso | Não se usa localStorage porque o rascunho deve ter uma duração limitada à sessão do separador. |
| Ficheiros da interface | Cache API (`interface-v1`) | Service Worker | Quando é criada uma nova versão e a cache antiga é eliminada | Não se usa IndexedDB porque a Cache API é própria para guardar recursos e respostas HTTP. |
| Categorias | Cache API (`dados-publicos`) | Service Worker | Quando a cache é atualizada ou eliminada | Não se usa localStorage porque são dados obtidos através de pedidos HTTP e sujeitos a atualização. |
| Lista de sugestões | IndexedDB (`sugestoes`) | Página, após receber os dados do servidor | Quando muda o proprietário da cópia local ou quando a base de dados é limpa | Não se usa localStorage porque são dados estruturados que necessitam de operações e consultas. |
| Sugestões pendentes | IndexedDB (`pendentes`) | Página | Quando são enviadas com sucesso, descartadas ou quando a base de dados é limpa | Não se usa sessionStorage porque as sugestões têm de permanecer guardadas até poderem ser enviadas. |

---

# 4.7 — Reflexão

### 1. Sem ligação, a interface mostra dados e aceita sugestões. Que operação de autenticação continua impossível sem ligação, e porquê?

A operação que continua impossível é iniciar uma nova sessão, ou seja, autenticar um utilizador através das suas credenciais.

Isto acontece porque é necessário contactar o servidor para validar o nome de utilizador e a palavra-passe e obter uma sessão válida. Sem ligação à Internet, essa validação não pode ser realizada.

A aplicação pode apresentar uma cópia local previamente guardada, desde que a sessão e as condições de validade o permitam, mas isso não corresponde a uma nova autenticação.

### 2. Em (e), se a ligação tivesse caído depois de o servidor criar a sugestão e antes de chegar a resposta, o que teria acontecido? Que alteração ao contrato e ao servidor evitaria o problema, e que versão teria a API depois dela?

O servidor poderia ter criado a sugestão, mas a aplicação não receberia a resposta devido à falha da ligação.

A aplicação poderia considerar que o pedido falhou e guardar a sugestão como pendente. Quando a ligação regressasse, poderia enviá-la novamente, provocando uma duplicação.

Para evitar este problema, poderia ser implementada uma chave de idempotência (*Idempotency-Key*). Cada pedido teria uma chave única e o servidor guardaria as chaves já utilizadas, evitando criar novamente uma sugestão quando recebesse um pedido repetido com a mesma chave.

Esta alteração exigiria modificar o contrato OpenAPI e a implementação do servidor. A versão seguinte seria 2.2.0, considerando uma alteração compatível com a versão 2.1.0.

### 3. A Background Sync API permitiria enviar as pendentes com a página fechada. Que problema resolveria? Por que razão o cookie continuaria a ser uma limitação?

A Background Sync API permitiria ao Service Worker tentar enviar automaticamente as sugestões pendentes quando a ligação à Internet regressasse, mesmo que a página estivesse fechada.

O cookie continuaria a ser uma limitação porque a autenticação depende de uma sessão válida, que pode expirar ou ser terminada antes do envio. Além disso, sendo HttpOnly, o Service Worker não consegue ler diretamente o seu conteúdo para identificar o utilizador associado. O navegador pode enviar automaticamente o cookie nos pedidos adequados, mas a validade da sessão continua a ter de ser confirmada pelo servidor.

### 4. Num computador partilhado, a cópia local da Ana fica na IndexedDB depois de a sessão expirar. Que risco isso representa? Que regras desta ficha o reduzem, e o que continua por resolver?

O principal risco é outro utilizador do mesmo computador conseguir aceder a dados pessoais da Ana que ficaram guardados localmente.

A ficha reduz esse risco ao associar a cópia local a um proprietário, verificar a validade da sessão, apagar a IndexedDB quando muda o utilizador e limpar os dados locais quando a sessão termina com sucesso.

No entanto, enquanto a cópia local permanecer guardada após a expiração da sessão, poderá existir um risco de acesso por alguém que utilize o mesmo computador. Por isso, é importante impedir que outro utilizador veja a cópia da Ana e limpar os dados quando ocorre uma mudança de proprietário.

### 5. Se a Ana mudar de computador, leva consigo as configurações? E as pendentes? Compare com a resposta dada na API03.

As configurações guardadas no localStorage não são automaticamente transferidas para outro computador, porque pertencem ao navegador e ao dispositivo onde foram guardadas.

As sugestões pendentes guardadas na IndexedDB também não são transferidas, uma vez que a base de dados é local.

Na API03, os dados disponíveis no servidor podiam ser consultados noutros dispositivos após autenticação. Nesta implementação, as sugestões já submetidas continuam disponíveis no servidor, mas as configurações e as sugestões ainda pendentes permanecem no dispositivo original.