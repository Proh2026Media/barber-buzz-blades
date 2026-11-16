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
