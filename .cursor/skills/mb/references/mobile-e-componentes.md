# Mobile e componentes

## Conteúdo

- Tela, navegação e adaptação.
- Critérios de escolha dos controles.
- Formulários e datas.
- Listas, tabelas e orientação visual.
- Janelas, teclado e rolagem.
- Desempenho e movimento.

## Tela, navegação e adaptação

- Começar pela tela estreita com conteúdo real, textos longos e teclado aberto. Não transformar o desktop em miniatura.
- Colocar título, estado principal e próxima ação em posições previsíveis. Manter o primeiro bloco útil sem lotá-lo de indicadores secundários.
- Em celular, usar uma coluna como ponto de partida. Em telas maiores, distribuir resumo e conteúdo sem mudar a lógica da tarefa.
- Manter uma ação principal por contexto de decisão. Reservar menor destaque para ações secundárias e separar ações destrutivas.
- Usar navegação inferior quando houver poucos destinos principais frequentes que caibam com rótulos legíveis. Caso contrário, escolher estrutura adequada; não forçar todas as funções em ícones apertados.
- Identificar o local atual com texto e estado visual. Preservar nomes entre menu, página, ajuda e mensagens.
- Priorizar ações recorrentes em regiões de alcance confortável, sem cobrir conteúdo ou exigir posições fixas impossíveis em todos os aparelhos.
- Permitir que nomes, preços, datas e rótulos aumentem sem corte silencioso. Não usar reticências como solução padrão para instruções essenciais.
- Adaptar pelo espaço disponível e pelo conteúdo; usar pontos de quebra do projeto. Não inferir “celular” apenas pelo tipo de dispositivo.

## Critérios de escolha dos controles

| Necessidade | Controle preferencial | Condições de uso |
| --- | --- | --- |
| Executar uma ação | Botão com verbo e objeto. | Informar efeito: “Confirmar agendamento”, “Salvar alterações”. |
| Abrir outra página ou detalhe | Link ou elemento de navegação com semântica correta. | Manter diferença entre navegar e enviar dados. |
| Ativar ou desativar uma preferência de efeito imediato | Interruptor liga/desliga. | Rótulo afirmativo e estado perceptível; mostrar falha e restaurar estado anterior se necessário. |
| Escolher uma opção entre poucas | Opções de escolha única ou cartões selecionáveis. | Mostrar todas quando couberem; o cartão precisa se comportar como opção acessível. |
| Escolher várias opções independentes | Caixas de seleção. | Mostrar selecionadas e esclarecer limites. |
| Confirmar uma opção dentro de formulário salvo ao final | Caixa ou grupo de opções com botão “Salvar”. | Não simular aplicação imediata. |
| Encontrar um item em lista extensa | Busca com lista ou seletor pesquisável. | Oferecer resultados legíveis, estado vazio e operação por teclado. |
| Alternar poucas visões equivalentes | Controle segmentado ou abas. | Rótulos curtos e estado ativo claro; não confundir com etapas. |
| Informar uma quantidade inteira curta | Botões de menos/mais com valor. | Respeitar limites, permitir entrada direta quando útil. |
| Ajustar aproximadamente uma intensidade | Controle deslizante com valor visível. | Oferecer alternativa precisa; não usar para informação que exige exatidão sem entrada alternativa. |
| Escolher dia ou horário | Calendário acessível, lista de horários ou controle nativo apropriado. | Dar contexto de disponibilidade e alternativa quando necessário. |
| Reordenar itens | Arrastar com comandos de mover. | Oferecer alternativa por toque e teclado; informar a nova posição. |
| Enviar imagem ou documento | Botão “Escolher foto” ou “Selecionar arquivo”. | Arrastar como facilidade adicional, nunca único caminho. |

Não substituir controles nativos acessíveis por componentes personalizados apenas pela aparência. Avaliar custo de compreensão, comportamento no celular e consistência com o produto.

## Formulários e datas

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

## Listas, tabelas e orientação visual

- Preservar a informação necessária à comparação. Em celular, usar cartões rotulados ou uma lista resumida quando equivalentes à tarefa.
- Não converter automaticamente toda tabela em cartões: comparações entre colunas podem exigir a estrutura original.
- Quando a tabela exigir rolagem horizontal, restringi-la à própria região, torná-la identificável e acessível e manter cabeçalhos compreensíveis. Evitar que a página inteira deslize lateralmente.
- Manter busca, filtros ativos e quantidade de resultados quando úteis. Oferecer “Limpar filtros” quando eles esconderem resultados.
- Distinguir zero de ausência de dado. Não preencher números desconhecidos com zero para deixar a tela completa.
- Em gráficos, mostrar título, período, unidade e alternativa textual adequada. Não depender só de cor para identificar séries.

Usar recursos visuais com uma função explícita:

| Recurso | Função útil | Cuidado |
| --- | --- | --- |
| Ícone com texto | Ajudar a reconhecer uma ação. | Manter desenho e significado consistentes. |
| Foto ou miniatura | Identificar profissional, serviço, documento ou item. | Não depender da imagem para a única informação essencial. |
| Exemplo preenchido | Mostrar um formato ou resultado esperado. | Diferenciar exemplo de dado real. |
| Prévia | Antecipar efeito de uma configuração visual ou publicação. | Não prometer fidelidade que a prévia não oferece. |
| Resumo visual | Ajudar a conferir dados antes de confirmar. | Conservar todas as condições relevantes em texto. |
| Ilustração de estado vazio | Explicar o que existe naquela área. | Manter título, orientação e ação; evitar decoração dominante. |
| Indicador de etapas | Mostrar posição em uma sequência real. | Garantir leitura e estado atual para tecnologia assistiva. |

Não usar emojis como único identificador de ação, ilustrações que sugiram opções inexistentes ou animações que disputem atenção com a tarefa.

## Janelas, teclado e rolagem

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

## Desempenho e movimento

- Dar retorno imediato ao toque, mesmo quando a operação remota demorar. Usar verbo específico: “Salvando…”, “Buscando horários…”.
- Evitar indicadores indefinidos sem recuperação. Depois de demora relevante, explicar a situação e oferecer saída ou verificação compatível com a operação.
- Não exibir percentual fictício. Usar progresso numérico somente com medida real.
- Reservar dimensões de imagens e espaços de conteúdo para reduzir deslocamentos durante carregamento.
- Otimizar imagens e carregar recursos secundários conforme necessário. Considerar aparelhos modestos e conexão instável na implementação.
- Usar movimento curto e discreto para comunicar relação ou estado; respeitar preferência por movimento reduzido e evitar piscadas.
- Não exigir PWA, instalação, biblioteca nova, animações complexas ou infraestrutura adicional apenas por aplicar esta skill.
