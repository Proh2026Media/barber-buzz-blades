# Módulo de reembolso e cancelamento — ideia registrada

**Status:** proposta preliminar para evolução futura, registrada em 16/09/2026. Nenhuma cobrança, retenção ou devolução foi implementada nesta etapa.

## Regras solicitadas

| Situação | Regra pretendida |
| --- | --- |
| Cancelamento por esquecimento com pelo menos 3 horas de antecedência | Gratuito; reembolso integral do que tiver sido pago. |
| Cancelamento por esquecimento com menos de 3 horas de antecedência | Retenção/taxa de 30%; devolução dos 70% restantes quando houver pagamento integral antecipado. |
| Cancelamento por outros motivos | Reembolso integral do que tiver sido pago. |
| Cliente deseja reembolso integral mesmo após retenção dos 30% | Oferecer **Solicitar reembolso integral**; o barbeiro analisa a solicitação e efetua a devolução do valor restante. |

O limite de 3 horas refere-se ao início do atendimento acordado. Exemplo: atendimento às 15h permite cancelamento gratuito por esquecimento até 12h, inclusive. Depois de 12h, aplica-se a regra dos 30% para esse motivo.

## Experiência desejada

- Módulo próprio, com política explicada antes da confirmação do agendamento e no cancelamento; seguir `/mb` para controles intuitivos e leitura clara.
- Apresentar motivo, valor pago, eventual retenção e valor a devolver antes de concluir o cancelamento.
- Usar seleção simples de motivos. Adicionar **Esquecimento** como motivo explícito quando o módulo for desenvolvido; não inferir esse motivo a partir de ausência de resposta, falta ou outros dados.
- Permitir ao cliente acompanhar a solicitação de reembolso integral e ao barbeiro consultar e efetuar o complemento, com histórico de valores e ações.
- Distinguir solicitação, processamento e devolução efetivamente confirmada. Um clique não deve indicar que o dinheiro já foi devolvido.

## Pontos a definir antes da implementação

- Meio de pagamento e integração para receber, reter e devolver valores. Hoje o sistema registra preços e agendamentos, mas não comprova pagamentos.
- Base dos 30% em caso de sinal ou pagamento parcial: valor total do serviço ou valor já pago. Não assumir essa decisão a partir do exemplo de pagamento integral.
- Tratamento de reservas sem pagamento antecipado: a intenção menciona valor “retido/pago”, mas a forma de cobrar eventual taxa ainda não foi definida.
- Quem ativa/configura o módulo, quais parâmetros poderão variar por barbearia e a política aplicável a reservas criadas antes da ativação.
- Motivo não informado, falta sem cancelamento e cancelamento após o início do atendimento. Essas situações não foram equiparadas a esquecimento.
- Critérios e prazo para o barbeiro atender a solicitação de devolução complementar, além do prazo de processamento do provedor.

## Cuidados para a futura implementação

- Calcular antecedência no servidor, usando a data/hora da reserva; guardar a versão da política apresentada ao cliente.
- Registrar valores em centavos e impedir devolução duplicada ou superior ao total efetivamente recebido.
- Conferir permissões por barbearia, registrar autoria e tratar falhas/repetições de eventos do provedor.
- Validar os limites de exatamente 3 horas, menos de 3 horas, cada motivo, pagamento parcial, reembolso complementar e falhas de processamento.
- Revisar a política aplicável e a comunicação ao cliente antes de ativar pagamentos reais. Este documento registra a intenção do produto, não uma validação jurídica.
