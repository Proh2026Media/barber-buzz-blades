# Revisão visual integral — P-101 a P-107 (29 e 30/10/2026)

O dono considerou insuficientes as mudanças da P-100 e apontou páginas sem revisão. Esta entrega amplia a composição por tarefa e registra a cobertura por área. Implementação e verificação técnica não significam aprovação estética do dono.

## Comparações da entrega

Capturas em 1440 × 960 px, com os mesmos dados fictícios. As imagens abaixo ficam no repositório para a revisão não depender de arquivos temporários.

| Tela        | Antes                                       | Depois                                        | Mudança principal                                                            |
| ----------- | ------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------- |
| Agenda      | [Antes](evidencias/p101/agenda-antes.png)   | [Depois](evidencias/p101/agenda-depois.png)   | Lista e acompanhamento do dia lado a lado; ação junto ao título da tarefa.   |
| Minha conta | [Antes](evidencias/p101/perfil-antes.png)   | [Depois](evidencias/p101/perfil-depois.png)   | Índice escolhe a seção de edição; os demais formulários permanecem montados. |
| Meus pontos | [Antes](evidencias/p101/pontos-antes.png)   | [Depois](evidencias/p101/pontos-depois.png)   | Cartão de membro horizontal; prêmios e movimentações em áreas próprias.      |
| Esportes    | [Antes](evidencias/p101/esportes-antes.png) | [Depois](evidencias/p101/esportes-depois.png) | Jogos ao vivo e encerrados lado a lado, em listas.                           |

## Cobertura por tela

| Área                         | Telas e estados conferidos                                                                         | Tratamento                                                                                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Casca dos três painéis       | Cliente, loja e plataforma                                                                         | Identidade/utilidades no cabeçalho global; título e ação no conteúdo. Removido o portal que separava ação e tarefa e o título duplicado.                                      |
| Cliente                      | Início, agendar, próximos agendamentos, pontos, conta, avisos e esportes                           | Composições desde 1024 px; agendamentos agrupados; saldo em faixa, prêmios e extrato; Conta com seção selecionada; avisos compactos e listas; placares em duas áreas.         |
| Agenda da loja               | Minha agenda, resumo, agendar cliente, diretório                                                   | Lista com acompanhamento lateral; busca e atalhos da lista. Janela de agendamento e diretório abertos na versão compilada.                                                    |
| Serviços e Equipe            | Busca, tabela, ações e cabeçalhos                                                                  | Ação principal junto da consulta; organização também em janela compacta. Dados, ordenação e permissões mantidos.                                                              |
| Horários                     | Semana, bloqueios, pausa e prévia                                                                  | Organização lado a lado também em 1024–1279 px; alvos de toque preservados.                                                                                                   |
| Ajustes                      | Aparência, Agendamento, Avisos e integrações, Meu perfil e link, Equipe e sociedade, Idioma e tema | Categorias compactas ligadas à edição; espaço útil para campos, prévias e subcategorias.                                                                                      |
| Ajustes fora da demonstração | Clube: regras, prêmios, resgates e clientes; domínio; senha                                        | Componentes reais montados em cenário local isolado, com vínculo e respostas fictícias. Menu lateral do Clube e conteúdo. Não foi adicionado acesso de teste ao produto.      |
| Plataforma                   | Início, Barbearias, ficha de loja, Acessos, Relatórios                                             | Cabeçalhos contextuais; comparação de papéis em duas colunas; indicadores do relatório em uma linha, questionários e privacidade em áreas relacionadas.                       |
| Página pública da barbearia  | Equipe, serviços, funcionamento, sobre e chamada para agendar                                      | Equipe e serviços lado a lado; funcionamento sem reservar uma coluna vazia; chamada de agendamento ao rolar. Prévia móvel do editor preservada.                               |
| Entrada pública              | Início do site, login, cadastro da barbearia e convite sem token                                   | Inspeção em celular e PC; composições existentes de acesso/cadastro mantidas onde já eram adequadas. Não foram alterados autenticação, criação de conta ou aceite de convite. |
| Documentos                   | Termos, Privacidade, Política do Clube e Acordo de Dados                                           | Leitura e índice lateral conferidos; composição e textos jurídicos preservados.                                                                                               |
| Retornos de autenticação     | `/auth/retorno` e `/auth/google-apps` sem credenciais externas                                     | Estados de entrada/retorno conferidos. Não equivale a um login Google real.                                                                                                   |

`/app`, `/shop` e `/platform` usam os mesmos componentes exercitados na demonstração; seus controles de acesso continuam os existentes. As rotas públicas foram abertas diretamente. Nenhuma operação atingiu banco ou integração real.

## Verificação

- Tipos, 301 testes, ESLint, Prettier e montagem de produção.
- Matriz de 35 estados em 1100 e 1440 px (70 capturas). As 35 incluem rotas públicas, painéis, subcategorias de Ajustes e detalhes.
- Matriz móvel em 390 px; 31 referências válidas idênticas pixel a pixel. Os demais estados foram conferidos por inspeção/fluxo, sem afirmar igualdade de referências incompletas.
- Onze estados em 768 e 1024 px com toque emulado (22 capturas); 14 no tema escuro e dez em 1920 px.
- Três famílias de canto em Pontos e Ajustes, nos temas claro e escuro, com inspeção do raio aplicado ao painel.
- Conta: seleção por teclado, uma seção visível no computador, todas no celular; nome digitado preservado ao redimensionar entre 390 e 1100 px. Edição e salvamento fictícios em 390, 768, 1100 e 1440 px.
- Agendar, confirmar, abrir remarcação, abrir cancelamento e manter por teclado nas mesmas quatro larguras. Serviço/profissional com disponibilidade fictícia real do cenário, sem forçar horário indisponível.
- Clube/domínio/senha: 18 estados dos componentes reais em 390, 1024 e 1440 px, com respostas locais simuladas. O cenário temporário foi removido antes da montagem.

As evidências extensas da execução ficam localmente em `/tmp/barba-p101/`; as oito imagens comparativas acima foram preservadas no Git. Testes físicos em iPad/celular, integrações reais e avaliação estética do dono continuam fora desta verificação (P-42/P-43). Sem migration ou tarefa de implantação para TI.

## P-102 — consistência das tarefas, login e seletor inicial

O dono pediu uma evolução da composição, incluindo explicitamente as páginas externas. Esta rodada complementa a P-101; não refaz as funcionalidades ou o banco já entregues.

| Tela            | Antes                                       | Depois                                        | Organização desta rodada                                                                                                             |
| --------------- | ------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Seletor inicial | [Antes](evidencias/p102/seletor-antes.png)  | [Depois](evidencias/p102/seletor-depois.png)  | Apresentação à esquerda e dois caminhos de entrada reunidos à direita; exemplos em uma faixa e etapas horizontais abaixo.            |
| Login           | [Antes](evidencias/p102/login-antes.png)    | [Depois](evidencias/p102/login-depois.png)    | Foto, marca e formulário em uma moldura central com proporções e largura controladas, desde 1024 px.                                 |
| Serviços        | [Antes](evidencias/p102/servicos-antes.png) | [Depois](evidencias/p102/servicos-depois.png) | Título e ação principal na linha da tarefa; busca, visualização e resultados na superfície de consulta. Equipe segue o mesmo padrão. |

As comparações usam 1440 × 960 px e os mesmos dados fictícios. As seis novas imagens ficam no Git junto das oito da P-101.

### Composição e comportamento

- **Entrada pública:** a decisão de cadastrar a barbearia ou acessar a conta aparece antes dos exemplos. Desde 1024 px, os benefícios formam três áreas conectadas; as etapas aproveitam a largura. Em 1024–1199 px, as ações ficam abaixo de cada descrição para conservar espaço de leitura e toque. O tablet em pé mantém duas escolhas lado a lado; o celular mantém a composição anterior.
- **Login:** o modelo “Foto e formulário” ganha uma moldura única, sem esticar os campos até a borda da tela. No cadastro longo, a marca acompanha a rolagem. “Foto imersiva” e “Cartão sobre foto” conservam seus modelos, com largura de leitura ajustada no computador. Entrar, cadastrar e recuperar continuam usando os mesmos estados, dados, validações e autenticação.
- **Editor de marca:** `AuthFrame` é compartilhado pelo acesso real e pela prévia. O modelo dividido no tablet em pé usa as mesmas regras nos dois lugares; a aba selecionada da prévia acompanha a cor do acesso real. As prévias continuam sem enviar dados e a troca de dispositivo/modelo conserva o rascunho.
- **Tarefas internas:** `.workspace-task-header` padroniza título/ação em Serviços, Equipe, Agenda e Horários desde 768 px. Os catálogos deixam a busca e os controles de consulta junto da lista. Menus, formulários, ordenação e permissões continuam os existentes.
- **Identidade:** tokens, tipografia, foto, cores de ação, cartões off-white e três modos de canto preservados. Não foram criados textos novos, fluxos de negócio ou migrations.

### Verificações desta rodada

- Tipos, 301 testes, ESLint, Prettier e montagem de produção.
- Montagem final aberta localmente: seletor, login e catálogos em 390/1024/1440 px; fim do cadastro, resultado de link enviado e código de recuperação/erro em 390/768/1024/1440 px, com respostas simuladas e 720 px de altura.
- Login: três modelos × entrar/cadastrar/recuperar em 320, 390, 768, 1024, 1100, 1440 e 1920 px; conferência adicional com 720 px de altura, tema escuro e cantos retos/arredondados. Semi arredondados usados na matriz principal.
- Seletor e áreas internas afetadas em 390, 768, 1024, 1100, 1440 e 1920 px; tema escuro em 1024/1440 e entrada externa também em inglês/espanhol.
- Comparação móvel de seis referências em 390 px: seletor, login, Serviços, Equipe, Agenda e Conta idênticos pixel a pixel na captura final correspondente.
- Navegação das duas escolhas por teclado; campos de login preservados ao redimensionar; erros do cadastro vazio e validação do e-mail na recuperação; ação do cadastro alcançável por rolagem em 390, 768, 1024 e 1440 px.
- Busca de Serviços, abertura/fechamento por teclado dos formulários de Serviço e Equipe; prévia do login nos três modelos e nos três dispositivos, conservando a escolha ao voltar ao editor.

Cenários executados em navegador local isolado, com rede externa bloqueada e respostas fictícias. Não foi criado cliente real nem enviado código, e-mail ou solicitação de login Google. Testes físicos e integrações reais continuam em P-42/P-43. Evidências extensas locais: `/tmp/barba-p102/`. Sem tarefa nova para TI.

## P-103 — cadastro da barbearia e janelas de edição

Continuação da revisão solicitada pelo dono. O cadastro ainda mantinha o formulário estreito ao lado de uma área pouco utilizada. As janelas de Serviço e Profissional tinham a mesma largura no tablet e no computador, comprimindo campos apesar do espaço disponível.

| Tela                  | Antes                                           | Depois                                            | Mudança                                                                          |
| --------------------- | ----------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------- |
| Cadastro — Seu acesso | [Antes](evidencias/p103/cadastro-antes.png)     | [Depois](evidencias/p103/cadastro-depois.png)     | Resumo e tarefa reunidos; nome/e-mail e senha/WhatsApp lado a lado quando cabem. |
| Novo serviço          | [Antes](evidencias/p103/servico-antes.png)      | [Depois](evidencias/p103/servico-depois.png)      | Campos essenciais e prévia no topo; descrição e folga em faixa abaixo.           |
| Novo profissional     | [Antes](evidencias/p103/profissional-antes.png) | [Depois](evidencias/p103/profissional-depois.png) | Mais espaço para nome, endereço e apresentação, com prévia ao lado.              |

Capturas em 1440 × 960 px, com os mesmos dados fictícios e estados. São seis novas imagens permanentes no Git.

### Organização por espaço disponível

- **Computador:** cadastro em uma moldura com resumo lateral; os quatro campos de acesso formam duas linhas. Consentimentos, avisos e ações continuam pela largura da tarefa. As duas janelas de catálogo podem chegar a 64rem desde 1024 px; a prévia mantém largura de leitura própria.
- **Tablet:** o cadastro prioriza o formulário, com o resumo logo depois e os campos distribuídos conforme a largura. As janelas mantêm dimensões compactas; prévia e campos ficam lado a lado enquanto couberem.
- **Fonte ampliada:** a inspeção a 200% identificou compressão e sobreposição. Container queries passaram a decidir a composição pela largura útil em relação à fonte: campos, resumo e prévia se empilham quando necessário. O corpo da janela continua rolável e as ações permanecem no rodapé.
- **Celular:** composição anterior preservada. Oito referências de 390 px idênticas pixel a pixel em comparação sem tolerância; a captura imediatamente após mudar para Acesso tinha apenas deslocamento vertical de 1 px, confirmado por comparação alinhada, sem outra diferença.
- **Convite:** examinados os estados pronto, conta com senha, expirado, inválido e falha de carregamento. O painel curto foi mantido: identidade, papel, mensagem e ação já cabem com leitura confortável. Não foi criada uma coluna vazia para esse conteúdo.

### Verificação

- Tipos, 301 testes, ESLint, Prettier e montagem de produção.
- Montagem final aberta em 320/768/1440 px: cadastro e formulários novos/existente; rolagem até detalhes e ações com fonte base em 200% em 1024/1440 px; cadastro em pt-PT, en-US, en-GB e es em 768/1024 px (oito estados).
- Cadastro: sociedade, acesso vazio, erros, dados preenchidos, código e conclusão em 390, 768, 1024, 1100, 1440 e 1920 px. Todas as respostas de cadastro/verificação/criação foram locais e fictícias.
- Serviço/Profissional, cadastro inicial e convite sem token nas mesmas seis larguras; conferência adicional de tema escuro e fonte base em 200% em 1024/1440 px. Três famílias de canto do diálogo verificadas nos temas claro e escuro.
- Toque e teclado: validação de serviço vazio; rascunhos preservados ao alternar entre 390 px e computador; salvar Serviço e Profissional na demonstração em 390/768/1024/1440 px; Escape fecha o popover de ícones nas versões que o usam. O seletor móvel continua embutido.
- Parceiro: edição e salvamento fictícios em 1024/1440 px, sem receber controles globais de folga. Os mesmos predicados de permissão continuam no formulário.
- Convites: quinze estados locais com token fictício, cobrindo as cinco situações em 390/1024/1440 px.

Nenhuma regra de cadastro, aceite, sociedade, autenticação ou permissão mudou. Mesmos textos, identidade, campos e dados. Nenhuma migration ou tarefa para TI. Os cenários não enviaram códigos, mensagens ou convites reais. Testes físicos/integrações reais seguem em P-42/P-43; avaliação estética do dono não é presumida. Evidências extensas locais: `/tmp/barba-p103/`.

## P-104 — responsividade da tela de acesso

O dono apontou que a tela de acesso não estava responsiva. Foram reproduzidos dois defeitos: no modelo dividido, um nome de barbearia longo fazia o título da foto ficar encoberto pelo formulário; no modelo imersivo, fonte base em 200% mantinha duas colunas sem espaço e colocava a apresentação atrás do cartão. Esta rodada corrige o acesso, sem declarar encerrada a revisão visual de todo o sistema.

| Situação                                           | Antes                                             | Depois                                              | Correção                                                                    |
| -------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------- |
| Nome longo, modelo dividido, 320 × 768 px          | [Antes](evidencias/p104/nome-longo-antes.png)     | [Depois](evidencias/p104/nome-longo-depois.png)     | A faixa cresce com o nome e mantém o título acima do formulário.            |
| Modelo imersivo, 1024 × 768 px, fonte base em 200% | [Antes](evidencias/p104/texto-ampliado-antes.png) | [Depois](evidencias/p104/texto-ampliado-depois.png) | Apresentação e formulário passam para uma coluna quando falta largura útil. |

As quatro imagens usam os mesmos dados fictícios e configurações em cada par. “Fonte base em 200%” significa ampliar a fonte raiz no navegador; não equivale a afirmar que foi testada toda configuração de zoom de cada sistema operacional.

### Composição e preservação

- **Foto e formulário:** a moldura passa a participar do leiaute também no celular. A foto acompanha a altura do conteúdo, em vez de deixar a apresentação absoluta sobre uma faixa fixa. No computador mantém a moldura em duas áreas quando cabe; no tablet e com texto ampliado, marca compacta acima da tarefa.
- **Foto imersiva e Cartão sobre foto:** largura de leitura controlada; o modelo imersivo abandona as duas colunas quando a largura relativa à fonte é insuficiente. O cartão continua centralizado. Telas baixas usam espaçamento vertical menor, preservando os controles e a rolagem.
- **Área estreita com texto ampliado:** idioma/tema ficam acima da marca; nome da loja pode quebrar linha; abas se empilham e recuperação de senha entra no fluxo quando necessário. O título promocional é omitido nessa condição extrema para priorizar marca e tarefa.
- **Limite entre celular e tablet:** o intervalo móvel passou a usar `width < 768px`, evitando uma lacuna em larguras fracionárias entre 767 e 768 px.
- **Prévia:** o acesso real e a prévia completa por dispositivo seguem o mesmo CSS. A miniatura móvel sem `.auth-entry-host` conserva o comportamento próprio.
- **Código:** composição do acesso centralizada em `src/styles/acesso.css`, importado por `dispositivos.css`; retiradas as regras correspondentes de `styles/publicas.css`. Sem alteração de componentes, autenticação, consultas, validações, dados, permissões, textos ou dicionários. Identidade, temas e tokens dos cantos preservados.

### Verificações e limites

- Tipos, 301 testes, Prettier e montagem de produção aprovados por `scripts/verificar.sh`. ESLint dispensado pelo script porque nenhum arquivo TS/TSX mudou.
- Montagem final aberta em 320/820/1366 px: 27 estados dos três modelos e etapas. Mais 18 estados com fonte base em 200% em 320/1024 px. Sem erros de página, rolagem lateral ou texto encoberto detectado.
- Teclado e cantos na montagem final: 18 combinações (três modelos × três cantos × 390/1366 px), incluindo tema escuro nos cantos arredondados. Raio de cartão/moldura conservado; foco por Tab visível e alcançável sem sobreposição.
- Três modelos × Entrar/Cadastrar/Recuperar; larguras de 320 a 1920 px, incluindo 480/640/767/768/820/1023/1024/1100/1366/1440; alturas de 600, 768, 844 e 900 px conforme o cenário.
- Nome longo, tema escuro e fonte base em 200%, incluindo celular de 320/390 px e tablet/PC de 768/1024/1366 px. Inspeção visual e medição de texto encoberto, rolagem lateral e erros de página.
- As três capturas de **Entrar em 390 × 900 px**, uma por modelo, permaneceram estritamente idênticas às referências anteriores (zero pixels diferentes). As correções móveis são para os casos que cortavam conteúdo.
- Redimensionamento com e-mail/senha preenchidos entre PC, tablet, celular e tela baixa: valores preservados e ação alcançável por rolagem. Cadastro vazio e recuperação conferidos; nenhuma conta criada ou mensagem enviada.
- Dezoito combinações com larguras fracionárias de 767 a 1024 px, sem lacuna na composição. Vinte e quatro estados de entrada em pt-PT, en-US, en-GB e espanhol; nenhum corte detectado.
- Editor de marca: três modelos × três dispositivos, mantendo a seleção ao voltar, sem envio de dados. Abertura/fechamento dos editores de catálogo também conferidos.

Cenários em Chrome local isolado, com respostas fictícias e rede externa bloqueada. Não foram testados Safari nem aparelhos físicos; P-42/P-43 continuam. Sem migration ou tarefa para TI. Evidências extensas locais: `/tmp/barba-p104/`.

## P-105 — Acessos da administração

O dono relatou partes quebradas e falta de responsividade na página de acesso do admin. A investigação desta rodada encontrou defeitos na aba **Acessos da plataforma**, distinta da tela de login corrigida na P-104: cartões de papéis sobrepostos na coluna lateral, seletor encobrindo o título com fonte ampliada, matriz comprimida e ações de gerentes cortadas na tabela.

| Situação                                   | Antes                                       | Depois                                        | Correção                                                                                        |
| ------------------------------------------ | ------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Acessos, 1920 × 800 px                     | [Antes](evidencias/p105/acessos-antes.png)  | [Depois](evidencias/p105/acessos-depois.png)  | A explicação lateral usa cartões inteiros, sem impor duas colunas dentro de uma faixa estreita. |
| Acessos, 1024 × 768 px, fonte base em 200% | [Antes](evidencias/p105/ampliado-antes.png) | [Depois](evidencias/p105/ampliado-depois.png) | Título e seletor ganham linhas próprias; matriz usa edição por papel quando não cabe.           |

Cada par usa os mesmos dados fictícios e configurações. A ampliação é da fonte raiz; não representa todos os modos de zoom dos sistemas operacionais.

**Retorno do dono em 29/10:** confirmou “resolvido” para Acessos. Essa confirmação é desta aba, sem presumir encerrada a revisão do sistema.

### Correções

- **Papéis e barbearia:** grade de cartões pela largura disponível, tanto na faixa horizontal quanto na lateral do monitor. Rótulos podem quebrar linha; título e seletor se reorganizam pela largura relativa à fonte. Nome longo de loja não impõe largura ao campo.
- **Matriz:** `ShopPermissionsMatrix` decide entre tabela e edição por papel pelo próprio espaço, considerando a fonte e a coluna do papel legado. A comparação recolhida segue o mesmo critério. Trocar a composição conserva a matriz e suas escolhas.
- **Alterações não salvas:** botões em linhas próprias quando necessário; em área extremamente estreita, a barra participa da rolagem para não cobrir o conteúdo. Mesmos estados, ações e confirmação de salvamento.
- **Gerentes de conta:** cartões com largura limitada ao espaço recebido e ações reposicionadas em áreas estreitas. A tabela passa a ter colunas proporcionais e só aparece com largura útil suficiente, evitando o botão de remover fora da área visível. Confirmação de remoção preservada.
- **Implementação compartilhada:** `use-container-width.ts` mede largura em rem e acompanha redimensionamento, fonte e troca do elemento. Usado apenas na matriz e nos gerentes; não altera os pontos de quebra globais do sistema. CSS em `styles/plataforma.css` e `styles/leiaute.css`.

### Validação e limites

- `scripts/verificar.sh`: tipos, 301 testes, ESLint dos quatro arquivos TS/TSX alterados, Prettier e montagem de produção aprovados.
- Montagem final: cinco cenários completos na rota administrativa em 320/1024/1920 px e em 768/1366 px com fonte base em 200%, com os três cantos e tema escuro. Erros de carregar e salvar simulados no computador, seguidos de nova tentativa; escolha preservada. Sem erro de página ou rolagem lateral nos fluxos finais.
- Acessos em 320/390/768/1024/1366/1536/1920 px; fonte base em 200% em celular, tablet e computador. Sem rolagem horizontal nos cenários finais conferidos.
- Início de Acessos em 320 e 390 × 800 px: duas capturas estritamente idênticas às referências anteriores. As correções móveis alcançam os casos de corte e os estados de edição.
- Rota administrativa real `/platform?aba=acessos` com respostas locais fictícias: nomes longos de loja e gerente, dois vínculos, três modos de canto e tema escuro. Edição por teclado, rascunho preservado entre 390/1024/1920 px, salvar, trocar loja e abrir/fechar a confirmação de remoção. Nenhum vínculo real foi removido.
- Texto ampliado: repetido o fluxo com escolhas não salvas, redimensionamento, botões de salvar/descartar e gerentes. Nenhuma permissão real foi gravada.
- Matriz compartilhada em Ajustes → Equipe e sociedade → Pessoas e papéis conferida em celular e computador. Editor da tela de entrada aberto pelo admin também inspecionado em 390/768/1024/1366 px, sem alteração nesta rodada.

Mesmas cores, fontes, superfícies, ícones e tokens dos três cantos; nenhum texto, papel, bloqueio de permissão, consulta ou regra de negócio foi alterado. Sem migration ou tarefa para TI. Navegador Chrome isolado com rede externa bloqueada; testes físicos/Safari e integrações reais continuam em P-42/P-43. Não representa encerramento da revisão de todo o sistema. Evidências extensas locais: `/tmp/barba-p105/`.

## P-106 — Barbearias, ficha e janelas do admin

Após o dono confirmar Acessos como resolvido e autorizar a próxima etapa, a revisão seguiu para **Admin → Barbearias**. Foram reproduzidos: coluna do nome praticamente sem largura com texto ampliado, cabeçalho encoberto pelos controles, ficha comprimida ao lado da lista e ficha reaparecendo sobre o convite ao voltar do PC para o celular.

| Situação                                      | Antes                                         | Depois                                          |
| --------------------------------------------- | --------------------------------------------- | ----------------------------------------------- |
| Barbearias, 1536 × 768 px, fonte base em 200% | [Antes](evidencias/p106/barbearias-antes.png) | [Depois](evidencias/p106/barbearias-depois.png) |

Mesmo estado e dados fictícios em cada imagem. A fonte raiz foi ampliada; não é uma afirmação sobre todos os modos de zoom de cada sistema.

### Organização e continuidade

- **Lista:** `ShopsPanel` reutiliza `useContainerWidth`; a tabela continua desde 1024 px quando há pelo menos 48rem de largura própria. Abaixo disso, os cartões existentes mantêm os nomes e os indicadores legíveis. Título, busca, filtros e ação principal cedem para linhas próprias conforme a largura útil.
- **Ficha:** permanece montada ao mudar a fonte dentro da faixa de computador; quando falta espaço para duas áreas, fica abaixo da lista. No celular/tablet em pé continua em janela. Corpo da ficha, indicadores e ações ajustados também para texto muito ampliado em área estreita.
- **Uma tarefa por vez:** ao abrir convite, personalização ou outra tarefa da ficha no celular/tablet, a ficha deixa de disputar a camada de janela. A loja permanece selecionada; ao fechar a tarefa, a ficha volta. Isso evita que a ficha se monte por cima do convite quando a largura retorna ao celular.
- **Foco e rascunhos:** a ficha não toma o foco da tarefa aberta. O retorno do índice considera tanto a linha da tabela quanto o cartão selecionado. Busca, loja selecionada e dados de nome/e-mail nos formulários são conservados nas transições conferidas.
- **Código:** `ShopsPanel.tsx`, `ShopDetail.tsx`, coordenação de janelas em `PlatformShell.tsx` e CSS em `styles/plataforma.css`. Mesmos componentes de dados e formulários, textos, temas, cantos, cores, consultas, regras, contratos e permissões.

### Verificações e limites

- `scripts/verificar.sh`: tipos, 301 testes, ESLint dos três arquivos TSX alterados, Prettier e montagem de produção aprovados.
- Montagem final: seis fluxos completos em 390/768/1024/1920 px, mais fonte base em 200% em 1024 e 320 px. Busca, filtros, ordenação quando há tabela, seleção, ficha, campos de convite/criação e retorno de foco aprovados. Nenhuma criação ou envio executado.
- Lista/ficha em 390/1024/1920 px; fonte base em 200% em 320/1024/1536 px; fluxos adicionais em 768 px e três modos de canto, incluindo tema escuro.
- Duas capturas móveis padrão em 390 × 800 px — lista e ficha — estritamente idênticas às anteriores. Os ajustes móveis alcançam cortes e a disputa entre janelas durante tarefas.
- Busca, limpar busca, filtro de suspensas, ordenação por nome quando há tabela, seleção por teclado, rolagem até as ações e retorno à lista com respostas fictícias na rota administrativa real.
- Convite e nova barbearia: campos preenchidos preservados ao alternar entre 390 e 1024 px e voltar; ação de criar alcançável por rolagem. Nenhuma criação ou envio foi executado. A ficha continuou selecionada; troca da fonte não desmontou seu conteúdo no computador.
- Personalização aberta pela ficha em 390/768/1024 px com uma janela de tarefa ativa. Modelos e regras da edição permanecem os existentes.

Validação em Chrome isolado, com rede externa bloqueada e dados fictícios. Sem migration ou tarefa para TI; nenhum convite, conta ou barbearia real criado. Testes físicos/Safari e integrações reais continuam em P-42/P-43. Não encerra a revisão de todo o sistema. Evidências extensas locais: `/tmp/barba-p106/`.

## P-107 — Relatórios do admin pela largura útil (30/10/2026)

Continuação autorizada da revisão em **Admin → Relatórios**, após Barbearias. A P-101 já organizava essa página; esta rodada corrige falhas reproduzidas sem refazer os dados ou as regras: tabela de privacidade cortava a situação e a ação em 1024 px; indicadores e questionários se comprimiam com fonte ampliada; mensagens e detalhes podiam ultrapassar a área estreita.

| Situação                                       | Antes                                          | Depois                                           |
| ---------------------------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| Indicadores, 1024 × 768 px, fonte base em 200% | [Antes](evidencias/p107/indicadores-antes.png) | [Depois](evidencias/p107/indicadores-depois.png) |
| Privacidade, 1024 × 820 px, fonte padrão       | [Antes](evidencias/p107/privacidade-antes.png) | [Depois](evidencias/p107/privacidade-depois.png) |

Dados fictícios. As comparações mantêm a mesma largura, altura e preferência de fonte em cada par. Fonte raiz ampliada não equivale a testar todos os modos de zoom dos sistemas operacionais.

### Composição e comportamento

- **Computador:** indicadores conservam a faixa única quando recebem pelo menos 60rem de área útil. Abaixo disso, cedem para linhas legíveis; o valor dos concluídos ocupa a largura necessária. Questionários e privacidade ficam lado a lado quando a página recebe 64rem, e se empilham antes disso.
- **Tablet e texto ampliado:** lista e prévia do questionário só dividem a área com 36rem no próprio cartão. A prévia fica abaixo quando falta espaço; a seleção permanece ao redimensionar. Opções, títulos e conteúdos expansíveis se reorganizam em áreas extremas.
- **Privacidade:** `DataRights` reutiliza `useContainerWidth`; a tabela requer 48rem de largura própria, com colunas fixas e espaço para situação/ação. Em painéis estreitos, usa os cartões existentes. Atualizar, iniciar análise e os avisos de resultado permanecem acessíveis. A área de dados da conta do cliente e o catálogo compacto não receberam mudança visual.
- **Celular:** captura inicial de Relatórios em 390 × 768 px estritamente idêntica à anterior. As alterações móveis corrigem cortes com texto ampliado; cores, tipografia, superfícies, ícones e três modos de canto permanecem os mesmos.
- **Escopo:** CSS em `styles/plataforma.css`, classes de composição em `BusinessInsights`/`SurveyCatalog`, largura da tabela administrativa em `DataRights` e comentário atualizado em `PlatformShell`. Mesmas consultas, cálculos, perguntas, idiomas, permissões e regras de privacidade. Nenhum texto novo ou migration.

### Verificações e limites

- `scripts/verificar.sh`: tipos, 301 testes, ESLint dos quatro arquivos TSX alterados, Prettier e montagem de produção.
- Montagem final: sete fluxos da rota administrativa real com respostas fictícias, todos aprovados: oito temas por teclado, prévia, seleção preservada ao alternar 390/1024/1920 px, conteúdos expansíveis, atualizar indicadores e nova tentativa após falha.
- Pedidos fictícios com identificadores longos: falha na ação sem remover o pedido, nova tentativa, mudança para análise, erro ao consultar e atualização posterior. Nenhuma solicitação real foi alterada.
- Cenários em 390/768/1024/1440/1920 px, cantos retos/semi arredondados/arredondados e tema escuro; texto base em 200% em 320 e 1024 px. Sem corte interno, rolagem horizontal ou erro de página nos fluxos finais.
- Capturas adicionais em 320/640/767/800/1100/1280/1366 px; texto base em 200% em 320/640/768/1024/1536 px. Inspeção visual dos painéis e comparação móvel sem tolerância.

Chrome isolado com rede externa bloqueada. Evidências extensas locais em `/tmp/barba-p107/`. Sem tarefa de implantação para TI. Aparelhos físicos/Safari e integrações reais continuam em P-42/P-43; esta etapa não declara encerrada a revisão geral nem aprovada a experiência pelo dono.
