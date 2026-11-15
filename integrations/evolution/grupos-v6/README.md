# Evolution 2.3.7-bc.groups.6 — acolhimento após entrada

Incremental local sobre v5 `d020247`, contrato privado `bc-groups-v4`, capacidade `postAdmissionWelcome=true`. O contrato de leitura da interface continua v3 por compatibilidade; não é a versão do protocolo da Evolution. Nenhuma alteração frontend é necessária.

Antes de entrar: nome, foto, controles, dois ou mais administradores e convite. Nenhuma mensagem, descrição ou pin novos. Depois da presença real: administrador diferente do criador envia boas-vindas, escreve a descrição e fixa. Confirmação/login/avisos exigem recibo observado por outra conta da plataforma para a admissão e mensagem atuais, além da primeira prova pelo criador. Cliente nunca administrador.

`admissionId` agora é UUID obrigatório em `bcWelcome`. As rotas de admissão/convite deixam de depender da primeira mensagem. O worker B&C e a nova migration devem acompanhar a imagem; versões misturadas são recusadas. Reentrada não muda JID, ano ou limites e não usa recibo/pin antigo como prova atual. Entrega incerta não é repetida nem transferida para outro número.

**Nenhuma migration nova da Evolution.** As três SQLs do pacote v5 são byte a byte preservadas. Não reaplicar. Os campos adicionais de admissão/recebimento são derivados do diário/evidências existentes, sem gravar campos calculados no JSON.

O patch completo aplica sobre a fonte oficial `cd800f2976e1e5b682fbf86a01ee4d85ae61f370`; `v5-para-v6.patch` aplica exclusivamente sobre `d020247`. Escolher um, nunca aplicar os dois. A fonte completa acompanha o ZIP para dispensar acesso ao checkout temporário.

Reprodução: `npm ci`, Prisma gerado pela bancada com URI fictícia, `npm run test:bc-groups`, `npm run lint:check`, `npm run build:bc-runtime`. Banco: script `testar-evolution-ciclo-banco.py` do B&C, somente PostgreSQL descartável local. Política, HTTP, PN/LID, concorrência, reentrada, recebimento e pin cobertos. Não usar `migrate deploy`/`db push` no servidor.

`publicar-imagem.py` usa o patch completo e a revisão oficial para construir/publicar AMD64 e devolver digest. Requer autorização da janela e custódia de registry pela TI. Não foi executado para publicação. A imagem deve ser fixada pelo digest efetivamente retornado pelo registry, nunca pelo ID local.

Roteiro, precondições e retorno: `docs/pacotes/2026-11-15-ti-acolhimento-apos-entrada-p122.md` no B&C e `LEIA-PRIMEIRO.md` no ZIP. Não sobrepor a v5 que a TI está testando sem coordenar uma janela. Grupos existentes preservados; não apagar mensagens/descrição antigas nem recriar grupos para corrigir a ordem.
