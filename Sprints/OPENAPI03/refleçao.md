# Ficha de Verificação e Reflexão Crítica — Segurança em APIs REST & OpenAPI

---

## 4.4 — Verificação

### Ponto 27 — Tabela de validação do contrato

| Alteração introduzida | Tipo de problema | O que permite concluir |
| :--- | :--- | :--- |
| **Referir tokenJWT na raiz sem o declarar em `securitySchemes`** | OpenAPI inválido | O esquema de segurança referenciado tem de estar declarado. |
| **Escrever `type: bearer` em vez de `type: http`** | OpenAPI inválido | O tipo correto é `http`, com `scheme: bearer`. |
| **Escrever `tokenJWT: [servicos]`** | OpenAPI inválido | Os *scopes* não são permitidos em esquemas HTTP Bearer. A lista tem de ser vazia. |
| **Retirar `security: []` de `listarCategorias`** | Válido, mas altera o significado | A operação passa a herdar a segurança global e deixa de estar declarada como pública. |
| **Manter `numeroAluno` em `required` após remover a propriedade** | OpenAPI inválido | Uma propriedade obrigatória tem de estar definida em `properties`. |
| **Indicar `tipo: bearer` no exemplo de Token** | Exemplo incompatível com o schema | O valor correto é `Bearer`, respeitando o *enum* definido. |

> **Ferramenta de Validação:** `npx @redocly/cli lint sugestoes.openapi.yaml` ou Swagger Editor.  
> *Nota: Na coluna da mensagem obtida, deves copiar o resultado real apresentado pela ferramenta utilizada.*

---

### Ponto 28 — Tabela de testes do servidor

| Teste | Código esperado | Cache-Control | WWW-Authenticate | Resultado esperado |
| :---: | :---: | :--- | :--- | :--- |
| **T1** | `200` | `no-store` | Ausente | Token válido da Ana. |
| **T2** | `401` | `no-store` | Ausente | Erro genérico de credenciais inválidas. |
| **T3** | `401` | `no-store` | Ausente | Corpo exatamente igual ao de T2. |
| **T4** | `400` | `no-store` | Ausente | Erro com detalhes do campo inválido. |
| **T5** | `400` | Verificar resposta | Ausente | Erro em JSON, sem página HTML do Express. |
| **T6** | `401` | `no-store` | `Bearer` | Erro de autenticação. |
| **T7** | `200` | `private, no-cache` | Ausente | Apenas as sugestões da Ana. |
| **T8** | `200` | `private, no-cache` | Ausente | Todas as sugestões. |
| **T9** | `401` | `no-store` | `Bearer error="invalid_token"` | Assinatura inválida. |
| **T10** | `401` | `no-store` | `Bearer error="invalid_token"` | Token expirado. |
| **T11** | `401` | `no-store` | `Bearer error="invalid_token"` | Algoritmo não aceite. |
| **T12** | `200`, se ainda válido | `private, no-cache` | Ausente | O token continua a ser aceite pelo servidor. |

> **Nota para a Entrega:** Regista os códigos, cabeçalhos e corpos efetivamente observados. No **T12**, confirma que o token ainda não expirou.

---

### Ponto 30 — Tabela de construções

| Construção | Onde foi utilizada | O que passou a ser exigido | O que continua a ser permitido |
| :--- | :--- | :--- | :--- |
| **securitySchemes HTTP/Bearer** | `components.securitySchemes` | Definir o mecanismo de autenticação. | Utilizar tokens Bearer válidos. |
| **security na raiz** | Raiz de `sugestoes.openapi.yaml` | Autenticação por omissão. | Isentar operações públicas. |
| **security: []** | Operações públicas | Não exigir autenticação. | Efetuar pedidos sem token. |
| **readOnly em numeroAluno** | Schema `Sugestao` | O campo é atribuído pelo servidor. | Incluir o campo nas respostas. |
| **Resposta 401 + WWW-Authenticate** | Operações protegidas | Indicar que é necessária autenticação ou que o token é inválido. | Repetir o pedido após autenticação válida. |
| **Resposta 403** | Operações protegidas por papel | Rejeitar operações não autorizadas. | Executar operações permitidas ao papel. |
| **exigirToken + jwt.verify** | Middleware Express | Verificar o token antes da execução da operação. | Prosseguir com pedidos autenticados válidos. |
| **Cache-Control: no-store em criarToken** | Resposta de `POST /tokens` | Não armazenar a resposta com o token. | Entregar o token ao cliente. |

---

## 4.5 — Reflexão crítica

### Pergunta 31.1 — Efeito do termo de sessão e revogação do token
O termo de sessão elimina o token da variável do módulo no cliente, impedindo a sua utilização normal através daquela página. Contudo, não invalida o token no servidor, que continua a aceitá-lo até expirar. Para permitir a revogação imediata, seria necessário manter um registo de tokens revogados ou de sessões no servidor. Isso introduziria estado no servidor e reduziria a autossuficiência do JWT.

### Pergunta 31.2 — Vantagens e desvantagens de 15 segundos e 15 dias
Uma validade de 15 segundos reduz o período durante o qual um token roubado pode ser utilizado, mas obriga a autenticações muito frequentes e prejudica a utilização normal. Uma validade de 15 dias oferece maior comodidade, mas aumenta o período de exposição caso o token seja comprometido. A validade de 15 minutos constitui um compromisso entre segurança e facilidade de utilização.

### Pergunta 31.3 — Variável do módulo, localStorage e cookies HttpOnly
A variável do módulo perde o token quando a página é recarregada, limitando a sua persistência. O `localStorage` mantém o token, mas este pode ser acedido por JavaScript, incluindo código malicioso executado na página (XSS). Um cookie `HttpOnly` impede o acesso direto ao cookie por JavaScript, mas o navegador envia-o automaticamente nos pedidos, introduzindo riscos de CSRF. Seriam necessárias medidas adicionais de proteção contra esses ataques.

### Pergunta 31.4 — Papel incluído no token
O papel incluído no JWT permite ao servidor tomar decisões sem consultar uma base de dados em cada pedido. Contudo, se o papel mudar, um token antigo pode continuar a conter o papel anterior até expirar. Uma alternativa seria consultar o papel atual do utilizador no servidor em cada pedido. Isso permite aplicar alterações imediatamente, mas exige uma consulta adicional.

### Pergunta 31.5 — Utilização de HS256 por vários serviços
Com HS256, qualquer serviço que verifique tokens precisa de conhecer o segredo de assinatura. Se o segredo for partilhado com vários serviços, o comprometimento de um deles pode permitir a criação de tokens falsos aceites pelos restantes. Uma alternativa seria utilizar assinaturas assimétricas, como RS256, em que o serviço emissor utiliza a chave privada e os serviços verificadores utilizam apenas a chave pública. Esta alternativa está fora do âmbito da ficha.

### Pergunta 31.6 — Limite de tentativas de autenticação
O contrato pode documentar uma resposta `429 Too Many Requests`, mas não consegue impor um limite real de tentativas. Esse limite tem de ser implementado no servidor, por exemplo, através de mecanismos que limitem os pedidos por utilizador ou endereço IP (rate limiting). Quando o limite é ultrapassado, o servidor pode responder com `429`.

### Pergunta 31.7 — Proteção do token Bearer sem HTTPS
Sem HTTPS, o token pode ser intercetado durante a transmissão por alguém com capacidade para observar a comunicação (ataques Man-in-the-Middle). Como a posse do token é suficiente para autenticar o utilizador, quem o obtiver poderá utilizá-lo até expirar. O esquema Bearer não protege, por si só, a confidencialidade do token durante o transporte, sendo necessário utilizar HTTPS.

### Pergunta 31.8 — Garantias do contrato, do servidor e dos testes
O contrato documenta as operações, os schemas e as regras de autenticação e autorização esperadas, mas não executa nem impõe essas regras. O servidor é responsável por verificar os tokens, os papéis e a propriedade das sugestões em cada pedido. Os testes permitem confirmar se a implementação se comporta conforme esperado nos cenários testados, mas não garantem a ausência de todos os erros possíveis.