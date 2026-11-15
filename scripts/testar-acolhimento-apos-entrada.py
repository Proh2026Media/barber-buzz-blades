#!/usr/bin/env python3
"""Somente bancada descartável P-122; sem .env, WhatsApp real ou VPS."""
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
 subprocess.run(['python3','scripts/testar-central-d4-banco.py','--preparar'],check=True)
 migration=(ROOT/'supabase/migrations/20261115001000_whatsapp_acolhimento_apos_entrada.sql').read_bytes()
 denied=subprocess.run(cmd+['-1'],input=b'update public.whatsapp_care_cycle_policy set enabled=true;\n'+migration,capture_output=True)
 assert denied.returncode and b'BC_PAUSAR_GRUPOS_ANTES_DO_AJUSTE' in denied.stderr
 print('PASS: política ligada recusa a migration e desfaz a transação',flush=True)
 setup=(ROOT/'supabase/tests/whatsapp_ciclos_protegidos.sql').read_text().split('update d4 set job=public.claim_care_cycle(cycle);')[0]
 setup=setup.replace('begin;','',1)+"update d4 set job=public.claim_care_cycle(cycle);update public.whatsapp_care_cycle_policy set enabled=false;\n"
 denied=subprocess.run(cmd+['-1'],input=setup.encode()+migration,capture_output=True)
 assert denied.returncode and b'BC_AGUARDAR_OPERACOES_EM_ANDAMENTO' in denied.stderr,denied.stderr.decode()
 print('PASS: lease de execução em andamento impede instalação; nada é apagado para passar',flush=True)
 subprocess.run(cmd+['-1'],input=migration,check=True)
r=subprocess.run(cmd,input=(ROOT/'supabase/tests/whatsapp_acolhimento_apos_entrada.sql').read_bytes(),capture_output=True)
print(r.stderr.decode().strip())
raise SystemExit(r.returncode)
