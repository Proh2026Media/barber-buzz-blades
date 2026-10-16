# Análise visual e simplificação — 16/10/2026

Pedido do dono (16/10/2026): o visual está condensado e, ao mesmo tempo, com muito volume, o que atrapalha o barbeiro e o cliente no dia a dia. Pediu para apontar o que pode ser minimizado ou ressignificado sem tirar, o que pode ficar em subpáginas e o que pode ir para o admin global, e para o sistema ficar otimizado para celular (principalmente iPhone com iOS 27) e para computador e tablet, sem parecer adaptação.

Este documento registra o diagnóstico, o que já foi aplicado (Claude Code, 16/10) e o que fica para decidir. Medidas feitas na demonstração (`/demo`), com a ferramenta `scripts/foto.mjs`, na largura de 390 px (celular comum) e de 1280 px (computador).

## 1. Diagnóstico

O excesso vinha de quatro padrões repetidos pelo app inteiro:

1. **Tudo aberto ao mesmo tempo.** Ajustes → Agendamento mostrava os oito cartões de regra abertos, com exemplos e prévias, numa página de 5.001 px no celular. Avisos e integrações abria o editor de mensagens inteiro, mesmo sendo usado raramente.
2. **A mesma informação dita duas vezes.** O selo "Confirmado" aparecia em todo atendimento, que é o estado normal do dia. Ao lado de cada interruptor "Aparece para clientes" ou "Recebe agendamentos" havia um selo dizendo o mesmo ("Visível", "Ativo"). O quadro "Assim seus clientes veem os horários" se repetia em Serviços, Horários e Ajustes. O resumo fixo do Agendar repetia serviço e profissional, que já aparecem nos passos logo acima.
3. **Ferramenta de lista longa em lista curta.** Busca, filtros "Todos / Visíveis / Pausados" e troca grade/lista apareciam mesmo com 3 serviços ou 4 profissionais, e mesmo sem nada pausado.
4. **Computador como celular esticado.** A barra de navegação flutuava no pé da tela também no computador e cobria parte do conteúdo (na agenda, os filtros do "Seu dia" ficavam atrás dela).

## 2. O que foi aplicado nesta entrega

| Tela (celular, 390 px)         | Antes    | Depois   | O que mudou                                                                                                                                                                                                                                                                    |
| ------------------------------ | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ajustes → Agendamento          | 5.001 px | 954 px   | Vira uma lista ("Como seu cliente agenda hoje"); cada ajuste abre sozinho, com a seta voltando à lista. O "Voltar" do celular também volta (`?item=` no endereço).                                                                                                             |
| Ajustes → Avisos e integrações | 3.769 px | 2.375 px | "Textos das mensagens" sempre recolhido; o lápis de cada aviso abre direto no texto dele.                                                                                                                                                                                      |
| Equipe                         | 1.798 px | 1.215 px | Um botão "+ Adicionar" no lugar dos dois botões grandes; sem a bio no cartão; ícones dos serviços só quando a pessoa não faz todos; "Copiar link" e "Ver agenda" no menu "⋯".                                                                                                  |
| Serviços                       | 1.194 px | 880 px   | Sem o quadro de horários repetido; sem busca, filtros e troca grade/lista em lista curta; sem o selo "Visível" ao lado do interruptor.                                                                                                                                         |
| Agendar (cliente)              | 1.927 px | 1.789 px | Sem troca grade/lista em lista curta; a barra fixa do celular mostra só o dia/horário e o botão.                                                                                                                                                                               |
| Agenda (barbeiro)              | 2.859 px | 2.714 px | Sem o selo "Confirmado" repetido (os outros estados continuam); filtros do "Seu dia" só quando há mais de um estado; contagem "· 11" em vez de "11 de 11 atendimentos". A medida de depois tem um atendimento a mais na demonstração.                                          |
| Ajustes → Equipe e sociedade   | 1.131 px | 931 px   | "Seu acesso nesta barbearia" vira uma linha de resumo ("Você pode fazer tudo nesta barbearia", "Além da sua agenda: 3 de 8 permissões", "Você cuida da sua própria agenda"); a lista ✓/— abre ao tocar em "Ver lista". O selo do papel no topo continua abrindo a mesma lista. |

Também:

- **Computador e tablet deitado (a partir de 1024 px):** a navegação virou uma coluna fixa à esquerda, com ícone e nome, como num aplicativo de computador. Nada mais flutua sobre o conteúdo. Vale para o app do cliente, o painel da barbearia e o painel da plataforma. No celular e no tablet em pé, a barra de baixo continua como era.
- **Agenda no computador:** a coluna da esquerda (dia, "Seu dia") descia uns 40 px em repouso quando cabia inteira na tela (visão Contratado), porque o cálculo do "grudar ao rolar" somava a altura do cabeçalho a uma área que já começa abaixo dele. Corrigido: em repouso as duas colunas alinham; ao rolar, a coluna gruda logo abaixo do cabeçalho.
- **Giro de tela:** o manifesto do app instalado deixou de travar a tela em pé (`orientation: any`). No tablet instalado, o app gira.
- **Agenda:** botão **Agendar** no topo e atalho **Agendar aqui** em cada horário livre (agendamento pelo barbeiro); apelido na frente do nome; selo "Sem cadastro" para cliente do balcão; selo de **cliente recorrente** ("Recorrente · toda semana", "a cada 15 dias", "Cliente recorrente"), também no quadro da equipe no computador.

### Teste de interface completo (16/10, madrugada)

Um agente testou a demonstração inteira (399 fotos, 320 a 1920 px, claro e escuro) e achou 15 defeitos visíveis. Todos foram corrigidos, cada correção revisada por um segundo agente que tentou derrubá-la:

| Onde                                       | Defeito                                                                                                                                                    | Como ficou                                                                                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Ajustes (celular)                          | Com a lista rolada, a seção abria pela metade, sem título nem seta; ao voltar, a lista perdia a posição                                                    | Cada tela abre do topo e a lista volta onde estava (pela seta, pelo Voltar do celular e por link direto)                                  |
| Agenda → "Clientes da barbearia" (celular) | Cartão dentro de cartão, título repetido; recolher deixava a janela vazia; busca cortada a 320 px                                                          | Na janela, só a lista; busca "Buscar cliente"                                                                                             |
| Agenda (topo)                              | "Agendar" com estilo diferente de "Novo serviço"/"Adicionar"; no escuro virava botão claro                                                                 | Mesmo botão de ação em todas as abas                                                                                                      |
| Cartão de atendimento (320 px)             | "· 45 min" começando a linha; a seta "›" sozinha embaixo do nome                                                                                           | Serviço e duração em texto corrido, sem linha começando por "·"; seta presa ao nome                                                       |
| "Seu dia" (celular)                        | Segunda linha dos valores começava embaixo do ícone                                                                                                        | Alinhada ao texto                                                                                                                         |
| "Agendar cliente" (computador)             | Filas de profissionais e dias cortadas, difíceis de rolar com o mouse                                                                                      | Quebram em linhas no computador; no celular continua a rolagem lateral                                                                    |
| Plataforma                                 | Selo "Prévia" cobrindo o ícone em "Testar como…"; título de Barbearias encostado no botão a 320 px                                                         | Selo e rótulos alinhados; abaixo de 359 px o botão fica só com o "+"                                                                      |
| Entrar/Cadastrar (320 px)                  | Textos de exemplo de senha cortados ("Crie uma senh", e em pt-PT/en-US no Entrar e na confirmação); em pt-PT, "Esqueci-me da palavra-passe" sobre o rótulo | Textos mais curtos nos 4 idiomas ("Crie a sua", "Introduza-a", "Enter yours", "Esqueceu-se?"…)                                            |
| Cliente → Meus agendamentos                | Atendimento em andamento aparecia como "Já passou", em Anteriores; depois de remarcar, o título voltava a "Agendar atendimento"                            | Selo "Agora" e o atendimento fica em Próximos até o término; o título "Remarcar reserva" segue no resultado                               |
| Computador (1280 e 1920 px)                | O título mudava de lugar entre as abas; o nome da loja ficava solto no meio do cabeçalho                                                                   | Conteúdo encostado na coluna lateral, mesma borda em todas as abas; nome da loja sobre a coluna; a partir de 1536 px, colunas mais largas |
| Ajustes → Antecedência mínima              | De madrugada, a prévia oferecia um horário com a loja fechada; na demonstração, usava o relógio do aparelho                                                | Mostra "Fechado" e o primeiro horário com a loja aberta; na demonstração, o relógio dela                                                  |
| Demonstração                               | Mesmo serviço com dois preços; nome da loja cortado a 1024 px pelo seletor de visões                                                                       | Preço único; seletor compacto entre 1024 e 1279 px                                                                                        |

## 3. O que ainda pode ser minimizado ou ressignificado (sem tirar)

Propostas, em ordem de ganho para o dia a dia. Nenhuma tira função.

1. **"Seu dia" mais curto na Agenda.** Número e barra numa linha só; "Agora" e "Próximo" como uma linha cada (já são atalhos para a lista); valores do dia dentro de "Mais números do dia" para quem não é dono.
2. **Modo compacto da lista de atendimentos.** Uma linha por atendimento (hora · apelido · serviço) para quem tem agenda cheia, com o cartão completo ao tocar. Escolha guardada no aparelho.
3. **Equipe:** "Hoje: 11 atendimentos · próximo 09:30" e os serviços numa só linha.
4. **Avisos → Google Agenda:** "Do Google para cá" e "Daqui para o Google" recolhidos depois de escolher a agenda (hoje ficam sempre abertos).
5. **Início do cliente:** o cartão do clube de pontos pode recolher os botões "Meus pontos" e "Como funciona" num menu, deixando "Trocar pontos" à vista.

## 4. O que pode ficar em subpáginas ou categorias

1. **Ajustes → Equipe e sociedade:** fazer como em Agendamento (feito nesta entrega): lista com o resumo de cada assunto (decisões pendentes, pessoas, convites, permissões, meu acesso, saída), cada um abrindo sozinho.
2. **Ajustes → Endereços:** domínio próprio e redirecionamentos de links antigos numa subpágina "Avançado"; à vista só o link da barbearia e o botão de copiar.
3. **Horários:** "Bloqueios" já tem botão próprio; os próximos dias podem ficar recolhidos atrás de "Ver próximos dias".

## 5. O que pode ir para o admin global (plataforma) — decisão do dono

Mudar quem pode fazer o quê é regra de negócio: fica registrado como **P-74** em [guia/pendencias.md](guia/pendencias.md), com as opções. Candidatos:

| Assunto                             | Hoje                            | Proposta                                                                                              | Por quê                                                            |
| ----------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Domínio próprio (DNS, verificação)  | Dono da barbearia, em Endereços | Plataforma configura; a loja vê só o endereço e o estado                                              | Técnico (registros de DNS) e raro; erro deixa a loja fora do ar    |
| Redirecionamento de links antigos   | Dono, em Endereços              | Plataforma                                                                                            | Técnico e raro                                                     |
| Fuso horário da barbearia           | Dono, em Agendamento            | Definido no cadastro; mudança só pela plataforma                                                      | Muda o horário de todos os atendimentos marcados; quase nunca muda |
| Modelos de texto do WhatsApp        | Dono edita os 4 textos          | Plataforma mantém bons textos padrão; a loja só liga/desliga e, se quiser, personaliza (já recolhido) | A maioria usa o padrão; o editor é a parte mais pesada da tela     |
| Módulos (clube de pontos, esportes) | Já são da plataforma            | Manter                                                                                                | —                                                                  |
| Conexão do WhatsApp da barbearia    | Dono (QR no celular dele)       | Manter com a loja                                                                                     | O QR precisa do celular do dono                                    |

Para mover os três primeiros, falta tela na ficha da loja do painel da plataforma (hoje ela só mostra o fuso, sem editar). Até a decisão, eles continuam com o dono.

## 6. Celular (iPhone, iOS 27) e computador

- **iPhone e app instalado:** a página já usa `viewport-fit=cover` e respeita as áreas do recorte e da barra de gestos; a barra de baixo flutua acima do gesto. O login com Google no app instalado foi corrigido nesta entrega (a janela do Google entrega o código ao app e pede para fechar; o app entra sozinho ao voltar). Conectar a Agenda Google pelo app instalado também pede para fechar a janela no fim, em vez de abrir o painel dentro dela.
- **Computador:** coluna de navegação à esquerda; o conteúdo usa a largura que sobra; a agenda da equipe mostra o quadro por profissional.
- **Tablet:** em pé (768 a 1023 px), barra de baixo, como os apps de tablet; deitado (1024 px ou mais), a coluna lateral.
- **Não testado em aparelho físico** (P-43): as conferências desta entrega foram feitas no navegador do Mac, nas larguras de celular e computador.
