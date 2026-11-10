# TI — central de canais e login por WhatsApp (P-117)

Data: 10/11/2026, Brasília. **Código e bancada preparados; instalação na VPS pendente.** Este pacote evolui a P-116 já instalada. Não reinstalar nº 101. Não envolve Flow, pagamentos ou ativação/compra de números.

## O que o dono pediu e o que foi implementado

- Administração → **WhatsApp**: inventário de canais, cadastro com nome legível, conexão por QR/código, busca e distribuição para uma barbearia inteira **ou um profissional específico**. Um canal por destino; um canal profissional por barbeiro. Não há agrupamento automático de dois barbeiros por número nesta versão.
- Transferência e liberação com confirmação, histórico administrativo, versão para impedir sobrescrita e validação do profissional na loja. Transferência cancela pendências do vínculo antigo, mantém o histórico na loja de origem e desliga o retorno por frequência. Envios em curso ou com resultado incerto bloqueiam transferência. Escolher novo destino na tela desmarca habilitação; habilitar exige escolha explícita.
- Canal específico atende avisos do profissional identificado no agendamento; avisos gerais e promoções sem profissional continuam no canal geral da loja. Quando existe canal específico pausado, não trocar silenciosamente para o geral. Cotas, consentimentos e proteção contra duplicidade da P-116 permanecem.
- Canal com reserva associada ou rota de reserva/pausa precisa voltar ao principal e retirar a reserva nos ajustes da loja antes de transferir. Não reutilizar o número da plataforma como canal de loja.
- Entrada → **Entrar com WhatsApp**: número pessoal previamente confirmado na conta, código de seis dígitos, entrada na mesma conta sem Google ou senha. Primeiro cadastro continua por e-mail/Google, seguido da confirmação do número no perfil. Não cria outra conta e não altera o telefone pessoal ao distribuir um canal.
- Códigos de acesso saem exclusivamente pela instância `PLATFORM_EVOLUTION_INSTANCE`, fora da fila visível às lojas. Dez minutos de validade, cinco erros no máximo, uso único, reenvio invalida o anterior, espera de 60 segundos e até três pedidos por número em 15 minutos. Número desconhecido tem resposta genérica e consome o limite, sem envio. Código correto revalida a posse confirmada e bloqueio da conta antes de gerar sessão nativa.

**Pré-requisito ainda existente:** Evolution/Baileys conecta uma conta WhatsApp já ativada. O número Salvy apenas cadastrado no painel não está ativado por esta entrega. Não prometer cadastro de WhatsApp somente pelo servidor usando Baileys.

## Arquivos

1. Migration nº **102**: `supabase/migrations/20261110150000_central_whatsapp_login.sql`.
2. `supabase/functions/platform-whatsapp/index.ts`.
3. `supabase/functions/whatsapp-channel/index.ts`.
4. `supabase/functions/auth-otp/index.ts`.
5. Novo módulo `supabase/functions/auth-otp/login.ts` — deve acompanhar o `index.ts` na mesma pasta.
6. Reversão: `supabase/rollback/20261110150000_central_whatsapp_login.sql`.
7. Teste exclusivamente de bancada: `supabase/tests/central_whatsapp_login.sql`.

As dependências `_shared/evolution.ts` e `_shared/whatsapp-pairing.ts` são as já instaladas na P-115/P-116. Não substituí-las por cópias antigas. O ZIP acompanha `COMMIT.txt` e `SHA256SUMS`; conferir antes de usar. O site segue a publicação normal pelo `origin`; isso não instala funções ou banco.

## Instalação na janela autorizada pelo dono

Este documento descreve a execução a revisar com o dono/TI; não autoriza disparos reais, números, mudança de credenciais ou operações em outros serviços.

1. Conferir commit/manifesto e serviço B&C `z2dbb7dkyzhc8vjiywq34mhn`. Confirmar nº 101 presente, com quatro colunas novas em canais e quatro na fila. **Nº 99/100 não fazem parte deste pacote** e não são pré-requisitos da nº 102.
2. Ler somente metadados: saúde, início dos containers, hashes das três funções anteriores, estado agregado da fila. Conferir `auth.users.deleted_at` e `banned_until`, usados pelo login. Confirmar internamente que `PLATFORM_EVOLUTION_INSTANCE` não está em `instance_name`/`backup_instance_name` de loja, sem imprimir segredos ou telefone pessoal.
3. Fazer backup completo do banco e cópia das três funções; se `auth-otp/login.ts` já existir, preservá-lo também. Guardar fora do volume público, diretório 700 e arquivos 600. Conferir tamanho, checksum e índice do dump.
4. Ensaiar **somente a migration** em `BEGIN … ROLLBACK`, com `ON_ERROR_STOP=1`, conferindo as funções/colunas novas. O arquivo de testes usa dados fictícios e é **só para bancada isolada**, não para produção.
5. Publicar os **quatro arquivos das funções primeiro**, preservando dono/modo. Reiniciar **somente o container das funções**; sem Restart/Redeploy do serviço, sem reiniciar banco/Auth/Evolution/proxy. Confirmar saúde e hashes. Essa ordem evita a central funcionar sobre o endpoint antigo, que ignorava `channel_id`. A tela também confere o identificador respondido antes de qualquer conexão central.
6. Aplicar somente a nº 102, em uma transação (`psql -X -v ON_ERROR_STOP=1 -1 -f ...`). Registrar horário, resultado e hashes. Não reaplicar nº 101 ou atualizar contadores de migrations fictícios; esse banco não mantém a tabela usual da Supabase CLI.
7. Conferir: `whatsapp_channels.label` e `routing_version`; `barbershop_id` aceita nulo; funções `platform_whatsapp_directory`, `platform_create_whatsapp_channel`, `platform_assign_whatsapp_channel`, `whatsapp_route_channel` e `request_whatsapp_login`; tabela `whatsapp_channel_movements` com RLS. `anon` não pode listar/configurar; `authenticated` não pode chamar `request_whatsapp_login` ou preparar envio.
8. Conferir cron normal e ausência de erros de importação (`login.ts`) nas funções. Não chamar o dispatcher manualmente. Não habilitar canais, transferir lojas reais, parear números ou enviar códigos de teste nesta etapa sem combinar o destinatário e o ensaio.

A migration mantém os vínculos existentes e não envia mensagens. Novos canais nascem livres e desabilitados. O login novo fica indisponível enquanto a função/migration não estiver instalada; e-mail, senha e Google continuam disponíveis.

## Homologação dirigida após instalar

Com contas e destinatário de teste autorizados, pela administração:

1. Abrir a central: listar canais existentes, sem transferir/conectar na abertura. O número da plataforma fica separado dos canais distribuíveis.
2. Criar canal de teste; conectar conta WhatsApp já ativada por QR ou código. Conferir o número conectado antes de distribuir. Isso não transfere o telefone pessoal de nenhum usuário.
3. Atribuir à Loja Teste ou a um profissional ativo dela, confirmar o destino e habilitar explicitamente. Conferir evento de agendamento: profissional com canal próprio usa esse canal; aviso geral usa o geral. Verificar também profissional sem canal próprio, consentimento e ausência de duplicidade.
4. Em fila sem envio em curso, transferir/liberar e conferir registro, cancelamento das pendências antigas e manutenção do histórico na origem. Não forçar transferência de resultados incertos; encaminhar para conferência. Abrir duas telas: a segunda gravação com versão antiga deve ser recusada.
5. Sair da conta e abrir “Entrar com WhatsApp”. Usar o **número pessoal confirmado da conta de teste**, não o número remetente da plataforma/loja. Conferir recebimento, código errado, acerto, destino de entrada correto e rejeição de reutilização. Não registrar código/token no relatório ou capturas.
6. Conferir login global e pelo domínio da loja; senha/Google/recuperação existentes; papel de cliente e profissional; dono sem acesso à central. Dispositivos físicos e envio real continuam pendentes até essa execução.

## Reversão

Somente se necessária e com janela acordada. Primeiro impedir novos trabalhos durante a reversão; não interromper nem recolocar mensagens `sending` em `pending`. Pausar/revisar canais profissionais e aguardar envios; o SQL de reversão recusa canais profissionais habilitados e fila `sending`. A versão nº 101 usa apenas o canal geral da loja.

Restaurar as funções anteriores junto da reversão SQL transacional e reiniciar somente o container das funções. Restaurar o frontend anterior pelo fluxo normal de publicação, com commit de reversão revisado. Manter inventário, colunas, histórico e desafios; não apagar dados. Não reaplicar a nº 102 cegamente após reverter: preparar migration de avanço.

## Evidências da bancada e retorno esperado

- Regressão SQL local: **1.304 PASS / zero falhas**, incluindo **32 cenários novos** de distribuição/login.
- Concorrência real no PostgreSQL local: oito pedidos de código simultâneos, **um aceito e sete limitados**.
- Reversão ensaiada em transação: central removida, despacho anterior preservado, tudo desfeito ao fim do ensaio.
- **485 testes automatizados aprovados**. Testes dos handlers: identidade do canal vem do banco, canal ausente/inválido recusado, número da plataforma separado, dono recusado e erros de login sem exposição de e-mail/código. Tipos, testes do app, eslint, formatação e montagem conferidos antes de publicar.
- Navegador Chromium com rede isolada e componentes reais: 320/390/834/1280, dois temas e três cantos; confirmação de transferência, erro conservando rascunho, banco antigo, login incorreto/acerto e sessão nativa simulada. Rotas reais `/auth` e `/platform?aba=whatsapp` abertas na bancada. Nenhuma mensagem real foi enviada.
- Referência do fluxo nativo: [generateLink](https://supabase.com/docs/reference/javascript/auth-admin-generatelink) e [verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp), documentação Supabase consultada em 10/11/2026.

Devolver relatório com “Responde a: 2026-11-10-ti-central-whatsapp-login-p117.md”, commit, hashes, backup, ensaio, horários de instalação/reinício, saúde e permissões. Separar instalação de homologação real, sem credenciais, códigos, tokens ou telefones completos.
