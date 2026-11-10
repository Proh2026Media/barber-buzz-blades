# TI — números existentes, principal e reserva na central (P-118)

10/11/2026, Brasília. Código e bancada preparados; **migration nº 103 pendente na VPS**. Evolução da P-117/nº 102 instalada às 13:47:04–13:47:05. Não reinstalar nº 101/102, não aplicar nº 99/100, não operar Flow.

## Problema e resultado

O dono não encontrava a configuração: a Central de WhatsApp distribuía números, mas a reserva ficava na ficha da loja, exigindo identificador técnico. O site publicado já continha a P-117 e os textos “número” (conferência HTTP própria); não era apenas cache ou falta de publicação.

Agora a central prioriza **Números cadastrados**, com filtros Todos, Disponíveis, Vinculados e Reservas. “Adicionar outro número” fica recolhido. Selecionar um existente permite atribuir/transferir à loja ou ao profissional, sem criar outro número. A identificação pessoal para login permanece independente.

- Número livre: escolher **Principal** para atribuir um destino, ou **Reserva** para escolher um principal já vinculado e sem reserva.
- Principal: seção **Principal e reserva** visível na central, reserva selecionada pelo nome/telefone cadastrado e opção explícita de qual número usar. Válido para loja inteira **ou profissional específico**.
- Reserva: mostra de quem é e oferece acesso ao principal e à conexão da própria reserva. Na ficha da loja, um atalho leva à mesma central, sem editor técnico duplicado.
- Alterar a reserva no formulário volta a seleção para Principal; guardar uma reserva não a ativa. A troca para reserva exige confirmação de falha técnica. Não há rodízio, troca automática nem substituição automática por banimento.
- Exclusividade, versão, histórico administrativo e bloqueio durante envio/resultado incerto. Uma reserva vinculada não pode simultaneamente virar principal, ganhar destino próprio ou ser habilitada diretamente.
- Reservas legadas por identificador permanecem preservadas e reconhecidas como “Reserva configurada pela TI”; podem ser mantidas, retiradas ou substituídas explicitamente. Não se presume conexão viva pelo status salvo.

Esta entrega usa **números já cadastrados no B&C**. Não importa automaticamente instâncias avulsas da Evolution nem linhas do painel Salvy. Conta WhatsApp já ativada continua necessária para parear; cadastrar no B&C não ativa ou compra número.

## Instalação

Arquivo único a aplicar: `supabase/migrations/20261110170000_whatsapp_reserva_visual.sql`, nº **103**. **Nenhuma função Edge precisa ser substituída ou reiniciada.** Frontend pelo fluxo normal do origin. O ZIP inclui migration, reversão, teste exclusivo de bancada, este roteiro, `COMMIT.txt` e `SHA256SUMS`.

Na janela combinada com o dono:

1. Conferir manifesto e serviço B&C `z2dbb7dkyzhc8vjiywq34mhn`; nº 102 presente. Ler saúde e estado agregado da fila; não imprimir segredos, telefone ou payload.
2. Fazer backup completo do banco, fora do volume público, diretório 700/arquivo 600, com tamanho, hash e catálogo conferidos. Guardar definições anteriores de `guard_whatsapp_delivery_config`, `guard_whatsapp_assignment`, `configure_shop_whatsapp_delivery` e `platform_whatsapp_directory`.
3. Ensaiar **somente a migration** com `BEGIN … ROLLBACK` e `ON_ERROR_STOP=1`. Não executar o arquivo de `supabase/tests/` em produção. Confirmar ausência da nova tabela/funções após ROLLBACK.
4. Aplicar somente a nº 103 em uma transação (`psql -X -v ON_ERROR_STOP=1 -1 -f ...`). Não criar tabela fictícia de controle de migrations.
5. Conferir `platform_configure_whatsapp_number(uuid,bigint,uuid,text,boolean,boolean,boolean)` disponível para authenticated com validação interna de platform_admin; anon sem EXECUTE. Helper `configure_whatsapp_number_internal` sem EXECUTE para anon/authenticated/service_role. Tabela `whatsapp_number_config_history` com RLS e leitura administrativa.
6. Conferir vínculos, reservas, modos e fila iguais ao prévio; a migration não configura nenhum número. Saúde e cron normais, sem chamar dispatcher manualmente. Não há necessidade de reiniciar containers, Redeploy ou mudar Evolution/Auth.
7. Abrir a central com sessão administrativa, **somente leitura**: números existentes e filtros presentes. A seção Principal e reserva deve reconhecer suporte instalado. Conferir entrada pela ficha da loja abrindo o número correspondente na central.

Não parear, habilitar, transferir ou enviar mensagens como parte da instalação. Esses atos pertencem à homologação com contas e destinatário combinados.

## Homologação dirigida

Usar números de teste já existentes, sem comprar ou cadastrar outros se já houver inventário suficiente. Combinar os números e o destinatário com o dono antes de executar.

1. Selecionar número existente livre e atribuir à Loja Teste; conferir que o total de números não aumentou. Testar também profissional ativo da loja. Não usar o telefone pessoal do login como remetente.
2. Selecionar outro número livre como reserva: principal continua em uso. Conferir o cartão Reserva apontando para o principal, exclusividade e rejeição em outro destino.
3. Conectar a conta WhatsApp já ativada da reserva pelo cartão próprio. Confirmar o número antes de qualquer envio real.
4. Com falha técnica de teste combinada e fila sem incerteza, escolher Reserva, confirmar e salvar. Testar apenas um aviso esperado ao destinatário autorizado; conferir a instância realmente utilizada sem expor códigos/tokens. O login pessoal segue pelo número da plataforma.
5. Voltar ao Principal explicitamente. Retirar a reserva e conferir que ela retorna a Disponíveis e pode ser reutilizada em outra loja/profissional. Nada de apagar número para reutilizar.
6. Duas telas com a mesma versão: a segunda gravação deve ser recusada. Conferir preservação do rascunho em erro e histórico administrativo. Não forçar mudança com envio em andamento/incerto.
7. Conferir celular, tablet e computador físicos; na tela estreita, selecionar um número leva aos detalhes automaticamente.

## Reversão

Arquivo `supabase/rollback/20261110170000_whatsapp_reserva_visual.sql`, sempre em transação e janela combinada. Recusa reservas cadastradas ainda vinculadas e envios em andamento/incertos. Primeiro voltar explicitamente ao principal, retirar as reservas cadastradas e resolver incertezas, sem reenviar automaticamente. Não interromper envio em curso.

Restaura as quatro funções anteriores, remove as duas RPCs novas e mantém a tabela de histórico, números e dados. A capacidade `number_reserves` deixa de aparecer; frontend mostra necessidade de atualização em vez de operar com contrato antigo. O editor antigo da ficha, se necessário, exige reversão separada do frontend pelo origin. Não reaplicar nº 103 cegamente após reversão, pois o histórico é preservado; preparar migration de avanço.

## Evidências e retorno

- Regressão no PostgreSQL local: **1.337 PASS / zero falhas**, incluindo 33 cenários novos. Preparação do envio escolhe a instância cadastrada da reserva, sem enviar mensagem.
- Concorrência real local: dois principais disputando uma reserva simultaneamente; um aceito, outro recusado.
- Reversão ensaiada com ROLLBACK: endpoint novo removido e configuração legada preservada.
- Navegador isolado com componentes reais: seleção/vínculo, reserva de profissional, troca com confirmação, retirada/reuso, falha mantendo formulário, versão de banco anterior e nenhuma mutação ao abrir. Larguras 320/390/834/1280, claro/escuro, três cantos.
- Tipos, testes automatizados, eslint, formatação e montagem conferidos antes do envio. Sem mensagem real nesta entrega.

Devolver relatório com “Responde a: 2026-11-10-ti-whatsapp-reserva-visual-p118.md”, commit/hashes, backup, ensaio, horário da aplicação, permissões, saúde e situação da homologação. Separar **instalação** de **teste real**. Não incluir credenciais, tokens, códigos ou telefones completos.
