#!/usr/bin/env bash
# Entrega incremental: somente VPS já na revisão 2. Ler o roteiro antes.
# conferir: somente leitura. instalar: requer janela autorizada; mantém push desligado.
set -euo pipefail
BC_MODE="${1:-conferir}"
BC_PACKAGE="${2:-}"
[[ "$BC_MODE" == conferir || "$BC_MODE" == instalar ]] || { echo 'Use conferir ou instalar.'; exit 2; }
[[ -n "$BC_PACKAGE" ]] || { echo 'Informe a pasta extraída do pacote.'; exit 2; }
BC_PACKAGE="$(cd "$BC_PACKAGE" && pwd)"
BC_SERVICE='/data/coolify/services/z2dbb7dkyzhc8vjiywq34mhn'
BC_FUNCTIONS="$BC_SERVICE/volumes/functions"
BC_EDGE='supabase-edge-functions-z2dbb7dkyzhc8vjiywq34mhn'
BC_DB='supabase-db-z2dbb7dkyzhc8vjiywq34mhn'
BC_SQL='20261112232000_web_push_lotes_limitados.sql'
[[ "$EUID" == 0 ]] || { echo 'Executar como root na VPS correta.'; exit 2; }
(cd "$BC_PACKAGE" && sha256sum -c SHA256SUMS >/dev/null)
[[ "$(sha256sum "$BC_FUNCTIONS/web-push/index.ts" | cut -d' ' -f1)" == e51759e3eab1dde5d9e31dfcf4360edf7bcf5b231e168a13f214cc86f13fb0c4 ]] || { echo 'Base Edge divergente. Parar e revisar; não sobrescrever.'; exit 1; }
[[ "$(sha256sum "$BC_FUNCTIONS/_shared/web-push.ts" | cut -d' ' -f1)" == 09580aad2944fd4315b01efa74cdb939ce5fedf48f1df3495e34455d52d4c930 ]] || { echo 'Dependência divergente. Parar.'; exit 1; }
for BC_NEW in web-push-budget.ts web-push-dispatch.ts; do
  [[ ! -e "$BC_FUNCTIONS/_shared/$BC_NEW" ]] || { echo 'Módulo incremental já existe: conferir antes de repetir.'; exit 1; }
done
docker exec "$BC_EDGE" sh -c 'test "$WEB_PUSH_ENABLED" = false && test -n "$WEB_PUSH_PUBLIC_KEY" && test -n "$WEB_PUSH_PRIVATE_KEY" && test "$WEB_PUSH_SUBJECT" = mailto:contato@proh.media'
# Conferir também o ambiente resolvido que será usado na recriação; nunca imprimir valores.
(cd "$BC_SERVICE" && docker compose config --format json) | python3 -c 'import json,sys; e=json.load(sys.stdin)["services"]["supabase-edge-functions"]["environment"]; assert e.get("WEB_PUSH_ENABLED")=="false", "Push deve continuar desligado no Compose"; assert all(e.get(k) for k in ("WEB_PUSH_PUBLIC_KEY","WEB_PUSH_PRIVATE_KEY","WEB_PUSH_SUBJECT")), "VAPID existente precisa estar persistido"'
[[ "$(docker inspect "$BC_EDGE" --format '{{.State.Health.Status}}')" == healthy ]] || { echo 'Edge não está saudável.'; exit 1; }
# Checagens SQL somente de leitura, sem revelar inscrições, mensagens ou segredos.
docker exec -i "$BC_DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
do $$ begin
 if (select enabled from public.web_push_settings where singleton) is distinct from false then raise exception 'Push deve estar desligado'; end if;
 if pg_get_functiondef('public.web_push_claim()'::regprocedure) !~* 'limit\s+20\s+for update skip locked' then raise exception 'Claim diverge da revisão 2'; end if;
 if has_function_privilege('authenticated','public.web_push_claim()','execute') or has_function_privilege('anon','public.web_push_claim()','execute') then raise exception 'Permissão divergente'; end if;
 if to_regclass('cron.job') is not null then
   if exists(select 1 from cron.job where command ilike '%web-push%') then raise exception 'Há agendador Web Push; parar e revisar'; end if;
 end if;
end $$;
SQL
printf 'Conferência aprovada. Push desligado; chaves existentes preservadas.\n'
[[ "$BC_MODE" == instalar ]] || exit 0
BC_BACKUP="/root/backup-bc-webpush-dispatch-$(date +%Y%m%d-%H%M%S)"
umask 077
mkdir "$BC_BACKUP"
printf 'Backup desta janela: %s\n' "$BC_BACKUP"
trap 'echo "Instalação interrompida. Não ativar push. Consultar roteiro e backup: $BC_BACKUP" >&2' ERR
cp -p "$BC_FUNCTIONS/web-push/index.ts" "$BC_BACKUP/index.ts"
cp -p "$BC_SERVICE/.env" "$BC_BACKUP/env-preservado"
docker exec "$BC_DB" psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1 -c "select pg_get_functiondef('public.web_push_claim()'::regprocedure)||';';" > "$BC_BACKUP/claim-anterior.sql"
docker inspect "$BC_EDGE" --format '{{.Image}} {{.State.StartedAt}}' > "$BC_BACKUP/edge-anterior.txt"
BC_START="$(date +%s)"
# SQL transacional: nome novo; nenhum migrador/ledger é criado ou usado.
{ printf "begin; set local lock_timeout='5s'; set local statement_timeout='15s';\n"; cat "$BC_PACKAGE/arquivos/supabase/migrations/$BC_SQL"; printf '\ncommit;\n'; } |
  docker exec -i "$BC_DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1
for BC_FILE in _shared/web-push-budget.ts _shared/web-push-dispatch.ts web-push/index.ts; do
  # Arquivo temporário no mesmo volume e rename; não substituir diretório inteiro.
  install -m 644 "$BC_PACKAGE/arquivos/supabase/functions/$BC_FILE" "$BC_FUNCTIONS/$BC_FILE.bc-novo"
  mv "$BC_FUNCTIONS/$BC_FILE.bc-novo" "$BC_FUNCTIONS/$BC_FILE"
done
(cd "$BC_SERVICE" && docker compose up -d --no-deps --force-recreate --pull never supabase-edge-functions)
BC_HEALTH=''
for ((BC_TRY=0; BC_TRY<30; BC_TRY++)); do
  BC_HEALTH="$(docker inspect "$BC_EDGE" --format '{{.State.Health.Status}}')"
  [[ "$BC_HEALTH" == healthy ]] && break
  sleep 2
done
[[ "$BC_HEALTH" == healthy ]]
docker exec "$BC_EDGE" sh -c 'test "$WEB_PUSH_ENABLED" = false && test -n "$WEB_PUSH_PUBLIC_KEY" && test -n "$WEB_PUSH_PRIVATE_KEY"'
# Nenhuma variável mudou no disco durante o procedimento.
cmp -s "$BC_SERVICE/.env" "$BC_BACKUP/env-preservado"
for BC_FILE in _shared/web-push-budget.ts _shared/web-push-dispatch.ts web-push/index.ts; do
  cmp -s "$BC_PACKAGE/arquivos/supabase/functions/$BC_FILE" "$BC_FUNCTIONS/$BC_FILE"
done
docker exec -i "$BC_DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
do $$ begin
 if (select enabled from public.web_push_settings where singleton) is distinct from false then raise exception 'Push deixou de estar desligado'; end if;
 if pg_get_functiondef('public.web_push_claim()'::regprocedure) !~* 'limit\s+4\s+for update skip locked' then raise exception 'Claim incremental não conferido'; end if;
end $$;
SQL
printf 'Instalado com push desligado e sem cron. Tempo total da etapa: %s s (não equivale à indisponibilidade medida).\n' "$(( $(date +%s) - BC_START ))"
printf 'Backup: %s\nAinda conferir endpoints e registrar a indisponibilidade observada no relatório.\n' "$BC_BACKUP"
