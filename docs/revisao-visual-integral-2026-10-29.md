# Revisão visual integral — P-101 e P-102 (29/10/2026)

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
