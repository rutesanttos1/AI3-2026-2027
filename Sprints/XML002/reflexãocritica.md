13.
13.1Sim. Um schema resolve o problema das diferentes hierarquias porque define uma estrutura que os documentos têm de cumprir para serem considerados válidos. O schema tem de ser escrito por quem define as regras do documento e antes da produção dos documentos, para que todos sigam a mesma estrutura.


Embora o Price seja um número decimal, o schema continua a aceitar valores que podem ser absurdos do ponto de vista do negócio, como um preço negativo ou um preço demasiado elevado. Com os mecanismos desta ficha não é possível impor esses limites. Seriam necessárias restrições adicionais sobre o tipo de dados.


Se for acrescentado ao schema um novo elemento obrigatório, todos os documentos existentes que não tenham esse elemento deixam de ser válidos contra a nova versão do schema. Para evitar esse problema, o novo elemento poderia ser declarado como opcional através de minOccurs="0".

A validação permite detetar erros como elementos em falta, elementos na ordem errada e valores com tipos incorretos. Isto poupa trabalho a quem desenvolve o programa leitor, porque muitos erros são detetados antes de o documento ser processado pela aplicação.


Sem mixed="true", seria difícil especificar documentos que combinam texto livre com elementos estruturados. Um exemplo seria uma notícia, que pode conter texto corrido e, no meio desse texto, elementos marcados como o autor, a data ou o título.
