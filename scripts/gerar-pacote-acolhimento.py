#!/usr/bin/env python3
"""Entrega incremental LOCAL pós-entrada. Não instala, publica ou lê .env."""
import argparse, hashlib, io, json, re, subprocess, tarfile, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = '7db853a'
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--evolution', required=True, type=Path)
p.add_argument('--saida', required=True, type=Path)
p.add_argument('--zip', action='store_true')
a = p.parse_args()
out = a.saida.resolve()
assert not out.exists(), 'Escolha uma pasta nova'
out.mkdir(parents=True)

def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args], stderr=subprocess.DEVNULL)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def put(name, data):
    target = out / name
    assert target.resolve().is_relative_to(out)
    assert not any(part.startswith(('.env', '._', '.git')) for part in Path(name).parts)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data if isinstance(data, bytes) else data.encode())

def copy(path, name):
    put(name, path.read_bytes())

functions = (ROOT / 'supabase/functions').resolve()
entries = ['platform-whatsapp', 'whatsapp-channel', 'whatsapp-dispatch', 'whatsapp-groups',
           'auth-otp', 'whatsapp-health', 'whatsapp-distribution']
pending = [functions / n / 'index.ts' for n in entries]
selected = set()
while pending:
    path = pending.pop().resolve()
    assert path.is_relative_to(functions) and path.is_file()
    if path in selected:
        continue
    selected.add(path)
    for rel in re.findall(r'(?:from\s*|import\s*)["\'](\.[^"\']+\.ts)["\']', path.read_text()):
        pending.append((path.parent / rel).resolve())
base_functions = {}
for path in sorted(selected):
    name = path.relative_to(functions).as_posix()
    copy(path, 'funcoes/' + name)
    base_functions[name] = sha(git('show', BASE + ':supabase/functions/' + name))

sql_name = '20261115001000_whatsapp_acolhimento_apos_entrada.sql'
copy(ROOT / 'supabase/migrations' / sql_name, 'banco-bc/' + sql_name)
ops = ROOT / 'scripts/ti/acolhimento-whatsapp'
for path in ops.iterdir():
    if path.is_file():
        copy(path, 'operacao/' + path.name)
for name in ['acolhimento_whatsapp_operacao.py', 'test_acolhimento_whatsapp_operacao.py']:
    copy(ROOT / 'scripts/ti' / name, 'operacao/' + name)
put('operacao/bc-atomico.sql', "begin;set local lock_timeout='5s';set local statement_timeout='90s';\n"
    + (ops / 'precondicoes-bc.sql').read_text() + '\n'
    + (ROOT / 'supabase/migrations' / sql_name).read_text() + '\n'
    + (ops / 'poscondicoes-bc.sql').read_text() + '\ncommit;\n')

for path in (ROOT / 'integrations/evolution/grupos-v6').iterdir():
    if path.is_file():
        copy(path, 'evolution/' + path.name)
archive = subprocess.check_output(['git', '-C', str(a.evolution), 'archive', 'HEAD'])
with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
    for member in tar.getmembers():
        if not member.isfile() or any(x.startswith(('.env', '._', '.git')) for x in Path(member.name).parts):
            continue
        put('evolution/fonte/' + member.name, tar.extractfile(member).read())
assert json.loads((out / 'evolution/fonte/package.json').read_text())['version'] == '2.3.7-bc.groups.6'
copy(ROOT / 'docs/pacotes/2026-11-15-ti-acolhimento-apos-entrada-p122.md', 'LEIA-PRIMEIRO.md')
copy(ROOT / 'docs/acolhimento-grupos-pos-entrada-2026-11-15.md', 'evidencias/resultado-local.md')
copy(ROOT / 'docs/validacoes/acolhimento-grupos-2026-11-15.json', 'evidencias/verificacoes.json')

# Bancada completa e sem segredos: todos os arquivos são selecionados do Git.
# Arquivos novos precisam estar adicionados ao índice antes de montar a entrega.
paths = git('ls-files', '--', 'src', 'public', 'supabase', 'integrations/compatibilidade-central-whatsapp-2026-11-13').decode().splitlines()
for name in paths:
    if (ROOT / name).is_file() and not any(x.startswith(('.env', '._', '.git')) for x in Path(name).parts):
        copy(ROOT / name, 'bancada/' + name)
for name in ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'eslint.config.js', 'components.json', 'postcss.config.js',
             'scripts/copy-pwa.mjs', 'scripts/banco-local.sh', 'scripts/testar-central-d1-banco.py', 'scripts/testar-central-d1-concorrencia.py',
             'scripts/testar-central-d23-banco.py', 'scripts/testar-central-d23-concorrencia.py', 'scripts/testar-central-d4-banco.py',
             'scripts/testar-central-d4-concorrencia.py', 'scripts/testar-central-d4-integrado.mts', 'scripts/testar-acolhimento-apos-entrada.py', 'scripts/testar-pacote-acolhimento.py',
             'scripts/testar-evolution-ciclo-banco.py', 'scripts/testar-evolution-ciclo-imagem.py']:
    if (ROOT / name).is_file():
        copy(ROOT / name, 'bancada/' + name)
commit = git('rev-parse', 'HEAD').decode().strip()
put('COMMIT.txt', commit + '\n')
put('BASE.txt', 'B&C: entrega local v5 7db853a, completa e conferida na VPS antes de operar.\n'
    'Evolution: v5 d020247; v6 ca986dd; nenhuma SQL Evolution nova.\n'
    'Frontend main e5f3ec0 preservado, sem pacote frontend ou push nesta entrega.\n')
manifest = {'contrato': 'p122-acolhimento-v1', 'commit': commit, 'base_funcoes': base_functions,
            'migration_bc': sql_name, 'migrations_evolution_novas': [], 'frontend_novo': False,
            'arquivos': {f.relative_to(out).as_posix(): sha(f.read_bytes()) for f in sorted(out.rglob('*')) if f.is_file()}}
put('MANIFESTO.json', json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
put('SHA256SUMS', ''.join(sha(f.read_bytes()) + '  ' + f.relative_to(out).as_posix() + '\n' for f in sorted(out.rglob('*')) if f.is_file()))
if a.zip:
    target = out.with_suffix('.zip')
    assert not target.exists(), 'Não substituir pacote anterior'
    with zipfile.ZipFile(target, 'x', zipfile.ZIP_DEFLATED) as z:
        for path in sorted(out.rglob('*')):
            if path.is_file():
                z.write(path, Path(out.name) / path.relative_to(out))
    print(target)
    print('SHA-256:', sha(target.read_bytes()))
else:
    print('Entrega local para conferência:', out)
