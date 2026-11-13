# Central WhatsApp aprovada — diagnóstico de impactos e plano de implementação

**Destinatário:** TI / Guardião e responsável pelo desenvolvimento do B&C.

**Data:** 13/11/2026, America/Sao_Paulo.

**Pedido do dono:** página aprovada; traduzir a experiência em funções, regras e atividades implementáveis.

**Estado:** diagnóstico de código e plano de implementação. **Não é pacote pronto para instalação.**

## 1. Decisão e ponto de partida

A nova página foi aprovada visualmente em 13/11. Isso aprova a composição e a experiência local; não constitui ordem de publicação, execução de migrations, alteração de flags, grupo real ou mensagem. Atribuição automática, segunda reserva e integração com os grupos ainda precisam de desenvolvimento antes de uma entrega operacional.

Referências verificadas:

- Página aprovada e fonte local: commit `41851ec`, ramo `codex/numeros-confirmados-2026-11-12`. Prévia DEV `/previsao-whatsapp`, dados fictícios e alterações em memória.
- Relatório recebido: `relatorio-ti-interface-iphone-revisao-2026-11-12.md`, lido integralmente, incluindo a seção final **Publicação**. SHA-256 da evidência: `98a130a05490110007c3c0de26cc7caf85e0eab4dd445cecc069997f0df266ff`.
- TI publicou o iPhone em `8b6898b9c0d3031087d05f243a8430daf3e7512f`, pai `04bf9276281c5cd8d7f42f48ecb839d1a4a9b17e`; relato de publicação às 23:13 e artefatos novos às 23:16–23:17 de 12/11. **Não reaplicar essa entrega.** Homologação física no iPhone continua pendente.
- A `origin/main` foi conferida pelo Git nesta análise e está em `8b6898b`. O ramo local incorporou essa publicação no merge `3c80b5b`; a única conciliação foi preservar as importações de CSS do viewport e da Central. Nada enviado à main.
- O relatório do iPhone não comprova o estado atual do banco/Evolution nem resolve o login por grupo. Nesta análise não houve consulta à VPS, chamada à Evolution ou alteração de produção.

A publicação do iPhone preservou Web Push, banco e Evolution. Esta demanda é outra entrega; não reiniciar esses serviços nem repetir o pacote anterior para “habilitar” a nova página.

## 2. Diagnóstico comprovado no código

| Achado                                                    | Evidência local                                                                                                                                                       | Consequência                                                                                                                                                                   |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Parte importante da página aprovada só está na prévia     | `src/routes/previsao-whatsapp.tsx` contém estatísticas, atribuição automática e `DistributionSuggestion`; rota é limitada a DEV                                       | Publicar arquivos isolados não transforma o protótipo em operação real. Integrar os componentes à Central autenticada com dados reais                                          |
| Segunda reserva não é persistida                          | `WhatsAppCentral.saveDistribution` rejeita `target.backup2`; a Central não passa `secondReserve`; `platform_set_whatsapp_route` recebe apenas principal e uma reserva | A interface de três posições exige novo contrato completo, inclusive leitura, histórico e autorização de envio                                                                 |
| Automação só existe em memória                            | `suggestMissingDistributions` calcula lote e o efeito React da prévia altera `routes` local                                                                           | Nenhuma barbearia real recebe números automaticamente ao ser criada                                                                                                            |
| Distribuição e autorização de grupo são modelos separados | `whatsapp_number_links` guarda destinos; `whatsapp_group_accounts` e `whatsapp_care_groups.approved_accounts` guardam contas autorizadas/composição                   | Vincular, reordenar ou remover número não deve ser tratado como autorização imediata de acesso ao grupo                                                                        |
| Ter números cadastrados não comprova dois administradores | A fonte-base `authorize_care_group_step_before_exclusive` verifica conjunto distinto, mas o trecho analisado não exige cardinalidade mínima de dois                   | A regra de dois admins precisa ser imposta em todas as fronteiras, além da tela. Patches instalados pela TI podem diferir; conferir assinaturas/versões antes de substituí-los |
| Métricas de grupos têm cobertura parcial                  | `20261113004000` reconhece rota de código em `whatsapp_group_login_routes`; não mede automaticamente todo fluxo da extensão                                           | Não anunciar que volume de notificações, marketing ou mensagens fora desse diário já está medido                                                                               |
| Quatro migrations são somente locais                      | `20261113001000`, `02000`, `03000`, `04000` não foram instaladas por esta entrega                                                                                     | São fonte para revisão e evolução, não uma ordem para executá-las em lote                                                                                                      |
| O adaptador de grupos exige conciliação própria           | `_shared/whatsapp-groups.ts`, `_shared/whatsapp-group-login.ts` e extensão `integrations/evolution/grupos-v2`                                                         | É preciso versionar composição e autorizar novamente a operação imediatamente antes do envio                                                                                   |

**Conclusão:** o principal trabalho restante é integrar distribuição, autorização, composição de grupos e telemetria. A aparência aprovada não demonstra que esses contratos estejam concluídos.

## 3. Regras que a implementação deve preservar

1. O catálogo operacional contém telefones efetivamente identificados e com pareamento comprovado. Tentativas sem número autenticado não viram cartões de número. Históricos de números que já operaram ficam identificados e separados de candidatos disponíveis.
2. O papel pertence à barbearia/profissional: o mesmo telefone pode ser principal em A e reserva em B. Não transferir a conexão nem remover outros vínculos para criar esse compartilhamento.
3. Cada destino comporta um principal e até duas reservas, sempre telefones físicos diferentes. Dois IDs de instância do mesmo telefone não formam duas contas.
4. Profissional sem configuração própria herda o geral. Um vínculo próprio pausado/incompleto não pode ser substituído silenciosamente pelo geral. Telefones pessoais de cliente, profissional e admin não se tornam números operacionais.
5. Número operacional conectado não equivale a conta autorizada para grupo. Exigir comprovação de controle exclusivo da plataforma, sem acesso de profissionais a dispositivos pareados, conversas, painéis, logs ou exportações.
6. Grupo exclusivo por cliente/barbearia, identificado pelo JID do provedor e ID interno. Renomear não muda sua identidade. Participantes permitidos: cliente titular e números autorizados da plataforma; nunca profissionais. Cliente nunca admin.
7. Todo grupo pronto precisa de pelo menos dois números distintos da plataforma, ambos admins. Uma segunda reserva pode elevar a composição a três contas da plataforma quando aprovada; não inserir todas as contas do inventário no grupo.
8. Reordenar é alteração de prioridade/configuração. Não é disparo, alternância por mensagem, remoção de participante nem criação de outro grupo. Exige salvar/cancelar e auditoria; criação incerta nunca é repetida sem prova persistente.
9. Em alteração de composição, confirmar o novo admin antes de remover o antigo; durante divergência bloquear códigos/envios incompatíveis. Não depender de um webhook chegar, chegar uma vez ou na ordem correta.
10. Todo envio aprovado é para grupo. Não usar privado como fallback, inclusive código de login/confirmar telefone. Resultado incerto exige revisão e não autoriza reenviar por outro número.
11. Marca voltada ao cliente é a barbearia. B&C fica na gestão de donos/admin; mensagens claras, cordiais e profissionais, sem erros ortográficos propositais.
12. Consentimentos, preferências e limite global de promoções de 0/1/3 por mês permanecem independentes da disponibilidade de números. Não fabricar mensagens para “aquecer” contas.

**Caso de múltiplos profissionais:** o grupo continua sendo do cliente/barbearia. Recomendação de integração: composição estável baseada no geral; configuração própria de profissional não concede acesso nem troca participantes por agendamento. Se um emissor próprio precisar operar naquele grupo, validar autorização e concluir uma transição versionada antes. Não implementar união indiscriminada de todas as rotas nem criar um grupo por profissional como efeito colateral. Esse contrato deve ficar explícito nos testes e no pacote final.

## 4. Transformação da página em contratos de backend

| Ação ou informação aprovada                     | Função/estrutura existente a evoluir                                                                                                                            | Resultado obrigatório                                                                                                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Carregar catálogo, destinos, status e histórico | `platform_whatsapp_directory`, `WhatsAppCentral.load`, `whatsapp_channels`                                                                                      | Separar conexão, elegibilidade, papel, pausa e histórico. Capacidade explícita para duas reservas; compatibilidade antes da migration                                         |
| Arrastar principal/reserva 1/reserva 2          | `reorderNumbers`, `platform_set_whatsapp_route`, `whatsapp_number_links`                                                                                        | Salvar a ordem inteira atomicamente, com versão esperada, três telefones distintos e histórico antes/depois; não fazer três gravações independentes                           |
| Usar número já existente em outra loja          | `platform_add_whatsapp_link`, `platform_assign_whatsapp_channel`                                                                                                | Criar apenas o vínculo; preservar todos os outros destinos e a conexão física                                                                                                 |
| Herança/personalização                          | `whatsapp_route_link`, view `whatsapp_delivery_channels`, RPC de diretório                                                                                      | Resolver próprio/geral de forma única, inclusive pausa, remoção e segunda reserva; cancelar não grava                                                                         |
| Avisos e retorno                                | `platform_update_whatsapp_link`, `shop_update_whatsapp_preferences`, `whatsapp_sync_legacy_preferences`                                                         | Preferências por destino, sem copiar a primeira loja para todas. Automatismo não liga avisos                                                                                  |
| Calcular perfis                                 | `platform_whatsapp_number_activity`, `whatsapp_send_attempts`, `whatsapp_activity_identity`                                                                     | Apenas grupo comprovado, identidade correta, janela declarada e cobertura explícita                                                                                           |
| Preservar antigos/restritos                     | `snapshot_whatsapp_activity_history`, `platform_whatsapp_number_history`, expurgo                                                                               | Totais sem conteúdo, segregados por telefone/identidade/escopo; não apagar evidência ao excluir conexão técnica                                                               |
| Gerar proposta                                  | `suggestDistribution`, `suggestMissingDistributions`                                                                                                            | Reproduzir regra no servidor. Navegador não autoriza escolha; revalidar números, carga, restrições e versões ao aplicar                                                       |
| Atribuir ao cadastrar loja                      | `register_my_barbershop` (nº 110) e futuro serviço transacional de atribuição                                                                                   | Uma atribuição idempotente por loja, com no mínimo duas contas. Falta de par não desfaz o cadastro da loja; registra comunicação aguardando números                           |
| Aplicar lote/manual                             | Novo contrato servidor, ainda inexistente                                                                                                                       | Prévia de impacto + revisão das versões/capacidade. Repetir chave não duplica vínculos nem operações de grupo. Preservar configurações existentes                             |
| Refletir configuração nos grupos                | `care_group_admin`, `care_group_begin`, `claim_care_group_operation`, `authorize_care_group_step`, `observe_care_group`, `complete_care_group_operation`        | Separar composição desejada/observada, manter JID, conciliar por versão com diário persistente e estados explícitos                                                           |
| Enviar código no grupo                          | `request_whatsapp_group_login`, `request_whatsapp_group_phone`, `whatsapp_group_login_context`, `authorize_whatsapp_group_login`, `sendGroupLogin`/`bcSendCode` | Desafio vinculado a titular/grupo/versão/emissor; verificar duas contas admins, expiração, isolamento e composição imediatamente antes da transmissão                         |
| Avisos de agendamento/marketing                 | `prepare_whatsapp_delivery`, `whatsapp_send_candidate`, `authorize_whatsapp_send`, `finish_whatsapp_send`, `whatsapp-dispatch`                                  | Adaptar efetivamente ao grupo e ao contrato protegido; manter fila, idempotência, prazo, preferências e bloqueio de privado. Não basta trocar o destino por texto com `@g.us` |
| Sinalizar falha em qualquer página              | `whatsapp-health`, monitor do cabeçalho e diretório                                                                                                             | Exibir indisponibilidade, restrição registrada, revisão ou estado desconhecido. Não atribuir bloqueio à Meta sem evidência nem reconectar por abrir cartão                    |

Os nomes de contratos **novos** são decisão de implementação; não chamar RPC inexistente como se já instalada. A relação acima aponta os pontos reais do código, não autoriza reescrever assinaturas que a TI já corrigiu na VPS.

## 5. Dados e critérios de distribuição

### 5.1 Elegibilidade antes de ordenar

Exigir telefone normalizado e pareado, conta operacional sob controle da plataforma, conexão atual, ausência de pausa/restrição pendente e capacidade para a operação. Deduplicar pelo telefone físico, não só por ID. A mesma instância/telefone deve ter carga somada entre todas as lojas. Restrições históricas não desaparecem ao cadastrar outra instância; liberar somente por revisão explícita.

Para automação, excluir resultado incerto pendente. A conexão exibida e a autorização final precisam ser atuais; não usar cache antigo como permissão. Sem par elegível, manter a barbearia aguardando números e explicar a pendência na gestão; não criar grupo com uma única conta.

### 5.2 Classificação interna aprovada na prévia

Janela: últimos 30 dias civis UTC. Os limiares são internos, não uma nota oficial de segurança/qualidade.

| Perfil                   | Critério                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| Sem histórico suficiente | Ausência/prova insuficiente de grupo, dados inválidos, sem aceites ou coleta com mais de 24 h |
| Inicial                  | Há envios a grupos aceitos pelo provedor                                                      |
| Regular                  | Pelo menos 20 aceites e 7 dias ativos/observados                                              |
| Consistente              | Pelo menos 100 aceites e 14 dias ativos/observados                                            |
| Revisar                  | Pausa ou resultado incerto, antes de qualquer preferência por volume                          |

Aceite não é entrega/leitura. Dia ativo exige envio em grupo; dias conectado e idade do cadastro/chip não substituem atividade. A idade real da conta WhatsApp não foi medida. Ausência de dados não vira zero. A coleta local atual cobre códigos protegidos de grupos; ampliar para avisos/marketing exige instrumentação comprovada e deduplicada.

Principal: menor carga de vínculos principais; em empate, menor uso medido em grupos; depois consistência, carga de reservas e desempate determinístico. Reservas: menor carga de reservas, consistência e carga de principais. O lote atualiza sua carga projetada a cada loja. Configuração já definida não é reordenada periodicamente. Esta regra distribui uso esperado; não pretende contornar restrições nem promete segurança do número.

Evolução recomendada, ainda não disponível como dado completo: fila/prioridades, agenda futura, profissionais herdando o geral, mensagens por destino, último envio, resultados conhecidos/incertos e estabilidade de conexão medida por eventos. Criar contrato e testes antes de atribuir pesos; não inventar dados ou um percentual de “aquecimento”.

## 6. Impacto no ciclo completo dos grupos

A integração de distribuição depende também de concluir os blocos de grupos já registrados como parciais:

- **Preparação:** persistir criador, segundo admin, composição e versão. Preparar nome, logo escolhida pela barbearia, admissão e controles; verificar duas contas admins antes da operação de boas-vindas.
- **Primeira mensagem:** criador não envia. O segundo admin envia uma única boas-vindas explicando notificações/preferências, escreve descrição e fixa a mensagem. Provar capacidade/resultado de cada operação; timeout não autoriza repetição cega. Renovação de fixação deve considerar a duração realmente suportada pelo provedor.
- **Nome automático:** `Notificações [Barbearia] • [Cliente]`, com prefixo do próximo agendamento quando houver, respeitando fuso da loja, limites do provedor e limpeza de dados. Remarcação/cancelamento/conclusão recalculam o título; renomeação manual não altera JID e a próxima atualização reaplica a regra. Não alterar grupo por pesquisa do nome.
- **Preferências:** ativar/desativar na plataforma. Comandos/eventos recebidos podem sinalizar divergência e consentimento, mas nunca ampliar permissões nem promover cliente.
- **Vida útil:** período de um ano, retorno voluntário dentro do período, expiração verificada também nos caminhos de envio/admissão. Encerramento exige revogar convites, parar fila e confirmar ações dos números da plataforma.
- **Limite do encerramento:** desligar/excluir registros ou sair do grupo pela API não garante apagar o histórico dos aparelhos de terceiros. Não prometer exclusão remota de todas as cópias. Registrar o que o provedor efetivamente confirma.

Uma troca de principal não deve refazer boas-vindas, renovar consentimento ou reiniciar o prazo anual. Mudanças administrativas precisam apontar quais grupos serão afetados e preservar grupos de outras lojas que compartilham o telefone.

## 7. Atividades implementáveis e responsabilidades

| Bloco                          | Trabalho a entregar                                                                                                                                                                             | Responsável/saída                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| D0 — Compatibilidade real      | Confirmar fonte publicada, timestamps/assinaturas/hashes das funções instaladas, migrations próprias do Supabase e da Evolution, imagem/digest, capacidades protegidas e agendadores existentes | TI, somente diagnóstico nesta fase; relatório sem credenciais, QR, códigos ou conteúdo de conversa             |
| D1 — Contrato de três posições | Migration nova, RPCs/view/diretório/auditoria, validações por telefone, herança e concorrência; preservar todas as configurações antigas                                                        | Desenvolvimento do B&C; testes SQL e reversão conservadora                                                     |
| D2 — Métricas/histórico        | Revisar as quatro migrations locais contra D0, completar coleta de avisos de grupo, identidade e expurgo; distinguir aceites, incerteza e falhas                                                | Desenvolvimento do B&C/integração; sem inventar backfill de eventos antigos                                    |
| D3 — Atribuição automática     | Serviço servidor idempotente, política persistida, plano explicável, aplicação com revalidação e integração ao cadastro de loja; não exigir navegador aberto                                    | Desenvolvimento do B&C; testes de duas transações concorrentes e ausência de par                               |
| D4 — Composição e ciclo        | Resolver relação distribuição/autorização, transição de admins, proteção de códigos, nome/logo/boas-vindas/descrição/fixação, expiração e encerramento                                          | Desenvolvimento do B&C e extensão Evolution quando necessário; testes com provedor fictício e banco real local |
| D5 — Frontend real             | Extrair a faixa aprovada da prévia; ligar Central a dados reais, três posições, arraste, proposta/efeitos, estados e permissões; retirar exemplos fictícios do fluxo autenticado                | Desenvolvimento do B&C; verificar os três modos de canto e telefone/tablet/PC                                  |
| D6 — Pacote executável         | Arquivos completos e patch sobre base real, hashes, dependências, comandos conferidos, operador/retorno, evidências e critérios de aceite                                                       | Codex/desenvolvedor responsável; só declarar pronto quando D1–D5 passarem                                      |
| D7 — Instalação e piloto       | Conferir pacote, backup, ensaio/revisão, instalar apenas incrementais autorizados, homologar com duas contas exclusivas e cliente consentido                                                    | TI + titular; cada mudança real deve respeitar a autorização da janela correspondente                          |

**Não entregar D1–D5 como “a TI instala e resolve”.** Se o dono designar a TI também como desenvolvedora, ela recebe este plano com os mesmos contratos e testes; isso continua sendo desenvolvimento, separado da instalação operacional. A preferência persistente é o Codex preparar o código e a TI receber arquivos completos para conferir, instalar e homologar. Não há ZIP operacional pronto nesta análise.

## 8. Pedido imediato para a TI — somente D0

Responder sem refazer a revisão do iPhone nem reiniciar serviços:

1. Informar commit efetivo do frontend e se houve alteração após `8b6898b`. A correção de iPhone já publicada deve permanecer.
2. Listar os incrementais de WhatsApp/grupos realmente instalados, por timestamp/arquivo e hash; não confiar só nos rótulos “nº 113/114/117”. Há correções anteriores parciais/fora desta cópia. Não criar tabela nova de controle de migrations para fazer essa lista.
3. Informar assinaturas/definições minimizadas dos pontos de distribuição e de grupo da seção 4, com referência à fonte/patch instalado. Não exportar usuários, números completos ou dados de grupos para isso.
4. Confirmar imagem e digest em execução, versão do contrato protegido e capacidades de duas contas/admins, descrição, foto, mensagem e fixação. Se algo não existir, marcar ausente; não improvisar rota.
5. Informar agendadores de grupos, notificações e expurgo já existentes, flags apenas por nome/estado e se o Compose/segredos sobreviveriam a uma recriação. O aviso anterior sobre segredos gravados no servidor permanece relevante: não clicar Redeploy para diagnosticar.
6. Devolver bloqueios de compatibilidade, sem parear, criar/migrar grupo, enviar mensagem, testar OTP real ou liberar piloto nesta resposta.

Se D0 já tiver evidência atual identificável, reutilizá-la e anexar a referência em vez de repetir consultas. Resultado de conexão em uma data passada não comprova que o número esteja disponível hoje.

## 9. Critérios de aceite do futuro pacote

- Mesmo telefone principal em uma loja e reserva em outra; removê-lo de uma não altera a outra. Telefone pessoal e IDs duplicados do mesmo telefone são recusados como par operacional.
- Reserva 2 grava, recarrega e aparece com a mesma ordem; arrastar não perde números, permite cancelar e falha por versão antiga sem sobrescrever. Vínculos próprios e herança preservados.
- Duas atribuições concorrentes de loja não duplicam vínculo/grupo e consideram carga atual. Repetir chave de aplicação retorna o resultado anterior. Sem par elegível, cadastro da loja permanece e comunicação fica pendente.
- Toda criação/admissão/código verifica composição e pelo menos dois admins da plataforma. Nenhum profissional ou cliente admin. Troca preserva o JID e confirma novo admin antes de retirar o antigo.
- Operação pendente de versão antiga não envia após reordenação/remoção. Código de grupo revogado, cliente ausente, identidade divergente ou grupo expirado não é enviado. Nunca fallback privado.
- Contagem comprovada de grupos: privados/legados não entram; reentregas, reinício, purge e troca de telefone não duplicam nem transferem contagens. Falta de dados é explícita. Não guardar texto/código OTP nas métricas.
- Criação ou envio incerto não é repetido, inclusive por reserva. Recuperar somente por diário persistente; webhook zero/repetido/fora de ordem exige reconciliação.
- Nome/agenda/logo/boas-vindas/fixação/ciclo anual seguem a seção 6; alterações de prioridade não reiniciam o ciclo nem enviam outra boas-vindas.
- Interface autenticada com dados reais em celular/tablet/PC, três modos de canto, toque, teclado e sem spinner a cada seleção. Somente carregamento inicial/ação que realmente precisa dele bloqueia a região afetada.
- iPhone: preservar viewport/recortes/teclado já publicados. Web Push, pagamentos e Flow fora do escopo; sem alteração de chaves/agendadores não relacionados.

Evidência já existente da prévia: 606 testes gerais + 17 testes do modelo, 45 verificações SQL de roteamento, testes de histórico/escopo/permissões e 21 composições de interface. Esses resultados são de bancada com dados fictícios e **não** demonstram instalação ou homologação de D1–D5.

## 10. Instalação futura e retorno

Ordem conceitual, **não comandos executáveis nesta entrega**: D0 → concluir e testar D1–D5 → pacote D6 → revisão TI → autorizações da janela → backup/compatibilidade → incrementais compatíveis sem ativar automação → frontend real → conferência → piloto consentido → ativação gradual e monitorada.

A automação nasce desligada no servidor; a escolha de ligar precisa ser persistente e auditada, sem depender da prévia ou de uma aba aberta. Não publicar um frontend que exija RPC/segunda reserva antes da compatibilidade correspondente. Não ativar grupos incompletos como compensação por uma instalação parcial.

Retorno conservador: pausar somente a automação/rotas afetadas, impedir novas mutações e transmissores incompatíveis, preservar diário, JIDs, agregados e admins confirmados. Não remover segunda reserva ou histórico para encaixar código antigo. Não restaurar caminho privado de OTP. Toda reversão efetiva precisa ser ensaiada contra as migrations/versões finais; frontend por novo commit, sem force-push.

## 11. Formato da devolutiva

`Responde a: 2026-11-13-ti-central-whatsapp-diagnostico-impactos-p122.md`.

Informar: data/hora e fuso; etapa D0/D1…; base/commit/digests; fontes conferidas; compatibilidades e lacunas; arquivos/hashes alterados (se houver etapa autorizada); testes; estado **diagnosticado / desenvolvido localmente / pronto para instalar / instalado / homologado**, sem misturar. No pedido imediato D0, informar explicitamente “nenhuma instalação/ativação realizada”.

**Próximo marco:** compatibilidade D0 e desenvolvimento dos contratos faltantes. A página está aprovada; a integração operacional ainda não está pronta para implantação.

## 12. Fontes de continuidade

- [Prévia aprovada e limites](../central-whatsapp-distribuicao-local-2026-11-12.md).
- [Critérios de atividade somente em grupos](../criterios-atividade-whatsapp-2026-11-12.md).
- [Última devolutiva de prontidão/login](2026-11-12-ti-p120-retorno-117-login-claro.md): não confundir frontend com piloto pronto.
- [Guia do iPhone já publicado](2026-11-12-ti-interface-iphone.md): a atualização de estado no topo supera o texto histórico de entrega local.
- Desenvolvimento local: `src/features/platform/{WhatsAppCentral,WhatsAppDistribution,DistributionSuggestion,NumberActivity}.tsx`, `src/lib/whatsapp/{distribution-order,distribution-suggestion,number-activity}.ts` e `src/routes/previsao-whatsapp.tsx`.
- Contrato Supabase: quatro migrations `2026111300{1000,2000,3000,4000}`; consultar os nomes completos na pasta `supabase/migrations/`. Não confundir com os números históricos de implantação externa.
- Grupos: migrations `20261111120000`, `20261111200000`, `20261111210000`, `20261111220000`; funções compartilhadas e extensão citadas nas seções 2 e 4. A fonte local não substitui a conferência dos incrementais que a TI aplicou depois.

Este arquivo pode ser encaminhado como diagnóstico e plano. O pacote de instalação posterior precisará dos arquivos executáveis completos e verificados; esta documentação não os substitui.
