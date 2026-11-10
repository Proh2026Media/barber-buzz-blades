# TI — avisos e canais fixos do Barba & Cabelo (P-116)

Data: 10/11/2026, Brasília. **Código implementado e testado localmente; instalação em produção pendente.** Este pacote é exclusivo do B&C. Não envolve Flow, Mercado Pago, compras de números ou troca de credenciais.

## Decisão aprovada

- Avisos de confirmação, cancelamento, remarcação e lembrete de agendamento têm prioridade e não consomem a cota promocional.
- Até **duas comunicações por cliente em sete dias corridos**, somando lojas e os canais alternativos usados pelo B&C. Um convite de retorno entra nessa cota e só pode ocorrer uma vez nesse período. Não são duas por barbeiro, número ou dia da semana.
- Consentimento de marketing existente em Conta → Privacidade é necessário. WhatsApp também exige telefone confirmado e preferência de avisos ativa; cliente do balcão mantém o consentimento de avisos já existente. Promoções não são habilitadas implicitamente para o balcão.
- Retorno automático: opcional por loja, **desligado na instalação**. Exige autorização de marketing e análise do histórico, pelo menos três dias de atendimentos concluídos nos últimos 365 dias. Usa a média dos intervalos, limitada a 7–180 dias, e não convida quem tem próximo agendamento. Reconfere essas preferências antes do envio.
- Conectar/desconectar os números fornecidos fica restrito à administração, tanto na tela quanto no endpoint e nas alterações diretas da identidade do canal. A loja mantém os ajustes dos avisos.
- Canal principal fixo por barbearia. Reserva dedicada só quando selecionada expressamente pela administração após constatar falha técnica. Sem alternância por mensagem, compra automática de números ou substituição automática de conta banida.
- O número geral da plataforma/OTP permanece separado. Não atribuir esse número como reserva de loja.

**Limites importantes:** quantidade de mensagens e reserva não garantem proteção contra banimento de uma integração não oficial. Evolution/Baileys continua dependendo de conta WhatsApp previamente ativada; o número Salvy apenas presente no painel não é ativado por esta entrega. A ideia anterior de um número para cada dois barbeiros não foi automatizada: esta entrega implementa a direção aprovada de principal fixo por loja + reserva. Números por grupos de profissionais exigem definição e implementação própria antes de uso.

## Arquivos da entrega

1. Migration nº **101**: `supabase/migrations/20261110120000_whatsapp_comunicacao_controlada.sql`.
2. Função `supabase/functions/whatsapp-dispatch/index.ts`.
3. Função `supabase/functions/whatsapp-channel/index.ts`.
4. Reversão SQL: `supabase/rollback/20261110120000_whatsapp_comunicacao_controlada.sql`.
5. Testes: `supabase/tests/whatsapp_comunicacao_controlada.sql`.

O ZIP acompanha esses arquivos e um manifesto SHA-256. As funções compartilhadas `evolution.ts` e `whatsapp-pairing.ts` devem ser as já conferidas da P-115; não sobrescrever com um pacote antigo. Sem variável nova, sem novo cron e sem alterar a Evolution para instalar esta entrega.

## Instalação na VPS — apenas B&C

A TI executa a instalação; o agente de código **não aplicou migration em produção**, conforme a regra do projeto em `docs/passagem-chatgpt-2026-10-24.md` (“Nenhuma ferramenta de código aplica migration em produção”). O pedido do dono autoriza implementar o recurso; os números reais e sua ativação ainda precisam ser preparados pelo operador.

1. Conferir ramo/commit publicado, manifesto e estado atual. Containers do B&C:
   - banco: `supabase-db-z2dbb7dkyzhc8vjiywq34mhn`;
   - funções: `supabase-edge-functions-z2dbb7dkyzhc8vjiywq34mhn`;
   - volume: `/data/coolify/services/z2dbb7dkyzhc8vjiywq34mhn/volumes/functions`.
2. Fazer `pg_dump` completo do banco e cópia dos dois arquivos de funções, em pasta privada na VPS (modo 700). Guardar horários/hashes; não colocar credenciais ou dados pessoais no relatório. Conferir espaço antes.
3. Conferir pré-requisitos nº 1–98 e integridade da fila. A nº 101 não depende das nº 99/P-70 ou 100/P-49; não instalar nem reaplicar essas duas por causa deste pacote. Registrar quantos avisos estão `sending` e se há envios em curso. **Não resetar essas linhas para `pending`**: podem já ter sido entregues.
4. Ensaiar a migration com `BEGIN; ... ROLLBACK;` sem executar despachos. O teste completo incluído cria dados fictícios e limpa tabelas dentro da transação: **rodá-lo somente na bancada isolada**, nunca contra a produção. A regressão local já foi feita com a cadeia de migrations do repositório.
5. Publicar primeiro os dois arquivos de funções, preservando dono/modo e tendo cópia anterior. Reiniciar **somente o container das funções**; nunca Restart/Redeploy do serviço Coolify, Evolution, proxy ou VPS. O novo dispatcher exige a service role que o cron já usa e recusa consumir a fila enquanto a função SQL da P-116 não existir. Registrar essa breve suspensão dos envios WhatsApp. Confirmar que a autenticação do cron atende ao contrato, sem imprimir a chave.
6. Aplicar somente a nº 101 em **uma transação**, com `ON_ERROR_STOP=1`. Em erro, ROLLBACK e restaurar as funções anteriores. Não deixar a versão antiga do dispatcher funcionando sobre a política nova.
7. Conferir saúde, hashes e ausência de erro de carregamento. Conferir, por leitura, as colunas `delivery_mode`, `backup_instance_name`, `return_notice_enabled`, a tabela `client_communication_budget` e as funções `prepare_whatsapp_delivery`, `defer_whatsapp_delivery` e `process_whatsapp_return_notices`. Chamar o dispatcher envia mensagens pendentes: não usar essa chamada como teste de saúde.
8. Na administração, abrir **Barbearias → ficha → configurações → WhatsApp**. Sem migration, a tela orienta solicitar instalação; com ela e o canal principal existente, permite configurar a reserva e o retorno. Instalar não liga retorno automático para nenhuma loja.

## Preparação dos números e teste dirigido

- Relatar quais lojas têm principal efetivamente conectado e quais reservas dedicadas já existem. Não é necessário enviar telefone completo, SMS, QR ou token no relatório.
- Reserva é identificada pelo nome da instância na Evolution, criada e validada pelo operador. O banco impede reutilizá-la como principal ou reserva de outra loja. A tela não cria número nem verifica propriedade de uma instância externa; essa conferência é responsabilidade da TI antes de associá-la.
- Só testar envio com destinatário de homologação que autorizou e confirmar o número de origem. Nenhum disparo a clientes reais faz parte da conferência deste pacote.
- Confirmar: agendamento gera um aviso; repetição do mesmo evento não duplica; nova remarcação gera novo aviso; cancelamento ou remarcação torna aviso antigo inadequado; retirada de consentimento impede promoção pendente; terceiro comunicado é recusado.
- Testar a reserva numa loja de homologação: principal indisponível por motivo técnico conhecido, reserva conectada, selecionar a reserva e marcar a confirmação técnica. O canal fica fixo até a administração mudar. A tela da loja identifica a reserva e não tenta reconectar/desconectar o principal nessa condição.
- Usar **Pausado para revisão** quando houver bloqueio, suspeita ou motivo desconhecido. Não configurar rodízio ou recuperação automática após banimento.
- O despacho consulta conexão antes de enviar: se não estiver aberta, adia cinco minutos, no máximo cinco tentativas. Depois de chamar `sendText`, timeout, resposta sem ID ou falha no registro **não geram novo envio automático**, nem pelo principal nem pela reserva. Conferir o provedor antes de qualquer decisão manual.
- As reservas de cota duram 24 horas enquanto não tentadas. A preparação de uma tentativa, inclusive quando a pré-conferência encontra o canal indisponível, e resultados incertos contam pelos sete dias seguintes; isso pode reservar cota sem entrega confirmada, de propósito para não duplicar. Não prometer entrega exata nem “zero duplicação” entre sistemas externos.
- E-mails transacionais continuam no caminho existente. Promoções usam um único canal por evento; e-mail é alternativa quando o WhatsApp não entrou na fila. Falha posterior do WhatsApp não cria uma segunda promoção por e-mail.

## Reversão

Em bancada, conferir o SQL de reversão junto às versões anteriores dos dois arquivos. Em produção: impedir execução do worker durante a reversão, restaurar as duas funções anteriores, executar o SQL de reversão em transação e reiniciar só o container das funções. Preferir as definições efetivamente salvas da VPS se houver divergência com a cadeia nº 1–100 usada na reversão fornecida. Não apagar fila, orçamento ou colunas: são histórico e evidência. Não reaplicar a nº 101 cegamente depois de reverter; preparar migration de avanço. A reversão reintroduz o comportamento antigo de envio e não mantém os controles novos.

## Verificações realizadas pelo Codex

- `scripts/verificar.sh`: tipos, **467 testes**, eslint, prettier e montagem aprovados.
- PostgreSQL local Supabase 15.8: cadeia nº 1–100 + migration nº 101 em transações de teste; **39 cenários específicos** dentro de **1.272 verificações da regressão completa**, todas aprovadas. Nenhum teste SQL foi executado em produção.
- Reversão ensaiada com **49 verificações** das regras antigas de destinatário/fuso e recuperação de e-mails; ROLLBACK concluído.
- Chromium com rede externa bloqueada e dependências fictícias: 320/390/834/1280 px, dois temas e três cantos; salvamento, preservação em erro, backend antigo, confirmação da reserva, conexão restrita ao admin e identificação da reserva na loja. Sem erros de página.
- Nenhum envio real, compra, conexão de número ou teste em aparelho físico. A instalação não substitui nem desconecta números já existentes: a TI precisa conferir a titularidade e os canais dedicados antes de apresentá-los como fornecidos pelo B&C.

## Relatório de retorno

Responder a este arquivo com: commit/hashes, horário Brasília, backup, ensaio/aplicação/saúde, autenticação do cron conferida (sem chave), estado dos principais/reservas, teste com destinatário de homologação, quantidade de resultados incertos a revisar e pendências. Separar instalação concluída de números ainda não ativados. Não anunciar retorno automático ativo sem a configuração explícita da loja.
