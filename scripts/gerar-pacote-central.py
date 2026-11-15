#!/usr/bin/env python3
"""Monta uma entrega LOCAL, sem publicar, instalar, ler .env ou chamar servidores.
Uso: python3 scripts/gerar-pacote-central.py --evolution COPIA --saida PASTA_NOVA
"""
import argparse,hashlib,io,json,re,subprocess,tarfile,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='8b6898b9c0d3031087d05f243a8430daf3e7512f'
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--evolution',type=Path,required=True);p.add_argument('--saida',type=Path,required=True);p.add_argument('--zip',action='store_true');a=p.parse_args()
out=a.saida.resolve();assert not out.exists(),'Pasta de saída já existe';out.mkdir(parents=True)
def put(name,data):
 f=out/name;assert f.resolve().is_relative_to(out);f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(data if isinstance(data,bytes) else data.encode())
def copy(src,name):put(name,src.read_bytes())
def git(*args):return subprocess.check_output(['git','-C',str(ROOT),*args],stderr=subprocess.DEVNULL)
def sha(data):return hashlib.sha256(data).hexdigest()
# Integridade não depende do .env: seleção explícita de fontes e dependências relativas.
entries=['platform-whatsapp/index.ts','whatsapp-channel/index.ts','whatsapp-dispatch/index.ts','whatsapp-groups/index.ts','auth-otp/index.ts','whatsapp-health/index.ts','whatsapp-distribution/index.ts']
functions=ROOT/'supabase/functions';pending=[functions/n for n in entries];selected=set()
while pending:
 f=pending.pop().resolve();assert f.is_relative_to(functions.resolve()) and f.is_file()
 if f in selected:continue
 selected.add(f)
 for rel in re.findall(r'(?:from\s*|import\s*)[\"\'](\.[^\"\']+\.ts)[\"\']',f.read_text()):pending.append((f.parent/rel).resolve())
known={}
reference=ROOT/'integrations/compatibilidade-central-whatsapp-2026-11-13'
for item in json.loads((reference/'MANIFESTO.json').read_text())['arquivos']:
 name=item['caminho_original']
 if name.startswith('supabase/functions/'):known[name.removeprefix('supabase/functions/')]=item['sha256']
known.update(json.loads((reference/'BASE-FUNCOES-D0.json').read_text())['arquivos'])
base_functions={};provenance={}
for f in sorted(selected):
 name=f.relative_to(functions.resolve()).as_posix();copy(f,'funcoes/'+name)
 if name in known:before=known[name];provenance[name]='relatório D0 / referência instalada'
 else:
  try:before=sha(git('show',BASE+':supabase/functions/'+name));provenance[name]='fonte main 8b6898b; conferir hash na VPS antes de trocar'
  except subprocess.CalledProcessError:before=None;provenance[name]='arquivo novo; recusar colisão na VPS'
 assert before is None or re.fullmatch('[a-f0-9]{64}',before),name
 base_functions[name]=before
migrations=sorted((ROOT/'supabase/migrations').glob('2026111300[12345]000_*.sql'))+sorted((ROOT/'supabase/migrations').glob('2026111400[123456789]000_*.sql'))
assert len(migrations)==14
for f in migrations:copy(f,'banco-bc/'+f.name)
ops=ROOT/'scripts/ti/central-whatsapp'
for f in ops.iterdir():
 if f.is_file():copy(f,'operacao/'+f.name)
copy(ROOT/'scripts/ti/central_whatsapp_operacao.py','operacao/central_whatsapp_operacao.py');copy(ROOT/'scripts/ti/test_central_whatsapp_operacao.py','operacao/test_central_whatsapp_operacao.py')
put('operacao/bc-atomico.sql',"begin;set local lock_timeout='5s';set local statement_timeout='90s';\n"+(ops/'precondicoes-bc.sql').read_text()+'\n'+'\n'.join(f.read_text() for f in migrations)+'\n'+(ops/'poscondicoes-bc.sql').read_text()+'\ncommit;\n')
new_evo=a.evolution/'prisma/postgresql-migrations/20261114003000_bc_group_cycles/migration.sql'
assert new_evo.is_file()
put('operacao/evolution-incremental.sql','''begin;set local lock_timeout='5s';set local statement_timeout='60s';set local search_path=evolution_api,pg_catalog;
do $$begin
 if to_regclass('evolution_api."BcGroupOperation"') is null or to_regclass('evolution_api."BcGroupLease"') is null then raise exception 'BC_EVOLUTION_BASE_V2_AUSENTE';end if;
 if not exists(select 1 from information_schema.columns where table_schema='evolution_api' and table_name='BcGroupOperation' and column_name='messageId') then raise exception 'BC_EVOLUTION_BASE_CODIGOS_AUSENTE';end if;
 if to_regclass('evolution_api."BcGroupCycle"') is not null then raise exception 'BC_EVOLUTION_INCREMENTAL_JA_EXISTE';end if;
end $$;
'''+new_evo.read_text()+'\ncommit;\n')
for f in (ROOT/'integrations/evolution/grupos-v5').iterdir():
 if f.is_file():copy(f,'evolution/'+f.name)
# Fonte completa da extensão, independente de branch remoto ou cópia temporária do Codex.
evo_archive=subprocess.check_output(['git','-C',str(a.evolution),'archive','HEAD'])
with tarfile.open(fileobj=io.BytesIO(evo_archive)) as tar:
 for member in tar.getmembers():
  if not member.isfile() or any(part.startswith(('.env','._','.git')) for part in Path(member.name).parts):continue
  put('evolution/fonte/'+member.name,tar.extractfile(member).read())
copy(ROOT/'docs/pacotes/2026-11-14-ti-central-whatsapp-p122.md','LEIA-PRIMEIRO.md')
for name in ['testar-central-d1-banco.py','testar-central-d1-concorrencia.py','testar-central-d23-banco.py','testar-central-d23-concorrencia.py','testar-central-d23-interface.mjs','testar-central-d4-banco.py','testar-central-d4-integrado.mts','testar-central-d4-concorrencia.py','testar-central-d5-interface.mjs','testar-central-d6-pacote.py','testar-evolution-ciclo-banco.py','testar-evolution-ciclo-imagem.py','foto.mjs','banco-local.sh','verificar.sh']:
 copy(ROOT/'scripts'/name,'bancada/scripts/'+name)
# Bancada independente: fontes/testes/base D0 completos, sem variáveis de ambiente.
for name in git('ls-files','--','src','public','supabase','integrations/compatibilidade-central-whatsapp-2026-11-13').decode().splitlines():
 if (ROOT/name).is_file() and not any(part.startswith(('.env','._','.git')) for part in Path(name).parts):copy(ROOT/name,'bancada/'+name)
for name in ['package.json','package-lock.json','tsconfig.json','vite.config.ts','eslint.config.js','components.json','postcss.config.js','scripts/copy-pwa.mjs']:
 if (ROOT/name).is_file():copy(ROOT/name,'bancada/'+name)
for name in ['docs/central-whatsapp-local-2026-11-14.md','docs/validacoes/central-whatsapp-2026-11-14.json']:
 copy(ROOT/name,'evidencias/'+Path(name).name)
front_paths=git('diff','--name-only',BASE,'HEAD','--','src','public','package.json','package-lock.json').decode().splitlines()
for name in front_paths:
 if (ROOT/name).is_file():copy(ROOT/name,'frontend/arquivos/'+name)
put('frontend/alteracoes.patch',git('diff','--binary',BASE,'HEAD','--','src','public','package.json','package-lock.json'))
commit=git('rev-parse','HEAD').decode().strip();put('COMMIT.txt',commit+'\n');put('BASE.txt','Frontend: '+BASE+'\nBackend: D0 13/11, nº 105–112/115–117 + Web Push já instalados; não reaplicar.\nEvolution instalada: 2.3.7-bc.groups.2, digest f509e931336e76536869762777961deaad8a67f12c8586f61091e825fd030a81.\nSem push, publicação, instalação ou ativação nesta entrega.\n')
files={f.relative_to(out).as_posix():sha(f.read_bytes()) for f in sorted(out.rglob('*')) if f.is_file()}
manifest={'contrato':'p122-central-v1','commit':commit,'base_frontend':BASE,'base_funcoes':base_functions,'origem_base_funcoes':provenance,'migrations_bc':[f.name for f in migrations],'arquivos':files}
put('MANIFESTO.json',json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
put('SHA256SUMS',''.join(sha(f.read_bytes())+'  '+f.relative_to(out).as_posix()+'\n' for f in sorted(out.rglob('*')) if f.is_file()))
if a.zip:
 target=out.with_suffix('.zip');assert not target.exists()
 with zipfile.ZipFile(target,'x',zipfile.ZIP_DEFLATED) as z:
  for f in sorted(out.rglob('*')):
   if f.is_file():z.write(f,Path(out.name)/f.relative_to(out))
 print(target);print('SHA-256:',sha(target.read_bytes()))
else:print('Montagem local para conferência:',out)
