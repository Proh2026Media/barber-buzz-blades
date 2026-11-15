#!/usr/bin/env python3
"""Aplica D4 somente na bancada local criada pelo ensaio D2/D3; não lê .env."""
import argparse
import os
from pathlib import Path
import subprocess
ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--preparar',action='store_true')
args=parser.parse_args()
if os.environ.get('DOCKER_HOST'):raise SystemExit('Somente Docker local')
endpoint=subprocess.check_output(['docker','context','inspect','--format','{{.Endpoints.docker.Host}}'],text=True).strip()
if not endpoint.startswith('unix://'):raise SystemExit('Somente socket Unix local')
if args.preparar:
 subprocess.run(['python3','scripts/testar-central-d23-banco.py','--preparar'],check=True)
 paths=sorted((ROOT/'supabase/migrations').glob('2026111400[3456789]000_*.sql'))
 assert paths
 subprocess.run(['docker','exec','-i','barba-central-d1-local','psql','-Xq','-1','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],input=b'\n'.join(p.read_bytes() for p in paths),check=True)
for suite in ['whatsapp_ciclos_protegidos.sql','whatsapp_ciclos_operacao.sql']:
 result=subprocess.run(['docker','exec','-i','barba-central-d1-local','psql','-Xq','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],input=(ROOT/'supabase/tests'/suite).read_bytes(),capture_output=True)
 print(result.stderr.decode().strip(),flush=True)
 if result.returncode:raise SystemExit(result.returncode)
