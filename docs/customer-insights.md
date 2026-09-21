# Acompanhamento de clientes — implementação e evolução

## Regras comuns

- Nível 1: conta e reserva; não foram acrescentados campos obrigatórios ao cadastro.
- Nível 2 operacional: fatos de reservas, preço registrado e presença. Não depende de permissão de análise opcional.
- Nível 2 opcional: eventos de tentativas de confirmar reserva, sucesso e falha. Só persistem quando `analytics=true` no servidor.
- Nível 3: perguntas opcionais com códigos fixos e versão 1. Nenhuma resposta inferida. Ausência de resposta não é uma preferência.
- Demo não envia dados de negócio ao servidor. Produção não inclui clientes simulados.
- Preferências de análise, pesquisas e marketing começam desligadas e são salvas explicitamente.
- Não há disparo de mensagens ou campanhas nesta entrega. A escolha de marketing apenas registra a preferência.

## Implementado

### Cliente

Meu perfil → Meus dados e privacidade: explicação dos níveis, switches independentes, confirmação ao salvar, respostas anteriores e exclusão de dados opcionais.

Desligar análise apaga eventos opcionais já registrados. Apagar dados opcionais remove respostas e eventos e desliga as três opções. Conta, reservas e trilha de escolhas de privacidade permanecem.

Card de uma pergunta no início, depois de existir uma reserva. Exige opção de pesquisas ligada. Ordem: origem de descoberta, período, escolha do profissional, frequência desejada de visitas e preferência de conversa. Opções fixas em `src/features/insights/model.ts`; validação independente no banco.

O painel global contém uma biblioteca dos oito questionários ativos, com prévia completa das opções, momento de exibição e regra de repetição. No perfil do cliente, “Ver as perguntas disponíveis” apresenta uma lista resumida. Essas prévias não gravam respostas nem alteram a elegibilidade. A pesquisa de interesse em novos serviços usa opções fixas: sobrancelha, limpeza de pele, hidratação, coloração, manicure, massagem, nenhum, outro ou não responder.

O servidor reserva uma oportunidade no máximo a cada 30 dias, inclusive quando dispensada ou não respondida. Perguntas de preferência não se repetem em 180 dias. Origem é perguntada uma vez enquanto seu histórico existir. A exclusão de respostas não remove o limite global de 30 dias. Múltiplas abas são serializadas por lock de usuário.

Em um atendimento concluído, a barbearia pode usar “Registrar opinião” quando o cliente responder presencialmente. O sistema guarda “informado pelo cliente à equipe”, quem registrou, o atendimento e quando. A função exige que o cliente tenha permitido pesquisas, aceita somente opções padronizadas e participa do mesmo intervalo global de 30 dias.

### Avaliação pós-atendimento

Após a pergunta de origem, uma oportunidade elegível pode pedir nota de 1 a 5 para o atendimento concluído mais recente, com fim previsto já passado e realizado nos últimos 90 dias. Reservas futuras ou canceladas não se qualificam. O vínculo e a data do atendimento são salvos e exibidos no card e no histórico do cliente.

Em outra oportunidade (nunca antes do intervalo global de 30 dias), uma nota numérica permite a pergunta de melhoria sobre o mesmo atendimento. Todas as notas de 1 a 5 seguem a mesma regra, não apenas notas baixas. Pular a nota não gera essa pergunta. Cada uma dessas perguntas respeita o limite de repetição de 180 dias, e um mesmo atendimento não recebe a mesma pergunta novamente enquanto o histórico existir. A seleção no demo reproduz a regra do servidor.

As respostas são declaradas pelo cliente; nenhuma nota é inferida de cancelamentos, frequência ou ausência. O painel de agregados de satisfação continua como evolução futura; esta entrega armazena e permite ao cliente consultar/exportar suas respostas.

### Cancelamentos

Cliente e barbearia usam a mesma lista padronizada: imprevisto, horário, mudança de planos, preço, deslocamento, serviço ou outro. Informar o motivo é opcional. O servidor registra motivo, origem, responsável e horário junto da mudança de status, na mesma operação. Cliente vê apenas os próprios cancelamentos; dono vê apenas a própria barbearia. O histórico distingue cancelamento do cliente e do estabelecimento. Não comparecimento permanece um fato separado.

### Acesso e pedidos de exclusão

Meu perfil permite baixar JSON com dados da conta (sem credenciais), perfil, próprias reservas, fatos/histórico de atendimento, pontos, pesquisas, escolhas e eventos opcionais ainda existentes. No demo, o arquivo inclui apenas o cliente visualizado, nunca os outros 199 clientes.

Solicitar exclusão cria um protocolo idempotente. O cliente pode acompanhar e cancelar. O gestor global tem fila de pedidos e ação de iniciar análise. RLS bloqueia acesso direto; RPCs verificam titular/papel. Nenhuma conta ou reserva é apagada por esse pedido. A execução final e seu encerramento dependem de uma etapa administrativa posterior, ainda não implementada.

### Operação e indicadores

Novas reservas recebem um preço registrado, que não muda quando o catálogo é editado. Trocar o serviço na reserva atualiza o preço dessa reserva. Não se inventou preço para registros anteriores à migração: os indicadores exibem quantas reservas não possuem histórico.

Alterações de status e horário têm trilha com autor e horário do servidor. A equipe pode registrar chegada e início no dia da reserva e não comparecimento somente após o fim previsto. São horários registrados pela equipe, não sensores de presença. Ausência é representada por cancelamento mais `no_show_at`, distinguida no painel.

Painel da barbearia: reservas, clientes distintos, conclusões, cancelamentos, ausências, valor reservado dos concluídos e espera média com tamanho da amostra. Janela do dia selecionado.

Painel global: agregados dos últimos 30 dias, sem respostas pessoais ou lista de clientes. Eventos opcionais identificados como amostra de usuários que permitiram a coleta, nunca como total oficial de reservas.

Avaliações, pontos de melhoria e motivos de cancelamento aparecem apenas de forma agregada. O servidor só libera média e distribuição a partir de cinco respostas válidas no período; abaixo disso, o painel mostra apenas o tamanho insuficiente da amostra. Respostas “Prefiro não responder” não entram nas distribuições. O dono acessa somente a própria barbearia e o gestor global acessa o conjunto da plataforma.

O interesse em novos serviços também aparece nesse bloco. Cada resposta recebe automaticamente o contexto da barbearia através da reserva mais recente. “Nenhum destes” e “Prefiro não responder” não são contados como demanda. A distribuição segue a mesma proteção de amostra mínima de cinco respostas.

Fórmulas:

- Clientes: `count(distinct customer_id)` das reservas com início na janela.
- Cancelados: status cancelado, excluindo fatos com `no_show_at`.
- Ausentes: fatos com `no_show_at`.
- Valor reservado concluído: soma do preço registrado de reservas concluídas. Não equivale a pagamento.
- Espera: média de `started_at - arrived_at`, somente registros completos; exibe contagem da amostra.

As janelas da interface ainda usam o fuso do navegador; padronizar toda navegação com o fuso cadastrado da barbearia é uma melhoria pendente. O servidor usa o fuso da barbearia para validar o dia de presença.

## Segurança e retenção

Tabelas novas com RLS e sem acesso direto para `anon`/`authenticated`. RPCs derivam o cliente de `auth.uid()`. Dono só consulta a própria barbearia; acesso global exige papel da plataforma. Não foram adicionados dados de saúde, renda, localização precisa, gravações de tela ou conteúdo digitado.

`privacy_history` mantém versão e escolhas explícitas. Não houve alteração retroativa das escolhas de usuários existentes. A versão de texto atual é 1; mudanças de finalidade exigem revisão da experiência e do registro.

Eventos opcionais detalhados são eliminados após 90 dias por `purge_customer_usage()`, agendada diariamente em `/etc/cron.d/barba-insights-retention` no servidor atual. Em outro ambiente, reinstalar o agendamento. A função não é executável pelo cliente. Não há retenção automática definida para reservas, pagamentos ou consentimentos: exige política específica antes de eliminação.

## Próximas entregas do plano original — ainda não implementadas

1. Execução e encerramento da exclusão integral pelo responsável, com política de retenção. A exportação e a solicitação/acompanhamento já estão implementadas; o pedido não executa exclusão automaticamente.
2. Ampliar o fluxo presencial com uma confirmação visível do cliente, caso o atendimento use dispositivo compartilhado. O registro pela equipe, interesse em novos serviços, motivo de cancelamento, satisfação e melhoria pós-atendimento já estão implementados.
3. Funil completo com identificador de tentativa, seleção de serviço, consulta sem disponibilidade, categoria de dispositivo e versão do app. Os códigos de catálogo e indisponibilidade estão reservados, mas ainda não instrumentados.
4. Pagamento efetivo, descontos, serviço adicional, ticket médio pago e valor vitalício observado; sem misturar preço de catálogo com receita.
5. Coortes de retenção, segmentação por frequência/recência e relatórios de preferências com supressão de grupos pequenos.
6. Campanhas e experimentos com grupo de comparação, canal escolhido e opt-out. Não enviar campanhas até existir a integração e a autorização específica.
7. Revisão de política de privacidade, finalidades e prazos pelo responsável pelo produto antes de lançamento público.

## Verificação

- `npm test`: inclui cadência, exclusão opcional, padrões desligados e preço histórico no demo.
- `supabase/tests/customer_insights.sql`: executar depois de `booking_reliability.sql` na mesma transação e terminar em ROLLBACK. Testa isolamento, acesso, consentimento, exclusão, cadência e captura de preços.
- Browser: fluxo de permissões → pesquisa → resposta → exclusão → nova ativação sem furar prazo; presença; demo sem escritas remotas; viewport móvel e desktop.
