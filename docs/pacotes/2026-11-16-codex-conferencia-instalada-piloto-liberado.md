# P-122 — conferência instalada e piloto da Loja Teste liberado

**Concluído em 16/11/2026 pelo Codex. Não há instalação pendente desta entrega para a TI.**

## Autorização e resultado

O titular autorizou: “Sim, pode instalar a SQL e publicar a interface, mantendo o piloto e os envios ligados e o teste restrito à Loja Teste.” Os controles estavam desligados na entrada da janela. A instalação conservou a pausa; depois, com login feito pelo próprio titular, o Codex acionou a conferência e confirmou a liberação pelo fluxo atômico existente da interface. Não foram fabricados JWTs ou simulada identidade de usuário na SQL de produção.

**Estado validado às13:02:27 BRT:** Loja Teste → Alyson Viana, conta Gmail de teste; pausa global=false versão24; ciclos/enrollment=true; assistência=true; política versão20; isolamento durável=true; distribuição=false. Regra de escopo permite somente esse par loja/cliente e recusa outras lojas e outros clientes, inclusive quando compartilham números. Auditoria confirmou ativação pela conta admin esperada. Três timers de grupos/distribuição/expurgo seguem inactive/disabled. Sending/incertos0 no corte.

**Este estado supera os registros anteriores de “tudo pausado”. Não pausar o piloto automaticamente apenas para repetir verificações de instalador.** A homologação de confirmação/login ainda não foi realizada.

## Implantação

- Fonte funcional: `886d0f0b69b317137ac2b3b862a7833d197f5253`, enviada à origem/main e confirmada no espelho. Registros posteriores podem acrescentar somente documentação.
- Pacote aplicado: `BC-P122-Conferencia-Automatica-2026-11-16.zip`, SHA-256 `43901c3d3ea07b14083674b53fa404350e83721cff650cbc5e6ca51f5b0e7670`. Não alterar ou reinstalar o pacote.
- Uma SQL nova, `20261116001000_whatsapp_conferencia_piloto.sql`, SHA-256 `3a9b486f58c2294ccf4ce4166eaa8e4930e6fe439c7c9c23d54601618bafae27`. Quatro definições/OIDs/owners/ACLs anteriores preservados, RPC nova conferida depois da instalação.
- Pasta privada da janela: `/root/bc-p122-conferencia-20261116-886d0f0/`. Backup completo validado em `backup-antes/antes.dump`, SHA-256 `b6443d3ca311bea148c93c65d913a934114680d419a15868cd0b88c3319a3477`; evidências privadas de antes/instalação/ativação na mesma pasta. Backup não deve ser enviado ao chat/repositório.
- Operação de instalar+backup+conferência:7,208s; isso não é medição de indisponibilidade. Nenhum container reiniciado; todos os IDs/StartedAt preservados. Nenhuma alteração de Evolution, Edge, variável, Compose, segredos ou proxy.
- Publicação do frontend conferida às12:59:26 BRT: HTTP200 e módulo `PlatformShell-C3extEGY.js`, SHA-256 `970e901e0e844098a30ba9f6e552146803d6a46bc27007d26caaff8e69101eec`, contendo o fluxo de conferência automática. Sincronizações hub/blindagem aprovadas.

## Uso validado na sessão real

Com sessão real de admin, um clique em Conferir liberação consultou as duas contas do atendimento sem navegar aos números. O resultado passou a “Conferência concluída” e habilitou Liberar teste. O Codex confirmou somente Loja Teste/Alyson Viana, o painel mostrou Teste liberado e o estado persistiu depois de recarregar. A leitura no banco confirmou escopo, ator da auditoria e controles.

O procedimento não iniciou grupo novo, reconectou WhatsApp ou enviou código/mensagem. Não se clicou em Solicitar conferência, Encerrar grupo anterior ou em ações de outros destinos. O atendimento atual continua aguardando a entrada do cliente, com dois números autorizados e validade até15/11/2027. Código permanece condicionado à entrada, acolhimento e demais provas existentes.

## Próximo passo do titular

Na conta `alyson21viana@gmail.com`, usando o WhatsApp pessoal final4593, entrar por Google/e-mail na Loja Teste e abrir **Continuar confirmação**. Seguir a entrada no mesmo grupo existente e as etapas indicadas; solicitar um código somente quando liberado. Ele deve ser enviado ao grupo, nunca ao privado. Depois de confirmar o telefone, testar o login pelo WhatsApp em outra janela, preservando a sessão de admin. Não compartilhar convite, QR, código ou credenciais no chat.

Os timers ficaram desligados como previsto; o primeiro acesso assistido processa o atendimento sob demanda pelo fluxo já instalado. Não habilitar agendadores ou ampliar o piloto como atalho. A autorização do titular para manter o piloto ligado continua vigente; não pausar ao encerrar esta entrega. Se surgir falha, diagnosticar a etapa real antes de recriar grupos, trocar telefone ou repetir códigos.

## Evidências e limites

695 testes locais do aplicativo, 19 verificações SQL e rollback, instalador em clone com backup/recusas e45 composições de UI já aprovados antes da implantação. A consulta automática e a ativação administrativa foram validadas em produção; confirmação de telefone, recebimento de OTP e login reais do cliente continuam pendentes. Não chamar a homologação de concluída por causa da ativação do piloto.

Atenção operacional: o operador de instalação exige pausa e não deve ser reexecutado agora com o piloto ativo. Para consultar, usar leituras de estado ou o botão da interface. Uma nova implantação/retorno requer janela própria e preservação do isolamento; não restaurar dump ou remover guardas automaticamente.
