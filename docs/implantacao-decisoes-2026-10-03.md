# Implantação no servidor — avisos só para WhatsApp confirmado e fuso da loja (03/10/2026, noite)

Para o agente com acesso à VPS (stack `z2dbb7dkyzhc8vjiywq34mhn`). Mesmas regras de [implantacao-2026-10-03.md](implantacao-2026-10-03.md): backup antes, ensaio em `BEGIN … ROLLBACK`, **nunca** rodar arquivo de `supabase/tests/` fora de transação, não usar "Redeploy" do Coolify, não imprimir segredos, reiniciar só o container de funções. O frontend já está publicado e funciona sem esta parte.

Esta entrega tem **1 migration** (`20261003230000_decisoes_whatsapp_fuso.sql`) e **1 função** (`register-shop`). Ela vem **depois** da `20261003220000_ajustes_finais.sql` ([implantacao-ajustes-finais-2026-10-03.md](implantacao-ajustes-finais-2026-10-03.md)). Se a 220000 ainda não foi aplicada, faça aquele guia primeiro (ou aplique as duas em sequência, como abaixo).

## O que muda

- **Avisos por WhatsApp a clientes só saem para número confirmado por código** (lembretes, confirmações, avisos manuais). Avisos para equipe/dono não mudam. Avisos pendentes na fila para números não confirmados são marcados como `failed` na aplicação. O e-mail continua saindo.
- **Fuso horário da loja:** `set_shop_timezone(p_shop_id, p_timezone)` para dono/sócio, pelo mesmo caminho de aprovação das configurações de agendamento (`request_shop_change`, tipo `shop.timezone`); gatilho que recusa fuso inválido; `register-shop` aceita `timezone` no cadastro.

Antes de aplicar, anote quantos clientes vão parar de receber WhatsApp até confirmar:

```bash
docker exec -i "$DB" psql -U postgres -d postgres -X -Atc "select count(*) from public.profiles where whatsapp_e164 is not null and whatsapp_opt_in_at is not null and whatsapp_verified_at is null;"
```

## 1. Código, containers e backup

```bash
git pull --ff-only origin main
git log --oneline -1          # o commit desta entrega ou posterior
DB=$(docker ps --format '{{.Names}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep '^supabase-db-')
FN=$(docker ps --format '{{.Names}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep -i functions)
STAMP=$(date +%Y%m%d-%H%M)
docker exec "$DB" pg_dump -U postgres -d postgres -Fc > /root/backup-barba-cabelo-$STAMP.dump
ls -lh /root/backup-barba-cabelo-$STAMP.dump
docker exec -i "$DB" psql -U postgres -d postgres -X -Atc "select exists(select 1 from pg_proc where proname='purge_auth_otp_challenges') as tem_220000;"
```

## 2. Ensaio (ROLLBACK)

Se `tem_220000` = `t`:

```bash
{ echo 'BEGIN;'
  cat supabase/migrations/20261003230000_decisoes_whatsapp_fuso.sql supabase/tests/decisoes_whatsapp_fuso.sql
  echo 'ROLLBACK;'
} | docker exec -i "$DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 2>&1 | tee /root/ensaio-decisoes-$STAMP.log | grep -E 'FAIL|ERROR|ROLLBACK' | tail -3
grep -c 'PASS' /root/ensaio-decisoes-$STAMP.log
```

Se `tem_220000` = `f`, ponha `supabase/migrations/20261003220000_ajustes_finais.sql` antes da 230000 no mesmo `cat`.

Esperado: **43 PASS**, nenhum `FAIL`/`ERROR`, último comando `ROLLBACK`. Um `NOTICE ... does not exist, skipping` é normal. Conferido em cópia local do banco nos dois casos (com e sem a 220000 aplicada). Qualquer diferença → parar e relatar.

Opcional, também em transação e depois da migration: `supabase/tests/ajustes_finais.sql` deve dar **25 PASS**.

## 3. Aplicar

```bash
# se tem_220000 = f, aplicar antes: 20261003220000_ajustes_finais.sql (mesmo comando)
docker exec -i "$DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -1 < supabase/migrations/20261003230000_decisoes_whatsapp_fuso.sql \
  && docker exec -i "$DB" psql -U postgres -d postgres -X -c "NOTIFY pgrst, 'reload schema';"
docker exec -i "$DB" psql -U postgres -d postgres -X -Atc "select has_function_privilege('anon','public.set_shop_timezone(uuid, text)','execute'), has_function_privilege('authenticated','public.set_shop_timezone(uuid, text)','execute'), (select count(*) from pg_trigger where tgname like 'barbershops_timezone_guard%');"
```

Esperado: `f|t|2`. Pode ser reaplicada sem erro (conferido).

## 4. Publicar função

`register-shop`, como no passo 7 do guia principal (backup da pasta `.bak-$STAMP`, `rsync -a --delete --exclude '._*'`, `docker restart "$FN"`, logs sem erro). Conferir:

```bash
API=https://supabase-barbearia.proh.media
curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS "$API/functions/v1/register-shop" -H 'Origin: https://beauty.contheiner.digital' -H 'Access-Control-Request-Method: POST'
```

Esperado: 200/204.

## 5. Também verificar (MCP removido do app)

O app não tem mais as telas `/.lovable/oauth/consent`, `/.mcp/*` e `/.well-known/oauth-protected-resource`. Se o Auth do Supabase tiver o servidor OAuth 2.1 ligado apontando para `/.lovable/oauth/consent` (variáveis `GOTRUE_OAUTH_SERVER_*` ou parecidas no serviço do Coolify), **só relatar** o nome e o valor da URL (sem segredos) — não desligar sem o dono.

## 6. Relatório

Backup (nome e tamanho), contagem de clientes afetados (antes de aplicar), PASS do ensaio, horário da migration, saída `f|t|2`, OPTIONS do `register-shop`, item 5. Sem push no GitHub, devolver ao dono para registrar no `docs/CONTINUIDADE.md` por outra máquina.
