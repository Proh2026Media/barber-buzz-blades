#!/usr/bin/env python3
"""Revisão de telefone só na bancada descartável P-122; sem .env, VPS ou WhatsApp reais."""
import argparse,os,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--preparar',action='store_true');a=p.parse_args()
if os.environ.get('DOCKER_HOST') or not subprocess.check_output(['docker','context','inspect','--format','{{.Endpoints.docker.Host}}'],text=True).strip().startswith('unix://'):raise SystemExit('Exige Docker Unix local')
cmd=['docker','exec','-i','barba-central-d1-local','psql','-Xq','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres']
if a.preparar:
 subprocess.run(['python3','scripts/testar-primeiro-acesso-assistido.py','--preparar'],env=dict(os.environ,BC_TESTAR_CONCORRENCIA_FISICA_APOS_INCREMENTAL='1'),check=True)
 subprocess.run(cmd+['-1'],input=(ROOT/'supabase/migrations/20261115003000_whatsapp_revisao_telefone_protegida.sql').read_bytes(),check=True)
if a.preparar:subprocess.run(['python3','scripts/testar-central-d1-concorrencia.py'],env={k:v for k,v in os.environ.items() if k!='BC_TESTAR_CONCORRENCIA_FISICA_APOS_INCREMENTAL'},check=True)
for name in ['whatsapp_revisao_telefone_protegida.sql','whatsapp_revisao_telefone_falhas.sql']:
 r=subprocess.run(cmd,input=(ROOT/'supabase/tests'/name).read_bytes(),capture_output=True)
 print(r.stderr.decode().strip(),flush=True)
 if r.returncode:raise SystemExit(r.returncode)
