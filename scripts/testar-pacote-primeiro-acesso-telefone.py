#!/usr/bin/env python3
"""Instalação/retorno reais só em Docker local descartável; digests remotos são fixtures, nunca consultados."""
import argparse,hashlib,json,os,shutil,subprocess,tempfile,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--pacote',required=True,type=Path);a=p.parse_args();stage=a.pacote.resolve()
docker=shutil.which('docker')
if os.environ.get('DOCKER_HOST') or not subprocess.check_output([docker,'context','inspect','--format','{{.Endpoints.docker.Host}}'],text=True).strip().startswith('unix://'):raise SystemExit('Somente Docker Unix local')
subprocess.run(['python3','scripts/testar-acolhimento-apos-entrada.py','--preparar'],check=True)
subprocess.run(['python3','scripts/testar-singletons-safeupdate.py'],check=True)
cmd=[docker,'exec','-i','barba-central-d1-local','psql','-XqAt','-v','ON_ERROR_STOP=1','-U','postgres']
def sql(text,ok=True):
 r=subprocess.run(cmd,input=text,text=True,capture_output=True)
 assert (r.returncode==0)==ok,r.stderr
 return r.stdout.strip()
# Mesma composição/identidade da suíte, antes da revisão. Preserva grupo existente na instalação.
setup=(ROOT/'supabase/tests/whatsapp_revisao_telefone_protegida.sql').read_text().split('create function pg_temp.denied')[0]
setup+='''update public.whatsapp_care_cycles set group_jid='456789-123456@g.us',created_at=now()-interval '1 day',expires_at=now()+interval '364 days',admission_id=gen_random_uuid() where id=(select cycle from d4);
update public.whatsapp_care_groups set group_jid='456789-123456@g.us',notifications=true where id=(select grp from d4);
update public.whatsapp_care_cycle_policy set enabled=false;
update public.whatsapp_send_controls set paused=true where scope='global';
select jsonb_build_object('cycle',cycle,'group',grp,'person',person,'shop',shop) from d4;commit;
'''
info=json.loads(next(v for v in reversed(sql(setup).splitlines()) if v.startswith('{')))
query="select jsonb_build_object('cycle',to_jsonb(c),'group',to_jsonb(g),'profile',to_jsonb(p)) from public.whatsapp_care_cycles c join public.whatsapp_care_groups g on g.id=c.group_id join public.profiles p on p.id=g.customer_id where c.id='%s';"%info['cycle']
before=json.loads(sql(query));manifest=json.loads((stage/'MANIFESTO.json').read_text())
atomic=(stage/'operacao/bc-atomico.sql').read_text()
sql(atomic.rsplit('commit;',1)[0]+"do $$begin raise exception 'falha fictícia no fim';end $$;commit;",ok=False)
assert sql("select to_regclass('public.whatsapp_care_access') is null and to_regclass('public.whatsapp_phone_revisions') is null;")=='t'
assert json.loads(sql(query))==before
print('PASS: falha tardia desfaz ambos os incrementais e conserva dados existentes',flush=True)
owned=None;name='bc-telefone-edge-local-'+uuid.uuid4().hex[:8]
with tempfile.TemporaryDirectory(prefix='bc-pacote-telefone-') as tmp:
 root=Path(tmp);target=root/'funcoes';backup=root/'backup';shim=root/'bin';shim.mkdir();evidence=root/'imagem.json'
 pinned='ghcr.io/proh2026media/bc-evolution-groups@sha256:'+'c'*64
 evidence.write_text(json.dumps({'pinned':pinned,'version':'2.3.7-bc.groups.7'}))
 # Não substitui Docker para banco/cópia; só respostas exatas dos dois nomes de imagem fictícios.
 script='''#!/usr/bin/env python3
import json,os,subprocess,sys
args=sys.argv[1:]
if args==['inspect','--format','{{.Image}}','evo-base-ficticia']:print('sha256:'+'a'*64)
elif args==['inspect','--format','{{.Image}}','evo-nova-ficticia']:print('sha256:'+'b'*64)
elif args==['inspect','--format','{{index .Config.Labels "org.opencontainers.image.version"}}','evo-nova-ficticia']:print('2.3.7-bc.groups.7')
elif args==['image','inspect','--format','{{json .RepoDigests}}','sha256:'+'a'*64]:print(json.dumps(['ghcr.io/proh2026media/bc-evolution-groups@sha256:bb66b337063aa3fb82500642d0e332ff32f94a6a04692d1652b016ca735c9f3e']))
elif args==['image','inspect','--format','{{json .RepoDigests}}','sha256:'+'b'*64]:print(json.dumps(['ghcr.io/proh2026media/bc-evolution-groups@sha256:'+'c'*64]))
else:sys.exit(subprocess.call([os.environ['BC_DOCKER_REAL'],*args]))
'''
 (shim/'docker').write_text(script);(shim/'docker').chmod(0o700)
 env=dict(os.environ,BC_DOCKER_REAL=docker,PATH=str(shim)+os.pathsep+os.environ['PATH'])
 for path,expected in manifest['base_funcoes'].items():
  if expected is None:continue
  data=(stage/'base/funcoes'/path).read_bytes();assert hashlib.sha256(data).hexdigest()==expected
  dest=target/path;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
 def operator(action,*args,ok=True):
  evo='evo-nova-ficticia' if action=='funcoes' else 'evo-base-ficticia'
  r=subprocess.run(['python3',str(stage/'operacao/primeiro_acesso_telefone_operacao.py'),action,'--pacote',str(stage),'--funcoes',str(target),'--db','barba-central-d1-local','--evolution',evo,'--evidencia-imagem',str(evidence),*args],env=env,capture_output=True,text=True)
  assert (r.returncode==0)==ok,r.stdout+r.stderr
  return r.stdout.strip()
 try:
  operator('conferir');operator('base');operator('sql-bc',ok=False);operator('sql-bc','--autorizado')
  assert json.loads(sql(query))==before
  operator('sql-bc','--autorizado',ok=False)
  print('PASS: operador/base/hashs/SQL atômico executados; JID, ano, admissão, telefone, preferências e perfil preservados; reaplicação recusada',flush=True)
  owned=subprocess.check_output([docker,'create','--pull=never','--name',name,'--entrypoint','/bin/true','supabase/postgres:15.8.1.085'],text=True).strip()
  common=['--edge',name,'--backup',str(backup),'--autorizado']
  operator('funcoes',*common)
  for path in manifest['base_funcoes']:assert (target/path).read_bytes()==(stage/'funcoes'/path).read_bytes()
  operator('restaurar-funcoes',*common)
  for path,expected in manifest['base_funcoes'].items():
   assert (not (target/path).exists()) if expected is None else hashlib.sha256((target/path).read_bytes()).hexdigest()==expected
  print('PASS: cópia e retorno reais restauram exatamente os arquivos, incluindo ausência das funções novas',flush=True)
  backup2=root/'backup2';operator('funcoes','--edge',name,'--backup',str(backup2),'--autorizado')
  sql("insert into public.whatsapp_phone_revisions(customer_id,barbershop_id,group_id,cycle_id,cycle_revision,old_admission_id,old_phone,declared_phone,numbers) select g.customer_id,g.barbershop_id,g.id,c.id,c.revision,c.admission_id,c.customer_phone,'+5511998888777',c.consented_numbers from public.whatsapp_care_groups g join public.whatsapp_care_cycles c on c.id=g.current_cycle_id where c.id='%s';"%info['cycle'])
  operator('restaurar-funcoes','--edge',name,'--backup',str(backup2),'--autorizado',ok=False)
  assert sql('select (not enabled and not assisted_access_enabled)::text from public.whatsapp_care_cycle_policy;')=='true'
  print('PASS: revisão iniciada bloqueia retorno cego; políticas e tráfego permanecem pausados',flush=True)
 finally:
  if owned:subprocess.run([docker,'rm','-f',owned],check=True,stdout=subprocess.DEVNULL)
