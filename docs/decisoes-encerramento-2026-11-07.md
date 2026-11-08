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

## 3. Aprovação posterior de P-49 e P-70

**Adendo de 07/11:** depois das decisões iniciais deste documento, o dono aprovou o desenvolvimento de **P-49 e P-70**. Essa aprovação supera o adiamento anterior das duas frentes. O avanço de código e preparação não equivale a implantação de banco, confirmação de transferência ou ativação de pagamentos reais.

### P-49 — Pagamentos e reembolso

**Estado atual: desenvolvimento parcial.** Modelo puro de cálculo e estados, 23 testes e simulador local da demonstração implementados. O simulador calcula valores fictícios e cria um pedido complementar que permanece aguardando análise; não confirma uma transferência. Contrato e limites em [pagamentos-reembolsos-p49.md](pagamentos-reembolsos-p49.md), ligado à [proposta original](reembolso-futuro.md).

**Decisões adotadas:** retenção de 30% somente sobre pagamento integral comprovado, com aceite prévio, esquecimento expresso pelo cliente e cancelamento antes do início com menos de três horas. Exatamente três horas devolve integralmente. Sinal/parcial, ausência de aceite, cancelamento pela loja, demais motivos ou horário já iniciado não geram taxa automática; sem antecipação não há dívida. Retenção arredondada para baixo em centavos; complemento limitado ao saldo e sujeito a análise, sem afirmar devolução antes da confirmação.

**Ainda pendente:** escolha do provedor — pergunta encaminhada, sem resposta —, integração e banco financeiro, permissões/ativação por loja, revisão da comunicação e homologação. Cancelamentos de produção permanecem sem cobrança automática, e o preço cadastrado de um serviço não será tratado como pagamento recebido. **P-49 não concluída.**

### P-70 — Pausa semanal da loja com aprovação entre sócios

**Estado atual: implementada no código; implantação pendente.** A autorização posterior permitiu desenvolver a aprovação da pausa semanal da loja, com alteração de banco e interface. A [migration nº 99 — governança da pausa semanal](../supabase/migrations/20261107220000_governanca_pausa_semanal.sql) está preparada e **ainda precisa ser aplicada pela TI**, seguindo o [pacote P-70](pacotes/2026-11-07-ti-p70-governanca-pausa-semanal.md).

A pausa própria continua conforme a permissão do profissional; a nova aprovação da loja segue a governança do servidor. O ensaio real 50%/50% continua necessário na homologação da P-41 e da implantação. Não declarar a funcionalidade ativa em produção somente pela presença do código ou pelo preparo do pacote.

## 4. Etapas externas e comprovação

- **P-39:** encaminhar o [pacote de revisão jurídica](pacotes/2026-11-07-revisao-juridica-barba-cabelo-p39.md) ao profissional responsável. Preparar o pacote não conclui a revisão. Texto e versão de aceite permanecem vigentes até uma revisão efetiva.
- **P-40/P-41/P-42:** concluir os cenários com contas e integrações reais em lojas de teste, registrando o que passou, falhou ou não pôde ser executado. Conferência de código ou serviço simulado não substitui esses resultados.
- **P-43:** testar nos aparelhos físicos disponíveis e registrar aparelho, navegador, orientação e resultado. A emulação ajuda na correção, mas não comprova o aparelho.
- **P-70:** TI aplicar e homologar a migration nº 99 pelo pacote próprio; registrar o resultado antes de tratar a aprovação semanal como ativa em produção.
- **P-28:** continua na coordenação externa já definida. Esta rodada de decisões do B&C não cria nova tarefa de programação no Flow nem repete etapas encerradas. O roteiro operacional vigente e seus resultados continuam nas referências da P-28.

As decisões acima retiram dúvidas da fila de desenvolvimento. Testes não executados, implantação não conferida e revisão profissional não recebida continuam identificados como pendentes.
