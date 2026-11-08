# Decisões para concluir as pendências — Barba & Cabelo

**Data:** 07/11/2026. **Origem:** o dono pediu “execute tudo, execute as melhores decisões” e autorizou preparar instruções para as etapas que dependem de outras pessoas. Este registro adota as escolhas abaixo sem repetir perguntas já delegadas. A situação de execução continua em [guia/pendencias.md](guia/pendencias.md) e as evidências de cada entrega, no [CONTINUIDADE.md](CONTINUIDADE.md).

## 1. Comportamentos existentes mantidos

Estas escolhas encerram dúvidas de produto. Não representam funcionalidades novas nem novas permissões.

| Item | Decisão adotada                                                                                           | Motivo e comportamento conferido                                                                                                                                                                                                                       |
| ---- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P-30 | Uma única opção **Toda semana**.                                                                          | O seletor já grava a recorrência semanal e mostra as próximas datas. Acrescentar “A cada 7 dias” duplicaria a escolha para o mesmo uso.                                                                                                                |
| P-36 | Trocar de barbearia **no domínio atual**.                                                                 | O endereço continua `/app?shop=<loja>`. Preserva a sessão em vez de exigir outra entrada ao mudar para o domínio próprio da loja seguinte.                                                                                                             |
| P-76 | **Sem pontos retroativos** pelas visitas do balcão já concluídas.                                         | A confirmação do WhatsApp vincula a ficha e os horários; a pontuação continua sendo concedida quando um atendimento é concluído com uma conta vinculada.                                                                                               |
| P-77 | Permitir identificar o cliente da loja pelo **número exato informado**, mantendo as restrições de acesso. | O profissional pode obter o nome para agendar; apelido e recorrência permanecem restritos a quem pode vê-los. Buscar pelo número não concede acesso geral à carteira de outros profissionais.                                                          |
| P-14 | Lembrar a última área e loja **por conta e aparelho**.                                                    | Uma escolha em um aparelho não muda a entrada de outro. As preferências existentes continuam separadas por conta e domínio, com recuperação quando o armazenamento está indisponível. A sincronização pelo perfil não será implementada nesta entrega. |
| P-24 | Manter a VPS **sem credencial de escrita no GitHub**.                                                     | TI devolve o relatório de implantação; o registro e o envio ao `origin` ficam na máquina de desenvolvimento. O funcionamento do aplicativo não depende de a VPS publicar commits.                                                                      |

**Fontes conferidas no repositório:**

- P-30: [BookingParts.tsx](../src/features/customer/booking/BookingParts.tsx), `RepeatChoice` e `RepeatPicker`.
- P-36/P-14: [shop-choice.ts](../src/features/customer/shop-choice.ts), [destination.ts](../src/lib/auth/destination.ts) e [shop-acting.ts](../src/lib/auth/shop-acting.ts); testes da escolha de loja em [shop-choice.test.ts](../src/features/customer/shop-choice.test.ts).
- P-76: `link_shop_clients_to_profile` em [agendamento pelo painel](../supabase/migrations/20261016130000_agendamento_pelo_painel.sql) e `award_points_on_completed` em [módulo de fidelidade](../supabase/migrations/20261002110000_loyalty_program_module.sql). Vincular um atendimento que já estava concluído não repete a concessão de pontos.
- P-77: `find_shop_client` e `book_for_client` na migration do agendamento pelo painel; cenários de acesso limitado em [agendamento_pelo_painel.sql](../supabase/tests/agendamento_pelo_painel.sql).
- P-24: levantamento histórico e procedimento de implantação em [pendências](guia/pendencias.md) e [como trabalhar](guia/como-trabalhar.md). Nenhuma credencial da VPS foi inspecionada ou alterada para tomar esta decisão.

## 2. Melhorias escolhidas para implementação

| Item | Direção escolhida                                                                                                                                                                                                                                   | Condição para registrar como entregue                                                                                                                                                                    |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-74 | **Gestão compartilhada entre administração e dono.** Acrescentar acesso operacional pela ficha da loja na administração, preservando a autonomia e as permissões existentes do dono. As mensagens continuam com um padrão e personalização da loja. | Implementação e validação das ações correspondentes, com as mesmas regras do servidor. Esta decisão não concede poderes a gerentes ou profissionais por alterar somente a tela.                          |
| P-95 | **Folha inferior no celular para tarefas longas**, usando o componente comum de janela. Preservar os modos de canto, identidade visual, foco e funcionamento no tablet/computador.                                                                  | Conferência de conteúdo, rolagem, teclado, foco, ações e larguras intermediárias. A escolha autoriza a mudança específica das janelas móveis longas; não significa redesenhar todas as telas do celular. |

**Resultado em 07/11:** P-74 e P-95 implementadas e conferidas em bancada local. O [diário da entrega](CONTINUIDADE.md) registra os cenários e limites; a [lista de pendências](guia/pendencias.md) foi atualizada. Integrações reais e aparelhos continuam no roteiro TI. Esta tabela de decisões não comprova, por si, implantação na hospedagem.

## 3. Evoluções que continuam condicionadas

### P-49 — Pagamentos e reembolso

**Decisão:** manter os cancelamentos atuais, sem cobrança, retenção ou devolução financeira ativada. O módulo não foi implementado. A [proposta de reembolso](reembolso-futuro.md) continua registrada.

Antes de implementar, são necessários: provedor de pagamentos, regra para sinal e pagamento parcial, tratamento de agendamento sem antecipação, responsável pela ativação da política e revisão da comunicação aplicável. A integração deve confirmar pagamentos e devoluções, impedir repetição e distinguir pedido de reembolso de valor efetivamente devolvido. O preço cadastrado de um serviço não será tratado como pagamento recebido.

### P-70 — Pausa semanal da loja com aprovação entre sócios

**Decisão:** retomar após o ensaio real de sociedade 50%/50% da P-41. A pausa própria continua disponível conforme a permissão do profissional. A pausa da loja inteira continua exigindo poder de aplicar mudanças.

Ainda não há fila de aprovação para a regra semanal. Criá-la exige alteração de banco, tela e testes próprios; não basta liberar o botão. Essa evolução permanece pendente, preservando o adiamento anterior até o uso real. Fontes: [migration da pausa semanal](../supabase/migrations/20261013220000_pausa_semanal.sql) e configuração `weeklyBreaks.canManageShop` em [ShopShell.tsx](../src/features/shop/ShopShell.tsx).

## 4. Etapas externas e comprovação

- **P-39:** encaminhar o [pacote de revisão jurídica](pacotes/2026-11-07-revisao-juridica-barba-cabelo-p39.md) ao profissional responsável. Preparar o pacote não conclui a revisão. Texto e versão de aceite permanecem vigentes até uma revisão efetiva.
- **P-40/P-41/P-42:** concluir os cenários com contas e integrações reais em lojas de teste, registrando o que passou, falhou ou não pôde ser executado. Conferência de código ou serviço simulado não substitui esses resultados.
- **P-43:** testar nos aparelhos físicos disponíveis e registrar aparelho, navegador, orientação e resultado. A emulação ajuda na correção, mas não comprova o aparelho.
- **P-28:** continua na coordenação externa já definida. Esta rodada de decisões do B&C não cria nova tarefa de programação no Flow nem repete etapas encerradas. O roteiro operacional vigente e seus resultados continuam nas referências da P-28.

As decisões acima retiram dúvidas da fila de desenvolvimento. Testes não executados, implantação não conferida e revisão profissional não recebida continuam identificados como pendentes.
