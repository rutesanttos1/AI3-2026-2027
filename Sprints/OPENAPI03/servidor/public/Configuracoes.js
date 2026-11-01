// Configurações da interface guardadas em localStorage.
// Pertencem ao browser (não ao utilizador) e duram até serem apagadas.

const CHAVE = 'configuracoes';

// Valores admitidos para cada opção (tabela da ficha)
const VALORES_ADMITIDOS = {
  tema: ['claro', 'escuro'],
  ordenacao: ['recentes', 'estado']
};

// Valores por omissão
const POR_OMISSAO = {
  tema: 'claro',
  ordenacao: 'recentes'
};

/**
 * Lê as configurações guardadas no localStorage.
 * Se a chave não existir, não for JSON válido ou tiver valores fora da tabela,
 * usa os valores por omissão (o utilizador pode alterar o valor à mão nas ferramentas de programador).
 * @returns {{ tema: string, ordenacao: string }}
 */
export function lerConfiguracoes() {
  let guardado = null;

  try {
    // getItem devolve null se a chave não existir; JSON.parse lança exceção se o texto não for JSON válido
    guardado = JSON.parse(localStorage.getItem(CHAVE));
  } catch {
    return { ...POR_OMISSAO };
  }

  if (!guardado || typeof guardado !== 'object' || Array.isArray(guardado)) {
    return { ...POR_OMISSAO };
  }

  // Cada opção é validada contra a tabela; um valor inválido é substituído pelo valor por omissão
  const configuracoes = {};
  for (const opcao of Object.keys(POR_OMISSAO)) {
    configuracoes[opcao] = VALORES_ADMITIDOS[opcao].includes(guardado[opcao])
      ? guardado[opcao]
      : POR_OMISSAO[opcao];
  }

  return configuracoes;
}

/**
 * Guarda o objeto de configurações no localStorage (como texto JSON).
 * @param {{ tema: string, ordenacao: string }} configuracoes
 */
export function guardarConfiguracoes(configuracoes) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(configuracoes));
  } catch {
    // Armazenamento indisponível (ex.: bloqueado pelo browser): as configurações valem só até recarregar
  }
}