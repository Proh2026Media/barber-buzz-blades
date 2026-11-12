# P-120 — retorno à TI e primeiro acesso ao grupo

**Data:** 12/11/2026. **Responsável:** Codex. **Destino:** TI/Guardião.

**Responde a:** `relatorio-ti-p120-conferencia-117-prontidao-login-2026-11-12.md`.
SHA-256 do relatório original: `82fbd0d014e9b4705eda38d45de374ea81699d15905bbdc13ad75343e7220eef`.
O original foi somente lido e permanece preservado.

## 1. Decisão e situação

A conferência solicitada à TI está respondida. Não é necessário repetir consultas, pedir acesso administrativo para essa mesma conferência nem processar o grupo antigo para obter um convite.

O piloto de login **não está pronto**. Esta entrega melhora o frontend; não instala funções, migrations ou extensão, não cria grupo e não envia códigos. Também não autoriza publicação, alterações de flags, reinícios ou Redeploy no Coolify. A pasta e a prévia da marca ficam fora do trabalho por determinação do dono.

A nº 117 já foi aplicada. A correção dos cartões sem telefone também chegou à `origin/main`, commit `f785ba841c0b25eb78ce1f01654815c5807874f0` (nº 117b). O código foi comparado com a entrega local: os arquivos de aplicação eram iguais. Não aplicar novamente o pacote anterior de cartões.

## 2. Correção local entregue

- Ao abrir **Entrar com WhatsApp**, há duas escolhas: **Já ativei meu grupo** e **Ainda não ativei meu grupo**. A segunda leva ao acesso por e-mail, sem solicitar código ou consultar se um telefone tem conta.
- No perfil do cliente, o atendimento apresenta três etapas: **Solicitar grupo → Entrar no grupo → Confirmar telefone**. Participantes e preferências ficam em seções expansíveis; os números continuam visíveis antes do consentimento.
- Enquanto a entrada não está confirmada, a ação é obter o convite e depois **Já entrei · conferir**. Essa conferência apenas lê `care_group_read`: não chama a Evolution, não executa reconciliação e não renova convite.
- Código de confirmação só é oferecido quando o backend informa `phone_ready`. Adesão expirada sem telefone confirmado oferece o fluxo existente de retomada, sem continuar oferecendo o convite antigo. Uma adesão antiga expirada não desfaz um telefone já confirmado.
- Falha ao obter convite tem mensagem própria. Não foi ampliado o prazo de segurança de 30 segundos nem contornada a validação do servidor.
- O login público mostra **Pedido recebido**, com indicação condicional de recebimento. HTTP 200 acompanhado de `ok:false` agora é tratado como falha. Não existe consulta pública sobre grupo, telefone cadastrado ou elegibilidade individual.
- Na confirmação autenticada, envio incerto mantém o campo para usar um código que possa ter chegado, avisa que não há confirmação do envio e mantém a espera antes de outro pedido. Limite de pedidos tem aviso próprio. Não há reenvio automático nem envio privado.
- Telefone confirmado não é apresentado como garantia de login disponível: a mensagem esclarece a dependência de um grupo disponível.
- Estado temporário do convite/código é isolado por grupo, versão e telefone.

Textos estão nos quatro dicionários editáveis; en-GB herda en-US. Identidade visual e controles existentes foram preservados.

## 3. O que a conferência da TI efetivamente demonstrou

| Item | Situação relatada |
| --- | --- |
| Cliente de teste escolhido | `alyson21viana@gmail.com`, conta …970b, telefone pessoal DDD 84 final 4593. A escolha já foi confirmada pelo dono; não pedir nova escolha entre Gmail e administrador. |
| Preparação desse cliente | Sem telefone confirmado, consentimentos, adesão ou grupo. Não inventar esses registros nem registrar aceite pelo titular. |
| Grupo existente …78e3 | Pertence ao administrador `alyson@proh.media`, na Loja Teste. Não transferir para Gmail nem tratá-lo como grupo desse teste. |
| Número principal 8585 | Conectado, porém sem extensão/webhook preparados para grupos conforme o relatório. |
| Reserva 5627 | Instância …arba com extensão/webhook. É o remetente do grupo antigo. |
| Participantes do grupo antigo | Última observação tinha somente uma conta da plataforma; a TI não confirmou participantes ao vivo nesta conferência. |
| Flags | Piloto, adesão e login relatados como ligados. Pausa global desligada. Principal/reserva com `enabled=false`. Não descrever o piloto como desligado nem deduzir prontidão apenas dessas flags. |
| Convite e adesão antigos | Expirados. Não propor corrida manual de 30 segundos como solução definitiva. |

Esses são fatos do relatório, não uma nova leitura do servidor pelo Codex. Também não foi realizada homologação autenticada real da produção.

## 4. Pendências que continuam do lado do código

Esta entrega **não conclui** a política de ciclo dos grupos. Próximos blocos, em ordem:

1. **Prontidão no backend e na extensão:** garantir dois números autorizados, distintos e administradores, com capacidades protegidas nas duas instâncias; cliente nunca administrador, profissionais ausentes. Conferência persistente, repetida na execução, sem depender apenas de contagem na tela ou status de conexão.
2. **Preparação idempotente:** identificar criador e segundo administrador, aplicar nome e logo escolhida, promover o segundo e verificar tudo antes da primeira mensagem por ele. Configurar descrição/fixação com prova de resultado; resultado incerto exige revisão, não repetição automática.
3. **Entrada sem corrida manual:** renovar/conferir convite somente para titular autenticado, no próprio grupo, com limites e validade explícita. Preservar bloqueios em divergência e evitar criação duplicada. O botão de atualização entregue agora é apenas leitura, não resolve essa infraestrutura.
4. **Ciclo anual e encerramento:** expiração também no caminho de envio/admissão, retorno no período permitido, fechamento verificável sem deixar cliente administrador. Nome automático, boas-vindas e renovação de fixação ainda precisam da implementação completa e dos ensaios previstos no plano.

As nº 113/114 existentes em trabalho local são parciais e não provam que esses blocos estão completos. Não instalar essas versões só por causa desta devolutiva.

## 5. O que fazer com este pacote agora

A TI pode revisar o frontend e as evidências sem operar a VPS. Não há pedido de nova ação no servidor nesta etapa. O próximo pacote operacional depende dos blocos de backend/extension acima e de uma janela autorizada.

Conteúdo do ZIP acompanhante:

- `frontend.patch`: somente os sete arquivos de interface/dicionários desta correção, sobre a nº 117b;
- `BASE.txt` e `COMMIT.txt`: referência publicada e commit local da entrega;
- este roteiro, `SHA256SUMS`, capturas e bancada com dados fictícios;
- nenhum `.env`, segredo, QR Code, convite real, token ou migration.

Para revisar, usar uma cópia separada no commit de `BASE.txt`, conferir `SHA256SUMS` e executar `git apply --check frontend.patch` antes de aplicar. Rodar tipos, testes, lint dos alterados e build. Não aplicar sobre checkout de trabalho alheio nem fazer push em `main` como parte da revisão.

## 6. Validação

Checagem de tipos, 572 testes automatizados, lint dos sete arquivos (sem erros; dois avisos anteriores no CareGroupPanel), montagem e conferência do patch sobre a base publicada. Bancada de navegador com respostas fictícias e rede de produção bloqueada: estados de primeiro acesso, convite indisponível, entrada, confirmação incerta, limite de pedidos, adesão expirada e estados em revisão; login por e-mail sem pedido de OTP; resposta pública sem falso sucesso; teclado/Escape. Matriz de seis larguras (320, 390, 768, 834, 1024 e 1440), três modos de canto e dois temas, sem estouro horizontal. Os resultados finais estão nos arquivos de evidência do pacote.

Não houve criação de grupo, login real com código, envio de mensagem ou prova de entrega no WhatsApp.

## 7. Retorno futuro da TI

Na próxima janela efetivamente autorizada, citar o roteiro operacional específico recebido e registrar versão, etapa realizada, resultado e limitações. Não declarar que a P-120 foi concluída apenas por publicar este frontend. O piloto deverá usar a conta Gmail já escolhida, com participação e consentimento do titular, preservando a conta administrativa.
