#!/usr/bin/env python3
"""Ensaio exclusivo local das três migrations Evolution, sem ler .env ou acessar a VPS."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
if len(sys.argv)!=2:raise SystemExit('Uso: python3 scripts/testar-evolution-ciclo-banco.py CHECKOUT_LOCAL_EVOLUTION')
checkout=Path(sys.argv[1]).resolve()
paths=[checkout/'prisma/postgresql-migrations'/name/'migration.sql' for name in ['20261111190000_bc_group_operations','20261111220000_bc_group_codes','20261114003000_bc_group_cycles']]
if not all(p.is_file() for p in paths):raise SystemExit('Fonte sem as três migrations esperadas')
docker=shutil.which('docker') or '/Applications/Docker.app/Contents/Resources/bin/docker'
context=subprocess.check_output([docker,'context','inspect','--format','{{.Endpoints.docker.Host}}'],text=True).strip()
if os.environ.get('DOCKER_HOST') or not context.startswith('unix://'):raise SystemExit('Exige Docker local por socket Unix')
name='barba-evolution-ciclo-local'
if subprocess.run([docker,'container','inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:raise SystemExit('Container já existe; não será alterado')
owned=None
try:
 owned=subprocess.check_output([docker,'create','--pull=never','--name',name,'--label','bc.local.test=central-cycle','-p','127.0.0.1:54340:5432','-e','POSTGRES_PASSWORD=localtest','supabase/postgres:15.8.1.085'],text=True).strip()
 subprocess.run([docker,'start',owned],check=True,stdout=subprocess.DEVNULL)
 for _ in range(60):
  if subprocess.run([docker,'exec',owned,'pg_isready','-h','127.0.0.1','-U','postgres'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
  time.sleep(1)
 else:raise RuntimeError('PostgreSQL local não iniciou')
 subprocess.run([docker,'exec','-i',owned,'psql','-Xq','-1','-v','ON_ERROR_STOP=1','-U','postgres'],input=b'\n'.join(p.read_bytes() for p in paths),check=True)
 env=dict(os.environ,DATABASE_CONNECTION_URI='postgresql://postgres:localtest@127.0.0.1:54340/postgres',BC_GROUP_TEST_DATABASE='local-only')
 subprocess.run(['node','--import','tsx','--test','--test-concurrency=1','test/bc-group-database.test.ts','test/bc-group-cycle-database.test.ts'],cwd=checkout,env=env,check=True)
finally:
 if owned:subprocess.run([docker,'rm','-f',owned],check=True,stdout=subprocess.DEVNULL)
