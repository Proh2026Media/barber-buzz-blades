# Perfil visual — Barba & Cabelo

Aplicar este perfil às telas do Barba & Cabelo. Preservar as decisões dos anexos originais e integrar as diretrizes gerais de lógica, celular e acessibilidade. Não aplicar este visual automaticamente a outro sistema.

## Identidade e tipografia

- Manter uma experiência moderna de aplicativo de barbearia, com identidade masculina e madura, navegação simples e hierarquia clara.
- Usar Inter em textos, campos, controles e botões do sistema.
- Permitir a fonte de marca escolhida ou enviada pela barbearia somente no nome do cabeçalho e, quando configurado, em títulos de seções e nomes de serviços.
- Não aplicar fonte decorativa à interface inteira nem usá-la em instruções, preços, formulários e controles que dependem de leitura rápida.
- Preservar hierarquia de tamanhos, pesos, espaçamento, cores, sombras e estados entre páginas. Reutilizar os tokens existentes.
- Não transformar “moderno” em excesso de efeitos, baixa legibilidade, textos pequenos, elementos sem rótulo ou aparência infantil.

## Modos de canto

| Opção visível | Comportamento |
| --- | --- |
| Retos | Aplicar a família de raios do modo reto. |
| Semi arredondados | Aplicar a família de raios suaves; usar como padrão efetivo quando ainda não houver escolha. |
| Arredondados | Aplicar a família de raios arredondados. |

- Tratar `soft`/semi arredondado como valor efetivo quando a preferência estiver ausente; evitar uma primeira renderização em outro modo seguida de troca perceptível.
- Persistir a escolha explícita no mecanismo e no escopo previstos no projeto. Não tratar uma preferência não salva como concluída.
- Aplicar o modo a botões, campos, cartões, janelas, cabeçalhos, rodapés, menus, seletores, avisos e estados equivalentes.
- Usar uma família coerente de raios por modo; componentes de tamanhos diferentes não precisam do mesmo número absoluto.
- Evitar valores isolados que misturem os três modos. Inspecionar também componentes de bibliotecas externas e sobreposições.
- Preservar formas com função própria, como avatar circular ou indicador de progresso, quando fizerem parte do padrão aprovado. Documentar exceções funcionais, sem usá-las para justificar inconsistências.
- Conferir todos os três modos ao criar ou modificar um componente compartilhado. Não assumir que testar o padrão valida os outros.

## Superfícies, cores e ações

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

## Interação, ilustração e continuidade

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
