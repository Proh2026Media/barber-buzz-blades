# Implantação da noite de 13/10/2026 — guia único

Para o agente com acesso à VPS (stack `z2dbb7dkyzhc8vjiywq34mhn`). Aplicação **autorizada pelo dono em 13/10/2026** para a noite (horário de pouco movimento). Este guia junta, numa ordem só, tudo o que estava pendente no servidor:

| Ordem | Migration                                   | Função a publicar                     | Pendência              | Guia de origem (detalhes)                                                                    |
| ----- | ------------------------------------------- | ------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| 1     | `20261003220000_ajustes_finais.sql`         | `google-connect`, `whatsapp-dispatch` | P-21                   | [implantacao-ajustes-finais-2026-10-03.md](implantacao-ajustes-finais-2026-10-03.md)         |
| 2     | `20261003230000_decisoes_whatsapp_fuso.sql` | `register-shop`                       | P-22                   | [implantacao-decisoes-2026-10-03.md](implantacao-decisoes-2026-10-03.md)                     |
| 3     | `20261005120000_tempo_preparo.sql`          | —                                     | P-23                   | [implantacao-preparo-2026-10-05.md](implantacao-preparo-2026-10-05.md)                       |
| 4     | `20261013120000_regras_papel_banco.sql`     | `invite-shop-admin`                   | P-01, P-04, P-07, P-16 | [implantacao-regras-papel-2026-10-13.md](implantacao-regras-papel-2026-10-13.md)             |
| 5     | `20261013150000_antecedencia_minima.sql`    | —                                     | P-54                   | este guia (seção "O que muda")                                                               |

Regras (as mesmas de [implantacao-2026-10-03.md](implantacao-2026-10-03.md)):

- fazer backup antes e conferir o tamanho;
- ensaiar em `BEGIN … ROLLBACK`; **nunca** rodar arquivo de `supabase/tests/` fora de transação;
- migrations antes das funções, uma por vez, cada uma em transação (`-1`);
- reiniciar **só** o container de funções; não usar "Redeploy" do Coolify; não derrubar nem recriar outros containers;
- não imprimir segredos (chaves, senhas, tokens);
- qualquer `ERROR`, `FAIL` ou saída diferente da esperada → **parar e relatar**; não consertar migration no servidor.

O site publicado já funciona com e sem esta parte: cada tela nova só aparece quando o banco tem a coluna ou a função dela.

## O que muda

Itens 1 a 4: ver os guias de origem. Resumo: apagar loja inteira e limpeza de códigos OTP (1); avisos de WhatsApp a clientes só para número confirmado e fuso por loja (2); tempo de preparo entre atendimentos (3); Contratado sai sem levar clientes, bloqueios de colegas sem nome e motivo, donos contados pela equipe e marca de senha temporária no convite (4).

**Item 5 — antecedência mínima para reservar (P-54, decisão do dono de 13/10/2026):**

- coluna nova `barbershop_settings.min_lead_minutes` (0, 15, 30, 60, 120, 240, 720 ou 1440), **padrão 30**. Ao aplicar, **todas as lojas passam a exigir 30 minutos**: um cliente que abrir o app às 14:00 vê horários a partir de 14:30. O dono muda em Ajustes → Agendamento → "Antecedência mínima" (com a mesma aprovação entre sócios das outras regras de agendamento);
- `available_slots_internal` (app, "qualquer profissional", página pública) não oferece horário antes de agora + antecedência;
- o gatilho `appointments_enforce_service_terms` recusa, com `22023` e mensagem amigável, a reserva ou remarcação **feita pelo próprio cliente** dentro da antecedência (tolerância de 5 minutos). O painel da equipe continua livre; cancelar não muda; ocorrências de série recorrente e horário pego pela lista de espera não são barrados;
- `apply_shop_change` grava `min_lead_minutes` em `settings.operational`; mudar a antecedência avisa os aparelhos abertos (sinal de agenda), como a forma dos horários;
- agendamentos já marcados não mudam.

Pré-requisito do item 5: o item 3 (ela recria `available_slots_internal`, o gatilho e `apply_shop_change` a partir das versões da 05120000).

## 0. Quando

Fora do horário de movimento (depois das 23h de Brasília é o indicado). O ensaio e a aplicação acrescentam colunas em `barbershop_settings` e `services` e recriam gatilhos de `appointments`: enquanto a transação está aberta, reservas e ajustes ficam esperando. Em 13/10 o ensaio das três primeiras levou 71 s; conte com 1 a 3 minutos para o ensaio completo.

## 1. Código, containers e backup

```bash
cd <pasta do repositório na VPS>
git pull --ff-only origin main
git log --oneline -1          # o commit desta entrega ou posterior
DB=$(docker ps --format '{{.Names}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep '^supabase-db-')
FN=$(docker ps --format '{{.Names}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep -i functions)
echo "$DB / $FN"
STAMP=$(date +%Y%m%d-%H%M)
docker exec "$DB" pg_dump -U postgres -d postgres -Fc > /root/backup-barba-cabelo-$STAMP.dump
ls -lh /root/backup-barba-cabelo-$STAMP.dump
```

Esperado: os dois nomes preenchidos e backup maior que zero (o de 03/10 tinha 1,1 MB). Sem backup confirmado, não seguir.

## 2. Estado atual (só leitura)

```bash
docker exec -i "$DB" psql -U postgres -d postgres -X -Atc "select
  exists(select 1 from pg_proc where proname = 'purge_auth_otp_challenges') as m1,
  exists(select 1 from pg_proc where proname = 'set_shop_timezone') as m2,
  exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'barbershop_settings' and column_name = 'prep_minutes') as m3,
  exists(select 1 from pg_proc where proname = 'list_shop_blocks') as m4,
  exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'barbershop_settings' and column_name = 'min_lead_minutes') as m5;"
docker exec -i "$DB" psql -U postgres -d postgres -X -Atc "select count(*) from public.profiles where whatsapp_e164 is not null and whatsapp_opt_in_at is not null and whatsapp_verified_at is null;"
```

Esperado na primeira linha: `f|f|f|f|f` (nada aplicado; conferido em 13/10). Se algum for `t`, houve aplicação parcial: **parar e relatar**. A segunda linha é a quantidade de clientes que deixam de receber WhatsApp até confirmar o número (item 2): anotar para o relatório.

## 3. Ensaio de tudo junto (ROLLBACK)

```bash
M=supabase/migrations; T=supabase/tests
reset() { printf "\nreset role;\nselect set_config('request.jwt.claim.sub', '', true);\nselect set_config('request.jwt.claims', '', true);\n"; }
{ echo 'BEGIN;'
  cat $M/20261003220000_ajustes_finais.sql $T/ajustes_finais.sql; reset
  cat $M/20261003230000_decisoes_whatsapp_fuso.sql $T/decisoes_whatsapp_fuso.sql; reset
  cat $M/20261005120000_tempo_preparo.sql $T/tempo_preparo.sql; reset
  cat $T/slot_offer_mode.sql; reset
  cat $M/20261013120000_regras_papel_banco.sql $T/regras_papel_banco.sql; reset
  cat $M/20261013150000_antecedencia_minima.sql $T/antecedencia_minima.sql
  echo 'ROLLBACK;'
} | docker exec -i "$DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 2>&1 | tee /root/ensaio-noite-$STAMP.log | grep -E 'FAIL|ERROR|ROLLBACK' | tail -3
grep -c 'PASS' /root/ensaio-noite-$STAMP.log
```

Esperado:

- **144 PASS**: 25 (`ajustes_finais`) + 43 (`decisoes_whatsapp_fuso`) + 17 (`tempo_preparo`) + 26 (`slot_offer_mode`) + 19 (`regras_papel_banco`) + 14 (`antecedencia_minima`);
- nenhum `FAIL` nem `ERROR`; o último comando é `ROLLBACK`;
- os `NOTICE ... does not exist, skipping` são normais.

O `reset` entre os testes é obrigatório: sem ele, o teste seguinte roda como o usuário simulado pelo anterior.

Já conferido em 13/10/2026: esta mesma cadeia deu **144 PASS** numa cópia da estrutura do banco de produção (auth + public, mesmas 400 funções, 73 tabelas, 54 gatilhos e 76 políticas), num container temporário na VPS, já removido. Na mesma cópia, as 5 migrations seguidas de `booking_rules_single_source`, `correcoes_auditoria`, `guard_own_professional_rows` e da cadeia `booking_reliability` → `slot_waiting` → `optional_occurrences` → `auto_confirmation_modules` deram **131 PASS**. No banco de produção, antes, em transação desfeita: as três primeiras com os testes delas (111 PASS) e a quarta (19 PASS). O ensaio completo no banco de produção ficou para esta noite porque prende as tabelas de agenda (item 0).

## 4. Aplicar (uma por vez, cada uma em transação)

```bash
for f in \
  20261003220000_ajustes_finais.sql \
  20261003230000_decisoes_whatsapp_fuso.sql \
  20261005120000_tempo_preparo.sql \
  20261013120000_regras_papel_banco.sql \
  20261013150000_antecedencia_minima.sql
do
  echo "== $f $(date +%H:%M:%S)"
  docker exec -i "$DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -1 < "supabase/migrations/$f" || { echo "FALHOU em $f — parar"; break; }
done
docker exec -i "$DB" psql -U postgres -d postgres -X -c "NOTIFY pgrst, 'reload schema';"
```

Se uma falhar, as anteriores ficam aplicadas e a que falhou é desfeita inteira (`-1`). Parar e relatar; não pular para a próxima. Anotar o horário de cada uma (aparece na linha `==`).

## 5. Conferir o banco

```bash
Q() { docker exec -i "$DB" psql -U postgres -d postgres -X -Atc "$1"; }
# estado: agora tudo t
Q "select exists(select 1 from pg_proc where proname='purge_auth_otp_challenges'), exists(select 1 from pg_proc where proname='set_shop_timezone'), exists(select 1 from information_schema.columns where table_name='barbershop_settings' and column_name='prep_minutes'), exists(select 1 from pg_proc where proname='list_shop_blocks'), exists(select 1 from information_schema.columns where table_name='barbershop_settings' and column_name='min_lead_minutes');"
# 1 — ajustes finais
Q "select has_function_privilege('anon','public.purge_auth_otp_challenges()','execute'), has_function_privilege('authenticated','public.purge_auth_otp_challenges()','execute'), has_function_privilege('authenticated','public.enqueue_whatsapp_message(uuid,text,text,text,text,jsonb,timestamptz)','execute');"
# 2 — WhatsApp confirmado e fuso
Q "select has_function_privilege('anon','public.set_shop_timezone(uuid, text)','execute'), has_function_privilege('authenticated','public.set_shop_timezone(uuid, text)','execute'), (select count(*) from pg_trigger where tgname like 'barbershops_timezone_guard%');"
# 3 — tempo de preparo
Q "select (select count(*) from public.barbershop_settings where prep_minutes <> 0), (select count(*) from public.services where prep_minutes is not null), has_function_privilege('anon','public.service_prep_minutes(uuid, uuid)','execute'), has_function_privilege('authenticated','public.available_slots_internal(uuid, uuid, date)','execute');"
# 4 — regras de papel
Q "select has_function_privilege('anon','public.list_shop_blocks(uuid, timestamptz)','execute'), has_function_privilege('authenticated','public.list_shop_blocks(uuid, timestamptz)','execute'), has_function_privilege('anon','public.list_platform_shop_owners()','execute'), (select count(*) from pg_policies where tablename='availability_blocks');"
# 5 — antecedência mínima
Q "select (select count(*) from public.barbershop_settings where min_lead_minutes <> 30), has_function_privilege('anon','public.shop_min_lead_minutes(uuid)','execute'), has_function_privilege('authenticated','public.shop_min_lead_minutes(uuid)','execute'), has_function_privilege('authenticated','public.available_slots_internal(uuid, uuid, date)','execute'), has_function_privilege('authenticated','public.get_available_slots(uuid, uuid, date, uuid)','execute');"
```

Esperado, linha a linha:

| Conferência      | Saída esperada  |
| ---------------- | --------------- |
| estado           | `t\|t\|t\|t\|t` |
| 1 — ajustes      | `f\|f\|f`       |
| 2 — WhatsApp/fuso | `f\|t\|2`      |
| 3 — preparo      | `0\|0\|f\|f`    |
| 4 — papéis       | `f\|t\|f\|3`    |
| 5 — antecedência | `0\|f\|f\|f\|t` |

Todas as migrations podem ser reaplicadas sem erro (conferido; a 5 também na cópia de 13/10).

## 6. Publicar as funções

`_shared` não mudou desde a publicação de 03/10 (último commit `d127143`); não precisa ir.

```bash
VOL=$(docker inspect "$FN" --format '{{range .Mounts}}{{if eq .Destination "/home/deno/functions"}}{{.Source}}{{end}}{{end}}')
echo "$VOL"
cp -a "$VOL" "/root/functions-backup-$STAMP"
for fn in google-connect whatsapp-dispatch register-shop invite-shop-admin; do
  rsync -a --delete --exclude '._*' "supabase/functions/$fn/" "$VOL/$fn/"
done
docker restart "$FN"
sleep 5
docker logs --tail 80 "$FN"
API=https://supabase-barbearia.proh.media
for fn in google-connect whatsapp-dispatch register-shop invite-shop-admin; do
  printf '%s ' "$fn"; curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS "$API/functions/v1/$fn" \
    -H 'Origin: https://beauty.contheiner.digital' -H 'Access-Control-Request-Method: POST'
done
```

Esperado: `VOL` preenchido, logs sem erro de inicialização, `200` ou `204` nas quatro (a `whatsapp-dispatch` pode responder o mesmo código de antes se não tiver CORS: comparar com o backup). Erro de compilação numa função → `cp -a /root/functions-backup-$STAMP/<fn> "$VOL/"`, reiniciar de novo e relatar.

Não criar convite de teste em loja de cliente, não fazer login real, não enviar código de WhatsApp.

## 7. Depois de aplicar

```bash
# o cron do host continua chamando whatsapp-dispatch a cada minuto; sem erro novo:
sleep 120; docker logs --since 3m "$FN" 2>&1 | grep -i -E 'error|whatsapp-dispatch' | tail -10
# avisos pendentes para número não confirmado marcados pela migration 2 (só a quantidade):
Q "select count(*) from public.whatsapp_outbox where status = 'failed' and error like '%(20261003230000)';"
# realtime de pé (P-25: reinício automático e limite já gravados no Coolify em 13/10):
docker ps --format '{{.Names}} {{.Status}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep -i realtime
```

Também relatar, **sem desligar**, se o Auth tem o servidor OAuth 2.1 apontando para `/.lovable/oauth/consent` (item 5 de [implantacao-decisoes-2026-10-03.md](implantacao-decisoes-2026-10-03.md)).

Conferências na tela, para o dono (com o login dele), no dia seguinte:

- Ajustes → Agendamento: aparecem "Antecedência mínima" (marcada em 30 min), o fuso da loja (deixa de dizer "disponível em breve") e o tempo de preparo;
- o app do cliente não mostra horário que começa em menos de 30 minutos;
- Equipe: um Parceiro não vê nome nem motivo dos bloqueios dos colegas (aba Rede do navegador, P-04);
- Plataforma: "Administradores" igual na lista e na ficha de cada loja (P-07).

## 8. Como desfazer (só se algo quebrar em produção)

- **Funções:** `rsync -a /root/functions-backup-$STAMP/ "$VOL/"` e `docker restart "$FN"`.
- **Antecedência (sem mexer no banco inteiro):** se o problema for só a regra de 30 minutos, o dono de cada loja escolhe "Sem mínimo" em Ajustes → Agendamento. Pelo banco, com autorização do dono: `update public.barbershop_settings set min_lead_minutes = 0;`.
- **Banco:** não há "down" das migrations. Em caso grave, restaurar o dump do passo 1 com `pg_restore` — **somente com autorização explícita do dono**, porque apaga tudo o que foi gravado depois do backup.

## 9. Relatório

Incluir, sem segredos:

1. commit usado; nome e tamanho do backup;
2. saída do passo 2 (`f|f|f|f|f`) e a quantidade de clientes com WhatsApp não confirmado;
3. contagem de PASS do ensaio (esperado 144) e qualquer linha `FAIL`/`ERROR`;
4. horário de aplicação de cada migration;
5. as seis saídas do passo 5;
6. pasta do backup das funções, status do `OPTIONS` das quatro e trecho do log;
7. passo 7: erros novos no log, quantidade de avisos marcados como `failed`, estado do realtime e o item do OAuth 2.1.

Sem push no GitHub a partir da VPS: devolver o relatório ao dono, para registrar no `docs/CONTINUIDADE.md` e em `docs/guia/pendencias.md` por outra máquina (P-21, P-22, P-23, P-01, P-04, P-07, P-16 e P-54 passam a **feito**). Depois disso, os testes reais com a loja de teste podem começar: [testes-reais-loja-teste.md](testes-reais-loja-teste.md).
