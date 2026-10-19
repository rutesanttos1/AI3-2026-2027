4.1
Crie o ficheiro sugestoes.openapi.yaml com openapi, info (título API de Sugestões dos Alunos, versão 1.0.0 e uma descrição de uma frase) e servers com o URL base https://api.estgv.exemplo/v1.


Operação	Seguro?	Idempotente?
GET /sugestoes	Sim	Sim
POST /sugestoes	Não	Não
GET /sugestoes/	Sim	Sim
PUT /sugestoes/	Não	Sim
DELETE /sugestoes/	Não	Sim
GET /sugestoes//acompanhamentos	Sim	Sim
POST /sugestoes//acompanhamentos	Não	Não
GET /estatisticas/resolucao	Sim	Sim
GET /estatisticas/categorias	Sim	Sim
GET /categorias	Sim	Sim

Existem 6 URLs diferentes, apesar de existirem 10 operações, porque algumas operações partilham o mesmo caminho e utilizam métodos HTTP diferentes.

Nº	URL	Métodos HTTP
1	/sugestoes	GET, POST
2	/sugestoes/{id}	GET, PUT, DELETE
3	/sugestoes/{id}/acompanhamentos	GET, POST
4	/estatisticas/resolucao	GET
5	/estatisticas/categorias	GET
6	/categorias	GET

Justificação 
- Um método seguro não deve alterar o estado dos recursos do servidor.
- Um método idempotente tem o mesmo efeito pretendido quando executado uma ou várias vezes com o mesmo pedido.
- GET é seguro e idempotente.
- POST, neste domínio, não é seguro nem idempotente, porque cria sugestões ou novos acompanhamentos.
- PUT não é seguro, mas é idempotente porque substituir repetidamente o mesmo recurso pelo mesmo conteúdo tem o mesmo efeito pretendido.
- DELETE não é seguro, mas é idempotente porque retirar repetidamente o mesmo recurso tem o mesmo efeito final pretendido, mesmo que os códigos de resposta possam ser diferentes.

4.2
- Utilizei allOf, porque permite combinar as propriedades de SugestaoNova com as propriedades adicionais de Sugestao. Não utilizei oneOf, porque este serve para validar exatamente uma das alternativas, enquanto neste caso é necessário cumprir ambas.
- O required das propriedades novas fica no segundo subesquema de allOf, onde são declaradas as propriedades adicionais de Sugestao.
- Utilizei SugestaoNova nos pedidos e Sugestao nas respostas, definindo id e estado como obrigatórios e de leitura (readOnly: true) no schema Sugestao.

4.3
Código	Significado
200	Sugestão atualizada com sucesso
400	Pedido inválido
404	Sugestão não encontrada
409	A sugestão já não está no estado submetida
412	O ETag enviado não corresponde à versão atual
default	Outros erros

Código	Significado
204	Sugestão retirada com sucesso, sem corpo
404	Sugestão não encontrada
409	A sugestão já não está no estado submetida
default	Outros erros

200	O histórico foi obtido com sucesso
type: array	A resposta contém uma lista de acompanhamentos
items	Cada elemento da lista segue o schema Acompanhamento
404	A sugestão não foi encontrada
default	Outros erros
CachePrivado	Utiliza private, no-cache

Código	Significado
201	O acompanhamento foi criado com sucesso
400	Os dados enviados são inválidos
404	A sugestão não foi encontrada
409	A mudança de estado não é permitida
default	Outros erros

Elemento	Significado
200	Estatísticas obtidas com sucesso
EstatisticasCategorias	Schema que define os dados devolvidos
CacheEstatisticas	Cache pública durante 3600 segundos (1 hora)
400	Pedido inválido
default	Outros erros

4.4
### 4.4 — Validação e testes

**Validação inicial com Redocly CLI**

Foi executado o comando `npx @redocly/cli lint` para verificar a conformidade da especificação OpenAPI 3.0.3.

A ferramenta identificou 51 erros e 4 avisos. Entre os problemas encontrados destacam-se referências `$ref` não resolvidas, parâmetros de caminho não reconhecidos e propriedades colocadas incorretamente na estrutura do documento.

Estes resultados demonstram a importância da validação automática, uma vez que um ficheiro pode apresentar sintaxe YAML válida e, ainda assim, não cumprir as regras da especificação OpenAPI.

**Teste 1 — Erro de sintaxe YAML**

Foi introduzida uma alteração intencional na especificação OpenAPI e executado o comando `npx @redocly/cli lint`.

A ferramenta apresentou a mensagem `Failed to parse API description — deficient indentation (4:1)`.


O resultado demonstra que um erro de sintaxe ou indentação impede o Redocly de interpretar corretamente o documento YAML.$ref: '#/components/schemas/ListaSugestoes'



4.5
Reflexão Critica
6. Exercício 4.5 — Reflexão crítica
15.1. As regras de transição de estado são suficientes se estiverem apenas nas descrições?
Não. As descrições ajudam os programadores a compreender as regras, mas não garantem que o servidor as cumpra. As transições têm de ser verificadas na implementação do servidor.
15.2. A exposição do numeroAluno é um problema?
Sim, pode expor dados pessoais dos alunos. O contrato de base não consegue exprimir completamente que uma sugestão só pode ser consultada pelo seu autor. Essa regra exige autenticação e autorização, mecanismos excluídos desta ficha.
15.3. Qual é o efeito de max-age=3600 nas estatísticas?
O cliente pode consultar respostas guardadas durante uma hora, reduzindo pedidos ao servidor e melhorando o desempenho. Em contrapartida, pode ver dados desatualizados. Com no-cache, a resposta teria de ser revalidada antes de cada utilização.
15.4. O que acontece ao alterar os schemas na versão v1?
Acrescentar uma propriedade obrigatória a SugestaoNova pode impedir os clientes existentes de criarem ou editarem sugestões. Esta alteração pode ser incompatível e justificar uma v2. Acrescentar uma propriedade apenas às respostas de Sugestao também pode afetar clientes que não esperem essa propriedade, embora geralmente seja menos problemático.
15.5. Porque é que a especificação está em YAML e a API troca JSON?
Porque são utilizados para finalidades diferentes. O YAML descreve o contrato da API; o JSON é o formato dos dados enviados nos pedidos e devolvidos nas respostas.
15.6. Qual é a vantagem de escrever o contrato antes do código?
Permite identificar antecipadamente desacordos sobre URLs, métodos, campos obrigatórios, tipos, códigos HTTP e cache. Assim, cliente e servidor podem ser desenvolvidos com base nas mesmas regras, reduzindo erros de integração.