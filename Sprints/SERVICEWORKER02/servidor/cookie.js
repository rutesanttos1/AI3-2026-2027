/**
 * Lê o valor de um cookie a partir do cabeçalho Cookie.
 * Esta função permite obter um cookie específico através do seu nome.
 */

// Exporta a função para que possa ser utilizada noutros ficheiros.
// Recebe o pedido HTTP (req) e o nome do cookie que queremos encontrar.
export function lerCookie(req, nome) {

  // Obtém o cabeçalho Cookie enviado pelo navegador.
  // Este cabeçalho pode conter vários cookies.
  const cabecalho = req.get('Cookie');

  // Se o pedido não tiver nenhum cabeçalho Cookie,
  // significa que não existem cookies para consultar.
  if (!cabecalho) {
    return null;
  }

  // Separa os vários cookies.
  // Normalmente, os cookies são separados por ponto e vírgula.
  // Exemplo: sessao=abc123; idioma=pt.
  const pares = cabecalho.split(';');

  // Percorre todos os cookies encontrados no cabeçalho.
  for (const par of pares) {

    // Procura a posição do sinal "=".
    // Antes do sinal está o nome do cookie;
    // depois do sinal está o respetivo valor.
    const indice = par.indexOf('=');

    // Se não existir o sinal "=", ignora este elemento
    // e passa ao próximo cookie.
    if (indice === -1) {
      continue;
    }

    // Extrai o nome do cookie.
    // slice(0, indice) obtém o texto antes do sinal "=".
    // trim() remove espaços em branco no início e no fim.
    const chave = par.slice(0, indice).trim();

    // Verifica se o nome do cookie corresponde
    // ao nome que estamos à procura.
    if (chave === nome) {

      // Extrai o valor do cookie.
      // slice(indice + 1) obtém o texto depois do sinal "=".
      // trim() remove espaços desnecessários.
      const valor = par.slice(indice + 1).trim();

      try {

        // Descodifica o valor do cookie.
        // decodeURIComponent() converte caracteres codificados
        // para a sua representação original.
        return decodeURIComponent(valor);

      } catch {

        // Se não for possível descodificar o valor,
        // devolve o valor original sem provocar um erro.
        return valor;
      }
    }
  }

  // Se percorrer todos os cookies e não encontrar o pretendido,
  // devolve null.
  return null;
}
