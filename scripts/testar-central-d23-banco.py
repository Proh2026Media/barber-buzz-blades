#!/usr/bin/env python3
"""Somente bancada descartável da Central: reproduz D1 e aplica D2/D3 localmente."""
import argparse
import os
from pathlib import Path
import subprocess
ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--preparar',action='store_true')
args=parser.parse_args()
if args.preparar:
    subprocess.run(['python3','scripts/testar-central-d1-banco.py','--preparar'],check=True)
    data=b'\n'.join(p.read_bytes() for p in sorted((ROOT/'supabase/migrations').glob('2026111400[12]000_*.sql')))
    assert data
    subprocess.run(['docker','exec','-i','barba-central-d1-local','psql','-Xq','-1','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],input=data,check=True)
for name in ['whatsapp_automacao_servidor','whatsapp_atividade','whatsapp_atividade_grupos','whatsapp_historico']:
    p=subprocess.run(['docker','exec','-i','barba-central-d1-local','psql','-Xq','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],input=(ROOT/'supabase/tests'/f'{name}.sql').read_bytes(),capture_output=True)
    print(p.stderr.decode().strip(),flush=True)
    if p.returncode:raise SystemExit(p.returncode)
