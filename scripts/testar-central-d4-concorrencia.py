#!/usr/bin/env python3
"""Duas conexões reais, somente na bancada descartável B&C; sem .env nem produção."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json,os,subprocess
ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)
if os.environ.get('DOCKER_HOST'):raise SystemExit('Somente Docker local')
if not subprocess.check_output(['docker','context','inspect','--format','{{.Endpoints.docker.Host}}'],text=True).strip().startswith('unix://'):raise SystemExit('Somente Docker Unix local')
meta=json.loads(subprocess.check_output(['docker','inspect','barba-central-d1-local'],text=True))[0]
assert meta['Name']=='/barba-central-d1-local'
assert any(p.get('HostPort')=='54339' for p in meta['HostConfig']['PortBindings'].get('5432/tcp',[]))
cmd=['docker','exec','-i','barba-central-d1-local','psql','-XqAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres']
def sql(s):return subprocess.check_output(cmd,input="set statement_timeout='10s';set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';set request.jwt.claim.role='service_role';"+s,text=True,stderr=subprocess.PIPE,timeout=15).strip()
setup=(ROOT/'supabase/tests/whatsapp_ciclos_protegidos.sql').read_text().split('update d4 set job=public.claim_care_cycle(cycle);')[0]
setup=setup.replace('begin;','begin;update public.whatsapp_care_cycle_policy set enabled=false;',1).replace("'+5511800000111'","'+5511800090111'").replace("'+5511800000222'","'+5511800090222'").replace("'+5511999999999'","'+5511999909999'")
setup=setup.replace('select public.platform_plan_whatsapp_distribution(plan,array[shop],false) from d4;\nselect public.platform_apply_whatsapp_distribution(plan) from d4;',"select public.platform_set_whatsapp_route(shop,null,0,a,b,null,'primary',false,false,false) from d4;")
info=json.loads(sql(setup+"select jsonb_build_object('cycle',cycle,'shop',shop,'a',a,'b',b,'grp',grp) from d4;commit;").splitlines()[-1])
cycle=info['cycle'];group=info['grp'];instance='bc-'+info['a']
with ThreadPoolExecutor(max_workers=2) as pool:
 results=list(pool.map(sql,[f"begin;select public.claim_care_cycle('{cycle}');select pg_sleep(0.25);commit;"]*2))
jobs=[json.loads(line) for result in results for line in result.splitlines() if line.startswith('{')]
assert len(jobs)==1,'Somente uma conexão pode tomar a posse';job=jobs[0];token=job['token']
print('PASS: duas conexões disputam ciclo; somente uma recebe a posse',flush=True)
sql(f"update public.whatsapp_care_cycles set group_jid='99887766-9090@g.us' where id='{cycle}';")
query=f"begin;select public.start_care_cycle_step('{cycle}','{token}','prepare','race','{instance}',repeat('a',64));select pg_sleep(0.25);commit;"
with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(sql,[query,query]))
steps=[json.loads(line) for result in results for line in result.splitlines() if line.startswith('{')]
assert len(steps)==2 and len(set(s['id'] for s in steps))==1 and sum(s['execute'] for s in steps)==1
print('PASS: disputa da mesma etapa conserva nonce; somente uma licença de efeito',flush=True)
version=sql(f"select version from public.whatsapp_care_groups where id='{group}';")
sql(f"select public.care_group_admin('pause','{{\"group_id\":\"{group}\",\"version\":{version}}}');")
try:sql(f"select public.authorize_care_cycle('{cycle}','{token}');")
except subprocess.CalledProcessError as e:assert 'GROUP_STALE' in e.stderr
else:raise AssertionError('Posse antiga continuou autorizada após pausa')
print('PASS: pausa concorrente revoga a autorização anterior, antes do transporte',flush=True)
sql('update public.whatsapp_care_cycle_policy set enabled=false;')
