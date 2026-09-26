# Linguagem, orientação e acessibilidade

## Conteúdo

- Escrita para usuários finais.
- Exemplos de mensagens.
- Ajuda no contexto da tarefa.
- Acessibilidade funcional.
- Medidas e referências.

## Escrita para usuários finais

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

## Exemplos de mensagens

Adaptar os textos à ação e ao estado reais; não copiar uma mensagem que prometa capacidade inexistente.

| Evitar | Preferir | Condição |
| --- | --- | --- |
| “Submit” | “Confirmar agendamento” | A ação realmente confirma, sem aprovação pendente. |
| “Confirmado!” após enviar pedido | “Solicitação enviada. Aguarde a confirmação da barbearia.” | O fluxo depende de aprovação. |
| “Campo inválido” | “Informe seu celular com DDD.” | O problema é o formato do telefone. |
| “Erro 500” | “Não foi possível carregar os horários. Tente novamente.” | Falha de consulta, sem operação com resultado incerto. |
| “Sem dados” | “Você ainda não tem agendamentos.” + “Escolher um horário” | Histórico realmente vazio. |
| “Nenhum registro” após filtro | “Nenhum agendamento encontrado com esses filtros.” + “Limpar filtros” | Há uma busca ou filtragem ativa. |
| “Sessão expirada” | “Entre novamente para continuar.” | O acesso precisa ser renovado. |
| “Sincronização concluída” | “Suas alterações foram salvas.” | A persistência foi confirmada. |
| “Deseja prosseguir?” | “Cancelar este agendamento?” | Mostrar serviço, data, horário e consequência real. |
| “Sim” / “Não” | “Cancelar agendamento” / “Manter agendamento” | Decisão sobre uma reserva existente. |
| “Falha, tente novamente” após demora no envio | “Ainda não conseguimos confirmar o resultado. Vamos verificar seu agendamento.” | O sistema efetivamente consultará o resultado. |
| “Acesso negado” | “Você não tem acesso a esta área.” | Não revelar dados da área restrita. |

Para erros, informar **o que aconteceu + o que foi preservado, se comprovado + como continuar**. Para sucesso, informar **resultado + resumo necessário + próxima ação útil**. Evitar repetir a mesma mensagem em vários lugares.

## Ajuda no contexto da tarefa

- Colocar instrução curta perto da decisão. Exemplo: “Escolha um profissional ou veja os horários disponíveis com toda a equipe”, somente se ambas as opções existirem.
- Dar exemplo em informações abstratas, prazos e regras de pontos. Identificar exemplos como ilustrativos e calcular com as regras reais quando apresentados no produto.
- Explicar opções parecidas pela diferença que importa para a pessoa. Não depender apenas de nomes comerciais.
- Usar “Como funciona” ou uma explicação expandida para detalhes secundários. Deixar preço, condição de cancelamento e consequência da ação visíveis antes do compromisso.
- Oferecer instruções que funcionem por toque e teclado. Uma dica mostrada somente ao passar o mouse não é ajuda suficiente no celular.
- Evitar tours obrigatórios, várias telas de apresentação e avisos repetidos para ensinar uma interface que pode ser mais clara.
- Se houver apresentação inicial útil, permitir pular e reabrir; ensinar no momento de uso.
- Manter ajuda e suporte em localização previsível quando existirem, sem inventar atendimento disponível, canal ou prazo.
- Usar “Este campo…” ou o nome do campo; não depender exclusivamente de instruções como “clique no botão verde à direita”.

## Acessibilidade funcional

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

## Medidas e referências

Adotar WCAG 2.2 nível AA como referência de verificação para os critérios aplicáveis. As medidas abaixo são um recorte, não uma auditoria completa nem declaração de conformidade.

| Aspecto | Diretriz | Natureza |
| --- | --- | --- |
| Área acionável no celular | Adotar 44 × 44 pixels CSS ou mais como meta de produto; preferir 48 × 48 quando houver espaço. Garantir separação entre ações e avaliar a área efetivamente clicável. | Meta de conforto desta skill, não o mínimo AA. |
| Alvo mínimo WCAG 2.2 | Verificar 24 × 24 pixels CSS ou as exceções de espaçamento, equivalência, texto em linha, controle do navegador e essencialidade previstas no critério 2.5.8. | Critério AA, com exceções específicas. [1] |
| Texto comum | Contraste de pelo menos 4,5:1. | Critério 1.4.3; considerar suas exceções. [2] |
| Texto grande | Contraste de pelo menos 3:1; grande significa pelo menos 18 pt regular ou 14 pt em negrito, aproximadamente 24 e 18,67 pixels CSS. | Critério 1.4.3. [2] |
| Elementos visuais de controles e gráficos | Verificar contraste de pelo menos 3:1 com cores adjacentes nas partes necessárias para identificar e compreender o componente ou informação. | Critério 1.4.11; não significa que toda borda decorativa precise do mesmo contraste. [3] |
| Texto de leitura e campos | Partir de 16 pixels CSS ou equivalente escalável e entrelinha confortável; usar texto auxiliar menor apenas se continuar legível. | Referência de projeto, não requisito numérico universal da WCAG. |
| Ampliação | Verificar ampliação de texto a 200% sem perda de informação ou função, conforme o critério aplicável. | Critério 1.4.4. [4] |
| Reorganização de conteúdo | Em conteúdo de rolagem vertical, verificar largura equivalente a 320 pixels CSS sem perda de informação ou função e sem rolagem em duas dimensões, ressalvadas exceções essenciais. | Critério 1.4.10; tabelas e outros conteúdos podem exigir avaliação específica. [5] |
| Autenticação | Permitir mecanismos que reduzam esforço de memória/transcrição, como gerenciadores de senha, preenchimento automático e colagem. | Critério 3.3.8, conforme condições e exceções. [6] |

Medir contraste nos estados reais, inclusive conteúdo sobre gradientes; não inferir acessibilidade apenas pelo nome da cor. O teste automatizado ajuda a localizar problemas, mas não substitui inspeção de teclado, foco, leitura e compreensão.

Fontes oficiais consultadas em 26/09/2026:

1. [W3C — Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
2. [W3C — Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
3. [W3C — Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
4. [W3C — Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html).
5. [W3C — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
6. [W3C — Accessible Authentication (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html).
