#!/usr/bin/env python3
"""Constrói fonte conferida. Só publica com ação explícita e autorização da janela."""
import argparse, hashlib, importlib.util, json, os, re, subprocess, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
# No pacote, ROOT=operacao; no repositório este script é apenas fonte do gerador.
spec=importlib.util.spec_from_file_location('operador',ROOT/'primeiro_acesso_telefone_operacao.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('acao',choices=['construir','publicar']);p.add_argument('--pacote',type=Path,required=True)
p.add_argument('--saida',type=Path,required=True);p.add_argument('--destino',default='bc-evolution-central-local:2.3.7-bc.groups.7')
p.add_argument('--autorizado',action='store_true');a=p.parse_args()
root=a.pacote.resolve();manifest=m.pacote(root)
if a.saida.exists() or not a.saida.parent.is_dir():raise SystemExit('Escolha saída nova em pasta existente')
endpoint=subprocess.check_output(['docker','context','inspect','--format','{{.Endpoints.docker.Host}}'],text=True).strip()
if os.environ.get('DOCKER_HOST') or not endpoint.startswith('unix://'):raise SystemExit('Exige Docker Unix local; não usar daemon remoto')
if a.acao=='publicar':
 if not a.autorizado:raise SystemExit('Publicação exige autorização específica e --autorizado')
 if not re.fullmatch(r'ghcr\.io/[a-z0-9][a-z0-9-]*/bc-evolution-groups:2\.3\.7-bc\.groups\.7',a.destino):raise SystemExit('Destino dedicado v7 inválido')
elif a.destino!='bc-evolution-central-local:2.3.7-bc.groups.7':raise SystemExit('Construção local usa apenas tag de bancada')
source=root/'evolution/fonte'
if json.loads((source/'package.json').read_text())['version']!='2.3.7-bc.groups.7':raise SystemExit('Versão de fonte divergente')
with tempfile.TemporaryDirectory(prefix='bc-build-v7-') as tmp:
 metadata=Path(tmp)/'metadata.json'
 subprocess.run(['docker','buildx','build','--platform','linux/amd64','--network','none','--file','Dockerfile.bc-groups',
  '--tag',a.destino,'--metadata-file',str(metadata),'--push' if a.acao=='publicar' else '--load','.'],cwd=source,check=True)
 result=json.loads(metadata.read_text());digest=result.get('containerimage.digest','')
 if not re.fullmatch('sha256:[a-f0-9]{64}',digest):raise SystemExit('Digest ausente; conferir registry sem instalar')
 evidence={'image':a.destino,'digest':digest,'pinned':a.destino.split(':')[0]+'@'+digest if a.acao=='publicar' else None,
 'platform':'linux/amd64','version':'2.3.7-bc.groups.7','commit':manifest['evolution_commit'],'patch_sha256':manifest['arquivos']['evolution/evolution-bc-groups.patch'],
 'published':a.acao=='publicar','installed':False,'note':'Digest pode ser índice OCI; registrar também filho AMD64 e config na janela.'}
 with a.saida.open('x') as f:json.dump(evidence,f,ensure_ascii=False,indent=2);f.write('\n')
 print('Evidência registrada. Nenhuma instalação ou recriação executada:',a.saida)
