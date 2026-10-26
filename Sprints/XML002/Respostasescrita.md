# Respostas Extensas

## Exercício 3

O atributo `ProductID` foi definido como obrigatório através de `use="required"`. O atributo `Category` foi definido como opcional, uma vez que não foi indicado `use="required"`.



## Exercício 4

O ficheiro `produto.xml` foi validado de acordo com o schema `produto.xsd`. O documento respeita a estrutura, a ordem dos elementos e os tipos de dados definidos no schema.



## Exercício 5

O elemento `Provider` foi definido como opcional através de `minOccurs="0"` e pode aparecer no máximo três vezes através de `maxOccurs="3"`. O `Provider` utiliza um `complexType` porque contém os elementos `Name` e `City`.



## Exercício 8

O ficheiro `aviso.xml` foi validado de acordo com o schema `aviso.xsd` e respeita a estrutura e as regras definidas no schema.



## Exercício 9

Foi criada uma variante válida do documento `aviso.xml`, que respeita as regras definidas no `aviso.xsd`.

Também foi criada uma variante inválida, contendo três contactos. Esta versão é inválida porque o schema permite no máximo dois contactos através de `maxOccurs="2"`.



## Exercício 10

| Documento XML        | Schema XSD    | Resultado |
| -------------------- | ------------- | --------- |
| `produto.xml`        | `produto.xsd` | Válido    |
| `aviso.xml`          | `aviso.xsd`   | Válido    |
| `aviso-valido.xml`   | `aviso.xsd`   | Válido    |
| `aviso-invalido.xml` | `aviso.xsd`   | Inválido  |

O documento `aviso-invalido.xml` é inválido porque contém três contactos, ultrapassando o máximo de dois permitido pelo schema.


## Exercício 11

| Alteração realizada               | Tipo de erro       | Conclusão                                                               |
| --------------------------------- | ------------------ | ----------------------------------------------------------------------- |
| Retirar uma etiqueta de fecho     | XML mal formado    | O documento deixa de respeitar a sintaxe básica do XML.                 |
| Colocar texto no elemento `Price` | Documento inválido | O valor não respeita o tipo `xsd:decimal` definido no schema.           |
| Alterar a ordem dos elementos     | Documento inválido | A ordem dos elementos não respeita o `xsd:sequence` definido no schema. |



## Exercício 12

| Construção                | Função                                                          | Exemplo                               |
| ------------------------- | --------------------------------------------------------------- | ------------------------------------- |
| `complexType`             | Permite definir estruturas complexas com elementos e atributos. | `Product` e `Provider`                |
| `sequence`                | Define a ordem pela qual os elementos devem aparecer.           | `ProductName`, `ProductType`, `Price` |
| `attribute` com `use`     | Permite definir atributos obrigatórios ou opcionais.            | `ProductID`                           |
| `minOccurs` / `maxOccurs` | Define o número mínimo e máximo de ocorrências de um elemento.  | `Provider` entre 0 e 3 vezes          |
| `mixed`                   | Permite combinar texto livre com elementos XML.                 | `aviso`                               |



