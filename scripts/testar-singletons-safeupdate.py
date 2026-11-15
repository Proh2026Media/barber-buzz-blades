#!/usr/bin/env python3
"""Reproduz correções já instaladas somente na bancada P-122 local, sem .env/VPS."""
import json, os, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if os.environ.get('DOCKER_HOST') or not subprocess.check_output(['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], text=True).strip().startswith('unix://'):
    raise SystemExit('Somente Docker Unix local')
cmd = ['docker', 'exec', '-i', '-e', 'PGPASSWORD=localtest', 'barba-central-d1-local', 'psql', '-h', 'localhost', '-XqAt', '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin', '-d', 'postgres']
prefix = "load 'safeupdate';set role postgres;set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';set request.jwt.claim.role='authenticated';"

def sql(query, ok=True):
    r = subprocess.run(cmd, input=prefix + query, text=True, capture_output=True, timeout=30)
    assert (r.returncode == 0) == ok, r.stderr
    return r.stdout.strip() if ok else r.stderr

def failure(query, expected):
    assert expected in sql('begin;' + query + ';rollback;', False)

identity = "select jsonb_agg(jsonb_build_object('oid',oid,'owner',proowner,'acl',proacl) order by oid) from pg_proc where oid in ('public.care_group_admin(text,jsonb)'::regprocedure,'public.platform_set_whatsapp_automatic(boolean,bigint)'::regprocedure);"
before = json.loads(sql(identity))
admin_pause = "select public.care_group_admin('enrollment',jsonb_build_object('enabled',false,'version',(select version from public.whatsapp_care_cycle_policy)))"
auto_pause = "select public.platform_set_whatsapp_automatic(false,(select version from public.whatsapp_distribution_policy))"
hashes = sql("select md5(prosrc) from pg_proc where oid='public.care_group_admin(text,jsonb)'::regprocedure;")
if hashes == 'e233ec1503b516c389653f735f77484a':
    failure(admin_pause, 'UPDATE requires a WHERE clause')
    failure(auto_pause, 'UPDATE requires a WHERE clause')
    print('PASS: duas falhas originais do painel reproduzidas com safeupdate ativo', flush=True)
else:
    assert hashes == '6a15e4fead26e0347dbba94e15757cdb'
    print('INFO: bancada já corrigida; não repete a fase anterior', flush=True)
failure('update public.whatsapp_group_settings set login_enabled=false', 'UPDATE requires a WHERE clause')
sql("update public.whatsapp_send_controls set paused=true where scope='global';update public.whatsapp_care_cycle_policy set enabled=false where singleton;update public.whatsapp_distribution_policy set enabled=false where singleton;")
migration = (ROOT / 'supabase/migrations/20261115001000_whatsapp_singletons_safeupdate.sql').read_text()
sql(migration)
assert json.loads(sql(identity)) == before
for query in [admin_pause, auto_pause]:
    sql('begin;' + query + ';rollback;')
print('PASS: ações de pausa funcionam; OID, proprietário e ACL preservados', flush=True)
failure("select public.care_group_admin('enrollment','{\"enabled\":false,\"version\":-1}')", 'GROUP_STALE')
failure('select public.platform_set_whatsapp_automatic(false,-1)', 'WA_STALE')
failure("set request.jwt.claim.sub='99999999-9999-4999-8999-999999999999';select public.platform_set_whatsapp_automatic(false,(select version from public.whatsapp_distribution_policy))", 'Sem permissão')
failure('update public.whatsapp_group_settings set login_enabled=false', 'UPDATE requires a WHERE clause')
print('PASS: versões, permissão e proteção contra UPDATE sem filtro continuam obrigatórias', flush=True)
sql(migration)
assert json.loads(sql(identity)) == before
assert sql("select (not enabled)::text from public.whatsapp_care_cycle_policy;") == 'true'
print('PASS: reaplicação controlada local preserva identidade e mantém política desligada; não reaplicar na VPS', flush=True)
