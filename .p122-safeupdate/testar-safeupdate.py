#!/usr/bin/env python3
"""Somente runner descartável, pacote público de bancada; sem acesso de produção."""
from pathlib import Path
import json
import subprocess

ROOT = Path(__file__).resolve().parent
PACKAGE = ROOT / 'pacote' / 'BC-Central-WhatsApp-P122-2026-11-14'
PSQL = ['docker', 'exec', '-i', 'barba-central-d1-local', 'sh', '-c', ': "${POSTGRES_PASSWORD:?bancada_sem_senha_local}"; export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql "$@"', 'p122-psql', '-Xq', '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin', '-d', 'postgres']


def query(path, expected_failure=False):
    result = subprocess.run(PSQL, input=b'set role postgres;\n' + path.read_bytes(), capture_output=True)
    (ROOT / (path.stem + '.log')).write_bytes(result.stdout + result.stderr)
    if expected_failure:
        if result.returncode == 0 or b'UPDATE requires a WHERE clause' not in result.stderr:
            print('SQL retornou ' + str(result.returncode) + ' em ' + path.name, flush=True)
            print(result.stderr.decode(), flush=True)
            raise SystemExit('Reprodução não confirmou safeupdate: ' + path.name)
        print('PASS: rejeição original comprovada em ' + path.name, flush=True)
    elif result.returncode:
        print(result.stderr.decode(), flush=True)
        raise SystemExit('Falha no ensaio: ' + path.name)
    return result


subprocess.run(['python3', 'scripts/testar-central-d4-banco.py', '--preparar'], cwd=PACKAGE / 'bancada', check=True)
print('Diagnóstico de papéis da bancada:', flush=True)
subprocess.run(PSQL + ['-c', "select rolname,rolsuper from pg_roles where rolname in ('postgres','supabase_admin');"], check=True)
for name in ['repro-antes.sql', 'repro-segundo-update.sql', 'repro-distribuicao.sql']:
    query(ROOT / name, expected_failure=True)
fix = ROOT / '20261115001000_whatsapp_singletons_safeupdate.sql'
query(fix)
query(fix)
result = query(ROOT / 'regressao-depois.sql')
count = result.stderr.count(b'PASS:')
if count < 9:
    raise SystemExit('Verificações de regressão incompletas')
report = {'expected_failures_reproduced': 3, 'regression_assertions_passed': count,
          'safeupdate_enabled': True, 'reapplication_checked': True,
          'production_access': False, 'package_original_modified': False}
(ROOT / 'resultado-safeupdate.json').write_text(json.dumps(report, indent=2) + chr(10))
print(json.dumps(report, indent=2))
