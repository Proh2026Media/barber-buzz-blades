#!/usr/bin/env python3
"""Ensaia operador/SQL/cópia/retorno em D4 limpa local; nunca usa VPS ou .env."""
import argparse, hashlib, json, os, subprocess, tempfile, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--pacote', required=True, type=Path)
a = p.parse_args()
stage = a.pacote.resolve()
if os.environ.get('DOCKER_HOST') or not subprocess.check_output(['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], text=True).strip().startswith('unix://'):
    raise SystemExit('Somente Docker Unix local')
subprocess.run(['python3', 'scripts/testar-central-d4-banco.py', '--preparar'], check=True)
cmd = ['docker', 'exec', '-i', 'barba-central-d1-local', 'psql', '-XqAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres']

def sql(text):
    return subprocess.check_output(cmd, input=text, text=True, stderr=subprocess.PIPE).strip()

# Grupo v5 já criado/ativo: migrar deve preservar JID, ano, admissão e preferências.
setup = (ROOT / 'supabase/tests/whatsapp_ciclos_protegidos.sql').read_text()
setup = setup[:setup.index("select pg_temp.check_d4((select created_at is not null")]
setup = setup.replace("'+5511800000111'", "'+5511800080111'").replace("'+5511800000222'", "'+5511800080222'").replace("5511999999999", "5511999989999").replace("99887766-5555@g.us", "99887766-8888@g.us")
setup += """
update public.whatsapp_care_cycles set prepared=true,first_received=true,state='active' where id=(select cycle from d4);
update public.whatsapp_care_groups set use_group=true,entry_pending=false,controls_verified=true,notifications=true where id=(select grp from d4);
select public.release_care_cycle(cycle,(job->>'token')::uuid) from d4;
insert into public.whatsapp_customer_contact_preferences(customer_id,monthly_marketing) select person,3 from d4 on conflict(customer_id) do update set monthly_marketing=3;
update public.whatsapp_care_cycle_policy set enabled=false;
update public.whatsapp_send_controls set paused=true where scope='global';
select jsonb_build_object('cycle',cycle,'group',grp) from d4;commit;
"""
info = json.loads(next(line for line in reversed(sql(setup).splitlines()) if line.startswith('{')))
snapshot_query = f"select jsonb_build_object('jid',c.group_jid,'created',c.created_at,'expires',c.expires_at,'admission',c.admission_id,'notifications',g.notifications,'preferences',to_jsonb(p)) from public.whatsapp_care_cycles c join public.whatsapp_care_groups g on g.id=c.group_id join public.whatsapp_customer_contact_preferences p on p.customer_id=g.customer_id where c.id='{info['cycle']}';"
before = json.loads(sql(snapshot_query))
manifest = json.loads((stage / 'MANIFESTO.json').read_text())
name = 'bc-acolhimento-edge-local-' + uuid.uuid4().hex[:8]
owned = None
with tempfile.TemporaryDirectory(prefix='bc-pacote-acolhimento-') as tmp:
    target = Path(tmp) / 'funcoes'
    backup = Path(tmp) / 'backup'
    for path, expected in manifest['base_funcoes'].items():
        data = subprocess.check_output(['git', 'show', '7db853a:supabase/functions/' + path], stderr=subprocess.DEVNULL)
        assert hashlib.sha256(data).hexdigest() == expected
        f = target / path
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_bytes(data)

    def operator(action, *args, ok=True):
        r = subprocess.run(['python3', str(stage / 'operacao/acolhimento_whatsapp_operacao.py'), action,
                            '--pacote', str(stage), '--funcoes', str(target), '--db', 'barba-central-d1-local', *args], capture_output=True, text=True)
        assert (r.returncode == 0) == ok, r.stdout + r.stderr
        return r.stdout.strip()

    try:
        operator('conferir')
        operator('base')
        operator('sql-bc', ok=False)
        operator('sql-bc', '--autorizado')
        assert json.loads(sql(snapshot_query)) == before
        assert sql(f"select (not prepared and admission_welcome_id is null and admission_welcome_message_id is null)::text from public.whatsapp_care_cycles where id='{info['cycle']}';") == 'true'
        operator('sql-bc', '--autorizado', ok=False)
        print('PASS: operador confere base real v5, aplica SQL atomicamente uma vez e preserva grupo/ano/admissão/preferências', flush=True)
        owned = subprocess.check_output(['docker', 'create', '--name', name, '--entrypoint', '/bin/true', 'supabase/postgres:15.8.1.085'], text=True).strip()
        operator('funcoes', '--edge', name, '--backup', str(backup), '--autorizado')
        for path in manifest['base_funcoes']:
            assert (target / path).read_bytes() == (stage / 'funcoes' / path).read_bytes()
        operator('restaurar-funcoes', '--edge', name, '--backup', str(backup), '--autorizado')
        for path, expected in manifest['base_funcoes'].items():
            assert hashlib.sha256((target / path).read_bytes()).hexdigest() == expected
        assert sql('select (not enabled)::text from public.whatsapp_care_cycle_policy;') == 'true'
        print('PASS: cópia e retorno reais restauram hashes exatos e mantêm política desligada', flush=True)
    finally:
        if owned:
            subprocess.run(['docker', 'rm', '-f', owned], check=True, stdout=subprocess.DEVNULL)
