#!/usr/bin/env python3
"""Verifica somente o banco Docker descartável local. Não lê .env nem usa rede/WhatsApp reais."""
import argparse,os,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--preparar',action='store_true')
a=p.parse_args()
if os.environ.get('DOCKER_HOST') or not subprocess.check_output(['docker','context','inspect','--format','{{.Endpoints.docker.Host}}'],text=True).strip().startswith('unix://'):raise SystemExit('Exige Docker Unix local')
cmd=['docker','exec','-i','barba-central-d1-local','psql','-Xq','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres']
if a.preparar:
 subprocess.run(['python3','scripts/testar-acolhimento-apos-entrada.py','--preparar'],check=True)
 subprocess.run(['python3','scripts/testar-singletons-safeupdate.py'],check=True)
 subprocess.run(cmd+['-1'],input=(ROOT/'supabase/migrations/20261115002000_whatsapp_primeiro_acesso_assistido.sql').read_bytes(),check=True)
r=subprocess.run(cmd,input=(ROOT/'supabase/tests/whatsapp_primeiro_acesso_assistido.sql').read_bytes(),capture_output=True)
print(r.stderr.decode().strip(),flush=True)
raise SystemExit(r.returncode)
