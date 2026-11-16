#!/usr/bin/env python3
"""Corrida física em banco novo dentro do container local; nunca acessa a VPS."""
import json
import os
from pathlib import Path
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
CONTAINER = 'barba-central-d1-local'
if os.environ.get('DOCKER_HOST'):
    raise SystemExit('Somente Docker local')
endpoint = subprocess.check_output(['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], text=True).strip()
if not endpoint.startswith('unix://'):
    raise SystemExit('Somente socket Unix local')
database = 'bc_p122_pilot_' + uuid.uuid4().hex

def command(db):
    return ['docker', 'exec', '-i', CONTAINER, 'psql', '-XAtq', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', db]

def sql(query, db=database, check=True):
    r = subprocess.run(command(db), input=query, text=True, capture_output=True, timeout=60)
    if check and r.returncode:
        raise RuntimeError(r.stderr[-2500:])
    return r

children = []
try:
    subprocess.run(['docker', 'exec', CONTAINER, 'createdb', '-U', 'postgres', database], check=True, capture_output=True)
    # Este clone serve à corrida de transações. ACLs/OIDs são verificados na
    # bancada original, não por esta restauração com proprietário local único.
    dump = subprocess.run(['docker', 'exec', CONTAINER, 'pg_dump', '-U', 'postgres', '-d', 'postgres', '--no-owner', '--no-acl', '--no-publications', '--no-subscriptions', '--exclude-table-data=vault.*'], check=True, capture_output=True).stdout
    r = subprocess.run(command(database), input=dump, capture_output=True, timeout=60)
    if r.returncode:
        raise RuntimeError(r.stderr.decode()[-2500:])
    migration = (ROOT / 'supabase/migrations/20261115004000_whatsapp_piloto_liberacao_atomica.sql').read_text()
    source = (ROOT / 'supabase/tests/whatsapp_piloto_liberacao_atomica.sql').read_text()
    fixture = source.split('create temporary table initial_state')[0].removeprefix('begin;')
    fixture = fixture.replace('create temporary table d4', 'create table local_test_fixture').replace('from d4', 'from local_test_fixture').replace('update d4', 'update local_test_fixture')
    sql('begin;\n' + migration + '\n' + fixture + '\ncommit;')
    args = json.loads(sql("select jsonb_build_object('confirmed',true,'shop_id',pilot_shop_id,'customer_id',pilot_customer_id,'policy_version',version,'pause_version',(select version from public.whatsapp_send_controls where scope='global')) from public.whatsapp_care_cycle_policy;").stdout)
    auth = "select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);"
    activate = "select public.care_pilot_admin('activate','" + json.dumps(args) + "'::jsonb);"
    a = subprocess.Popen(command(database), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    children.append(a)
    a.stdin.write('begin;\n' + auth + '\n' + activate + "\nselect 'CONTROLES_NAO_COMMITADOS';\nselect pg_sleep(5);\ncommit;\n")
    a.stdin.close()
    while True:
        line = a.stdout.readline()
        if 'CONTROLES_NAO_COMMITADOS' in line:
            break
        if not line:
            raise RuntimeError('Ativação da fixture falhou: ' + a.stderr.read()[-1500:])
    # Evento externo NOVO surge enquanto a ativação ainda não foi commitada.
    sql("insert into public.whatsapp_outbox(barbershop_id,to_e164,template_key,body,payload,dedupe_key) select other_shop,'+5511998888777','booking.confirmed','Fixture concorrente',jsonb_build_object('customer_id',person),'fora-'||gen_random_uuid() from local_test_fixture;")
    b = subprocess.Popen(command(database), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    children.append(b)
    b.stdin.write('select count(*) from public.claim_whatsapp_outbox(5);\n')
    b.stdin.close()
    c = subprocess.Popen(command(database), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    children.append(c)
    c.stdin.write("insert into public.auth_otp_challenges(user_id,channel,destination,code_hash,purpose,expires_at) select other_person,'whatsapp','+5511998888666',repeat('a',64),'login',now()+interval '10 minutes' from local_test_fixture;\n")
    c.stdin.close()
    time.sleep(0.15)
    assert b.poll() is None and c.poll() is None, 'Emissores devem aguardar a trava de ativação'
    assert a.wait(timeout=20) == 0, a.stderr.read()
    assert b.wait(timeout=20) == 0 and b.stdout.read().strip() == '0', b.stderr.read()
    assert c.wait(timeout=20) != 0 and 'WA_SENDING_PAUSED' in c.stderr.read()
    assert sql("select count(*)=1 and bool_and(status='pending' and lease_token is null and attempts=0) from public.whatsapp_outbox where body='Fixture concorrente';").stdout.strip() == 't'
    assert sql("select count(*)=0 from public.auth_otp_challenges where channel='whatsapp';").stdout.strip() == 't'
    print('PASS: evento externo novo durante ativação não é reclamado nem licenciado; OTP concorrente externo é recusado')
    print('PASS: duas conexões físicas aguardam o COMMIT atômico e observam o isolamento já ativo')
    assert sql("select public.whatsapp_pilot_context_allows(shop,person) and not public.whatsapp_pilot_context_allows(other_shop,person) from local_test_fixture;").stdout.strip() == 't'
    current = json.loads(sql('begin;' + auth + "select public.care_pilot_admin('read');commit;").stdout.splitlines()[-1])
    pause_args = {**args, 'policy_version': current['policy_version'], 'pause_version': current['pause_version']}
    sql('begin;' + auth + "select public.care_pilot_admin('pause','" + json.dumps(pause_args) + "'::jsonb);commit;")
    assert sql("select (select paused from public.whatsapp_send_controls where scope='global') and not enabled and not assisted_access_enabled and pilot_isolation_required from public.whatsapp_care_cycle_policy;").stdout.strip() == 't'
    print('PASS: pausa conjunta posterior conserva o bloqueio dos eventos externos')
finally:
    for p in children:
        if p.poll() is None:
            p.terminate()
            p.wait(timeout=10)
    # Só elimina o banco descartável criado e nomeado por este processo.
    subprocess.run(['docker', 'exec', CONTAINER, 'dropdb', '-U', 'postgres', '--if-exists', '--force', database], check=True, capture_output=True)
    print('Banco de concorrência descartável removido; bancada original preservada')
