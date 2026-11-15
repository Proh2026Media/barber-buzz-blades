#!/usr/bin/env python3
from pathlib import Path
import json,subprocess,uuid,os
import argparse
parser=argparse.ArgumentParser(description='Ensaia o pacote só na segunda bancada local D0 limpa, porta 54341, já preparada; não lê .env.')
parser.add_argument('--pacote',required=True,type=Path)
stage=parser.parse_args().pacote.resolve();container='barba-central-pacote-local'
assert not os.environ.get('DOCKER_HOST')
assert subprocess.check_output(['docker','context','inspect','--format','{{.Endpoints.docker.Host}}'],text=True).strip().startswith('unix://')
meta=json.loads(subprocess.check_output(['docker','inspect',container],text=True))[0]
assert meta['Name']=='/'+container and any(p['HostPort']=='54341' for p in meta['HostConfig']['PortBindings']['5432/tcp'])
def sql(s):return subprocess.check_output(['docker','exec','-i',container,'psql','-XqAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],input=s,text=True).strip()
def operador(action,*args,ok=True):
 r=subprocess.run(['python3',str(stage/'operacao/central_whatsapp_operacao.py'),action,'--pacote',str(stage),'--db',container,'--autorizado',*args],capture_output=True,text=True)
 assert (r.returncode==0)==ok,(action,r.stdout,r.stderr)
 return r.stdout.strip()
sql((stage/'operacao/pausar.sql').read_text())
operador('sql-bc')
print('PASS: operador B&C aplicou os 14 incrementais atomicamente na base D0 limpa',flush=True)
operador('sql-bc',ok=False)
assert sql('select (not enabled)::text from public.whatsapp_care_cycle_policy;')=='true'
print('PASS: reaplicação B&C recusada sem alterar política ou forjar ledger',flush=True)
sql('create schema evolution_api;')
for name in ['20261111190000_bc_group_operations','20261111220000_bc_group_codes']:
 sql('set search_path=evolution_api;'+(stage/'evolution/fonte/prisma/postgresql-migrations'/name/'migration.sql').read_text())
operador('sql-evolution')
assert sql("select count(*) from information_schema.tables where table_schema='evolution_api' and table_name like 'Bc%';")=='6'
operador('sql-evolution',ok=False)
print('PASS: incremental Evolution aplica só a terceira migration no schema correto; repetição recusada',flush=True)
person=str(uuid.uuid4())
shop=json.loads(sql("set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';select public.register_my_barbershop(gen_random_uuid(),'Piloto Fictício','America/Sao_Paulo','single',true,'teste','teste','teste');")).get('shop_id')
sql(f"insert into auth.users(id,email,raw_user_meta_data) values('{person}','{person}@example.invalid','{{}}');insert into public.memberships(user_id,barbershop_id,role) values('{person}','{shop}','customer');")
operador('piloto','--shop',shop,'--cliente',person)
assert sql(f"select (not enabled and pilot_shop_id='{shop}' and pilot_customer_id='{person}')::text from public.whatsapp_care_cycle_policy;")=='true'
print('PASS: operador configura piloto restrito sem ativar grupos ou mensagens',flush=True)
