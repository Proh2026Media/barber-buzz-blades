# Módulo de reembolso e cancelamento — proposta e desenvolvimento

**Status em 07/11/2026:** desenvolvimento aprovado pelo dono, com preparação **parcial** implementada: modelo de cálculo/estados, testes e simulador local da demonstração. **P-49 não está concluída** e nenhuma cobrança, retenção ou devolução real está ativada. O dono escolheu Mercado Pago: Parceiro independente recebe em conta própria; donos e contratados, pela barbearia, sem repasse/comissão automática. A base de conexão por recebedor foi preparada; integração financeira e homologação continuam pendentes. Contrato e evidências em [pagamentos-reembolsos-p49.md](pagamentos-reembolsos-p49.md).

A proposta original foi registrada em 16/09/2026. As decisões abaixo, adotadas em 07/11 pela delegação do dono, resolvem as lacunas de cálculo para desenvolver o módulo sem presumir pagamento ou criar dívida.

## Regras adotadas para desenvolvimento

| Situação                                                                                                                | Regra pretendida                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cancelamento por esquecimento com pelo menos 3 horas de antecedência                                                    | Sem retenção; devolução integral do pagamento comprovado.                                                                                              |
| Cliente informa esquecimento, antes do início e com menos de 3 horas, com pagamento integral comprovado e aceite prévio | Reter 30% do total integral recebido, arredondados para baixo em centavos; devolver a diferença.                                                       |
| Sinal/pagamento parcial, ausência de aceite ou recebimento diferente do total acordado                                  | Devolver integralmente o recebido comprovado, sem taxa automática.                                                                                     |
| Sem pagamento antecipado                                                                                                | Zero a reter e a devolver; não criar dívida.                                                                                                           |
| Cancelamento pela loja, outro motivo, motivo ausente, falta ou parada da série                                          | Não inferir esquecimento; sem retenção automática.                                                                                                     |
| Cancelamento no início ou depois dele                                                                                   | Sem taxa automática; preservar as permissões atuais de cancelamento do atendimento.                                                                    |
| Cliente deseja o complemento da parcela retida                                                                          | Oferecer **Solicitar reembolso integral**, com análise e decisão da pessoa autorizada. Solicitação, aprovação e processamento não comprovam devolução. |

O limite de 3 horas refere-se ao início do atendimento acordado. Exemplo: atendimento às 15h permite cancelamento sem retenção por esquecimento até 12h, inclusive. Entre 12h e o início, a regra dos 30% só se aplica quando todas as condições da tabela forem atendidas. A comparação será feita no servidor, sem depender do relógio do aparelho.

## Experiência desejada

- Módulo próprio, com política explicada antes da confirmação do agendamento e no cancelamento; seguir `/mb` para controles intuitivos e leitura clara.
- Apresentar motivo, valor pago, eventual retenção e valor a devolver antes de concluir o cancelamento.
- Usar seleção simples de motivos. **Esquecimento** já pode ser ensaiado no simulador; só entrará no cancelamento de produção com a integração e a política aplicáveis. Não inferir esse motivo a partir de ausência de resposta, falta ou outros dados.
- Permitir ao cliente acompanhar a solicitação de reembolso integral e ao barbeiro consultar e efetuar o complemento, com histórico de valores e ações.
- Distinguir solicitação, processamento e devolução efetivamente confirmada. Um clique não deve indicar que o dinheiro já foi devolvido.

## Pontos ainda necessários para a integração real

- Escolha do provedor e contrato para receber, reter e devolver valores. A pergunta já foi encaminhada ao dono e não foi respondida. Hoje o aplicativo de produção registra preços e agendamentos, mas não comprova pagamentos.
- Quem ativa/configura o módulo, quais parâmetros poderão variar por barbearia e a permissão para aprovar o complemento. A decisão atual é não aplicar política retroativa aos agendamentos existentes.
- Tratamento da remarcação com mudança de serviço, preço ou política, preservando a versão apresentada e exigindo novo aceite quando necessário.
- Critérios e prazo para análise da solicitação complementar, além do prazo de processamento do provedor.
- Revisão da comunicação aplicável, implementação no servidor e homologação com eventos repetidos, falhas e conciliação. Os detalhes técnicos estão no [contrato da P-49](pagamentos-reembolsos-p49.md).

## Cuidados para a futura implementação

- Calcular antecedência no servidor, usando a data/hora da reserva; guardar a versão da política apresentada ao cliente.
- Registrar valores em centavos e impedir devolução duplicada ou superior ao total efetivamente recebido.
- Conferir permissões por barbearia, registrar autoria e tratar falhas/repetições de eventos do provedor.
- Validar os limites de exatamente 3 horas, menos de 3 horas, cada motivo, pagamento parcial, reembolso complementar e falhas de processamento.
- Revisar a política aplicável e a comunicação ao cliente antes de ativar pagamentos reais. Este documento registra a intenção do produto, não uma validação jurídica.
