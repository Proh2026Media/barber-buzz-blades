#!/usr/bin/env python3
"""Empacota fontes verificadas da liberação P-122, sem .env, dumps ou artefatos de build."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BASE = 'feb555d81b08201f4877003362895604c3445fd0'
NAME = 'BC-Liberacao-Atomica-Piloto-P122-2026-11-15'
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--saida', type=Path, required=True)
a = p.parse_args()

def git(args):
    return subprocess.check_output(['git', '-C', str(ROOT)] + args, stderr=subprocess.DEVNULL).decode().strip()

if git(['status', '--porcelain']):
    raise SystemExit('Salve o commit completo antes de gerar o pacote.')
commit = git(['rev-parse', 'HEAD'])
if subprocess.run(['git', '-C', str(ROOT), 'merge-base', '--is-ancestor', BASE, commit], capture_output=True).returncode:
    raise SystemExit('A base publicada não é ancestral deste commit.')
target = a.saida / NAME
archive = a.saida / (NAME + '.zip')
if target.exists() or archive.exists():
    raise SystemExit('Destino já existe; preservar o pacote anterior.')
target.mkdir(parents=True)
frontend = git(['diff', '--name-only', BASE, commit, '--', 'src/']).splitlines()
files = frontend + [
    'supabase/migrations/20261115004000_whatsapp_piloto_liberacao_atomica.sql',
    'supabase/tests/whatsapp_piloto_liberacao_atomica.sql',
    'scripts/testar-liberacao-piloto.py',
    'scripts/testar-liberacao-piloto-concorrencia.py',
    'scripts/testar-liberacao-piloto-interface.mjs',
    'scripts/testar-operador-liberacao-piloto.py',
    'scripts/testar-p122-feedback-interface.mjs',
    'scripts/foto.mjs',
    'docs/validacoes/liberacao-atomica-p122-2026-11-15.json',
    'package.json', 'bun.lock',
]
for name in ['whatsapp_ciclos_protegidos.sql', 'whatsapp_ciclos_operacao.sql', 'whatsapp_acolhimento_apos_entrada.sql', 'whatsapp_primeiro_acesso_assistido.sql', 'whatsapp_revisao_telefone_protegida.sql', 'whatsapp_revisao_telefone_falhas.sql']:
    files.append('supabase/tests/' + name)
for relative in files:
    source = ROOT / relative
    if not source.is_file() or source.is_symlink() or '.env' in source.name or source.name.startswith('._'):
        raise SystemExit('Fonte ausente/proibida: ' + relative)
    dest = target / relative
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, dest)
for source, dest in [
    ('docs/pacotes/2026-11-15-ti-liberacao-atomica-p122.md', 'LEIA-PRIMEIRO.md'),
    ('scripts/ti/liberacao_piloto_operacao.py', 'operacao/liberacao_piloto_operacao.py'),
    ('scripts/ti/liberacao-piloto/contrato.json', 'operacao/contrato.json'),
]:
    p = target / dest
    p.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / source, p)
(target / 'COMMIT.txt').write_text('Fonte completa: ' + commit + '\nBase frontend publicada: ' + BASE + '\nRamo: codex/retorno-ti-p122-2026-11-15\n')
(target / 'frontend.patch').write_bytes(subprocess.check_output(['git', '-C', str(ROOT), 'diff', '--binary', BASE, commit, '--', 'src/'], stderr=subprocess.DEVNULL))
manifest = {'contract': 'bc-pilot-release-v1', 'commit': commit, 'frontend_base': BASE, 'files': []}
for source in sorted(target.rglob('*')):
    if source.is_file():
        manifest['files'].append({'path': source.relative_to(target).as_posix(), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest()})
(target / 'MANIFESTO.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
lines = []
for source in sorted(target.rglob('*')):
    if source.is_file():
        lines.append(hashlib.sha256(source.read_bytes()).hexdigest() + '  ' + source.relative_to(target).as_posix())
(target / 'SHA256SUMS').write_text('\n'.join(lines) + '\n')
for item in manifest['files']:
    assert hashlib.sha256((target / item['path']).read_bytes()).hexdigest() == item['sha256']
with zipfile.ZipFile(archive, 'x', zipfile.ZIP_DEFLATED) as z:
    for source in sorted(target.rglob('*')):
        if source.is_file():
            z.write(source, NAME + '/' + source.relative_to(target).as_posix())
sha = hashlib.sha256(archive.read_bytes()).hexdigest()
(a.saida / (NAME + '.sha256')).write_text(sha + '  ' + archive.name + '\n')
print(json.dumps({'zip': str(archive), 'sha256': sha, 'commit': commit, 'files': len(lines) + 1, 'frontend_files': len(frontend)}, ensure_ascii=False))
