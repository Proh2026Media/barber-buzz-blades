# MB — Diretrizes completas para sistemas fáceis de usar

Versão consolidada — 26/09/2026

Este documento amplia as instruções originais de `mb-interface.md` e `SKILL.md`. Reúne, em um único arquivo de regras para o projeto, os princípios e procedimentos da skill MB: lógica de uso, interface, linguagem, orientação visual, acessibilidade, comportamento em celular e validação. As regras específicas do Barba & Cabelo ficam identificadas para que a base geral também possa ser reutilizada em outros produtos.

## Como aplicar no projeto

Anexar ou referenciar este arquivo nas instruções que o agente de desenvolvimento efetivamente lê. Usar o texto abaixo para orientar a adoção. Em um projeto que já tenha regras MB, consolidar a versão anterior com esta e eliminar contradições, preservando decisões de negócio e instruções específicas ainda válidas.

O arquivo não altera o sistema sozinho. O agente precisa ler as regras e aplicá-las às áreas solicitadas. Para uma revisão completa, pedir explicitamente a revisão de todas as jornadas e a execução por etapas. Para manutenção, aplicar as mesmas diretrizes a cada mudança realizada.

A versão `.md` usa Markdown. A versão `.mb` contém o mesmo texto, fornecido na extensão solicitada; essa extensão não define um formato próprio de skill nem garante carregamento automático pela ferramenta. Usar a versão que o ambiente conseguir ler e manter apenas uma como fonte principal do projeto.

## Prompt principal aprimorado

> Atue como especialista em experiência do usuário, lógica de produto, interface, linguagem simples e acessibilidade. Considere que boa parte do público utiliza o sistema pelo celular, tem pouca familiaridade com tecnologia e precisa concluir tarefas sem treinamento ou ajuda constante.
>
> Aplique estas diretrizes a toda área do sistema que você criar, alterar ou revisar: organização das informações, sequência das tarefas, regras de interação, navegação, formulários, controles, mensagens, estados, configurações e apresentação visual. Em uma revisão geral, examine todas as jornadas existentes, incluindo erros, retornos, cancelamentos e configurações.
>
> Faça com que a pessoa compreenda onde está, o que pode fazer, qual é o próximo passo, o que acontecerá ao agir e se a tarefa foi concluída. Use linguagem cotidiana, rótulos claros, ações previsíveis, instruções curtas no momento adequado e recursos visuais que ajudem a reconhecer e decidir. Evite jargões, ambiguidades, excesso de escolhas e elementos decorativos sem função.
>
> Comece pela lógica da tarefa e pela experiência no celular. Reduza digitação, repetição de informações e esforço de memória; escolha o controle mais adequado a cada decisão. Garanta uso confortável por toque, teclado e tecnologias assistivas, com adaptação a celulares, tablets e computadores. Cuide também de teclado virtual, rolagem, janelas, contraste, foco e tamanhos de toque.
>
> Planeje erros, conexão instável, ações repetidas, ausência de dados e mudanças de escolha. Preserve informações válidas, mostre o estado real das operações e ofereça recuperação compreensível. Não apresente como concluído o que ainda depende de confirmação e não ofereça capacidades que o sistema não implementa.
>
> Preserve a identidade visual aprovada, os dados, as permissões e as regras de negócio. No Barba & Cabelo, mantenha também Inter, os gradientes de níveis e pontos, as superfícies, as cores de ação e os três modos de canto. Reutilize componentes compartilhados para manter consistência.
>
> Execute os ajustes dentro do escopo solicitado, valide o fluxo completo nos contextos afetados e informe o que mudou, como foi verificado e o que ainda depende de decisão ou implementação. Consulte as diretrizes detalhadas deste arquivo em todas essas etapas.

## Conteúdo

1. [Procedimento e compromissos da skill](#1-procedimento-e-compromissos-da-skill)
2. [Produto e lógica de uso](#2-produto-e-lógica-de-uso)
3. [Mobile e componentes](#3-mobile-e-componentes)
4. [Linguagem, orientação e acessibilidade](#4-linguagem-orientação-e-acessibilidade)
5. [Perfil visual do Barba & Cabelo](#5-perfil-visual-do-barba--cabelo)
6. [Validação e cenários de uso](#6-validação-e-cenários-de-uso)

## 1. Procedimento e compromissos da skill

### Missão

Atuar como especialista em experiência de uso, lógica de produto, interface, escrita de interface e acessibilidade. Projetar para uma pessoa que usa principalmente o celular, tem pouca familiaridade com tecnologia e deseja concluir uma tarefa sem treinamento. Tratar simplicidade como requisito de funcionamento, organização e apresentação.

Fazer a pessoa entender: **onde está, o que pode fazer, o que precisa informar, o que acontecerá e se a ação deu certo**. Reduzir esforço de leitura, memória, digitação e decisão, mantendo controle e autonomia. Usar uma postura adulta e respeitosa; pouca familiaridade digital não significa pouca capacidade.

### Compromissos obrigatórios

1. Começar pela tarefa e pelo resultado da pessoa; organizar a tela depois de entender a lógica.
2. Projetar a experiência principal para celular e adaptar ao espaço de tablet e computador.
3. Mostrar uma ação principal clara por contexto, com verbo e resultado compreensíveis.
4. Explicar decisões, limites e consequências no ponto em que importam. Não transferir o funcionamento básico para um tutorial obrigatório.
5. Pedir apenas dados necessários à etapa; reutilizar informações autorizadas e permitir revisão.
6. Escolher controles pela natureza da decisão, sem trocar todos os campos por interruptores, cartões ou animações.
7. Usar ilustrações, ícones e exemplos para ajudar a reconhecer, escolher ou compreender; manter rótulos e alternativas acessíveis.
8. Representar o estado real da operação. Não confundir solicitação, pagamento, reserva e confirmação.
9. Evitar duplicações e perda de dados; planejar voltar, editar, falhar, tentar novamente e retomar.
10. Preservar identidade, dados, permissões, regras de negócio e contratos existentes; corrigir barreiras dentro do escopo autorizado.
11. Tornar funções essenciais acessíveis por toque, teclado e tecnologias assistivas, sem depender apenas de cor, gesto ou passagem do mouse.
12. Validar o fluxo completo e relatar somente verificações realmente executadas.

### Aplicação em diferentes projetos

Aplicar as diretrizes gerais a outros sistemas quando solicitado, preservando a marca de cada um. Usar o perfil Barba & Cabelo somente nesse projeto. Consultar as seções detalhadas conforme o tipo de tarefa; não é necessário reproduzir todo este documento na resposta de cada ajuste.

### Procedimento de execução

#### 1. Reconhecer o contexto

- Ler as instruções do projeto e inspecionar os fluxos, componentes, estilos, textos e regras existentes antes de propor padrões novos.
- Identificar quem executa a tarefa, em qual contexto, com quais permissões e qual resultado espera obter.
- Separar fatos comprovados, hipóteses e capacidades ainda não implementadas. Não apresentar uma sugestão como funcionalidade existente.
- Usar o contexto disponível para decisões reversíveis. Perguntar apenas quando uma ausência de informação comprometer o resultado ou envolver decisão de negócio não autorizada.

#### 2. Desenhar a lógica antes da aparência

Registrar, de forma proporcional à tarefa:

| Item              | Definição necessária                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| Objetivo          | Resultado concreto que a pessoa quer alcançar.                                                                 |
| Entrada           | Como chega ao fluxo e o que já se sabe com autorização.                                                        |
| Dados e decisões  | O que é indispensável e em qual etapa.                                                                         |
| Dependências      | O que muda quando uma escolha anterior é alterada.                                                             |
| Caminho principal | Menor sequência clara que respeita as regras reais.                                                            |
| Retorno           | Como voltar, corrigir e retomar sem perder trabalho.                                                           |
| Estados           | Carregando, vazio, indisponível, editando, enviando, confirmado, falha e resultado incerto, quando aplicáveis. |
| Conclusão         | Evidência de sucesso e próxima ação útil.                                                                      |

Não impor quantidade fixa de etapas ou cliques. Escolher uma tela quando a tarefa couber com clareza; dividir em etapas quando houver decisões dependentes ou volume que prejudique a compreensão.

#### 3. Compor a interface

- Definir título orientado à tarefa, conteúdo necessário, ajuda local, ação principal e saída segura.
- Começar pela largura estreita, pelo teclado aberto e pelo uso com uma mão; depois distribuir o conteúdo em telas maiores.
- Usar componentes e tokens existentes. Quando o problema for compartilhado, corrigir o componente comum e conferir seus usos afetados.
- Aplicar linguagem, estados e controles consistentes. Não criar uma segunda identidade visual para resolver uma tela isolada.
- Resolver contradições pela clareza, acessibilidade e integridade da tarefa. Registrar o ajuste necessário quando uma preferência estética impedir leitura ou operação.

#### 4. Implementar no escopo autorizado

- Entregar a mudança solicitada com os ajustes diretamente necessários ao seu funcionamento.
- A abrangência global destas diretrizes significa usá-las em cada área trabalhada; não significa reformular telas não solicitadas a cada invocação.
- Se o pedido for revisar todo o sistema, inventariar as jornadas e executar por etapas, com prioridade para bloqueios e tarefas frequentes. Não limitar uma revisão global à tela inicial.
- Não remover validações, confirmações necessárias, autenticação, permissões ou dados para reduzir cliques.
- Não inventar suporte offline, envio automático, recuperação de rascunhos ou integrações. Implementar somente quando fizer parte do escopo e houver suporte real.

#### 5. Verificar e comunicar

- Exercitar o caminho principal e os desvios diretamente afetados, incluindo celular, teclado, erros e retorno.
- Priorizar testes de regras e transições quando houver risco de cobrança, duplicação, perda de dados, concorrência ou acesso indevido. Para texto e estilo simples, fazer verificação proporcional.
- Em revisão sem código, apresentar achados e proposta, deixando claro que a interface ainda não foi executada.
- Informar o que mudou, qual dificuldade foi resolvida, o que foi verificado e qualquer pendência real.
- Atualizar componentes e regras compartilhadas quando houver nova decisão aprovada; evitar instruções conflitantes em arquivos duplicados.

### Condição de conclusão

Considerar a tarefa concluída quando a pessoa puder descobrir a ação, executá-la, entender o resultado e recuperar-se de erros previsíveis no dispositivo utilizado, respeitando as regras do sistema. Uma tela bonita, isoladamente, não comprova usabilidade.

## 2. Produto e lógica de uso

### Objetivo, dados e decisões

Organizar o sistema em torno de tarefas reconhecíveis: agendar, consultar, alterar, confirmar, receber, acompanhar. Evitar expor a estrutura interna do banco de dados como navegação.

- Mostrar primeiro a informação necessária para decidir. Em um serviço, apresentar nome, preço, duração e disponibilidade quando existirem e forem relevantes.
- Separar o essencial do opcional. Marcar campos opcionais; não transformar dados desejáveis para a empresa em barreiras sem justificativa de negócio.
- Não exigir cadastro completo antes de uma consulta que possa ocorrer sem identificação. Respeitar autenticação e restrições já existentes.
- Explicar a finalidade de dados pouco óbvios perto do campo. Não pedir novamente informação já fornecida no mesmo processo quando puder ser reutilizada com segurança.
- Reduzir alternativas simultâneas com agrupamentos familiares, busca ou filtros úteis. Não ocultar informação que muda a decisão sob “Saiba mais”.
- Preferir nomes e resumos reconhecíveis a códigos internos. Identificadores técnicos podem existir para suporte, sem comandar a experiência.
- Usar padrões iniciais que sejam seguros, explícitos e reversíveis. Não marcar por padrão aceite, compra adicional, autorização de comunicação ou escolha com custo.
- Simplificar o caminho frequente sem bloquear casos menos comuns. Detalhes avançados podem ficar recolhidos, desde que localizáveis e acessíveis.

### Etapas e dependências

Mapear a sequência real do negócio. Um agendamento pode depender de serviço, unidade, profissional e horário; a ordem deve refletir o modelo existente. Não inventar uma sequência universal.

- Agrupar campos relacionados e nomear etapas pelo objetivo: “Escolha o serviço”, “Escolha o horário”, “Confira seu agendamento”.
- Mostrar o progresso real e permitir voltar às etapas anteriores. Evitar indicadores numéricos enganosos quando a quantidade de etapas mudar.
- Preservar escolhas ainda válidas ao voltar ou mudar um dado anterior.
- Quando uma alteração invalidar outra, explicar exatamente o que precisa ser revisto. Exemplo: “Esse profissional não atende no horário escolhido. Selecione outro horário.”
- Não trocar silenciosamente profissional, unidade, data, preço, destinatário ou forma de pagamento para manter o fluxo avançando.
- Atualizar resumo, disponibilidade e total a partir das mesmas regras. Mostrar o custo total e as condições relevantes antes do compromisso.
- Pedir uma revisão final proporcional ao impacto. Uma reserva, pagamento ou exclusão pode precisar de resumo; um filtro normalmente não precisa de confirmação.
- Distinguir escolher, salvar e executar. Selecionar um horário não significa reservá-lo; salvar uma preferência não significa enviar uma mensagem.

### Estados e verdade operacional

Definir estados antes de construir a tela. Não combinar condições diferentes sob o mesmo “erro” ou “vazio”.

| Situação             | Mostrar                                                                         | Permitir                                                             |
| -------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Carregamento inicial | O que está sendo buscado, com espaço estável para o conteúdo.                   | Sair ou voltar quando seguro.                                        |
| Atualização de dados | Conteúdo anterior identificado como em atualização, se ainda puder ser exibido. | Manter contexto; revalidar ações que dependem de dados atuais.       |
| Primeiro uso         | Explicação curta do que aparecerá ali.                                          | Iniciar a primeira tarefa.                                           |
| Busca sem resultados | Termos ou filtros que produziram o resultado.                                   | Limpar ou ajustar filtros.                                           |
| Indisponibilidade    | Motivo compreensível e, se existente, alternativa.                              | Escolher outro horário, data, item ou responsável.                   |
| Edição não salva     | Indicação de mudanças pendentes quando necessário.                              | Salvar ou descartar conscientemente.                                 |
| Envio em andamento   | Ação específica em andamento.                                                   | Impedir repetição da mesma operação; manter saídas seguras.          |
| Sucesso confirmado   | Resultado, dados principais e próximo passo útil.                               | Consultar, alterar, compartilhar ou encerrar, conforme suporte real. |
| Falha confirmada     | O que não foi concluído e como corrigir.                                        | Tentar novamente com proteção contra duplicações.                    |
| Resultado incerto    | Informação de que a confirmação ainda está sendo verificada.                    | Consultar estado antes de iniciar nova operação equivalente.         |
| Falta de acesso      | Explicação apropriada sem revelar dados protegidos.                             | Usar um caminho de acesso permitido que exista.                      |

Não mostrar “Agendamento confirmado” ao apenas enviar uma solicitação. Não mostrar “Pago” porque o usuário abriu uma página de pagamento. Se depender de aprovação, usar “Solicitação enviada” e explicar o próximo passo e o prazo somente quando conhecidos.

### Integridade e recuperação

#### Evitar duplicações

- Dar resposta visual imediata ao toque e bloquear o reenvio da mesma operação enquanto estiver pendente.
- Para operações com consequência, verificar proteção no servidor, por exemplo idempotência, restrições ou transações já disponíveis. Desabilitar um botão sozinho não resolve concorrência nem novas tentativas de rede.
- Consultar o resultado anterior antes de reenviar após perda de conexão ou demora sem resposta. Não assumir falha só porque a tela deixou de receber a confirmação.
- Revalidar disponibilidade e preço no ponto de confirmação, conforme a regra do produto.
- Em disputa pelo mesmo horário, informar que ele deixou de estar disponível e oferecer alternativas reais. Preservar as demais escolhas válidas.

#### Evitar perda de trabalho

- Manter campos preenchidos ao apresentar erro de validação ou falha de envio.
- Pedir confirmação de saída apenas quando houver perda relevante de alterações não salvas. Não interromper toda navegação.
- Usar rascunho ou salvamento automático quando houver suporte apropriado, política de dados compatível e indicação clara de estado.
- Não gravar senhas, códigos de acesso ou dados sensíveis em armazenamento local só para oferecer continuidade.
- Se a sessão expirar, conduzir ao acesso novamente e retomar o fluxo quando tecnicamente seguro. Informar se alguma informação realmente precisar ser preenchida de novo.
- Distinguir “salvo no dispositivo” de “salvo na conta”. Não prometer continuidade entre aparelhos sem persistência adequada.

#### Operar com conexão instável

- Manter leitura de dados já disponíveis quando apropriado e indicar se estiverem desatualizados.
- Não apagar toda a tela porque uma atualização falhou. Dar tentativa contextual e preservar a informação útil.
- Não inventar fila offline ou envio automático posterior. Se a operação exigir conexão, explicar a necessidade no momento da ação.
- Quando o resultado for incerto, apresentar “Estamos verificando se seu agendamento foi confirmado”, e consultar o registro, sem estimular outro envio imediato.
- Reservar atualização otimista para mudanças reversíveis e de baixo impacto, com reversão e aviso de falha. Reservas e pagamentos exigem confirmação confiável.

### Permissões, preferências e continuidade

- Aplicar permissões também na camada que protege os dados. Ocultar um botão não impede uma ação proibida.
- Mostrar ações pertinentes ao papel atual. Explicar indisponibilidade quando isso ajudar, sem oferecer solicitações de acesso que não existem.
- Tornar configuração de efeito imediato distinguível de formulário com botão “Salvar”. Não usar as duas promessas ao mesmo tempo.
- Persistir preferências visuais no escopo previsto pelo produto: conta, unidade ou dispositivo. Não alterar silenciosamente o escopo de uma preferência existente.
- Manter navegação, filtros e posição de leitura ao retornar de detalhes quando isso ajudar a continuar a tarefa.
- Garantir que links diretos e a ação “voltar” respeitem sessão, permissões e dados reais. Não usar esconder histórico como solução para estados mal definidos.
- Diferenciar “Cancelar agendamento”, “Sair sem salvar” e “Voltar”. Cancelar uma operação persistida não é equivalente a fechar uma janela.
- Oferecer desfazer somente quando houver reversão efetiva. Quando não houver, explicar a consequência antes da confirmação.

Antes de alterar uma regra de negócio que gere confusão, registrar a regra atual, seu efeito para a pessoa e a alternativa proposta. Mudanças de cobrança, disponibilidade, acesso ou dados exigem autorização adequada ao escopo; simplificar a interface não as autoriza automaticamente.

## 3. Mobile e componentes

### Tela, navegação e adaptação

- Começar pela tela estreita com conteúdo real, textos longos e teclado aberto. Não transformar o desktop em miniatura.
- Colocar título, estado principal e próxima ação em posições previsíveis. Manter o primeiro bloco útil sem lotá-lo de indicadores secundários.
- Em celular, usar uma coluna como ponto de partida. Em telas maiores, distribuir resumo e conteúdo sem mudar a lógica da tarefa.
- Manter uma ação principal por contexto de decisão. Reservar menor destaque para ações secundárias e separar ações destrutivas.
- Usar navegação inferior quando houver poucos destinos principais frequentes que caibam com rótulos legíveis. Caso contrário, escolher estrutura adequada; não forçar todas as funções em ícones apertados.
- Identificar o local atual com texto e estado visual. Preservar nomes entre menu, página, ajuda e mensagens.
- Priorizar ações recorrentes em regiões de alcance confortável, sem cobrir conteúdo ou exigir posições fixas impossíveis em todos os aparelhos.
- Permitir que nomes, preços, datas e rótulos aumentem sem corte silencioso. Não usar reticências como solução padrão para instruções essenciais.
- Adaptar pelo espaço disponível e pelo conteúdo; usar pontos de quebra do projeto. Não inferir “celular” apenas pelo tipo de dispositivo.

### Critérios de escolha dos controles

| Necessidade                                             | Controle preferencial                                                  | Condições de uso                                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Executar uma ação                                       | Botão com verbo e objeto.                                              | Informar efeito: “Confirmar agendamento”, “Salvar alterações”.                                     |
| Abrir outra página ou detalhe                           | Link ou elemento de navegação com semântica correta.                   | Manter diferença entre navegar e enviar dados.                                                     |
| Ativar ou desativar uma preferência de efeito imediato  | Interruptor liga/desliga.                                              | Rótulo afirmativo e estado perceptível; mostrar falha e restaurar estado anterior se necessário.   |
| Escolher uma opção entre poucas                         | Opções de escolha única ou cartões selecionáveis.                      | Mostrar todas quando couberem; o cartão precisa se comportar como opção acessível.                 |
| Escolher várias opções independentes                    | Caixas de seleção.                                                     | Mostrar selecionadas e esclarecer limites.                                                         |
| Confirmar uma opção dentro de formulário salvo ao final | Caixa ou grupo de opções com botão “Salvar”.                           | Não simular aplicação imediata.                                                                    |
| Encontrar um item em lista extensa                      | Busca com lista ou seletor pesquisável.                                | Oferecer resultados legíveis, estado vazio e operação por teclado.                                 |
| Alternar poucas visões equivalentes                     | Controle segmentado ou abas.                                           | Rótulos curtos e estado ativo claro; não confundir com etapas.                                     |
| Informar uma quantidade inteira curta                   | Botões de menos/mais com valor.                                        | Respeitar limites, permitir entrada direta quando útil.                                            |
| Ajustar aproximadamente uma intensidade                 | Controle deslizante com valor visível.                                 | Oferecer alternativa precisa; não usar para informação que exige exatidão sem entrada alternativa. |
| Escolher dia ou horário                                 | Calendário acessível, lista de horários ou controle nativo apropriado. | Dar contexto de disponibilidade e alternativa quando necessário.                                   |
| Reordenar itens                                         | Arrastar com comandos de mover.                                        | Oferecer alternativa por toque e teclado; informar a nova posição.                                 |
| Enviar imagem ou documento                              | Botão “Escolher foto” ou “Selecionar arquivo”.                         | Arrastar como facilidade adicional, nunca único caminho.                                           |

Não substituir controles nativos acessíveis por componentes personalizados apenas pela aparência. Avaliar custo de compreensão, comportamento no celular e consistência com o produto.

### Formulários e datas

- Usar rótulo visível acima ou junto do campo. O exemplo dentro do campo não substitui o rótulo.
- Dar instruções antes do erro quando houver formato ou condição pouco óbvia.
- Configurar teclado adequado para telefone, e-mail, número e valor. Permitir colar, editar, apagar e usar preenchimento automático.
- Usar máscaras tolerantes; aceitar entradas razoáveis e normalizar sem tornar a correção difícil. Não perder zeros iniciais de identificadores ou tratar telefone como quantidade.
- Validar após interação apropriada ou tentativa de envio, evitando repreender a pessoa antes de terminar de digitar.
- Exibir erro perto do campo e explicar a correção. Em formulário longo, oferecer resumo de erros com acesso ao primeiro problema.
- Se a ação estiver desabilitada, mostrar o motivo e como continuar. Avaliar manter envio disponível para revelar validação quando isso for mais compreensível.
- Não solicitar localização, câmera, notificação ou contatos antes de a pessoa entender por que a função precisa disso. Oferecer alternativa manual quando existir.
- Exibir limites de arquivo, formatos aceitos e progresso de envio com base nos limites reais do sistema.
- Mostrar miniatura, nome do arquivo e opções de trocar/remover quando aplicável. Diferenciar selecionar arquivo de concluir seu envio.

Para datas e horários:

- Usar seletores integrados ao tema ou controles nativos adequados. Tornar a área principal acionável, sem depender de um pequeno ícone de calendário.
- Mostrar dia da semana, data e horário de forma inequívoca nos resumos. Quando usar “Hoje” ou “Amanhã”, oferecer a data correspondente.
- Usar o fuso definido pelo negócio para a agenda. Se houver diferença relevante entre unidade e usuário, identificar o fuso em linguagem compreensível.
- Não mostrar horário ocupado como disponível. Explicar bloqueios e permitir navegar para datas que tenham opções reais.
- Permitir entrada manual quando melhorar precisão, acessibilidade ou tarefas como informar data de nascimento.
- Não usar calendário mensal como única forma de percorrer décadas para escolher uma data antiga.

### Listas, tabelas e orientação visual

- Preservar a informação necessária à comparação. Em celular, usar cartões rotulados ou uma lista resumida quando equivalentes à tarefa.
- Não converter automaticamente toda tabela em cartões: comparações entre colunas podem exigir a estrutura original.
- Quando a tabela exigir rolagem horizontal, restringi-la à própria região, torná-la identificável e acessível e manter cabeçalhos compreensíveis. Evitar que a página inteira deslize lateralmente.
- Manter busca, filtros ativos e quantidade de resultados quando úteis. Oferecer “Limpar filtros” quando eles esconderem resultados.
- Distinguir zero de ausência de dado. Não preencher números desconhecidos com zero para deixar a tela completa.
- Em gráficos, mostrar título, período, unidade e alternativa textual adequada. Não depender só de cor para identificar séries.

Usar recursos visuais com uma função explícita:

| Recurso                    | Função útil                                                | Cuidado                                                       |
| -------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| Ícone com texto            | Ajudar a reconhecer uma ação.                              | Manter desenho e significado consistentes.                    |
| Foto ou miniatura          | Identificar profissional, serviço, documento ou item.      | Não depender da imagem para a única informação essencial.     |
| Exemplo preenchido         | Mostrar um formato ou resultado esperado.                  | Diferenciar exemplo de dado real.                             |
| Prévia                     | Antecipar efeito de uma configuração visual ou publicação. | Não prometer fidelidade que a prévia não oferece.             |
| Resumo visual              | Ajudar a conferir dados antes de confirmar.                | Conservar todas as condições relevantes em texto.             |
| Ilustração de estado vazio | Explicar o que existe naquela área.                        | Manter título, orientação e ação; evitar decoração dominante. |
| Indicador de etapas        | Mostrar posição em uma sequência real.                     | Garantir leitura e estado atual para tecnologia assistiva.    |

Não usar emojis como único identificador de ação, ilustrações que sugiram opções inexistentes ou animações que disputem atenção com a tarefa.

### Janelas, teclado e rolagem

- Preferir uma região principal de rolagem por tela. Em celular, favorecer rolagem natural e evitar painéis pequenos com rolagens concorrentes.
- No aplicativo com rolagem interna já estabelecida, manter a região principal na extremidade direita da janela, sem introduzir uma segunda barra equivalente.
- Usar rolagem interna em uma janela somente quando o conteúdo exigir; garantir que todo o conteúdo e suas ações sejam alcançáveis.
- Respeitar áreas ocupadas por recortes, barras do navegador e teclado virtual. Botões fixos precisam de espaço reservado no conteúdo e não podem cobrir campos ou foco.
- Permitir que o campo ativo e seu erro sejam vistos com o teclado aberto. Evitar saltos de página e alturas fixas que cortem conteúdo.
- Usar modal para decisões curtas e contextualizadas. Para tarefas extensas, considerar página própria ou painel apropriado ao celular.
- Nomear a janela, oferecer saída visível e gerenciar foco: movê-lo para dentro ao abrir, mantê-lo na janela modal enquanto aberta e devolvê-lo ao acionador ao fechar.
- Permitir fechamento por teclado quando apropriado, sem descartar trabalho relevante silenciosamente. Não depender só de tocar fora, deslizar ou descobrir um gesto.
- Evitar janelas sobrepostas. Se a tarefa crescer, reorganizar o fluxo.
- Não esconder barras de rolagem a ponto de impedir descoberta ou operação. Respeitar as preferências de exibição do sistema e indicadores necessários.

### Desempenho e movimento

- Dar retorno imediato ao toque, mesmo quando a operação remota demorar. Usar verbo específico: “Salvando…”, “Buscando horários…”.
- Evitar indicadores indefinidos sem recuperação. Depois de demora relevante, explicar a situação e oferecer saída ou verificação compatível com a operação.
- Não exibir percentual fictício. Usar progresso numérico somente com medida real.
- Reservar dimensões de imagens e espaços de conteúdo para reduzir deslocamentos durante carregamento.
- Otimizar imagens e carregar recursos secundários conforme necessário. Considerar aparelhos modestos e conexão instável na implementação.
- Usar movimento curto e discreto para comunicar relação ou estado; respeitar preferência por movimento reduzido e evitar piscadas.
- Não exigir PWA, instalação, biblioteca nova, animações complexas ou infraestrutura adicional apenas por aplicar esta skill.

## 4. Linguagem, orientação e acessibilidade

### Mostrar em vez de explicar (diretriz do dono, 05/10/2026)

O sistema deve ser visual, intuitivo e autoexplicativo. Mesmo no primeiro acesso, uma pessoa sem conhecimento técnico precisa entender onde está, o que está acontecendo, o que fazer e qual é o próximo passo. Princípio: **se for preciso explicar demais como usar uma funcionalidade, a experiência ainda precisa melhorar.**

- **Visual primeiro:** quando um ícone, cartão, indicador, cor, gráfico, selo de status ou exemplo ilustrado comunica mais rápido que uma frase, usar o elemento visual. Parágrafo explicativo é último recurso.
- **Hierarquia clara:** o mais importante, o que exige atenção e a próxima ação aparecem primeiro e com mais peso visual.
- **Informações relacionadas juntas:** dados do mesmo contexto ficam próximos ou ligados visualmente; evitar que a pessoa navegue por várias telas para entender uma situação.
- **Linguagem simples:** sem termos técnicos na jornada comum; detalhe técnico só quando indispensável.
- **Ações evidentes:** o rótulo do botão diz o que vai acontecer.
- **Feedback visual:** sucesso, erro, alerta, pendência, processamento e conclusão têm ícone e cor próprios, não só texto.
- **Escolhas à vista:** poucas opções (até ~6) aparecem como botões/pílulas selecionáveis, não escondidas em lista suspensa; cada opção mostra o efeito com um exemplo (ex.: os horários que o cliente verá).
- **Exemplos no lugar de regras:** em vez de descrever a regra ("testa um horário a cada 15 minutos…"), mostrar o resultado (pílulas 9:00 · 9:15 · 9:30, mini agenda com "já marcado", "folga" e "pode começar").

Referência implementada: Ajustes → Agendamento → "Como os horários aparecem" (`SlotModeSettings.tsx`) e o resumo "Assim seus clientes veem os horários" em Serviços e Horários. Os dois já são montados só com os componentes comuns abaixo: use-os como modelo.

### Componentes visuais comuns

Um só jeito de mostrar estado, resultado, escolha, número, etapa e vazio em todo o sistema (pregnância: o mesmo significado tem sempre a mesma forma, cor e ícone). Tudo sai de um lugar:

```tsx
import { StatusBadge, Notice, ActionResult, ChoiceChips /* … */ } from "@/components/visual";
```

Regras de uso:

- **Não recriar localmente** selo, aviso, resultado de salvamento, escolha em pílulas, cartão de número, etapas, vazio ou carregando. Se faltar uma variação, ampliar o componente comum e conferir os usos.
- **Textos**: os componentes recebem os textos prontos (`t("…")`); os textos próprios deles (Tentar de novo, Copiado, Não salvo…) vivem nas chaves `visual.*` dos dicionários.
- **Cores**: nunca escrever cor de estado à mão (`bg-emerald-50`, `text-amber-900`…). Os tons vêm das variáveis `--tone-*` de `src/styles.css` (bloco "Tons de estado"), que já resolvem tema claro, escuro e cartão off-white com contraste AA.
- **Cantos**: os componentes usam `rounded-xl`/`rounded-2xl` e `var(--button-radius)`, então seguem Retos, Semi e Arredondados sozinhos. Círculos ficam só onde são forma funcional (avatar, marcador de etapa, bolha de contagem, anel de prazo).
- **Toque e teclado**: tudo que é clicável tem 44 px ou mais; escolhas usam papéis de rádio/caixa (setas trocam a opção); foco visível em dourado.
  - Exceção aceita: o calendário do `DatePicker` (`src/components/ui/schedule-picker.tsx`) abaixo de 360 px. Sete colunas de 44 px não cabem com a margem de 16 px, então os dias ficam com cerca de 40 px de largura a 320 px (altura de 44 px mantida, acima dos 24 px do WCAG 2.5.8), sem cortar o sábado nem a seta.
- Componentes de domínio (selo de nível do clube, selo de papel, faixa de dias, ticket da reserva, campo de código, barra do dia) ficam na área dona, montados sobre estes. Exemplo: um `RoleBadge` é um `StatusBadge` com o ícone e o rótulo do papel.

**Tons de estado** (`Tone`): mesmo significado = mesma cor e mesmo ícone.

| Tom         | Significa                             | Ícone                  | Exemplos                                  |
| ----------- | ------------------------------------- | ---------------------- | ----------------------------------------- |
| `success`   | Deu certo, concluído, livre, ligado   | ✓ CheckCircle2         | Concluído, Salvo, Conectado, Aberta agora |
| `info`      | Confirmado, agendado, informação      | ⓘ Info / CalendarCheck | Confirmado, Aviso agendado                |
| `warning`   | Precisa de uma ação da pessoa         | ⚠ AlertTriangle        | Remarcação pedida, Sem desfecho           |
| `pending`   | Aguardando alguém                     | ⏳ Hourglass           | A confirmar, Aguardando aprovação         |
| `danger`    | Erro, cancelado, recusado, bloqueado  | ✕ XCircle              | Cancelado, Não salvou, Bloqueado          |
| `neutral`   | Desligado, pausado, fechado, sem dado | ⊖ CircleMinus          | Pausado, Fechado, Vencido                 |
| `progress`  | Em andamento                          | ◌ Loader2 (gira)       | Salvando…, Conectando…                    |
| `highlight` | Destaque da marca                     | ✦ Sparkles             | Padrão, Fundador, Repete                  |

Estados prontos: `APPOINTMENT_STATUS` (situação do atendimento: a confirmar ⏳, confirmado azul, concluído verde, remarcação pedida laranja, cancelado vermelho), `APPOINTMENT_DERIVED` (não veio, em espera, sem desfecho) e `STATE` (ativo, pausado, fechado, vencido, aguardando, atenção, agendado, em andamento, bloqueado, falhou, destaque) — use `<StatusBadge {...STATE.paused} label={t("…")} />`.

**Estado e retorno**

- `StatusBadge` — selo com ícone, cor e texto curto (variantes `pill`, `dot` para legendas e listas densas, `icon` para linha do tempo; tamanhos `sm`/`md`/`lg`; `count`; `live`). Ex.: `<StatusBadge tone="pending" label="A confirmar" />`. `AppointmentStatusBadge status={row.status}` já traz o rótulo do dicionário.
- `Tag` — pílula de dado, não de estado (duração, preço, folga). Ex.: `<Tag icon={Clock3}>30 min</Tag>`.
- `CountBadge` — bolha de pendências em abas, menus e cartões; some no zero. Ex.: `<CountBadge count={2} label="2 resgates esperando" />`.
- `Notice` — aviso curto com ícone e cor junto do que o gerou (campo, linha, cartão), com uma ação opcional. Nunca no topo da página. Ex.: `<Notice tone="warning" title="2 horários sem desfecho" action={{ label: "Resolver", onClick }} />`.
- `ActionResult` — resultado de quem grava algo, logo abaixo do botão: `saving` (gira), `saved` (verde), `pending` (aguardando aprovação), `error` (vermelho, com "Tentar de novo"). Anuncia ao leitor de tela e rola até ele se estiver fora da vista. Ex.: `<ActionResult state={status} onRetry={salvar} autoHideMs={4000} />`.
- `InlineStatus` — o mesmo, em linha, para quem grava na hora (interruptor): "Salvando…" → "✓ Salvo" → "Não salvou · Tentar de novo".
- Avisos rápidos (`toast.success/error/warning/info` do sonner) já saem com ícone e faixa na cor do tipo; use-os só quando o botão saiu da tela ou a pessoa mudou de página.
- `AttentionList` — "Precisa da sua atenção": itens ordenados por urgência, uma frase e **um** botão com verbo cada; some quando não há nada (ou mostra "Tudo em ordem" com `allClear`). `secondaryAction` opcional põe uma saída discreta ao lado do botão (ex.: "Cancelar reserva" na remarcação pedida, "Desistir" da vaga liberada); sem espaço, ela desce para baixo do principal. As duas ações aceitam `disabled`.
- `Countdown` — prazo correndo ("Restam 9 min", pílula ou anel), âmbar e vermelho no fim; nunca só "mm:ss".

**Estrutura e números**

- `SectionHeader` — cabeçalho de cartão/seção: ícone em quadrado + título + uma linha, com selo ou ação à direita. `IconTile` é o quadrado sozinho. Ex.: `<SectionHeader icon={CalendarClock} title={t("…")} description={t("…")} aside={<StatusBadge …/>} />`.
- `StatTile` — cartão de número: ícone, valor grande, rótulo, dica, tom e variação; sem dado mostra "—" com o motivo (nunca 0 inventado); `loading` mostra esqueleto; com `onClick`/`pressed` vira filtro.
- `SegmentBar` — barra dividida nas cores dos estados com legenda em selos e frase equivalente ("3 de 10 concluídos"); serve também para "3 de 5" e comparação (duas barras com o mesmo `total`).
- `DetailList` — resumo "rótulo → valor" (item numa janela, conferência), com antes riscado → agora e a diferença em pílula.
- `SettingRow` — linha de ajuste ou atalho: ícone, título, resumo e, à direita, interruptor/selo ou seta; a linha inteira é tocável.
- `PersonAvatar` — foto ou iniciais numa cor fixa por pessoa (`personColor` serve também para a faixa lateral de cartões).

**Escolhas, etapas e exemplos**

- `ChoiceChips` — até ~6 opções à vista em pílulas de 44 px (escolha única = rádio; `multiple` = caixas), com nota ("Padrão"), ícone, foto, contagem, `scroll` para muitas opções e `other` ("Outro…" abre um campo numérico). Ex.: `<ChoiceChips icon={Clock3} label="De quanto em quanto tempo" options={…} value={step} onChange={setStep} />`.
- `ChoiceCards` — cartões de escolha única com ícone, efeito em uma linha, exemplo dentro e ✓ à direita; `value={null}` para não pré-marcar escolha destrutiva.
- `Steps` — etapas ligadas por linha (feita ✓, atual, a fazer, com problema), horizontal ou vertical. `compact` mostra "Etapa 2 de 4 · Nome". `variant="static"` é o "como funciona" sem progresso (páginas públicas, regras, instruções): todos os passos na mesma tinta, com ícone ou número, sem ✓, sem etapa atual e sem o cinza de "a fazer" (que parece desativado); ali o `status` é dispensável. Não usar etapas "a fazer" cinzas para explicar um passo a passo.
- `DatePicker` (`@/components/ui/schedule-picker`) — calendário de um dia. Opcionais: `closedDays` + `closedLabel` (dias fechados com número apagado e lua, como a faixa da semana), `todayLabel` + `todayKey` (hoje em anel dourado, diferente do dia escolhido, que é preenchido; `todayKey` no fuso da loja) e legenda automática. Sem essas opções, fica como antes. Em uso na Agenda e no Agendar do cliente.
- `Timeline` — mini agenda ilustrada (já marcado, folga, livre, não cabe, bloqueado, fechado, aguardando), com altura pela duração. Mesmo código visual em Ajustes, Horários e Agenda.
- `PreviewPanel` + `TimeChips` — moldura "Como fica na prática"/"Assim o cliente vê" (com etiqueta "Exemplo" ou "Prévia") e horários em pílulas.
- `IconList` / `Hint` — frases curtas com ícone no lugar de parágrafos: dicas (ícone dourado) e consequências (✓ verde, ✕ vermelho, ⚠ laranja).
- `MoreDetails` — "Como funciona" recolhido, aberto por toque ou teclado, para a regra ou o detalhe técnico.

**Ações, campos, vazio e carregando**

- `ConfirmDialog` — decisão com o item afetado (`summary`), as consequências com ícone e dois botões com verbo + objeto ("Manter horário" / "Cancelar horário"); gira enquanto confirma e mostra o erro dentro da janela. Substitui `window.confirm`. O erro é lido na hora de mostrar: `errorText` (o resultado, "Nada foi apagado") e `errorDetail` (o motivo devolvido pela ação, guardado num estado antes de rejeitar) aparecem juntos num só aviso já na 1ª falha.
- `MoreActions` — botão "⋯" com as ações secundárias: folha inferior no celular, menu no computador; destrutivas no fim, separadas.
- `UnsavedBar` — barra fixa no pé do cartão quando há mudança não salva ("● 2 mudanças não salvas · Descartar · Salvar mudanças"), com o resultado embutido.
- `Field` + `FieldMessage` — rótulo visível, dica e erro junto do campo (borda vermelha pelo `aria-invalid`); `focusFirstInvalid(form)` leva ao primeiro erro ao enviar.
- `CopyField` — link, senha temporária ou código: valor legível (sem "https://"), "Copiar" vira "✓ Copiado", "Enviar" abre o compartilhamento do celular. Endereços longos quebram só depois de "/", ".", "-" etc. (nunca "carla-o / liveira"); não é preciso montar `display` com espaços invisíveis. `share={false}` esconde "Enviar" em valores técnicos que só se copiam (registros de DNS do domínio próprio).
- `EmptyState` — vazio sempre com título curto, uma linha e a próxima ação; ilustrações `calendar`, `scissors`, `bell`, `waiting`, `people`, `search`, `store`, `chart`, `connection`, `gift`; `status` troca a ilustração pelo ícone do estado ("Tudo em dia", "Não deu para carregar"); `variant="plain"` dentro de cartão.
- `LoadingState` — esqueleto no formato do conteúdo (`cards`, `list`, `stats`, `lines`) com o verbo visível ("Buscando horários…"); se demorar, avisa e oferece "Tentar de novo". Substitui frases soltas "Carregando…".

### Escrita para usuários finais

Escrever em português brasileiro, salvo outro idioma definido no produto. Usar palavras familiares, frases curtas, voz ativa e uma ideia principal por mensagem. Manter tratamento respeitoso, sem infantilizar, repreender ou pressupor conhecimento de tecnologia.

- Nomear ações pelo que a pessoa quer fazer: “Escolher horário”, “Salvar alterações”, “Ver meus agendamentos”.
- Evitar rótulos genéricos como “Executar”, “Processar”, “Submit” e “OK” quando o resultado puder ser nomeado.
- Usar o mesmo termo para o mesmo conceito em todo o fluxo. Não alternar “cliente”, “usuário” e “contato” sem uma diferença real de significado.
- Evitar siglas, nomes de tabelas, códigos de erro, termos de programação e detalhes de infraestrutura nas telas comuns.
- Em configurações técnicas realmente destinadas a administradores, usar o termo necessário com explicação curta. Separar essa área da jornada do usuário final.
- Explicar consequências antes da ação: cobrança, cancelamento, perda de alterações, indisponibilidade ou envio a outra pessoa.
- Não usar culpa: preferir “Confira o número informado” a “Você digitou errado”.
- Não prometer mensagem enviada, valor devolvido ou dado preservado sem evidência do sistema.
- Usar datas, horários, moeda e números no formato do público. No contexto brasileiro, preferir data dia/mês/ano, horário de 24 horas e valores como “R$ 50,00”, respeitando o produto.
- Evitar duplas negativas e interruptores como “Não desativar avisos”. Usar “Receber lembretes” com estado claro.

As regras técnicas deste documento orientam quem desenvolve. Traduzir seus efeitos para linguagem simples na interface; não levar termos como idempotência, token, API, cache ou breakpoint para a jornada comum.

### Exemplos de mensagens

Adaptar os textos à ação e ao estado reais; não copiar uma mensagem que prometa capacidade inexistente.

| Evitar                                        | Preferir                                                                        | Condição                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| “Submit”                                      | “Confirmar agendamento”                                                         | A ação realmente confirma, sem aprovação pendente.     |
| “Confirmado!” após enviar pedido              | “Solicitação enviada. Aguarde a confirmação da barbearia.”                      | O fluxo depende de aprovação.                          |
| “Campo inválido”                              | “Informe seu celular com DDD.”                                                  | O problema é o formato do telefone.                    |
| “Erro 500”                                    | “Não foi possível carregar os horários. Tente novamente.”                       | Falha de consulta, sem operação com resultado incerto. |
| “Sem dados”                                   | “Você ainda não tem agendamentos.” + “Escolher um horário”                      | Histórico realmente vazio.                             |
| “Nenhum registro” após filtro                 | “Nenhum agendamento encontrado com esses filtros.” + “Limpar filtros”           | Há uma busca ou filtragem ativa.                       |
| “Sessão expirada”                             | “Entre novamente para continuar.”                                               | O acesso precisa ser renovado.                         |
| “Sincronização concluída”                     | “Suas alterações foram salvas.”                                                 | A persistência foi confirmada.                         |
| “Deseja prosseguir?”                          | “Cancelar este agendamento?”                                                    | Mostrar serviço, data, horário e consequência real.    |
| “Sim” / “Não”                                 | “Cancelar agendamento” / “Manter agendamento”                                   | Decisão sobre uma reserva existente.                   |
| “Falha, tente novamente” após demora no envio | “Ainda não conseguimos confirmar o resultado. Vamos verificar seu agendamento.” | O sistema efetivamente consultará o resultado.         |
| “Acesso negado”                               | “Você não tem acesso a esta área.”                                              | Não revelar dados da área restrita.                    |

Para erros, informar **o que aconteceu + o que foi preservado, se comprovado + como continuar**. Para sucesso, informar **resultado + resumo necessário + próxima ação útil**. Evitar repetir a mesma mensagem em vários lugares.

### Ajuda no contexto da tarefa

- Colocar instrução curta perto da decisão. Exemplo: “Escolha um profissional ou veja os horários disponíveis com toda a equipe”, somente se ambas as opções existirem.
- Dar exemplo em informações abstratas, prazos e regras de pontos. Identificar exemplos como ilustrativos e calcular com as regras reais quando apresentados no produto.
- Explicar opções parecidas pela diferença que importa para a pessoa. Não depender apenas de nomes comerciais.
- Usar “Como funciona” ou uma explicação expandida para detalhes secundários. Deixar preço, condição de cancelamento e consequência da ação visíveis antes do compromisso.
- Oferecer instruções que funcionem por toque e teclado. Uma dica mostrada somente ao passar o mouse não é ajuda suficiente no celular.
- Evitar tours obrigatórios, várias telas de apresentação e avisos repetidos para ensinar uma interface que pode ser mais clara.
- Se houver apresentação inicial útil, permitir pular e reabrir; ensinar no momento de uso.
- Manter ajuda e suporte em localização previsível quando existirem, sem inventar atendimento disponível, canal ou prazo.
- Usar “Este campo…” ou o nome do campo; não depender exclusivamente de instruções como “clique no botão verde à direita”.

### Acessibilidade funcional

- Usar elementos semânticos adequados: botão para ação, link para navegação, rótulo associado ao campo, cabeçalhos em ordem e grupos de opções identificados.
- Manter operação por teclado com ordem previsível, foco visível e nenhuma prisão de foco fora de uma janela modal ativa.
- Fazer o nome acessível conter o texto visível da ação para funcionar também com controle por voz.
- Informar estado selecionado, expandido, obrigatório, inválido e ocupado por meios programáticos apropriados; não apenas por desenho.
- Anunciar mudanças relevantes e erros para leitores de tela, usando recursos existentes com moderação. Não transformar toda atualização em interrupção.
- Usar texto alternativo que descreva a função ou informação de uma imagem. Tratar imagens decorativas como decorativas, sem leitura redundante.
- Manter conteúdo essencial como texto real, sem colocá-lo exclusivamente dentro de uma imagem.
- Não depender só de cor para erro, seleção, disponibilidade, pontos ou conclusão; combinar texto, forma, ícone ou marcação clara.
- Permitir ampliação de texto e zoom. Não bloquear orientação sem necessidade essencial comprovada.
- Respeitar movimento reduzido e evitar conteúdo piscando. Se existir mídia com informação necessária, disponibilizar alternativa adequada, como legenda ou transcrição.
- Permitir preenchimento automático, colagem de senha e colagem de códigos de acesso. Não criar desafios de memória como única forma de autenticação.
- Usar botão “Mostrar senha” quando apropriado, com estado acessível. Não reduzir autenticação ou proteção de dados para facilitar o acesso.
- Evitar encerramento inesperado de tarefa por tempo; informar e oferecer extensão quando compatível com a segurança e a regra do sistema.

### Medidas e referências

Adotar WCAG 2.2 nível AA como referência de verificação para os critérios aplicáveis. As medidas abaixo são um recorte, não uma auditoria completa nem declaração de conformidade.

| Aspecto                                   | Diretriz                                                                                                                                                                            | Natureza                                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Área acionável no celular                 | Adotar 44 × 44 pixels CSS ou mais como meta de produto; preferir 48 × 48 quando houver espaço. Garantir separação entre ações e avaliar a área efetivamente clicável.               | Meta de conforto desta skill, não o mínimo AA.                                           |
| Alvo mínimo WCAG 2.2                      | Verificar 24 × 24 pixels CSS ou as exceções de espaçamento, equivalência, texto em linha, controle do navegador e essencialidade previstas no critério 2.5.8.                       | Critério AA, com exceções específicas. [1]                                               |
| Texto comum                               | Contraste de pelo menos 4,5:1.                                                                                                                                                      | Critério 1.4.3; considerar suas exceções. [2]                                            |
| Texto grande                              | Contraste de pelo menos 3:1; grande significa pelo menos 18 pt regular ou 14 pt em negrito, aproximadamente 24 e 18,67 pixels CSS.                                                  | Critério 1.4.3. [2]                                                                      |
| Elementos visuais de controles e gráficos | Verificar contraste de pelo menos 3:1 com cores adjacentes nas partes necessárias para identificar e compreender o componente ou informação.                                        | Critério 1.4.11; não significa que toda borda decorativa precise do mesmo contraste. [3] |
| Texto de leitura e campos                 | Partir de 16 pixels CSS ou equivalente escalável e entrelinha confortável; usar texto auxiliar menor apenas se continuar legível.                                                   | Referência de projeto, não requisito numérico universal da WCAG.                         |
| Ampliação                                 | Verificar ampliação de texto a 200% sem perda de informação ou função, conforme o critério aplicável.                                                                               | Critério 1.4.4. [4]                                                                      |
| Reorganização de conteúdo                 | Em conteúdo de rolagem vertical, verificar largura equivalente a 320 pixels CSS sem perda de informação ou função e sem rolagem em duas dimensões, ressalvadas exceções essenciais. | Critério 1.4.10; tabelas e outros conteúdos podem exigir avaliação específica. [5]       |
| Autenticação                              | Permitir mecanismos que reduzam esforço de memória/transcrição, como gerenciadores de senha, preenchimento automático e colagem.                                                    | Critério 3.3.8, conforme condições e exceções. [6]                                       |

Medir contraste nos estados reais, inclusive conteúdo sobre gradientes; não inferir acessibilidade apenas pelo nome da cor. O teste automatizado ajuda a localizar problemas, mas não substitui inspeção de teclado, foco, leitura e compreensão.

Fontes oficiais consultadas em 26/09/2026:

1. [W3C — Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
2. [W3C — Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
3. [W3C — Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
4. [W3C — Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html).
5. [W3C — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
6. [W3C — Accessible Authentication (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html).

## 5. Perfil visual do Barba & Cabelo

Aplicar este perfil às telas do Barba & Cabelo. Preservar as decisões dos anexos originais e integrar as diretrizes gerais de lógica, celular e acessibilidade. Não aplicar este visual automaticamente a outro sistema.

### Identidade e tipografia

- Manter uma experiência moderna de aplicativo de barbearia, com identidade masculina e madura, navegação simples e hierarquia clara.
- Usar Inter em textos, campos, controles e botões do sistema.
- Permitir a fonte de marca escolhida ou enviada pela barbearia somente no nome do cabeçalho e, quando configurado, em títulos de seções e nomes de serviços.
- Não aplicar fonte decorativa à interface inteira nem usá-la em instruções, preços, formulários e controles que dependem de leitura rápida.
- Preservar hierarquia de tamanhos, pesos, espaçamento, cores, sombras e estados entre páginas. Reutilizar os tokens existentes.
- Não transformar “moderno” em excesso de efeitos, baixa legibilidade, textos pequenos, elementos sem rótulo ou aparência infantil.

### Modos de canto

| Opção visível     | Comportamento                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Retos             | Aplicar a família de raios do modo reto.                                                     |
| Semi arredondados | Aplicar a família de raios suaves; usar como padrão efetivo quando ainda não houver escolha. |
| Arredondados      | Aplicar a família de raios arredondados.                                                     |

- Tratar `soft`/semi arredondado como valor efetivo quando a preferência estiver ausente; evitar uma primeira renderização em outro modo seguida de troca perceptível.
- Persistir a escolha explícita no mecanismo e no escopo previstos no projeto. Não tratar uma preferência não salva como concluída.
- Aplicar o modo a botões, campos, cartões, janelas, cabeçalhos, rodapés, menus, seletores, avisos e estados equivalentes.
- Usar uma família coerente de raios por modo; componentes de tamanhos diferentes não precisam do mesmo número absoluto.
- Evitar valores isolados que misturem os três modos. Inspecionar também componentes de bibliotecas externas e sobreposições.
- Preservar formas com função própria, como avatar circular ou indicador de progresso, quando fizerem parte do padrão aprovado. Documentar exceções funcionais, sem usá-las para justificar inconsistências.
- Conferir todos os três modos ao criar ou modificar um componente compartilhado. Não assumir que testar o padrão valida os outros.

### Superfícies, cores e ações

- Preservar os gradientes dos níveis e pontos. Manter cartões e superfícies de leitura em branco/off-white, separados do fundo da página, conforme a direção original.
- Em temas adicionais já existentes e aprovados, preservar as equivalências de superfície e contraste. Não introduzir um novo tema como efeito colateral de uma mudança local.
- Usar cor para apoiar estado e ação, sempre com texto, ícone ou outro marcador compreensível.
- Evitar tons rosados em campos e filtros.
- Preservar botões de ação com fundo escuro e ícone/texto na cor da ação: confirmar em azul, concluir em verde e cancelar/excluir na cor de alerta.
- Diferenciar encerramento de uma tarefa e cancelamento de um registro: “Voltar” e “Fechar” não devem executar “Cancelar agendamento”.
- Ajustar o tom da cor quando necessário para contraste, preservando a intenção visual. Não manter combinação ilegível por fidelidade literal a uma tonalidade.
- Padronizar dimensão, área acionável, alinhamento e estados dos botões. Separar ação destrutiva da principal e esclarecer sua consequência.
- Destacar a navegação ativa sem usar a linha inferior rejeitada. Usar o padrão aprovado de fundo, preenchimento, contraste ou peso, com indicação acessível de página atual.
- Não criar uma cor nova para cada tela ou usar gradientes de pontos como fundo de textos longos.

### Interação, ilustração e continuidade

- Usar seleções visuais, liga/desliga, incrementos e controles de faixa somente nas situações adequadas da matriz de componentes.
- Integrar seletores de data e horário ao tema, preservando uma área confortável de abertura, navegação por teclado e disponibilidade compreensível.
- Oferecer alternativa ao arrastar e soltar por toque, clique e teclado; manter entrada manual quando melhorar precisão ou acesso.
- Usar fotos de profissionais, imagens de serviços e prévias de personalização quando ajudarem a decidir e houver material apropriado. Manter identificação textual.
- Explicar regras de pontos e níveis com linguagem simples e exemplos baseados na regra real. Não sugerir benefício, desconto ou resgate ainda não implementado.
- Manter rolagem interna do aplicativo quando esse for o padrão existente, com a região principal à direita e barras discretas que continuem detectáveis e operáveis.
- No celular, adaptar altura e regiões de rolagem para evitar conteúdo preso, campos escondidos pelo teclado e várias áreas pequenas que disputam o gesto.
- Preservar dados visíveis durante atualização quando seguro, com estado claro e revalidação de disponibilidade antes de confirmar.
- Conferir mesma tarefa entre celular e computador, incluindo rótulos, foco, toque, erros, persistência de preferências e desfazer quando houver reversão real.

Evoluir este perfil com decisões aprovadas do projeto. Registrar proposta futura como proposta; não afirmar que ela já está implementada.

## 6. Validação e cenários de uso

### Critérios de aceite

Aplicar somente os itens pertinentes ao escopo. Registrar “não se aplica” com motivo quando necessário, sem transformar todo ajuste pequeno em auditoria integral.

#### Compreensão e tarefa

- [ ] O título deixa claro o objetivo da tela.
- [ ] A ação principal pode ser reconhecida sem explicação externa.
- [ ] O rótulo informa o que acontecerá; preço, prazo e consequência relevantes aparecem antes da confirmação.
- [ ] A ordem das informações acompanha a decisão da pessoa.
- [ ] Campos opcionais e obrigatórios são reconhecíveis; não há repetição evitável de dados.
- [ ] A pessoa pode voltar, corrigir escolhas e continuar sem reiniciar desnecessariamente.
- [ ] A conclusão informa o resultado real e o próximo passo útil.

#### Uso em diferentes dispositivos

- [ ] Texto e ações essenciais cabem em tela estreita sem corte ou sobreposição.
- [ ] Áreas de toque são confortáveis e ações próximas não provocam enganos frequentes.
- [ ] O teclado virtual não esconde campo, erro ou ação necessária.
- [ ] Ações fixas respeitam as áreas do aparelho e deixam espaço no conteúdo.
- [ ] Rolagem principal, tabelas e janelas funcionam sem prender o conteúdo.
- [ ] A experiência de computador aproveita o espaço sem alterar o significado das ações.

#### Estados e integridade

- [ ] Carregando, primeiro uso, busca vazia, indisponibilidade, falha e sucesso têm mensagens distintas.
- [ ] A falha mantém as informações já preenchidas quando seguro.
- [ ] Resultado incerto leva à verificação antes de nova operação equivalente.
- [ ] Há proteção adequada contra duplicação e concorrência nas operações afetadas.
- [ ] Mudança de opção anterior revalida dependências e explica o que precisa ser revisto.
- [ ] Permissões e validações continuam aplicadas nas camadas apropriadas.
- [ ] “Desfazer”, salvamento automático e suporte offline só aparecem quando funcionam de fato.

#### Acessibilidade e identidade

- [ ] Campos têm rótulos associados, opções têm estado e ações têm nome acessível.
- [ ] Teclado percorre o fluxo em ordem lógica, com foco visível e retorno correto de janelas.
- [ ] Erros e mudanças relevantes são compreensíveis também com leitor de tela quando verificado.
- [ ] Cor, ícone, imagem e gesto não são a única forma de obter informação ou concluir a tarefa.
- [ ] Contraste, ampliação, reorganização e movimento foram verificados conforme a alteração.
- [ ] Componentes, termos e estilos mantêm consistência com o produto.
- [ ] No Barba & Cabelo, Inter, superfícies, gradientes, cores de ação e os três modos de canto foram respeitados.

Marcar como verificado apenas o que foi efetivamente examinado. Uma análise de texto não equivale a teste no navegador, leitor de tela ou aparelho físico.

### Matriz de dispositivos e estados

Usar amostragem proporcional ao risco. As larguras são referências de verificação, não pontos de quebra obrigatórios.

| Situação                                | Conferir                                                                                |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| Largura equivalente a 320 pixels CSS    | Reorganização do conteúdo, leitura e ação principal; exceções justificadas.             |
| Celular de 360–390 pixels CSS           | Tarefa completa por toque, campos longos e teclado aberto.                              |
| Tablet ou largura intermediária         | Transição de colunas, painéis e orientação.                                             |
| Computador, por exemplo 1280 pixels CSS | Hierarquia, comprimento de linhas e navegação por teclado.                              |
| Texto ampliado a 200%                   | Informação e função preservadas, inclusive em controles e janelas.                      |
| Conexão lenta ou falha simulada         | Retorno imediato, contexto preservado e recuperação sem duplicação.                     |
| Conteúdo realista                       | Nomes longos, listas grandes, poucos resultados, ausência de imagem e valores variados. |
| Temas e preferências existentes         | Contraste e persistência; no Barba & Cabelo, os três modos de canto.                    |

Quando disponíveis, conferir navegadores e dispositivos relevantes ao público; emulação não substitui todos os comportamentos de teclado, rolagem e tecnologias assistivas de aparelhos reais. Declarar a limitação sem afirmar validação universal.

### Cenário 1 — Agendamento compreensível

Considerar o fluxo abaixo ilustrativo e adaptá-lo ao modelo real, sem criar serviços, preços ou permissões.

1. **Escolher:** mostrar serviço com descrição curta, duração e preço quando definidos.
2. **Combinar:** apresentar profissional/unidade conforme a disponibilidade e as dependências do produto.
3. **Agendar:** mostrar dia e horários disponíveis em controles confortáveis, com alternativa acessível.
4. **Conferir:** mostrar serviço, profissional, unidade, data, horário, valor e condições aplicáveis; oferecer “Alterar” junto de cada informação editável.
5. **Confirmar:** usar ação explícita e impedir reenvio da mesma operação enquanto pendente.
6. **Concluir:** mostrar “Agendamento confirmado” apenas após confirmação real, com resumo e acesso ao agendamento. Se houver aprovação, mostrar o estado de solicitação.

Examinar desvios:

- Sem horários: explicar e oferecer outra data ou alternativa que exista.
- Troca de serviço: atualizar duração, preço e disponibilidade; preservar escolhas válidas.
- Horário tomado por outra pessoa: explicar o conflito e oferecer horários reais atualizados.
- Conexão interrompida após envio: consultar o resultado antes de permitir uma nova reserva equivalente.
- Sessão expirada: permitir entrar novamente e retomar com segurança quando suportado.

### Cenário 2 — Configuração sem ambiguidades

**Tarefa:** escolher o modo de canto do Barba & Cabelo.

- Mostrar três opções de escolha única: “Retos”, “Semi arredondados” e “Arredondados”.
- Exibir uma pequena prévia de botão, campo e cartão em cada opção, com identificação textual do estado selecionado.
- Usar semi arredondado quando não houver preferência.
- Se a aplicação for imediata, indicar a gravação e restaurar o estado anterior em falha. Se depender de salvar, manter prévia e estado pendente até “Salvar aparência”. Respeitar o modelo existente.
- Não usar três interruptores independentes para uma escolha mutuamente exclusiva.
- Aplicar a preferência a componentes compartilhados, janelas e estados, sem alterar a fonte ou cores como efeito colateral.

### Cenário 3 — Cancelamento seguro e simples

**Tarefa:** cancelar um agendamento existente.

- Abrir uma confirmação curta com serviço, data e horário.
- Informar a condição real de cancelamento e eventual consequência financeira, se houver. Não inventar taxa ou direito de reembolso.
- Usar “Cancelar agendamento” e “Manter agendamento” como ações claramente diferentes.
- Manter estado de cancelamento em andamento até o resultado ser conhecido.
- Confirmar cancelamento apenas após a operação ser concluída. Diferenciar cancelamento da reserva e processamento de eventual devolução.
- Oferecer “Desfazer” somente se a reversão preservar de fato as condições necessárias. Caso contrário, um novo agendamento é outra operação.

### Cenário 4 — Formulário em celular com erro

**Tarefa:** atualizar telefone e nome em uma tela de perfil.

- Usar rótulos visíveis, teclado de telefone no campo apropriado e nome com capitalização tolerante.
- Permitir colar e preencher automaticamente. Aceitar formatação razoável de telefone e apresentar padrão familiar.
- Ao detectar erro, manter nome e demais campos, indicar o problema junto do telefone e orientar a correção.
- Com teclado aberto, manter o campo com erro visível e o caminho até “Salvar alterações” alcançável.
- Se salvar falhar, informar a falha e manter alterações pendentes; não exibir mensagem de sucesso.
- Ao sair com mudanças relevantes, permitir salvar, continuar editando ou descartar conscientemente, conforme o padrão existente.

### Revisão de todo o sistema

Quando o pedido abranger o produto inteiro, inventariar as jornadas existentes antes de aplicar alterações. Incluir acesso e recuperação, início, navegação, busca, cadastros, tarefa principal, histórico, detalhes, edição, cancelamento, configurações, ajuda e estados vazios — apenas os módulos reais.

| Prioridade              | Critério                                                                                  | Tratamento                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Bloqueio ou integridade | Pessoa não conclui tarefa, perde dados, duplica operação ou acessa o que não deveria.     | Corrigir primeiro.                                             |
| Dificuldade frequente   | Ambiguidade, excesso de digitação, erro recorrente ou barreira de celular/acessibilidade. | Corrigir na sequência, priorizando componentes compartilhados. |
| Melhoria secundária     | Alinhamento, refinamento visual ou conforto que não impede a tarefa.                      | Aplicar depois dos problemas de uso.                           |

Registrar **local, evidência, impacto, correção e verificação**. Diferenciar o que foi observado do que é hipótese. Não dar uma nota geral de usabilidade sem método definido.

Se houver acesso autorizado a pessoas do público, observar tarefas curtas e reais sem ensinar onde tocar: concluir, alterar, recuperar de um erro e localizar o resultado. Registrar hesitações, necessidade de ajuda, erros e conclusão. Não afirmar validação com usuários quando só houve inspeção do agente.

### Modelo de entrega

Em uma implementação, apresentar de forma curta:

1. O que foi alterado e qual dificuldade resolveu.
2. Como passou a funcionar em celular e outros dispositivos relevantes.
3. Quais regras e componentes compartilhados foram afetados.
4. O que foi verificado de fato e quais limitações permanecem.

Em uma especificação, incluir objetivo, sequência, conteúdo das telas, controles, estados, recuperação e critérios de aceite. Em uma revisão, apresentar os achados por impacto e a correção proposta. Não gerar relatórios longos para uma simples troca de rótulo.
