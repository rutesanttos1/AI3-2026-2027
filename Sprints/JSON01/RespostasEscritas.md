
# exercicio 2
Os atributos do XML foram representados como propriedades do JSON. A distinção entre atributos e elementos deixa de existir, mas os valores são mantidos. Os elementos repetidos, como disciplina, foram representados através de um array.

# exercicio 4
As propriedades obrigatórias são indicadas através da palavra-chave required. Assim, curso e disciplinas são obrigatórios, tal como codigo, nome e teorica em cada disciplina. A propriedade pratica é opcional porque não aparece no required.

Como teorica e pratica são objetos com propriedades no seu interior, possuem uma secção properties própria e um required interno, onde horas e nome são obrigatórios.

# exercicio 6
O ficheiro disciplinas.json foi validado contra o disciplinas.schema.json e passou na validação.

# exercicio 8
Para o planoAno1 foi utilizado oneOf, pois é necessário que as disciplinas pertençam apenas a um dos dois conjuntos definidos. anyOf não seria adequado porque permitiria que mais do que uma alternativa fosse válida ao mesmo tempo.

# exercicio 9
O ficheiro turma.json foi validado contra o turma.schema.json e passou na validação.

# exercicio 10
Variante válida

"numeroInscritosTp2": 8,
"docenteTp2": "Carla Mendes"

Ou seja, retiramos as duas propriedades.

Resultado:

A variante continua válida, porque numeroInscritosTp2 e docenteTp2 são opcionais. Como o número de inscritos TP2 foi retirado, a dependência deixa de ser aplicada.

Variante inválida

Retiramos
"docenteTp2": "Carla Mendes"

mas deixamos:

"numeroInscritosTp2": 8

Resultado:

A variante fica inválida porque, sempre que existe numeroInscritosTp2, a dependencies exige também a existência de docenteTp2.

# exercicio 12
| Alteração introduzida               | Ficheiro     | Sintaxe errada, inválido ou válido? | Mensagem obtida                                                | O que a mensagem permitiu concluir                                                      |
| ----------------------------------- | ------------ | ----------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Retirar a vírgula entre dois pares  | `turma.json` | Sintaxe errada                      | Erro de sintaxe, indicando a localização do erro               | Permitiu concluir que faltava uma vírgula na estrutura JSON                             |
| Pôr texto onde é esperado um número | `turma.json` | Inválido                            | Erro de validação indicando que era esperado um `integer`      | Permitiu concluir que o valor não respeita o tipo definido no schema                    |
| Retirar uma propriedade obrigatória | `turma.json` | Inválido                            | Erro de validação indicando a propriedade obrigatória em falta | Permitiu concluir que a propriedade definida em `required` tem de existir               |
| Trocar a ordem de duas propriedades | `turma.json` | Válido                              | Sem erro                                                       | Permitiu concluir que o JSON Schema não exige uma ordem específica para as propriedades |

# exercicio 13
| Construção                        | Onde a usou                                 | O que ficou a ser exigido                                                   | O que continua a ser permitido                                  |
| --------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `type` / `properties`             | `turma.schema.json`                         | Define o tipo e as propriedades do documento                                | Permite apenas valores dos tipos definidos                      |
| `required`                        | `turma.schema.json`                         | Obriga à existência das propriedades indicadas                              | As propriedades que não estão em `required` continuam opcionais |
| `items` + `minItems` / `maxItems` | `cursos`                                    | Obriga a que seja um array com exatamente 2 elementos                       | Os elementos podem ser escolhidos entre os valores permitidos   |
| `pattern`                         | `disciplina`                                | Obriga a que comece por `Aplicacoes`                                        | Permite diferentes textos que respeitem o padrão                |
| `enum`                            | `codigo`                                    | Obriga a que o valor pertença à lista definida                              | Permite qualquer um dos valores dessa lista                     |
| `dependencies`                    | `numeroInscritosTp1` / `numeroInscritosTp2` | Se existir o número de inscritos, o respetivo docente também tem de existir | O turno pode ser totalmente omitido                             |
| `oneOf`                           | `planoAno1`                                 | Obriga a que seja escolhido apenas um dos dois conjuntos                    | Permite disciplinas pertencentes ao conjunto escolhido          |
