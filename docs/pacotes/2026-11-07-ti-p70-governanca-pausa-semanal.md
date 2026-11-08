# TI — Instalar a governança da pausa semanal (P-70)

**Preparado em 07/11/2026.** O dono aprovou executar a P-70. Aplicar a **migration nº 99** pelo procedimento abaixo, com backup e ensaio desfeito antes da instalação. A aprovação substitui o adiamento anterior até o primeiro uso real. A homologação em contas reais continua necessária depois de instalar.

## Ordem do pacote

1. Se faltar acesso às contas do aplicativo, seguir [acesso às contas de teste](2026-11-07-ti-acesso-contas-teste.md). Recuperação de senha não altera a sociedade nem exige esta migration.
2. Instalar e conferir a P-70 por este roteiro.
3. Executar [homologação B&C](2026-11-07-ti-barba-cabelo-homologacao-final.md), acrescentando os casos da seção 5 abaixo.

**Não executar P-49 ou Flow por este pacote.** A P-49 permanece sem cobrança, livro financeiro ou mudança no cancelamento de produção. O dono já escolheu Mercado Pago; a conexão por recebedor tem [pacote separado](2026-11-07-ti-mercado-pago-conexao-p49.md). O roteiro P-28 que a TI já recebeu continua separado.

## 1. Entrega e pré-condições

- Migration: `supabase/migrations/20261107220000_governanca_pausa_semanal.sql`.
- Teste novo: `supabase/tests/governanca_pausa_semanal.sql`.
- Regressão da pausa: `supabase/tests/pausa_semanal.sql`.
- Reversão pontual: `supabase/manutencao/2026-11-07_desfazer_governanca_pausa_semanal.sql`.

Usar os arquivos da mesma entrega do `origin`, na raiz do clone ou do pacote extraído. Conferir os hashes fornecidos no `SHA256SUMS` do pacote (`sha256sum -c SHA256SUMS` na raiz extraída; todos devem passar). Não reaplicar as 98 migrations anteriores. A função de extensão da pausa continua chamada pelo cron existente; **não há Edge function para publicar, reinício ou Redeploy**.

A mudança permite solicitar a criação/remoção de pausa da loja inteira. Em sociedade igualitária, não há regra nem bloqueio antes da aprovação dos demais donos; recusar conserva o estado anterior. Maioritário aplica com registro, conforme a governança existente. Gerente que também é dono continua sujeito à aprovação do caminho de gerente; o papel antigo `shop_admin` não contorna a sociedade. Pausas individuais preservam as permissões anteriores.

Antes da migration, pausas existentes continuam visíveis e pausas individuais mantêm suas ações. Criar/remover a pausa da loja inteira fica indisponível até a nº 99; a ausência da RPC não libera gravação direta. Pedidos repetidos, mudança de fuso/sociedade/permissão/regra e respostas atrasadas são tratados no novo contrato.

## 2. Conferir o destino e fazer backup

No terminal da **VPS do B&C**, em período de pouco movimento. Não executar no Flow. Manter as variáveis desta sessão:

```bash
set -euo pipefail
P70_DB=supabase-db-z2dbb7dkyzhc8vjiywq34mhn
docker ps --filter "name=$P70_DB" --format '{{.Names}} {{.Status}}'
docker exec -i "$P70_DB" psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1 <<'SQL'
select to_regclass('public.availability_block_rules') is not null,
       to_regprocedure('public.materialize_block_rule(uuid,integer)') is not null;
select to_regprocedure('public.request_weekly_break_change(uuid,text,jsonb)') is not null;
SQL
```

Esperado: o container indicado saudável; primeira linha `t|t`, segunda `f`. Se a RPC já existir, conferir a entrega instalada e devolver o estado, sem reaplicar por tentativa. Qualquer diferença de destino deve ser resolvida antes de continuar.

```bash
umask 077
P70_BACKUP="/root/backup-barba-p70-$(date -u +%Y%m%d-%H%M%S).dump"
docker exec "$P70_DB" pg_dump -U postgres -d postgres -Fc > "$P70_BACKUP"
test -s "$P70_BACKUP"
docker exec -i "$P70_DB" pg_restore --list < "$P70_BACKUP" > /dev/null
ls -lh "$P70_BACKUP"
sha256sum "$P70_BACKUP"
```

Registrar caminho, tamanho e hash. Não enviar o dump no relatório: contém dados privados. Continuar somente com arquivo não vazio e catálogo legível.

## 3. Ensaiar sem persistir dados

Os testes criam dados fictícios e precisam terminar em **ROLLBACK**. Não executar os arquivos de teste isolados fora de transação.

```bash
P70_LOG=$(mktemp /tmp/barba-p70-ensaio.XXXXXX)
{
  printf 'BEGIN;\n'
  cat supabase/migrations/20261107220000_governanca_pausa_semanal.sql
  printf '\n'
  cat supabase/tests/governanca_pausa_semanal.sql
  printf '\nROLLBACK;\n'
} | docker exec -i "$P70_DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 > "$P70_LOG" 2>&1
grep -c 'PASS:' "$P70_LOG"
tail -1 "$P70_LOG"
if grep -E 'FAIL|ERROR|FATAL' "$P70_LOG"; then exit 1; fi
```

Esperado: **35 PASS**, última linha **ROLLBACK**, sem FAIL/ERROR/FATAL. O ensaio deve terminar sem criar a RPC permanentemente. Se falhar, devolver a mensagem e o ponto da falha; não corrigir a migration diretamente na VPS.

## 4. Aplicar e conferir

```bash
docker exec -i "$P70_DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -1 \
  < supabase/migrations/20261107220000_governanca_pausa_semanal.sql
docker exec -i "$P70_DB" psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1 <<'SQL'
select to_regclass('public.shop_weekly_break_versions') is not null;
select has_function_privilege('authenticated','public.get_weekly_break_governance(uuid)','execute'),
       has_function_privilege('authenticated','public.request_weekly_break_change(uuid,text,jsonb)','execute');
select has_function_privilege('anon','public.request_weekly_break_change(uuid,text,jsonb)','execute'),
       has_function_privilege('authenticated','public.apply_weekly_break_change(uuid,text,jsonb)','execute'),
       has_function_privilege('authenticated','public.apply_shop_change(uuid,text,jsonb)','execute');
select relrowsecurity from pg_class where oid='public.shop_weekly_break_versions'::regclass;
SQL
```

Esperado: `t`, `t|t`, `f|f|f`, `t`. A migration só prepara governança; não cria pausas, não cancela agendamentos e não modifica a participação dos sócios. O `NOTIFY` já recarrega a API. Conferir que as pausas e os bloqueios anteriores continuam visíveis.

Reexecutar `pausa_semanal.sql` dentro de `BEGIN … ROLLBACK`, **sem repetir a migration já aplicada**: resultado esperado **14 PASS**, sem falhas. Recarregar o aplicativo para buscar as capacidades novas.

## 5. Homologar em duas sessões de teste

Usar somente Loja Teste e contas controladas. Registrar os percentuais originais antes de preparar a sociedade 50%/50%, pelo fluxo normal do aplicativo, para restaurá-los ao fim.

1. Como primeiro sócio, Horários → Pausa fixa → Loja inteira: solicitar pausa futura em horário sem atendimento de teste. Deve aparecer **Aguardando aprovação**, sem bloquear a agenda antes da decisão.
2. Recarregar: o pedido continua visível. Outro dono aprova em Equipe e sociedade; só então surgem a regra e os bloqueios. Repetir clique/retorno não deve criar outra pausa igual.
3. Solicitar remoção; recusar com o outro dono. A pausa deve continuar. Solicitar novamente e aprovar: os bloqueios futuros dessa regra desaparecem; outras regras e histórico ficam.
4. Criar pedido e alterar uma condição relevante pela operação normal (por exemplo, o fuso de uma loja de teste sem agendamentos), anotando/restaurando o valor. O pedido antigo não deve ser aplicado; refazer a solicitação com o estado atual.
5. Como Contratado com a capacidade própria liberada, criar e remover pausa individual; não pode solicitar pausa da loja inteira.
6. Conferir no celular com teclado, iPad em ambas as orientações e computador. Anotar os aparelhos não disponíveis, sem substituir por emulação.
7. Remover apenas os registros desta rodada e restaurar o estado anotado. Não executar a limpeza integral do roteiro de 13/10.

## 6. Se for preciso retirar a nº 99

Não restaurar o dump inteiro por cima de dados mais novos. Preferir a reversão pontual já ensaiada:

```bash
docker exec -i "$P70_DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -1 \
  < supabase/manutencao/2026-11-07_desfazer_governanca_pausa_semanal.sql
```

Ela restaura as quatro funções e as três políticas anteriores, cancela somente pedidos semanais ainda pendentes e remove estruturas auxiliares da nº 99. Regras de pausa já aprovadas, seus bloqueios e registros de auditoria são preservados. Após a reversão, pausas existentes continuam visíveis e pausas individuais permanecem utilizáveis; criar/remover pausas da loja inteira fica indisponível no site novo até reinstalar a nº 99. Não executar a reversão na instalação normal; registrar motivo, horário e resultado se necessária.

## 7. Relatório único

Responder à homologação com: commit e hashes conferidos; backup/catálogo; contagem PASS/ROLLBACK; horário da instalação; saídas das quatro conferências; testes reais que passaram/falharam/não foram executados; estado final das lojas; se houve reversão. Sem senhas, chaves, dump, tokens ou dados de clientes. A P-70 só será marcada **aplicada em produção** quando esse retorno comprovar a instalação.
