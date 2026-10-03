# Implantação no servidor — ajustes finais (03/10/2026, noite)

Para o agente com acesso à VPS (stack `z2dbb7dkyzhc8vjiywq34mhn`). Mesmas regras de [implantacao-2026-10-03.md](implantacao-2026-10-03.md): backup antes, ensaio em `BEGIN … ROLLBACK`, **nunca** rodar arquivo de `supabase/tests/` fora de transação, não usar "Redeploy" do Coolify, não imprimir segredos, reiniciar só o container de funções. O frontend já está publicado e não depende desta parte.

Pré-requisito: produção com as migrations até `20261003210000_slugify_acentos` (aplicada às 19:34 PT). Esta entrega tem **1 migration** e **2 funções**.

## O que muda

- `validate_shop_ownership`: apagar uma barbearia inteira deixa de esbarrar em "A loja precisa de ao menos um dono ativo" (a regra continua valendo para lojas que existem). Passa a `SECURITY DEFINER` para conferir sem depender do RLS de quem chama.
- `save_my_whatsapp`: não responde mais "Este WhatsApp já está em outra conta" (dava para descobrir, sem limite, se um número tem conta). O número é gravado **sem confirmação**; a recusa acontece só na confirmação por código.
- `enqueue_whatsapp_message`: não envia aviso a um número que está **confirmado em outra conta** (fecha o uso do item anterior para mandar avisos ao celular de outra pessoa).
- `purge_auth_otp_challenges()`: apaga códigos de acesso vencidos/usados com mais de 7 dias (só o servidor executa). A função `whatsapp-dispatch` chama uma vez por hora.
- `google-connect`: a leitura da Agenda fica presa no servidor à janela da Política (7 dias para trás, 60 para frente).

## 1. Código, containers e backup

```bash
git pull --ff-only origin main
git log --oneline -1          # o commit desta entrega ou posterior
DB=$(docker ps --format '{{.Names}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep '^supabase-db-')
FN=$(docker ps --format '{{.Names}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep -i functions)
echo "$DB / $FN"
STAMP=$(date +%Y%m%d-%H%M)
docker exec "$DB" pg_dump -U postgres -d postgres -Fc > /root/backup-barba-cabelo-$STAMP.dump
ls -lh /root/backup-barba-cabelo-$STAMP.dump
```

## 2. Ensaio (ROLLBACK)

```bash
{ echo 'BEGIN;'
  cat supabase/migrations/20261003220000_ajustes_finais.sql supabase/tests/ajustes_finais.sql
  echo 'ROLLBACK;'
} | docker exec -i "$DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 2>&1 | tee /root/ensaio-ajustes-$STAMP.log | grep -E 'FAIL|ERROR|ROLLBACK' | tail -3
grep -c 'PASS' /root/ensaio-ajustes-$STAMP.log
```

Esperado: **25 PASS**, nenhum `FAIL`/`ERROR`, último comando `ROLLBACK`. Conferido em cópia local do banco no mesmo estado da produção, como `postgres` e como `supabase_admin`. Qualquer diferença → parar e relatar.

Opcional, também em transação: `supabase/tests/correcoes_auditoria.sql` depois da migration deve dar **10 PASS** (a checagem do WhatsApp foi atualizada para o comportamento novo).

## 3. Aplicar

```bash
docker exec -i "$DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -1 < supabase/migrations/20261003220000_ajustes_finais.sql \
  && docker exec -i "$DB" psql -U postgres -d postgres -X -c "NOTIFY pgrst, 'reload schema';"
docker exec -i "$DB" psql -U postgres -d postgres -X -Atc "select has_function_privilege('anon','public.purge_auth_otp_challenges()','execute'), has_function_privilege('authenticated','public.purge_auth_otp_challenges()','execute'), has_function_privilege('authenticated','public.enqueue_whatsapp_message(uuid,text,text,text,text,jsonb,timestamptz)','execute');"
```

Esperado na última linha: `f|f|f`. A migration pode ser reaplicada sem erro (conferido).

## 4. Publicar funções

Como no passo 7 do guia principal (backup da pasta com sufixo `.bak-$STAMP`, `rsync -a --delete --exclude '._*'`, `docker restart "$FN"`, logs sem erro de inicialização): **`google-connect`** e **`whatsapp-dispatch`**.

```bash
API=https://supabase-barbearia.proh.media
for fn in google-connect whatsapp-dispatch; do printf '%s ' $fn; curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS "$API/functions/v1/$fn" -H 'Origin: https://beauty.contheiner.digital' -H 'Access-Control-Request-Method: POST'; done
docker logs --tail 40 "$FN" 2>&1 | grep -i -E 'error|whatsapp-dispatch' | tail -10
```

Esperado: OPTIONS 200/204 (ou o código que `whatsapp-dispatch` já respondia antes, se ela não tiver CORS — comparar com o backup). O cron do host que chama `whatsapp-dispatch` a cada minuto continua igual; a limpeza roda no minuto 17 de cada hora (UTC).

## 5. Relatório

Backup (nome e tamanho), quantidade de PASS do ensaio, horário da migration, saída `f|f|f`, status das duas funções e trecho do log. Sem push no GitHub, devolver ao dono para registrar no `docs/CONTINUIDADE.md` por outra máquina.
