# P-122 — liberação por barbearia e segundo piloto

Pedido aprovado: preservar Loja Teste/Gmail e preparar Loja Teste B com a mesma conta e os números principal 8585/reserva 5627. Nenhuma liberação geral autorizada.

## O que muda

Uma lista privada de liberações separa loja e cliente. A primeira ampliação copia atomicamente o par anterior; não remove os IDs do piloto nem usa ausência de IDs como autorização geral. Pausar uma loja ou retirar um cliente não interrompe outra loja. Exclusão de titular, retirada do vínculo e bloqueio da conta negam o acesso mesmo com autorização antiga. Login sem loja só aceita titular com pelo menos uma loja liberada; cada rota continua passando pelas provas do próprio grupo.

O acompanhamento pelo servidor usa o mesmo escopo. A fila mantém quatro vagas e intercala lojas antes de repetir uma loja cheia, sem alterar consentimento, prazos, leases ou limites de envio. A liberação não cria grupo, aprova entrada, solicita código ou confirma telefone. Dois administradores da plataforma, foto/nome antes da entrada e descrição/acolhimento/fixação após a entrada continuam obrigatórios. Grupo original e validade anual são preservados.

A interface administrativa permite conferir os números do par loja/cliente, liberar, pausar a loja e retirar acesso. Toda gravação exige confirmação e versões atuais da liberação e políticas. Leituras não ativam. Nesta etapa, as liberações são por clientes selecionados; não há botão para liberar todos.

## Artefatos e instalação

- Única SQL: `supabase/migrations/20261117001000_whatsapp_liberacao_por_barbearia.sql`.
- Frontend: `CareShopRelease`, contratos `shop-release` e quatro dicionários (en-GB herda).
- Sem Edge, imagem, migration Evolution, segredo, timer novo ou reinício.
- A SQL guarda os cinco corpos anteriores por MD5 e toma as mesmas travas de saída e distribuição. Instalar em uma transação `psql -X -v ON_ERROR_STOP=1 -1`, com `lock_timeout=10s` e `statement_timeout=60s`. Não repetir se a coluna ou tabelas já existirem.
- Antes: `scripts/ti/liberacao-lojas/backup.sql`; guardar JSON em diretório privado 0700 e conferir sua leitura. Não publicar esse backup.
- Depois: verificar OIDs/owners/ACLs e política/pausa byte a byte, descontando somente a coluna nova, com `verificar-instalacao.sql`. A instalação nasce `shop_release_mode=false` e lista vazia, mantendo o piloto anterior.
- Primeiro vínculo novo: somente admin autenticado, `care_shop_release_admin('allow', {...})`, depois de conferir os dois números. CAS inclui `version`, `policy_version` e `pause_version`. Não fabricar claims ou executar a função como cliente.
- Não reaplicar 105–117, SQLs anteriores, ZIP antigo, imagem ou funções já homologadas.

## Verificações realizadas localmente

729 testes de código aprovados; tipos, lint e montagem aprovados. 24 testes SQL novos e 86 regressões do piloto/entrada/login (110 no conjunto). Ensaio transacional com os cinco corpos exatos reconstruídos a partir das migrations e hashes conferidos com produção: OIDs, owners, ACLs e escopo preservados; rollback integral. Interface com API/sessão fictícias e rede externa bloqueada: 320, 390, 768, 1024 e 1440 px nos três modos de canto; leitura sem ativação, cancelamento, liberação de uma loja e rejeição de versão antiga. Capturas de 390/1440 inspecionadas. Emulação não equivale a teste físico no iPhone.

## Segundo teste e limite de conclusão

Loja Teste B não tinha grupo nem vínculo da conta Gmail. Preparar somente o vínculo de cliente; não registrar aceite em seu nome. Distribuição: 8585 principal, 5627 reserva, avisos comuns/retorno desligados. Usar as identidades já controladas; não parear novamente. Preservar distribuição automática e três timers gerais desligados; acompanhamento de primeiro acesso continua na rotina já instalada.

O titular precisa abrir o perfil da Loja Teste B, solicitar o grupo com aceite explícito, entrar pelo número pessoal final 4593 e concluir o código no site. Observar a criação do zero, dois administradores, acolhimento após entrada, confirmação, login e a continuidade do grupo da primeira loja. Não declarar esse piloto homologado a partir de testes locais ou gerar códigos pelo titular. Só depois avaliar lotes maiores; não liberar todos nesta entrega.

## Reversão

Para interromper apenas a segunda loja, usar `care_shop_release_admin('pause', ...)` com versão atual na sessão administrativa. Se necessário, a pausa global existente continua soberana e bloqueia ambas. Não apagar grupos, intenções, auditoria ou evidências. Antes de reverter contratos SQL, pausar o motor e verificar operações em andamento; restaurar os cinco corpos guardados e definir `shop_release_mode=false` sob as mesmas travas, mantendo o par original. Conservar as tabelas novas privadas como evidência. Não reverter para envio privado, remover o isolamento ou restaurar política inteira sobre decisões posteriores.

## Registro da implantação

17/11 às 16:16:25 BRT: SQL instalada pelo Codex sob a autorização de liberação por loja/segundo teste. Cinco OIDs/owners/ACLs e política/pausa anteriores preservados pelo verificador dentro da transação. Nenhum reinício. Instalação ainda não amplia o escopo. Backup privado: `/root/bc-liberacao-lojas-20261117/before.json`, SHA-256 `7907be320a8f742ec0ac5cd5f825f50cfe4877328c18a81d9137c05f51dd9aa9`. SQL fonte: `470b5998dd3c87072afae152dc54b23783ce0c9dc6d33e599cc70822eaa6d16b`; instalador com verificação: `aa3491b45cfca3c8b5ddf807e3d911c82ee27c19121a1cc19f17875a54e5c494`. O mesmo instalador também passou no segundo clone limpo de140 migrations e foi integralmente revertido.
