### 14. Reflexão crítica

**a) Ao converter o XML em JSON, a distinção entre atributo e elemento desapareceu. Perdeu-se informação? Para quem é que isso importa?**

Sim, perdeu-se a distinção entre atributo e elemento, embora os valores dos dados tenham sido mantidos. Esta diferença pode ser importante para sistemas que dependam da estrutura original do XML ou que atribuam significados diferentes a atributos e elementos.

**b) O XML Schema da ficha anterior impunha a ordem dos elementos; o JSON Schema não. Isso é uma fraqueza ou uma vantagem para quem escreve o programa leitor?**

É uma vantagem, porque o programa leitor não precisa de esperar que as propriedades apareçam numa determinada ordem. Assim, torna-se mais flexível e simples de implementar.

**c) O `totalAlunos` é um número entre 16 e 24. Que combinações absurdas de valores o seu schema continua a aceitar? O que faria falta para as impedir?**

O schema pode aceitar, por exemplo, `totalAlunos = 20` com `numeroInscritosTp1 = 20` e `numeroInscritosTp2 = 20`, apesar de o total de inscritos ser superior ao total de alunos. Para impedir estas combinações seria necessária uma regra que permitisse relacionar e comparar os valores de diferentes propriedades.

**d) Um documento é válido hoje. Amanhã acrescenta-se ao `required` uma propriedade nova. O que acontece a todos os documentos já existentes? Que escolha teria evitado o problema?**

Os documentos antigos que não possuam essa nova propriedade deixam de ser válidos. Para evitar este problema, seria preferível não tornar a nova propriedade obrigatória ou criar uma nova versão do schema.

**e) Compare o custo de validar com o custo de não validar: que erros passam a ser detetados no momento certo, e que trabalho é que isso poupa a quem escreve o programa leitor?**

A validação tem um custo inicial de criação e manutenção do schema, mas permite detetar antecipadamente erros de estrutura, tipos, valores e propriedades obrigatórias. Isso evita que o programa leitor tenha de verificar todos esses erros individualmente, poupando tempo de desenvolvimento e reduzindo erros durante a execução.
