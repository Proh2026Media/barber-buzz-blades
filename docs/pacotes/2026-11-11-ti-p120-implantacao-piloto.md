# TI/Guardião — implantação preparada e piloto P-120

## Autorização e objetivo

O dono autorizou nesta conversa: **“faça isso, pode implementar os 4 itens”** (cadastro, bancada, piloto e implantação). Depois informou: **“preciso conectar um numero da plataformas”**. Não pedir novamente uma autorização genérica para preparar/publicar a imagem, instalar as migrations/funções ou configurar o piloto. Faltam dados operacionais reais: número escolhido e cliente de teste consentido. A autorização não identifica esses contatos nem permite testar com qualquer cliente.

Este roteiro substitui o estado de **somente revisão** do pacote anterior, não suas proteções técnicas. Não instalar se conferências falharem. Não operar Flow; não enviar WhatsApp privado, marketing ou grupos de clientes reais como ensaio. **Sem push na main nesta entrega.** Backend, frontend e piloto precisam de implantação coordenada.

## O que chegou da TI e o que foi resolvido

Relatório `relatorio-ti-piloto-login-grupos-2026-11-11.md`, 22:41–22:45: pacote anterior íntegro, PostgreSQL, patch v2 aplicável, 29 testes, inventário e limites. Não repetir o inventário sem mudança observável. A referência antiga é o commit `66fcaf3` e o ZIP com hash `b9ab037c…64cd`.

- Novo cadastro `/cadastrar`: conta de e-mail confirmada/Google, criação transacional na conta existente, intenção de sociedade, fuso e aceite. Não pede nem confirma WhatsApp. Rascunho na aba preservado; pedido repetido/concorrente não duplica. A loja abre pelo vínculo devolvido, inclusive para dono de várias lojas.
- **Nova migration nº 110:** `20261111230000_cadastro_loja_autenticado.sql`, RPC `register_my_barbershop`, tabela privada `shop_registration_requests`. Nº 105–110 ainda não instaladas. Nº 101–104 não reaplicar.
- `register-shop` antigo agora devolve 410 com orientação para autenticar, sem gerar desafio, conta ou enviar mensagem. Publicar essa função junto da troca de frontend. Não restaurar OTP privado como contingência.
- Patch Evolution permanece **exatamente v2**, SHA-256 `894d6d5744f44edc1827f26586ddbfeda5d2ce55e15676c9b28bf7da6b169429`. Não houve nova alteração do runtime da extensão.

## Evidências desta rodada

- B&C: 568 testes unitários, 1.553 verificações SQL; cenário adicional com duas conexões simultâneas devolveu uma única loja e o mesmo vínculo. Tipos, lint dos alterados e montagem conferidos.
- Verificador geral: tipos, testes e lint passaram; Prettier acusou apenas `.vscode/extensions.json`, preexistente e fora da entrega. Montagem executada separadamente e aprovada; formatação dos arquivos da entrega conferida separadamente.
- Interface: 55 verificações em 320/390/768/1024/1440 px; entrada anônima, retorno do login, conta aberta, falha de rede, recarga e retomada com a mesma chave, resultado e destino do painel. Dados e rede fictícios.
- Envio de código: **27 cenários integrados**, PostgreSQL real local e Evolution fictícia. Confirmação/login usam o grupo; não houve mensagem WhatsApp real.
- Evolution: quatro testes com PostgreSQL passaram em três execuções. A preparação anterior esperava só o socket Unix do banco, que também existe durante a inicialização temporária: passou a esperar TCP antes dos testes. O patch/runtime não mudou.
- Reinício: **13,413 s / 13,373 s / 13,472 s**, imagem AMD64 local sob emulação no Mac ARM64, API sem instâncias/sessões, volume sentinela preservado. Inclui parada, recriação e prontidão HTTP autenticada. **Não mede reconexão de WhatsApp nem prevê tempo na VPS.** Script em `integrations/evolution/grupos-v2/testar-reinicio-local.py`; rede Docker interna, sem internet. A raiz `/` consulta a versão do WhatsApp externamente e não serve como sondagem isolada; usada `instance/fetchInstances`, vazia.

## 1. Disponibilizar a imagem

O acesso GitHub desta máquina tem `repo`, `workflow`, `read:org`, `gist`, **sem `write:packages`**; não há login Docker em registry configurado. Portanto a publicação remota não foi executada. Não confundir ID local com digest disponível à VPS.

O Guardião faz login Docker no registry por seu meio protegido (não colocar credencial em arquivo de entrega ou argumento aberto). Destino sugerido: `ghcr.io/proh2026media/bc-evolution-groups:2.3.7-bc.groups.2`, pacote dedicado, visibilidade privada. A máquina de construção precisa poder publicar; a VPS precisa poder ler. Não tornar o pacote público para contornar autenticação.

Em bancada com Docker/Buildx, usando checkout que contenha a revisão-base oficial:

```sh
python3 bc/integrations/evolution/grupos-v2/publicar-imagem.py \
  /caminho/checkout-evolution \
  ghcr.io/proh2026media/bc-evolution-groups:2.3.7-bc.groups.2 \
  /caminho/novo/resultado-imagem-p120.json
```

O script extrai **a base exata** para pasta temporária, confere o patch, aplica v2 uma vez, constrói AMD64 e publica; não usa o estado modificado do checkout nem `.env`. O JSON contém referência fixa `@sha256:…`, revisão e hash, sem credenciais. Script preparado e validado sintaticamente; publicação não ensaiada por falta de credencial de registry. Conferir manifesto remoto/plataforma e fazer pull na bancada antes de marcar apto. Registrar digest do registry, que pode diferir do ID local.

## 2. Instalação coordenada — flags desligadas

1. Conferir SHA256SUMS do novo ZIP e registrar COMMIT.txt. Não misturar frontend antigo com backend novo.
2. Preservar backups do PostgreSQL Evolution, banco B&C, funções atuais, configuração e volume de instâncias, com teste de leitura/restauração em bancada. Usar inventário TI já disponível; **não recriar stack Supabase/proxy/VPS**.
3. Reproduzir migrations/testes em banco descartável antes da janela. A nova nº 110 aceita reaplicação; cada teste SQL dentro de BEGIN/ROLLBACK. Fonte: `docs/guia/banco-e-implantacao.md`. Teste específico: `supabase/tests/cadastro_loja_autenticado.sql` (15 verificações).
4. Evolution: aplicar **duas migrations PostgreSQL**, operações e códigos/trava, preservando diários/leases. Nunca aplicar as cópias MySQL. Fixar imagem pelo digest remoto e recriar **somente API Evolution**, preservando volumes. Registrar indisponibilidade e estado de cada instância real; não prometer o tempo da bancada.
5. B&C: aplicar nº **105→106→107→108→109→110**, uma por vez em transação. Não reaplicar 101–104. Instalar `auth-otp`, `whatsapp-groups`, `whatsapp-dispatch`, `register-shop` e dependências `_shared` do mesmo pacote; preservar demais funções. Reiniciar somente container das funções quando necessário.
6. Configurar segredos de API e webhook distintos, somente backend, conforme README v2 e roteiro de revisão anterior. Nenhum segredo acompanha este ZIP. `WHATSAPP_OTP_HMAC_KEY` é obrigatório.
7. Publicar frontend deste mesmo commit pela fonte oficial (`origin`), **somente depois** das etapas anteriores e tipos/montagem aprovados. Não copiar apenas funções para a VPS e declarar o frontend instalado; não enviar só para `hostinger`. A main não foi alterada neste trabalho.
8. Testar cadastro de loja com conta fictícia consentida; verificar intenção/fuso/termos, destino correto e ausência de mensagem privada. Flags de grupos continuam desligadas. Autenticação por e-mail e Google permanece disponível.

## 3. Conectar o número da plataforma

O dono informou que ainda precisa conectar o número. Usar a Central WhatsApp do B&C → número da plataforma/códigos de acesso, identificando a instância correta da configuração `PLATFORM_EVOLUTION_INSTANCE` sem expor seu valor no relatório aberto.

- Se o número ainda não foi ativado no aplicativo WhatsApp, ativá-lo primeiro. QR ou código de pareamento da Evolution vincula uma conta WhatsApp existente; não registra sozinho um número apenas existente na Salvy. O pareamento por código é diferente do OTP de login de seis dígitos.
- O titular/TI realiza o pareamento no aparelho que controla o número. Não encaminhar QR, códigos ou credenciais em relatório. Não escolher automaticamente uma das três pastas UUID do inventário nem criar instâncias repetidas.
- Conferir que somente plataforma/TI acessa aparelho/sessões, API/painel, logs, exportações e backups. Profissionais não podem ver o grupo ou seus códigos. A ausência de Chatwoot não comprova sozinha isolamento.
- Número restrito/desconectado não participa do piloto. Não trocar automaticamente por reserva para contornar restrição.
- Registrar apenas nome interno e sufixo do número no relatório compartilhado, situação da conexão e prova sanitizada de isolamento. Depois escolher cliente de teste consentido com conta e telefone pessoal próprios.

## 4. Ativar e testar o piloto restrito

Só com imagem instalada, webhook configurado, instância conectada/isolada e cliente indicado:

1. Limitar `BC_GROUPS_INSTANCES` à instância de piloto; preencher mapa de JIDs autorizados. Confirmar contrato `bc-groups-v2` e segredo correspondente. Habilitar somente configuração/loja/grupo de teste; não ativar todos os clientes.
2. Configurar webhook com `x-bc-group-secret`, diferente do segredo da API. Instalar reconcile autenticado por serviço, sem sobreposição; não é rotina de envio de códigos. Nunca imprimir a chave de serviço na linha de comando ou relatório.
3. Cliente entra primeiro por e-mail/Google, solicita grupo, abre convite e é admitido. Grupo só com cliente + números autorizados da plataforma. Nome alterado conserva o JID. Sem prova da composição, não enviar.
4. Usar **Receber código no grupo** para confirmar o telefone. O titular lê o código no grupo e informa no B&C. Confirmação de aceitação pela API não comprova entrega: observar o recebimento no grupo. Não relatar o código.
5. Sair e testar login por WhatsApp: novo código no mesmo grupo válido, uso único; código incorreto/vencido recusado. Confirmar que não chegou mensagem privada.
6. Conferir cliente ausente/terceiro/pausa bloqueiam, perda de resposta não reenvia, reconciliação não recria grupo incerto e acesso de profissional não expõe chat/OTP. Testar segunda barbearia com mesma conta sem misturar pontos/permissões.

## Interrupção e retorno

No primeiro desvio de segurança/composição/entrega, desligar flags do piloto e preservar evidências. Sem apagar sessões, grupos, diário ou `BcGroupLease`. Voltar imagem somente após conferir compatibilidade com as tabelas extras; não restaurar dump sobre dados novos automaticamente. Se frontend precisar voltar, manter o cadastro antigo desabilitado, com acesso por e-mail/Google, até correção coordenada; não reabrir OTP privado.

Devolver **um relatório** respondendo a este roteiro e ao COMMIT.txt: digest publicado/instalado, backups, migrations/funções efetivamente aplicadas, frontend servido, medição real, conexão/isolamento, testes aptos/não aptos e bloqueios. Distinguir código aceito de mensagem entregue no grupo. Não enviar dados de clientes, códigos, QR ou segredos. Não há tarefa para Claude/Flow.
