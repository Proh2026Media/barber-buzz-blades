#!/usr/bin/env python3
"""Instalador real em clone descartável local: backup, instalação, pós-condições e recusas."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
if os.environ.get('DOCKER_HOST') or not subprocess.check_output(['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], text=True).strip().startswith('unix://'):
    raise SystemExit('Somente Docker Unix local')
container = 'barba-conferencia-p122-local'
name = 'bc_p122_check_operator_' + uuid.uuid4().hex
created = False
try:
    subprocess.run(['docker', 'exec', container, 'createdb', '-U', 'postgres', name], check=True, capture_output=True, timeout=30)
    created = True
    cmd = ['docker', 'exec', '-i', container, 'psql', '-XAtq', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', name]
    dump = subprocess.run(['docker', 'exec', container, 'pg_dump', '-U', 'postgres', '-d', 'postgres', '--no-owner', '--no-acl', '--no-publications', '--no-subscriptions', '--exclude-table-data=vault.*'], check=True, capture_output=True).stdout
    restored = subprocess.run(cmd, input=dump, capture_output=True, timeout=60)
    if restored.returncode:
        raise RuntimeError(restored.stderr.decode()[-1500:])
    # Base publicada é aplicada só neste clone, nunca na bancada ou no servidor.
    base = (ROOT / 'supabase/migrations/20261115004000_whatsapp_piloto_liberacao_atomica.sql').read_text()
    setup = "begin;update public.whatsapp_send_controls set paused=true where scope='global';update public.whatsapp_care_cycle_policy set enabled=false,assisted_access_enabled=false;\n" + base + "\ncommit;"
    restored = subprocess.run(cmd, input=setup.encode(), capture_output=True, timeout=60)
    if restored.returncode: raise RuntimeError(restored.stderr.decode()[-1500:])
    # Somente no clone: restaura ACLs das funções conferidas, sem mudar membros de
    # papéis do servidor. A bancada original também testa a preservação das ACLs.
    contract = json.loads((ROOT / 'scripts/ti/conferencia-piloto/contrato.json').read_text())
    acl_sql = ''
    for signature, meta in contract['before'].items():
        assert meta['owner'] == 'postgres'
        acl_sql += 'revoke all on function public.' + signature + ' from public,anon,authenticated,service_role;\n'
        for acl in meta['acl']:
            role, rest = acl.split('=', 1)
            assert role in ('postgres', 'anon', 'authenticated', 'service_role') and rest == 'X/postgres'
            acl_sql += 'grant execute on function public.' + signature + ' to ' + role + ';\n'
    restored = subprocess.run(cmd, input=acl_sql.encode(), capture_output=True, timeout=30)
    if restored.returncode:
        raise RuntimeError(restored.stderr.decode()[-1500:])
    with tempfile.TemporaryDirectory(prefix='bc-p122-operador-') as tmp:
        tmp = Path(tmp)
        root = tmp / 'pacote'
        root.mkdir()
        sources = {
            'supabase/migrations/20261116001000_whatsapp_conferencia_piloto.sql': ROOT / 'supabase/migrations/20261116001000_whatsapp_conferencia_piloto.sql',
            'operacao/contrato.json': ROOT / 'scripts/ti/conferencia-piloto/contrato.json',
        }
        files = []
        for relative, src in sources.items():
            dest = root / relative
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, dest)
            files.append({'path': relative, 'sha256': hashlib.sha256(dest.read_bytes()).hexdigest()})
        (root / 'MANIFESTO.json').write_text(json.dumps({'files': files}))
        operator = ['python3', 'scripts/ti/conferencia_piloto_operacao.py']
        common = ['--pacote', str(root), '--bancada-local', '--banco', name]
        def run(action, extra=(), expected=0):
            r = subprocess.run(operator + [action] + common + list(extra), capture_output=True, text=True, timeout=120)
            if (r.returncode == 0) != (expected == 0):
                raise RuntimeError(r.stdout + r.stderr)
            return r
        assert json.loads(run('conferir').stdout)['installed'] is False
        denied = run('instalar', ['--backup', str(tmp / 'sem-autorizacao')], expected=1)
        assert '--autorizado' in denied.stderr and not (tmp / 'sem-autorizacao').exists()
        print('PASS: conferência só lê e instalação exige autorização explícita')
        backup = tmp / 'backup'
        result = json.loads(run('instalar', ['--backup', str(backup), '--autorizado']).stdout)
        assert result['installed'] and result['paused'] and result['identities_preserved'] and result['oid_owner_acl_preserved']
        assert result['messages_sent'] == result['containers_restarted'] == 0
        assert stat.S_IMODE(backup.stat().st_mode) == 0o700
        assert stat.S_IMODE((backup / 'antes.dump').stat().st_mode) == 0o600
        print('PASS: backup privado real validado, incremental instalado atomicamente, identidade/OID/owner/ACL e pausa preservados')
        assert json.loads(run('conferir').stdout)['installed'] is True
        again = run('instalar', ['--backup', str(tmp / 'repeticao'), '--autorizado'], expected=1)
        assert 'já instalado' in again.stderr and not (tmp / 'repeticao').exists()
        print('PASS: leitura posterior confere pós-condições; repetição não reaplica nem sobrescreve backup')
        migration = root / next(iter(sources))
        migration.write_text(migration.read_text() + '\n-- adulterado na fixture\n')
        wrong = run('conferir', expected=1)
        assert 'Hash' in wrong.stderr
        print('PASS: hash divergente recusa operação antes de acessar fontes de banco')
finally:
    if created:
        subprocess.run(['docker', 'exec', container, 'dropdb', '-U', 'postgres', '--if-exists', '--force', name], check=True, capture_output=True)
        print('Clone do operador removido; bancada original e produção preservadas')
