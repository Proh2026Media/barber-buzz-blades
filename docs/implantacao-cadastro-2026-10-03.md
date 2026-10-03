# Implantação no servidor — cadastro com aceite, nome e WhatsApp (03/10/2026, noite)

Para o agente com acesso à VPS (stack `z2dbb7dkyzhc8vjiywq34mhn`). Mesmas regras de segurança de [implantacao-2026-10-03.md](implantacao-2026-10-03.md): backup antes, ensaio em `BEGIN … ROLLBACK`, **nunca** rodar arquivo de `supabase/tests/` fora de transação, não usar "Redeploy" do Coolify, não imprimir segredos, reiniciar só o container de funções. O frontend já está publicado e funciona sem esta parte (só não grava o aceite).

Pré-requisito: as 5 migrations de 03/10 (`20261003150000` a `20261003190000`) já aplicadas — foram, às 17:44 PT.

## 1. Código e containers

```bash
git pull --ff-only origin main
git log --oneline -1          # o commit desta entrega ou posterior
DB=$(docker ps --format '{{.Names}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep '^supabase-db-')
FN=$(docker ps --format '{{.Names}}' | grep z2dbb7dkyzhc8vjiywq34mhn | grep -i functions)
echo "$DB / $FN"
```

## 2. Backup

```bash
STAMP=$(date +%Y%m%d-%H%M)
docker exec "$DB" pg_dump -U postgres -d postgres -Fc > /root/backup-barba-cabelo-$STAMP.dump
ls -lh /root/backup-barba-cabelo-$STAMP.dump
```

## 3. Ensaio (ROLLBACK)

```bash
M=supabase/migrations
{ echo 'BEGIN;'
  cat $M/20261003200000_cadastro_aceite.sql $M/20261003210000_slugify_acentos.sql supabase/tests/cadastro_aceite.sql
  echo "select 'SLUG ' || public.slugify_pt('Vinícius') || ' ' || public.slugify_pt('Ação & Cia');"
  echo 'ROLLBACK;'
} | docker exec -i "$DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 2>&1 | tee /root/ensaio-cadastro-$STAMP.log | grep -E 'PASS|FAIL|ERROR|SLUG|ROLLBACK' | tail -5
grep -c 'PASS' /root/ensaio-cadastro-$STAMP.log
```

Esperado: **27 PASS**, nenhum `FAIL`/`ERROR`, `SLUG vinicius acao-cia`, último comando `ROLLBACK`. Conferido em cópia local do banco no mesmo estado da produção. Qualquer diferença → parar e relatar.

## 4. Aplicar

```bash
for f in 20261003200000_cadastro_aceite.sql 20261003210000_slugify_acentos.sql; do
  echo "== $f"
  docker exec -i "$DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -1 < "supabase/migrations/$f" || { echo "FALHOU em $f — parar"; break; }
done
docker exec -i "$DB" psql -U postgres -d postgres -X -c "NOTIFY pgrst, 'reload schema';"
docker exec -i "$DB" psql -U postgres -d postgres -X -Atc "select has_function_privilege('anon','public.record_my_terms_acceptance(text,text,text,boolean)','execute') as anon_executa, has_column_privilege('authenticated','public.profiles','terms_version','update') as usuario_altera_aceite;"
```

Esperado na última linha: `f|f`.

O que muda: `profiles` ganha `terms_version`, `privacy_version`, `dpa_version`, `terms_accepted_at`, `age_confirmed_at` (sem UPDATE pelo usuário); `handle_new_user` grava nome, aceite, idade e WhatsApp **não verificado** vindos do cadastro; RPC `record_my_terms_acceptance`; `slugify_pt` deixa de trocar letras acentuadas (í→e, ç→y). Endereços de lojas já criadas **não mudam**.

## 5. Publicar funções

Como no passo 7 do guia principal (backup da pasta com sufixo `.bak-$STAMP`, `rsync -a --delete --exclude '._*'`, `docker restart "$FN"`, logs sem erro):

- `register-shop` (aceite obrigatório quando enviado pela tela nova, grava o aceite do dono, WhatsApp do dono como contato da loja quando ele escolhe "Sim");
- `google-connect` (se ainda não foi publicada a versão de `0a1ad57`: apaga o aviso antigo quando a lista de agendas funciona).

```bash
API=https://supabase-barbearia.proh.media
for fn in register-shop google-connect; do printf '%s ' $fn; curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS "$API/functions/v1/$fn" -H 'Origin: https://beauty.contheiner.digital' -H 'Access-Control-Request-Method: POST'; done
```

Esperado: 200/204.

## 6. Relatório

Backup (nome e tamanho), quantidade de PASS do ensaio, migrations aplicadas com horário, saída `f|f`, status do OPTIONS das duas funções. Sem acesso de push ao GitHub, devolver o relatório ao dono para registrar no `docs/CONTINUIDADE.md` por outra máquina.
