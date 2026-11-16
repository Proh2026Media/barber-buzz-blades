# P-122 — correção do cancelamento da revisão de telefone

## Diagnóstico comprovado

Erro enviado pelo titular: operação abort, ACCESS_UNAVAILABLE/503 às 17:43:20 UTC de 16/11/2026 (14:43:20 BRT). O cancelamento marcou a revisão como aborted na Evolution, mas a gravação seguinte da lápide falhou: o texto `phone_revision_aborted` tem 22 caracteres e `BcGroupOperation.state` é varchar(16). Esse limite foi confirmado no banco real por information_schema. O controlador transforma a exceção de persistência em 503, e a Edge conserva o erro genérico. Os testes anteriores usavam armazenamento fictício sem essa restrição e não detectaram a falha.

## Recuperação já realizada

Confirmado abort_requested=true no B&C e phase=aborted na Evolution. A prova real foi ensaiada em uma transação com rollback e depois gravada pelo RPC protegido, com claim/lease e a mesma identidade. A revisão antiga agora está aborted no B&C também. Não houve aprovação de entrada, vínculo, novo grupo, convite, código, mensagem ou renovação de consentimento. Nenhum telefone foi reescrito por SQL. A rotina nova foi parada brevemente para impedir concorrência e religada; piloto permanece restrito à Loja Teste/cliente já autorizado.

## Correção pronta somente localmente

Evolution `2.3.7-bc.groups.7-entry.4`: lápide usa `phone_rev_abort` (15 caracteres), compatível com o campo existente. Leitura também aceita o marcador legado. Sem migration ou alteração da estrutura do banco. Novo teste exige limite de 16 no armazenamento e cobre cancelamento antes/depois de prepare, repetição, resposta perdida e replay tardio; mantém identidade e zero envios. Compilação completa aprovada.

Frontend: “Retomar com este número” também aparece quando o cancelamento já foi confirmado. Novo clique relê o estado, exige mesmo grupo/telefone/composição/versão e inicia a intenção; não cancela novamente, não renova no polling e não solicita código automaticamente. Alteração de identidade ou grupo continua bloqueando.

719 testes B&C, tipos, lint (zero erros, quatro avisos existentes) e montagem aprovados; 32 regressões Evolution; 75 composições visuais em cinco larguras/três modos de canto, rede externa bloqueada, sem mutações ou OTP no acompanhamento.

## Próxima implantação, ainda não autorizada

A revisão automática recusou publicar a nova imagem: a autorização anterior foi considerada específica ao artefato anterior. Nenhuma publicação/recriação desta correção foi feita. O frontend novo também não foi publicado para evitar antecipar parte da entrega.

Autorização necessária: publicar e fixar a imagem4 pelo digest verificado, pausar o piloto pela sessão real do admin, recriar somente a Evolution (breve indisponibilidade), confirmar recuperação das mesmas instâncias, publicar o frontend e restaurar o teste somente Loja Teste/Alyson Gmail. Nenhuma SQL/migration ou fonte Edge nova, nenhum timer antigo/distribuição ligado, nenhuma nova conta/grupo ou envio pelo Codex. Guardas e segredo existentes preservados, sem Redeploy do Coolify.

Depois da instalação, titular atualiza a conta Gmail e toca uma vez em “Retomar com este número”. Recebimento do OTP e login reais ainda não homologados. Não pedir novo cadastro ou reenvio do pedido de entrada.

## Implantação autorizada em andamento

Titular autorizou explicitamente imagem7-entry.4, frontend e pausa de manutenção, somente Loja Teste. Pausa pela sessão real do admin. Imagem4 publicada e instalada pelo índice OCI `sha256:2468fc5ea6bedbc7fcd8dbb56c7ae6a71e16735942075230c765a68c211aca30`; filho AMD64 `sha256:5046086c347b072fa4052d8ee90f1419100ac5318f1bd65b15ae093d3aad3ea6`, config `sha256:bab6ab42b0183ee7f5232e3ec5eb5746902db727bd942b17dbbe24f81f21e127`. Somente container Evolution recriado. Prontidão medida em26,081s, oito instâncias e quatro abertas preservadas; env/mounts idênticos. Backups privados da imagem/configuração anterior em `/root/bc-p122-entrada-20261116-66b6cbc/compose-entry3.yml` e `evolution-inspect-entry4-antes.json`. Nenhum SQL ou restart Edge/banco/Auth/proxy.

Cancelamento real reentregue idempotentemente: HTTP200, phase=aborted; uma lápide compatível `phone_rev_abort` persistida no banco Evolution. Mesmo grupo/números, sem nova intenção, vínculo, aprovação, mensagem ou OTP. Elegibilidade somente leitura: mesmo grupo/composição, cliente não confirmado, grupo não encerrado, nenhuma tentativa na última hora; outras lojas/clientes recusados pelo isolamento.

Frontend fonte `aecc5ed82d71334e1e551c0c952555b99026c412` enviado à origem. Archive sem .env/credenciais SHA-256 `d0e5a0cc010b42efc7eac507aebb9fcd6d62d7bf61b2e8670bcf60d9c1444f51`; build Hostinger `01a1e587-307a-72ae-b145-9809ddd46966` em fila. Auto-deploy Git preservado. Manter pausa até publicação/conferência. Não reinstalar a imagem já instalada nem renovar a tentativa por SQL.

A tentativa archive `01a1e587-307a-72ae-b145-9809ddd46966` falhou na Hostinger antes de disponibilizar logs/fontes, sem causa de código comprovada. Não atribuir essa falha ao arquivo de entrada ou repetir correções no projeto sem evidência. Espelho confirmado em aecc5ed; nova publicação Git `01a1e58c-6608-729b-8291-c5b6be1058cf` iniciou e confirmou checkout do commit correto. Piloto continua pausado durante a montagem.

## Publicação e liberação concluídas

Build Git `01a1e58c-6608-729b-8291-c5b6be1058cf` concluído às15:14:13 BRT. Fonte aecc5ed confirmada no checkout e no origin/main/espelho. Às15:14:28 BRT, HTML e módulo público `ArenaApp-BYYr1Zil.js` HTTP200: duas condições específicas de recuperação após aborted e botão de retomada presentes; SHA-256 do módulo `87cc305de434a9ce4c30a868c1c39a657ba83aab7b621387fdd27da6787e0ffe`. Auto-deploy Git preservado.

Conferência automática dos dois números na sessão real do admin passou; liberação confirmada para Loja Teste/Alyson Viana. Guardas do piloto continuam vigentes. Cancelamento real HTTP200 e lápide de15caracteres da mesma revisão comprovados; nenhum pedido de entrada, grupo ou código criados pelo Codex. A revisão vencida permanece encerrada até novo clique explícito do cliente.

Instalação concluída; não há pacote para a TI instalar ou motivo para repetir SQL/Edge. Próximo passo: na sessão Gmail da Loja Teste, atualizar e tocar “Retomar com este número”; pergunta enviada ao titular para acompanhar o teste real. A interface e a retomada no mesmo grupo foram verificadas localmente, e a elegibilidade real foi conferida sem iniciar intenção em nome do cliente. Não afirmar OTP/login reais homologados sem retorno do titular e evidência de conclusão.

Corte final15:16:08 BRT: pausa=false, ciclos/assistência/background=true, política29, isolamento=true; par autorizado aceito, outra loja/cliente recusados, distribuição=false. Novo timer active/enabled; três antigos inactive/disabled. Liberação persistiu após reload na sessão admin real.
