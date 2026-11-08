# P-49 — Preparação de pagamentos, cancelamentos e reembolsos

**Situação em 07/11/2026:** o dono aprovou o desenvolvimento da P-49 e delegou as decisões de implementação. A preparação descrita aqui é **parcial**: modelo de cálculo, estados e demonstração local. **P-49 não está concluída.** Provedor, integração, revisão da comunicação aplicável e homologação financeira continuam pendentes. A pergunta sobre o provedor já foi encaminhada ao dono; não escolher um fornecedor por presunção.

A intenção original está em [reembolso-futuro.md](reembolso-futuro.md). Este documento concretiza as decisões de produto para preparar a implementação; não é um parecer jurídico nem autorização de uma transação financeira.

## 1. Entrega e fronteira atual

- [refund-policy.ts](../src/features/payments/refund-policy.ts): funções puras, sem rede, armazenamento, relógio implícito ou acesso a conta real.
- [refund-policy.test.ts](../src/features/payments/refund-policy.test.ts): 23 testes de limites de tempo/centavos, validação de saldo, repetição de eventos, complemento, recusa e conciliação de resultado incerto.
- Consumidor: [simulador visual da demonstração da plataforma](../src/features/payments/RefundPolicySimulator.tsx). Exibe valores fictícios e permite criar um pedido complementar simulado, mostrado como aguardando análise. A interface não oferece confirmação de transferência nem exibe o estado financeiro `confirmed`.

**Conferência da interface:** 12 composições em 320/390/834/1280 px e três modos de canto, com 29 verificações por composição (348 no total). Cálculo, complemento, campos inválidos, reset do pedido, reabertura e foco conferidos. O corte do título em 320 px foi corrigido e a geometria revalidada em sete composições. Oito amostras visuais inspecionadas, PNGs removidos e nenhuma chamada financeira ou escrita real; autenticação e dados externos interceptados. A bancada Chromium não comprova Safari/aparelho físico, provedor ou transferência real.

Esta preparação não cria tabela financeira, migration, checkout, endpoint de provedor, credencial, webhook ou botão de registrar pagamento real. Também não ativa a política nos agendamentos existentes nem acrescenta “Esquecimento” ao cancelamento de produção. Preços e dados de atendimentos continuam com o significado atual.

## 2. Regras adotadas para desenvolvimento

| Situação                                                                                                                                 | Resultado previsto                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Nenhum pagamento antecipado comprovado                                                                                                   | Zero a reter e zero a devolver; não criar dívida.                                                           |
| Pagamento parcial/sinal ou ausência de aceite prévio da política                                                                         | Devolução integral do valor efetivamente recebido, sem taxa automática.                                     |
| Recebimento diferente do preço total acordado, inclusive excedente                                                                       | Sem retenção automática; não usar a diferença para inventar uma base de cobrança.                           |
| Pagamento integral comprovado, aceite anterior, cliente indica expressamente esquecimento e cancela antes do início com menos de 3 horas | Retenção de 30% do total integral recebido; devolução prevista do restante.                                 |
| Exatamente 3 horas ou mais de antecedência                                                                                               | Devolução integral.                                                                                         |
| Cancelamento da loja, demais motivos, motivo ausente, falta ou parada da série                                                           | Não inferir esquecimento; sem retenção automática.                                                          |
| No início ou depois dele                                                                                                                 | Sem taxa automática. Isso não amplia a permissão atual do cliente para cancelar um atendimento já iniciado. |

O valor retido é arredondado **para baixo em centavos**; a devolução é a diferença para o recebido. Exemplo fictício: R$ 100,01 integralmente recebidos → R$ 30,00 retidos e R$ 70,01 previstos para devolução. Não usar ponto flutuante em reais para calcular dinheiro.

Todas as quantias da preparação são inteiros seguros de centavos em BRL. Outras moedas, números fracionados/negativos e saldos impossíveis são recusados. O saldo disponível é `recebido − devolvido confirmado − reservado`; reservas abrangem aprovação, processamento e incerteza. Não mascarar inconsistência como saldo zero.

O cliente poderá solicitar o complemento da parcela retida. Solicitar ou aprovar não comprova transferência. O modelo só abre o complemento quando a devolução-base está confirmada ou reservada e nunca pede mais que a parcela retida e o saldo ainda disponível. Pedido sem saldo não é criado.

## 3. API local do modelo

`quoteCancellationRefund(input)` recebe preço acordado, recebido comprovado, devolvido confirmado, reservado, moeda, instante acordado, instante do cancelamento, aceite, autor e motivo. Os instantes são milissegundos absolutos, com o fuso já resolvido; a função não lê o relógio do aparelho. Retorna regra aplicada, retenção, devolução total prevista, saldo disponível, valor ainda previsto e limite complementar.

`refundBalance(balance)` valida o saldo e devolve `availableCents`.

`createRefundRequest(request, balance)` cria uma solicitação local sem reservar nem confirmar dinheiro. `requestComplementaryRefund(quote, balance, id)` aplica também os limites do complemento.

`transitionRefund(process, event)` devolve uma nova cópia da operação. O estado anterior não é alterado. IDs de evento repetidos com conteúdo igual não repetem efeitos; reutilizar o ID com outro conteúdo gera erro.

| Estado       | Significado e passagem permitida                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `requested`  | Pedido recebido; pode ir para análise, aprovação ou recusa. Não confirma dinheiro.                                                              |
| `reviewing`  | Em análise; pode ser aprovado ou recusado. Não confirma dinheiro.                                                                               |
| `rejected`   | Pedido recusado antes da aprovação; encerra a análise sem reservar nem devolver valor. Não pode ser aprovado depois como se continuasse aberto. |
| `approved`   | Valor reservado; pode iniciar uma tentativa de processamento.                                                                                   |
| `processing` | Tentativa iniciada; aguarda confirmação exata, falha definitiva ou resultado incerto.                                                           |
| `confirmed`  | No modelo, um evento de confirmação move a reserva para o total devolvido. Na integração real, isso exigirá comprovação do provedor.            |
| `failed`     | Falha definitiva comprovada; libera a reserva e permite nova aprovação/tentativa.                                                               |
| `uncertain`  | A operação pode ter ocorrido. Mantém a reserva e bloqueia nova tentativa até conciliação.                                                       |

Os eventos são `review`, `reject`, `approve`, `start`, `confirm`, `fail`, `uncertain` e `reconcile`. `reject` só encerra um pedido recebido ou em análise; uma operação já aprovada ou em processamento não pode ser tratada como simples recusa. Eventos externos identificam a tentativa; confirmações exigem exatamente o valor solicitado. A conciliação informa `confirmed` com o valor exato ou `not_transferred` com zero. Timeout, interrupção de rede ou resposta perdida não são prova de falha definitiva.

**Limite da máquina local:** ela representa uma operação sobre uma cópia do saldo, não um livro financeiro persistente e concorrente. Não autentica origem de eventos nem comprova recebimentos. Para a simulação, eventos de tentativas anteriores não alteram o saldo da tentativa atual; na futura integração, uma confirmação contraditória deve suspender novos envios e ir para conciliação, nunca ser descartada silenciosamente como prova financeira irrelevante. A deduplicação global de pedidos e a concorrência entre operações serão responsabilidades do servidor, descritas a seguir.

## 4. Contrato da futura integração

### Identidade do recebimento e da política

1. Vincular cada recebimento à loja, agendamento, moeda, conta recebedora e identificador único do provedor. O valor confirmado vem de consulta autenticada ou evento validado do provedor, nunca de `booked_price_cents`, do navegador ou de um botão administrativo.
2. Guardar versão imutável da política apresentada, preço acordado, moeda, autor e instante do aceite antes de qualquer contratação financeira. `policyAccepted` no simulador representa essa prova futura; um booleano enviado pelo cliente não será suficiente no servidor.
3. Capturar a política nos caminhos de criação comum, link direto, balcão e recorrência. Agendamentos anteriores à ativação não recebem política retroativa. Mudança de política/preço/serviço na remarcação exige regra explícita de reapresentação e aceite; a versão anterior não pode ser sobrescrita.
4. No cancelamento, registrar causa, autor, horário acordado vigente e instante do servidor capturado uma vez após bloquear o atendimento. Comparar os instantes absolutos com `10800` segundos. Se a prévia expirar ou cruzar o limite de três horas, pedir confirmação da prévia atualizada antes de concluir uma ação financeira.

### Escrita, idempotência e conciliação

1. O servidor deve bloquear o saldo do recebimento e validar, na mesma transação, todas as devoluções confirmadas e reservas de todas as operações. Nenhuma soma pode exceder o recebido comprovado. Reservar antes de enfileirar a chamada externa.
2. Usar identificador único de pedido e chave de idempotência persistente por operação/tentativa. Repetir a mesma requisição devolve a operação existente; não cria nova devolução. Manter uma solicitação complementar ativa por cancelamento e registrar decisões/autoria.
3. Deduplicar eventos por provedor, conta e identificador. Validar assinatura, identidade do recebedor, moeda, pagamento relacionado e valor; evento válido para outra loja não altera este saldo.
4. Usar uma fila de saída persistente. A transação do banco não garante execução única da chamada HTTP: resposta perdida mantém reserva e estado incerto, seguida de consulta/retorno do provedor antes de liberar saldo ou gerar outra tentativa.
5. Eventos fora de ordem não podem regredir uma confirmação nem confirmar duas vezes o mesmo valor. Divergência entre confirmação e falha anteriores exige conciliação. Falta de informação não significa devolução efetuada.
6. Separar histórico financeiro do histórico de agenda e dos pontos de fidelidade. Exclusão da conta/loja exige tratamento explícito dos pagamentos e pedidos em aberto, sem apagar registros por cascata operacional ou bloquear a exclusão indefinidamente por um mecanismo improvisado. Definir retenção e comunicação com a revisão responsável.

### Permissões

- O cliente consulta seus próprios recebimentos/pedidos e pode solicitar complemento; não aprova nem confirma devoluções.
- Cancelar um atendimento ou visualizar valores não concede poder de movimentar dinheiro. A permissão financeira deverá ser explícita, delimitada por loja e compatível com a governança adotada.
- A configuração da política e as decisões financeiras são gravadas por funções do servidor com validação de papel, saldo e autoria. A interface não será a barreira de autorização.
- Somente o adaptador confiável do provedor confirma recebimento ou devolução real. Nenhum formulário de produção poderá transformar “solicitado”, “aprovado” ou “processando” em dinheiro comprovadamente devolvido.

## 5. Pontos existentes que precisam ser integrados

| Caminho atual                       | Fonte e cuidado                                                                                                                                                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cancelamento do cliente e da agenda | `ArenaApp.tsx`, `ShopShell.tsx`, `CancellationDialog.tsx`; usam `cancel_appointment(uuid,text)`. Adicionar prévia/estado financeiro sem atrasar indevidamente a liberação do horário.                                   |
| Cancelamento na saída da equipe     | `DepartureBookings.tsx`; hoje envia motivo `other`. Não cobrar esquecimento do cliente por uma ação da loja.                                                                                                            |
| Contrato SQL vigente                | `20261013180000_papeis_atuais_e_fuso.sql`, `cancel_appointment`: bloqueia atendimento, valida acesso e atualiza estado antes de inserir motivo. Um gatilho financeiro não pode ler um motivo que ainda não foi gravado. |
| Caminhos que não passam nessa RPC   | RLS de atualização direta, `stop_booking_series`, `delete_my_account`, `record_attendance` e `save_appointment_occurrence`. Cobrir a transição no banco; causa desconhecida não autoriza retenção.                      |
| Criação e remarcação                | Inserção comum de `appointments`, `create_direct_appointment`, `create_booking_series`, `book_for_client`, `reschedule_own_appointment`. O snapshot financeiro deve cobrir todos os caminhos.                           |
| Efeitos já existentes               | Histórico de atendimento, disponibilidade, exceção da série, WhatsApp e Google. Cancelar continua atualizando a agenda; processamento financeiro assíncrono não pode duplicar esses efeitos.                            |
| Demonstração                        | `src/features/demo/model.ts` e simulador da plataforma; toda a simulação permanece local, sem gravar transações ou mensagens reais.                                                                                     |

## 6. O que falta para concluir a P-49

1. Receber a escolha do provedor e confirmar seu contrato operacional: conta recebedora por loja, métodos, confirmação de recebimento, estorno parcial, identificadores, idempotência, eventos e consulta de conciliação.
2. Concretizar permissão de aprovação, ativação por loja, prazos de análise do complemento e comportamento de remarcação, com comunicação revisada. A decisão de desenvolver não substitui essa conferência.
3. Implementar banco, RLS/funções, integração e credenciais exclusivamente no servidor; nenhuma dessas partes foi criada nesta preparação.
4. Homologar em ambiente de teste do provedor, cobrindo aprovação, recusa, falha definitiva, timeout antes/depois da transferência, eventos repetidos/fora de ordem, concorrência, complemento e exclusão/remarcação com saldo pendente.
5. Preparar e executar a ativação real com evidências próprias. Até lá, cancelamentos atuais permanecem sem cobrança automática e P-49 permanece **em desenvolvimento parcial**.
