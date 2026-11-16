#!/usr/bin/env python3
"""Empacota fonte Git verificada: uma SQL de leitura, operador e frontend. Não publica."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import zipfile

ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--destino',type=Path,required=True)
a=p.parse_args()
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,stderr=subprocess.DEVNULL)
source=git('rev-parse','HEAD').decode().strip()
base=git('rev-parse','b063019').decode().strip()
assert not git('status','--porcelain','--untracked-files=no').strip(),'Salve as fontes verificadas antes de empacotar'
files=git('diff','--name-only',base,source).decode().splitlines()
assert files and all(not f.startswith(('.env','.git','node_modules')) and '..' not in Path(f).parts for f in files)
a.destino.mkdir(parents=True,exist_ok=True)
name='BC-P122-Conferencia-Automatica-2026-11-16'
out=a.destino/(name+'.zip')
assert not out.exists(),'Não sobrescrever pacote já entregue'
with tempfile.TemporaryDirectory(prefix='bc-conferencia-pacote-') as tmp:
 root=Path(tmp)/name;root.mkdir()
 def write(relative,data):
  path=root/relative;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
 for f in files:
  if f.startswith('docs/') and not f.startswith(('docs/pacotes/2026-11-16-ti-conferencia-automatica','docs/validacoes/conferencia-automatica-p122-local')):continue
  write(f,git('show',source+':'+f))
 write('COMMIT.txt',(source+'\n').encode())
 write('BASE.txt',(base+'\n').encode())
 write('frontend.patch',git('diff','--binary',base,source,'--','src','package.json'))
 write('README.md',git('show',source+':docs/pacotes/2026-11-16-ti-conferencia-automatica-p122.md'))
 write('operacao/conferencia_piloto_operacao.py',git('show',source+':scripts/ti/conferencia_piloto_operacao.py'))
 write('operacao/contrato.json',git('show',source+':scripts/ti/conferencia-piloto/contrato.json'))
 write('referencias/platform-whatsapp-ja-instalado.ts',git('show',source+':supabase/functions/platform-whatsapp/index.ts'))
 write('referencias/sql04000-ja-instalada.sql',git('show',source+':supabase/migrations/20261115004000_whatsapp_piloto_liberacao_atomica.sql'))
 entries=[{'path':f.relative_to(root).as_posix(),'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in sorted(root.rglob('*')) if f.is_file()]
 manifest={'contract':'bc-pilot-check-package-v1','source_commit':source,'base_commit':base,'production_authorized':False,'files':entries}
 write('MANIFESTO.json',(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode())
 entries.append({'path':'MANIFESTO.json','sha256':hashlib.sha256((root/'MANIFESTO.json').read_bytes()).hexdigest()})
 write('SHA256SUMS',(''.join(e['sha256']+'  '+e['path']+'\n' for e in entries)).encode())
 for e in entries:assert hashlib.sha256((root/e['path']).read_bytes()).hexdigest()==e['sha256']
 with zipfile.ZipFile(out,'x',zipfile.ZIP_DEFLATED) as z:
  for f in sorted(root.rglob('*')):
   if f.is_file():z.write(f,Path(name)/f.relative_to(root))
print(json.dumps({'file':str(out),'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'source':source,'base':base,'files':len(entries)+1}))
