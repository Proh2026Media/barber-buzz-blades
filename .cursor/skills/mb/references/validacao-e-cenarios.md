# Validação e cenários de uso

## Conteúdo

- Critérios de aceite.
- Matriz de dispositivos e estados.
- Cenários completos.
- Revisão de todo o sistema.
- Modelo de entrega.

## Critérios de aceite

Aplicar somente os itens pertinentes ao escopo. Registrar “não se aplica” com motivo quando necessário, sem transformar todo ajuste pequeno em auditoria integral.

### Compreensão e tarefa

- [ ] O título deixa claro o objetivo da tela.
- [ ] A ação principal pode ser reconhecida sem explicação externa.
- [ ] O rótulo informa o que acontecerá; preço, prazo e consequência relevantes aparecem antes da confirmação.
- [ ] A ordem das informações acompanha a decisão da pessoa.
- [ ] Campos opcionais e obrigatórios são reconhecíveis; não há repetição evitável de dados.
- [ ] A pessoa pode voltar, corrigir escolhas e continuar sem reiniciar desnecessariamente.
- [ ] A conclusão informa o resultado real e o próximo passo útil.

### Uso em diferentes dispositivos

- [ ] Texto e ações essenciais cabem em tela estreita sem corte ou sobreposição.
- [ ] Áreas de toque são confortáveis e ações próximas não provocam enganos frequentes.
- [ ] O teclado virtual não esconde campo, erro ou ação necessária.
- [ ] Ações fixas respeitam as áreas do aparelho e deixam espaço no conteúdo.
- [ ] Rolagem principal, tabelas e janelas funcionam sem prender o conteúdo.
- [ ] A experiência de computador aproveita o espaço sem alterar o significado das ações.

### Estados e integridade

- [ ] Carregando, primeiro uso, busca vazia, indisponibilidade, falha e sucesso têm mensagens distintas.
- [ ] A falha mantém as informações já preenchidas quando seguro.
- [ ] Resultado incerto leva à verificação antes de nova operação equivalente.
- [ ] Há proteção adequada contra duplicação e concorrência nas operações afetadas.
- [ ] Mudança de opção anterior revalida dependências e explica o que precisa ser revisto.
- [ ] Permissões e validações continuam aplicadas nas camadas apropriadas.
- [ ] “Desfazer”, salvamento automático e suporte offline só aparecem quando funcionam de fato.

### Acessibilidade e identidade

- [ ] Campos têm rótulos associados, opções têm estado e ações têm nome acessível.
- [ ] Teclado percorre o fluxo em ordem lógica, com foco visível e retorno correto de janelas.
- [ ] Erros e mudanças relevantes são compreensíveis também com leitor de tela quando verificado.
- [ ] Cor, ícone, imagem e gesto não são a única forma de obter informação ou concluir a tarefa.
- [ ] Contraste, ampliação, reorganização e movimento foram verificados conforme a alteração.
- [ ] Componentes, termos e estilos mantêm consistência com o produto.
- [ ] No Barba & Cabelo, Inter, superfícies, gradientes, cores de ação e os três modos de canto foram respeitados.

Marcar como verificado apenas o que foi efetivamente examinado. Uma análise de texto não equivale a teste no navegador, leitor de tela ou aparelho físico.

## Matriz de dispositivos e estados

Usar amostragem proporcional ao risco. As larguras são referências de verificação, não pontos de quebra obrigatórios.

| Situação | Conferir |
| --- | --- |
| Largura equivalente a 320 pixels CSS | Reorganização do conteúdo, leitura e ação principal; exceções justificadas. |
| Celular de 360–390 pixels CSS | Tarefa completa por toque, campos longos e teclado aberto. |
| Tablet ou largura intermediária | Transição de colunas, painéis e orientação. |
| Computador, por exemplo 1280 pixels CSS | Hierarquia, comprimento de linhas e navegação por teclado. |
| Texto ampliado a 200% | Informação e função preservadas, inclusive em controles e janelas. |
| Conexão lenta ou falha simulada | Retorno imediato, contexto preservado e recuperação sem duplicação. |
| Conteúdo realista | Nomes longos, listas grandes, poucos resultados, ausência de imagem e valores variados. |
| Temas e preferências existentes | Contraste e persistência; no Barba & Cabelo, os três modos de canto. |

Quando disponíveis, conferir navegadores e dispositivos relevantes ao público; emulação não substitui todos os comportamentos de teclado, rolagem e tecnologias assistivas de aparelhos reais. Declarar a limitação sem afirmar validação universal.

## Cenário 1 — Agendamento compreensível

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

## Cenário 2 — Configuração sem ambiguidades

**Tarefa:** escolher o modo de canto do Barba & Cabelo.

- Mostrar três opções de escolha única: “Retos”, “Semi arredondados” e “Arredondados”.
- Exibir uma pequena prévia de botão, campo e cartão em cada opção, com identificação textual do estado selecionado.
- Usar semi arredondado quando não houver preferência.
- Se a aplicação for imediata, indicar a gravação e restaurar o estado anterior em falha. Se depender de salvar, manter prévia e estado pendente até “Salvar aparência”. Respeitar o modelo existente.
- Não usar três interruptores independentes para uma escolha mutuamente exclusiva.
- Aplicar a preferência a componentes compartilhados, janelas e estados, sem alterar a fonte ou cores como efeito colateral.

## Cenário 3 — Cancelamento seguro e simples

**Tarefa:** cancelar um agendamento existente.

- Abrir uma confirmação curta com serviço, data e horário.
- Informar a condição real de cancelamento e eventual consequência financeira, se houver. Não inventar taxa ou direito de reembolso.
- Usar “Cancelar agendamento” e “Manter agendamento” como ações claramente diferentes.
- Manter estado de cancelamento em andamento até o resultado ser conhecido.
- Confirmar cancelamento apenas após a operação ser concluída. Diferenciar cancelamento da reserva e processamento de eventual devolução.
- Oferecer “Desfazer” somente se a reversão preservar de fato as condições necessárias. Caso contrário, um novo agendamento é outra operação.

## Cenário 4 — Formulário em celular com erro

**Tarefa:** atualizar telefone e nome em uma tela de perfil.

- Usar rótulos visíveis, teclado de telefone no campo apropriado e nome com capitalização tolerante.
- Permitir colar e preencher automaticamente. Aceitar formatação razoável de telefone e apresentar padrão familiar.
- Ao detectar erro, manter nome e demais campos, indicar o problema junto do telefone e orientar a correção.
- Com teclado aberto, manter o campo com erro visível e o caminho até “Salvar alterações” alcançável.
- Se salvar falhar, informar a falha e manter alterações pendentes; não exibir mensagem de sucesso.
- Ao sair com mudanças relevantes, permitir salvar, continuar editando ou descartar conscientemente, conforme o padrão existente.

## Revisão de todo o sistema

Quando o pedido abranger o produto inteiro, inventariar as jornadas existentes antes de aplicar alterações. Incluir acesso e recuperação, início, navegação, busca, cadastros, tarefa principal, histórico, detalhes, edição, cancelamento, configurações, ajuda e estados vazios — apenas os módulos reais.

| Prioridade | Critério | Tratamento |
| --- | --- | --- |
| Bloqueio ou integridade | Pessoa não conclui tarefa, perde dados, duplica operação ou acessa o que não deveria. | Corrigir primeiro. |
| Dificuldade frequente | Ambiguidade, excesso de digitação, erro recorrente ou barreira de celular/acessibilidade. | Corrigir na sequência, priorizando componentes compartilhados. |
| Melhoria secundária | Alinhamento, refinamento visual ou conforto que não impede a tarefa. | Aplicar depois dos problemas de uso. |

Registrar **local, evidência, impacto, correção e verificação**. Diferenciar o que foi observado do que é hipótese. Não dar uma nota geral de usabilidade sem método definido.

Se houver acesso autorizado a pessoas do público, observar tarefas curtas e reais sem ensinar onde tocar: concluir, alterar, recuperar de um erro e localizar o resultado. Registrar hesitações, necessidade de ajuda, erros e conclusão. Não afirmar validação com usuários quando só houve inspeção do agente.

## Modelo de entrega

Em uma implementação, apresentar de forma curta:

1. O que foi alterado e qual dificuldade resolveu.
2. Como passou a funcionar em celular e outros dispositivos relevantes.
3. Quais regras e componentes compartilhados foram afetados.
4. O que foi verificado de fato e quais limitações permanecem.

Em uma especificação, incluir objetivo, sequência, conteúdo das telas, controles, estados, recuperação e critérios de aceite. Em uma revisão, apresentar os achados por impacto e a correção proposta. Não gerar relatórios longos para uma simples troca de rótulo.
