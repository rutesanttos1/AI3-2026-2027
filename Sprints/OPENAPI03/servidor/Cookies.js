/**
 * Lê o valor de um cookie a partir do cabeçalho Cookie do pedido.
 * O cabeçalho tem a forma: nome1=valor1; nome2=valor2
 * @param {import('express').Request} req - Pedido Express
 * @param {string} nome - Nome do cookie pretendido
 * @returns {string|null} Valor do cookie, ou null se não existir
 */
export function lerCookie(req, nome) {
  const cabecalho = req.get('Cookie');
  if (!cabecalho) {
    return null;
  }

  const pares = cabecalho.split(';');

  for (const par of pares) {
    // Divide apenas no primeiro '=' (o valor pode conter '=')
    const indice = par.indexOf('=');
    if (indice === -1) {
      continue;
    }

    const chave = par.slice(0, indice).trim();
    if (chave === nome) {
      const valor = par.slice(indice + 1).trim();
      // O Express codifica o valor com encodeURIComponent ao criar o cookie
      try {
        return decodeURIComponent(valor);
      } catch {
        return valor;
      }
    }
  }

  return null;
}