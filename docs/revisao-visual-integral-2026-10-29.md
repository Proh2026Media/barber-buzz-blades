# Revisão visual integral — P-101 (29/10/2026)

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
