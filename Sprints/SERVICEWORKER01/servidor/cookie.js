/**
 * Lê o valor de um cookie a partir do cabeçalho Cookie.
 */
export function lerCookie(req, nome) {
  const cabecalho = req.get('Cookie');

  if (!cabecalho) {
    return null;
  }

  const pares = cabecalho.split(';');

  for (const par of pares) {
    const indice = par.indexOf('=');

    if (indice === -1) {
      continue;
    }

    const chave = par.slice(0, indice).trim();

    if (chave === nome) {
      const valor = par.slice(indice + 1).trim();

      try {
        return decodeURIComponent(valor);
      } catch {
        return valor;
      }
    }
  }

  return null;
}