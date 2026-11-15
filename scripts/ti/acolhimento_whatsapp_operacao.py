#!/usr/bin/env python3
"""Incremental de acolhimento. Conferência só lê; alterações exigem --autorizado.
Não opera imagem, timer, segredos ou WhatsApp e nunca ativa o piloto.
"""
import argparse,hashlib,json,os,re,subprocess,tempfile
from pathlib import Path
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
    exigir(dados.get('contrato')=='p122-acolhimento-v1','Contrato de pacote inesperado')
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

def instalar_sql(raiz,db,banco):
    pacote(raiz)
    arquivo='operacao/bc-atomico.sql'
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

def principal():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('acao',choices=['conferir','base','sql-bc','funcoes','restaurar-funcoes'])
    p.add_argument('--pacote',type=Path);p.add_argument('--funcoes',type=Path);p.add_argument('--backup',type=Path)
    p.add_argument('--db');p.add_argument('--banco',default='postgres');p.add_argument('--edge');p.add_argument('--autorizado',action='store_true');a=p.parse_args()
    if a.acao in ['sql-bc','funcoes','restaurar-funcoes']:exigir(a.autorizado,'Ação exige autorização da etapa e --autorizado')
    if a.acao!='restaurar-funcoes':exigir(a.pacote is not None,'Informe --pacote')
    if a.acao=='conferir':m=pacote(a.pacote);print(json.dumps({'integridade':True,'arquivos':len(m['arquivos'])}));return
    if a.acao=='base':
        exigir(a.funcoes and a.db,'Informe --funcoes e --db');conferir_base(a.pacote,a.funcoes,a.db,a.banco);print('Base v5 conferida; nenhuma alteração.');return
    if a.acao=='sql-bc':
        exigir(a.db,'Informe --db');instalar_sql(a.pacote,a.db,a.banco);print('SQL concluído; política permanece desligada.');return
    exigir(a.edge and a.funcoes and a.backup and a.db,'Informe --edge, --funcoes, --backup e --db')
    exigir(re.fullmatch('[a-zA-Z0-9_-]{1,100}',a.edge),'Container inválido')
    exigir(executar(['docker','inspect','--format','{{.State.Running}}',a.edge]).strip()==b'false','Parar somente funções antes da troca')
    exigir(sql(a.db,a.banco,"select (not enabled)::text from public.whatsapp_care_cycle_policy;")=='true','Manter grupos desligados')
    if a.acao=='funcoes':
        exigir(sql(a.db,a.banco,"select to_regprocedure('public.record_care_cycle_observation_before_post_entry(uuid,uuid,jsonb,jsonb,text)') is not null;")=='t','Aplicar SQL incremental antes dos arquivos')
        n=instalar_funcoes(a.pacote,a.funcoes,a.backup)
    else:n=restaurar_funcoes(a.funcoes,a.backup)
    print(json.dumps({'arquivos':n,'reiniciado':False}))
if __name__=='__main__':
    try:principal()
    except (Falha,KeyError,ValueError,TypeError,OSError,subprocess.SubprocessError) as e:
        print('ERRO: '+str(e) if isinstance(e,Falha) else 'ERRO: operação não confirmada; revisar localmente sem expor segredos.')
        raise SystemExit(1)
