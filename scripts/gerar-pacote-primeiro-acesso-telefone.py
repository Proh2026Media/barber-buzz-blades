#!/usr/bin/env python3
"""Entrega local completa e verificável. Não publica, instala ou lê .env."""
import argparse,hashlib,io,json,re,subprocess,tarfile,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--evolution',type=Path,required=True);p.add_argument('--saida',type=Path,required=True);p.add_argument('--zip',action='store_true');a=p.parse_args()
out=a.saida.resolve();evo=a.evolution.resolve()
if out.exists() or out.with_suffix('.zip').exists():raise SystemExit('Escolha uma entrega nova; não sobrescrever evidências')

def git(root,*args):return subprocess.check_output(['git','-C',str(root),*args],stderr=subprocess.DEVNULL)
def sha(data):return hashlib.sha256(data).hexdigest()
def allowed(name):return not any(v.startswith(('.env','._','.git')) or v in ['node_modules','__pycache__'] for v in Path(name).parts)
def put(name,data):
 target=out/name
 assert allowed(name) and not Path(name).is_absolute() and '..' not in Path(name).parts
 target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data if isinstance(data,bytes) else data.encode())
def copy(path,name):put(name,path.read_bytes())
def archive(root,commit,prefix,paths=None):
 raw=git(root,'archive',commit,*(['--',*paths] if paths else []))
 with tarfile.open(fileobj=io.BytesIO(raw)) as tar:
  for member in tar.getmembers():
   if member.isfile() and allowed(member.name):put(prefix+member.name,tar.extractfile(member).read())
for root in [ROOT,evo]:
 if git(root,'diff','--name-only','HEAD').strip():raise SystemExit('Concluir commit local das fontes antes de empacotar: '+str(root))
commit=git(ROOT,'rev-parse','HEAD').decode().strip();ecommit=git(evo,'rev-parse','HEAD').decode().strip()
assert json.loads((evo/'package.json').read_text())['version']=='2.3.7-bc.groups.7'
out.mkdir(parents=True)
functions=ROOT/'supabase/functions'
entries=['platform-whatsapp','whatsapp-channel','whatsapp-dispatch','whatsapp-groups','auth-otp','whatsapp-health','whatsapp-distribution','whatsapp-group-access']
pending=[functions/n/'index.ts' for n in entries];selected=set()
while pending:
 path=pending.pop().resolve();assert path.is_relative_to(functions.resolve()) and path.is_file()
 if path in selected:continue
 selected.add(path)
 for rel in re.findall(r'(?:from\s*|import\s*)["\'](\.[^"\']+\.ts)["\']',path.read_text()):pending.append((path.parent/rel).resolve())
base={};base_commit='ad66022950b0e747fa36dcc6cbf0492efbe9c470'
rawrefs=ROOT/'integrations/estado-instalado-p122-2026-11-15/marca/edge-hotfix/funcoes'
for path in sorted(selected):
 name=path.relative_to(functions.resolve()).as_posix();copy(path,'funcoes/'+name)
 try:old=(rawrefs/(name+'.txt')).read_bytes() if (rawrefs/(name+'.txt')).is_file() else git(ROOT,'show',base_commit+':supabase/functions/'+name)
 except subprocess.CalledProcessError:old=None
 base[name]=None if old is None else sha(old)
 if old is not None:put('base/funcoes/'+name,old)
assert base['_shared/care-cycles.ts']=='d815b844befe027af64965865410d8fd901b13dd123d687195d1c4121e0d9b82'
assert base['_shared/care-group-content.ts']=='189d2f721db7c72bd9d23777e371cbeefdc7a2c3aab7893551270348a38b2e74'
names=['20261115002000_whatsapp_primeiro_acesso_assistido.sql','20261115003000_whatsapp_revisao_telefone_protegida.sql']
ops=ROOT/'scripts/ti/primeiro-acesso-telefone'
for path in ops.iterdir():
 if path.is_file():copy(path,'operacao/'+('evolution/' if path.name=='publicar-imagem.py' else '')+path.name)
for name in ['primeiro_acesso_telefone_operacao.py','test_primeiro_acesso_telefone_operacao.py']:copy(ROOT/'scripts/ti'/name,'operacao/'+name)
for name in names:copy(ROOT/'supabase/migrations'/name,'banco-bc/'+name)
put('operacao/bc-atomico.sql',"begin;set local lock_timeout='5s';set local statement_timeout='90s';\n"+(ops/'precondicoes-bc.sql').read_text()+'\n'+''.join((ROOT/'supabase/migrations'/name).read_text()+'\n' for name in names)+(ops/'poscondicoes-bc.sql').read_text()+'\ncommit;\n')
archive(evo,'HEAD','evolution/fonte/')
put('evolution/evolution-bc-groups.patch',git(evo,'diff','--binary','db5c51b57047beaac1bb83fd8b951bf152bb5d64','HEAD'))
put('evolution/incremental-6-brand.1-para-7.patch',git(evo,'diff','--binary','ad88eae','HEAD'))
copy(ROOT/'integrations/evolution/grupos-v7/README.md','evolution/README.md')
paths=['src','public','supabase','scripts','integrations/compatibilidade-central-whatsapp-2026-11-13','package.json','bun.lock','package-lock.json','tsconfig.json','vite.config.ts','eslint.config.js','components.json','postcss.config.js','index.html']
tracked=git(ROOT,'ls-files','--',*paths).decode().splitlines()
for name in tracked:
 if allowed(name) and (ROOT/name).is_file():copy(ROOT/name,'bancada/'+name)
frontend=['src','public','package.json','bun.lock','package-lock.json','tsconfig.json','vite.config.ts','components.json','postcss.config.js','index.html','scripts/copy-pwa.mjs']
put('frontend/e5f3ec0-para-entrega.patch',git(ROOT,'diff','--binary','e5f3ec0a67d2302d0029c61c2eef6fa0a147f996','HEAD','--',*frontend))
copy(ROOT/'docs/pacotes/2026-11-15-ti-primeiro-acesso-telefone-p122.md','LEIA-PRIMEIRO.md')
copy(ROOT/'docs/pacotes/2026-11-15-p122-telefone-concluido-local.md','evidencias/resultado-local.md')
copy(ROOT/'docs/validacoes/primeiro-acesso-telefone-2026-11-15.json','evidencias/verificacoes.json')
copy(ROOT/'integrations/estado-instalado-p122-2026-11-15/ESTADO-RELATADO.json','base/ESTADO-RELATADO.json')
put('COMMIT.txt','B&C '+commit+'\nEvolution '+ecommit+'\n')
put('BASE.txt','B&C: backend ad660229 + hotfixes brutos d815b844/189d2f72; acolhimento e safeupdate já instalados.\nFrontend publicado: e5f3ec0a67d2302d0029c61c2eef6fa0a147f996.\nEvolution instalada: 2.3.7-bc.groups.6-brand.1 / protocolo v4.\nBase oficial da fonte completa: cd800f2976e1e5b682fbf86a01ee4d85ae61f370 (snapshot local db5c51b57047beaac1bb83fd8b951bf152bb5d64).\nSomente novas SQL B&C 02000 e 03000, na mesma transação; ZERO migrations Evolution novas.\nPacote para revisão; não autoriza produção, piloto, envio ou push.\n')
manifest={'contrato':'p122-primeiro-acesso-telefone-v1','commit':commit,'evolution_commit':ecommit,'evolution_version':'2.3.7-bc.groups.7','protocol':'bc-groups-v4','capability':'protectedPhoneRevision','base_funcoes':base,'migrations_bc':names,'migrations_evolution_novas':[],'frontend_novo':True,'piloto_homologado':False,'arquivos':{f.relative_to(out).as_posix():sha(f.read_bytes()) for f in sorted(out.rglob('*')) if f.is_file()}}
put('MANIFESTO.json',json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
put('SHA256SUMS',''.join(sha(f.read_bytes())+'  '+f.relative_to(out).as_posix()+'\n' for f in sorted(out.rglob('*')) if f.is_file()))
if a.zip:
 target=out.with_suffix('.zip')
 with zipfile.ZipFile(target,'x',zipfile.ZIP_DEFLATED) as z:
  for path in sorted(out.rglob('*')):
   if path.is_file():z.write(path,Path(out.name)/path.relative_to(out))
 print(str(target));print('SHA-256:',sha(target.read_bytes()))
else:print('Entrega para conferência local:',out)
