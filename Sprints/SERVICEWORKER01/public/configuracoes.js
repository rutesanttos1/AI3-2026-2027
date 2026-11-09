
// Exporta o objeto CONFIG para que possa ser utilizado
// noutros ficheiros JavaScript através de import.
export const CONFIG = {

    // Define o endereço base da API.
    // Os restantes pedidos utilizam este endereço como referência.
    // Por exemplo: CONFIG.API_URL + '/sessao' corresponde a /v2/sessao.
    API_URL: '/v2',

    // Define o tempo de duração da sessão em segundos.
    // 900 segundos correspondem a 15 minutos.
    TEMPO_SESSAO: 900,

    // Define o nome da base de dados local criada no navegador.
    // Este nome tem de corresponder ao utilizado no ficheiro bd.js.
    NOME_BD: 'sugestoes-bd',

    // Define a versão da estrutura da base de dados IndexedDB.
    // Quando a estrutura da base de dados muda, esta versão pode ser aumentada.
    VERSAO_BD: 1,

    // Define o nome da cache utilizada para guardar
    // os ficheiros da interface da aplicação.
    CACHE_INTERFACE: 'interface-v1',

    // Define o nome da cache utilizada para guardar
    // os dados públicos, como as categorias.
    CACHE_PUBLICO: 'dados-publicos'
};
