#!/bin/bash
# Cópia local do banco para testar migrations e testes SQL antes de levar ao servidor.
#
# Sobe um Postgres do Supabase no Docker deste Mac (nada vai à VPS), completa as partes que o
# Auth e o Storage criariam num Supabase completo, aplica todas as migrations de
# supabase/migrations e roda os testes de supabase/tests, cada um dentro de BEGIN … ROLLBACK.
#
# Uso:
#   scripts/banco-local.sh subir [ATE]             cria o container e aplica as migrations (com ATE,
#                                                  por exemplo 20261014120000, para nela: o banco fica
#                                                  igual ao de produção quando há migrations pendentes)
#   scripts/banco-local.sh testes [extra.sql ...]  roda os testes (as extras entram antes de cada um,
#                                                  na mesma transação; nada fica gravado)
#   scripts/banco-local.sh parar                   apaga o container
#
# Exemplo (migration nova ainda não aplicada no servidor):
#   scripts/banco-local.sh subir 20261014120000
#   scripts/banco-local.sh testes supabase/migrations/20261016130000_agendamento_pelo_painel.sql
#
# Requisitos: Docker Desktop ligado (open -a Docker) e ~3 GB para a imagem na primeira vez.
# Criado em 16/10/2026 (Claude Code); validado com as 96 migrations: 1.074 PASS.
set -u
cd "$(dirname "$0")/.." || exit 1

NOME=barba-db-local
IMAGEM=supabase/postgres:15.8.1.085
SENHA=localtest
PSQL=(docker exec -i -e PGPASSWORD=$SENHA "$NOME" psql -h localhost -d postgres -X)

subir() {
  local ate="${1:-}"
  docker info >/dev/null 2>&1 || { echo "banco-local: o Docker está desligado (open -a Docker)"; exit 1; }
  docker rm -f "$NOME" >/dev/null 2>&1
  docker run -d --name "$NOME" -e POSTGRES_PASSWORD=$SENHA -p 127.0.0.1:54329:5432 "$IMAGEM" >/dev/null || exit 1
  for _ in $(seq 1 60); do
    docker exec "$NOME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break
    sleep 1
  done
  sleep 6
  # O que o Auth (GoTrue) e o Storage criariam num Supabase completo e as migrations usam.
  "${PSQL[@]}" -U supabase_admin -q -v ON_ERROR_STOP=1 <<'SQL' || exit 1
alter table auth.users add column if not exists phone text unique default null;
alter table auth.users add column if not exists phone_confirmed_at timestamptz;
alter table auth.users add column if not exists email_confirmed_at timestamptz;
alter table auth.users add column if not exists banned_until timestamptz;
alter table auth.users add column if not exists deleted_at timestamptz;
alter table auth.users add column if not exists is_sso_user boolean not null default false;
alter table auth.users add column if not exists is_anonymous boolean not null default false;
create table if not exists auth.identities (
  id uuid primary key default gen_random_uuid(), provider_id text not null default '',
  user_id uuid not null references auth.users(id) on delete cascade,
  identity_data jsonb not null default '{}'::jsonb, provider text not null default 'email',
  last_sign_in_at timestamptz, created_at timestamptz default now(),
  updated_at timestamptz default now(), email text);
create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(), updated_at timestamptz default now(), factor_id uuid,
  aal text, not_after timestamptz, refreshed_at timestamp, user_agent text, ip inet, tag text);
-- Códigos do login (PKCE), conferidos pela ponte do Google no app instalado (20261016120000).
create table if not exists auth.flow_state (
  id uuid primary key, user_id uuid, auth_code text, code_challenge_method text,
  code_challenge text, provider_type text not null, provider_access_token text,
  provider_refresh_token text, created_at timestamptz, updated_at timestamptz,
  authentication_method text not null, auth_code_issued_at timestamptz,
  email_optional boolean not null default false);
create index if not exists idx_auth_code on auth.flow_state (auth_code);
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''),
                  nullif(current_setting('request.jwt.claims', true), ''))::jsonb
$$;
grant usage on schema auth to postgres, anon, authenticated, service_role;
grant select, references on auth.users to postgres;
grant select on auth.identities to postgres;
grant select, references, trigger on auth.sessions to postgres;
grant select, insert, delete on auth.flow_state to postgres;
alter table auth.sessions owner to postgres;
set role supabase_storage_admin;
alter table storage.buckets add column if not exists public boolean default false;
alter table storage.buckets add column if not exists avif_autodetection boolean default false;
alter table storage.buckets add column if not exists file_size_limit bigint;
alter table storage.buckets add column if not exists allowed_mime_types text[];
alter table storage.buckets add column if not exists owner_id text;
alter table storage.objects add column if not exists path_tokens text[]
  generated always as (string_to_array(name, '/')) stored;
alter table storage.objects add column if not exists version text;
alter table storage.objects add column if not exists owner_id text;
alter table storage.objects add column if not exists user_metadata jsonb;
grant all on storage.buckets, storage.objects to postgres;
reset role;
SQL
  local n=0
  for f in supabase/migrations/*.sql; do
    case "$(basename "$f")" in ._*) continue ;; esac
    if [ -n "$ate" ] && [[ "$(basename "$f")" > "${ate}_~" ]]; then break; fi
    n=$((n + 1))
    if ! out=$("${PSQL[@]}" -U postgres -q -v ON_ERROR_STOP=1 -1 <"$f" 2>&1); then
      echo "banco-local: falhou na migration $f"
      echo "$out" | grep -E 'ERROR|DETAIL' | head -5
      exit 1
    fi
  done
  # Alguns testes usam um admin da plataforma que existe em produção.
  "${PSQL[@]}" -U supabase_admin -q -v ON_ERROR_STOP=1 <<'SQL' || exit 1
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated', 'admin-local@example.invalid', '', now(),
  '{"provider":"email"}', '{"full_name":"Admin Local"}', now(), now())
on conflict (id) do nothing;
insert into public.memberships (user_id, role)
values ('11111111-1111-4111-8111-111111111111', 'platform_admin') on conflict do nothing;
SQL
  echo "banco-local: $n migrations aplicadas no container $NOME"
}

testes() {
  local extra=("$@")
  local base=supabase/tests/booking_reliability.sql
  # Estes rodam depois de booking_reliability.sql na mesma transação (ver o cabeçalho de cada um).
  local cadeia=" aggregate_insights cancellation_reasons customer_insights optional_occurrences post_service_surveys privacy_requests service_interest_insights service_interest_survey slot_waiting staff_recorded_surveys "
  local separa="reset role; select set_config('request.jwt.claim.sub','',true);"
  local total_pass=0 total_fail=0
  for t in supabase/tests/*.sql; do
    local nome
    nome=$(basename "$t" .sql)
    case "$nome" in ._*) continue ;; esac
    local arquivos=()
    [[ "$cadeia" == *" $nome "* ]] && arquivos=("$base")
    [[ "$nome" == "auto_confirmation_modules" ]] && arquivos=("$base" supabase/tests/optional_occurrences.sql)
    arquivos+=("$t")
    local usuario=postgres
    # O bootstrap já cria auth.users.phone; privacidade também roda como postgres.
    local out
    if [[ "$nome" == "slug_redirects_departure" ]]; then
      # Abre e fecha a própria transação: as migrations extras não entram (seriam gravadas).
      out=$("${PSQL[@]}" -U "$usuario" -v ON_ERROR_STOP=1 <"$t" 2>&1)
    else
      out=$({
        echo 'BEGIN;'
        for e in "${extra[@]+"${extra[@]}"}"; do cat "$e"; echo; done
        for f in "${arquivos[@]}"; do cat "$f"; echo; echo "$separa"; done
        echo 'ROLLBACK;'
      } | "${PSQL[@]}" -U "$usuario" -v ON_ERROR_STOP=1 2>&1)
    fi
    local p f
    p=$(echo "$out" | grep -c PASS)
    f=$(echo "$out" | grep -cE 'FAIL|ERROR:')
    total_pass=$((total_pass + p))
    total_fail=$((total_fail + f))
    if [ "$f" -gt 0 ]; then
      echo "XX $nome: $p PASS, $f FAIL/ERROR"
      echo "$out" | grep -E 'FAIL|ERROR:|DETAIL|CONTEXT' | head -4 | sed 's/^/     /'
    else
      echo "ok $nome: $p PASS"
    fi
  done
  echo "TOTAL: $total_pass PASS, $total_fail FAIL/ERROR"
  [ "$total_fail" -eq 0 ]
}

case "${1:-}" in
  subir) subir "${2:-}" ;;
  testes) shift; testes "$@" ;;
  parar) docker rm -f "$NOME" >/dev/null 2>&1 && echo "banco-local: container $NOME apagado" ;;
  *)
    sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
