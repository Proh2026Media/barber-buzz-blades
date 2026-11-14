#!/usr/bin/env python3
"""Duas conexões reais, apenas no container de testes da Central."""
from concurrent.futures import ThreadPoolExecutor
import json
import subprocess
import threading
import uuid
CONTAINER='barba-central-d1-local'
ADMIN='11111111-1111-4111-8111-111111111111'
AUTH=f"select set_config('request.jwt.claim.sub','{ADMIN}',false);"
def sql(s,check=True):
 p=subprocess.run(['docker','exec','-i',CONTAINER,'psql','-XqAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],input="set statement_timeout='10s';set lock_timeout='7s';"+s,text=True,capture_output=True,timeout=15)
 if check and p.returncode:raise RuntimeError(p.stderr)
 return p
def race(a,b):
 barrier=threading.Barrier(2)
 def run(s):
  barrier.wait(timeout=5)
  return sql('begin;'+AUTH+s+";select pg_sleep(0.15);commit;",False)
 with ThreadPoolExecutor(max_workers=2) as p:
  x=p.submit(run,a);y=p.submit(run,b);return x.result(),y.result()
shops=[];numbers=[str(uuid.uuid4()) for _ in range(3)];plans=[str(uuid.uuid4()) for _ in range(2)]
quoted=','.join("'"+v+"'::uuid" for v in numbers)
original_policy=json.loads(sql('select row_to_json(p) from public.whatsapp_distribution_policy p;').stdout.splitlines()[-1])
original_global=json.loads(sql("select row_to_json(p) from public.whatsapp_send_controls p where scope='global';").stdout.splitlines()[-1])
try:
 sql(f"begin;{AUTH}update public.whatsapp_distribution_policy set enabled=false;update public.whatsapp_send_controls set paused=false where scope='global';"+''.join(f"select public.platform_create_whatsapp_channel('{n}','Concorrência D3');update public.whatsapp_channels set status='open',display_phone='+5511810000{index:03}' where id='{n}';select public.platform_confirm_whatsapp_control(id,routing_version,display_phone,instance_name,true) from public.whatsapp_channels where id='{n}';" for index,n in enumerate(numbers))+"commit;")
 for _ in range(2):
  shops.append(sql(AUTH+"select public.register_my_barbershop(gen_random_uuid(),'Concorrência D3','America/Sao_Paulo','single',true,'teste','teste','teste')->>'shop_id';").stdout.splitlines()[-1])
 for p in plans:sql(AUTH+f"select public.platform_plan_whatsapp_distribution('{p}',array['{shops[0]}'::uuid],true);")
 results=race(*[f"select public.platform_apply_whatsapp_distribution('{p}')" for p in plans])
 assert sum(r.returncode==0 for r in results)==1,[r.stderr for r in results]
 assert any('WA_PLAN_STALE' in r.stderr for r in results)
 print('PASS: propostas concorrentes não sobrescrevem composição aplicada')
 winner=plans[0] if results[0].returncode==0 else plans[1]
 results=race(*[f"select public.platform_apply_whatsapp_distribution('{winner}')"]*2)
 assert all(r.returncode==0 for r in results),[r.stderr for r in results]
 assert sql(f"select count(*) from public.whatsapp_number_links where barbershop_id='{shops[0]}';").stdout.strip()=='1'
 print('PASS: duas reentregas do mesmo plano não duplicam vínculo ou efeito')
 sql('update public.whatsapp_distribution_policy set enabled=true;')
 requests=[str(uuid.uuid4()) for _ in range(2)]
 commands=[f"select public.register_my_barbershop('{r}','Cadastro concorrente D3','America/Sao_Paulo','single',true,'teste','teste','teste')" for r in requests]
 results=race(*commands)
 assert all(r.returncode==0 for r in results),[r.stderr for r in results]
 for r in requests:shops.append(sql(f"select result->>'shop_id' from public.shop_registration_requests where user_id='{ADMIN}' and request_id='{r}';").stdout.strip())
 ids=','.join("'"+s+"'::uuid" for s in shops[2:])
 assert sql(f"select count(*) from public.whatsapp_number_links where barbershop_id in({ids}) and backup_channel_id is not null and not enabled;").stdout.strip()=='2'
 print('PASS: cadastros concorrentes atribuem par sem duplicar ou ativar envios')
 results=race(*[commands[0]]*2)
 assert all(r.returncode==0 for r in results)
 assert sql(f"select count(*) from public.whatsapp_number_links where barbershop_id='{shops[2]}';").stdout.strip()=='1'
 print('PASS: repetição concorrente do cadastro conserva loja e atribuição originais')
finally:
 ids=','.join("'"+s+"'::uuid" for s in shops) or 'null'
 sql(f"begin;delete from public.whatsapp_distribution_plans where id in('{plans[0]}','{plans[1]}');delete from public.whatsapp_number_link_history where channel_id in({quoted});delete from public.whatsapp_number_links where barbershop_id in({ids});delete from public.whatsapp_number_config_history where channel_id in({quoted});delete from public.whatsapp_channels where id in({quoted});delete from public.whatsapp_activity_daily_history where channel_id in({quoted});delete from public.whatsapp_number_history where channel_id in({quoted});delete from public.shop_registration_requests where (result->>'shop_id')::uuid in({ids});delete from public.barbershops where id in({ids});update public.whatsapp_distribution_policy set enabled={'true' if original_policy['enabled'] else 'false'};update public.whatsapp_send_controls set paused={'true' if original_global['paused'] else 'false'} where scope='global';commit;")
