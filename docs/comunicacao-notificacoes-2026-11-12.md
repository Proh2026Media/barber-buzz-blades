# Comunicação do B&C — natural, cordial e profissional

Decisão do dono em 12/11/2026: as mensagens devem soar naturais, sem parecer descuidadas e sem linguagem excessivamente jovem. Vale para notificações, grupos, confirmação e avisos do sistema.

**Identidade aprovada:** o cliente final vê a marca e o nome da sua barbearia. “B&C”, “Barba & Cabelo” e termos de marca da plataforma ficam na comunicação de gestão com donos/administradores, não no grupo do cliente, notificações, convite, descrição, boas-vindas ou mensagens de código.

## Regra editorial

- Português correto, frases curtas, vocabulário comum e tom adulto. Usar “você” quando necessário; não exigir tratamento formal como “prezado”.
- Não inserir erros propositais, “vc”, “aki”, “blz”, “codígo”, gírias, excesso de exclamações ou diminutivos artificiais.
- Naturalidade vem de contexto útil: nome da barbearia, dia/horário corretos e próximo passo claro. Não repetir o nome do cliente em toda frase.
- Identificar a barbearia do atendimento; não fingir que um barbeiro está escrevendo, digitando ou acompanhando a conversa. Não usar “me chama” em um grupo que não tem atendimento humano.
- Sem sorteio de erros, pausas para aparentar digitação ou promessas de redução de bloqueio. Esta orientação não cria um motor de variações nem altera limites/consentimentos.
- Código numérico, datas, preços, nomes, links e validade nunca são modificados para variar o texto. Informar a validade real fornecida pelo servidor.
- Só afirmar “confirmado”, “cancelado”, “enviado” ou “entregue” quando houver evidência daquele estado. Aceitação do provedor não prova entrega.
- Promoções continuam dependendo do consentimento e das cotas vigentes; a mudança de tom não autoriza novos envios.
- Não sobrescrever silenciosamente modelos personalizados das barbearias. Revisão dos textos existentes deve preservar fatos e permissões.

## Exemplos de referência (não são mensagens enviadas nem novos modelos já publicados)

| Situação                | Texto                                                                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agendamento confirmado  | Olá, João. Seu agendamento na Arena está confirmado para segunda-feira, 16/11, às 14h. Para consultar os detalhes, abra o aplicativo da barbearia.                                                                |
| Alteração               | Seu agendamento na Arena foi atualizado para terça-feira, 17/11, às 15h. Confira os detalhes no aplicativo.                                                                                                       |
| Cancelamento confirmado | Seu agendamento de 16/11 às 14h na Arena foi cancelado. Você pode escolher outro horário pelo aplicativo.                                                                                                         |
| Código solicitado       | Arena — seu código de acesso é 123456. Válido até [horário real]. Não compartilhe este código.                                                                                                                    |
| Boas-vindas ao grupo    | Bem-vindo ao atendimento da Arena pelo aplicativo. Este grupo envia avisos automáticos sobre seus agendamentos. Você pode ajustar as notificações e autorizar ou desativar promoções no seu perfil no aplicativo. |

Os exemplos não autorizam envio de boas-vindas, fixação ou criação de grupo enquanto o respectivo mecanismo não estiver concluído e homologado.

## Evidência da auditoria

O anexo externo de 11/11 propunha, na seção 3.2, um typo em aproximadamente 1 a cada 20 mensagens. A seção 3.3 misturava erros de acentuação, abreviações e variações corretas de expressão. A regra incorporada em `docs/plano-login-whatsapp-email-2026-11-11.md`, seção 1, já determina ausência de erros propositais, reações e simulação de digitação.

No código examinado, `src/lib/whatsapp/templates.ts` substitui variáveis sem mutação aleatória; `_shared/whatsapp-send.ts` encaminha o corpo autorizado; o patch `integrations/evolution/grupos-v2/evolution-bc-groups.patch` monta texto fixo para OTP. Não foi encontrado um mecanismo ativo de introdução de erros. Esta auditoria local não certifica os modelos personalizados nem arquivos adicionais existentes no servidor.

## Identidade por destinatário e barbearia

- Cliente em duas barbearias: cada mensagem/grupo usa o nome da loja a que pertence. Um número compartilhado da plataforma não define a marca comercial da mensagem.
- Nome obtido no servidor pelo grupo/agendamento, nunca pelo nome livre do grupo, telefone remetente, parâmetro do navegador ou última loja visitada. Renomeação manual do grupo não troca a barbearia de origem.
- Sem contexto confiável de loja, usar texto neutro na interface (por exemplo, “seu grupo de atendimento”) e aviso genérico no teste de push. Não escolher outra loja nem usar B&C como nome substituto para o cliente. Mensagem real de grupo sem identidade confiável fica bloqueada para revisão.
- O título do grupo deve seguir a regra já pedida: `[próximo horário, quando aplicável •] Notificações [Nome da Barbearia] • [Nome do Cliente]`. Logo: a escolhida pela barbearia. Boas-vindas, descrição e mensagem fixada seguem a mesma identidade. Essas capacidades continuam dependendo da entrega completa do ciclo de grupos.
- Códigos continuam automáticos e protegidos; retirar a marca do texto não pode retirar a filtragem de códigos/trechos citados em logs, histórico ou webhooks. Preservar compatibilidade de filtragem com mensagens antigas.
- Identificadores técnicos (RPC, contrato, headers e variáveis) não são nomes de comunicação e não devem ser renomeados por substituição textual. Identificação jurídica de responsáveis nos termos/privacidade também não é uma assinatura comercial e não será apagada por esta mudança de apresentação.

Esta decisão não modifica a pasta da marca e não autoriza mensagens reais. A revisão local de textos e push não significa que a extensão de grupos instalada já recebeu essa mudança.
