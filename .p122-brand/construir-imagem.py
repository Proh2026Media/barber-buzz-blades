#!/usr/bin/env python3
"""Constrói a Evolution P-122 e exporta arquivo Docker; não autentica nem publica."""
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile

BASE = 'cd800f2976e1e5b682fbf86a01ee4d85ae61f370'
IMAGE = 'ghcr.io/proh2026media/bc-evolution-groups:2.3.7-bc.groups.6-brand.1'
HERE = Path(__file__).resolve().parent


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def sha256(path):
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def main():
    if len(sys.argv) != 3:
        raise SystemExit('Uso: construir-imagem.py CHECKOUT_OFICIAL DIRETORIO_NOVO')
    checkout = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    if output.exists():
        raise SystemExit('Diretório de saída já existe; preservar o artefato anterior.')
    endpoint = subprocess.check_output(['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], text=True).strip()
    if os.environ.get('DOCKER_HOST') or not endpoint.startswith('unix://'):
        raise SystemExit('Exige Docker local no runner; não usar daemon da VPS.')
    patch = HERE / 'evolution-bc-groups.patch'
    patch_sha = sha256(patch)
    if patch_sha != (HERE / 'PATCH-SHA256SUMS').read_text().split()[0]:
        raise SystemExit('Integridade do patch divergente.')
    base_patch_sha = patch_sha
    hotfix = HERE / 'brand-hotfix.patch'
    hotfix_sha = sha256(hotfix)
    if hotfix_sha != (HERE / 'HOTFIX-SHA256SUMS').read_text().split()[0]:
        raise SystemExit('Integridade do hotfix divergente.')
    patch_sha = hashlib.sha256(patch.read_bytes() + hotfix.read_bytes()).hexdigest()
    archive = subprocess.check_output(['git', '-C', str(checkout), 'archive', BASE])
    output.mkdir(parents=True)
    with tempfile.TemporaryDirectory(prefix='bc-p122-build-') as tmp:
        root = Path(tmp)
        with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
            for item in tar.getmembers():
                parts = Path(item.name).parts
                if not item.isfile() or Path(item.name).is_absolute() or '..' in parts:
                    continue
                if any(p.startswith(('.env', '._', '.git')) for p in parts):
                    continue
                destination = root.joinpath(*parts)
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(tar.extractfile(item).read())
                destination.chmod(item.mode & 0o777)
        run(['git', 'apply', '--check', str(patch)], cwd=root)
        run(['git', 'apply', str(patch)], cwd=root)
        run(['git', 'apply', '--check', str(hotfix)], cwd=root)
        run(['git', 'apply', str(hotfix)], cwd=root)
        run(['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], cwd=root)
        build_env = dict(os.environ, DATABASE_CONNECTION_URI='postgresql://127.0.0.1:1/build_only')
        run(['node', 'node_modules/prisma/build/index.js', 'generate', '--schema', 'prisma/postgresql-schema.prisma'], cwd=root, env=build_env)
        run(['npm', 'run', 'test:bc-groups'], cwd=root)
        run(['node', '--import', 'tsx', '--test', 'test/bc-brand-order-regression.test.ts'], cwd=root)
        run(['npm', 'run', 'lint:check'], cwd=root)
        run(['npm', 'run', 'build:bc-runtime'], cwd=root)

        run(['docker', 'buildx', 'build', '--platform', 'linux/amd64', '--file', 'Dockerfile.bc-groups',
             '--build-arg', 'BC_PATCH_SHA256=' + patch_sha, '--tag', IMAGE,
             '--metadata-file', str(output / 'build-result.json'), '--load', '.'], cwd=root)
    identity = subprocess.check_output(['docker', 'image', 'inspect', '--format', '{{.Os}} {{.Architecture}} {{.Id}}', IMAGE], text=True).strip().split()
    if len(identity) != 3 or identity[:2] != ['linux', 'amd64']:
        raise SystemExit('Imagem construída não é Linux/AMD64.')
    run(['docker', 'run', '--rm', '--network', 'none', '--entrypoint', 'node', IMAGE, '--check', 'dist/main.js'])
    target = output / 'evolution-v5.docker.tar'
    run(['docker', 'image', 'save', '--output', str(target), IMAGE])
    digest = sha256(target)
    (output / 'SHA256SUMS').write_text(digest + '  ' + target.name + chr(10))
    record = {'image': IMAGE, 'image_id': identity[2], 'base': BASE,
              'patch_sha256': patch_sha, 'base_patch_sha256': base_patch_sha, 'hotfix_patch_sha256': hotfix_sha, 'archive_sha256': digest, 'platform': 'linux/amd64',
              'published': False, 'installed': False,
              'runtime_check': 'node --check dist/main.js, sem rede; não equivale à saúde HTTP'}
    (output / 'imagem-v5.json').write_text(json.dumps(record, indent=2) + chr(10))
    print(json.dumps(record, indent=2))


if __name__ == '__main__':
    main()
