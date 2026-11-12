#!/usr/bin/env python3
"""Mede API em bancada sem sessões WhatsApp; não prevê reconexão em produção."""
import json, os, subprocess, time, uuid
from pathlib import Path
D = 'docker'
IMAGE = 'local/bc-evolution-groups:2.3.7-bc.groups.2'
def run(*args, **kw):
    return subprocess.check_output([D,*args], stderr=subprocess.PIPE, text=True, **kw).strip()
endpoint=run('context','inspect','--format','{{.Endpoints.docker.Host}}')
if os.environ.get('DOCKER_HOST') or not endpoint.startswith('unix://'):
    raise SystemExit('Exige Docker local por socket Unix')
prefix='bc-reinicio-'+uuid.uuid4().hex[:10]
net=prefix+'-net'; volume=prefix+'-sessions'; db=prefix+'-db'; api=prefix+'-api'
containers=[]; made_net=False; made_volume=False
report={'image':run('image','inspect',IMAGE,'--format','{{.Id}}'),'scope':'API local vazia; sem WhatsApp, sem sessões ou tráfego externo','recreate_seconds':[]}
try:
    run('network','create','--internal',net); made_net=True
    run('volume','create',volume); made_volume=True
    cid=run('run','-d','--name',db,'--network',net,'-e','POSTGRES_PASSWORD=localtest','supabase/postgres:15.8.1.085');containers.append(cid)
    for _ in range(60):
        if subprocess.run([D,'exec',cid,'pg_isready','-h','127.0.0.1','-U','postgres'],capture_output=True).returncode==0:break
        time.sleep(1)
    else:raise RuntimeError('Banco não iniciou')
    env=['-e','DATABASE_PROVIDER=postgresql','-e',f'DATABASE_CONNECTION_URI=postgresql://postgres:localtest@{db}:5432/postgres',
         '-e','CACHE_REDIS_ENABLED=false','-e','CACHE_LOCAL_ENABLED=true','-e','AUTHENTICATION_API_KEY=localtest-only-not-a-real-key',
         '-e','SERVER_PORT=8080','-e','SERVER_URL=http://127.0.0.1:54335','-e','LOG_LEVEL=ERROR,WARN,INFO,LOG','-e','SERVER_TYPE=http',
         '-e','TELEMETRY_ENABLED=false','-e','BC_GROUPS_EXTENSION_ENABLED=false']
    # Schema completo descartável, incluindo as duas tabelas da extensão; sem URL de produção.
    run('run','--rm','--platform','linux/amd64','--network',net,*env,'--entrypoint','npx',IMAGE,'--no-install','prisma','db','push','--schema','prisma/postgresql-schema.prisma','--skip-generate')
    def create():
        cid=run('run','-d','--platform','linux/amd64','--name',api,'--network',net,'-p','127.0.0.1:54335:8080','-v',volume+':/evolution/instances',*env,IMAGE)
        containers.append(cid);return cid
    def ready():
        start=time.monotonic()
        while time.monotonic()-start<90:
            # A raiz da Evolution consulta a versão do WhatsApp na internet. Não é saúde local.
            probe=subprocess.run([D,'exec',api,'wget','-T','3','-qO-',
                '--header=apikey: localtest-only-not-a-real-key',
                'http://127.0.0.1:8080/instance/fetchInstances'],capture_output=True,timeout=10)
            if probe.returncode==0 and probe.stdout.strip()==b'[]':return
            time.sleep(.2)
        print(run('logs','--tail','30',api)); raise RuntimeError('API local não ficou disponível')
    current=create();ready()
    run('exec',current,'sh','-c','printf bancada > /evolution/instances/bc-sentinel')
    for _ in range(3):
        start=time.monotonic()
        run('stop','-t','10',current); run('rm',current);containers.remove(current)
        current=create();ready()
        report['recreate_seconds'].append(round(time.monotonic()-start,3))
        assert run('exec',current,'cat','/evolution/instances/bc-sentinel')=='bancada'
    report['volume_preserved']=True
    report['note']='Medição inclui parada/recriação/prontidão HTTP nesta máquina; não mede retorno de instâncias WhatsApp.'
    print(json.dumps(report,ensure_ascii=False,indent=2))
except subprocess.CalledProcessError as e:
    print((e.output or '')[-2000:]); raise
finally:
    for cid in reversed(containers):subprocess.run([D,'rm','-f',cid],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    if made_volume:subprocess.run([D,'volume','rm',volume],stdout=subprocess.DEVNULL)
    if made_net:subprocess.run([D,'network','rm',net],stdout=subprocess.DEVNULL)
