#!/usr/bin/env python3
"""Reproduz base D0 + contrato D1 exclusivamente em PostgreSQL descartável local.

--preparar recria SOMENTE barba-central-d1-local (porta 54339). Sem a opção, apenas
roda testes na bancada já existente. Não lê .env nem acessa a VPS/Evolution.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[1]
CONTAINER = 'barba-central-d1-local'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--preparar', action='store_true')
args = parser.parse_args()
os.chdir(ROOT)


def psql(data, atomic=False, check=True):
    command = ['docker','exec','-i',CONTAINER,'psql','-Xq','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres']
    if atomic:
        command.append('-1')
    result = subprocess.run(command,input=data,capture_output=True,timeout=60)
    if check and result.returncode:
        raise SystemExit(result.stderr.decode())
    return result


if args.preparar:
    env = dict(os.environ,BC_BANCO_LOCAL_NOME=CONTAINER,BC_BANCO_LOCAL_PORTA='54339')
    subprocess.run(['bash','scripts/banco-local.sh','subir','20261112232000'],env=env,check=True)
    archive=ROOT/'integrations/compatibilidade-central-whatsapp-2026-11-13'
    manifest=json.loads((archive/'MANIFESTO.json').read_text())
    for item in sorted(manifest['arquivos'], key=lambda row: row['caminho_original']):
        if not item['caminho_original'].startswith('supabase/migrations/'):
            continue
        data=(archive/item['arquivo']).read_bytes()
        assert hashlib.sha256(data).hexdigest()==item['sha256']
        assert (ROOT/item['caminho_original']).read_bytes()==data
    evidence=psql(b"select md5(pg_get_functiondef('public.platform_whatsapp_directory()'::regprocedure));").stdout.decode()
    assert '65502cdc1d40c2ed2b964c1f0c178601' in evidence
    increments=sorted((ROOT/'supabase/migrations').glob('2026111300[12345]000_*.sql'))
    assert len(increments)==5
    data=b'\n'.join(p.read_bytes() for p in increments)
    fixture=str(uuid.uuid4())
    psql(f"insert into public.barbershops(id,name,slug) values('{fixture}','Fixture de migração','migration-{fixture}'); insert into public.whatsapp_outbox(barbershop_id,to_e164,template_key,body,dedupe_key,status) values('{fixture}','+5511999999999','customer.notice','Fixture sem transmissão','migration-{fixture}','sending');".encode())
    blocked=psql(data,True,False)
    assert blocked.returncode and b'BC_DELIVERY_IN_FLIGHT' in blocked.stderr
    rolled=psql(b"select md5(pg_get_functiondef('public.platform_whatsapp_directory()'::regprocedure)); select exists(select 1 from information_schema.columns where table_schema='public' and table_name='whatsapp_number_links' and column_name='backup_channel_id');").stdout.decode()
    assert '65502cdc1d40c2ed2b964c1f0c178601' in rolled and ' f' in rolled,rolled
    psql(f"delete from public.whatsapp_outbox where barbershop_id='{fixture}';delete from public.barbershops where id='{fixture}';".encode())
    print('PASS: envio em andamento bloqueia implantação e desfaz todos os incrementais da transação')
    psql(data,True)
    print('PASS: base D0 conferida; cinco incrementais novos aplicados atomicamente só na bancada')

for test in ['whatsapp_tres_posicoes','whatsapp_distribuicao','whatsapp_atividade','whatsapp_atividade_grupos','whatsapp_historico']:
    # Estes cinco ensaios abrem e desfazem a própria transação.
    r=psql((ROOT/'supabase/tests'/f'{test}.sql').read_bytes())
    print(r.stderr.decode().strip())
subprocess.run(['python3','scripts/testar-central-d1-concorrencia.py'],check=True)
