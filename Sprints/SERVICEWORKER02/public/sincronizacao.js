async function executarSincronizacao() {
    const proprietario = await self.BD.lerProprietario();
    const utilizador = proprietario?.utilizador;

    const porEnviar = async () =>
        utilizador ? self.BD.contarPendentes(utilizador) : 0;

    const expiracao = proprietario?.expiracao;
    const limite = typeof expiracao === 'number'
        ? expiracao < 100000000000 ? expiracao * 1000 : expiracao
        : Date.parse(expiracao);

    if (!utilizador || !Number.isFinite(limite) || limite <= Date.now()) {
        return {
            tipo: 'sessao-expirada',
            porEnviar: await porEnviar()
        };
    }

    let enviadas = 0;
    let recusadas = 0;
    let recebidas = 0;

    const erroTemporario = (tipo) =>
        Object.assign(new Error(tipo), { tipo });

    const pedir = async (url, opcoes) => {
        try {
            return await fetch(url, opcoes);
        } catch {
            throw erroTemporario('sem-rede');
        }
    };

    const pendentes = await self.BD.lerPendentesDe(utilizador);

    for (const pendente of pendentes.sort(
        (a, b) => a.idLocal - b.idLocal
    )) {
        await self.BD.registarTentativa(pendente.idLocal);

        const resposta = await pedir('/v2/sugestoes', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'Idempotency-Key': pendente.chave
            },
            body: JSON.stringify({
                titulo: pendente.titulo,
                descricao: pendente.descricao,
                categoria: pendente.categoria
            })
        });

        if (resposta.status === 201) {
            const sugestao = await resposta.json();
            await self.BD.confirmarPendente(
                pendente.idLocal,
                sugestao
            );
            enviadas++;
        } else if ([400, 409].includes(resposta.status)) {
            await self.BD.marcarErro(
                pendente.idLocal,
                `HTTP ${resposta.status}`
            );
            recusadas++;
        } else if (resposta.status === 401) {
            return {
                tipo: 'sessao-expirada',
                porEnviar: await porEnviar()
            };
        } else if (resposta.status >= 500) {
            throw erroTemporario('erro-servidor');
        } else {
            throw erroTemporario('erro-servidor');
        }
    }

    const cursor = await self.BD.lerCursor(utilizador);

    const resposta = await pedir(
        `/v2/sugestoes/alteracoes?desde=${encodeURIComponent(cursor ?? 0)}`,
        { credentials: 'same-origin' }
    );

    if (resposta.status === 401) {
        return {
            tipo: 'sessao-expirada',
            porEnviar: await porEnviar()
        };
    }

    if (!resposta.ok) {
        throw erroTemporario('erro-servidor');
    }

    const dados = await resposta.json();
    const alteracoes = dados.alteracoes ?? [];

    await self.BD.aplicarAlteracoes(
        utilizador,
        alteracoes,
        dados.cursor
    );

    recebidas = alteracoes.length;

    return {
        tipo: 'sincronizado',
        enviadas,
        recusadas,
        recebidas,
        porEnviar: await porEnviar()
    };
}