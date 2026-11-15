"""Falhas antes/durante a cópia e retorno, sem Docker, rede ou VPS."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('operador',Path(__file__).with_name('primeiro_acesso_telefone_operacao.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class TesteEntrega(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.package=self.root/'pacote';self.target=self.root/'funcoes';self.backup=self.root/'backup';self.package.mkdir();self.target.mkdir()
  self.old={'a/index.ts':b'original','b/index.ts':None};self.new={'a/index.ts':b'novo','b/index.ts':b'adicionado'}
  self.manifest={'contrato':'p122-primeiro-acesso-telefone-v1','arquivos':{},'base_funcoes':{}}
  for name,value in self.new.items():
   p=self.package/'funcoes'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(value)
   self.manifest['arquivos']['funcoes/'+name]=hashlib.sha256(value).hexdigest()
   before=self.old[name];self.manifest['base_funcoes'][name]=None if before is None else hashlib.sha256(before).hexdigest()
   if before is not None:
    p=self.target/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(before)
  self.save()
 def save(self):(self.package/'MANIFESTO.json').write_text(json.dumps(self.manifest))
 def tearDown(self):self.tmp.cleanup()
 def test_integridade_antes_de_copiar(self):
  (self.package/'funcoes/a/index.ts').write_text('corrompido')
  with self.assertRaises(m.Falha):m.instalar_funcoes(self.package,self.target,self.backup)
  self.assertEqual((self.target/'a/index.ts').read_bytes(),b'original');self.assertFalse(self.backup.exists())
 def test_divergencia_na_base_para_antes_da_primeira_alteracao(self):
  (self.target/'a/index.ts').write_text('outra entrega')
  with self.assertRaises(m.Falha):m.instalar_funcoes(self.package,self.target,self.backup)
  self.assertFalse((self.target/'b/index.ts').exists());self.assertFalse(self.backup.exists())
 def test_interrupcao_de_copia_restaura_arquivos_anteriores(self):
  original=m.trocar;count=0
  def falha(p,b):
   nonlocal count
   count+=1
   if count==2:raise OSError('falha fictícia')
   original(p,b)
  with patch.object(m,'trocar',side_effect=falha):
   with self.assertRaises(OSError):m.instalar_funcoes(self.package,self.target,self.backup)
  self.assertEqual((self.target/'a/index.ts').read_bytes(),b'original');self.assertFalse((self.target/'b/index.ts').exists())
 def test_retorno_exato_inclui_remocao_dos_arquivos_novos(self):
  self.assertEqual(m.instalar_funcoes(self.package,self.target,self.backup),2)
  self.assertEqual(m.restaurar_funcoes(self.target,self.backup),2)
  self.assertEqual((self.target/'a/index.ts').read_bytes(),b'original');self.assertFalse((self.target/'b/index.ts').exists())
 def test_retorno_nao_apaga_entrega_posterior(self):
  m.instalar_funcoes(self.package,self.target,self.backup);(self.target/'b/index.ts').write_text('entrega posterior')
  with self.assertRaises(m.Falha):m.restaurar_funcoes(self.target,self.backup)
  self.assertEqual((self.target/'a/index.ts').read_bytes(),b'novo')
 def test_caminho_externo_env_e_link_sao_recusados(self):
  for name in ['../fora','.env','x/._index.ts','/tmp/fora']:
   with self.assertRaises(m.Falha):m.caminho(self.package,name)
  (self.package/'atalho').symlink_to(self.target)
  with self.assertRaises(m.Falha):m.caminho(self.package,'atalho/a/index.ts')
 def test_cli_mutante_nao_roda_sem_autorizacao(self):
  with patch('sys.argv',['operador','sql-bc']),patch.object(m,'executar') as run:
   with self.assertRaises(m.Falha):m.principal()
   run.assert_not_called()
 def test_rotulo_da_imagem_nova_e_obrigatorio(self):
  with patch.object(m,'executar',return_value=b'2.3.7-bc.groups.6-brand.1'):
   with self.assertRaises(m.Falha):m.conferir_imagem_nova('evolution-local')
 def test_base_rejeita_digest_inesperado(self):
  with patch.object(m,'executar',side_effect=[b'sha256:'+b'a'*64,b'["outra@sha256:bbb"]']):
   with self.assertRaises(m.Falha):m.conferir_imagem_base('evolution-local')
 def test_identificador_nao_vira_comando(self):
  with patch.object(m,'executar') as run:
   with self.assertRaises(m.Falha):m.conferir_imagem_base('x;id')
   run.assert_not_called()
 def test_indice_e_filho_sao_aceitos_somente_com_config_exata(self):
  config=b'sha256:642f12b67e0bca28094255b55a62069f019fb14b112d95232cf72338d9d96e29'
  for digest in ['bb66b337063aa3fb82500642d0e332ff32f94a6a04692d1652b016ca735c9f3e','e8ce0f84dd4da9807284d1b0c80ae448bf9c37ee9bdfa29d97f604996943ca10']:
   with patch.object(m,'executar',side_effect=[config,json.dumps(['ghcr.io/proh2026media/bc-evolution-groups@sha256:'+digest]).encode(),b'amd64|linux|2.3.7-bc.groups.6-brand.1']):m.conferir_imagem_base('evolution-local')
 def check_base(self,identity,platform=b'amd64|linux|2.3.7-bc.groups.6-brand.1'):
  refs=b'["ghcr.io/proh2026media/bc-evolution-groups@sha256:bb66b337063aa3fb82500642d0e332ff32f94a6a04692d1652b016ca735c9f3e"]'
  with patch.object(m,'executar',side_effect=[identity,refs,platform]):m.conferir_imagem_base('evolution-local')
 def test_docker29_id_manifesto_exato(self):
  self.check_base(b'sha256:bb66b337063aa3fb82500642d0e332ff32f94a6a04692d1652b016ca735c9f3e')
 def test_docker29_id_indice_exato(self):
  self.check_base(b'sha256:e8ce0f84dd4da9807284d1b0c80ae448bf9c37ee9bdfa29d97f604996943ca10')
 def test_arquitetura_diferente_e_recusada(self):
  with self.assertRaises(m.Falha):self.check_base(b'sha256:bb66b337063aa3fb82500642d0e332ff32f94a6a04692d1652b016ca735c9f3e',b'arm64|linux|2.3.7-bc.groups.6-brand.1')
 def test_rotulo_novo_nao_e_base_antiga(self):
  with self.assertRaises(m.Falha):self.check_base(b'sha256:bb66b337063aa3fb82500642d0e332ff32f94a6a04692d1652b016ca735c9f3e',b'amd64|linux|2.3.7-bc.groups.7')
 def test_id_desconhecido_com_repodigest_correto_recusa(self):
  with self.assertRaises(m.Falha):self.check_base(b'sha256:'+b'f'*64)
if __name__=='__main__':unittest.main()



