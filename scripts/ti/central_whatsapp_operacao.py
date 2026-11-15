#!/usr/bin/env python3
"""Operador P-122. Nada é instalado ao abrir. Mutações exigem --autorizado.
Pacote: conferir | base | sql-bc | sql-evolution | funcoes | restaurar-funcoes.
Rotinas: configuracao | distribuicao | grupos | expurgo. Sem segredos na saída.
"""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import urllib.request

class Falha(RuntimeError):
    pass

def exigir(ok, mensagem):
    if not ok: raise Falha(mensagem)

def executar(args, dados=None):
    r=subprocess.run(args,input=dados,capture_output=True,timeout=120)
    exigir(r.returncode==0,'Comando não concluído; conferir localmente sem exportar a saída bruta: '+args[0])
    return r.stdout

def caminho(raiz, nome):
    partes=Path(nome).parts
    exigir(bool(partes) and not Path(nome).is_absolute() and '..' not in partes,'Caminho de pacote inválido')
    exigir(not any(p.startswith(('.env','._','.git')) for p in partes),'Arquivo excluído do pacote')
    alvo=raiz.joinpath(*partes)
    exigir(alvo.resolve().is_relative_to(raiz.resolve()) and not alvo.is_symlink(),'Caminho externo ou simbólico')
    return alvo

def hash_arquivo(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def pacote(raiz):
    exigir(raiz.is_dir(),'Pasta do pacote ausente')
    dados=json.loads((raiz/'MANIFESTO.json').read_text())
    exigir(dados.get('contrato')=='p122-central-v1','Contrato de pacote inesperado')
    for nome,sha in dados['arquivos'].items():
        p=caminho(raiz,nome)
        exigir(re.fullmatch('[a-f0-9]{64}',sha) and p.is_file() and hash_arquivo(p)==sha,'Integridade divergente: '+nome)
    return dados

def sql(db,banco,consulta):
    exigir(re.fullmatch('[a-zA-Z0-9_-]{1,100}',db) and re.fullmatch('[a-zA-Z0-9_-]{1,64}',banco),'Identificador de banco inválido')
    return executar(['docker','exec','-i',db,'psql','-XqAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',banco],consulta.encode()).decode().strip()

def conferir_base(raiz,funcoes,db,banco):
    m=pacote(raiz)
    for nome,antes in m['base_funcoes'].items():
        p=caminho(funcoes,nome)
        if antes is None: exigir(not p.exists(),'Arquivo novo já existe: '+nome)
        else: exigir(p.is_file() and hash_arquivo(p)==antes,'Fonte da VPS diverge da base: '+nome)
    sql(db,banco,(raiz/'operacao/precondicoes-bc.sql').read_text())
    return m

def instalar_sql(raiz,db,banco,evolution=False):
    pacote(raiz)
    arquivo='operacao/evolution-incremental.sql' if evolution else 'operacao/bc-atomico.sql'
    sql(db,banco,(raiz/arquivo).read_text())

def trocar(p,conteudo):
    p.parent.mkdir(parents=True,exist_ok=True)
    fd,tmp=tempfile.mkstemp(prefix='.bc-central-',dir=p.parent)
    try:
        with os.fdopen(fd,'wb') as f:f.write(conteudo)
        os.chmod(tmp,0o644)
        os.replace(tmp,p)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)

def instalar_funcoes(raiz,alvo,backup):
    m=pacote(raiz)
    exigir(not backup.exists(),'Escolha uma pasta de backup nova')
    # Conferir TODOS os arquivos antes da primeira alteração.
    anteriores={}
    for nome,sha in m['base_funcoes'].items():
        p=caminho(alvo,nome)
        exigir((sha is None and not p.exists()) or (p.is_file() and sha==hash_arquivo(p)),'Fonte diverge antes da cópia: '+nome)
        anteriores[nome]=p.read_bytes() if p.exists() else None
    backup.mkdir(parents=True,mode=0o700)
    estado={}
    for nome,conteudo in anteriores.items():
        estado[nome]={'antes':None if conteudo is None else hashlib.sha256(conteudo).hexdigest(),'depois':m['arquivos']['funcoes/'+nome]}
        if conteudo is not None:
            p=caminho(backup,nome);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(conteudo);p.chmod(0o600)
    (backup/'ESTADO.json').write_text(json.dumps(estado,indent=2)+'\n');(backup/'ESTADO.json').chmod(0o600)
    alterados=[]
    try:
        for nome in anteriores:
            p=caminho(alvo,nome);trocar(p,caminho(raiz,'funcoes/'+nome).read_bytes());alterados.append(nome)
    except BaseException:
        for nome in reversed(alterados):
            p=caminho(alvo,nome);conteudo=anteriores[nome]
            if conteudo is None:p.unlink(missing_ok=True)
            else:p.write_bytes(conteudo)
        raise
    return len(anteriores)

def restaurar_funcoes(alvo,backup):
    estado=json.loads((backup/'ESTADO.json').read_text())
    exigir(estado,'Backup vazio')
    for nome,item in estado.items():
        p=caminho(alvo,nome)
        exigir(p.is_file() and hash_arquivo(p)==item['depois'],'Arquivo mudou após a instalação; não sobrescrever: '+nome)
        if item['antes'] is not None:exigir(hash_arquivo(caminho(backup,nome))==item['antes'],'Backup divergente: '+nome)
    for nome,item in estado.items():
        p=caminho(alvo,nome)
        if item['antes'] is None:p.unlink()
        else:trocar(p,caminho(backup,nome).read_bytes())
    return len(estado)

def ambiente(edge):
    exigir(re.fullmatch('[a-zA-Z0-9_-]{1,100}',edge),'Container inválido')
    pares=json.loads(executar(['docker','inspect','--format','{{json .Config.Env}}',edge]))
    return dict(p.split('=',1) for p in pares if '=' in p)

def conferir_configuracao(edge,servico):
    vivo=ambiente(edge)
    compose=json.loads(subprocess_result_compose(servico))
    salvo=compose['services']['supabase-edge-functions']['environment']
    chaves=['SUPABASE_URL','EVOLUTION_API_URL','EVOLUTION_API_KEY','AUTHENTICATION_API_KEY','WHATSAPP_GROUP_API_SECRET','WHATSAPP_GROUP_WEBHOOK_SECRET','WHATSAPP_GROUP_PILOT_ENABLED','WHATSAPP_GROUP_CYCLE_ENABLED','WEB_PUSH_PUBLIC_KEY','WEB_PUSH_PRIVATE_KEY','WEB_PUSH_SUBJECT','WEB_PUSH_ALLOWED_ORIGINS','WEB_PUSH_ENABLED']
    exigir(all(vivo.get(k)==salvo.get(k) for k in chaves),'Ambiente e Compose divergem; não recriar ou usar Redeploy')
    exigir(vivo.get('WHATSAPP_GROUP_CYCLE_ENABLED') in ('true','false'),'Flag de ciclo deve ser explícita')
    exigir(all(len(vivo.get(k,''))>=32 for k in ['WHATSAPP_GROUP_API_SECRET','WHATSAPP_GROUP_WEBHOOK_SECRET']),'Segredo de grupo ausente ou curto; Guardião deve conferir sem expor valores')
    return {'persistencia_conferida':True,'ciclo':vivo['WHATSAPP_GROUP_CYCLE_ENABLED']=='true','push_preservado':bool(vivo.get('WEB_PUSH_PUBLIC_KEY'))}

def subprocess_result_compose(servico):
    r=subprocess.run(['docker','compose','config','--format','json'],cwd=servico,capture_output=True,timeout=30)
    exigir(r.returncode==0,'Compose não pôde ser conferido; não recriar')
    return r.stdout

def rotina(edge,acao):
    env=ambiente(edge)
    key=env.get('SUPABASE_SERVICE_ROLE_KEY') or env.get('SUPABASE_SERVICE_KEY')
    exigir(key,'Chave interna indisponível')
    exigir(env.get('WHATSAPP_GROUP_CYCLE_ENABLED')=='true' or acao in ('distribuicao','expurgo'),'Rotina de grupos ainda desligada')
    base='https://supabase-barbearia.proh.media/functions/v1/'
    endpoint='whatsapp-distribution' if acao=='distribuicao' else 'whatsapp-groups'
    corpo={} if acao=='distribuicao' else {'action':'purge' if acao=='expurgo' else 'reconcile'}
    req=urllib.request.Request(base+endpoint,data=json.dumps(corpo).encode(),headers={'Authorization':'Bearer '+key,'apikey':key,'Content-Type':'application/json'},method='POST')
    # Redirecionamento não recebe a credencial interna.
    class SemRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,*args,**kwargs):return None
    try:
        with urllib.request.build_opener(SemRedirect()).open(req,timeout=55) as r:result=json.load(r)
    except Exception:raise Falha('Rotina não confirmada; não repetir uma mensagem ou limpar diários') from None
    if acao=='grupos':return {'estados':result.get('states',[]),'registro':result.get('registry',{})}
    if acao=='expurgo':exigir(result.get('ok') is True,'Expurgo não confirmado');return {'ok':True}
    return {k:result[k] for k in ['observed','processed','assigned','waiting','state','ok'] if k in result}

def principal():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('acao',choices=['conferir','base','sql-bc','sql-evolution','funcoes','restaurar-funcoes','configuracao','piloto','distribuicao','grupos','expurgo'])
    p.add_argument('--pacote',type=Path);p.add_argument('--funcoes',type=Path);p.add_argument('--backup',type=Path)
    p.add_argument('--shop');p.add_argument('--cliente');p.add_argument('--db');p.add_argument('--banco',default='postgres');p.add_argument('--edge');p.add_argument('--servico',type=Path)
    p.add_argument('--autorizado',action='store_true');a=p.parse_args()
    if a.acao in ['sql-bc','sql-evolution','funcoes','restaurar-funcoes','piloto','distribuicao','grupos','expurgo']:exigir(a.autorizado,'Ação exige autorização da etapa e --autorizado')
    if a.acao in ['conferir','base','sql-bc','sql-evolution','funcoes','piloto']:exigir(a.pacote is not None,'Informe --pacote')
    if a.acao=='conferir':m=pacote(a.pacote);print(json.dumps({'integridade':True,'arquivos':len(m['arquivos'])}));return
    if a.acao=='base':conferir_base(a.pacote,a.funcoes,a.db,a.banco);print('Base conferida; nenhuma alteração.');return
    if a.acao in ['sql-bc','sql-evolution']:instalar_sql(a.pacote,a.db,a.banco,a.acao=='sql-evolution');print('SQL concluído; nenhuma ativação automática.');return
    if a.acao in ['funcoes','restaurar-funcoes']:
        exigir(a.edge and a.funcoes and a.backup,'Informe --edge, --funcoes e --backup')
        exigir(executar(['docker','inspect','--format','{{.State.Running}}',a.edge]).strip()==b'false','Parar somente o container de funções antes da troca')
        if a.acao=='funcoes':
            exigir(sql(a.db,a.banco,"select (not enabled)::text from public.whatsapp_care_cycle_policy;")=='true','Instalar SQL e manter política desligada')
            n=instalar_funcoes(a.pacote,a.funcoes,a.backup)
        else:n=restaurar_funcoes(a.funcoes,a.backup)
        print(json.dumps({'arquivos':n,'reiniciado':False}));return
    if a.acao=='piloto':
        pacote(a.pacote)
        exigir(all(isinstance(v,str) and re.fullmatch('[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}',v) for v in [a.shop,a.cliente]),'Informe UUIDs válidos da loja e do cliente')
        consulta=(a.pacote/'operacao/configurar-piloto.sql').read_text().replace(":'shop'","'"+a.shop+"'").replace(":'customer'","'"+a.cliente+"'")
        sql(a.db,a.banco,consulta);print('Escopo configurado; política continua desligada.');return
    if a.acao=='configuracao':print(json.dumps(conferir_configuracao(a.edge,a.servico)));return
    # A mesma trava cobre as rotinas; um timer não sobrepõe distribuição/reconciliação.
    lock=Path('/run/lock/bc-central-whatsapp.lock')
    with lock.open('w') as f:
        try:fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:print('{"estado":"ocupado"}');return
        print(json.dumps(rotina(a.edge,a.acao),ensure_ascii=False))

if __name__=='__main__':
    try:principal()
    except (Falha,KeyError,ValueError,TypeError,OSError,subprocess.SubprocessError) as e:
        # Não publicar mensagens de bibliotecas, ambiente, cabeçalhos ou SQL com dados.
        print('ERRO: '+str(e) if isinstance(e,Falha) else 'ERRO: operação não confirmada; revisar localmente sem expor segredos.')
        raise SystemExit(1)
