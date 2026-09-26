# Produto e lógica de uso

## Conteúdo

- Objetivo, dados e decisões.
- Etapas e dependências.
- Estados e verdade operacional.
- Integridade e recuperação.
- Permissões, preferências e continuidade.

## Objetivo, dados e decisões

Organizar o sistema em torno de tarefas reconhecíveis: agendar, consultar, alterar, confirmar, receber, acompanhar. Evitar expor a estrutura interna do banco de dados como navegação.

- Mostrar primeiro a informação necessária para decidir. Em um serviço, apresentar nome, preço, duração e disponibilidade quando existirem e forem relevantes.
- Separar o essencial do opcional. Marcar campos opcionais; não transformar dados desejáveis para a empresa em barreiras sem justificativa de negócio.
- Não exigir cadastro completo antes de uma consulta que possa ocorrer sem identificação. Respeitar autenticação e restrições já existentes.
- Explicar a finalidade de dados pouco óbvios perto do campo. Não pedir novamente informação já fornecida no mesmo processo quando puder ser reutilizada com segurança.
- Reduzir alternativas simultâneas com agrupamentos familiares, busca ou filtros úteis. Não ocultar informação que muda a decisão sob “Saiba mais”.
- Preferir nomes e resumos reconhecíveis a códigos internos. Identificadores técnicos podem existir para suporte, sem comandar a experiência.
- Usar padrões iniciais que sejam seguros, explícitos e reversíveis. Não marcar por padrão aceite, compra adicional, autorização de comunicação ou escolha com custo.
- Simplificar o caminho frequente sem bloquear casos menos comuns. Detalhes avançados podem ficar recolhidos, desde que localizáveis e acessíveis.

## Etapas e dependências

Mapear a sequência real do negócio. Um agendamento pode depender de serviço, unidade, profissional e horário; a ordem deve refletir o modelo existente. Não inventar uma sequência universal.

- Agrupar campos relacionados e nomear etapas pelo objetivo: “Escolha o serviço”, “Escolha o horário”, “Confira seu agendamento”.
- Mostrar o progresso real e permitir voltar às etapas anteriores. Evitar indicadores numéricos enganosos quando a quantidade de etapas mudar.
- Preservar escolhas ainda válidas ao voltar ou mudar um dado anterior.
- Quando uma alteração invalidar outra, explicar exatamente o que precisa ser revisto. Exemplo: “Esse profissional não atende no horário escolhido. Selecione outro horário.”
- Não trocar silenciosamente profissional, unidade, data, preço, destinatário ou forma de pagamento para manter o fluxo avançando.
- Atualizar resumo, disponibilidade e total a partir das mesmas regras. Mostrar o custo total e as condições relevantes antes do compromisso.
- Pedir uma revisão final proporcional ao impacto. Uma reserva, pagamento ou exclusão pode precisar de resumo; um filtro normalmente não precisa de confirmação.
- Distinguir escolher, salvar e executar. Selecionar um horário não significa reservá-lo; salvar uma preferência não significa enviar uma mensagem.

## Estados e verdade operacional

Definir estados antes de construir a tela. Não combinar condições diferentes sob o mesmo “erro” ou “vazio”.

| Situação | Mostrar | Permitir |
| --- | --- | --- |
| Carregamento inicial | O que está sendo buscado, com espaço estável para o conteúdo. | Sair ou voltar quando seguro. |
| Atualização de dados | Conteúdo anterior identificado como em atualização, se ainda puder ser exibido. | Manter contexto; revalidar ações que dependem de dados atuais. |
| Primeiro uso | Explicação curta do que aparecerá ali. | Iniciar a primeira tarefa. |
| Busca sem resultados | Termos ou filtros que produziram o resultado. | Limpar ou ajustar filtros. |
| Indisponibilidade | Motivo compreensível e, se existente, alternativa. | Escolher outro horário, data, item ou responsável. |
| Edição não salva | Indicação de mudanças pendentes quando necessário. | Salvar ou descartar conscientemente. |
| Envio em andamento | Ação específica em andamento. | Impedir repetição da mesma operação; manter saídas seguras. |
| Sucesso confirmado | Resultado, dados principais e próximo passo útil. | Consultar, alterar, compartilhar ou encerrar, conforme suporte real. |
| Falha confirmada | O que não foi concluído e como corrigir. | Tentar novamente com proteção contra duplicações. |
| Resultado incerto | Informação de que a confirmação ainda está sendo verificada. | Consultar estado antes de iniciar nova operação equivalente. |
| Falta de acesso | Explicação apropriada sem revelar dados protegidos. | Usar um caminho de acesso permitido que exista. |

Não mostrar “Agendamento confirmado” ao apenas enviar uma solicitação. Não mostrar “Pago” porque o usuário abriu uma página de pagamento. Se depender de aprovação, usar “Solicitação enviada” e explicar o próximo passo e o prazo somente quando conhecidos.

## Integridade e recuperação

### Evitar duplicações

- Dar resposta visual imediata ao toque e bloquear o reenvio da mesma operação enquanto estiver pendente.
- Para operações com consequência, verificar proteção no servidor, por exemplo idempotência, restrições ou transações já disponíveis. Desabilitar um botão sozinho não resolve concorrência nem novas tentativas de rede.
- Consultar o resultado anterior antes de reenviar após perda de conexão ou demora sem resposta. Não assumir falha só porque a tela deixou de receber a confirmação.
- Revalidar disponibilidade e preço no ponto de confirmação, conforme a regra do produto.
- Em disputa pelo mesmo horário, informar que ele deixou de estar disponível e oferecer alternativas reais. Preservar as demais escolhas válidas.

### Evitar perda de trabalho

- Manter campos preenchidos ao apresentar erro de validação ou falha de envio.
- Pedir confirmação de saída apenas quando houver perda relevante de alterações não salvas. Não interromper toda navegação.
- Usar rascunho ou salvamento automático quando houver suporte apropriado, política de dados compatível e indicação clara de estado.
- Não gravar senhas, códigos de acesso ou dados sensíveis em armazenamento local só para oferecer continuidade.
- Se a sessão expirar, conduzir ao acesso novamente e retomar o fluxo quando tecnicamente seguro. Informar se alguma informação realmente precisar ser preenchida de novo.
- Distinguir “salvo no dispositivo” de “salvo na conta”. Não prometer continuidade entre aparelhos sem persistência adequada.

### Operar com conexão instável

- Manter leitura de dados já disponíveis quando apropriado e indicar se estiverem desatualizados.
- Não apagar toda a tela porque uma atualização falhou. Dar tentativa contextual e preservar a informação útil.
- Não inventar fila offline ou envio automático posterior. Se a operação exigir conexão, explicar a necessidade no momento da ação.
- Quando o resultado for incerto, apresentar “Estamos verificando se seu agendamento foi confirmado”, e consultar o registro, sem estimular outro envio imediato.
- Reservar atualização otimista para mudanças reversíveis e de baixo impacto, com reversão e aviso de falha. Reservas e pagamentos exigem confirmação confiável.

## Permissões, preferências e continuidade

- Aplicar permissões também na camada que protege os dados. Ocultar um botão não impede uma ação proibida.
- Mostrar ações pertinentes ao papel atual. Explicar indisponibilidade quando isso ajudar, sem oferecer solicitações de acesso que não existem.
- Tornar configuração de efeito imediato distinguível de formulário com botão “Salvar”. Não usar as duas promessas ao mesmo tempo.
- Persistir preferências visuais no escopo previsto pelo produto: conta, unidade ou dispositivo. Não alterar silenciosamente o escopo de uma preferência existente.
- Manter navegação, filtros e posição de leitura ao retornar de detalhes quando isso ajudar a continuar a tarefa.
- Garantir que links diretos e a ação “voltar” respeitem sessão, permissões e dados reais. Não usar esconder histórico como solução para estados mal definidos.
- Diferenciar “Cancelar agendamento”, “Sair sem salvar” e “Voltar”. Cancelar uma operação persistida não é equivalente a fechar uma janela.
- Oferecer desfazer somente quando houver reversão efetiva. Quando não houver, explicar a consequência antes da confirmação.

Antes de alterar uma regra de negócio que gere confusão, registrar a regra atual, seu efeito para a pessoa e a alternativa proposta. Mudanças de cobrança, disponibilidade, acesso ou dados exigem autorização adequada ao escopo; simplificar a interface não as autoriza automaticamente.
