#!/usr/bin/env python3
"""Ensaia liberação singular apenas na bancada Docker Unix local, em rollback."""
import os
import re
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
if os.environ.get('DOCKER_HOST'):
    raise SystemExit('Somente Docker local')
endpoint = subprocess.check_output(['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], text=True).strip()
if not endpoint.startswith('unix://'):
    raise SystemExit('Somente socket Unix local')
cmd = ['docker', 'exec', '-i', 'barba-central-d1-local', 'psql', '-Xq', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres']
migration = (ROOT / 'supabase/migrations/20261115004000_whatsapp_piloto_liberacao_atomica.sql').read_text()
fixture = (ROOT / 'supabase/tests/whatsapp_piloto_liberacao_atomica.sql').read_text()
assert fixture.startswith('begin;') and fixture.rstrip().endswith('rollback;')
signatures = sorted(set(re.findall(r"pg_get_functiondef\('public\.([^']+)'::regprocedure\)", migration)))
oids = ','.join("'public." + s + "'::regprocedure" for s in signatures)
before = 'create temporary table pilot_base_privileges as select oid,proowner,proacl from pg_proc where oid in (' + oids + ');\n'
after = "do $$begin if exists(select 1 from pilot_base_privileges b join pg_proc p on p.oid=b.oid where b.proowner<>p.proowner or b.proacl is distinct from p.proacl) then raise exception 'BC_OID_OWNER_ACL_ALTERADO';end if;raise notice 'PASS: OID, proprietário e ACL das onze funções preservados';end $$;\n"
result = subprocess.run(cmd, input=fixture.replace('begin;', 'begin;\n' + before + migration + after, 1), text=True, capture_output=True, timeout=90)
print(result.stderr.strip(), flush=True)
if result.returncode:
    raise SystemExit(result.returncode)
for name in ['whatsapp_ciclos_protegidos.sql', 'whatsapp_ciclos_operacao.sql', 'whatsapp_acolhimento_apos_entrada.sql', 'whatsapp_primeiro_acesso_assistido.sql', 'whatsapp_revisao_telefone_protegida.sql', 'whatsapp_revisao_telefone_falhas.sql']:
    source = (ROOT / 'supabase/tests' / name).read_text()
    assert 'begin;' in source and source.rstrip().endswith('rollback;')
    result = subprocess.run(cmd, input=source.replace('begin;', 'begin;\n' + migration, 1), text=True, capture_output=True, timeout=90)
    print(name, result.stderr.strip(), flush=True)
    if result.returncode:
        raise SystemExit(result.returncode)
print('PASS: implantação e testes revertidos integralmente; nenhuma operação fora da bancada')
