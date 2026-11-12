#!/usr/bin/env python3
"""Constrói fonte exata e publica imagem AMD64. Requer login Docker no registry, feito pelo Guardião."""
import hashlib, io, json, os, re, subprocess, sys, tarfile, tempfile
from pathlib import Path
BASE='cd800f2976e1e5b682fbf86a01ee4d85ae61f370'
HERE=Path(__file__).resolve().parent
if len(sys.argv)!=4:
    raise SystemExit('Uso: python3 publicar-imagem.py CHECKOUT_BASE ghcr.io/ORGANIZACAO/bc-evolution-groups:2.3.7-bc.groups.2 SAIDA_JSON')
checkout=Path(sys.argv[1]).resolve(); target=sys.argv[2]; output=Path(sys.argv[3]).resolve()
if not re.fullmatch(r'ghcr\.io/[a-z0-9][a-z0-9-]*/bc-evolution-groups:2\.3\.7-bc\.groups\.2',target):
    raise SystemExit('Destino inválido; usar o pacote dedicado no GHCR')
if not output.parent.is_dir(): raise SystemExit('A pasta de saída deve existir antes da publicação')
if output.exists(): raise SystemExit('Arquivo de saída já existe; escolha outro para preservar a evidência')
endpoint=subprocess.check_output(['docker','context','inspect','--format','{{.Endpoints.docker.Host}}'],text=True).strip()
if os.environ.get('DOCKER_HOST') or not endpoint.startswith('unix://'):
    raise SystemExit('Usar Docker local de bancada, nunca o daemon da VPS')
patch=HERE/'evolution-bc-groups.patch'
sha=hashlib.sha256(patch.read_bytes()).hexdigest()
expected=(HERE/'SHA256SUMS').read_text().split()[0]
if sha!=expected:raise SystemExit('Patch não corresponde ao manifesto')
archive=subprocess.check_output(['git','-C',str(checkout),'archive',BASE],stderr=subprocess.PIPE)
with tempfile.TemporaryDirectory(prefix='bc-evolution-publicar-') as tmp:
    root=Path(tmp)
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        for f in tar.getmembers():
            parts=Path(f.name).parts
            if not f.isfile() or Path(f.name).is_absolute() or '..' in parts:continue
            if any(p.startswith('.env') or p.startswith('._') for p in parts):continue
            dest=root/f.name;dest.parent.mkdir(parents=True,exist_ok=True)
            dest.write_bytes(tar.extractfile(f).read());dest.chmod(f.mode)
    subprocess.run(['git','apply','--check',str(patch)],cwd=root,check=True)
    subprocess.run(['git','apply',str(patch)],cwd=root,check=True)
    metadata=root/'build-result.json'
    subprocess.run(['docker','buildx','build','--platform','linux/amd64','--file','Dockerfile.bc-groups',
       '--build-arg','BC_PATCH_SHA256='+sha,'--tag',target,'--metadata-file',str(metadata),'--push','.'],cwd=root,check=True)
    result=json.loads(metadata.read_text());digest=result.get('containerimage.digest','')
    if not re.fullmatch(r'sha256:[0-9a-f]{64}',digest):raise SystemExit('Publicação sem digest válido; conferir registry antes de instalar')
    output.write_text(json.dumps({'image':target,'digest':digest,'pinned':target.split(':')[0]+'@'+digest,
        'base':BASE,'patch_sha256':sha,'platform':'linux/amd64','installed':False},indent=2)+'\n')
    print('Imagem publicada; nenhuma instalação executada. Evidência:',output)
