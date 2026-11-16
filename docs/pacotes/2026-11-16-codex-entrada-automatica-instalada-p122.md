# P-122 — entrada automática instalada em 16/11/2026

O titular autorizou a implantação com pausa de manutenção e o teste limitado à Loja Teste/Alyson Viana (conta Gmail já escolhida). Esta devolutiva substitui o estado “somente local” da entrega anterior.

## Backend instalado

Backup completo validado com pg_restore --list e SHA-256 `804395400d6df4e779fb37ca8aa339fc503b0ad52e7c7aee41446004559a5a57`, guardado na VPS em pasta privada `/root/bc-p122-entrada-20261116-66b6cbc/`. SQL `20261116002000_whatsapp_entrada_servidor.sql` aplicada em transação após ensaio com rollback, SHA-256 `43e4503a18842d770a927ad1690a29ae40b8edbd0cbdea3a9f0ca7e91e4e8adf`. OIDs, owners e ACLs dos cinco contratos anteriores e identidades de números/instâncias preservados.

Seis fontes Edge instaladas por hash (três novas e três alteradas). Reiniciado somente o container de funções; prontidão medida em 12,187 segundos. Banco, autenticação e proxy não foram reiniciados. A rotina privada usa segredo existente, sem identidade fornecida pelo corpo HTTP, e preserva isolamento, pausa, prazos, leases e CAS. Não envia OTP automaticamente.

Novo `bc-primeiro-acesso.timer`, separado dos três timers anteriores, instalado e habilitado; flag background ligada sob pausa. Sob pausa, a rotina devolveu states vazio. Intervalo de três segundos depois da execução anterior, sem sobreposição; esse intervalo não promete entrega em três segundos.

## Evolution e pedido pendente

Imagem final `2.3.7-bc.groups.7-entry.3`, fixada pelo índice OCI `sha256:5b9093e6ab17fe7f82dfbc7be45a17eac7ab72f2bb072bce7ab640350747e001`. Filho AMD64 `sha256:c540fe5fc71fa1c7f5b13e187fa0886af5a97552691b3ed683b062e1e847bd2d`; config `sha256:47e4b2376344d526ed5612d574dac3ec72e552e683389932a267641ddc16b13f`. Nenhuma migration Evolution nova. Recriado somente o serviço api da Evolution; oito instâncias preservadas e quatro abertas recuperadas. Prontidão da recriação final em 21,5 segundos; a intermediária .2 levou 19,08 segundos. Env e quatro mounts idênticos.

Causa comprovada: o resolvedor reverso PN/LID consultava apenas cache; grupos sem conversa privada podiam não ter o vínculo. A nova consulta autoritativa usa o PN já comprovado na intenção, sem equivalência por dígitos, nomes ou dados de evento.

Às 14:22:50 BRT, o pedido pendente foi reconhecido: total=1, matching=1, unresolved=0, other=0. O prazo antigo estava vencido. A conferência não devolveu convite, não modificou diário/prazo e não aprovou, fez bind ou enviou código.

A interface inclui “Retomar com este número”: clique explícito do cliente encerra a intenção vencida e inicia outra no mesmo grupo/telefone/composição, após releitura das versões. Não renova consentimento por polling ou SQL. Não precisa pedir entrada de novo ou redigitar o telefone. Entrada não substitui confirmação por OTP.

## Verificações

718 testes B&C, tipos, lint, formatação e montagem aprovados; 66 verificações SQL novas e 117 regressões anteriores, com rollback integral; 60 regressões Evolution sem rede e cinco testes de contagens. Sessenta composições de UI (quatro estados, três modos de canto, cinco larguras), com rede externa bloqueada e sem mutações/OTP ao montar ou acompanhar. A resolução npm da família typescript-eslint foi fixada em 8.59.0, versão instalada e testada, após falha ETARGET no build remoto.

Marca, Flow, .env original e outros projetos preservados. OTP/login reais ainda não homologados.

## Publicação e corte final

Frontend final da origem `ca3c01631a6bb4ae6c3299d16f6561580b75c693` publicado pelo build Hostinger `01a1e568-caf4-723f-a644-233644335ee8`, concluído às 14:35:32 BRT. Archive SHA-256 `f66eb35a4e55176cc5a66a702c2951fc0cc7722516d90702207afae793d711c8`, somente fonte desse commit, sem .env/credenciais. Espelho do GitHub permaneceu na fila; auto-deploy Git preservado. Archive consumido pelo build, ausente da raiz pública após publicação. Módulo público `ArenaApp-D-M5Eno1.js` com retomada explícita, HTML real e manifesto com ícones conferidos.

Liberação realizada na sessão real do admin após conferência automática dos dois números, confirmando Loja Teste/Alyson Viana. Persistiu após recarregar. Corte às 14:37:08 BRT: pausa=false, ciclos/assistência/background=true, política25, isolamento=true; o par autorizado é aceito e outra loja ou cliente é recusado. Novo timer active/enabled; distribuição, expurgo e grupos antigos inactive/disabled. Às 14:37:30, pedido novamente matching=1, sem alteração do diário/prazo ou convite.

Não há instalação pendente para a TI nesta entrega. Próxima ação é do cliente na conta Gmail da Loja Teste: atualizar a página, abrir Continuar confirmação e tocar “Retomar com este número”. O pedido já existente não precisa ser reenviado. Acompanhamento passa a ocorrer no servidor, sem precisar manter a tela aberta. Código depende da conclusão segura da entrada e continua exigindo ação explícita. Recebimento do OTP e login reais permanecem pendentes de homologação pelo titular.
