# Implantação no servidor — regras de papel no banco e senha do convite (13/10/2026)

Para o agente com acesso à VPS (stack `z2dbb7dkyzhc8vjiywq34mhn`). Valem as mesmas regras de [implantacao-2026-10-03.md](implantacao-2026-10-03.md):

- fazer backup antes;
- ensaiar em `BEGIN … ROLLBACK`;
- **nunca** rodar arquivo de `supabase/tests/` fora de transação;
- não usar "Redeploy" do Coolify;
- não imprimir segredos;
- reiniciar só o container de funções.

Esta entrega tem **1 migration** (`20261013120000_regras_papel_banco.sql`) e **1 função** (`invite-shop-admin`). A migration não depende das três pendentes de 03/10 e 05/10 (P-21, P-22 e P-23): pode ir antes ou depois delas. Se for aplicar tudo no mesmo dia, a ordem sugerida é 220000 → 230000 → 05120000 → esta.

O site publicado já funciona com e sem esta parte: sem a migration, o painel lê os bloqueios como antes e a plataforma conta administradores pelo papel antigo.

## O que muda

- **P-01 — Contratado sai sem levar clientes, também no banco.** `request_shop_departure` recusa `p_mode = 'take'` de membro `employee` com `42501`. `forfeit` continua aceito; dono e Parceiro continuam como antes.
- **P-04 — Bloqueios de colegas sem nome e sem motivo.** A política de leitura de `availability_blocks` passa a liberar a linha inteira só para quem tem a visão geral da agenda (`can_view_full_shop`); os demais profissionais leem direto só os próprios bloqueios e os da loja inteira. A RPC nova `list_shop_blocks(p_shop_id, p_from)` entrega ao painel os bloqueios dos colegas só com o intervalo (motivo e nome nulos).
- **P-07 — Administradores da plataforma pela equipe.** RPC nova `list_platform_shop_owners()`, só para o admin da plataforma: donos e sócios ativos de cada loja.
- **P-16 — Senha própria no primeiro acesso.** A função `invite-shop-admin` grava `must_change_password: true` nos dados da conta que ela cria com senha temporária. O app pede uma senha nova antes de qualquer outra coisa. Contas que já existem não são marcadas.

## 1. Código e backup

```bash
git pull --ff-only origin main
git log --oneline -1          # o commit desta entrega ou posterior
DB=$(docker ps --format '{{.Names}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep '^supabase-db-')
FN=$(docker ps --format '{{.Names}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep -E 'functions|edge')
STAMP=$(date +%Y%m%d-%H%M)
docker exec "$DB" pg_dump -U postgres -d postgres -Fc > /root/backup-barba-cabelo-$STAMP.dump
ls -lh /root/backup-barba-cabelo-$STAMP.dump
docker exec -i "$DB" psql -U postgres -d postgres -X -Atc "select exists(select 1 from pg_proc where proname='list_shop_blocks'), exists(select 1 from pg_proc where proname='list_platform_shop_owners');"
```

Esperado: backup maior que zero e `f|f` (ainda não aplicada).

## 2. Ensaio (ROLLBACK)

```bash
{ echo 'BEGIN;'
  cat supabase/migrations/20261013120000_regras_papel_banco.sql supabase/tests/regras_papel_banco.sql
  echo 'ROLLBACK;'
} | docker exec -i "$DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 2>&1 | tee /root/ensaio-regras-papel-$STAMP.log | grep -E 'FAIL|ERROR|ROLLBACK' | tail -3
grep -c 'PASS' /root/ensaio-regras-papel-$STAMP.log
```

Esperado: **19 PASS**, nenhum `FAIL` nem `ERROR`, último comando `ROLLBACK`. Os `NOTICE ... does not exist, skipping` são normais.

Este ensaio já foi feito no banco de produção em 13/10/2026, a partir de outra máquina, com o mesmo resultado (19 PASS). Na mesma data, também em transação desfeita, passaram com a migration: `correcoes_auditoria` (10), `guard_own_professional_rows` (7), `booking_rules_single_source` (33), `slot_offer_mode` (26) e a cadeia `booking_reliability` → `slot_waiting` → `optional_occurrences` → `auto_confirmation_modules` (81). Se aparecer qualquer diferença, pare e relate.

## 3. Aplicar a migration

```bash
docker exec -i "$DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -1 < supabase/migrations/20261013120000_regras_papel_banco.sql \
  && docker exec -i "$DB" psql -U postgres -d postgres -X -c "NOTIFY pgrst, 'reload schema';"
docker exec -i "$DB" psql -U postgres -d postgres -X -Atc "select has_function_privilege('anon','public.list_shop_blocks(uuid, timestamptz)','execute'), has_function_privilege('authenticated','public.list_shop_blocks(uuid, timestamptz)','execute'), has_function_privilege('anon','public.list_platform_shop_owners()','execute'), (select count(*) from pg_policies where tablename='availability_blocks');"
```

Esperado: `f|t|f|3`. A migration pode ser reaplicada sem erro e não muda dados.

## 4. Publicar a função `invite-shop-admin`

Passo 7 de [implantacao-2026-10-03.md](implantacao-2026-10-03.md):

```bash
VOL=$(docker inspect "$FN" --format '{{range .Mounts}}{{if eq .Destination "/home/deno/functions"}}{{.Source}}{{end}}{{end}}')
cp -a "$VOL/invite-shop-admin" "/root/invite-shop-admin.bak-$STAMP"
rsync -a --delete --exclude '._*' supabase/functions/invite-shop-admin/ "$VOL/invite-shop-admin/"
docker restart "$FN"
docker logs --tail 80 "$FN"
curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS https://supabase-barbearia.proh.media/functions/v1/invite-shop-admin
```

Esperado: logs sem erro de inicialização e `200` ou `204` no `OPTIONS`. Não criar convite de teste em loja de cliente.

## 5. Relatório

Incluir:

- o nome e o tamanho do backup;
- a saída `f|f` do passo 1;
- a contagem de PASS do ensaio;
- o horário em que a migration foi aplicada;
- a saída `f|t|f|3` do passo 3;
- o status do `OPTIONS` e um trecho do log da função.

Não fazer push no GitHub. Devolver o relatório ao dono, para ele registrar no `docs/CONTINUIDADE.md` por outra máquina.
