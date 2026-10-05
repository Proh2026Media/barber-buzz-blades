# Implantação no servidor — tempo de preparo entre atendimentos (05/10/2026)

Para o agente com acesso à VPS (stack `z2dbb7dkyzhc8vjiywq34mhn`). Valem as mesmas regras de [implantacao-2026-10-03.md](implantacao-2026-10-03.md):

- fazer backup antes;
- ensaiar em `BEGIN … ROLLBACK`;
- **nunca** rodar arquivo de `supabase/tests/` fora de transação;
- não usar "Redeploy" do Coolify;
- não imprimir segredos.

Esta entrega tem **1 migration** (`20261005120000_tempo_preparo.sql`) e **nenhuma função**. Ela vem **depois** de `20261003220000_ajustes_finais.sql` e `20261003230000_decisoes_whatsapp_fuso.sql`, porque recria `apply_shop_change` a partir da versão da 230000, com o ramo `shop.timezone`. Se essas duas ainda não foram aplicadas, siga antes os guias [implantacao-ajustes-finais-2026-10-03.md](implantacao-ajustes-finais-2026-10-03.md) e [implantacao-decisoes-2026-10-03.md](implantacao-decisoes-2026-10-03.md).

O site publicado já tem a tela nova (Ajustes → Agendamento e o formulário de Serviços), mas **salvar o preparo só funciona depois desta migration**. Antes dela, o banco não tem a coluna `prep_minutes` e a gravação dá erro. Os horários oferecidos não mudam até alguém escolher um preparo, porque o padrão é 0.

## O que muda

- **Colunas novas:**
  - `barbershop_settings.prep_minutes`: aceita 0, 5, 10, 15, 20 ou 30; o padrão é 0.
  - `services.prep_minutes`: aceita os mesmos valores, ou nulo para usar o da loja.
- **Horários livres** (`available_slots_internal`, usada pelo app, por "qualquer profissional" e pela página pública):
  - o atendimento novo precisa deixar o próprio preparo livre antes do próximo;
  - cada atendimento existente ocupa até o fim dele mais o preparo do seu serviço;
  - bloqueios, esperas e o fechamento não exigem preparo.
- **Modo "no tamanho do serviço":** o passo vira duração + preparo.
- **Reserva feita pelo cliente** (`appointments_enforce_service_terms`): um horário que invade o preparo de um atendimento vizinho é recusado com `23P01`, a mesma resposta de horário ocupado. O painel continua livre para encaixar.
- **Aprovação entre sócios:** `apply_shop_change` grava `prep_minutes` em `settings.operational`, `service.create` e `service.update`.

## 1. Código e backup

```bash
git pull --ff-only origin main
git log --oneline -1          # o commit desta entrega ou posterior
DB=$(docker ps --format '{{.Names}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep '^supabase-db-')
STAMP=$(date +%Y%m%d-%H%M)
docker exec "$DB" pg_dump -U postgres -d postgres -Fc > /root/backup-barba-cabelo-$STAMP.dump
ls -lh /root/backup-barba-cabelo-$STAMP.dump
docker exec -i "$DB" psql -U postgres -d postgres -X -Atc "select exists(select 1 from pg_proc where proname='purge_auth_otp_challenges') as tem_220000, exists(select 1 from pg_proc where proname='set_shop_timezone') as tem_230000;"
```

Esperado: `t|t`. Se aparecer algum `f`, aplique antes os guias citados acima.

## 2. Ensaio (ROLLBACK)

```bash
{ echo 'BEGIN;'
  cat supabase/migrations/20261005120000_tempo_preparo.sql supabase/tests/tempo_preparo.sql supabase/tests/slot_offer_mode.sql
  echo 'ROLLBACK;'
} | docker exec -i "$DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 2>&1 | tee /root/ensaio-preparo-$STAMP.log | grep -E 'FAIL|ERROR|ROLLBACK' | tail -3
grep -c 'PASS' /root/ensaio-preparo-$STAMP.log
```

O resultado esperado é:

- **43 PASS** no total: 17 de `tempo_preparo` e 26 de `slot_offer_mode`, que continua igual;
- nenhum `FAIL` nem `ERROR`;
- o último comando é `ROLLBACK`.

Os `NOTICE ... does not exist, skipping` são normais. Na cópia local do banco, os 31 arquivos de `supabase/tests/` passaram com esta migration. Se aparecer qualquer outra diferença, pare e relate.

## 3. Aplicar

```bash
docker exec -i "$DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -1 < supabase/migrations/20261005120000_tempo_preparo.sql \
  && docker exec -i "$DB" psql -U postgres -d postgres -X -c "NOTIFY pgrst, 'reload schema';"
docker exec -i "$DB" psql -U postgres -d postgres -X -Atc "select (select count(*) from public.barbershop_settings where prep_minutes <> 0), (select count(*) from public.services where prep_minutes is not null), has_function_privilege('anon','public.service_prep_minutes(uuid, uuid)','execute'), has_function_privilege('authenticated','public.available_slots_internal(uuid, uuid, date)','execute');"
```

Esperado: `0|0|f|f`. Nenhuma loja muda até escolher um preparo, e as funções internas continuam fechadas. A migration pode ser reaplicada sem erro.

## 4. Relatório

Incluir:

- o nome e o tamanho do backup;
- a saída `t|t` do passo 1;
- a contagem de PASS do ensaio;
- o horário em que a migration foi aplicada;
- a saída `0|0|f|f` do passo 3.

Não fazer push no GitHub. Devolver o relatório ao dono, para ele registrar no `docs/CONTINUIDADE.md` por outra máquina.
