#!/usr/bin/env python3
"""Operação preparada para a VPS B&C. Segredos somente em memória; nenhum envio na conferência.
conferir | preparar | ativar --autorizado | pausar | enviar (uso pelo timer).
"""
import argparse
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import tempfile
import time
import urllib.request

SERVICE = Path('/data/coolify/services/z2dbb7dkyzhc8vjiywq34mhn')
EDGE = 'supabase-edge-functions-z2dbb7dkyzhc8vjiywq34mhn'
DB = 'supabase-db-z2dbb7dkyzhc8vjiywq34mhn'
INSTALL = Path('/opt/barba-cabelo-webpush')
UNITS = Path('/etc/systemd/system')
LOCK = Path('/run/lock/bc-webpush.lock')
ENDPOINT = 'https://supabase-barbearia.proh.media/functions/v1/web-push'
HASHES = {
 'web-push/index.ts': '0ec53fcba2ff99aa99a45e3278475f0f989ae0d0cdf9af7eeb118629748338f7',
 '_shared/web-push-budget.ts': '0ebf7042bb531f329669171b4645d3dadaa70b590d2f2205d1c7d39129b9b150',
 '_shared/web-push-dispatch.ts': '334eb3680e7e357f210162cd54f68a97c91d7f74957041febf5be145a952d702',
 '_shared/web-push.ts': '09580aad2944fd4315b01efa74cdb939ce5fedf48f1df3495e34455d52d4c930',
}
KEYS = ('WEB_PUSH_PUBLIC_KEY', 'WEB_PUSH_PRIVATE_KEY', 'WEB_PUSH_SUBJECT', 'WEB_PUSH_ALLOWED_ORIGINS')
SERVICE_UNIT = '''[Unit]
Description=B&C - despachar notificacoes Web Push
After=docker.service network-online.target
Wants=network-online.target
[Service]
Type=oneshot
User=root
UMask=0077
NoNewPrivileges=yes
ExecStart=/usr/bin/python3 /opt/barba-cabelo-webpush/webpush_operacao.py enviar
TimeoutStartSec=55s
Restart=no
'''
TIMER_UNIT = '''[Unit]
Description=B&C - agendar Web Push sem sobrepor execucoes
[Timer]
OnActiveSec=15s
OnUnitInactiveSec=15s
AccuracySec=1s
Unit=bc-webpush.service
[Install]
WantedBy=timers.target
'''

class OperationError(Exception):
    pass

def require(condition, message):
    if not condition:
        raise OperationError(message)

def run(args, data=None, allow_failure=False, cwd=None):
    result = subprocess.run(args, input=data, text=True, capture_output=True, timeout=90, cwd=cwd)
    if not allow_failure and result.returncode:
        # stderr de Docker/Compose pode conter ambiente: nunca repassar a saída bruta.
        raise OperationError('Falha operacional em ' + args[0] + '; parar e conferir localmente sem expor segredos.')
    return result

def sql(statement):
    return run(['docker', 'exec', '-i', DB, 'psql', '-U', 'postgres', '-d', 'postgres',
                '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], statement).stdout.strip()

def runtime():
    data = json.loads(run(['docker', 'inspect', EDGE]).stdout)[0]
    env = dict(item.split('=', 1) for item in data['Config']['Env'] if '=' in item)
    return env, data['State'].get('Health', {}).get('Status')

def compose():
    return json.loads(run(['docker', 'compose', 'config', '--format', 'json'], cwd=SERVICE).stdout)['services']['supabase-edge-functions']['environment']

def validate_env(env, configured, off):
    expected = 'false' if off else 'true'
    require(env.get('WEB_PUSH_ENABLED') == configured.get('WEB_PUSH_ENABLED') == expected,
            'Flags do container/Compose divergem do estado esperado.')
    require(all(env.get(k) and env.get(k) == configured.get(k) for k in KEYS),
            'VAPID/origens divergem entre container e Compose; não gerar novas chaves.')
    require(env['WEB_PUSH_SUBJECT'] == 'mailto:contato@proh.media', 'Subject inesperado.')
    require(bool(env.get('SUPABASE_SERVICE_ROLE_KEY') or env.get('SUPABASE_SERVICE_KEY')), 'Chave interna de serviço ausente.')

def check(off=True):
    for name, digest in HASHES.items():
        require(hashlib.sha256((SERVICE/'volumes/functions'/name).read_bytes()).hexdigest() == digest,
                'Função divergente: ' + name + '. Não reinstalar automaticamente.')
    env, health = runtime()
    require(health == 'healthy', 'Container de funções não está saudável.')
    validate_env(env, compose(), off)
    require(sql('select enabled from public.web_push_settings where singleton;') == ('f' if off else 't'),
            'Flag do banco diverge do estado esperado.')
    sql("""do $$ begin
      if pg_get_functiondef('public.web_push_claim()'::regprocedure) !~* 'limit\\s+4\\s+for update skip locked' then raise exception 'Claim divergente'; end if;
      if has_function_privilege('anon','public.web_push_claim()','execute') or has_function_privilege('authenticated','public.web_push_claim()','execute') then raise exception 'Permissão divergente'; end if;
      if to_regclass('cron.job') is not null then
        if exists(select 1 from cron.job where command ilike '%web-push%' or command ilike '%webpush%') then raise exception 'Agendador duplicado'; end if;
      end if;
    end $$;""")
    root_cron = run(['crontab', '-l'], allow_failure=True)
    require(root_cron.returncode in (0, 1), 'Não foi possível conferir crontab.')
    cron_text = root_cron.stdout
    for folder in ['/etc/cron.d', '/etc/cron.hourly', '/etc/cron.daily', '/etc/cron.weekly', '/etc/cron.monthly']:
        for path in Path(folder).glob('*'):
            if path.is_file():
                cron_text += path.read_text(errors='replace')
    if Path('/etc/crontab').exists():
        cron_text += Path('/etc/crontab').read_text()
    require(not re.search(r'web-?push', cron_text, re.I), 'Existe cron Web Push fora deste pacote; revisar duplicação.')
    return env

def atomic_write(path, data, mode=0o600):
    require(not path.is_symlink(), 'Destino não pode ser link simbólico.')
    fd, temp = tempfile.mkstemp(prefix='.bc-webpush-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as out:
            out.write(data); out.flush(); os.fsync(out.fileno())
        os.chmod(temp, mode)
        if path.exists():
            stat = path.stat(); os.chown(temp, stat.st_uid, stat.st_gid)
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)

def flag(enabled):
    path = SERVICE/'.env'
    original = path.read_bytes()
    replacement, count = re.subn(rb'(?m)^(\s*(?:export\s+)?WEB_PUSH_ENABLED\s*=)[^\r\n]*',
                                 lambda match: match[1] + (b'true' if enabled else b'false'), original)
    require(count == 1, 'Esperado exatamente um WEB_PUSH_ENABLED no .env; não modificar às cegas.')
    if original != replacement:
        atomic_write(path, replacement, path.stat().st_mode & 0o777)
        return True
    return False

def recreate():
    run(['docker', 'compose', 'up', '-d', '--no-deps', '--force-recreate', '--pull', 'never', 'supabase-edge-functions'], cwd=SERVICE)
    for _ in range(30):
        if runtime()[1] == 'healthy':
            return
        time.sleep(2)
    raise OperationError('Edge não voltou saudável; manter banco pausado.')

def prepared():
    require((INSTALL/'webpush_operacao.py').read_bytes() == Path(__file__).read_bytes(), 'Operador instalado diverge do pacote.')
    for name, text in [('bc-webpush.service', SERVICE_UNIT), ('bc-webpush.timer', TIMER_UNIT)]:
        require((UNITS/name).read_text() == text, 'Unit divergente: ' + name)

def prepare():
    check(True)
    require(run(['systemctl', 'is-active', 'bc-webpush.timer'], allow_failure=True).stdout.strip() != 'active',
            'Timer já está ativo; não substituir.')
    for name, text in [('bc-webpush.service', SERVICE_UNIT), ('bc-webpush.timer', TIMER_UNIT)]:
        require(not (UNITS/name).exists() or (UNITS/name).read_text() == text, 'Unit preexistente divergente.')
    require(not (INSTALL/'webpush_operacao.py').exists() or (INSTALL/'webpush_operacao.py').read_bytes() == Path(__file__).read_bytes(), 'Operador preexistente divergente.')
    INSTALL.mkdir(mode=0o700, exist_ok=True)
    atomic_write(INSTALL/'webpush_operacao.py', Path(__file__).read_bytes(), 0o700)
    for name, text in [('bc-webpush.service', SERVICE_UNIT), ('bc-webpush.timer', TIMER_UNIT)]:
        atomic_write(UNITS/name, text.encode(), 0o644)
    run(['systemd-analyze', 'verify', str(UNITS/'bc-webpush.service'), str(UNITS/'bc-webpush.timer')])
    run(['systemctl', 'daemon-reload'])
    run(['systemctl', 'disable', '--now', 'bc-webpush.timer'])
    prepared()
    print('Preparado: agendador instalado, desabilitado e parado; push continua desligado.')

def pause():
    failures = []
    # Continuar tentando os dois controles mesmo se um comando falhar.
    for command in [['systemctl', 'disable', '--now', 'bc-webpush.timer'], ['systemctl', 'stop', 'bc-webpush.service']]:
        try: run(command)
        except Exception: failures.append('agendador')
    try: sql('update public.web_push_settings set enabled=false where singleton;')
    except Exception: failures.append('pausa no banco')
    try:
        changed = flag(False)
        if changed or runtime()[0].get('WEB_PUSH_ENABLED') != 'false':
            recreate()
        require(runtime()[0].get('WEB_PUSH_ENABLED') == 'false', 'Flag não pausada')
    except Exception: failures.append('pausa no ambiente')
    require(not failures, 'Pausa incompleta: ' + ', '.join(sorted(set(failures))) + '. TI deve conferir os controles antes de prosseguir.')
    print('Pausado: timer parado, banco e ambiente desligados; inscrições e fila preservadas.')

def activate():
    before = check(True)
    prepared()
    backup = Path('/root')/('backup-bc-webpush-ativacao-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
    backup.mkdir(mode=0o700)
    shutil.copyfile(SERVICE/'.env', backup/'env-preservado')
    os.chmod(backup/'env-preservado', 0o600)
    print('Backup protegido: ' + str(backup), flush=True)
    try:
        flag(True)
        configured = compose()
        require(configured.get('WEB_PUSH_ENABLED') == 'true' and all(configured.get(k) == before[k] for k in KEYS),
                'Compose divergiu; não recriar com configuração inesperada.')
        recreate()
        after, _ = runtime()
        validate_env(after, configured, False)
        require(all(after[k] == before[k] for k in KEYS), 'Identidade VAPID/origens alterada.')
        sql('update public.web_push_settings set enabled=true where singleton;')
        run(['systemctl', 'enable', '--now', 'bc-webpush.timer'])
        check(False)
        require(run(['systemctl', 'is-active', 'bc-webpush.timer']).stdout.strip() == 'active', 'Timer não ficou ativo.')
        require(run(['systemctl', 'is-enabled', 'bc-webpush.timer']).stdout.strip() == 'enabled', 'Timer não ficou habilitado no boot.')
    except Exception:
        pause()
        raise OperationError('Ativação falhou; pausa executada. Conferir antes de repetir.')
    print('Ativado: timer a cada 15 s após término, sem sobreposição; homologação visual ainda necessária.')

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise OperationError('Redirecionamento recusado; nenhuma credencial encaminhada.')

def dispatch():
    with LOCK.open('a') as lock:
        os.chmod(LOCK, 0o600)
        try: fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('Execução anterior em andamento; nenhuma nova chamada.'); return
        env, health = runtime()
        require(health == 'healthy', 'Edge indisponível; nenhuma tentativa nesta execução.')
        if env.get('WEB_PUSH_ENABLED') != 'true':
            print('Push desligado; nenhuma chamada.'); return
        key = env.get('SUPABASE_SERVICE_ROLE_KEY') or env.get('SUPABASE_SERVICE_KEY')
        require(bool(key), 'Chave interna de serviço ausente.')
        request = urllib.request.Request(ENDPOINT, data=b'{"action":"dispatch"}',
                    headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key}, method='POST')
        def expired(_signum, _frame):
            raise OperationError('Prazo total da chamada esgotado; não repetir nesta execução.')
        old = signal.signal(signal.SIGALRM, expired)
        signal.alarm(50)
        try:
            # Sem ProxyHandler do ambiente: não enviar o bearer por proxy configurado acidentalmente.
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
            with opener.open(request, timeout=45) as response:
                raw = response.read(4097)
                require(len(raw) <= 4096, 'Resposta excessiva; não repetir.')
                body = json.loads(raw)
            require(isinstance(body, dict), 'Resposta inválida; não repetir.')
            summary = {key: body[key] for key in ('enabled', 'processed', 'cancelled', 'uncertain') if key in body}
            require(all(isinstance(value, (int, bool)) for value in summary.values()), 'Contadores inválidos.')
            require(body.get('ok') is True, 'Dispatch incompleto/incerto; revisar sem reenviar tarefas.')
            print(json.dumps(summary))
        finally:
            signal.alarm(0); signal.signal(signal.SIGALRM, old)

def main():
    parser = argparse.ArgumentParser(description='Operação Web Push B&C; não usar na máquina de desenvolvimento.')
    parser.add_argument('acao', choices=['conferir', 'preparar', 'ativar', 'pausar', 'enviar'])
    parser.add_argument('--autorizado', action='store_true', help='Ativação expressamente autorizada pelo dono.')
    args = parser.parse_args()
    require(os.geteuid() == 0, 'Executar como root somente na VPS indicada.')
    if args.acao == 'ativar':
        require(args.autorizado, 'Ativação exige autorização do dono e --autorizado.')
    if args.acao == 'conferir':
        check(True); print('Conferido: incremental instalado, chaves preservadas, push desligado. Nenhuma mensagem enviada.')
    else:
        {'preparar': prepare, 'ativar': activate, 'pausar': pause, 'enviar': dispatch}[args.acao]()

if __name__ == '__main__':
    try: main()
    except Exception as error:
        print(str(error) if isinstance(error, OperationError) else 'Falha operacional; conferir localmente sem divulgar saídas ou segredos.')
        raise SystemExit(1)
