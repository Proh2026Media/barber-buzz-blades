# TI — preparação da saída protegida de WhatsApp

**11/11/2026 — preparação local, não autoriza execução na produção.** O dono autorizou auditoria e correções locais. Este roteiro só deve ser executado após autorização de janela/implantação. Não precisa reenviar nada ao Claude/Flow.

## Conteúdo e pré-requisitos

Base de produção usada na revisão: `93e3f1ce8b67882dfa314b16e06ab4727fe10ff5`. Ramo local: `auditoria/whatsapp-confiabilidade-2026-11-10`. Sem push. **Não reinstalar nº 101–104.** A nº 105 é `supabase/migrations/20261110230000_whatsapp_saida_protegida.sql` (data no nome indica início da revisão; entrega em 11/11).

Funções alteradas e dependências a instalar como conjunto:

1. `supabase/functions/auth-otp/index.ts` e `auth-otp/login.ts`.
2. `supabase/functions/register-shop/index.ts`.
3. `supabase/functions/whatsapp-dispatch/index.ts`.
4. `_shared/evolution.ts`, `_shared/whatsapp-send.ts`, `_shared/whatsapp-otp.ts`.

`platform-whatsapp` e `whatsapp-channel` usam o módulo compartilhado; precisam receber a mesma versão dele. Nenhum teste `.test.ts` deve ser instalado como endpoint. Implantar pelo procedimento existente para as funções da VPS; não presumir deploy em Supabase Cloud. A interface contém os controles e os novos identificadores de pedido e depende dessa versão do servidor/banco.

Segredo novo: **`WHATSAPP_OTP_HMAC_KEY`**. Gerar pelo menos 32 bytes criptograficamente aleatórios e armazenar como segredo das funções, fora do repositório e fora do banco. Não enviar o valor, saída de ambiente ou captura de tela em relatório. Não reutilizar chave pública. Preservar `PLATFORM_EVOLUTION_INSTANCE` e as credenciais existentes. Sem esse segredo, código por WhatsApp fica indisponível; não existe fallback para hash fraco.

## Ordem da janela, somente depois da autorização

1. Registrar executor, horário/fuso e commit aprovado. Conferir o checkout final, integridade dos arquivos e backup do banco/funções/configuração. Manter Google/e-mail disponíveis.
2. Interromper os três emissores antigos (`auth-otp`, `register-shop` e `whatsapp-dispatch`) e o agendamento do despachante pelo mecanismo operacional já existente. Uma pausa da versão nova **não protege código antigo que envia diretamente**. Não apenas ocultar botões. Esperar encerramento de chamadas em voo e dez minutos para expiração dos códigos anteriores; não repetir mensagens incertas.
3. Aplicar somente a nº 105 em transação, como feito pelo mecanismo de migrations existente. Ela preserva dados, cria trilha/limites/posses e **nasce com pausa global ligada**. Endpoints/cron permanecem interrompidos durante a troca.
4. Instalar o conjunto completo de funções/dependências e o segredo. Restaurar execução das funções e cron somente quando não houver worker antigo. A pausa global bloqueia novas mensagens; a verificação do estado de conexão continua sendo leitura.
5. Após autorização de publicação do frontend, publicar pelo `origin` segundo a regra do projeto. Não enviar só ao `hostinger`. Não executar `autossave.sh` durante a etapa exclusivamente local.
6. Conferir **Administração → WhatsApp → Pausas e acompanhamento**: pausa global ativa, números e vínculos preservados, códigos/avisos indisponíveis para transmitir. Verificar que dono/cliente não acessa configuração, tentativas nem segredos e que os números conectados não foram trocados ou pareados.
7. Se ainda houver restrição informada pela conta WhatsApp, registrar também a pausa do número correspondente e manter a saída bloqueada. Contador encerrado ou `connectionState=open` não comprova liberação da conta.
8. Com liberação confirmada pelo titular, aprovação para teste e destinatário controlado, retomar explicitamente o escopo necessário. A fila é revalidada em pequenos lotes; não reenfileirar resultados desconhecidos. Confirmar pelo identificador a diferença entre licença, aceite e entrega efetivamente observada. Teste de código não autoriza marketing.

## Conferência sem envio

As consultas abaixo são exemplos de leitura para operador autorizado. Não contêm corpo, destinatário ou verificador de código:

```sql
select scope, paused, reason, changed_at, changed_by, version
from public.whatsapp_send_controls order by scope;

select state, count(*), min(started_at), max(started_at)
from public.whatsapp_send_attempts
where started_at > now() - interval '24 hours'
group by state;

select status, count(*), min(created_at)
from public.whatsapp_outbox group by status;

-- Depois da nº 105: trabalho anterior não é retomado sem comprovação.
select count(*) as avisos_antigos_em_processamento,
       count(*) filter (where delivery_started_at is not null) as com_inicio_registrado
from public.whatsapp_outbox
where status = 'sending' and lease_token is null;

select count(*) as pedidos_com_identificador
from public.auth_otp_challenges
where created_at > now() - interval '24 hours' and request_id is not null;
```

Capacidade inicial: lote de cinco, uma transmissão em andamento por instância, cinco transmissões/minuto/instância; pedidos de código com 60 segundos de espera, três por destino/15 minutos e seis confirmações pessoais por conta/hora. Capacidade global de pedidos: 120/hora. `whatsapp_send_policy` permite ao serviço ajustar somente os tetos operacionais dentro de faixas; não mudar para contornar restrição do WhatsApp. Três incertezas/15 minutos exigem revisão manual. Nenhum número reserva assume por restrição.

## Recuperação e reversão

Se houver falha, pausar globalmente pela administração. Se a interface estiver indisponível, operador autorizado pode executar `supabase/rollback/20261110230000_whatsapp_saida_protegida.sql`: é **reversão operacional**, mantendo esquema, desafios e histórico. Uma transmissão em voo ainda pode terminar.

Não derrubar as tabelas de tentativas, não apagar `delivery_started_at` e não recolocar aviso incerto em `pending`. Não restaurar emissores antigos enquanto houver acesso às credenciais de envio: eles ignoram as novas proteções. O frontend pode ser revertido enquanto a saída permanece pausada; e-mail/Google continuam disponíveis. Downgrade de esquema exige outra revisão, pois não recupera a certeza de mensagens já transmitidas.

Não trocar a chave HMAC durante desafios ativos. Rotação exige pausa de pedidos, expiração dos códigos e coordenação entre todas as funções; usuários precisam pedir novo código. Não restaurar um hash antigo como compatibilidade.

## Retorno esperado

Um relatório curto com: **responde a este arquivo**, commit/hashes instalados, início/fim e fuso, migration aplicada ou não, presença do segredo sem seu valor, resultado dos checks, pausa global e por número, estado do cron, testes realizados e sua autorização, limitações e rollback utilizado ou não. Sem códigos, senhas, tokens, QR, corpo de mensagem ou telefone completo.

Não declarar “entregue” somente por resposta HTTP ou identificador da Evolution. Não afirmar que o risco de restrição foi eliminado. A [auditoria](../auditoria-whatsapp-2026-11-11.md) distingue fatos, correções e dependências externas.
