#!/usr/bin/env python3
"""Conferência automática: só PostgreSQL descartável local, sem rede ou produção."""
import os
from pathlib import Path
import subprocess
ROOT=Path(__file__).resolve().parents[1]
if os.environ.get('DOCKER_HOST'): raise SystemExit('Somente Docker local')
endpoint=subprocess.check_output(['docker','context','inspect','--format','{{.Endpoints.docker.Host}}'],text=True).strip()
if not endpoint.startswith('unix://'):raise SystemExit('Somente socket Unix local')
cmd=['docker','exec','-i','barba-conferencia-p122-local','psql','-Xq','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres']
new=(ROOT/'supabase/migrations/20261116001000_whatsapp_conferencia_piloto.sql').read_text().replace('\nbegin;\n','\n',1).replace('\ncommit;\n','\n')
base=(ROOT/'supabase/migrations/20261115004000_whatsapp_piloto_liberacao_atomica.sql').read_text()
fixture=(ROOT/'supabase/tests/whatsapp_conferencia_piloto.sql').read_text()
assert fixture.startswith('begin;') and fixture.rstrip().endswith('rollback;')
setup="update public.whatsapp_send_controls set paused=true where scope='global';update public.whatsapp_care_cycle_policy set enabled=false,assisted_access_enabled=false;\n"
r=subprocess.run(cmd,input=fixture.replace('begin;','begin;\n'+setup+base+'\n'+new,1),text=True,capture_output=True,timeout=90)
print(r.stderr,flush=True)
if r.returncode:raise SystemExit(r.returncode)
r=subprocess.run(cmd+['-Atc',"select to_regprocedure('public.care_pilot_connection_check()') is null;"],capture_output=True,text=True,check=True)
assert r.stdout.strip()=='t','A definição de teste escapou do rollback'
print('PASS: consulta e fixtures revertidas integralmente; nenhuma SQL executada em produção')
