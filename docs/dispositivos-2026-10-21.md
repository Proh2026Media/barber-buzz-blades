# Interface por dispositivo — plano e decisões (21/10/2026)

Pedido do dono (21/10/2026): "melhorar a interface, não deixando adaptado para pc/tablet o que é do mobile, e sim feito especialmente para cada dispositivo". Este documento registra o diagnóstico (mapa de 190 telas feito por leitura do código e por fotos em 390, 768, 1024, 1280 e 1536 px), as decisões tomadas e o que entra nesta entrega. Diretrizes gerais continuam em [mb-interface.md](mb-interface.md); o que aqui muda a seção 3 dela está marcado.

## 1. Diagnóstico em uma frase

Hoje não existe uma noção única de "dispositivo": o CSS muda a navegação em 1024 px, o JavaScript decide menus em 768 px, a entrada usa 761 px, e entre 768 e 1023 px (tablet em pé) nada muda em relação ao celular além da largura. A coluna lateral de 16/10 é o mesmo `<nav>` do celular reposicionado por CSS; o conteúdo de todas as abas continua uma coluna de celular (lista de cartões altos, formulários empilhados, janelas de 512 px com rolagem interna) colocada no meio do monitor.

## 2. Faixas oficiais (decisão)

Uma só fonte para CSS e JavaScript, com os mesmos números:

| Faixa             | Largura       | Navegação                                                  | Pensada para                           |
| ----------------- | ------------- | ---------------------------------------------------------- | -------------------------------------- |
| **celular**       | até 767 px    | barra flutuante no pé (como hoje; nada muda abaixo de 768) | iPhone e Android, uma mão              |
| **tablet**        | 768 a 1279 px | **coluna estreita** à esquerda (ícone sobre o nome, 6rem)  | iPad em pé e deitado, notebook pequeno |
| **computador**    | 1280 px ou +  | coluna lateral completa (ícone e nome, 14.5rem)            | monitor e notebook                     |
| **monitor largo** | 1536 px ou +  | igual ao computador, larguras de leitura maiores           | monitores grandes                      |

- No JavaScript: `useDevice()` em `src/lib/device.ts` devolve `"celular" | "tablet" | "computador"` (sem piscar: `useSyncExternalStore`, valor do servidor "celular") e `data-dispositivo` fica no `<html>` antes da hidratação. Substitui `useIsMobile`, `useDesktop`, `useWideLayout` e os `matchMedia` soltos (AgendaTab, board, ShopsPanel, LoginPreviewDialog).
- No Tailwind: variantes `tablet:` (≥ 768) e `pc:` (≥ 1280) declaradas no `@theme` de `src/styles.css`; `lg:` (1024) continua para o "computador compacto" dentro da faixa do tablet. Ponteiro: variante `pointer-fine:` para alvos de 40 px onde há mouse; o toque continua com 44 px.
- Toque × mouse: decidido por largura (consistente com o CSS). Só tamanhos de alvo e barras de rolagem olham `pointer: fine`.
- Isto muda a decisão de 16/10 ("tablet em pé = barra de baixo"): o tablet passa a ter coluna estreita, que é o padrão de tablet (navigation rail) e libera o pé da tela. É uma faixa de CSS; reverter é trivial.

## 3. Esqueleto por faixa

- **Celular:** inalterado.
- **Tablet (768–1279):** grade `coluna estreita | conteúdo`; cabeçalho de ponta a ponta; conteúdo encosta na coluna com 1.5rem de recuo e usa a largura toda (sem limite de leitura); janelas centralizadas (nunca folha inferior); o `⋯` abre menu suspenso.
- **Computador (≥ 1280):** grade `coluna completa | conteúdo`; larguras de leitura por aba (`--app-read-width`): leitura 60rem, Agenda/Horários/Serviços/Equipe/Ajustes/plataforma/cliente-largo 80rem; a 1536+ um pouco mais. A borda esquerda do conteúdo é a mesma em todas as abas (decisão de 16/10 mantida).
- Avisos rápidos (toast) e o banner do PWA ficam no canto inferior direito no computador.

## 4. Invólucros por tipo de tarefa (decisão)

| Tarefa                                                                            | Celular                        | Tablet e computador                                                                                                                                                                             |
| --------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decisão curta (confirmar, cancelar, motivo)                                       | janela centrada (como hoje)    | janela centrada `size="sm"` (28rem) ou `"md"` (32rem)                                                                                                                                           |
| Editar um item (serviço, profissional, bloqueio, horário do dia, agendar cliente) | janela (como hoje)             | janela `size="lg"` (44rem) ou `"xl"` (60rem) com corpo em duas colunas (`DialogBody layout="split"`): campos à esquerda, resumo ou prévia fixa à direita; sem rolagem interna sempre que couber |
| Editor extenso (identidade visual, página da barbearia)                           | janela quase cheia (como hoje) | `size="page"`: quase tela cheia, etapas e campos à esquerda, prévia à direita                                                                                                                   |

`DialogContent` ganha a propriedade `size` (`sm | md | lg | xl | page`; padrão `md` = comportamento atual). `DialogBody` e `DialogActions` padronizam corpo rolável e rodapé fixo. Cabeçalho sempre à esquerda.

## 5. Primitivas novas (em `src/components/visual/`)

- `CardGrid` — grade de cartões `repeat(auto-fill, minmax(min, 1fr))`, `min` padrão 18rem; vira coluna única no celular.
- `MasterDetail` — lista à esquerda (20rem; 22rem no computador) e detalhe à direita a partir de 1024 px; abaixo disso, lista ou detalhe (mesmo `?secao=`/`?item=` de hoje).
- `FormGrid` — campos em 2 colunas a partir de 640 px e 3 quando indicado; `Field` aceita `width="sm|md|lg"` para não esticar CEP e preço.
- `DataList` — mesmas colunas definidas uma vez: cartões rotulados no celular, tabela com cabeçalho fixo e linha clicável a partir de 1024 px.
- `SplitLayout` — conteúdo + `aside` fixo (sticky) para resumos ("Seu dia", "Assim o cliente vê", resumo do Agendar).

## 6. O que entra nesta entrega, por área

Ordem de ganho. Tudo abaixo vale para tablet e computador; o celular não muda.

1. **Base:** `useDevice`, variantes `tablet:`/`pc:`/`pointer-fine:`, três faixas do esqueleto, coluna estreita, larguras de leitura, `Dialog` com `size`, primitivas da seção 5, toasts e banner no canto, `:hover` manuais protegidos por `@media (hover: hover)`.
2. **Cascas:** ShopShell, ArenaApp e PlatformShell com a coluna estreita (ícone sobre nome) e a completa; a medição de rótulos da barra do cliente desligada fora do celular pelo `useDevice`; faixa da demonstração compacta no computador.
3. **Agenda (painel):** no tablet em pé, "Seu dia" vira faixa de números numa linha e a lista ocupa a largura; no tablet deitado e no computador, duas colunas com a coluna do dia mais estreita (22rem) e o calendário do mês à vista; cabeçalho da lista numa linha (busca, filtro por profissional, atendimentos · N); cartão de atendimento em linha compacta (hora · cliente · serviço · ações ao passar o mouse) com o cartão completo ao abrir; quadro da equipe com cabeçalho de profissionais e disponível desde 1024 px; "Agendar cliente" em janela `xl` de duas colunas com o resumo fixo; "Clientes da barbearia" como tabela (`DataList`).
4. **Serviços e Equipe:** `CardGrid` (3–4 colunas); modo lista vira tabela (`DataList`) a partir de 1024 px; título, busca, filtros e botão principal numa linha; janelas de serviço e profissional em `lg` com prévia ao lado; seletor de ícones sem rolagem aninhada.
5. **Horários:** as três partes (semana, bloqueios, "assim seus clientes veem") numa grade que se encaixa; semana como tabela de 7 linhas compacta no computador com edição em popover ao lado da linha; bloqueios em duas semanas; janela "Bloquear um horário" em `lg` com a barra do dia à vista.
6. **Ajustes:** mestre-detalhe a partir de 1024 px (lista de assuntos à esquerda, ajuste aberto à direita, mesma URL); dentro de Agendamento, campo e prévia lado a lado (`SplitLayout`); Avisos e integrações com WhatsApp e Google lado a lado; Equipe e sociedade com pessoas e permissões em tabela.
7. **Cliente:** Início em duas colunas reais (próximo horário e pendências | cartão de membro e pontos); Agendar no computador com serviço e profissional lado a lado, calendário do mês no lugar da faixa de dias, grade de horários com colunas pela largura e resumo fixo à direita (o passo "Conferir" não repete o resumo); Meus agendamentos em duas colunas (próximos | anteriores); Pontos com cartão, prêmios e extrato na mesma tela; Conta com índice lateral desde 768 px.
8. **Plataforma:** barbearias como tabela ordenável com a ficha ao lado (tablet em pé: ficha em janela centrada, não folha); Acessos como matriz completa; Início com indicadores em grade de 4 e blocos lado a lado; relatórios em colunas.
9. **Páginas públicas e entrada:** página da barbearia em duas colunas desde 768 px; entrada com o ponto de quebra alinhado a 768.

## 7. Regras para quem implementa

- **Abaixo de 768 px nada muda.** Toda regra nova fica dentro de `tablet:`/`pc:`/`lg:`/`@media (min-width: 768px)`. Fotos em 390 px antes e depois precisam ser iguais (salvo correção de defeito).
- `src/styles.css` fica fora de `@layer` e vence utilitários Tailwind; a regra global de 44 px/13 px dos botões (linhas 463–470) e os `!important` de cantos (1927–1961) também. Tamanhos por ponteiro entram no mesmo CSS. Cada área escreve seu CSS em `src/styles/<area>.css`, importado pelo componente principal da área (carrega depois do `styles.css`, então vence em igualdade de especificidade).
- Três modos de canto (`--control-radius`, `--panel-radius`, `--button-radius`) e dois temas em tudo que é novo; cartões off-white; uma ação principal por contexto; mostrar em vez de explicar.
- Texto novo de interface só pelo dicionário (`src/lib/i18n/messages/*.ts`, cinco idiomas). Mudança de leiaute quase nunca precisa de texto novo: preferir não criar.
- Fotografar com `node scripts/foto.mjs` em 390, 768, 1024, 1280 e 1536 px, claro e escuro, antes de dizer que ficou pronto.
- `scripts/verificar.sh --sem-build` depois de cada área; a montagem completa no fim.

## 8. Fica para depois (registrado em pendências)

- Cabeçalho em três zonas no computador (título da aba e ação principal no cabeçalho).
- Prévias por aparelho nos editores (moldura de tablet, alternador celular/tablet/computador).
- Painel lateral direito (sheet) para o detalhe do atendimento sem sair da agenda.
- Apagar os restos do shadcn sem uso (`sidebar`, `drawer`, `sheet`, `DurationPicker`, menus) e unificar `ui/button` com `.action-button`.
- Clube de pontos (`/shop/pontos`) dentro da casca do painel com a coluna lateral.
- Folha inferior padronizada no celular para tarefas longas (hoje janelas), que é mudança de celular e não entra neste pedido.

## 9. O que foi feito (22/10/2026)

Entrega concluída em 22/10/2026 de madrugada pelo Claude Code (aplicativo); publicação no fim da sessão. Registro completo na entrada de 22/10 do [CONTINUIDADE.md](CONTINUIDADE.md); regras incorporadas a [mb-interface.md](mb-interface.md), seção 3, e a [guia/arquitetura.md](guia/arquitetura.md), seção 8 ("Dispositivos"). Números que mudaram em relação ao plano: a coluna estreita do tablet ficou com **6rem** (a tabela da seção 2 já diz 6rem; 5.5rem quebrava "Agendamentos"/"Appointments" com hífen); avisos rápidos e o banner do PWA vão para o canto inferior direito **já a partir do tablet**, não só no computador.

- **Base (seção 6, item 1):** tudo feito — `src/lib/device.ts` (`useDevice`, `useViewportAtLeast`, `data-dispositivo`), variantes `tablet:`/`pc:`/`pointer-fine:`/`pointer-coarse:`, três faixas da casca com a coluna estreita e a completa, larguras de leitura, `Dialog` com `size` + `DialogBody`/`DialogAside`/`DialogActions`, as cinco primitivas da seção 5 (CSS em `src/styles/leiaute.css`), `src/dispositivos.css` importando os CSS de área, toasts e banner no canto, `useStickyWhenFits`; `/auth` alinhado a 768 (eram 761/760); `src/components/ui/sidebar.tsx` apagado. `useIsMobile` sumiu; `useDesktop` (Agenda) e `useWideLayout` (plataforma) ficaram como embrulhos de `useViewportAtLeast(1024)` (P-88).
- **Cascas (item 2):** feitas nas três (ShopShell, ArenaApp, PlatformShell); medição de rótulos só no celular; faixa da demonstração compacta no computador.
- **Agenda (item 3):** feito, com uma diferença: a linha única do cartão (hora · cliente · serviço · selos · ação) só aparece quando a lista tem ≥ 52rem (a partir de ~1536 px com a coluna do dia de 22rem); em 1280 fica o cartão de 2 linhas com a ação à direita. O quadro da equipe valeu a partir de 1024 nesta entrega; na manhã de 22/10 a P-79 o levou ao tablet em pé (desde 768) e recolheu a coluna do dia em 1024–1279 para quatro profissionais caberem sem rolar. "Mais números do dia" como tiles no computador não entrou (P-81). "Clientes da barbearia" em tabela só para a lista da barbearia; a carteira do parceiro volta aos cartões (coluna de meia largura).
- **Serviços e Equipe (item 4):** feito; a tabela do modo lista não ordena (P-80) e só o nome abre a edição; a barra em uma linha é CSS por cima do `CatalogFilters` (P-89).
- **Horários (item 5):** feito, menos o popover por linha do dia (a semana compacta edita pela janela do dia, como combinado) e a Pausa fixa (P-87). A tabela de 7 linhas vale a partir de 1280 (em 1024 ficava apertada).
- **Ajustes (item 6):** feito; o campo | prévia só divide quando o cartão tem 38rem (1536 dentro do mestre-detalhe com trilho; P-92). Pessoas de Equipe e sociedade em tabela a partir de 1024.
- **Cliente (item 7):** feito; Serviço e Profissional lado a lado a partir de 1280 (em 1024–1279 ficavam apertados); Meus agendamentos em grade de tickets com coluna lateral, não "próximos | anteriores" simultâneos (exigiria duplicar o filtro); o tablet em pé ainda tem os passos recolhidos e a faixa de dias (P-90).
- **Plataforma (item 8):** feito; Relatórios empilhados na largura toda (a coluna lateral ficava vazia) com os pedidos de privacidade em tabela; a matriz de Acessos continua um papel por vez (P-86); a tabela de barbearias não ordena (P-80).
- **Páginas públicas e entrada (item 9):** feito.
- **Verificação (seção 7):** fotos de 390 antes e depois iguais pixel a pixel (`scripts/comparar-png.mjs`) ou diferentes só nos dados aleatórios da demonstração; revisor por área; correções cruzadas; QA visual com 27 achados (24 corrigidos; 3 baixos em P-90 e P-94); `verificar.sh --sem-build` a cada passo e montagem completa no fim.

**O que ficou (seção 8 e o que apareceu no caminho), com os ids de [guia/pendencias.md](guia/pendencias.md), seção 9:** quadro da equipe no tablet (P-79) · ordenação e busca por WhatsApp nas tabelas (P-80) · "Mais números do dia" em tiles (P-81) · prévias por aparelho nos editores (P-82) · cabeçalho em três zonas (P-83) · painel lateral do atendimento (P-84) · Clube de pontos na casca (P-85) · matriz de Acessos editável (P-86) · Pausa fixa (P-87) · restos do shadcn e hooks antigos (P-88) · `CatalogFilters` com modo linha (P-89) · Agendar do cliente no tablet em pé (P-90) · telas que a demonstração não mostra (P-91) · lado a lado só em 1536 em Ajustes e Relatórios (P-92) · `--landing` no `foto.mjs` (P-93) · restos visuais pequenos (P-94) · folha inferior no celular, decisão do dono (P-95). Falta o teste do dono no tablet e no computador (P-43).

## 10. Revisão geral solicitada pelo dono (24/10/2026, P-96/P-92)

O dono pediu uma composição própria para computador e tablet em todo o aplicativo, preservando a experiência móvel e a identidade. Esta revisão continua as entregas já aplicadas; as seções anteriores são histórico, não instrução para refazê-las.

| Área                          | Resultado da revisão                                                                                                                                                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navegação, cabeçalhos e ações | Mantidas as três cascas e os cabeçalhos contextuais existentes. Ajustes ganha índice secundário mais compacto (13rem). Sem mudança da navegação do celular.                                                                                                                                       |
| Agenda e atendimento          | Mantidos quadro da equipe, painel do dia, diretório e detalhe lateral já entregues. Revisados junto dos perfis dono, parceiro, contratado e sócio.                                                                                                                                                |
| Serviços e Equipe             | Mantidas tabela, filtros, ordenação e formulários responsivos. Equipe usa a largura completa; acesso ao painel fica no atalho compacto após a lista, sem reservar lateral para um único botão.                                                                                                    |
| Horários                      | Semana/prévia e bloqueios/pausas em duas colunas independentes desde 1024, sem espaços verticais impostos pelo bloco vizinho. Pausa fixa usa janela ampla desde 768, campos em duas colunas, corpo rolável e rodapé acessível; original móvel preservado.                                         |
| Ajustes                       | Subíndice de Agendamento acima do formulário em 1024–1535 e lateral desde 1536. Campo/prévia pela largura real do cartão (35rem), integrações com mínimo de 21rem e escolhas do Google ajustadas ao contêiner.                                                                                    |
| Clube de pontos               | Regras e pontuação agrupadas à esquerda, níveis à direita quando há 42rem úteis. Abas, ações, RPCs e permissões conservadas.                                                                                                                                                                      |
| Cliente                       | Serviço/profissional lado a lado desde 768; calendário/horários aproveitam a largura do tablet; revisão na lateral só desde 1280. Calendário com 44 px no tablet/toque. Perfil com índice de 18rem desde 1024. Início, pontos, agendamentos e esportes mantêm as composições próprias existentes. |
| Plataforma                    | Matriz de Acessos em largura completa até 1535; explicação lateral somente em monitor largo. Colunas da matriz se adaptam ao espaço útil. Barbearias não reserva uma ficha vazia antes da seleção. Relatórios comparáveis se distribuem pela largura.                                             |
| Páginas públicas e entrada    | Revisadas página da loja, entrada, cadastro, convite e páginas de termos/privacidade. Mantidas as composições responsivas existentes.                                                                                                                                                             |
| Editores, janelas e mensagens | Conferidos editores de marca/página, serviço, profissional, ficha, nova loja e pausa. Mantidos componentes compartilhados, superfícies, cores de ação, foco, rodapé e modos de canto.                                                                                                             |

**Validação:** navegador Chromium local, com rede de dados substituída por fixtures/demonstração. Matriz principal de 20 telas em 390, 768, 1024, 1280 e 1536 px; formulários, perfis e páginas públicas em tablet claro e computador escuro. Conferências complementares em 900 e 1180 px, tablet deitado 1024 × 768 e janela em 1280 × 600. Capturas que coincidiram com carregamento/recarregamento do servidor foram repetidas; não são evidência de tela final.

**Celular:** comparação de 20 capturas em 390 px com a versão anterior, relógio e sorteio fixos: 15 idênticas pixel a pixel; nas outras cinco, 38 a 731 pixels diferentes em 351.000, sem mudança de composição observada. O formulário móvel da pausa continua no cartão e a ordem de Horários é preservada.

**Interação:** rascunhos de Pausa fixa e Ajustes preservados ao cruzar pontos de quebra; pausa salva na demonstração, descarte de ajuste funcionando. Serviço/profissional/horário de reserva preservados em 768 → 390 → 1024 → 1280, reserva fictícia concluída. Tab/Shift+Tab dentro das janelas e Esc; rodapé da pausa acessível em 600 px de altura. Dia do calendário medido em 44 × 44 px no tablet com toque. Janela/botões conferidos nos dois temas e três cantos: 0/0, 21,6/14,4 e 32/999 px.

Evidências temporárias em `/tmp/barba-dispositivos`, fora do repositório. As capturas válidas não apontaram rolagem horizontal da página, elementos fora da tela ou exceções JavaScript. Isso não equivale a testar todas as combinações de dados/estados, aparelhos físicos ou integrações reais. P-42/P-43 continuam abertas; P-95, que mudaria o celular, não foi incluída. Nenhuma migration, nova regra de negócio ou tarefa para o agente da VPS.
