---
name: mb
description: Orientar mudanças de interface no projeto Barba & Cabelo para uma experiência moderna, intuitiva e acessível a diferentes idades. Aplicar quando o usuário invocar /mb ou $mb ou pedir melhorias visuais e de interação nesse projeto.
---

# MB — Interface do Barba & Cabelo

## Direção visual

- Criar uma experiência de aplicativo moderno de barbearia, com identidade masculina e madura, navegação simples e hierarquia clara.
- Tipografia do sistema: manter Inter em textos, campos, controles e botões. Cada barbearia pode escolher ou enviar uma fonte de marca, mas ela deve ficar restrita ao nome no cabeçalho ou, se configurado, também a títulos de seções e nomes de serviços. Nunca aplicar uma fonte decorativa ao sistema inteiro.
- Adaptar toda a interface aos três modos de canto configuráveis: **retos**, **semi arredondados** e **arredondados**. Usar **semi arredondados como padrão** até o usuário escolher outro modo e persistir a preferência.
- Aplicar o modo escolhido de ponta a ponta em botões, campos, cartões, janelas, cabeçalhos, rodapés e estados equivalentes. Não misturar raios de modos diferentes nem deixar componentes isolados com outra linguagem.
- Manter uma identidade visual consolidada e consistente entre páginas, temas, estados e tamanhos de tela. Evitar oscilações de tipografia, espaçamento, cor, elevação, controles ou hierarquia sem uma razão funcional explícita.
- Preservar os gradientes dos níveis e pontos. Manter cartões e superfícies de leitura em branco/off-white, claramente separados do fundo da página.
- Usar cores para comunicar estado e ação, acompanhadas de ícone e texto. Evitar tons rosados nos campos e filtros.
- Preservar botões de ação com fundo escuro, ícone e texto na cor da ação: confirmar em azul, concluir em verde e cancelar/excluir na cor de alerta. Padronizar tamanho e área de toque.
- Destacar a navegação ativa sem a linha inferior rejeitada pelo usuário.

## Interação

- Preferir seleção visual, liga/desliga, incrementos, controles de faixa e arrastar e soltar quando forem adequados à tarefa, reduzindo digitação desnecessária.
- Para datas e horários, usar seletores integrados ao tema; não depender de digitação manual ou de um pequeno ícone para abrir o seletor.
- Arrastar e soltar deve ter alternativa por toque, clique e teclado. Nenhuma ação essencial pode depender exclusivamente de um gesto difícil de descobrir ou executar.
- Manter entrada manual como alternativa quando facilitar precisão, acessibilidade ou casos que os controles visuais não atendam.
- Priorizar uso com uma mão no celular, alvos de toque confortáveis, texto legível, contraste e indicação clara de foco.
- Usar nomes familiares, ícones reconhecíveis acompanhados de rótulos e estados distinguíveis sem depender apenas da cor.

## Entendimento rápido

- Projetar para pessoas de diferentes idades e familiaridades com tecnologia. Tornar evidentes a próxima ação, o estado atual e o resultado esperado.
- Explicar opções e consequências perto do controle, em linguagem curta e concreta. Para regras com prazos ou valores, incluir exemplo quando útil.
- Oferecer detalhes adicionais sob demanda; evitar excesso de texto, avisos repetidos e campos que apresentam a mesma informação.
- Dar retorno de salvamento, carregamento e falha. Preservar dados já visíveis durante atualizações quando possível.
- Manter rolagem interna ao aplicativo e barras discretas, visíveis durante a rolagem. A rolagem principal deve ficar na extremidade direita da página.

## Aplicação

- Consultar os componentes e estilos existentes antes de criar novos padrões; melhorar o sistema compartilhado quando a mudança se repetir.
- Ao criar ou revisar um componente, conferir seu comportamento nos três modos de canto. Se o usuário ainda não escolheu um modo, tratar `soft`/semi arredondado como o valor efetivo.
- Reutilizar tokens, componentes e padrões aprovados para preservar a mesma identidade visual em toda a jornada; mudanças locais não devem introduzir uma segunda linguagem visual.
- Aplicar estas diretrizes ao escopo solicitado, preservando regras de negócio, permissões, dados e mecanismos existentes. A invocação da skill não autoriza uma reformulação completa por si só.
- Conferir os fluxos alterados em celular e desktop, incluindo rótulos, leitura, toque, teclado, estados de erro e opções de desfazer quando cabíveis.
- Evoluir estas diretrizes conforme novas decisões do usuário. Ideias futuras documentadas no projeto não são funcionalidades já implementadas.
