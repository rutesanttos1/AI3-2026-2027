# Reflexão crítica

 1. 

O critério que usámos foi considerar se a informação é um dado simples associado a outro elemento ou se pode vir a ter uma estrutura própria. Usámos atributos para informações simples e elementos para dados que podem precisar de mais informação ou de outros elementos no futuro.

No caso do `telefone` do cliente, escolhemos representá-lo como elemento porque é uma informação própria do cliente e pode futuramente ser complementada com outras informações.

 2.
Um dado da fatura que poderia ser representado como atributo é a `data`, porque é uma informação simples associada à fatura.

Um dado que não seria adequado como atributo é a `morada`, caso seja necessário dividi-la em rua, código postal e localidade. Nesse caso, seria mais adequado representá-la como elemento, porque permite uma estrutura mais detalhada.

A diferença é que um atributo não pode conter outros elementos, enquanto um elemento pode ter outros elementos no seu interior.

 3. 

Consideramos que o total pode ser calculado pelo programa que lê a fatura, utilizando a quantidade e o preço de cada produto. Desta forma, não é necessário guardar no XML um valor que pode ser obtido através dos restantes dados.

Por outro lado, guardar o total no ficheiro poderia facilitar a sua consulta e evitar que tivesse de ser calculado novamente. As duas possibilidades podem ser utilizadas, dependendo da finalidade do documento.

4. 

A nossa estrutura permite representar uma fatura sem produtos, deixando o elemento `produtos` sem elementos `produto`.

Também seria possível representar dois clientes se fossem colocados dois elementos `cliente` na estrutura. O XML, por si só, não impede nenhuma destas situações. É a estrutura definida para o documento que determina como os dados podem ser organizados.

 5. 

Se dois colegas criarem hierarquias diferentes e ambas forem documentos XML bem formados, o problema é que um programa que leia as faturas não saberá necessariamente onde encontrar cada informação.

O programa teria de conhecer diferentes estruturas para conseguir interpretar os documentos. Por isso, consideramos importante existir uma estrutura definida e consistente para que diferentes programas consigam ler as faturas da mesma forma.
