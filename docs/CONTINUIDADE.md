# Transição para a próxima IA — Barba & Cabelo

**16/10/2026 (madrugada) — entrega do Claude Code:** agendamento pelo barbeiro no painel, apelido e cliente do balcão, selo de cliente recorrente, login Google no app instalado e simplificação visual (entrada logo abaixo da Diretriz). Falta aplicar no banco as migrations nº 95 e 96 (P-73, pacote [implantacao-agendamento-painel-2026-10-16.md](implantacao-agendamento-painel-2026-10-16.md)).

**15/10/2026 (noite) — passagem concluída no Claude Code:** ver a entrada "Passagem de 15/10" logo abaixo da Diretriz. Comece por [LEIA-PRIMEIRO.md](LEIA-PRIMEIRO.md). A função `register-shop` da P-38 foi publicada às 22:54; faltam os pacotes do Google (P-69 e P-28, em [pacotes/](pacotes/)).

Atualizado em **16/10/2026**. Este documento resume decisões e entregas da conversa anterior; conferir o código antes de alterar comportamentos.

## Comece aqui

1. **Comece por [LEIA-PRIMEIRO.md](LEIA-PRIMEIRO.md)**: regras de trabalho e roteiro pelo guia em [guia/](guia/). Este arquivo é o diário detalhado de cada entrega, para consulta; os itens abaixo são de 03/10.
2. Inspecionar `git status` e os arquivos relevantes ao próximo pedido. O workspace tem muitas alterações e arquivos não rastreados que compõem o aplicativo; **não descartar nem sobrescrever esse trabalho**.
3. Para retomar localmente, usar `npm run dev -- --host 0.0.0.0 --port 8080`. O endereço esperado é `http://localhost:8080`.
4. Continuar a partir do próximo pedido do usuário.

## Diretriz — interface visual e autoexplicativa (05/10, dono) — ondas 1 e 2 feitas

O dono pediu que o sistema fique muito mais visual, intuitivo e com menos texto técnico (registrado em `docs/mb-interface.md`, seção 4, "Mostrar em vez de explicar", e em `AGENTS.md`). **Onda 1 (feita):** "Como os horários aparecem" redesenhado — cartões de modo com pílulas de horário de exemplo, intervalo e folga como botões em vez de listas, mini agenda ilustrada ("já marcado", "folga", "pode começar"), dicas com ícones, resultado do salvamento com ícone e cor; o parágrafo técnico "Como isso vira horário para o cliente" em Serviços e Horários virou o resumo visual "Assim seus clientes veem os horários" (selos + pílulas + botão Mudar). Textos encurtados nos 5 idiomas; chaves antigas removidas.

**Fundação da rodada 3 (feita):** componentes visuais comuns em `src/components/visual/` (import único `@/components/visual`): selo de estado, aviso e resultado de ação, escolha em pílulas e em cartões, cartão de número, etapas, mini agenda, barra dividida, prazo, janela de decisão, menu "⋯", barra de mudanças não salvas, campo com erro, copiar/enviar, avatar, linha de ajuste, lista de atenção, carregando e vazio ampliado. Cores de estado só pelos tons `--tone-*` de `src/styles.css` (claro, escuro e cartão off-white com AA); avisos rápidos com ícone e faixa por tipo; borda vermelha pelo `aria-invalid`; textos próprios nas chaves `visual.*`. `SlotModeSettings.tsx` é o modelo montado só com eles. Lista, regras e exemplos: `docs/mb-interface.md`, seção 4, "Componentes visuais comuns".

**Onda 2 (feita, 07/10, Claude Code):** redesenho de todo o sistema com a fundação acima, em 12 áreas, cada uma com diagnóstico, implementação, revisão cética e ajuste, e depois uma revisão de consistência geral. Só interface: não mudou banco, migrations nem regras de permissão.

- **Painel:**
  - Agenda: linha do tempo com "Agora" e "Próximo", "Seu dia" com barra e filtros, um botão principal por atendimento e menu "⋯", faixa de 7 dias.
  - Serviços e Equipe: cartões com selo Visível/Pausado e interruptor com rótulo, prévia antes de excluir, avisos junto do botão.
  - Horários: selo "Aberta agora", "Sua semana" em barras numa régua comum, bloqueios desenhados por dia, bloqueio em janela guiada.
- **Ajustes:**
  - Menu mostra o estado atual de cada item com selos.
  - Aparência e domínio menos técnicos.
  - Agendamento, avisos e pontos com escolhas em pílulas, estado das conexões e confirmação antes de desconectar.
  - Equipe e sociedade com pedidos legíveis e quem aprova.
- **Cliente:**
  - Início começa pelo próximo horário (Hoje, "em 1 hora", Remarcar).
  - Agendar como passo a passo com resumo sempre visível.
  - Reservas com selos de estado.
  - Conta enxuta.
- **Plataforma:** visão geral com números e barra de estados, acessos com mapa único de papéis.
- **Entrada e páginas públicas:** formulários mais curtos, etapas visíveis, página da barbearia com horários em pílulas.
- **Consistência:**
  - Título de página único (ícone dourado + título).
  - Mesmo estado sempre com a mesma cor e ícone: "Agora" dourado com tesoura, "Confirmado" azul, "Verificado" para o WhatsApp.
  - Ícones de papel num só mapa (`src/features/demo/roles.ts` usa o `ROLE_META` de `src/features/shop/roles.tsx`); "Sócio" da demo virou "Dono (sócio)".

Novos testes em `src/features/shop/{agenda,catalog,hours,settings}/*.test.ts` (192 testes no total).

**Onda 3 (feita, 08/10, Claude Code): pendências da onda 2 que não dependiam do dono nem do banco.** 6 frentes, cada uma com implementação, revisão cética e ajuste, depois limpeza e revisão final. Só interface.

- **Componentes comuns:**
  - `CopyField`: opção `share={false}`, usada nos valores de DNS; quebra o texto só depois de `/ . - _ ? & = # @ :`.
  - `ConfirmDialog`: mostra o erro detalhado já na 1ª falha.
  - `Steps`: variante `static`, para "como funciona" (substituiu o `HowSteps`).
  - `AttentionList`: aceita `secondaryAction` e `disabled`.
  - `DatePicker` (`schedule-picker.tsx`): opções `closedDays`, `closedLabel` e `todayLabel`. Abaixo de 360 px cada dia tem cerca de 40×44 px; a exceção está registrada em `docs/mb-interface.md`.
- **Agenda:**
  - no computador (≥ 1024 px), "Equipe" mostra uma coluna por profissional;
  - bloqueios aparecem como faixa listrada vermelha;
  - o nome do cliente abre a ficha quando há `customer_id` (agenda própria e demo; a visão de equipe em produção continua sem, porque `get_team_schedule` não devolve o id);
  - no celular, os atalhos (clientes, link e carteira, sugestões) abrem em janela;
  - os selos da ficha do cliente usam o mapa da Agenda.
- **Equipe:**
  - "Novo profissional" virou duas escolhas, "Só na agenda" e "Com acesso ao painel" (convite com o nome preenchido);
  - filtros antes da busca;
  - "Comparar papéis" em blocos por papel no celular;
  - "Dono (conta antiga)" virou "Dono (sócio)";
  - resultado de aprovar, recusar ou liberar saída aparece junto dos botões, com "Tentar de novo".
- **Cliente:**
  - a lista de espera em Reservas virou um cartão só, com estados coloridos;
  - etapas "Enviar código → Digitar código → Confirmado" no WhatsApp;
  - `RhythmDashboard` usa `StatTile`;
  - na demo, abaixo de 360 px, o seletor de papel vai para o menu de conta.
- **Página pública → entrada → app:**
  - a pílula de horário leva profissional, dia e hora: `/auth` mostra o cartão "Seu horário · Falta confirmar" e `/app?day=…&time=…` abre o Agendar com o dia e o horário pré-escolhidos, se ainda estiverem livres. Nunca reserva sozinho, e o serviço continua sendo escolhido pela pessoa;
  - `/app?tab=conta&focus=whatsapp` abre a Conta no cartão do WhatsApp;
  - corrigido o descompasso de hidratação de `/$barberSlug`;
  - a prévia do login em Ajustes segue o `/auth` atual.
- **Ajustes e Horários:**
  - "Precisa da sua atenção" mostra o WhatsApp não confirmado e o progresso do guia (anel "1/5", próximo passo);
  - Horários lê os pedidos pendentes por `list_pending_shop_changes`, então "Aguardando aprovação" sobrevive a recarregar a página;
  - selo "Preenchido pelo CEP";
  - a frase de WhatsApp caído no cartão da loja diz "Reconectar WhatsApp";
  - no editor da página pública, as abas Editar/Prévia ficam presas no topo no celular.
- **Limpeza:**
  - 670 chaves sem uso removidas dos dicionários (de 4.510 para 3.872 em pt-BR), conferidas contra os prefixos montados dinamicamente;
  - cerca de 850 linhas de CSS sem uso removidas (`.status-pill`, cartões de fidelidade antigos, métricas antigas da plataforma etc.);
  - 2 componentes sem importação removidos.
- **Verificação:**
  - tsc, 195 testes, eslint, prettier e build;
  - fotos de todas as abas de cliente, dono e plataforma em 390 claro e escuro, 320 e 1280, e do `/auth`: sem texto de chave cru, sem erro no console e sem rolagem lateral.

**Pendências que dependem do dono ou de outra rodada:**

- **Banco ou regra de dados:**
  - ficha do cliente pela Agenda na visão de equipe (`get_team_schedule` sem `customer_id`);
  - "Dar acesso ao painel" a um profissional que ainda não tem conta cria outro profissional, em vez de ligar ao existente: `invite-shop-admin`/`apply_add_shop_member` procuram pelo `user_id`; precisa de mudança no servidor;
  - pausa fixa semanal;
  - logo da barbearia nos cartões da plataforma;
  - e-mail para diferenciar pessoas com o mesmo nome na plataforma.
- **Decisões do dono:**
  - vagas de "qualquer profissional" na lista de espera;
  - "Toda semana" × "A cada 7 dias";
  - ~~o Parceiro da demo tem poderes de dono~~ — resolvido na onda 1 da separação de ambientes (09/10): Parceiro e Contratado da demo têm as mesmas restrições do real;
  - nome da aba Reservas;
  - Esportes sempre visível;
  - bônus de check-in em dia de jogo: o texto foi retirado porque a regra não existe.
  - ~~criar barbearia e adicionar pessoa no modo demonstração da Plataforma ainda chamam o servidor real~~ — já resolvido no código: os dois ficam bloqueados na demo ("Fora da demonstração, … seria criada/entraria"), assim como gerentes de conta, WhatsApp, termos e gravação da marca. Desde 09/10 a demonstração também tem ids fictícios e uma trava de rede (`src/lib/demo-guard.ts`).

## Entrega — agendamento pelo painel, cliente do balcão, recorrente, login Google no app instalado e simplificação visual (16/10, madrugada, Claude Code) — **migrations pendentes na VPS**

- **O que:**
  - **Barbeiro marca para o cliente pelo painel:** botão **Agendar** no topo da Agenda e **Agendar aqui** em cada horário livre. Pede WhatsApp e nome; se o número (confirmado por código) for de um cliente da barbearia com conta, o nome do cadastro entra sozinho com o aviso "Nome atualizado para o do cadastro" e o horário vai para a conta dele. Senão vira **cliente do balcão** (sem conta), com interruptor de avisos pelo WhatsApp. Avisos iguais aos do app (confirmação, remarcação, cancelamento, lembrete). Cliente do balcão não tem horário recorrente: a tela avisa e oferece **convite para o app** (WhatsApp com mensagem pronta e link de cadastro com o número preenchido, `/auth?cadastro=1&whatsapp=`). Quando ele se cadastra e confirma o WhatsApp, a ficha e os horários passam para a conta; o nome usado pela equipe vira apelido.
  - **Apelido:** a equipe dá um apelido ao cliente (o cliente não vê); a agenda, o quadro da equipe, a ficha e a lista de clientes mostram o apelido na frente e o nome do cadastro ao lado. Ficha própria do cliente do balcão (WhatsApp, avisos, histórico, convite).
  - **Selo de cliente recorrente** na agenda: "Recorrente · toda semana", "a cada 15 dias" (o atendimento faz parte de uma série) ou "Cliente recorrente" (tem série ativa); ícone no quadro da equipe e selo na ficha. Antes existia só uma etiqueta cinza "Recorrente" no cartão.
  - **Login com Google no app instalado (iPhone):** corrigido o laço (a janela do Google ficava presa por cima do app e, ao fechar, a tela de entrar voltava). A janela agora entrega um código de uso único ao app pelo banco e pede para fechá-la; o app entra sozinho ao voltar. Também: "Conectar Google Agenda" pelo app instalado pede para fechar a janela no fim (antes abria o painel dentro dela, sem sessão) e o cartão confere a conexão ao voltar.
  - **Visual (celular e computador):** no computador e no tablet deitado, a navegação virou coluna lateral (antes a barra de baixo flutuava sobre a agenda); Ajustes → Agendamento um item por vez (5.001 → 954 px no celular); editor de mensagens do WhatsApp recolhido; Serviços e Equipe sem busca, filtros e troca grade/lista em lista curta e sem selos repetidos; selo "Confirmado" só quando diz algo novo; Equipe com "+ Adicionar"; barra fixa do Agendar do cliente mais baixa; manifesto sem trava de tela em pé. Relatório com medidas e o que fica para decidir: [analise-visual-2026-10-16.md](analise-visual-2026-10-16.md).
  - **Bugs achados e corrigidos:** pesquisa pós-atendimento e "Pedir para remarcar" oferecidas a atendimentos sem conta (conta excluída; agora também o balcão); tipo `customer_id` como obrigatório quando o banco aceita vazio (conta excluída); barra flutuante cobrindo a agenda no computador; janela do Google Agenda presa no app instalado.
  - **Revisão de código da própria entrega (02:00–02:45), 19 achados, todos tratados antes de publicar:**
    - **Banco (migrations nº 95 e 96, ainda não aplicadas, corrigidas nelas mesmas):**
      - cliente com apelido não conseguia excluir a conta (`shop_clients.profile_id` passou a `on delete cascade`; apelido vazio não cria linha);
      - qualquer visitante podia lotar a ponte do Google com códigos inventados e travar o login de todos (só entra código emitido pelo Auth nos últimos 10 min, conferido em `auth.flow_state`; conferido na VPS, só lendo, que a tabela existe e o `postgres` lê);
      - o "Agendar cliente" escondia do barbeiro os horários dentro da antecedência mínima do cliente (nova `get_team_slots`, sem a antecedência; quem não vê a loja inteira continua no prazo da agenda) e mostrava dias fora do prazo sempre vazios;
      - profissional restrito via apelido e recorrência de qualquer cliente pelo número e podia renomear cliente de outro (agora só o nome; P-77);
      - atendimento de conta excluída aparecia como "Sem cadastro";
      - conta já confirmada que entra na barbearia pelo app agora leva a ficha do balcão com o mesmo número (gatilho em `memberships`);
      - o roteiro de volta passou a devolver também as permissões exatas.
    - **Tela:**
      - login com Google no app instalado do **computador** terminava numa tela sem saída (a volta cai na própria janela; agora a sessão abre ali mesmo);
      - "Conectar Google Agenda" no app instalado do computador também ficava sem saída (o "feche a janela" agora é só no iPhone/iPad, com "Voltar" de reserva);
      - número trocado na busca podia marcar para o cliente anterior e levar o apelido dele (busca zera na hora e o envio espera a busca);
      - conta sem nome travava o agendamento;
      - contexto da loja perdido ao retomar o login pela ponte, e reabertura a frio do app sem voltar à tela de espera;
      - aviso de espera junto com erro;
      - janela de consentimento do Google aberta ao voltar;
      - "Pronto, você entrou!" antes de o app entrar (virou "Tudo certo com o Google");
      - convite com nome da loja vazio na tela do parceiro, e com "horário marcado" quando enviado da ficha;
      - troca grade/lista escondida mas a escolha salva valendo;
      - falha momentânea escondendo o botão "Agendar" até recarregar;
      - "Voltar" do celular com dois toques depois de fechar um ajuste ou uma seção pela seta (o defeito das seções era anterior).
  - **Também:** coluna da esquerda da Agenda no computador descia 40 px em repouso (defeito anterior, achado pelo caçador de bugs); "Seu acesso nesta barbearia" em uma linha de resumo; `scripts/banco-local.sh` documentado ([scripts/README.md](../scripts/README.md)).
  - **Teste de interface completo (03:00–04:20):** um agente percorreu a demonstração inteira (399 fotos, 320 a 1920 px, claro e escuro) e achou 15 defeitos visíveis; cinco agentes corrigiram por grupo de arquivos e cinco revisores tentaram derrubar cada correção. Tabela do que mudou em [analise-visual-2026-10-16.md](analise-visual-2026-10-16.md), seção 2. Os de maior efeito:
    - Ajustes no celular abria a seção pela metade com a lista rolada: lista e subtela dividiam a mesma chave de rolagem do TanStack Router (`section.ts` copiava o `history.state`); agora cada tela tem a sua.
    - Atendimento em andamento ia para "Anteriores" como "Já passou" (`filterReservations` em `src/lib/shop/appointments.ts` usa o término, com teste).
    - No computador, o conteúdo agora encosta na coluna lateral com a mesma borda em todas as abas (regra registrada em [mb-interface.md](mb-interface.md)).
    - A prévia da antecedência mínima não oferece mais horário com a loja fechada.
    - Textos de senha cortados a 320 px em pt-PT e en-US.
  - **Revisão final independente (04:20–05:55):** quatro revisores (SQL, correções de tela, integrações, varredura visual), cada achado conferido por um verificador; 25 achados confirmados e corrigidos:
    - **Banco (nas migrations nº 95 e 96, ainda não aplicadas):**
      - as colunas novas `appointments.shop_client_id` e `booked_by` estavam graváveis direto pela API: um profissional apontava o próprio atendimento para a ficha de outro e passava a ler e mudar essa ficha (gatilho `appointments_guard_client_columns`: só as funções do banco gravam);
      - um atendimento podia apontar para a ficha de outra barbearia (chave composta `(barbershop_id, shop_client_id)`);
      - a correção do WhatsApp de uma ficha aceitava o número de uma conta da loja;
      - indicadores (`get_partner_rhythm`, `get_business_insights`, `get_professional_insights`) juntavam todos os clientes do balcão num só ou não os contavam;
      - a tela de saída da equipe e a carteira do profissional mostravam o cliente do balcão sem nome;
      - um código de login válido podia ocupar vários ids da ponte.
    - **Tela:**
      - o dia vindo da Agenda passava do prazo da agenda;
      - erro ou cancelamento no Google pelo app instalado no computador terminava sem saída (agora volta para entrar com o aviso);
      - corrigir o número religava os avisos desligados;
      - conta sem nome deixava avisos vazios;
      - o convite da ficha usava o nome interno da loja;
      - Equipe com "+N" sem ícones;
      - a demonstração não simulava o cliente "limited";
      - "Parar repetição" prometia cancelar a data em andamento;
      - o cartão da série perdia "Parar repetição" durante o atendimento;
      - o Início dizia "Nenhum horário marcado" durante um atendimento;
      - sair da aba Ajustes com uma seção aberta deixava entradas mortas no Voltar;
      - trocar de aba mantinha a rolagem da anterior;
      - "Tu clave" em vez de "contraseña".
    - **Visual:**
      - linha "Agora" com 3,2:1 no escuro e 4,3:1 no claro (agora 5,4 e 4,8);
      - título da aba pulando 6 px;
      - rótulos da barra do cliente abaixo de 4,5:1;
      - dias de Bloqueios e botões do próximo horário estreitos a 1024 px;
      - a faixa de 7 dias da Agenda ficou registrada como exceção em [mb-interface.md](mb-interface.md).
  - **Confirmação (06:00–07:10):** três conferentes reproduziram de novo cada achado de tela com os roteiros dos verificadores; 21 de 23 resolvidos de primeira. O resto foi fechado e conferido de novo:
    - com um ajuste de Ajustes aberto, a aba nova herdava a rolagem da lista;
    - **trocar de barbearia com uma seção de Ajustes aberta tirava a pessoa do painel**: duas voltas no histórico ao mesmo tempo, defeito criado pela própria correção e pego aqui. Agora é uma volta por vez (`backPending` em `section.ts`), e nada troca o endereço enquanto ela não chega, porque o TanStack intercepta `pushState`/`replaceState`;
    - dourado legível também no alto da página no tema claro (tinta calculada contra #D8D0C6, o ponto mais escuro do fundo);
    - ícone do título com o mesmo dourado;
    - primeira linha do título no mesmo lugar mesmo quando ele quebra;
    - escolha de avisos à mão preservada depois de passar por um cliente de outro profissional;
    - textos do cliente sem nome e do nome travado.
- **Onde:** migrations `20261016120000_retorno_google_app_instalado.sql` e `20261016130000_agendamento_pelo_painel.sql` (+ testes `supabase/tests/retorno_google_app_instalado.sql` e `agendamento_pelo_painel.sql`; volta sem restaurar o banco: `supabase/manutencao/2026-10-16_desfazer_agendamento_painel.sql`); `src/lib/auth/google-relay*.ts`, `src/routes/auth_.retorno.tsx`, `auth.tsx`, `index.tsx`, `auth_.google-apps.tsx`; `src/features/shop/agenda/BookClientDialog.tsx`, `AgendaTab.tsx`, `AppointmentCard.tsx`, `TeamDayBoard.tsx`, `DaySummary.tsx`, `types.ts`; `src/features/shop/clients/` (regras com teste, apelido, convite); `ClientProfileModal.tsx`, `ClientDirectory.tsx`, `ShopShell.tsx`; demonstração (`src/features/demo/model.ts`, `clients.ts`, `slots.ts`); `styles.css` (coluna lateral), `CatalogFilters.tsx`, `ServicesTab.tsx`, `TeamTab.tsx`, `settings/section.ts`, `SettingsHub.tsx`, `BookingRulesSettings.tsx`, `WhatsAppChannelCard.tsx`, `BookingParts.tsx`; função `google-calendar-dispatch` (nome do cliente do balcão na Agenda Google); depois da revisão: `src/lib/standalone.ts`, `PartnerOverview.tsx`, `settings/MyAccessCard.tsx`, `clients/InviteCard.tsx`, `catalog/ServicesTab.tsx` e `TeamTab.tsx`; `scripts/banco-local.sh` (cópia local do banco); dicionários nos 4 idiomas.
- **Como foi verificado:** cópia local do banco no Docker (`scripts/banco-local.sh subir 20261014120000`, igual à produção, 94 migrations): testes novos 12 + 62 PASS, bateria inteira (42 arquivos) 1.099 PASS e 0 FAIL com as duas migrations; o roteiro do passo 4 do pacote rodado aqui, com os mesmos 12 números; reaplicação dupla sem erro; o roteiro de volta devolve o banco exatamente ao de antes (retrato de 638 itens: definição e permissões de todas as funções de `public`, gatilhos, colunas, tabelas e políticas). `scripts/verificar.sh` (tipos, testes, eslint, prettier, montagem). Fotos na demonstração a 320, 390 e 1280 px, claro e escuro: agenda, janela "Agendar cliente" (busca do cliente com conta e do balcão, agendamento completo, convite), ficha, Ajustes → Agendamento item a item, Serviços, Equipe, Avisos, Agendar do cliente, coluna lateral nos três painéis, `/auth/retorno` e o convite de cadastro.
- **Pendente:** aplicar as migrations nº 95 e 96 e, opcional, a função (P-73, pacote [implantacao-agendamento-painel-2026-10-16.md](implantacao-agendamento-painel-2026-10-16.md)); conferir no iPhone físico o login Google no app instalado (P-43); decisões do admin global e dos pontos do cliente do balcão (P-74, P-76); próximas simplificações (P-75). Não testado com login real nem em aparelho físico.

## Entrega — passagem de 15/10: "Qualquer profissional" na lista de espera, aba "Meus agendamentos" e avisos no cadastro (15/10, noite, Claude Code) — **aplicado no servidor e publicado**

- **O que:**
  - **P-31 (lista de espera):** quem escolhe "Qualquer profissional" vê as vagas de todos; cada vaga usa a duração daquele profissional e some se ele não faz o serviço ou se a duração não cabe. Corrigidos dois defeitos do código publicado pelo autossave do Cursor (`dab56a7`): o selo "pode vagar" saía duas vezes quando dois profissionais tinham vaga no mesmo horário (com aviso de chave repetida do React), e os cartões não saíam em ordem de horário. A conta ficou num lugar só (`waitOpportunities` e `mayOpenStarts`). Vaga de profissional fora da equipe carregada não aparece. Na remarcação, o selo no próprio horário atual some.
  - **Demonstração:** passou a respeitar o modo de escolha de profissional do dono (Ajustes → Agendamento → Profissional): com "Começa em qualquer um", o Agendar abre em "Qualquer profissional", a grade junta as da equipe e a reserva escolhe um profissional livre.
  - **P-32 (nome da aba):** a aba do cliente virou "Meus agendamentos" (pt-PT "As minhas marcações"; en "My appointments"; es "Mis citas") no título, na barra e no leitor de tela. A pedido do dono (15/10), a **Conta saiu da barra** e fica só no topo (ícone "Minha conta" ou menu da conta). A barra mostra o nome longo quando cabe (3 abas nas lojas reais) e o curto (`nav.bookingsShort`: "Agendamentos" / "Marcações" / "Appointments") quando não cabe; com texto ampliado ou zoom alto, volta a colunas iguais com reticências (nenhuma aba some). Para caber, a barra do cliente passou a usar colunas que não ficam menores que o próprio rótulo (`minmax(min-content, 1fr)`), com a pílula medida no botão ativo (e 4 px a mais de cada lado nos cantos arredondados); as barras do painel da loja e da plataforma não mudaram. Os textos da própria área acompanharam (título, estados vazios, avisos); "reserva" no resto do app virou a P-71. O id interno `reservas` não mudou (links já enviados). O nível do rótulo vem da largura natural dos textos (réguas invisíveis), então girar a tela, ampliar o texto ou trocar de idioma recalcula sem prender a barra no modo compacto. Na demonstração, "Ver perfil" fecha o menu e o ícone da conta fica marcado; abaixo de 260 px o botão de tema sai do topo para o da conta caber (o app segue o tema do aparelho).
  - **P-38 (avisos no cadastro):** a etapa "Seu acesso" pergunta "Quero receber avisos pelo WhatsApp" (já marcado; o cartão inteiro marca e desmarca) e a `register-shop` grava a escolha (`whatsapp_opt_in`; sem o campo, de telas antigas, fica ligado; valor que não é booleano → 400 `invalid_opt_in`). A nota do WhatsApp deixou de dizer "só". Sem migration: `apply_verified_whatsapp` já aceitava `p_opt_in`. **Função publicada às 22:54 de 15/10 (01:54 UTC de 16/10), antes do site**, com autorização do dono: backup `/root/functions-backup-register-shop-20261016-015418`, troca só de `register-shop/index.ts` (hash `ac1bb223…` → `c7557315…`), reinício só do container das funções (`Up 10 seconds (healthy)`).
  - **Registros:** P-26, P-34, P-35/P-50, P-37 e P-70 como decididos; P-27 (timer do systemd, seção 6 do guia do certificado reescrita) e P-67 como aplicados; reinício da VPS não testado, por decisão do dono. Novos: P-71 (reserva × agendamento no resto do app) e P-72 (demonstração sem serviços por profissional).
  - **Ferramentas e documentos:** `scripts/foto.mjs` ganhou o passo `{"foto"}` (foto no meio da sequência), `{"largura"}` e a opção `--idioma`. AGENTS.md e o "Comece aqui" voltaram a apontar para o LEIA-PRIMEIRO (o autossave `03c5d32`, de 13/10, tinha gravado por cima com a versão antiga). Pacotes para fora, montados com a skill `pacote-para-agente`: [implantacao-register-shop-p38-2026-10-15.md](implantacao-register-shop-p38-2026-10-15.md) (P-38), [pacotes/2026-10-15-google-retorno-antigo-p69.md](pacotes/2026-10-15-google-retorno-antigo-p69.md) e [pacotes/2026-10-15-google-reenviar-verificacao-p28.md](pacotes/2026-10-15-google-reenviar-verificacao-p28.md).
- **Onde:** `src/features/waiting/model.ts`, `model.test.ts` e `WaitingUI.tsx`; `src/features/customer/ArenaApp.tsx`; `src/features/customer/booking/BookingParts.tsx`; `src/styles.css` (`.app-mobile-nav-fit`); `src/routes/cadastrar.tsx`; `src/lib/auth/friendly-error.ts`; `src/lib/i18n/messages/*`; `supabase/functions/register-shop/index.ts`; `scripts/foto.mjs`; guias e documentos citados acima.
- **Como foi verificado:** `scripts/verificar.sh` (tipos, testes, eslint, prettier e montagem). Na demonstração, com a fila ligada e três pedidos de remarcação (Bruno 14:00 e 16:00, Rafa 14:00): "Qualquer profissional" a 390 e 320 px (um selo por horário, três cartões em ordem), só o Bruno (só as dele) e Combo de 60 min (some a vaga de um corte de 30 min, ficam as de 60). Barra medida no navegador a 320, 360 e 390 px com 3 e 4 abas, a 220 px (reticências), nos quatro idiomas, no escuro e nos cantos arredondados: rótulos em uma linha, pílula igual à aba ativa, nenhuma aba cortada; girar de 800 para 390 px e ampliar e reduzir o texto voltam ao nome longo. Cadastro na etapa "Seu acesso" a 320 e 390 px (tocar no texto do cartão desmarca). Função no servidor: `OPTIONS` 200; `{}` → 400 `invalid_whatsapp`; `whatsapp_opt_in: "sim"` → 400 `invalid_opt_in`; dois minutos depois, `healthy`, nenhuma linha de erro e 12 pedidos atendidos. Revisão independente do diff (quatro revisores e um verificador por achado): os achados confirmados foram corrigidos.
- **Desfazer:** reverter o commit desta entrega. Função: "Como desfazer" do guia [implantacao-register-shop-p38-2026-10-15.md](implantacao-register-shop-p38-2026-10-15.md), com o backup acima.
- **Pendente:** P-69 e P-28 (pacotes prontos, só o dono acessa o Google), P-71 (decisão), P-72.
- **Não verificado:** cadastro e login reais, celular físico, "profissional que não faz o serviço" na tela (P-72).

## Registro de acessos, portas do painel e retorno do Google (13/10, noite, Cursor) — **aplicado no servidor**

- **O que:** decisões do dono de 13/10 às 18:52 (itens 2, 3, 4 e 6; P-27 não mexido). Horários de Brasília.
  - **Portas 6001 e 6002 (P-29):** regras `DROP` na cadeia `DOCKER-USER` só na interface pública (`eth0`), IPv4 e IPv6, no mesmo padrão da 8000, que já existia (está em `rules.v4` de 22/08); acrescentadas também em `/etc/iptables/rules.v4` e `rules.v6` (`iptables-restore --test` ok; `netfilter-persistent` ativo, o mesmo que manteve a 8000 nos reboots de 28/09 e 02/10). Backup antes: `/root/backup-firewall-20261013-215330/`. De fora: 6001 e 6002 sem resposta (antes 200 e 404); 22, site e APIs ok; SSH em conexão nova ok. Pela Tailscale: painel 302, 6001 200, 6002 404 (iguais a antes). O Coolify não tem domínio próprio (abre por IP na Tailscale), então o painel não depende das portas pelo IP público. Reboot real não foi feito.
  - **IP no login (P-29):** migration `20261014120000_registro_login_ip` (tabela `login_access_log`, gatilho em `auth.sessions`, 180 dias, sem acesso pela API). O Auth v2.186 deixa `audit_log_entries.ip_address` sempre vazio, mas grava o IP real em `auth.sessions.ip` (51 de 51 públicos). Ensaio em `BEGIN … ROLLBACK`: teste novo 5 PASS, reaplicação sem erro, `cadastro_aceite` 27, `correcoes_auditoria` 10, `booking_reliability` + `privacy_requests` sem falha; nada ficou gravado. Backup `/root/backup-barba-cabelo-20261013-215948.dump` (1,3 MB); aplicada 18:59:50–52 numa transação, `NOTIFY pgrst`. Conferência: 51 linhas semeadas, `anon`/`authenticated` sem leitura, gatilho presente. Login real do `dono@loja-teste.invalid` às 19:00:09 gravou o IP público desta máquina.
  - **Registro de acessos do proxy (P-29):** 13 opções `--accesslog…` no `/data/coolify/proxy/docker-compose.yml` (JSON; só `StartUTC`, `ClientHost`, `ClientPort`, `RequestHost`, `RequestMethod`, `DownstreamStatus`, `RouterName`; cabeçalhos e caminho descartados). Backups: `/data/coolify/proxy/backups/docker-compose.yml.bak-p29-20261013-220041` e `/root/backup-coolify-proxy-p29-20261013-220041.json` (campo `proxy` do servidor no banco do Coolify, que recebeu o mesmo arquivo em `last_saved_proxy_configuration`; conferido igual). `/etc/logrotate.d/traefik-acessos`: diário, 180 arquivos (no máximo 185 dias), compacta, `USR1` para o Traefik reabrir; rotação forçada testada. Disco: 165 GB livres.
  - **Incidente (P-68):** o `docker compose up -d` recriou o proxy às 19:00:51 só na rede `coolify`; as APIs do Supabase (deste projeto e dos outros da VPS) e a Evolution ficaram sem resposta até o proxy ser religado às 5 redes com rotas; pelo próprio registro de acessos, a API deste projeto voltou às 19:03:25 e as dos outros projetos e a Evolution até 19:03:41 (~2,5 min). Site e lojas (Hostinger) seguiram. Depois: APIs 401 em 0,08 s, Evolution 200, `supabase.proh.media` e `supabasemark1615` 401, `eventflow` 200. `supabase-teste.proh.media` responde 503 porque nenhum container ativo tem rota para ele (a rede do Flow TEST só tem o túnel do banco).
  - **Retorno antigo do Google (P-69):** não existe no servidor (Auth em execução, `.env`, compose e as 123 variáveis salvas no Coolify, conferidas sem imprimir valores) nem no código. Se existir, está só no console do Google; passo a passo para o dono na P-69. Nada mudado no Auth.
  - **P-67:** valor atual e certo conferidos; passo a passo na P-67 (Save no Coolify, `.env` e recriar só `supabase-edge-functions`). Não aplicado.
  - **Item 6:** pausa fixa da loja toda em sociedade com aprovação fica para depois do primeiro uso real (P-70).
- **Onde:** `supabase/migrations/20261014120000_registro_login_ip.sql`, `supabase/tests/registro_login_ip.sql`; `docs/guia/pendencias.md` (P-29, P-67 a P-70), `docs/guia/banco-e-implantacao.md` (seções 1, 3 e 12), `docs/mb-operacao.md`.
- **Desfazer:** firewall: `iptables -D DOCKER-USER -i eth0 -p tcp -m conntrack --ctorigdstport 6001 -j DROP` (e 6002; idem `ip6tables`) e tirar as 2 linhas de cada `rules.v*` (ou copiar os do backup). Proxy: copiar o `.bak-p29` por cima, `docker compose up -d` em `/data/coolify/proxy` e **religar as redes na hora** (P-68), apagar `/etc/logrotate.d/traefik-acessos`. IP do login: `drop trigger on_auth_session_created_log_ip on auth.sessions; drop function public.record_login_access(); drop table public.login_access_log;` (apaga o histórico guardado).
- **Não verificado:** reboot real da VPS; login pelo Google (não feito por regra).

## Entrega — guia da loja no banco, logo e e-mails na plataforma (13/10, noite, Cursor) — **aplicado em produção**

- **O que:** P-20, P-12, P-11 e a marcação de P-13 (já feita na `20261013210000`). Guia: [implantacao-guia-e-emails-2026-10-13.md](implantacao-guia-e-emails-2026-10-13.md).
  - **Banco:** `20261013230000_guia_loja_e_emails` — `shop_setup_guides` (só pelas funções `get_shop_setup_guide` e `save_shop_setup_guide`, para dono/sócio, `shop_admin` e admin da plataforma; 5 chaves verdadeiro/falso) e `platform_user_emails` (só admin da plataforma). Backup `/root/backup-barba-cabelo-20261013-210805.dump`; aplicada às 18:08:08 numa transação. Ensaio: guia_loja_e_emails 11 (novo), shop_role_permissions 39.
  - **Tela:** guia "Deixe sua barbearia pronta" com 6 passos (novo "Equipe e sócios", com "Trabalho sozinho"), estado juntando aparelho e banco (`src/lib/shop/setup-guide.ts`); logo da loja na lista e na ficha da plataforma (`ShopLogo.tsx`); e-mail na equipe da ficha e nos gerentes de conta. Textos nos 4 dicionários.
- **Reteste (API, Loja Teste):** 5 checagens certas; guia de teste apagado.
- **Não testado:** telas da plataforma (exigem a conta de admin do dono); o guia com dois aparelhos de verdade.
- **P-14 ficou de fora de propósito** (mexe na entrada de todas as contas; ver pendências).
- **Também nesta rodada:** `google-connect` limpa a fila da Agenda Google ao desconectar (P-48, publicada às 18:10); eslint sem erros (regra de recarga rápida desligada só em `src/components/ui/`, prettier em `auth.tsx`; P-44); pacote medido e caminho dos idiomas sob demanda registrado, sem mudança (P-45).

## Entrega — pausa fixa semanal (13/10, noite, Cursor) — **aplicado em produção**

- **O que:** P-10. Guia: [implantacao-pausa-semanal-2026-10-13.md](implantacao-pausa-semanal-2026-10-13.md).
  - **Banco:** `20261013220000_pausa_semanal` — tabela `availability_block_rules` (dias da semana, início, fim, loja toda ou profissional), coluna `availability_blocks.rule_id`, geração de bloqueios comuns por 120 dias (gatilho ao criar), `extend_availability_block_rules()` só para o servidor, apagar a regra limpa só o futuro, `list_shop_blocks` com `rule_id`. As funções de horários e reserva não mudaram. Backup `/root/backup-barba-cabelo-20261013-180108.dump`; aplicada às 18:01:15 numa transação. Ensaio: pausa_semanal 14 (novo), booking_rules_single_source 33, convite_boas_vindas_papeis 30, saida_equipe_reservas 29, guard_own_professional_rows 7, shop_team_governance 14, tempo_preparo 17, hours_replace_change 12, sem falhas.
  - **Função:** `whatsapp-dispatch` estende as pausas no minuto 23 de cada hora (publicada às 18:02, reiniciando só o container das funções).
  - **Tela:** cartão "Pausa fixa" na aba Horários (`WeeklyBreaksCard.tsx`, fora da demonstração); bloqueios gerados com etiqueta "Pausa fixa" nos próximos 7 dias e fora da lista "Mais adiante"; apagar um dia avisa que a pausa continua nos outros. Textos nos 4 dicionários.
- **Reteste (API, Loja Teste):** 5 checagens certas (Contratado cria e apaga a própria pausa; não cria a da loja toda; 120 bloqueios de 30 min gerados). Sem dados de teste deixados.
- **Limite:** sociedade que exige aprovação não cria pausa fixa da loja toda (sem fila de pedidos para regra).

## Entrega — convite com link, boas-vindas, regras de papel e pendências autônomas (13/10, noite, Cursor) — **aplicado em produção**

- **O que:** pedido do dono para aplicar tudo o que não depende dele. Guia: [implantacao-convite-papeis-2026-10-13.md](implantacao-convite-papeis-2026-10-13.md). Lista atualizada em [guia/pendencias.md](guia/pendencias.md).
  - **Banco:** `20261013210000_convite_boas_vindas_papeis` — link de convite (`shop_invite_links`), boas-vindas por vínculo (`welcome_seen_at`, `mark_shop_welcome_seen`), convite aguardando legível (`get_my_pending_shop_invites`), primeiro dono com 100%, convite ligado ao cartão existente (`p_staff_id`), permissão `manage_own_blocks`, bloqueios pela gestão sem `shop_admin` (P-66), pasta da própria foto, `customer_id` na agenda da equipe e fundador em `create_own_barbershop`. Backup `/root/backup-barba-cabelo-20261013-205006.dump` às 17:50:06; aplicada às 17:50:22 numa transação. Ensaio em `BEGIN … ROLLBACK`: convite_boas_vindas_papeis 30, saida_equipe_reservas 29, shop_role_permissions 39, regras_papel_banco 20, papeis_atuais_e_fuso 26, shop_team_governance 14, correcoes_auditoria 10, sem falhas.
  - **Funções:** `invite-shop-admin` (link de entrada, e-mail pela fila, `staff_id`, primeiro dono) e `shop-invite` (nova: informação e entrada pelo link). Cópia `/root/functions-backup-20261013-205036`; publicadas 17:50 e correção do endereço 17:53, reiniciando só o container das funções.
  - **Tela:** página `/convite`; cartão do convite com link, "Enviar pelo WhatsApp" e situação do e-mail; janela "Você agora é … na …" (`ShopWelcomeDialog.tsx`); aviso "aguardando aprovação"; foto própria do Contratado; linha "Bloquear a própria agenda" na matriz; nome do cliente na agenda da equipe abre a ficha; "Adicionar dono" na loja recém-criada; `/cadastrar` com a conta aberta ("Você vai usar a conta …") e "Entrar e abrir minha barbearia" no e-mail em uso (P-18); convite de gerente de conta escondido (P-19); `catalog.access.close` removida (P-47). Textos nos 4 dicionários.
  - **Servidor e documentos (subagente):** `scripts/cert-loja.sh` + `scripts/vps/cert-lojas-sync.sh` (P-27, aplicado na `loja-teste-b` às 17:37); levantamentos P-24 e P-29; `mb-operacao.md`, `AGENTS.md` e `supabase/README.md` atualizados (P-52); `@lovable.dev/mcp-js` removido (P-46); eslint ignora `scratch/` e prettier nas 4 funções (P-44, parte).
  - **Achados:** P-66 (resolvido) e P-67 (`PLATFORM_BASE_HOST` do servidor das funções aponta para `dominios.…`; contornado na função, ambiente do Coolify intocado).
- **Retestes (pela API, contas da Loja Teste):** 34 checagens certas — convite pelo cartão sem duplicar, link no endereço da loja, entrada pelo link e troca de senha obrigatória, link sem efeito depois da senha, boas-vindas, foto e bloqueio do Contratado, conta existente convidada para a Loja Teste B (dono com 2 lojas), `customer_id` só para quem pode ver.
- **Estado deixado na Loja Teste:** cartão "Ana Convite …" com conta `ana-…@loja-teste.invalid` (Contratado, com foto de teste), conta `bia-…@loja-teste.invalid` (Contratado, convite não usado) e o dono da Loja Teste como Contratado na Loja Teste B. Arena e Externa sem mudança de dados.
- **Não testado:** convite aguardando com login real (exige sociedade 50/50), "Adicionar dono" pela plataforma (exige a conta de admin do dono), `/cadastrar` com sessão pela tela, e-mail real do convite (endereços de teste não recebem).

## Entrega — pendências da saída fechadas e painéis conferidos no navegador (13/10, noite, Cursor) — **aplicado em produção**

- **O que:** pedido do dono para fechar as pendências da entrega abaixo. Detalhes: seção 8 de [implantacao-equipe-saida-2026-10-13.md](implantacao-equipe-saida-2026-10-13.md).
  - **Banco:** `20261013200000_saida_aguarde_dono` (mensagem "Aguarde a liberação do dono"); backup `/root/backup-barba-cabelo-20261013-2006.dump`, aplicada 17:06:08–09 (Brasília), ensaio sem falhas.
  - **Tela:** "Liberar clientes" com janela de confirmação igual à de "Cancelar e avisar"; mensagem do dono traduzida em `friendly-error.ts`; subtítulo do Contratado sem "levando ou não seus clientes". Textos nos 4 dicionários. Commits `496eece` e `531feff`.
  - **Conferido no site:** painéis do Parceiro e do Contratado (agenda, números, cancelar, concluir, saída), janela de liberar como dono, mensagem do dono pela API; fotos em 320 e 1280, claro e escuro (fora do repositório).
- **Estado deixado na Loja Teste:** igual ao da entrega abaixo; dados criados nesta rodada apagados. Lojas de teste mantidas (decisão do dono).
- **Pendente:** nada desta frente. Fora do escopo: OTP real de WhatsApp e login real do Google.

## Entrega — papéis atuais, fuso rápido e saída da equipe com reservas (13/10, fim da tarde, Cursor) — **aplicado em produção**

- **O que:** decisões do dono de 13/10 para P-56 a P-62, mais o achado P-64 e o ajuste P-65. Guia completo, medições e retestes: [implantacao-equipe-saida-2026-10-13.md](implantacao-equipe-saida-2026-10-13.md).
  - **Banco:** `20261013180000_papeis_atuais_e_fuso` (fuso de ~407 ms para 1,3 ms; `list_pending_shop_changes` volátil; 19 funções pelos papéis da equipe, com 4 auxiliares centrais que nunca devolvem nulo) e `20261013190000_saida_equipe_reservas` (reconvite e reativação com a ficha; quem tem reserva futura não sai nem é pausado; o dono passa cada reserva para um colega livre ou cancela com aviso; Parceiro que leva clientes espera o dono; quem pediu pode desistir; saída sem levar clientes não se recusa; `apply_add_shop_member`/`apply_update_shop_member` fechadas para contas logadas).
  - **Aplicação:** backup `/root/backup-barba-cabelo-20261013-1942.dump` (1,2 MB) às 16:42:35; migrations às 16:42:49–50 e 16:42:54–55, cada uma numa transação, com `NOTIFY pgrst`. Ensaio antes, cada arquivo em `BEGIN … ROLLBACK`: tudo passou (ajustes_finais 25, antecedencia_minima 14, associate_branding 3, booking_reliability 29, booking_rules_single_source 33, cadastro_aceite 27, client_directory 8, correcoes_auditoria 10, decisoes_whatsapp_fuso 43, email_outbox_recovery 6, google_calendar_push 11, guard_own_professional_rows 7, hours_replace_change 12, loyalty_program_module 46, papeis_atuais_e_fuso 26, partner_tools 13, public_shop_landing 32, regras_papel_banco 20, saida_equipe_reservas 28, shop_role_permissions 39, shop_team_governance 14, shop_team_provisioning 3, slot_offer_mode 26, slug_redirects_departure 5, tempo_preparo 17; cadeias depois de booking_reliability: slot_waiting → optional_occurrences → auto_confirmation_modules 81, aggregate_insights 36, cancellation_reasons 39, customer_insights 52, post_service_surveys 37, privacy_requests 43, service_interest_insights 35, service_interest_survey 34, staff_recorded_surveys 36).
  - **Tela:** `DepartureBookings.tsx` (reservas com "Passar para" e "Cancelar e avisar"), no cartão de saída (por pedido e "Reservas de quem saiu da equipe") e na janela Gerenciar quando a pausa é recusada; `ShopDepartureCard.tsx` com pedido "esperando você", liberar desligado enquanto houver reserva, recusar só para quem leva clientes e "Desistir do pedido"; Gerenciar mostra o estado salvo; mensagens novas em `friendly-error.ts`; textos em `eq.leave.*` e `eq.invite.alreadyMember` (pt-BR, pt-PT, en-US, es); selo "Sem horário livre hoje" na página pública.
  - **Medições:** página pública da Loja Teste 4,4 s → 93 ms no banco e 0,65 s até os dados chegarem ao navegador; Arena 1,4 s → 5 ms. `landing.show_today` religado na Loja Teste.
  - **Retestes no site (contas da Loja Teste):** página pública com horários de hoje e horário escolhido levando a `/auth` com "Falta confirmar"; equipe sem "sem permissão" (pela API, cada conta); reservas de quem saiu passadas e canceladas pela tela, com aviso na fila; reativar e reconvidar; saída do Parceiro só com a liberação do dono depois de resolver a reserva; saída do Contratado com reserva sem recusa e com desistência.
- **Onde:** `supabase/migrations/20261013180000_*.sql`, `20261013190000_*.sql`; `supabase/tests/papeis_atuais_e_fuso.sql`, `saida_equipe_reservas.sql`, `regras_papel_banco.sql`; `src/features/shop/settings/{DepartureBookings,ShopDepartureCard}.tsx`, `src/features/shop/{ShopTeamAccessCard,ShopShell}.tsx`, `src/lib/auth/friendly-error.ts`, dicionários; guias `pendencias.md`, `banco-e-implantacao.md` (última aplicada `20261013190000`), `papeis-e-permissoes.md`, `testes-reais-loja-teste.md`.
- **Estado deixado na Loja Teste:** antecedência 2 h; `show_today` ligado; Dono 70%, Sócio 30%, Cliente Dois (Parceiro) e Contratado ativos; Parceiro saiu de novo para a Loja Teste B; reservas do `cliente@` em 14/10 (Sócio) e 15/10 (Dono e Contratado), uma de 14/10 cancelada. Arena e Externa sem mudança de dados.
- **Pendente:** ~~painel do Parceiro e do Contratado conferido só pela API; fotos em 320/1280 e tema escuro~~ — fechado na entrega acima; OTP real e Google real fora do escopo.

## Aplicação da noite de 13/10 e Loja Teste (13/10, tarde, Cursor) — **aplicado em produção**

- **O que:**
  - **Aplicação antecipada, autorizada pelo dono às 13:50** ("pode fazer, pois o sistema ainda não está rodando"), pelo guia [implantacao-noite-2026-10-13.md](implantacao-noite-2026-10-13.md), a partir do Mac do dono (`ssh vps-barba`). Backup `/root/backup-barba-cabelo-20261013-1811.dump`, 1,2 MB (1.176.167 bytes, 1.877 itens), nome pelo relógio da VPS (UTC). Estado antes `f|f|f|f|f`; 0 clientes deixam de receber WhatsApp. Ensaio de tudo junto: **144 PASS**, nenhum FAIL/ERROR, `ROLLBACK` (15:11:29–15:12:42). Migrations aplicadas uma a uma, cada uma em transação: `20261003220000` 15:12:47, `20261003230000` 15:12:49, `20261005120000` 15:12:51, `20261013120000` 15:12:52, `20261013150000` 15:12:54 (fim 15:12:55), seguidas de `NOTIFY pgrst`. Conferências iguais às do guia (`t|t|t|t|t`, `f|f|f`, `f|t|2`, `0|0|f|f`, `f|t|f|3`, `0|f|f|f|t`); 0 avisos marcados como falhos pela 2. Horários de Brasília.
  - **Funções:** `google-connect`, `whatsapp-dispatch`, `register-shop` e `invite-shop-admin` publicadas às 15:13 (cópia das antigas em `/root/functions-backup-20261013-1811`; `_shared` já igual). Só o container de funções reiniciou; sem erro de inicialização. `OPTIONS` 200 nas quatro; sem login: `google-connect` 401, `register-shop` 400 ("Informe um WhatsApp válido"), `invite-shop-admin` 401. Cron do `whatsapp-dispatch` rodando sem erro; Realtime saudável. O Auth não tem servidor OAuth 2.1 nem referência a `/.lovable`.
  - **Montagem do site quebrada desde 12/10 21:12 (P-55, corrigido):** as 5 montagens na Hostinger falharam porque o npm passou a instalar `@tanstack/react-start` 1.169.x ("Could not resolve entry module index.html"). Reproduzido numa cópia limpa; `package.json` com `>=1.167.50 <1.169.0` (instala 1.168.61). Publicado no commit `dae2276`; montagem na Hostinger concluída às 15:27.
  - **Loja Teste** (`loja-teste.beauty.contheiner.digital`, loja `16d6da2e-cd2e-4283-9936-2cb6d5e0e834`): `dono@` criado pela API de administração (o Auth aceitou `.invalid`), loja pelo `loja-teste-criar.sql`, depois `cliente@` e `cliente2@` ligados à loja. Certificado Let's Encrypt pelo roteador novo em `beauty-shop-certs.yaml` (backup `/root/beauty-shop-certs.yaml.bak-20261013-1816`). Pelo app: serviço "Corte" (30 min, R$ 40); convites `socio@` (Dono 30%; o dono ficou com 70%), `parceiro@`, `contratado@` e `cliente2@` (Parceiro, conta que já existia). Senhas temporárias e definitivas só nas Chaves do macOS do dono, serviço "Barba e Cabelo - Loja Teste" (conta = e-mail; temporárias como `temp:<e-mail>`). No teste de saída do Parceiro nasceu a **Loja Teste B** (`loja-teste-b`, dono `parceiro@`, sem certificado próprio).
  - **Testes P-40/P-41:** resultados por item em [pendencias.md](guia/pendencias.md) (P-40, P-41, P-01, P-04, P-16, P-54). Passaram: troca obrigatória da senha (Esc, toque fora, `/app` e recarregar não escapam; senha nova 200, temporária 400, marca limpa), "Agendar com Dono" → login → app com o Dono escolhido, termos, Contratado removido (`/app?aviso=removido`), cliente promovido a Parceiro, barra "Você está vendo como cliente", antecedência (1 h na hora; 2 h recusando a reserva do cliente com a mensagem nova), aprovação do sócio de 30% pelo dono de 70%, matriz do Contratado, bloqueios sem nome e sem motivo na rede, saída do Contratado sem carteira.
- **Achados (novos ids):** P-55 (montagem, feito); P-56 (`shop_tz` varre `pg_timezone_names` duas vezes por profissional e dia: página pública da Loja Teste ~7 s, estoura os 3 s do visitante; Arena ~1,7 s); P-57 (`list_pending_shop_changes` STABLE com UPDATE, sempre `0A000`); P-58 (19 funções só aceitam o `shop_admin` antigo: sócio, Parceiro e Contratado veem "Você não tem permissão…" na Agenda); P-59 (reconvidar quem saiu dá erro genérico); P-60 (reativar membro não reativa a ficha `staff`; Gerenciar fica com estado antigo); P-61 (reservas futuras com quem saiu continuam confirmadas); P-62 (Parceiro sai levando a carteira sem liberação do dono; só leva quem teve atendimento concluído); P-63 (roteiro corrigido).
- **Onde:** `package.json` (P-55); documentação: `docs/guia/pendencias.md`, `docs/guia/banco-e-implantacao.md` (última aplicada `20261013150000`), `docs/testes-reais-loja-teste.md` (ordem das contas, item 2 e 6 do P-41), `docs/implantacao-noite-2026-10-13.md` (marcado aplicado). Fotos e scripts dos testes ficaram fora do repositório, na pasta do agente.
- **Estado deixado na Loja Teste:** antecedência 2 h; cartão "horários de hoje" da página pública **desligado** (contorno de P-56); bloqueio do Dono 14/10 12:00–13:00; reservas do `cliente@`: hoje 16:15 com o Dono, amanhã 10:00 com o Contratado e com o Parceiro (ambos já fora da equipe); Contratado pausado; Parceiro saiu para a Loja Teste B. Arena e Externa: só a antecedência padrão de 30 min veio da migration; nenhum outro dado mudou.
- **Pendente:** decisões do dono sobre P-58/P-56/P-57 (migration nova), P-61, P-62, religar o cartão de horários e manter ou apagar as lojas de teste (limpeza: passo 8 do roteiro, que já cobre `loja-teste-b`). Não testado: horário escolhido na página pública, `/platform`, 50%/50%, dono com 2 lojas.

## Entrega — decisões do dono de 13/10: antecedência mínima, Realtime, guia da noite e loja de teste (13/10, Cursor) — **aplicada na VPS em 13/10 (ver acima)**

- **O que:**
  - **P-54, antecedência mínima (feito — falta aplicar no banco):** cada loja escolhe com quanto tempo antes o cliente pode reservar (sem mínimo, 15 min, 30 min, 1 h, 2 h, 4 h, 12 h ou 24 h; padrão 30 min). O cliente não vê horário dentro da antecedência; se tentar reservar ou remarcar assim, recebe "Esse horário está muito em cima da hora…". O painel da equipe continua livre; cancelamentos, lista de espera e séries recorrentes não são barrados; agendamentos já marcados não mudam. Mesma aprovação entre sócios das outras regras. **Ao aplicar, todas as lojas passam a exigir 30 minutos.**
  - **P-25, Realtime (feito no servidor):** a configuração salva do Coolify passou a ter, no `realtime-dev`, `restart: unless-stopped` e o limite de 0,5 CPU / 512 MB (o arquivo do servidor ganhou o mesmo limite). Backups antes: `docker-compose.yml.bak-p25-20261013-161643` na pasta do serviço e `/root/backup-coolify-p25-20261013-161643/` (cópia das tabelas `services` e `service_applications` do banco do Coolify e do compose salvo). Só o `realtime-dev` foi recriado (`docker compose … up -d --no-deps realtime-dev`, conferido antes com `--dry-run`); os outros containers mantiveram o mesmo id. Valor salvo no Coolify igual ao arquivo do servidor; 9 serviços com `mem_limit`.
  - **P-53 (feito):** o dono decidiu manter as duas regras da grade (a contagem recomeça depois de bloqueio ou almoço; no modo de intervalo fixo, recusar início fora da grade). Nada mudou no código.
  - **Aplicação da noite (autorizada, não feita daqui):** guia único [implantacao-noite-2026-10-13.md](implantacao-noite-2026-10-13.md) com as 5 migrations (220000 → 230000 → 20261005120000 → 20261013120000 → 20261013150000) e as 4 funções (`google-connect`, `whatsapp-dispatch`, `register-shop`, `invite-shop-admin`).
  - **Testes reais P-40/P-41 (preparados, nada criado):** roteiro [testes-reais-loja-teste.md](testes-reais-loja-teste.md) com a "Loja Teste" (`loja-teste`), contas `@loja-teste.invalid` por papel, certificado do subdomínio e limpeza.
- **Onde:** `supabase/migrations/20261013150000_antecedencia_minima.sql` (coluna `barbershop_settings.min_lead_minutes`; `available_slots_internal`, `appointments_enforce_service_terms` e `apply_shop_change` copiadas da `20261005120000` com as linhas novas; sinal de agenda ao mudar), teste `supabase/tests/antecedencia_minima.sql`; tela `src/features/shop/settings/MinLeadSettings.tsx` (cartão em Ajustes → Agendamento, abaixo de "Como os horários aparecem"; só aparece com a coluna no banco), `BookingRulesSettings.tsx` (linha no resumo), `booking-cards.ts`, `governance-diff.ts` (pedido de aprovação legível), `ShopShell.tsx` (`saveMinLead`), `ArenaApp.tsx` (mensagem de erro), `src/lib/shop/appointments.ts` (filtro da lista de horários e leitura do ajuste, com testes), `types.ts`, demonstração (`model.ts`, 30 min), textos `lead.*` e `booking.errorLeadTime` nos 4 dicionários. Scripts `supabase/manutencao/loja-teste-criar.sql` e `loja-teste-apagar.sql`.
- **Como foi verificado:**
  - verificar.sh (ok); 260 testes;
  - fotos 390 claro e escuro de `/demo?view=owner` → Ajustes → Agendamento: cartão com as 8 escolhas e a prévia; salvar 2 h mostra "Pronto…" e o resumo do topo passa a "2 h"; `/demo?view=customer` sem erro; sem rolagem lateral, sem chave crua, sem erro no console;
  - Realtime: sinais de agenda inseridos na loja Arena e recebidos pelo canal `availability:<loja>`, antes (2 de 2) e depois (3 de 3, média de ~160 ms); memória do realtime 168 MiB de 512;
  - ensaio numa cópia da estrutura do banco de produção (auth + public, mesmas 400 funções, 73 tabelas, 54 gatilhos e 76 políticas), num container temporário na VPS limitado a 1 GB / 0,5 CPU, já removido: cadeia da noite **144 PASS** (25 + 43 + 17 + 26 + 19 + 14); as 5 migrations com os testes de agenda (`booking_rules_single_source`, `correcoes_auditoria`, `guard_own_professional_rows`, cadeia `booking_reliability` → `auto_confirmation_modules`) **131 PASS**; a migration nova reaplica sem erro; conferência `0|f|f|f|t`; scripts da loja de teste: loja criada com o endereço certo e apagada por inteiro, sem resíduo. Tudo em `BEGIN … ROLLBACK`;
  - no banco de produção, só leitura: endereços `loja-teste` e `loja-teste-b` livres; nenhuma conta `@loja-teste.invalid`.
- **Não feito:** o ensaio de P-54 no banco de produção ficou para a noite: ele depende da `20261005120000`, cujo `add column` prende `barbershop_settings` e `services` durante a transação (71 s no ensaio de 13/10), e era horário de movimento. Por isso o ensaio foi feito na cópia.
- **Pendente:** aplicar e publicar pelo guia da noite (P-21, P-22, P-23, P-01, P-04, P-07, P-16, P-54); depois, testes reais P-40/P-41 pela loja de teste. Relatório da VPS volta ao dono para registrar aqui.

## Entrega — senha própria no primeiro acesso de quem foi convidado (13/10, Cursor) — **função publicada em 13/10**

- **O que:** a pessoa que entra pela primeira vez com a senha temporária do convite vê a janela "Crie sua senha" (nova senha, confirmação, regras à vista) antes de usar o painel, a plataforma ou o app. A janela só fecha depois de salvar; a outra saída é "Sair da conta". A janela de Termos espera a senha ser criada. Contas que já existiam não são afetadas. É a P-16 da onda 4.
- **Onde:** `src/features/auth/PasswordChangeGate.tsx` (montado no `ShopShell`, no `PlatformShell` e no `ArenaApp`, desligado na demonstração), `src/lib/auth/password-change.ts` (marca `must_change_password` nos dados da conta, com teste), `ChangePasswordCard.tsx` (opções `heading` e `onSaved`; toda troca de senha desliga a marca), `TermsUpdateGate.tsx`, `supabase/functions/invite-shop-admin/index.ts` (grava a marca só em conta criada agora), 3 textos novos `password.gate.*` nos 4 dicionários. Sem migration: a marca fica nos dados da conta do Auth.
- **Como foi verificado:** verificar.sh (ok); 258 testes; fotos 320/390/1280 claro e escuro em `/platform` com uma sessão simulada marcada (cópia temporária do `foto.mjs`, fora do repositório): janela "Crie sua senha" aberta, sem rolagem lateral, sem chave crua, sem erro no console. **Não verificado:** convite real e troca real de senha (exigiria criar conta no Auth de produção).
- **Pendente:** publicar a função `invite-shop-admin` na VPS ([implantacao-regras-papel-2026-10-13.md](implantacao-regras-papel-2026-10-13.md), passo 4); até lá nenhuma conta nova recebe a marca e nada muda. P-15 (link do convite) e P-17 (boas-vindas) continuam pendentes.

## Entrega — regras de papel no banco e administradores da plataforma (13/10, Cursor) — **migration aplicada em 13/10**

- **O que:** (1) Contratado que chame a função direto não sai mais levando clientes (P-01). (2) O aparelho de Parceiro e Contratado deixa de receber nome e motivo dos bloqueios dos colegas; continua vendo "Colega indisponível" no horário certo (P-04). (3) Painel geral e lista de atenção da plataforma contam "Administradores" pelos donos e sócios ativos da equipe, a mesma regra da ficha da loja (P-07). (4) Os testes `favicon` e `slugify`, que nunca rodavam, entraram no `npm test` (P-51).
- **Onde:** `supabase/migrations/20261013120000_regras_papel_banco.sql` (`request_shop_departure` copiada da `20261003150000` com a recusa do `take` de `employee`; política "Professional members read blocks" refeita; RPCs `list_shop_blocks` e `list_platform_shop_owners`), teste `supabase/tests/regras_papel_banco.sql`, guia [implantacao-regras-papel-2026-10-13.md](implantacao-regras-papel-2026-10-13.md). Tela: `ShopShell.tsx` lê os bloqueios pela `list_shop_blocks` e volta à leitura antiga se ela não existir; `src/lib/shop/blocks.ts`; `src/features/platform/shopCounts.ts` (contas puras, com teste; `shopStats.ts` reexporta), `PlatformShell.tsx`, `PlatformDashboard.tsx`, `ShopsPanel.tsx`; demonstração da plataforma com o dono fictício no lugar do `shop_admin` "demo-admin"; tipos em `types.ts`.
- **Levantamento no banco (só leitura, 13/10):** 1 vínculo `shop_admin` e **0** contas `shop_admin` sem vínculo de equipe. Lojas ativas: `arena-barber` (1 dono, 1 `shop_admin`) e `externabarbearia` (sem equipe nenhuma). A contagem nova não muda o resultado de nenhuma das duas.
- **Como foi verificado:** verificar.sh (ok); 258 testes; ensaio no banco de produção em `BEGIN … ROLLBACK` a partir desta máquina (SSH `vps-barba`): teste novo 19 PASS; regressão com a migration: `correcoes_auditoria` 10, `guard_own_professional_rows` 7, `booking_rules_single_source` 33, `slot_offer_mode` 26, cadeia `booking_reliability` → `slot_waiting` → `optional_occurrences` → `auto_confirmation_modules` 81, todos sem FAIL. Foto de `/demo?view=platform` (390): "1 administrador" e "Todas com administrador".
- **Pendente:** aplicar a migration na VPS (guia acima). Até lá o painel e a plataforma funcionam como antes.

## Registro — ensaio das 3 migrations pendentes no banco de produção (13/10, Cursor)

- **O que:** conferido por consulta de leitura que P-21, P-22 e P-23 **continuam não aplicadas** (`f|f|f`). Ensaio encadeado das três, com os testes de cada guia, numa transação desfeita: **111 PASS** (25 + 43 + 17 + 26, exatamente os números dos guias), nenhum FAIL ou ERROR, `ROLLBACK`. Depois, `f|f|f` e nenhum usuário `@example.invalid`: nada ficou gravado.
- **Lições:** (1) encadear testes numa só transação exige voltar ao papel de administrador entre os arquivos (`reset role` e limpar `request.jwt.claim.*`), senão o teste seguinte cria a loja como o usuário simulado pelo anterior e esbarra em `guard_protected_shop_change`; os guias rodam um teste por transação e não têm esse problema. (2) O ensaio levou 71 s e, nesse tempo, segurou as tabelas `barbershop_settings` e `services` (o `add column` trava a tabela até o fim da transação): fazer ensaios longos fora do horário de movimento.
- **Pendente:** aplicar de fato (P-21 → P-22 → P-23) é decisão do dono ou tarefa do agente da VPS; não foi feito daqui.

## Entrega — separação de ambientes, onda 1: "como quem" e demonstração (09/10, Claude Code)

Plano completo em [plano-ambientes.md](plano-ambientes.md) (seção 4, onda 1). Só interface: não mudou banco, migrations nem regras de permissão.

- **Quem age e com qual poder:** regra única em `src/lib/auth/shop-acting.ts` (com testes em `shop-acting.test.ts`), usada pelo `ShopShell` e pelo `LoyaltyAdminPage`.
  - Vínculo de equipe → poderes da matriz da loja.
  - `shop_admin` antigo sem vínculo de equipe → continua abrindo a própria loja com os poderes de dono de hoje (grava direto), com selo "Dono".
  - Sem vínculo de equipe nem `shop_admin` → nenhuma loja e nenhum poder. O painel nunca abre uma loja vinda de vínculo de cliente. O admin da plataforma vê "Você não está na equipe de nenhuma barbearia" com "Voltar à plataforma" (entra em loja só pela demonstração).
- **Plataforma:** "Ir para minha barbearia" só aparece quando a conta tem loja para abrir.
- **Troca de loja:** as permissões ficam presas à loja a que pertencem; enquanto as da nova chegam aparece "Abrindo {loja}…" (abas escondidas) e o painel volta à Agenda.
- **Loja guardada no aparelho:** chave por conta (`arena:active-shop-actor:<user_id>`, a antiga só como reserva), com proteção contra armazenamento bloqueado.
- **Ordem das lojas:** papel mais alto (dono/sócio, Parceiro, Contratado) e depois o vínculo mais antigo (`shop_members.created_at`).
- **Demonstração fiel:**
  - Parceiro e Contratado com as mesmas regras do real (sem Aparência, sem "Novo serviço", funcionamento só leitura, bloqueios só próprios, catálogo próprio por cima do da loja).
  - "Testar como…" copia aparência e catálogo com ids fictícios (loja, equipe, serviços, horários; sem domínio próprio nem conta real).
  - Sugestões de catálogo do Parceiro com dados fictícios e decisão local.
  - Trava de rede (`src/lib/demo-guard.ts`, ligada no `fetch` do cliente Supabase): com a demonstração aberta em `/demo`, nada vai ao banco além da sessão. Testes em `src/lib/demo-guard.test.ts`, incluindo um que falha se um componente que lê o banco não souber da demonstração.
- **Convite:** o texto agora diz "Envie a senha temporária para a pessoa. Quem já tem conta usa a senha de sempre." (nenhum e-mail é enviado).
- **Pendente (precisa decidir leitura):** contagem de "Administradores" da plataforma pelos donos/sócios ativos da equipe (PLAT-01). Ver o relatório da onda.

## Entrega — separação de ambientes, onda 2: entrada e troca de ambiente (09/10, Claude Code)

Plano em [plano-ambientes.md](plano-ambientes.md) (seção 4, onda 2; decisões 1, 2, 3 e 5). Só interface: não mudou banco, migrations nem regras de permissão.

- **Destino depois de entrar:** regra em `src/lib/auth/destination.ts` (testes da matriz papel × destino em `session.test.ts`).
  - `/app` com loja, profissional, dia, hora, reserva ou `focus=whatsapp` é seguido por qualquer papel (o "Agendar" da página pública não cai mais no painel).
  - `/shop` e `/platform` só quando a conta tem aquela área; `/app` genérico e entrada sem destino abrem a última área usada no aparelho (`arena:last-area:<user_id>`, com proteção contra armazenamento bloqueado) ou a mais alta da conta.
  - Só caminhos internos conhecidos (`/app`, `/shop`, `/shop/pontos`, `/platform`, `/demo`, `/politica`, `/cadastrar`) e só parâmetros conhecidos e válidos passam (sem redirecionamento aberto; barra invertida, `//` e endereços externos caem).
- **"Minhas áreas"** (`src/features/account/MyAreas.tsx`, lista em `src/lib/auth/areas.ts`): no menu da conta do painel, da plataforma e do app do cliente, só para contas com 2 ou mais áreas. Mostra Plataforma, cada barbearia com o selo do papel e "Agendar como cliente". Trocar de área cobre a tela com "Abrindo {área}…"; outra loja do próprio painel troca ali mesmo. Substitui "Ir para minha barbearia" e "Painel da plataforma" dos menus.
- **App do cliente:** para quem tem outro ambiente, selo "Cliente" no cabeçalho (no lugar do slogan) e o avatar abre o menu com "Minhas áreas" e "Minha conta". Conta só de cliente continua igual.
- **"/" e app instalado:** no endereço principal e no app instalado abrem a última área usada. No domínio da loja, pelo navegador, mostram a página pública com a barra "Você está vendo como cliente · Abrir painel" (também em `/b/<slug>`).
- **Recusas explicadas:** `/shop` sem acesso leva a `/app?aviso=sem-acesso` ou `aviso=removido` (vínculo de equipe inativo); `/platform` e `/demo` sem permissão levam a `aviso=sem-plataforma`. O app mostra o motivo num aviso que some ao fechar. `aviso=aguardando` já tem texto, mas ainda não é detectado (precisa de banco).
- **Loja de entrada do painel** (`initialShopEntry`/`shopEntryForHost` em `shop-acting.ts`): loja pedida em "Minhas áreas" (`/shop?unidade=`) → loja do domínio em que a pessoa trabalha → escolha salva → pergunta "Em qual barbearia você vai trabalhar agora?" (2 ou mais lojas) → a única loja. No domínio de uma loja em que não trabalha, aviso "Você está no endereço da A, mas trabalha na B" com "Abrir endereço da B". `/platform` no domínio de uma loja vai ao endereço principal.
- **Página da loja no painel:** "Ver como cliente" (`/b/<slug>`, mesma conta) e "Abrir link público" (link de divulgar) com rótulos distintos; o guia concluído também diz "Abrir link público".

## Entrega — separação de ambientes, onda 3: clareza do papel no painel (09/10, Claude Code)

Plano em [plano-ambientes.md](plano-ambientes.md) (seção 4, onda 3; decisões 7, 8, 10 e 14). Só interface: não mudou banco, migrations nem regras de permissão.

- **Capacidades com nome** (`src/lib/auth/capabilities.ts`, testes em `capabilities.test.ts`): `society`, `ownCatalog`, `suggestToPeers`, `ownBlocks`, `ownProfile`, `ownPhoto`, `ownWallet`, `leaveShop`, `takeClientsOnLeave`, `googleOwnAgenda`, `googleWholeShop`. O `ShopShell` e o `shopPowers` perguntam por elas; não sobrou `role === "associate"` no painel. As abas de cada papel continuam as de antes (teste).
- **Selo de papel tocável** (`RoleAccessButton.tsx`): "Dono · X%" para todos os donos (topo, menu da conta, troca de loja, "Minhas áreas", "Seu acesso") e o modo da sociedade como selo ("Decisão em conjunto", "Maior parte decide"; dono único só "Dono · 100%"). Tocar abre "Seu acesso" resumido: papel, modo, "valem na hora" ou "esperam o OK de Ana", ✓/— e atalho para Ajustes → Equipe e sociedade.
- **Aviso antes de salvar:** quando a mudança vai para aprovação, os botões Salvar mostram "Vai para aprovação de {nomes}" (`ApprovalNote` + `ApprovalNoteContext` em `components/visual`, dentro do `UnsavedBar` e nas janelas de serviço, profissional e bloqueio).
- **Matriz de permissões:** para o Contratado, "Todos os serviços", "Funcionamento", "Equipe" e "Permissões" ficam travados com "Contratado não muda a loja. Para mais autonomia, use Parceiro." A tela também ignora essas permissões para o Contratado (o banco já não as aplicava).
- **Contratado (decisões 7):** "Sair da barbearia" só sem levar clientes; Google só com a própria agenda (Ajustes → Avisos, resumo "Sua agenda do Google"). Bloqueios próprios aparecem quando o dono libera "Serviços: os seus" (o banco ainda exige essa permissão; ver pendência). **Atenção: "sair sem levar clientes" vale só na tela.** A RPC `request_shop_departure` ainda aceita `p_mode = 'take'` de um Contratado que a chame direto; falta a migration que recuse `take` quando `role = 'employee'` (ver pendência).
- **Parceiro:** aba "Meus serviços", faixa "Preços e serviços que valem só na sua agenda", selos e interruptor "Você atende / Você não atende".
- **"Meu perfil e link"** (Ajustes → Pessoas, `MyProfileCard.tsx`) para todo profissional: prévia, link para copiar/enviar e "Editar meu perfil" (mesma janela do cadastro; o link não muda; a foto do Contratado fica travada).
- **Sociedade num lugar só:** "Pessoas e papéis" (convites, %, permissões) saiu da aba Equipe e foi para Ajustes → Equipe e sociedade, junto das decisões, do modo, de "Seu acesso" e da saída. A aba Equipe leva até lá ("Acesso ao painel") e o convite pelo cartão do profissional abre lá já com o nome.
- **Bloqueios de colegas:** para quem só cuida da própria agenda aparecem como "Colega indisponível", sem nome nem motivo (só na tela).
- **Ajustes da revisão (09/10):** "Seu acesso" mostra "Editar os próprios serviços" ✓ para quem edita os serviços da loja; o resumo do selo não repete "valem na hora" e, na demonstração, diz "valem na hora" (lá nada vai para aprovação); o atalho do selo leva quem não é dono ao cartão "Seu acesso" (`team-mine`); "Meus serviços" sem rótulo repetido no interruptor; a barra de baixo mantém "Serviços" (uma linha), e "Meus serviços" fica no título da aba.
- **Pendências de banco:** `request_shop_departure` recusar `p_mode = 'take'` quando o membro é `employee` (errcode 42501); bloqueio próprio do Contratado sem depender de "serviços próprios"; foto do próprio perfil para o Contratado (política do storage); filtrar nome/motivo dos bloqueios de colegas no banco (hoje chegam ao aparelho).

## Entrega — separação de ambientes, onda 5 (parte de interface): cliente com várias lojas, plataforma e demonstração fiel (09/10, Claude Code)

Plano em [plano-ambientes.md](plano-ambientes.md) (seção 4, onda 5, itens 1, 3 e 4; decisões 10, 11 e 13). Só interface: não mudou banco, migrations nem regras de permissão.

- **Cliente com várias lojas** (`src/features/customer/shop-choice.ts`, testes em `shop-choice.test.ts`):
  - Nome da loja no topo vira seletor com 2 ou mais lojas, com o contador de reservas futuras de cada uma (`CustomerShops.tsx`). Toda troca mostra "Abrindo {loja}…" (também em Conta → Minhas barbearias).
  - Última loja aberta lembrada no aparelho, por conta (`arena:last-customer-shop:<user_id>`, com proteção contra armazenamento bloqueado); sem ela, a primeira da lista.
  - Aviso "1 reserva em {loja} · Abrir" no Início e em Reservas, só com as reservas já carregadas. Link de reserva (`?reserva=`) de outra loja de que a pessoa é cliente abre a loja certa já na reserva.
  - Sem loja aberta, nada aparece misturado (as reservas de outras lojas viram o aviso).
  - Sem nenhuma loja (decisão 13): estado vazio neutro "Peça o link à sua barbearia" com campo para colar o link (`AskShopLink.tsx`; leitura do link em `src/lib/shop/shop-link.ts`, com testes). Domínio próprio é conferido pela consulta pública `resolve_shop_by_host`. O slogan padrão some.
  - "Entrar em {loja}?" virou "Adicionar {loja} às suas barbearias?" (ícone de +).
- **Plataforma:**
  - Ficha da barbearia lista a equipe (nome e "Dono · %", Parceiro, Contratado, modo da sociedade) com a RPC que o admin já lê (`list_shop_team_members`). Na ficha, "Administradores" e o aviso "sem administrador" passam a contar donos/sócios ativos da equipe quando ela carrega (decisão 12); a lista de atenção e o painel geral seguem com a contagem antiga (pendência da onda 1).
  - "Testar como…" abre os papéis numa janela na própria ficha; ao sair da demonstração, volta para a ficha (`/demo?volta=ficha` → `/platform?aba=barbearias&loja=<id>`).
  - Na demonstração o papel fica no endereço (`?view=`, com `replace`) e o título vira "Plataforma · demonstração".
  - Depois de criar a barbearia, a primeira ação é "Adicionar pessoa" (convite já com a loja). **"Adicionar dono" não dá ainda:** o banco só aceita dono novo cedendo parte de um dono que já existe (ver pendência).
- **Demonstração** (`src/features/demo/team.ts`):
  - Personagens próprios: Parceiro "Rafa Lima" e Contratado "Léo Souza" (cartões, agenda e link próprios, ids fictícios).
  - Visões de dono com os nomes do produto: "Dono · 100%" (decide sozinho), "Dono · 50%" (decisão em conjunto, com a sócia fictícia Ana) e "Dono · 30%" (maior parte decide). O antigo `?view=partner` abre a visão de 50%.
  - Ajustes → Equipe e sociedade também na demonstração: modo, barra de participação, "Seu acesso" e a saída simulada (destino fictício; nada sai de verdade). Nas visões de sociedade, "Seu acesso" diz "esperam o OK de Ana" e o Salvar avisa "No real, vai para aprovação de Ana" (na demonstração a mudança ainda vale na hora).

## Entrega — tempo de preparo entre atendimentos (05/10, Claude Code) — **migration pendente na VPS**

Folga depois de cada atendimento para limpar e arrumar a cadeira. O cliente continua vendo só a duração do serviço; a folga não aparece como horário livre.

- **Onde:** Ajustes → Agendamento → "Como os horários aparecem" → "Tempo de preparo depois de cada atendimento" (0, 5, 10, 15, 20 ou 30 min; padrão 0). Em Serviços → Editar, "Tempo de preparo depois deste serviço": "Usar o da barbearia" (nulo) ou um valor próprio. Sócio parceiro (associate) não vê o campo do serviço.
- **Regra:** o atendimento novo precisa deixar o próprio preparo livre antes do próximo; cada atendimento existente ocupa até o fim + o preparo do serviço dele. Bloqueios, esperas e o fechamento não exigem preparo. No modo "no tamanho do serviço" o passo vira duração + preparo. O painel continua livre para encaixar; a reserva do cliente que invade o preparo é recusada com `23P01` ("horário ocupado").
- **Banco:** `supabase/migrations/20261005120000_tempo_preparo.sql` (colunas `barbershop_settings.prep_minutes` e `services.prep_minutes`, `service_prep_minutes`, `staff_busy_prep_internal`, `slot_candidate_starts` com 4 argumentos, e novas versões de `available_slots_internal`, `appointments_enforce_service_terms` e `apply_shop_change`). Teste: `supabase/tests/tempo_preparo.sql` (17 PASS na cópia local). Guia do agente: [implantacao-preparo-2026-10-05.md](implantacao-preparo-2026-10-05.md). Depende da 220000 e da 230000.
- **Antes da migration:** os campos ficam escondidos (a tela só os mostra quando a coluna `prep_minutes` vem do banco), então salvar a forma dos horários ou um serviço continua funcionando.
- **Frontend:** `src/lib/shop/appointments.ts` (`PREP_OPTIONS`, `validPrepMinutes`, `prepMinutes` na regra, preparo em `buildSlotsForWindow`/`previewSlotMinutes`, com testes), `SlotModeSettings.tsx`, formulário de serviço em `ShopShell.tsx`, demonstração em `ArenaApp.tsx` e `demo/model.ts`, tipos em `integrations/supabase/types.ts`, textos nos 5 idiomas.

## Ajuste — forma dos horários com duas opções (05/10, Claude Code)

Em Ajustes → Agendamento → "Como os horários aparecem", as opções "Flexível · de 15 em 15 min" e "Ajustável" viraram uma só: **"Ajustável"** (seletor 10/15/20/30/45/60, padrão 15), mostrada por último, depois de **"No tamanho do serviço"**. Motivo: Ajustável com 15 min dava exatamente o mesmo resultado do Flexível. Sem mudança no banco: a tela grava 15 min como `slot_mode = 'flexible'` e os outros intervalos como `'custom'` (`SlotModeSettings.tsx`, `modeFor`). Lojas que já usavam qualquer um dos dois continuam iguais. Chaves i18n `slots.mode.flexible.*`/`custom.*` e `slots.consequence.flexible/custom` trocadas por `slots.mode.interval.*`, `slots.consequence.interval` e `slots.step.optionDefault`.

## Entrega — correção de anomalias visuais em todo o sistema (04/10, madrugada, Claude Code)

Varredura por capturas de tela (celular claro, celular escuro e computador) de todas as telas do modo demonstração (cliente, dono, sócio, parceiro, contratado, plataforma) e das páginas públicas, seguida de duas rodadas de agentes (encontrar → verificar com cético → corrigir; depois comparar antes/depois para achar regressões). Corrigidos 88 + 33 itens. Principais:

- **Tema escuro:** `--primary` claro (#f1ede6) fora dos cartões off-white no app do cliente, no painel e no login (antes a cor da marca, quase preta, sumia sobre o fundo escuro); dentro dos cartões volta a tinta da marca. Selos de nível e saldo de pontos legíveis; âmbar/destrutivo com contraste AA; `color-mix(in oklch, …, transparent)` trocado para não gerar tons rosados.
- **Avisos rápidos (toasts):** `<Toaster />` montado em `__root.tsx` (antes nenhum aviso aparecia).
- **Cabeçalhos:** nome da loja em até 2 linhas (cliente e painel); no painel, atalho da plataforma e "Sair" fora do modo demonstração não se repetem.
- **Modos de canto:** filtros, chips, seletores, selos e menus passam a seguir Retos/Semi/Arredondados.
- **Toque e leitura:** alvos ≥ 44px (repetição, rádios, rodapés legais, seletor da demo), campos de Ajustes com 16px (sem zoom no iPhone), interruptor desligado visível, textos de 9–11px em informação de leitura aumentados.
- **Layout:** lista de serviços sem sobreposição no celular, Editar/Excluir da equipe, data da agenda sem invadir a seta, barra inferior alinhada à coluna no computador, matriz de permissões com rolagem própria, gráficos da plataforma na paleta do tema, títulos de seção padronizados, títulos repetidos removidos.

Ferramenta de captura (fora do repositório): login de admin simulado no Playwright + `/demo?view=…`. Só frontend; nenhuma mudança de banco.

## Ajuste — CEP com preenchimento automático do endereço da barbearia (03/10, noite)

Em Ajustes → Página pública (`LandingEditor`), bloco "Preencher pelo CEP" (`CepAddressHelper.tsx`, lógica pura em `src/lib/address/postal-code.ts` com testes): máscara 00000-000, busca automática no ViaCEP ao completar 8 dígitos (e botão Buscar), timeout de 6 s, mensagens de não encontrado/sem conexão; preenche rua, bairro, cidade e UF (editáveis), foco em Número, complemento opcional; monta o texto em `landing.address` (≤160, sem chave nova no banco). Endereço já salvo só é trocado em "Usar este endereço"; CEP presente no texto salvo é pré-preenchido. A requisição não envia cookies nem referrer. **Portugal fora**: GeoAPI.pt sem chave aceita só 5 consultas/dia por IP; o bloco some em lojas com fuso de Portugal. Política de Privacidade (5 idiomas, seção de compartilhamento) explica a consulta ao ViaCEP (só o CEP; o serviço vê o IP). `PRIVACY_VERSION` não alterada (acréscimo informativo, sem nova coleta — não pede novo aceite). Só frontend.

## Ajuste — layout da página Entrar/Cadastrar (03/10, noite)

Relato do dono: a página quebrava o formulário ou rolava à toa. Medido antes: no computador (modelo dividido) o título da foto cortava no rodapé e o "Criar conta" ficava abaixo da dobra (documento 1265px em 1440×900); no celular a foto do topo (14rem) fazia até o "Entrar" rolar.

- Regras novas em `.auth-page` (só a página real; a prévia em Ajustes mantém as antigas): foto fixa na altura da tela com título fluido; coluna do formulário até 33rem, centralizada; **cadastro em 2 colunas** quando cabe (nome | e-mail, WhatsApp | ajuda; interruptor e senha em linha inteira; mesma ordem de teclado); "Esqueci a senha" na linha do rótulo "Senha"; espaçamentos encolhem em telas baixas; faixa da foto no celular 9rem; botões de idioma/tema sem sobrepor; `overflow: clip` no contêiner.
- **Tema escuro:** a cor de marca escura sumia no painel escuro (botão principal, "BEM-VINDO DE VOLTA", "Esqueci a senha", foco, interruptor) — em `.dark .auth-page .auth-brand-panel` o `--primary` vira um tom claro da marca com texto escuro. Decisão visual: marcas de cor viva aparecem clareadas no escuro, não na cor literal.
- Depois (dividido): Entrar sem rolagem em 390×844, 1024×768, 1280×720, 1440×900, 1920×1080; Cadastrar com "Criar conta" visível em 1280×720 (684px), 1440×900 (723px) e sem rolagem em 1920×1080. Capa e cartão: Entrar ainda rola 25–78px em 1024×768 e 1280×720 (pela página, sem cortes). Nenhuma rolagem interna, corte ou rolagem horizontal nas combinações medidas.
- Não verificado: aparelho real com teclado aberto e safe-area do iOS. No celular de 360px o texto de exemplo "Mínimo 6 caracteres" corta (já existia).

## Ajuste — WhatsApp obrigatório no cadastro do cliente (03/10, noite)

Pedido do dono: o WhatsApp deixa de ser opcional no cadastro do cliente por e-mail (com ou sem link da loja) e os avisos vêm **ligados por padrão** — o interruptor "Quero receber confirmação e lembretes pelo WhatsApp" aparece sempre, ligado, e a pessoa decide se mantém (também em Meu perfil). Quem entra pelo Google informa depois (cartão de confirmação no app). Política de Privacidade (`legal.privacy.s2Item2`, 5 idiomas) atualizada: obrigatório no cadastro por e-mail, avisos ligados por padrão e só para número confirmado. Chave `auth.field.whatsappSignupOptional` removida. Só frontend.

## Entrega — decisões do dono aplicadas (03/10, noite, Claude Code)

Dono decidiu aplicar as quatro recomendações. **Frontend publicado; banco e `register-shop` pendentes** — guia: [implantacao-decisoes-2026-10-03.md](implantacao-decisoes-2026-10-03.md) (vem depois do guia dos ajustes finais).

- **Avisos por WhatsApp só para número confirmado** (`20261003230000`): `enqueue_whatsapp_message` só enfileira aviso a cliente (destinatário por `customer_id`/`appointment_id`) se o número for o dele **e** estiver confirmado; avisos de equipe/dono inalterados; pendentes na fila para não confirmados viram `failed`. App do cliente: cartão "Confirme seu WhatsApp para receber lembretes" (`WhatsappConfirmBanner`) que abre o fluxo existente; aviso equivalente para dono/sócio em Ajustes.
- **Aceite para contas antigas:** `TermsUpdateGate` mostra uma vez, após o login, "Atualizamos os Termos e a Política" (com Acordo de Dados para dono/sócio) quando falta aceite ou a versão mudou; "Agora não" adia para a próxima sessão; fora da demo, das páginas legais e de quem não está logado; com banco antigo não aparece.
- **MCP de exemplo removido:** ferramenta fictícia `list_matches`, rotas `/.mcp/*`, `/.well-known/oauth-protected-resource`, `/.lovable/oauth/consent` e `mcpPlugin` do `vite.config.ts`; chaves `app.consent.*` removidas. Nada do produto dependia. `/mcp` cai na rota de barbearia (loja inexistente). O pacote `@lovable.dev/mcp-js` ficou no `package.json` (sem uso; remover com `npm uninstall @lovable.dev/mcp-js` e tirar de `bunfig.toml` quando for conveniente — não feito para não mexer em lockfile sem build no Hostinger).
- **Fuso da loja:** cadastro do dono detecta o fuso do aparelho ("Horário da barbearia: … (alterar)", Brasil e Portugal) e envia ao `register-shop`; Ajustes ganha seletor (`ShopTimezoneCard`) que usa `set_shop_timezone` (governança: dono único/majoritário aplica; sociedade igualitária vira pedido, mostrado como pendente; rótulo `team.gov.kind.shopTimezone`). Sem a RPC, o cartão fica em leitura ("disponível em breve"). Painel só usa o fuso novo após recarregar.
- **Tema escuro do `/cadastrar`:** etapas, ícone e caixa de aceite ilegíveis no escuro (painel é sempre claro, mas usava tokens do tema) — cores fixas e `color-scheme: light` no `.platform-register-panel`.
- Validado em cópia local no estado da produção, **com e sem a 220000**: ensaio 43 PASS; 230000 aplicada duas vezes; suítes antigas idênticas antes/depois; `ajustes_finais.sql` atualizado (25 PASS antes e depois); privilégios `f|t|2`. tsc, 148 testes, eslint, build; `/cadastrar` a 390px claro e escuro com fuso detectado (São Paulo e Manaus). **Não verificado com login real:** janela de aceite, cartão de WhatsApp, troca de fuso em Ajustes.
- Restam com o dono: revisão do Acordo de Dados por advogado.

## Entrega — ajustes finais de 03/10 (noite, Claude Code)

Pendências que não dependiam do agente da VPS, mais correções de banco/servidor preparadas e testadas. **Frontend publicado; banco e funções pendentes** — guia: [implantacao-ajustes-finais-2026-10-03.md](implantacao-ajustes-finais-2026-10-03.md).

- **Telas:** título e descrição de `/privacidade`, `/termos` e `/acordo-de-dados` no idioma do `?lang=` já no HTML do servidor (`src/features/legal/legal-head.ts`); "Mostrar guia de configuração" em Ajustes para dono/sócio quando o guia foi escondido; editor de modelos do WhatsApp avisa (em vez de bloquear) quando o texto preenchido passa de 1000 caracteres — o servidor corta com "…"; só bloqueia modelo acima de 1000 sem variáveis (regra do banco). Chaves sem uso removidas.
- **Banco (`20261003220000_ajustes_finais.sql`, não aplicada):** `validate_shop_ownership` permite apagar a loja inteira (SECURITY DEFINER; regra mantida para lojas existentes, inclusive dono saindo sob RLS); `save_my_whatsapp` sem revelar número confirmado em outra conta (grava sem confirmação); `enqueue_whatsapp_message` não envia a número confirmado em outra conta (destinatário pelo `customer_id`/`appointment_id` do pacote); `purge_auth_otp_challenges()` (7 dias, só service_role) chamada pela `whatsapp-dispatch` uma vez por hora. **Funções:** `google-connect` (janela da Agenda presa a −7/+60 dias), `whatsapp-dispatch` (limpeza; ignora se a função não existir).
- **Testes:** novo `ajustes_finais.sql` (25 PASS); `correcoes_auditoria.sql` agora vale antes e depois da 180000 (10 PASS no estado atual); `privacy_requests.sql` cria a coluna `auth.users.phone` só se faltar (em produção existe; na cópia local sem GoTrue precisa rodar como `supabase_admin`: 43 PASS).
- **Validado em cópia local** no estado atual da produção (82 migrations): ensaio 25 PASS como `postgres` e `supabase_admin`; aplicação e reaplicação ok; 29 suítes idênticas antes/depois da migration (todas passam; `privacy_requests` só como `supabase_admin`, ver acima); tsc, 143 testes, eslint, build; títulos legais por idioma conferidos no HTML.
- **Decisões que ficaram com o dono:** resolvidas na entrega seguinte ("decisões do dono aplicadas").

## Entrega — cadastro de cliente e dono: aceite, nome, WhatsApp, guia da loja (03/10/2026, noite, Claude Code)

Motivada pela análise dos formulários (cliente e dono). Guia: [implantacao-cadastro-2026-10-03.md](implantacao-cadastro-2026-10-03.md).

- **Aplicado em produção às 19:34 PT de 03/10** pelo agente da VPS (stack `z2dbb7…`, HEAD `ddf9fbb`): backup `/root/backup-barba-cabelo-20261003-2233.dump` (1,1 MB, 19:33 PT); ensaio 27 PASS, `SLUG vinicius acao-cia`, ROLLBACK; migrations `20261003200000_cadastro_aceite` e `20261003210000_slugify_acentos`, depois `NOTIFY pgrst`; privilégios `f|f` (anon sem EXECUTE em `record_my_terms_acceptance`, usuário sem UPDATE no aceite); `register-shop` e `google-connect` republicadas, OPTIONS 200 (`google-connect` sem mudança em relação a `0a1ad57`). VPS continua sem push no GitHub — registro feito pelo Claude Code.
- **Cliente (`/auth`):** campo obrigatório "Como você quer ser chamado?"; WhatsApp com máscara e conferência de DDD (Brasil; Portugal com +351), texto de ajuda claro, interruptor de avisos visível ao digitar o número (no lugar do aceite automático); WhatsApp vai nos metadados do cadastro (não se perde mais quando o e-mail precisa de confirmação) e é retomado no primeiro login; aceite logo acima de "Criar conta" com declaração de idade; aceite registrado também no Google (conta nova). Validação: nome/WhatsApp com mensagem traduzida ao lado do campo antes da checagem do navegador (form `noValidate` no cadastro + `reportValidity`). `NamePrompt` no app do cliente para quem está sem nome ou com nome = começo do e-mail (dispensável).
- **Dono (`/cadastrar`):** caixa de aceite obrigatória (Termos, Política, **Acordo de Tratamento de Dados**, 18+ e representação); prévia do link da loja; "Este WhatsApp também é o da barbearia?" (Sim grava em `barbershop_settings.landing.whatsapp`); mostrar senha; erros por campo; sociedade recolhida ("não tenho sócios").
- **Painel:** `ShopSetupChecklist` "Deixe sua barbearia pronta" (horários, 1º serviço, endereço e WhatsApp, logo/cores, copiar link) para dono/sócio, some ao concluir. Limitações: "Está certo" dos horários e "link copiado" ficam no aparelho (localStorage); depois de "Esconder guia" não há botão para mostrar de novo.
- **Legal:** nova página `/acordo-de-dados` (5 idiomas) — **rascunho que precisa de revisão de advogado** (foro, menção ao RGPD art. 28, arts. 33/34 no pt-PT). Política e Termos ajustados; versões em `src/features/legal/versions.ts`.
- **Banco (não aplicado):** `20261003200000_cadastro_aceite.sql` (colunas de aceite em `profiles` sem UPDATE pelo usuário; `handle_new_user` lê nome/aceite/idade/WhatsApp não verificado; RPC `record_my_terms_acceptance`) e `20261003210000_slugify_acentos.sql` (`slugify_pt` trocava í→e, ç→y; links novos saem certos, antigos não mudam). Teste `supabase/tests/cadastro_aceite.sql`. **Validado em cópia local** no estado atual da produção (80 migrations): 27 PASS, aplicação e reaplicação ok, 27 testes antigos idênticos antes/depois, `anon` sem EXECUTE, usuário sem UPDATE no aceite.
- Verificado: tsc, 142 testes (inclui `signup-phone`, `owner-signup`, `integrations/friendly-error`), eslint, build; telas `/auth` (cadastro) e `/cadastrar` a 390px sem rolagem lateral nem erro no console. **Não verificado:** cadastro real ponta a ponta, guia da loja com login, tema escuro do `/auth`.
- Pendências: `register-shop` ainda grava avisos do dono com opt-in fixo; fuso horário da loja fixo em São Paulo; contas Google antigas sem aceite registrado.

## Google — projeto real do app e aviso antigo na tela (03/10, noite)

- **Projeto do Google Cloud em uso:** o cliente OAuth do servidor (`GOOGLE_OAUTH_CLIENT_ID` = `GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID`, login e Agenda) é do projeto **`proh-media-drive` (nº `1072350331037`)**, não do `barba-e-cabelo` (`712948893200`). A **verificação OAuth vale para `proh-media-drive`** — é lá que a tela de permissão, a marca, os links de política/termos e o reenvio precisam estar. O `barba-e-cabelo` não é usado pelo app.
- A Agenda não listava porque a Calendar API estava desativada em `proh-media-drive` (`last_error` 18:18 PT). Calendar API e People API ativadas lá pelo dono; lista voltou. Cliente do servidor não foi trocado.
- O aviso "A Agenda Google não está ativada…" continuava na tela porque vinha do `google_connections.last_error` gravado, que só era apagado ao escolher agenda/sincronizar. Agora a listagem bem-sucedida apaga o aviso na tela (`GoogleIntegrationsCard`, publicado) e no banco (`google-connect` → `list_calendars`; **precisa publicar a função** para valer no banco — até lá o aviso pisca ao abrir e some quando a lista carrega, e some de vez ao escolher a agenda).

## Correção — aviso "Essa agenda não está disponível nesta conta Google" (03/10, noite)

Relato do dono: o aviso aparecia e o seletor de agenda não deixava trocar. O mapa de erros (`src/lib/integrations/friendly-error.ts`) traduzia **qualquer** texto com `calendar … not` para "agenda indisponível" — inclusive o erro do Google quando a **Google Calendar API não está ativada no projeto do Google Cloud** ("has not been used in project … or it is disabled"). Nesse caso `list_calendars` falha, a lista fica vazia e o `<select>` fica desativado (o "nada acontece"). Também "Conexão Google expirada"/`invalid_grant` caía em "sessão expirada" (mandava entrar no app de novo, o que não resolve).

- Agora: mensagens próprias e acionáveis para API desativada (`errors.integration.googleApiDisabled`), permissão da Agenda não marcada no consentimento (`googleScopeMissing`) e token vencido/revogado (`googleReconnect`); "agenda indisponível" só para a resposta real do `set_calendar`. Testes em `src/lib/integrations/friendly-error.test.ts` (4). Só frontend.
- **Causa no servidor ainda não confirmada** (sem acesso aos logs daqui): ver o texto novo que a tela mostrar, ou `select last_error from google_connections` / `docker logs` do container de funções. Se for API desativada: Google Cloud → APIs e serviços → ativar **Google Calendar API** (e **People API**, usada por Contatos) no **mesmo projeto do client OAuth**.

## Implantação aplicada em produção — entregas de 03/10/2026 (03/10, 17:44 PT)

Executada pelo agente da VPS (Grok) na stack `z2dbb7…`, com o repositório em `2223949`, seguindo [implantacao-2026-10-03.md](implantacao-2026-10-03.md). Registro feito pelo Claude Code, porque a VPS não tem credencial de push no GitHub (`vez.sh pedir` falhou com `could not read Username for 'https://github.com'`; o fetch público funciona). **Pendência operacional:** dar à VPS um acesso de push (deploy key com escrita ou token) ou registrar sempre por uma máquina com push.

- **Backup** novo antes de aplicar (o anterior era `/root/backup-barba-cabelo-20261003-1943.dump`).
- **Limpeza do incidente (passo 3b):** `loja=1 usuarios=5 ligados_a_loja=4 vinculos_em_loja_real=0`, `LIMPEZA OK`, `COMMIT`; trava `shop_ownership_total` religada (`tgenabled = O`); loja `Loyalty test`: 0.
- **Ensaio obrigatório:** 10 PASS, `ROLLBACK`.
- **Migrations aplicadas:** `20261003150000_correcoes_auditoria`, `20261003160000_otp_tentativas`, `20261003170000_pendencias_edge_whatsapp`, `20261003180000_verificar_whatsapp_perfil` (`UPDATE 2`: dois números já gravados marcados como confirmados), `20261003190000_google_tokens_e_eventos`; depois `NOTIFY pgrst, 'reload schema'`.
- **Conferência do banco (passo 6):** os 4 objetos novos existem; `anon` sem EXECUTE nas seis funções conferidas; WhatsApp repetido entre contas: 0.
- **Edge functions publicadas** (volume Coolify, restart só do container de funções): `_shared`, `auth-otp`, `register-shop`, `shop-domain`, `domain-verify`, `google-connect`, `google-calendar-dispatch`, `invite-shop-admin`. `OPTIONS` das 6 chamadas pelo app: HTTP 200.
- **Tokens do Google:** `google_connections` pela API pública responde 401 (anon e authenticated sem SELECT); nenhum token exposto.
- **Página legal:** `/privacidade?lang=en` responde 200 em inglês, mas o `<title>` da aba continua em português (o `head` da rota é fixo). Pendência pequena; não afeta o conteúdo avaliado pelo Google.
- **Não rodado:** `privacy_requests.sql` (já falhava antes da entrega: `column "phone"`); testes opcionais do passo 4.
- **Não verificado ainda com uso real:** login/recuperação e confirmação por WhatsApp, Desconectar do Google com revogação, lista de eventos importados, saída de barbearia (`request_shop_departure` corrigida). Conferir com login real antes de gravar o vídeo do Google ([google-verificacao.md](google-verificacao.md)).

## Incidente — teste rodado fora de transação no banco de produção (03/10, 17:19 PT)

No ensaio opcional, `loyalty_program_module.sql` foi rodado em autocommit: parou em `Not allowed` (o usuário simulado por `set_config(..., true)` só vale dentro da transação) e deixou a loja `Loyalty test` (`loy-0006dc22-…`), 5 usuários `@example.invalid` e dependentes. A tentativa de limpeza esbarrou em `validate_shop_ownership` (gatilho DEFERRED que **não prevê a exclusão da loja inteira** — pendência: hoje é impossível apagar uma loja com dono sem desligá-lo). Script testado: `supabase/manutencao/2026-10-03_limpeza_fixture_loyalty.sql` (passo 3b do guia de implantação), validado em cópia local reproduzindo o incidente: banco volta idêntico. Guia agora traz o comando exato dos testes opcionais, sempre em `BEGIN … ROLLBACK`.

## Correção — ensaio da implantação de 03/10 (noite, Claude Code)

O ensaio no servidor (backup `/root/backup-barba-cabelo-20261003-1943.dump`, nada aplicado) parou em `column reference "status" is ambiguous` dentro de `request_shop_departure`: a variável local `status` tinha o nome da coluna, e o `WHERE` do `UPDATE` falhava **em qualquer modo — em produção, ninguém consegue sair de uma barbearia** desde 22/09. A `20261003150000` (ainda não aplicada) agora recria a função com `v_status` e colunas qualificadas, mesmas regras e permissões. O teste `correcoes_auditoria.sql` tinha `'confirmed'`/`'pending'` sem tipo num `UNION ALL` (texto × `appointment_status`); tipados.

- Verificado num Postgres local `supabase/postgres:15.8.1.085` com as 75 migrations de produção + admin de plataforma de teste: ensaio do guia com 10 PASS e ROLLBACK; aplicação real das 5 migrations uma a uma; reaplicação sem erro; privilégios do passo 6 (`google_connections` sem SELECT para anon/authenticated; funções novas sem EXECUTE para anon); 27 testes SQL antigos (com as cadeias de reservas) **idênticos antes e depois** — 26 passam, `privacy_requests.sql` já falhava antes (`column "phone"`, teste desatualizado).
- Limitação do ambiente local: `storage` da imagem é mais simples que o do servidor (colunas completadas à mão só no local); auth.users mínimo.

## Entrega — política de privacidade para o Google e pendências da auditoria (03/10/2026, Claude Code)

Motivo: verificação OAuth do Google reprovada em "Requisitos da política de privacidade" ("não especifica mecanismos de proteção de dados sensíveis") e "Funcionalidade do app" (sem detalhe). Guia completo para reenviar, com roteiro do vídeo e textos em inglês: [google-verificacao.md](google-verificacao.md).

- **/privacidade reescrita (13 seções, 5 idiomas):** seção de segurança e proteção de dados sensíveis, dados do Google por escopo, Uso Limitado, LGPD (base legal, art. 18, art. 48, DPO), suboperadores, retenção, navegador/cookies, menores. Só afirma o que foi conferido no código. **Não afirma** criptografia em repouso dos tokens nem backups (não existem/sem evidência). Idioma detectado pelo navegador só nas páginas legais (`src/features/legal/legal-locale.ts`, `?lang=en`, hreflang); `/termos` igual.
- **/politica (Clube):** aceita `?shop=`, mostra o programa real da loja para quem tem vínculo; sem loja, texto genérico sem "Arena".
- **Google:** Desconectar agora revoga no Google (`oauth2.googleapis.com/revoke`); excluir a conta pede a revogação antes; tokens saem da leitura por usuário (só service role); import não grava mais `raw`/`description`; cartão de integrações mostra "Próximos eventos da Agenda Google" (RPC `list_my_google_calendar_events`). Escopos não mudaram (mudar reabriria a revisão).
- **WhatsApp:** número do perfil confirmado por código (`auth-otp` purpose `verify_phone`, `WhatsappProfileCard`, passo no cadastro em `/auth`, pode "confirmar depois"); unicidade só entre números confirmados; `register-shop` com limite de tentativas e checagem só de números confirmados; mensagens acima de 1000 caracteres são cortadas no servidor; `error_code` estáveis nas funções e no `friendly-error.ts`; `domain-verify` não derruba domínio ativo.
- **Aplicadas em 03/10 17:44 PT (ver "Implantação aplicada em produção"); antes:** aplicar no Postgres Coolify, nesta ordem (depois das de 03/10 da entrega anterior, se ainda não aplicadas — 150000 e 160000): `20261003170000_pendencias_edge_whatsapp.sql`, `20261003180000_verificar_whatsapp_perfil.sql`, `20261003190000_google_tokens_e_eventos.sql`. Testar em begin…rollback antes. Atenção: `supabase/tests/correcoes_auditoria.sql` tem a asserção "WhatsApp de outra conta é recusado", que deixa de valer depois da 180000 (número sem código não bloqueia) — rodar antes dela ou atualizar.
- **Publicadas em 03/10 17:44 PT; antes:** publicar Edge functions (volume Coolify + restart), depois das migrations: `auth-otp`, `register-shop`, `shop-domain`, `domain-verify`, `google-connect`, `google-calendar-dispatch` (só pelo `_shared/google.ts` novo), `invite-shop-admin` (da entrega anterior). Sem deno local: não compiladas por deno (esbuild/eslint ok).
- **Riscos/pendências conhecidos:** `save_my_whatsapp` ainda revela por 23505 se um número confirmado é de outra conta (sem limite); números gravados sem código continuam recebendo avisos de loja (decidir se avisos exigem número verificado); `sync_calendar` aceita `time_min/time_max` do cliente (ideal limitar a 7/60 dias no servidor); `auth_otp_challenges` sem limpeza periódica; logs de 6 meses (Marco Civil) e VPN do painel citados a partir da documentação de operação — conferir no servidor; `WhatsAppSettingsCard` ainda bloqueia salvar texto que passaria de 1000 com variáveis (poderia virar só alerta); chaves sem uso: `fix.ajustes-marca.waTooLongFilled`, `auth.info.createdWithWhatsapp`, `fix.fidelidade-insights.policyTiersNotice/policyPointRate`.
- Verificado: tsc, 128 testes, eslint em `src` e nas funções alteradas, build; páginas legais em Chrome headless (en-US, es-ES, pt-BR, `?lang=en`, 390px). **Não verificado com login real nem no celular**; nada de banco/funções foi executado.

## Entrega — auditoria e correção de 115 bugs (03/10/2026, Claude Code)

Auditoria por área (124 achados, 115 confirmados por verificação adversarial) e correção de todos. Frontend publicado; banco e Edge functions aplicados em 03/10 17:44 PT pelo agente da VPS.

- **Aplicadas em 03/10 17:44 PT (ver "Implantação aplicada em produção"); antes estavam pendentes no Postgres Coolify (nesta ordem, testar antes em begin…rollback):**
  1. `20261003150000_correcoes_auditoria.sql` (teste `supabase/tests/correcoes_auditoria.sql`, não executado — sem Postgres local; sintaxe validada com pglast). Corrige: cancelar atendimento já iniciado; `create_own_barbershop`; `request_shop_departure`/`complete_shop_departure` para contratado/sócio no modo leave; `delete_my_account` de ex-profissional; `mark_shop_domain_status` sem anon; unicidade e `save_my_whatsapp` (sem UPDATE direto); `stop_booking_series` só do próprio profissional; lembrete por e-mail sem depender de WhatsApp; ritmo do cliente/parceiro no fuso da loja; `get_team_schedule` com clientes que excluíram a conta (+ UPDATE que libera reservas órfãs aguardando remarcação); `handle_new_user` sem vincular todo mundo à Arena; recorrência/remarcação respeitando prazo e grade; `request_shop_change` só aceita `account_manager` de gerente real. Se houver WhatsApp repetido na base, o índice único não é criado (NOTICE) — limpar e reaplicar.
  2. `20261003160000_otp_tentativas.sql` (RPC `auth_otp_check_code`, limite de 5 erros por desafio). **Aplicar antes** de publicar a Edge `auth-otp`.
- **Publicadas em 03/10 17:44 PT; antes pendentes no volume Coolify (+ restart):** `auth-otp` (recuperação por WhatsApp não aceita mais instância de loja para tomar conta; limite de tentativas; não revela se o número tem conta; exige `PLATFORM_EVOLUTION_INSTANCE`), `invite-shop-admin` (busca de usuário paginada; não renomeia perfil global), `shop-domain` (falha passageira de DNS não desativa domínio ativo). Sem deno local: tipos das funções não conferidos.
- **Frontend (publicado):** app do cliente (remarcar sem trocar serviço, reservas só da loja aberta, Repetir com link direto, link de profissional que mudou de loja, fuso e virada de dia, foco do modal do Clube), painel (agenda da equipe recarrega e mostra cancelados, Ajustes para parceiro/funcionário, ações que sempre falhavam escondidas, corrida ao trocar de dia), ajustes/marca (arquivos antigos só apagados após gravar, modelos do WhatsApp não sobrescritos, confirmação ao desvincular, domínio/TXT), auth (`return_origin` só para plataforma e domínios cadastrados, loop do gerente de contas, redirecionamento de `/` no cliente e para `shop_members`, cadastro que travava), visual (modo de canto em AlertDialog/Dialog, tema escuro, safe-area, janelas no celular, banner do PWA), service worker (manifest único, `/` fora do precache), i18n (chaves `fix.*` nos 5 idiomas; plurais One/Many).
- **Ficou de fora (decisão/escopo):** códigos de erro estáveis nas Edge functions (cliente mapeia os textos atuais); força bruta de OTP em `register-shop` e rebaixamento em `domain-verify` (mesmo padrão — `auth_otp_check_code` já serve); limite por IP; truncamento do WhatsApp no servidor (`render_whatsapp_template`); `/politica` ainda genérica (textos `legal.club.*` citam Arena); MCP de exemplo (`list_matches`) — decidir se sai do produto; verificação por código do WhatsApp gravado no perfil.
- Verificado: tsc, 124 testes, eslint em `src` e nas funções alteradas, build; `sw.js` com manifest uma vez e sem `/` no precache. **Não verificado no navegador nem com login real.**

## Entrega — forma de oferecer os horários por barbearia (02/10/2026, noite)

Migration `20261002210000_slot_offer_mode.sql` (**aplicada**; Arena e Externa ficaram em `flexible`/15). Teste novo `supabase/tests/slot_offer_mode.sql` (26).

- **Configuração:** `barbershop_settings.slot_mode` (`flexible` padrão, `literal`, `custom`) e `slot_step_minutes` (10, 15, 20, 30, 45 ou 60; só usado em `custom`). Não está na lista visual de `settings_change_is_visual`, então segue a mesma aprovação das outras configurações de agendamento; `apply_shop_change('settings.operational')` grava os dois campos. Trocar o modo gera sinal em `availability_signals` (telas recarregam).
- **Regra exata (fonte única):** `slot_candidate_starts(staff, dia, duração)` monta a grade e `available_slots_internal` desconta atendimentos, esperas válidas e o que já passou. Passo: flexível 15 min; literal = duração do profissional no serviço; ajustável = `slot_step_minutes`. **A contagem começa na abertura e recomeça no fim de cada bloqueio** (almoço/folga da loja ou do profissional) — não há intervalo de almoço em `business_hours`, ele é um bloqueio. Atendimentos não reiniciam a contagem, só ocupam. Só entram inícios em que o serviço inteiro cabe antes do próximo compromisso, do bloqueio ou do fechamento. Ex. (9:00–19:00, Corte 9:00–9:30, almoço 12:30–13:15, Combo 60): flexível 9:30, 9:45… 11:30, 13:15…; literal 10:00, 11:00, 13:15, 14:15… 17:15; ajustável 20 9:40, 10:00… 11:20, 13:15, 13:35… 17:55. No flexível, a única diferença para antes é recomeçar no fim de bloqueio que termine fora do quarto de hora.
- **Validação da reserva (cliente):** o gatilho `appointments_enforce_service_terms` agora também recusa (`22023`, “Esse horário não está entre os oferecidos pela barbearia”) início fora da grade atual, só quando muda horário/profissional/serviço. Não confere: mudança só de status (cancelar, confirmar, restaurar), recorrência (`series_id`), vaga resgatada da espera (`slot_waits` `claimed` do próprio cliente), horário passado/fora do expediente/em bloqueio (fica para `appointments_validate_booking`, com a mensagem específica). Dono/sócio/gerente continuam livres. Página pública, “Qualquer profissional” e app seguem o modo; `get_public_shop_landing.today` traz `slot_mode` e `step_minutes` (nulo no literal).
- **Tela:** Ajustes → Agendamento, cartão “Como os horários aparecem” (`src/features/shop/settings/SlotModeSettings.tsx`): três opções de escolha única com exemplo calculado com o expediente e os serviços reais (mais longo e mais curto), seletor de minutos só no Ajustável, prévia (“Se já houver um Corte das 9:00 às 9:30, o Combo aparece a partir das…”), consequência do modo, aviso de bloqueio/almoço e escopo, botão “Salvar forma dos horários” (pedido pendente quando precisa de aprovação). Aviso curto `SlotModeNotice` em **Horários** (abaixo de “Salvar funcionamento”) e em **Serviços** (abaixo dos filtros), com o texto do modo atual e atalho “Mudar a forma dos horários” (só para quem pode mexer em Ajustes). Textos `slots.*` nos dicionários.
- **Cliente/demonstração:** `buildSlotsForWindow` recebe a regra (`slotRuleFromSettings` + bloqueios) e espelha o banco; `previewSlotMinutes` gera os exemplos. Testes node com o mesmo cenário do SQL.
- Verificado: tipos, 124 testes, lint, build; SQL em rollback com a migration (cadeia booking 29 → ocorrências → autoconfirmação 57; demais dependentes de booking; independentes; novo 26) — todos passando. Navegador 390×844 na demonstração: aviso em Horários e Serviços, atalho abre Ajustes → Agendamento, trocar para literal mudou o app do cliente (Combo 9:00, 10:00… e Corte de 30 em 30) e para ajustável 20 (9:00, 9:20, 9:40…); voltou para flexível. `/b/arena-barber` carregando normal depois da migration. **Não verificado:** salvar com login real de dono/sócio (pedido de aprovação) e reserva real pelo app.
- **Corrigido em 03/10/2026 — horário de funcionamento pelo painel falhava desde 24/09:** o ramo `hours.replace` de `apply_shop_change` gravava em `open_time`/`close_time` (colunas inexistentes em `business_hours`; o certo é `opens_at`/`closes_at`) e descartava `is_open`. Como `request_shop_change` chama essa função tanto para o dono majoritário (aplica na hora) quanto na aprovação pelo sócio, **todo salvamento de horário pelo painel dava erro** `column open_time does not exist`. Migration `20261003130000_fix_hours_replace.sql` (**aplicada**) volta ao upsert por dia com `is_open/opens_at/closes_at`, só nesse ramo; permissões da função mantidas (sem anon/authenticated). Teste novo `hours_replace_change.sql` (12): dono aplica na hora, sócio com partes iguais abre pedido e a aprovação grava, dias fechados respeitados, colaborador comum recusado, fechar antes de abrir recusado. Reproduzido antes da correção (mesmo teste falha com o erro acima). Não havia nenhum pedido `hours.replace` gravado em produção para reparar. Não conferido: salvar pela tela com login real de dono.

## Entrega — regras de agendamento numa fonte só e atualização instantânea (02/10/2026, noite)

Publicado no commit `c2670d0` (salvo pelo autossave do Cursor). Migration `20261002190000_booking_rules_single_source.sql` (**aplicada**); teste novo `supabase/tests/booking_rules_single_source.sql` (33).

- **Quem faz o quê:** se a loja tem qualquer linha em `staff_services`, só faz o serviço quem tem a linha ativa, com a duração e o preço dessa linha; loja sem nenhuma linha = todos os profissionais ativos fazem todos os serviços, com os valores do catálogo. Funções internas `staff_service_terms`, `shop_uses_staff_services`. Na Arena, Marcos tem 3 serviços e alyson-viana nenhum (não aparece para agendar).
- **Banco valida duração e preço:** gatilho `appointments_enforce_service_terms` (BEFORE, roda antes dos de validação e espera) para quem não é dono/sócio/`view_agenda_all`/sistema: recalcula `ends_at` pela duração do profissional, grava o preço da regra (na criação ou quando muda serviço/profissional; mudança só de status mantém o preço), recusa profissional que não faz o serviço (`22023`) e dia fora do prazo `booking_horizon_days` (fora de séries). O painel do dono continua livre para ajustar.
- **Remarcar** (`reschedule_own_appointment`) recalcula término e preço e ignora o término enviado. `create_direct_appointment`, `create_booking_series`, `materialize_booking_series` e `waiting_action` usam a mesma regra; a série deixou de tratar espera vencida como ocupada.
- **Horários numa fonte só:** `available_slots_internal` (candidatos de 15 em 15 min desde a abertura, cabendo o serviço inteiro antes do fechamento, só depois de agora e dentro do prazo, descontando atendimentos, bloqueios e esperas válidas). Expostas a logados: `get_available_slots(shop, service, date, staff?)` e `get_booking_terms(shop)`. `pick_available_staff` (“Qualquer profissional”, inclusive o favorito) só escolhe quem tem o horário nessa função. O app do cliente busca os horários por ela; a demonstração continua calculando no navegador com `buildSlotsForWindow` (agora de 15 em 15 min), com teste de paridade com o cenário do SQL.
- **Página pública:** `get_public_shop_landing` usa a mesma função; cartão mostra “Livres hoje · serviços a partir de X min” (serviço mais curto do profissional), nunca horário que termine depois do fechamento, e “Ainda sem serviços para agendar pelo app” para quem não tem serviço (`offers_services`, `min_duration_minutes`). Teste `public_shop_landing.sql` agora 32.
- **App do cliente:** lista só profissionais que fazem o serviço (escolhe o primeiro elegível sozinho), resumo e reserva com duração/preço do profissional, link direto respeitando a regra, filtro Manhã/Tarde/Noite por `shopHour`, lista de espera (`WaitingUI`) com datas e horas no fuso da loja.
- **Atualização instantânea:** tabela sem dados pessoais `availability_signals` (loja, profissional, horário da mudança), preenchida por gatilhos em agendamentos, bloqueios, esperas, horário de funcionamento, `staff_services` e `staff.active`; leitura pública, gravação só pelo banco, limpeza de sinais com mais de 1 dia; incluída na publicação `supabase_realtime`. Gancho `src/lib/shop/availability-signal.ts` (`useAvailabilitySignal`) usado no app do cliente, na agenda da barbearia e na página pública: ouve o Realtime e, sem conexão, consulta o último sinal a cada 15 s (e ao voltar para a aba); os recarregamentos periódicos antigos continuam como reserva.
- **Realtime religado em 02/10/2026 (~18h):** o container `realtime-dev-z2dbb7dkyzhc8vjiywq34mhn` tinha sido parado de propósito às 12h41 na rodada de alívio do servidor (`restart: "no"`). Foi religado sozinho, sem reiniciar banco/Kong/auth/rest/storage, trocando só a linha `restart` para `unless-stopped` no `docker-compose.yml` do serviço (backup `docker-compose.yml.bak-20261002`). Conferido pelo mesmo canal do app: sinal da Arena chegou em 12–94 ms após gravado. **Pendências (decisão do usuário):** a configuração salva no próprio Coolify ainda diz `restart: "no"` — um "Redeploy" desfaz a correção (o app volta ao fallback de ~15 s); e o realtime está sem limite de CPU/memória (sugestão: 0,5 CPU / 512 MB como o meta).
- **Teste do Google corrigido:** `google_calendar_push.sql` usava `current_date+2`, que caía num domingo e falhava independente desta entrega; agora usa sempre uma quarta.
- **Dado técnico inserido no banco real:** um sinal em `availability_signals` da Arena (`id=1`) para provar a atualização da página pública; some na limpeza de 1 dia. Nenhum dado de agenda foi alterado.
- Verificado: tipos, 119 testes, lint nos arquivos alterados, build; testes SQL em transação com rollback (todos os 23 existentes, inclusive booking 29, privacidade 43, ocorrências 45, autoconfirmação 57 em cadeia, pontos 46, página 32, Google 11; novo 33). No navegador (390×844): `/b/arena-barber` com “a partir de 30 min” e o profissional sem serviços; a página percebeu o sinal inserido e recarregou os horários em ~15 s; na demonstração, horários de 15 em 15 min coerentes com os atendimentos fictícios. **Não verificado:** Realtime real (servidor parado), agenda da barbearia e reserva real com login.
- **Pendência encontrada (já existia):** na demonstração, a escolha de profissional volta para o primeiro em menos de 1 s, porque o relógio da demo recria o contexto (`DemoContext.Provider value={{ ...state }}` em `DemoWorkspace.tsx`) e o efeito do catálogo da demo em `ArenaApp.tsx` (dependência `demo`) reinicia a seleção. Não afeta o app real.
- **Corrigido (02/10, noite):** o efeito do catálogo em `ArenaApp.tsx` agora depende só da loja da demonstração (`demoShopId`, lendo o estado por `demoRef`), então o tique do relógio (10 s) não reinicia profissional nem serviço; app real inalterado (lá a dependência já era estável). Verificado: tipos, 119 testes, lint, build; no navegador (390×844) “Bruno Oliveira” voltava para “Mestre Carlão” em ~3 s antes e ficou escolhido por 25 s depois, inclusive trocando para Barboterapia.

## Entrega — clube de pontos, página da barbearia e Ajustes reorganizados (02/10/2026)

- **Permissões das funções restauradas:** a cópia do banco para o stack novo tinha perdido os `REVOKE`s — funções com privilégio elevado estavam liberadas para visitantes anônimos. Migration `20261002105000_restore_function_grants.sql` (**aplicada**) reaplica cada `GRANT`/`REVOKE` declarado nas migrations anteriores.
- **Clube de pontos como módulo** (`20261002110000_loyalty_program_module.sql`, **aplicada**; teste `loyalty_program_module.sql`, 46):
  - Ligado/desligado por loja **só pelo admin da plataforma** (Plataforma → Barbearias, igual ao de esportes). Lojas que já tinham pontos ficaram ligadas. Desligado: congela créditos e novos resgates, sem apagar saldo nem histórico; o app do cliente esconde cartão, nível e extrato.
  - Regra padrão = níveis Classic/Select/Privilege/Exclusive (0/100/300/500) e 50 pontos por atendimento. A loja pode criar a **versão dela** (nomes, faixas, benefícios, pontos por atendimento, bônus de boas-vindas).
  - Proteções do cliente: crédito único por atendimento concluído e bônus único; cada crédito grava a versão da regra (mudar a regra não mexe no que já foi creditado); nível pelo total ganho na vida (trocar por prêmio não derruba nível); saldo nunca negativo; ajuste manual só dono/sócio, motivo ≥ 10 caracteres e limite de ±1000; resgate reserva os pontos e devolve se cancelado ou não entregue em 30 dias; até 3 resgates pendentes.
  - Página dedicada `/shop/pontos` (`src/features/loyalty/LoyaltyAdminPage.tsx`; atalho em Ajustes → Clube de pontos): Regras, Prêmios, Resgates e Clientes (ajuste manual com prévia do saldo). Regras e prêmios só para dono/sócio.
  - Cliente: Extrato de pontos com “Trocar pontos” (`CustomerRewards.tsx`), confirmação explicando reserva/30 dias/devolução e opção de desistir. A janela “Como funciona o clube” mostra a regra real da loja; saíram as promessas sem suporte (R$ 1 = 1 ponto, assinatura, lounge).
- **Página da barbearia** (`20261002120000_public_shop_landing.sql`, **aplicada**; teste `public_shop_landing.sql`, 24, inclui privacidade):
  - Aparece para visitante sem login na **raiz do endereço da loja** e em `/b/<slug>` (`ShopLanding.tsx`). Mostra capa (foto do login), logo, aberto/fechado, “Livres hoje” por profissional (até 12 horários, descontando atendimentos, bloqueios e reservas da espera; atualiza a cada 60 s), equipe, serviços, horário de funcionamento, sobre/contatos e “Entrar e agendar” (`/auth?next=/app?shop=…`).
  - Dados vêm de `get_public_shop_landing(p_shop_ref, p_host)` (anon), sem dado de cliente ou de conta. Configuração em `barbershop_settings.landing` (validada por `landing_config_valid`; conta como mudança visual na regra de aprovação).
  - Editor em Ajustes → Aparência → “Página da barbearia” (`LandingEditor.tsx`): liga/desliga, título, sobre, endereço, Instagram, WhatsApp, quais blocos mostrar, prévia ao vivo (lado a lado no computador; Editar/Prévia no celular), copiar/abrir link.
  - **Ajuste da tarde (02/10):** “Nossa equipe” e “Livres hoje” viraram **uma seção só**, com um cartão por profissional (foto ou inicial, nome, apresentação e horários livres de hoje, ou “Sem horários livres hoje”/“Sem atendimento hoje”). O **cartão inteiro é link** para o login com o profissional escolhido (`/auth?next=/app?shop=…&barber=…`), no padrão “link esticado” (pseudo-elemento do “Agendar com…”); os horários são links próprios por cima (`relative z-10`), sem `<a>` dentro de `<a>`; alvos de 44px e anel de foco no cartão. No banco as duas chaves continuam: `show_staff` liga a seção (desligada, a função não manda nenhum profissional) e `show_today` só controla os horários dentro do cartão — no editor ele fica recuado sob “Equipe” e desativado quando a equipe está desligada. Serviços mostram a **foto** do serviço ou o **ícone escolhido** (`ServiceIcon`, campo `services.icon`, que já vinha na função e agora entra no tipo/parse). Migration `20261002170000_public_shop_landing_team_cards.sql` (**aplicada**, grants anon/authenticated conferidos); teste `public_shop_landing.sql` agora com 28.
- **Foto do profissional não subia — causa e correção:** o diálogo de enquadrar a foto do barbeiro (`ServiceImageCropDialog` com `staffImageToCrop`) estava montado **dentro da aba Serviços** do `ShopShell.tsx`. Na aba Equipe, escolher a foto guardava o arquivo, mas o diálogo nunca aparecia, então o envio nunca acontecia (os registros do storage e do Kong não tinham nenhum `POST` de envio em 10 dias, e nenhum profissional tinha `avatar_url` no banco). Corrigido movendo o diálogo para a aba Equipe. O storage estava certo: bucket `barbershop-services` público (2 MB, png/jpeg/webp/svg), políticas de envio para dono/sócio/admin e funções das políticas com `EXECUTE` — inserção em `<loja>/staff/…` testada como o dono da Arena em transação com rollback. A gravação por mudança protegida (`apply_shop_change`, `staff.create/update`) já preserva `avatar_url`. Observação: o logo de uma loja aponta para `supabase-teste.proh.media` e a foto de um serviço para `supabasebeauty.contheiner.digital` (abre, 200) — dados antigos, não alterados.
- **Enquadramento inteligente das fotos (02/10, fim da tarde):** toda foto de serviço ou de profissional preenche o quadro e corta só o excesso (foto alta encaixa pela largura e corta a altura; foto larga encaixa pela altura e corta a largura), sem esticar nem deixar faixas.
  - **Exibição:** novo componente `src/components/ui/staff-photo.tsx` (`StaffPhoto`: quadro quadrado, `object-cover`, rosto a 20% do topo, volta para a inicial/ícone se não houver foto ou o endereço não abrir). Usado no app do cliente (seleção de profissional em lista e grade — também no link direto `/<profissional>`, que usa a mesma tela), no painel Equipe (lista, grade e prévia do formulário) e na página pública/prévia do editor. Fotos de serviço continuam pelo `ServiceIcon`, que agora força quadro quadrado, `object-cover` centralizado, carregamento preguiçoso e volta para a tesoura se a imagem não abrir. Na lista (miniatura de coluna) a foto ocupa a altura da linha com `cover`. Fotos antigas fora do quadrado aparecem certas só pelo CSS.
  - **Envio:** o recorte 1:1 começa já no corte automático — cobre o quadro, centralizado; para foto de profissional o centro fica a 40% da altura (`PORTRAIT_FOCUS_Y`, `initialCropOffset` em `service-image-crop.ts`, com teste). “Centralizar novamente” volta a esse ponto. Corrigido um defeito antigo: o tamanho do quadro de recorte nunca era medido (o efeito rodava antes da janela montar), então a imagem era calculada para 300px num quadro de ~322px e ficavam **faixas pretas nas laterais**; agora a medida segue o elemento (ref de callback + `ResizeObserver`).
  - Verificado: tipos, 116 testes, lint (só avisos antigos), build; no navegador (390×844, demonstração) foto alta 600×1600 no profissional (sem faixas, rosto na posição prevista, saída 1024×1024, laterais preservadas) e foto larga 1600×600 no serviço (centralizada, laterais cortadas); troca da imagem exibida por alta/larga mantendo caixas (72×72, 64×102 na lista, 48×48) com `cover`; app do cliente, prévia do editor e `/b/arena-barber` com `cover`. **Não verificado:** envio real ao storage com login de dono e aparelho físico.
- **Ajustes reorganizados** em grupos com subtelas (`?secao=`, `src/features/shop/settings/`); editor de identidade visual em etapas com prévia sempre visível.
- Verificado em 02/10: tipos, 115 testes unitários, lint sem erros, build; testes do banco (pontos 46, página 24, booking 29, privacidade 43, ocorrências 45, autoconfirmação 57 em cadeia) em transação com rollback. No navegador (390×844): página pública real em `/b/arena-barber`; editor e troca de pontos na demonstração; `/shop/pontos` com dados simulados (sem sessão local, não foi vista com login real). Ajuste da tarde: tipos, 115 testes, lint, build, teste da página 28/28 em rollback; no navegador (390×844) `/b/arena-barber` com cartões unificados (clique no canto do cartão vai ao link do profissional, horários por cima, sem link aninhado, 44px), serviço com foto e serviços com ícone; prévia e interruptores do editor na demonstração; foto do profissional na demonstração (escolher → enquadrar → “Usar foto” → foto no formulário). **Não testado:** envio real de foto ao storage pela tela com login de dono (só a política foi testada no banco).

## Entrega — idiomas, sistema completo (26/09/2026)

- Regra obrigatória: toda comunicação com o usuário e todo texto do sistema em pt-BR por padrão (`.cursor/rules/idioma.mdc`, `AGENTS.md`).
- Troca de idioma (pt-BR, pt-PT, en-US, en-GB, es) com ou sem login, cobrindo **todo o sistema**: páginas públicas, login/cadastro, app do cliente, painel da barbearia, painel da plataforma, demonstração, pesquisas, lista de espera e textos jurídicos (com aviso de tradução de cortesia fora do pt-BR). Texto novo de interface deve entrar em `src/lib/i18n/messages/pt-BR.ts` e nos outros quatro dicionários; o teste `translate.test.ts` exige as mesmas chaves e variáveis em todos.
- Continuam em pt-BR de propósito: conteúdo enviado a clientes (modelos de WhatsApp), dados cadastrados pela barbearia (serviços, bios, recados), dados fictícios da demonstração, título/descrição da página no HTML do servidor. Motivos rápidos de bloqueio de agenda são gravados no idioma de quem cria. Detalhes em [mb-revisao.md](mb-revisao.md#idiomas-fase-1--26092026).

## Entrega — revisão MB usabilidade (26/09/2026)

- Fonte consolidada em `docs/mb-interface.md`; regra `.cursor/rules/mb.mdc` (`alwaysApply`); skill em `.cursor/skills/mb/`.
- Registro: [mb-revisao.md](mb-revisao.md).
- Código (rodada 1): linguagem de sucesso do agendamento, preservação de horário em erro, cancelamento/recorrência com contexto, erros de acesso amigáveis, alvos de toque.
- Código (rodada 2): aba **Conta** + “Você está em…”; reenvio OTP em `/cadastrar` (60s); erros Google/WhatsApp traduzidos com ação de reconectar.
- Rodadas 26–27/09 (publicadas): foco centralizado em `Dialog`/`AlertDialog` (`useDialogFocus` em `src/lib/use-return-focus.ts` — entra ao abrir, volta ao botão ao fechar; não repetir por tela); alvos de 44px (campos em janelas por regra global em `styles.css`); link de profissional inexistente em `/$barberSlug` com tela própria e “Agendar com outro profissional”; erros do servidor sempre por `friendlyAuthError`/`friendlyIntegrationError` (nunca `err.message` cru); “Tentar novamente” nos erros de carregamento. Sem rolagem lateral em 320 e 390px.
- Pendente que depende do usuário: teste em aparelho real (teclado, leitor de tela, rede lenta); painel real da plataforma no navegador (login admin); `externabarbearia.com.br` ainda aponta para o WordPress, então links antigos (`/ezequiel/`) não chegam ao app.

## Entrega — cópia dos agendamentos para a Agenda Google (29/09/2026)

- Em **Ajustes → Google Agenda e Contatos**, depois de escolher a agenda, cada pessoa decide: **Não copiar** (padrão), **Só os meus atendimentos** ou **Todos da barbearia** (só dono/sócio; o banco recusa para os demais).
- Novo horário, remarcação, troca de profissional/serviço e mudança de status atualizam o evento; cancelado ou “deixou de valer” (desligou, trocou de profissional) retira o evento. Pendente/remarcação aparece como “(a confirmar)”. Desconectar não apaga o que já foi copiado. Editar no Google não altera a reserva; a importação ignora eventos criados pelo app (`extendedProperties.private.barbaCabeloAppointmentId`).
- Banco: migration `20260929130000_google_calendar_push.sql` **aplicada no Postgres Coolify** — `google_connections.push_scope`, fila `google_calendar_pushes` (sem acesso de usuário), gatilho `appointments_google_push_trg` protegido (a reserva nunca falha pela cópia), RPCs `set_google_calendar_push`, `claim_/complete_google_calendar_push` (só service role, até 5 tentativas). `get_my_google_connection` traz `push_scope`, `push_pending`, `push_failed`, `push_last_error`.
- Envio: Edge `google-calendar-dispatch` (id de evento fixo por agendamento+pessoa, então repetir não duplica); chamada pelo `whatsapp-dispatch` a cada minuto (cron do host). Publicado no volume Coolify + restart; resposta verificada `{"ok":true,...}`.
- Teste de regressão: `supabase/tests/google_calendar_push.sql` (11 verificações, rodado com ROLLBACK no banco real).
- Não verificado ainda: envio real para uma agenda Google (depende do dono ligar a opção na própria conta). A conexão existente segue em **Não copiar**.

## Endereço do servidor mudou — `supabase-teste` agora é outro servidor (29/09/2026, noite)

- Às ~19h12 o serviço da barbearia no Coolify foi reconfigurado (fora deste chat): endereço oficial passou a ser **`https://supabase-barbearia.proh.media`** (`API_EXTERNAL_URL`); `supabasebeauty.contheiner.digital` segue no mesmo servidor (é o que o site publicado usa). **`supabase-teste.proh.media` agora leva ao Flow TEST** (`jp4s2rsvrthdronl3ws71asj`) — não usar.
- Corrigido: `/etc/cron.d/barba-whatsapp-dispatch` chamava `supabase-teste` e recebia 500 desde ~19h28 (WhatsApp, e-mail e Google parados); agora chama `supabase-barbearia` e responde 200 (cópia em `/root/barba-whatsapp-dispatch.bak-20260929`). `.env` local também apontado para o endereço novo.
- **02/10 — conferido:** o outro assistente restaurou em 30/09 o login com Google (Google aceita o retorno `supabasebeauty…/auth/v1/callback`), `GOOGLE_OAUTH_*`, `APP_URL`, `PLATFORM_EVOLUTION_INSTANCE` e a auto-confirmação. Servidor reiniciado em 02/10 11h18; tarefa de envios responde 200 (o Kong deixou de registrar acessos após o reinício). **Ainda pendente:** SMTP Titan recusa a senha (535).
- **02/10 12h30 — e-mail resolvido (Grok, conferido aqui):** e-mail oficial do sistema agora é **Hostinger** `smtp.hostinger.com:465`, `noreply@contheiner.digital` (Titan abandonado). Auth e funções usam a mesma credencial (login testado nos dois); `email-dispatch`, `whatsapp-dispatch` e `google-calendar-dispatch` respondem 200, sem "invalid cmd". `meta`, `studio` e `supavisor` religados com `unless-stopped` (meta precisa de 0,5 CPU / 512 MB); analytics, vector, imgproxy e realtime desligados de propósito (o app não usa). As 11 funções no servidor são idênticas às do repositório. Kong: usar `docker logs --tail` (o `--since` vem vazio neste Docker).
- **02/10 — e-mails do login em pt-BR:** o Auth usava o modelo padrão em inglês ("Alternatively, enter the code"), mas o sistema não tem tela de código. Criados modelos só com botão em `public/email/` (`recuperar-senha`, `confirmar-cadastro`, `convite`, `link-de-acesso`, `trocar-email`), publicados em `https://beauty.contheiner.digital/email/*.html` e acessíveis de dentro do container do Auth. Coolify já aponta `GOTRUE_MAILER_TEMPLATES_*` e `GOTRUE_MAILER_SUBJECTS_*` para eles (conferido no container; e-mail chegou em pt-BR, só com botão).
- **Link de e-mail já usado/vencido:** o Auth devolvia `?error_code=otp_expired` para `/auth?recovery=1` e a tela ignorava (pedia nova senha sem sessão). Agora `auth.tsx` limpa o endereço; com sessão ativa (link aberto duas vezes) segue para criar a senha, sem sessão abre "Redefinir senha" com o aviso `auth.error.linkExpired`. Conferido no navegador o caso sem sessão; o caso com sessão não foi testado com conta real.
- **Isolamento conferido:** o Supabase da barbearia (`z2dbb…`) tem banco, rede e serviços próprios; `supabase-barbearia.proh.media` é só o nome do endereço. Nenhum container da barbearia referencia `supabase.proh.media`, `vv3jo…` ou `jp4s…`.
- **Situação em 29/09 (histórico):** o `.env` do serviço voltou a uma base de 22/09 — sumiram `GOTRUE_EXTERNAL_GOOGLE_*` (login com Google desligado: "provider is not enabled"), `GOOGLE_OAUTH_*` (Google Agenda/Contatos), `APP_URL`, `PLATFORM_EVOLUTION_INSTANCE`; `ENABLE_EMAIL_AUTOCONFIRM` virou `false`. SMTP Titan (`noreply@beauty.contheiner.digital`) recusa a senha (535) — às 13h30 funcionava. Cópias com os valores antigos em `/data/coolify/services/z2dbb7dkyzhc8vjiywq34mhn/.env.bak-*` (Google em `.env.bak-google-newproject-20260924-200257`).

## Vez entre ferramentas + incidente de envio forçado (29/09/2026)

- **Incidente:** por volta de 19h20 a `main` do `hostinger` foi rebobinada para `28a5406` (25/09), fora desta máquina, tirando do site as entregas de 26–29/09. O `origin` não foi forçado: estava parado em `28a5406` desde 25/09 porque as entregas do dia só tinham ido ao `hostinger` — causa confirmada: o fluxo `sync-instantanea-hub.yml` faz o `PROH-Media/hub-control` espelhar o `origin` no `hostinger`, e o espelho copiou o `origin` desatualizado por cima. **Enviar ao `origin` publica; enviar só ao `hostinger` é desfeito pelo espelho.** Restaurado com envio normal de `35325ac` aos dois remotos. Manter o `origin` sempre em dia (o autossave faz isso). Existe ainda a cópia de trabalho do Kilo Code em `.kilo/worktrees/olivine-gallimimus` (parada em `28a5406` desde 27/09; não enviou nada).
- **Prevenção:** regra da vez — `AGENTS.md` seção 9, `scripts/vez.sh` (vez no ramo `vez` do GitHub, troca atômica, vence em 30 min), `scripts/autossave.sh` (salva e envia ao `origin`, o que publica via espelho) e `.cursor/hooks.json` (puxa e pede a vez ao abrir, bloqueia sem a vez, autossave ao fim da resposta). Testado: pedir/checar/liberar, bloqueio de outra ferramenta, disputa simultânea (só uma ganha) e retomada de vez vencida.
- Outras ferramentas (Codex, Claude Code) precisam seguir a seção 9 manualmente ou ganhar ganchos próprios.

## Varredura de saúde — tela × banco × servidor (29/09/2026)

- **Defeito corrigido — marca da loja no login:** `get_public_shop_branding_v2` e a legada devolviam erro `42804` para **toda loja existente** (`header_font_weight` é `smallint`, a função anuncia `integer`); o login com `?shop=` caía no visual padrão. Migration `20260929190000_public_branding_font_weight_type.sql` (**aplicada**); conferido pela API sem login: Arena Barber e Externa Barbearia voltam com a marca. `get_public_shop_branding_by_host` já funcionava.
- Conferido sem divergência: as 71 funções do banco chamadas pela tela existem, com nomes de parâmetros e permissão para logado; as 66 migrations do repositório têm tabelas/colunas/funções/gatilhos presentes no banco; as 10 Edge functions usadas estão publicadas e idênticas às do repositório.
- Registro da API (Kong, 48h): sem erros de usuários além dos acima. “Esqueci a senha” às 13h20/13h22 respondeu 200 em ~2 s (envio SMTP ok após a troca de senha); 429 é só a trava de 1 minuto.
- Tarefas agendadas do sistema saudáveis (`barba-slot-waiting`: 11 falhas em 7 dias, última 23/09 durante reinícios; retenção diária ok; despacho WhatsApp/e-mail/Google a cada minuto).
- **Aguardando o usuário:** crontab do root (instalado 03/09, antes deste projeto) chama a cada 15 min `…/functions/v1/google-drive/share-expire`, função que não existe aqui (192 erros 500 em 48h, inofensivos). Provavelmente de outro projeto; não removido sem confirmação.

## Permissões da equipe — dois defeitos corrigidos + testes do banco em dia (29/09/2026)

- **Grave — mudanças protegidas pela tela falhavam desde 24/09:** havia duas versões de `request_shop_change` (3 e 5 argumentos); a API respondia `PGRST203` (não sabe qual escolher) e todo `submitProtectedChange` de dono/sócio (criar serviço, bloqueio, equipe, horários) dava erro. Migration `20260929180000_request_shop_change_single.sql` (**aplicada**) remove a versão de 3 argumentos, que só repassava para a de 5 com os mesmos padrões. Conferido pela API: a função volta a ser encontrada.
- **Parceiro/contratado não conseguiam bloquear a própria agenda nem ajustar o próprio preço:** `guard_protected_shop_change` recusava antes das políticas "próprias" valerem. Migration `20260929170000_guard_own_professional_rows.sql` (**aplicada**) libera só a linha do próprio profissional (`availability_blocks`, `staff_services`, `staff`); colega, catálogo da loja e identidade visual continuam barrados. Teste novo `guard_own_professional_rows.sql` (7).
- Testes desatualizados ajustados às regras aprovadas: minoritário abre pedido (não é recusado); "sócio" provisionado vira co-dono e reajusta o fundador; parceiro não edita identidade visual; administrador precisa estar em `shop_members`; preparação dos testes limpa o login simulado antes de gravar como postgres.
- Rodar os testes: cada arquivo em `begin … rollback`. Os que usam `booking_test_context` rodam na mesma transação depois de `booking_reliability.sql`; `auto_confirmation_modules.sql` também depois de `optional_occurrences.sql`. Resultado em 29/09: todos passaram.

## E-mail — login SMTP recusado + fila resiliente (29/09/2026)

- **Causa confirmada:** `smtp.hostinger.com` recusava o login (`535`) com a senha configurada em `SMTP_*` (Edge) e `GOTRUE_SMTP_*` (Auth). **Resolvido pelo usuário em 29/09:** senha atualizada no Coolify; login SMTP verificado com `235 Authentication successful` nos dois serviços. Envio real de e-mail ainda não observado (fila vazia no momento da checagem).
- Fila corrigida (migration `20260929150000_email_outbox_recovery.sql`, **aplicada**): `claimed_at`; envio interrompido há 10 min volta à fila; falha tenta de novo com intervalo (5, 10, 15, 20 min) até 5 vezes; aviso com mais de 24h de atraso é descartado. Os 2 e-mails travados desde 24/09 foram descartados por isso.
- `email-dispatch` só conecta ao SMTP quando há e-mail na fila, para no primeiro login recusado e grava motivo claro em pt-BR. Publicado no Coolify; o erro por minuto sumiu do log.
- Teste: `supabase/tests/email_outbox_recovery.sql` (6 verificações, ROLLBACK no banco real).

## Entrega — WhatsApp modelos + Google Agenda (25/09/2026)

- Modelos oficiais de WhatsApp (confirmação/remarcação/cancelamento/lembrete) com `{{serviço}}` literal, chips, validação, restauração com confirmação e prévia. Migration `20260925160000_whatsapp_templates_and_calendar_choice.sql` **aplicada no Postgres Coolify** — **não sobrescreve** textos personalizados já salvos.
- Popup de consentimento antes de “Conectar Google”: explica o aviso “app não verificado”, fase de teste/análise no Google, prioridade de privacidade e passos (Avançado → continuar).
- Agenda: **sem pré-seleção da principal**. Após OAuth o usuário escolhe a agenda; sync bloqueado até a escolha. Coluna `selected_calendar_id` passa a aceitar null.
- Edge `google-connect` atualizada no volume Coolify + restart. **Frontend Hostinger:** republicar após commit/push.

## Entrega — sociedade e acessos pelo dono (25/09/2026)

- Migration `20260925140000_shop_society_founder_and_team.sql` (aplicada no Coolify): `founded_by_user_id`, `shop_add_member` / `shop_update_member` / `transfer_shop_founder` / `list_shop_team_members`; `platform_add_shop_member` aceita gerente da loja; `member.add` no `apply_shop_change`.
- Edge `invite-shop-admin` e `register-shop` atualizadas no volume (dono/co-dono convida; cadastro grava fundador).
- UI: `ShopTeamAccessCard` + `ShopPermissionsMatrix` na aba Equipe; plataforma reutiliza a matriz.
- Regra: dono controla níveis/sociedade no app; admin e gerente têm override total; fundador ancorado até transferência.

## Entrega em andamento — governança / avisos / booking (24/09/2026)

Plano: [plano-governanca-sociedade-gerente.md](plano-governanca-sociedade-gerente.md).

**Aplicado no remoto (24/09):**

- Migrations `20260924170000_*` e `20260924180000_*` no Postgres Coolify
- Edge `google-connect`, `email-dispatch`, `whatsapp-dispatch`, `register-shop`, `invite-shop-admin` no volume Coolify + restart

**Google Agenda/Contatos:** a falha “Falha na integração Google” vinha do `google-connect` ausente no volume (entrypoint). Função publicada; envs `GOOGLE_OAUTH_*` já estavam no container. Não há integração Google Drive neste app — o card é Agenda + Contatos.

**OAuth Agenda — sessão perdida ao voltar (24/09):** o redirect do Google cai no apex `beauty…`, mas o cookie de login fica no host da loja. Correção: `complete` valida só o state HMAC (sem exigir Bearer); state inclui `return_origin`; callback `/auth/google-apps` redireciona de volta à origem da loja. Edge já no Coolify; **frontend Hostinger precisa republish** (`auth.google-apps` + `GoogleIntegrationsCard` com `return_origin`). Aviso “app não verificado”: Test users no OAuth consent (projeto `9697media@gmail.com`) ou Avançado.

## Projeto e ambiente

- Pasta: `/Volumes/Alyson 1TB/OpenDesign/Barba & Cabelo` (o nome real contém `&`, não `&amp;`).
- Stack: React 19, TypeScript, TanStack Start/Router, Vite, Tailwind, componentes Radix e Supabase.
- Rotas principais: `/app` (cliente), `/shop` (barbearia), `/platform` (admin global), `/demo` (demo autorizado pelo admin).
- Dados e operação: [supabase/README.md](../supabase/README.md), [mb-operacao.md](mb-operacao.md). Não copiar chaves/senhas para o chat.

## Preferências do usuário

- Português, progresso concreto, pouca repetição. Identidade de barbearia masculina, madura e moderna.
- Cantos configuráveis (reto / semi / arredondado); semi como padrão até salvar outro. Cartões off-white; botões de ação com cores aprovadas. Skill `/mb` em `docs/mb-interface.md`.

## Entregas recentes e regras atuais

### Templates WhatsApp + lista/grade no catálogo — 24/09/2026

- Serviços e Equipe no painel da loja: toggle grade/lista (`CatalogFilters`).
- App do cliente: toggle grade/lista (padrão serviços=lista, barbeiros=grade).
- Mensagens de confirmação/remarcação/cancelamento/lembrete personalizáveis + `{{link_reserva}}`.
- Migration `20260924160000_recurrence_notices_email_links.sql`: token público, e-mail outbox, avisos do barbeiro (sino), séries recorrentes.
- Edge `email-dispatch`; cron WA também estende séries e dispara e-mail.

### Landing + cadastro self-serve com WhatsApp — 24/09/2026

- Apex `beauty…/`: landing pública (`PlatformLanding`); logado redireciona ao painel do papel; host de loja vai para `/app`.
- `/cadastrar`: nome da loja, responsável, e-mail, senha, WhatsApp → OTP → cria conta + loja (dono).
- Edge `register-shop` + migration `20260924120000_platform_signup_otp.sql`. Envio via `PLATFORM_EVOLUTION_INSTANCE` (WhatsApp da plataforma). Ver [mb-operacao.md](mb-operacao.md) §5d.

### Domínio público + slug do barbeiro — 23/09/2026

- Link do parceiro e “endereço público” preferem o **domínio próprio ativo**; senão usam `*.beauty…`. Ver `shopPublicOrigin` em `src/lib/shop/host.ts`.
- Formulário de profissional: campo **Slug do link** editável (`booking_slug`); rename gera redirect. Migration `20260923180000_booking_slug_manual_and_externa.sql`.
- Path legado no domínio da loja: `/$barberSlug` (ex. `/ezequiel/`) → `/app?barber=ezequiel` (trailing slash normalizado).
- Externa Barbearia: remontada uma vez em 02/10/2026 com Ezequiel (`ezequiel`) e Tiago (`tiago`); o botão e a função `admin_reset_externa_barbearia` foram removidos (migration `20261002100000_drop_reset_externa.sql`).
- Certificado dos subdomínios das lojas: o `HostRegexp` do `wildcard-beauty.yaml` não emite certificado por host (o Traefik entregava o "TRAEFIK DEFAULT CERT"). Em 02/10 foi criado `/data/coolify/proxy/dynamic/beauty-shop-certs.yaml` com um roteador `Host(...)` por loja (arena-barber, externabarbearia). **Ao criar loja nova, acrescentar o roteador dela nesse arquivo.** O site `externabarbearia.com.br` foi só fonte de informação (WordPress); **não** é domínio do app até configurar em Ajustes. Links ficam em `*.beauty…`.

### Auth no domínio da loja (URL personalizada) — 23/09/2026

- **Regra:** com domínio/subdomínio da loja, entrar e sair ficam nesse host. O apex (`beauty…`) só aparece quando não há URL personalizada.
- Google no domínio próprio: GoTrue só aceita redirect em `beauty…`, então o OAuth roda num **pop-up** no apex; a aba principal **não navega** para beauty.
- Handoff: `postMessage` → se o Google zerar `opener` (COOP), o pop-up volta só ele ao domínio da loja (`bridged=1` + hash) e avisa a aba principal via BroadcastChannel. Ver `src/lib/auth/return-origin.ts`.
- Logout já usa `/auth` relativo (permanece no domínio da loja).

### Multi-loja por link + fidelidade por barbearia — 23/09/2026

- Conta Auth única; cada loja é ambiente separado (catálogo, agenda, pontos).
- Link/domínio define a afiliação: cliente já logado em loja nova vê diálogo **Usar esta barbearia?** (`join_shop_as_customer`).
- Cadastro novo com `?shop=` / Host continua vinculando no `handle_new_user` sem diálogo.
- Pós-login/Google com contexto de loja redireciona para `/app?shop=…&join=1`.
- `loyalty_accounts` / `loyalty_ledger` passam a ser por `(user_id, barbershop_id)`. Migration `20260923160000_multi_shop_loyalty.sql`. “Levar carteira” mescla pontos origem→destino.

### Google login + Agenda/Contatos — 23/09/2026

- Login Google (GoTrue): botão em `/auth` pronto; falta `GOTRUE_EXTERNAL_GOOGLE_*` no Coolify Auth.
- Agenda + Contatos (separado do login): migration `20260923140000_google_calendar_contacts.sql`, Edge `google-connect`, rota `/auth/google-apps`, card `GoogleIntegrationsCard` em Ajustes da loja.
- Envs Edge: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI=https://beauty.contheiner.digital/auth/google-apps`, `APP_URL`, `GOOGLE_OAUTH_STATE_SECRET`.
- Google Cloud: ativar Calendar API + People API; redirect URIs do login **e** `/auth/google-apps`. Passo a passo em [mb-operacao.md](mb-operacao.md) §3.
- Pendente operacional: criar Client OAuth, colar secrets no Coolify, aplicar migration, publicar função.
- Cópia automática dos agendamentos para o Google Calendar: entregue em 29/09/2026 (ver seção no topo).

### Slugs automáticos, redirects e desvinculação — 22/09/2026

- Migration `20260922140000_slug_redirects_and_departure.sql` aplicada no PostgreSQL remoto.
- Slug da loja e `booking_slug` do profissional são gerados do nome (`slugify_pt`); rename cria redirect **sem prazo** (só apaga na mão).
- Saída com **levar carteira** (exclusivo): clientes da carteira mudam de membership para a loja destino; link antigo fica `locked` e continua resolvendo para o barbeiro atual. Sócio precisa de liberação do outro sócio. **Abrir mão** libera o slug para a loja reusar.
- UI em Ajustes: `SlugRedirectsCard`, `ShopDepartureCard`. Cadastro com `?shop=` grava membership da loja do link (`handle_new_user` + metadata no `signUp`).
- Regressão: `supabase/tests/slug_redirects_departure.sql`.

### Domínios por barbearia — 22/09/2026

- Migration `20260922150000_shop_custom_domains.sql`: `custom_domain`, status, token de verificação; RPCs `resolve_shop_by_host` (subdomínio **e** domínio próprio ativo), `set/clear/get_shop_domain_settings`.
- Caminho A: `{slug}.beauty.contheiner.digital` (requer DNS/TLS wildcard no host do app).
- Caminho B: domínio próprio com TXT + CNAME; UI em Ajustes (`ShopDomainCard`).
- Edge Function `shop-domain` (set/clear/verify) chama domain-manager `POST /add` e `DELETE /remove` no servidor. Envs: `DOMAIN_MANAGER_URL`, `DOMAIN_MANAGER_API_KEY` (só Coolify). Descartar Nuxt `tenant.ts` / `/lookup`.
- Auth/app resolvem loja pelo Host; parceiro copia link no subdomínio. Docs: [mb-operacao.md](mb-operacao.md) §5c.

### WhatsApp Evolution API (fase 1) — 22/09/2026

- Migration `20260922010000_whatsapp_evolution.sql` aplicada no PostgreSQL remoto: `whatsapp_channels`, `whatsapp_outbox`, `auth_otp_challenges`, `profiles.whatsapp_*`, triggers de agendamento e lembretes.
- Edge Functions no Coolify: `whatsapp-dispatch` (smoke OK), `whatsapp-channel`, `auth-otp`. Envs `EVOLUTION_API_URL` / `EVOLUTION_API_KEY`. Cron `/etc/cron.d/barba-whatsapp-dispatch`.
- UI: Ajustes da loja (QR, dono/sócio), Perfil do cliente (número + opt-in), Auth com `shop` (e-mail ou WhatsApp para recovery).
- Detalhes operacionais: [mb-operacao.md](mb-operacao.md) seção 5. Fora do escopo: broadcast, inbox, número único da plataforma.

### Runbook operacional — 21/09/2026

- Documentação completa em [mb-operacao.md](mb-operacao.md): Titan (DNS + `noreply`), SMTP no Coolify, OAuth Google (login + Agenda/Contatos), domínio `supabasebeauty`, checklist e texto pronto para outro agente. Google Workspace não é necessário. WhatsApp operacional (fase 1) documentado na mesma página.

### Diagnóstico do login em produção (`beauty.contheiner.digital`) — 21/09/2026

- O erro `Failed to fetch` foi reproduzido no domínio real com Chrome/CDP. O bundle publicado contém `https://awecrsklxaeqxctfxirt.supabase.co`, host que não resolve mais no DNS; por isso o navegador falha antes de receber uma resposta do Auth. Não é erro de senha nem do formulário.
- Em 21/09/2026 o Traefik do serviço `supabase-barba-cabelo` já roteia `supabasebeauty.contheiner.digital` (router separado do alias `supabase-teste.proh.media`). O Auth mantém `GOTRUE_SITE_URL=https://beauty.contheiner.digital` e `GOTRUE_URI_ALLOW_LIST=https://beauty.contheiner.digital/**`.
- O Let’s Encrypt do domínio novo ainda **não** fecha: o DNS autoritativo (`ns1/ns2.dns-parking.com`) responde NXDOMAIN para `supabasebeauty.contheiner.digital`. Criar no Hostinger um registro **A** único: `supabasebeauty` → `187.127.60.78`. Depois disso, o certificado emite e dá para virar `VITE_SUPABASE_URL` / `SUPABASE_PUBLIC_URL` para o domínio novo.
- Enquanto isso, local e Coolify `SUPABASE_PUBLIC_URL` seguem em `https://supabase-teste.proh.media` para não quebrar o ambiente.
- O bundle publicado em `beauty.contheiner.digital` ainda continha `https://awecrsklxaeqxctfxirt.supabase.co` (morto). Após o DNS/LE, configurar no host `VITE_SUPABASE_URL=https://supabasebeauty.contheiner.digital` + anon key do Coolify e republicar. Variáveis `SUPABASE_*` sem prefixo não substituem as `VITE_*` no navegador.
- Não registrar chaves no documento. A chave publicável foi conferida apenas por tipo/comprimento; nenhuma senha, token ou chave foi exibida.

### Refinamento dos modelos Foto imersiva e Cartão sobre foto — 21/09/2026

- O mesmo padrão aprovado do formulário foi consolidado nos dois modelos restantes: hierarquia de rótulo/título/apoio, segmentado leve, campos brancos de 52 px, ação principal escura, Google em superfície branca e rodapé de confiança.
- **Foto imersiva:** o painel lateral passou a usar uma superfície off-white sólida, borda suave e sombra em camadas, com largura e espaçamentos alinhados ao modelo dividido. A marca do formulário continua oculta porque logo e nome já aparecem sobre a fotografia.
- **Cartão sobre foto:** o cartão central ganhou superfície off-white mais nítida, proporção mais confortável e separação discreta entre a identidade da barbearia e o conteúdo de acesso. Como esse modelo não exibe texto de marca sobre a foto, a identidade permanece no cartão.
- A foto, sua camada, o texto fotográfico e o modelo dividido não foram alterados. Painéis, campos e botões continuam consumindo `--panel-radius`, `--control-radius` e `--button-radius`, preservando os modos reto, semi arredondado e arredondado.
- `src/styles.css` foi conferido antes da edição (3.116 linhas / 85.619 bytes) e recebeu somente edições ancoradas nos seletores dos modelos `cover` e `card`; após a formatação ficou com 3.180 linhas / 87.310 bytes.
- Capturas reais aprovadas em 1440×900 e 430×932 para os dois modelos, sem overflow horizontal e sem alvos interativos menores que 44 px. Typecheck, lint de `auth.tsx`, 80 testes, build e `git diff --check` aprovados.

### Redesenho do painel do formulário no login — 21/09/2026

- **Lado fotográfico preservado.** A foto, o logo, o nome e o título “Seu cuidado começa aqui.” não mudaram. O redesenho foi só no painel do formulário, compartilhado pelos três modelos (`auth-brand-panel` em [src/routes/auth.tsx](../src/routes/auth.tsx)).
- **Sem marca duplicada.** Nos modelos “Foto e formulário” e “Foto imersiva”, a linha com logo e nome (`.auth-brand-identity`) fica oculta no painel, porque a foto já os mostra. Ela continua no modelo “Cartão sobre foto”, onde o texto da foto não aparece.
- **Hierarquia nova:** eyebrow curto em caixa alta na cor primária (Bem-vindo de volta / Comece hoje / Recuperar acesso / Quase lá), título grande (Acesse sua conta / Crie sua conta / Redefinir senha / Nova senha) e subtítulo em uma frase. O selo “Demonstração” fica ao lado do eyebrow.
- **Controles mais leves:** abas Entrar/Cadastrar em trilho `bg-muted` com o chip ativo branco (o escuro da cor primária fica só no botão principal); campos de 52 px brancos com borda suave, ícone interno e anel de foco na cor primária; botão do Google branco com o “G” colorido oficial (`GoogleMark`). “Esqueci a senha” e o link da política passaram a ter 44 px de alvo com margens negativas para não abrir a linha.
- **Rodapé do painel:** “Ambiente protegido” saiu do cabeçalho e ficou junto da política de privacidade, como reforço de confiança sem competir com o título.
- **Coluna direita do modelo dividido:** um `::after` na grade cria um fundo off-white com brilho leve da cor primária e do dourado (`.auth-layout-split::after`) e uma linha divisória, ligando a coluna à foto. O painel ficou com 27,5 rem de largura máxima. No celular esse fundo é desativado e o cartão volta a sobrepor a foto como antes.
- Os três modos de canto continuam valendo (`auth-brand-control`, `auth-brand-button`, `auth-brand-logo`).
- Validação: typecheck, lint de `auth.tsx`, 80 testes e build aprovados; `git diff --check` limpo. Capturas em 1440 px (dividido e imersivo) e 430 px (dividido e cartão) sem estouro horizontal e sem alvo interativo abaixo de 44 px. `src/styles.css` foi de 3.054 para 3.116 linhas com edições ancoradas.

### Login fotográfico com três modelos — 20/09/2026

- `auth.tsx` oferece três composições realmente distintas e responsivas: **Foto imersiva** (imagem em tela cheia), **Foto e formulário** (split no desktop, foto acima no celular) e **Cartão sobre foto**. Todas preservam integralmente senha, cadastro, recuperação e OAuth.
- Em **Identidade visual**, os três modelos são selecionáveis por miniaturas e exibem uma prévia maior ao vivo. A foto do login pode ser enviada e reenquadrada com o mesmo editor de recorte/zoom já usado nas fotos de serviço; no demo vira Data URL e no Supabase é publicada no bucket visual da loja. Sem foto própria, usa `public/images/login-barbershop-default.png`, gerada originalmente para o projeto.
- Novos campos: `barbershop_settings.login_layout` (`split` por padrão) e `login_image_url`. A migration idempotente `20260920040000_login_visuals.sql` também inclui os campos na governança visual e atualiza as políticas do bucket para dono, sócio e parceiro.
- O pré-login consulta a RPC pública/anônima `get_public_shop_branding_v2(text)`, limitada à identidade visual de loja ativa. Se a função/colunas ainda não existirem em outro ambiente, recua para a RPC legada e para o modelo split com foto padrão.
- Migration aplicada no PostgreSQL remoto em 20/09/2026; colunas, default e permissão `anon` da RPC conferidos. `src/styles.css` recebeu somente bloco ancorado no final: **2.610 → 3.026 linhas**.
- Validação: typecheck, lint dos arquivos alterados, 80 testes e build de produção aprovados. No navegador, os três layouts foram conferidos em 430 px e desktop, sem overflow horizontal; todos os alvos interativos do login medem ao menos 44 px, inclusive o link da política. Conferir novamente sempre que o conteúdo real da foto mudar.

### Próximo nível compartilhado e login com identidade da loja — 20/09/2026

- O cartão **Próximo nível** voltou ao Início, na posição e no visual anteriores, e permanece no Extrato. A implementação foi extraída para o componente único `src/features/customer/NextLevelCard.tsx`; não há duas cópias do JSX. No nível máximo, o Início preserva o comportamento original (sem card de próximo nível) e o Extrato mostra a conquista alcançada.
- O login em `src/routes/auth.tsx` agora exibe nome e logo da barbearia identificada por `shop` (direto ou dentro de `next`), além de aplicar cores, fonte e um dos três modos de canto da loja. Sem loja identificada ou sem logo, usa respectivamente **Barba & Cabelo** e o pictograma de tesoura. O acesso de demonstração sem loja usa **Arena Barber** e mostra o selo “Demonstração”. Autenticação por senha, recuperação e OAuth não tiveram seu fluxo alterado.
- A migration `20260920030000_public_auth_branding.sql` adiciona `get_public_shop_branding(text)`, RPC disponível antes do login que retorna somente identidade visual de loja ativa; configurações operacionais continuam privadas. A migration precisa acompanhar a próxima aplicação do banco.
- `src/styles.css` recebeu edição ancorada no fim do arquivo: 2.586 → 2.610 linhas. O login usa `--panel-radius`, `--control-radius` e `--button-radius`, com semi arredondado como fallback.

### Fotos de serviço, barras flutuantes, cantos e extrato — 20/09/2026

- **Fotos de serviço 2× maiores:** `ServiceIcon` ganhou `imageClassName`; os quatro usos definem dimensões de foto duas vezes maiores que as dos pictogramas. Fotos seguem sem padding e com `object-cover`; ícones preservam tamanho e respiro anteriores.
- **Cabeçalho e rodapé flutuantes:** `barbershop_settings.floating_chrome` é uma opção visual persistida, com `false` por padrão para manter o layout atual. O editor mostra um switch e uma prévia ao vivo. Quando ativo, cabeçalho e menu inferior respeitam o mesmo recuo de **1rem** já usado na base do rodapé, incluindo safe areas; Cliente, Barbearia e a visão Plataforma da demonstração consomem a configuração. O admin global real mantém a identidade neutra porque pode gerenciar várias lojas ao mesmo tempo. Migration: `20260920020000_floating_chrome.sql`.
- **Três modos de canto:** a skill pessoal `~/.codex/skills/mb/SKILL.md`, sua cópia `docs/mb-interface.md` e `AGENTS.md` agora exigem adaptação integral aos modos reto, semi arredondado e arredondado. `soft`/semi arredondado é o padrão até o usuário salvar outra escolha. A identidade visual deve permanecer consolidada e sem oscilações entre páginas, estados ou tamanhos de tela.
- **Extrato de pontos:** o cartão “Próximo nível” permanece no Início e também aparece no resumo do extrato por meio do componente compartilhado `NextLevelCard`. A página reúne saldo, nível atual, progresso acessível, benefício seguinte e movimentações com hierarquia visual, ícones e estados de crédito/débito; no nível máximo mostra a conquista correspondente.
- **Banco remoto atualizado:** `20260920020000_floating_chrome.sql` foi aplicada no PostgreSQL remoto em 20/09/2026. A REST passou de erro `42703` para HTTP 200; a coluna foi conferida com `default false` e `NOT NULL`.
- O shell da Barbearia passou a consumir o mesmo conjunto de tokens da identidade do Cliente (cores, fonte, escopo tipográfico e cantos), evitando oscilação entre as duas visões. Na demonstração, a Plataforma usa esses tokens e o modo flutuante da loja; fora da demonstração, continua neutra.
- `src/styles.css` recebeu somente edições ancoradas: **2.541 → 2.586 linhas**.
- Validação: typecheck, 79 testes, lint dos arquivos alterados sem erros (3 avisos preexistentes de Fast Refresh no catálogo de ícones), build de produção, Prettier e `git diff --check` aprovados. A skill `/mb` passou no `quick_validate.py`.

### Precisão temporária e miniaturas de serviço — 20/09/2026

- A precisão da antecedência agora ativa automaticamente somente enquanto o ponteiro permanece pressionado por 3 segundos. Não há card, pílula de estado nem botão “voltar”; o próprio slider sinaliza o modo com trilho mais espesso, cor dourada e thumb ampliado.
- Entrar na precisão não remapeia a faixa nem altera o valor: o thumb permanece na mesma posição visual e apenas a sensibilidade do deslocamento fica 8× menor. Ao soltar, o slider volta ao visual e à sensibilidade normais, preservando o minuto escolhido.
- O controle mantém a faixa global de 0 a 1.440 minutos e o acesso por teclado (setas, Page Up/Down, Home e End); a roleta da pílula de valor continua disponível para seleção manual.
- `ServiceIcon` diferencia fotos de ícones: imagens usam `object-cover` e removem qualquer padding herdado para preencher 100% da miniatura; ícones vetoriais preservam o padding e o tratamento visual existentes. Todos os quatro usos do componente foram conferidos.

### Recorte 1:1, precisão e roleta da antecedência — 20/09/2026

- A foto do serviço agora abre um editor antes do upload: enquadramento automático quadrado, arrasto por mouse/toque, reposicionamento por setas, zoom de 100% a 300% e centralização. A confirmação gera e salva um arquivo WebP 1024×1024; portanto demo (Data URL) e Supabase (Storage) persistem a imagem já recortada.
- A pílula da antecedência mínima virou botão e abre um popup no mesmo padrão dos seletores de calendário, com roletas separadas de horas e minutos, suporte a toque/clique/setas e limite estrito de 0 a 1.440 minutos.
- Pressionar o slider por 3 segundos ativa o modo de precisão: a faixa passa a cobrir uma janela de 60 minutos com passo de 1 minuto, com progresso e estado visíveis. Há alternativa por botão para teclado e botão para voltar à faixa completa.
- O thumb compartilhado em `src/components/ui/slider.tsx` passou a ter geometria real de 24 px e área de toque ampliada por pseudo-elemento. Isso alinha o centro do ponto ao fim da barra de progresso inclusive nos extremos, sem reduzir o alvo e sem alterar a API dos outros usos.
- `src/styles.css`: 2.273 linhas antes e 2.485 depois da implementação e formatação. A matemática do recorte recebeu testes para paisagem, retrato, zoom, posição e limites.

### Slider da espera e imagens de serviço — 20/09/2026

- Em Ajustes → Agenda → Espera por horário, **Antecedência mínima** agora é um slider numérico (não um toggle): mantém o intervalo persistido de 0 a 1.440 minutos e passo de 1 minuto, mostra o valor em minutos/horas e oferece alvo de toque de 44 px, foco e teclado via Radix Slider.
- Upload de imagem do serviço corrigido nos dois modos. Na demo, a imagem vira Data URL local e não acessa o Supabase; no modo real, PNG/JPEG/WebP/SVG de até 2 MB é validado antes do envio e salvo no bucket `barbershop-services`. A prévia e o `ServiceIcon` reconhecem URL HTTP e Data URL.
- Causa raiz no banco: `20260917140000_service_icons.sql` falhava em `text = uuid`; por isso a coluna `icon` e o bucket não existiam no ambiente remoto. A migration histórica recebeu o cast correto para instalações novas e `20260920010000_service_images_storage.sql` cria/atualiza colunas, bucket, limites e políticas alinhadas às permissões atuais. A corretiva foi aplicada no banco remoto.
- Verificação real do Storage: upload autenticado, leitura pública HTTP 200 e remoção do arquivo temporário aprovados. Em 430 px, slider e botão de upload medem 44 px, não há overflow horizontal e a demo gera a prévia em Data URL sem erro.

### Agenda da barbearia: cabeçalho e lista redesenhados — 20/09/2026

- O cabeçalho da aba Agenda em `ShopShell` reúne o seletor Minha agenda/Equipe e a navegação de data em um único cartão `app-action-card`.
- A data aparece por extenso, com setas anterior/próximo e botão Hoje; todos os alvos têm pelo menos 44 px. O botão Hoje fica desabilitado e marcado com `aria-current="date"` quando a data atual já está selecionada.
- A lista usa a ordem visual horário → cliente → serviço → profissional → status. No desktop, os itens seguem colunas alinhadas; em telas estreitas, o horário forma uma coluna lateral e os demais dados mantêm a mesma sequência vertical.
- Serviço, profissional e status usam ícone/texto, sem depender apenas de cor. Lógica de escopo, filtros, dados, modo demo e ações de atendimento foram preservados.
- `DatePicker` ganhou a prop opcional `displayValue`, mantendo o comportamento anterior nos demais usos.
- A direção visual segue a skill `/mb`: superfícies off-white, `app-action-card`, token `--gold`, cantos arredondados consistentes e estética sóbria.
- Conferência visual realizada em 430 px e 1440 px; sem overflow horizontal e com alvos do navegador de data em 44 px.

### Rolagem nativa restaurada — 18/09/2026

- O controle flutuante customizado foi removido por decisão do usuário. As áreas principais dos três shells e os diálogos voltaram a usar somente a **scrollbar nativa fina dourada** do projeto.
- `useScrollIndicators` continua marcando a área ativa com `data-scrolling="true"`; `src/styles.css` mantém o thumb nativo transparente em repouso e dourado durante a rolagem. Nenhum token de cor foi alterado.
- Foram removidos o componente de rolagem customizado, seus estilos, refs e usos nos três shells, no editor de identidade visual, no perfil do cliente e no Clube de Benefícios.
- Validação: typecheck, lint dos arquivos alterados, 76 testes, build e `git diff --check` aprovados. No Chrome, uma área rolável real do workspace apresentou `scrollbar-width: thin`, mudou de transparente para dourado com `data-scrolling="true"` e não renderizou controle customizado.

#### Incidente: `src/styles.css` zerado e reconstruído — 18/09/2026

- Durante a troca do controle, um `apply_patch` de outra sessão foi interrompido no meio da escrita e deixou `src/styles.css` com **0 bytes** (o arquivo nunca foi commitado com o conteúdo atual; o índice do git tinha só 350 linhas antigas).
- Reconstrução: snapshot do histórico local do Cursor (`~/Library/Application Support/Cursor/User/History/…`, versão de 17/09 18:36, 1887 linhas) + CSS compilado pré-incidente recuperado do **cache do Chrome** do script de verificação (`/tmp/barba-scroll-chrome.*/Default/Cache/Cache_Data`, resposta de `/src/styles.css` do Vite). O diff entre o snapshot compilado e o CSS pré-incidente apontou 14 mudanças, todas reaplicadas em forma de fonte; o resultado recompila **byte a byte igual** ao CSS pré-incidente.
- Lição: **commitar `src/styles.css` com frequência** (é o arquivo mais reescrito por sessões de IA) e, antes de rodar ferramentas que reescrevem arquivos inteiros, garantir um commit ou cópia.

### Correções no editor de identidade visual (rolagem e consistência) — 18/09/2026

- **Rolagem do sistema, não da página:** a barra de salvar (`.brand-editor-actions`) estava com `bottom: calc(... + 52px + 1rem)` (compensação da antiga navegação inline), criando um vão de ~97 px até o fim do diálogo; agora usa `bottom: 0.5rem` (`sticky bottom-2`), colando no rodapé do diálogo.
- **Barra de rolagem do diálogo:** os estilos de scrollbar (fina, dourada, visível ao rolar) passaram a incluir `[role="dialog"]`, e `[role="dialog"] { overscroll-behavior: contain }` impede que a rolagem vaze para a página/navegador por trás. `useScrollIndicators` também reconhece diálogos (`[role=dialog]`) para acender a barra ao rolar.
- **Prévia coerente com o app real:** a logo da prévia do editor usava o "chip" antigo (borda + `bg-white` + `p-1`); agora é um quadrado com o **fundo da logo** (`logo_background_color`) e cantos que seguem o modo (`brand-preview-logo`), espelhando a logo real do cabeçalho.
- Validação: typecheck, 76 testes e build aprovados. Verificado no navegador: barra de salvar em `bottom: 8px`, prévia com `border-radius: 0 14.4px 14.4px 0` (modo semi), diálogo com `overscroll-behavior: contain`.

### Fundo da logo e personalização por dono/sócio/parceiro — 18/09/2026

- **Migration `20260918020000_logo_background_and_associate_branding.sql` (aplicada):**
  - Nova coluna `barbershop_settings.logo_background_color` (fundo do quadrado da logo).
  - `settings_change_is_visual` passa a incluir `logo_background_color`.
  - `guard_protected_shop_change` permite **associate** aplicar mudanças visuais livremente (dono/sócio já podiam); mudanças não visuais continuam na governança societária ou são recusadas para parceiro/contratado. Adicionado `auth.uid() is null → return` para preservar fixtures/bootstrap.
  - Política RLS de UPDATE em `barbershop_settings` passou a aceitar dono/sócio/parceiro (o trigger mantém a separação visual × operacional).
- **Regressão `supabase/tests/associate_branding.sql`:** 3 verificações com `ROLLBACK` — parceiro edita nome/fundo da logo, é bloqueado em mudança operacional, dono edita cor de destaque. As regressões anteriores (governança + permissões) continuam passando (47 verificações).
- **Interface:** `BrandIdentityEditor` ganhou o campo "Fundo da logo" (BrandColorPicker com opção "Sem fundo"/transparente, com quadriculado de transparência). O painel da barbearia (`ShopShell`, aba Ajustes) agora abre o editor para **dono, sócio e parceiro** (contratado não), não só o admin global; no demo a edição é local.
- **Cantos da logo:** `.brand-corners-square` → logo toda quadrada; `.brand-corners-soft` → esquerda quadrada e direita `var(--control-radius)`; `.brand-corners-round` → logo em cápsula (`999px`). A borda direita segue o canto do header; a esquerda (colada na tela) fica sempre quadrada, exceto no modo 100% arredondado.
- Validação: typecheck, 76 testes, lint sem erros e build aprovados. Verificado no navegador: editor abre com "Fundo da logo"; raio da logo = `0 / 14.4px / 999px` nos modos quadrado/semi/arredondado.

### Logo da barbearia colada no cabeçalho — 18/09/2026

- A logo do cabeçalho do cliente (`ArenaApp.tsx`) deixou de ser um "chip" branco com borda/`p-1` e passou a ficar **colada na ponta esquerda e na altura total** do header.
- Implementação via wrapper `.brand-header-logo-wrap` quadrado (`aspect-ratio: 1/1` + `position: absolute`), fora do fluxo — o upload de outra logo **não muda** o tamanho, a borda nem as quinas do header; o canto segue o modo de canto (`border-radius: 0 var(--control-radius) var(--control-radius) 0`) e `overflow: hidden` mantém o conteúdo dentro das marcas de recorte.
- **Conteúdo interno:** a imagem usa `object-fit: contain` + `padding: 25%` (respiro de 1/4 da altura = largura, ~17px num quadrado de 68px), garantindo que logos sem fundo não toquem as quinas arredondadas.
- O título ganhou `padding-left` para reservar o espaço da logo. A queda de 1 px na base é a borda separadora do header (`border-bottom`).
- Validação: typecheck, 76 testes e build aprovados. Verificado no navegador: wrapper 68×68, colado à esquerda/topo, `padding: 17px`.

### Brilho do card do membro (triplicado e deslocado) — 18/09/2026

- O `mb-loyalty-sheen` do card do membro foi **triplicado** (18rem → 54rem) e deslocado à direita com `right: -27rem` (metade para fora do cartão), mantendo o `overflow: hidden` como máscara de recorte.
- A animação `mb-loyalty-sheen-float` usava `translateX(-50%)` fixo (herdado do layout centralizado), o que cancelava o deslocamento. Foi criada a variante `mb-loyalty-sheen-float-right` (só `translateY`) usada somente pelo card do membro, sem afetar o brilho centralizado do login e do extrato.
- Verificado no navegador: brilho de 864 px com metade (≈431 px) fora do cartão à direita, recortado pela máscara.

### Demo com histórico real e matriz compacta — 18/09/2026

- **Ritmo do cliente na demo:** cada cliente agora recebe **4 a 6 visitas concluídas** no passado, com cadência própria de retorno (10 a 25 dias), além de uma reserva futura. Antes cada cliente tinha um único agendamento, então o "ritmo" nunca tinha dados ("~0 dias" / "ainda não há dados suficientes"). A geração separa o pool de horários passados do futuro (para não sobrepor visita passada e reserva futura) e a janela de histórico passou de 21 para 120 dias. O teste "no staff overlaps" continua passando.
- **Matriz de Acessos:** a tabela estourava a largura do painel (os seletores de "Serviços" com textos longos levavam a 924 px) e escondia a coluna "Contratado" (cortada à direita). Agora a tabela usa `table-fixed`, rótulos compactos ("Ver"/"Próprios"/"Tudo" com `title` descritivo), coluna "Permissão" menor e `min-w-[560px]` — cabe no painel de desktop. No celular continua com rolagem horizontal (inerente a uma matriz de 5 colunas).
- Validação: typecheck, 76 testes e build aprovados. Verificado no navegador: perfil do cliente na demo mostra "~11 dias · Terça · 13h" e serviço mais frequente.

### Rodapé, paginação, "Personalizado", acessos e demo — 18/09/2026

- **Rodapé e rolagem:** o `padding-bottom` que reserva espaço para a barra flutuante passou do `.arena-workspace` para o `.arena-workspace > main` (o contêiner de rolagem). O conteúdo rola por baixo da barra, mas `nav-height + 1.5rem` de recuo garantem que a última seção/botão nunca fique oculto.
- **Carteira/clientes:** `ClientDirectory` agora fica **fechado por padrão** e carrega 25 clientes por vez, com "Carregar mais" **e** rolagem infinita (IntersectionObserver). A "Sua carteira" do parceiro também passou a vir fechada (`<details>` sem `open`).
- **Chip "Personalizado":** a duração do serviço ganhou um chip "Personalizado" que revela um campo de duração livre; o motivo do bloqueio ganhou o mesmo chip, que abre um campo de pergunta única ("Qual o motivo?").
- **Acessos — item "Serviços":** a matriz de permissões consolidou `manage_services` + `manage_own_services` em **uma única linha "Serviços"** com seletor de nível por papel: **Somente visualização / Gerenciar próprios / Gerenciar tudo**. O banco continua armazenando os dois booleanos (que já dirigem RLS e capacidades); só a UI mudou. Sem migration.
- **Modo demo ampliado:** `staff` fictício ganhou `bio`/`avatar_url`; `ProfessionalInsights` ganhou ramo de demonstração (antes mostrava erro no "Indicadores do dia") com escopo por papel (dono/sócio veem tudo, parceiro vê valores + visão anonimizada, contratado só score); `PartnerOverview`, `CustomerRhythm` e `ClientProfileModal` passaram a calcular ritmo real na demo (mediana de retorno, dia/hora preferidos, serviço mais frequente, gasto médio) em vez de valores vazios.
- Validação: typecheck, 76 testes, lint sem erros e build aprovados. Verificado no navegador: parceiro na demo mostra valores + visão anonimizada sem erro; "Seus clientes" e "Sua carteira" fechados por padrão.

### Refinamento visual e de interação — 18/09/2026

- **Carrossel de datas:** redesenho dos chips para um formato de calendário vertical (dia da semana / número / mês), mantendo o `scroll-snap`. Adicionada legenda com a data completa do dia selecionado. Removida a legenda duplicada que existia na seção "Horário".
- **Rodapé unificado:** o painel da barbearia agora aplica `brandCornerClass(settings.corner_style)` no `arena-workspace`, então o rodapé (e o restante do painel) segue o mesmo idioma de cantos do app do cliente. Antes o cliente usava `brand-corners-round` (32 px) e a loja o padrão soft (21,6 px) — por isso o rodapé do cliente parecia diferente.
- **Sobreposição do rodapé:** `padding-bottom` do `arena-workspace` passou de `nav-height * 0.6` para `nav-height + 1.5rem`, garantindo que o "Confirmar reserva" e outros elementos do fim da página terminem acima da barra (folga medida de ~48 px).
- **Carteira/clientes do parceiro:** cada cartão de cliente agora é inteiramente clicável (removeu "Ver perfil"); "Sua carteira" virou seção expansível (`<details>`) e "Seus clientes" também. O diretório do dono/sócio ("Clientes da barbearia") segue o mesmo padrão.
- **Página de agenda da loja:** cartões soltos de estatísticas (que repetiam os números dos indicadores) foram removidos; "Indicadores do dia" agora é uma única seção expansível logo após a navegação de data. A navegação de data virou um único cartão (`‹ data › + Hoje`).
- **Campos interativos:** duração do serviço virou chips (15/20/30/45/60/90/120 min); motivo do bloqueio ganhou chips rápidos (Feriado, Pausa, Manutenção, Falta) mantendo o campo de texto para motivo próprio.
- **Ícones de nicho:** adicionados `straightRazor` (navalha reta) e `hairClip` (presa de cabelo) ao catálogo, nas categorias "Barba e bigode" e "Cabelo".
- **Nomenclatura do ritmo:** `RhythmDashboard` ganhou `dayLabel` parametrizável. Para o cliente: "Dia em que você costuma ir"; para o parceiro: "Ritmo dos seus clientes" / "Dia em que seus clientes mais vêm"; no perfil do cliente: "Dia em que o cliente costuma ir". A métrica do parceiro é a agregação por cliente (já era), só o rótulo estava errado.
- Validação: typecheck, 76 testes, lint sem erros e build aprovados. Verificado no navegador: rodapé consistente (32 px nos dois), folga de 48 px no fim da página, "Indicadores do dia" sem duplicação.

### Diretório de clientes e perfil do cliente — 18/09/2026

- **Migration `20260917190000_client_directory.sql` (aplicada):** `get_partner_clients` passou a ter escopo por papel — dono/sócio veem **todos** os clientes da barbearia; parceiro/contratado veem só os que atenderam. Nova RPC `get_client_profile(p_shop_id, p_customer_id)` devolve nome, avatar, visitas, total gasto, primeira/última visita, ritmo e histórico de agendamentos; sem acesso completo, o profissional só abre clientes que já atendeu.
- **Interface:** `ClientDirectory` (lista + botão "Ver perfil") e `ClientProfileModal` (perfil com histórico e ritmo). O diretório aparece para dono/sócio ("Clientes da barbearia", escopo total) e, dentro do `PartnerOverview`, para parceiro ("Seus clientes", escopo próprio).
- Regressão `supabase/tests/client_directory.sql`: 8 verificações com `ROLLBACK` — escopo por papel, histórico, ritmo e bloqueio de abertura de cliente alheio.

### Carrossel, rodapé e página de agenda — 18/09/2026

- **Carrossel de datas:** removidas as setas e o gradiente. Agora é um carrossel com `scroll-snap` (`scroll-snap-type: x proximity` + `scroll-snap-align: center`), sem desvanecimento, com o dia selecionado auto-centralizado via `scrollIntoView`. Chips com `.app-day-chip`/`.app-day-chip-selected`.
- **Rodapé unificado:** o painel da barbearia deixou de usar `flex justify-around` com fundo `bg-primary/5` e passou a usar o mesmo frame do app do cliente — `app-mobile-nav app-mobile-nav-floating` em `grid` com colunas `minmax(0,1fr)` e a **pílula deslizante** (`app-mobile-nav-indicator`). O que muda entre perfis são só os botões internos (conforme o papel), nunca o frame.
- **Página de agenda da loja:** reorganizada — título com "Atualizar" no cabeçalho, navegação de data integrada (‹ data › + atalho "Hoje"), escopo, estatísticas, busca/filtros e a **lista em destaque**; "Indicadores do dia", "Resumo do dia" e a visão do parceiro foram movidos para **depois** da lista. A lista de agendamentos foi preservada integralmente.

### Parceiro: carteira, clientes, perfil e dashboard de ritmo — 18/09/2026

Regra central do usuário: cada barbeiro é parceiro de trabalho do outro, mas cada um tem carteira, lista de clientes e perfil próprios; dados financeiros globais **nunca** são compartilhados — cada um vê somente o seu. O app une apenas a marca. O link individual de agendamento continua sendo o meio de divulgação para a cartela própria.

- **Migration `20260917180000_partner_tools.sql` (aplicada):**
  - `staff` ganhou `bio` e `avatar_url` (perfil próprio).
  - Política `Professionals update own profile` (update na própria linha) + trigger `guard_staff_profile_update` que impede profissional sem gestão de trocar loja, desativar a si ou alterar o `booking_slug`.
  - RPCs `get_partner_wallet`, `get_partner_clients`, `get_customer_rhythm`, `get_partner_rhythm` — todas `security definer` com filtro pelo `current_staff_id`/`auth.uid()`.
- **Carteira** (`get_partner_wallet`) é derivada dos atendimentos concluídos do próprio `staff_id`: total produzido, contagem e entradas recentes (cliente, serviço, valor). Sem tabela nova — nada a sincronizar.
- **Clientes** (`get_partner_clients`) deriva a cartela do parceiro: nome, visitas, total gasto e última visita, apenas dos próprios atendimentos concluídos.
- **Ritmo** (`get_customer_rhythm` / `get_partner_rhythm`): mediana de dias entre visitas consecutivas (`percentile_cont` sobre `lag`), dia da semana e hora preferidos (`mode()`), serviço mais frequente e gasto médio. `sample` conta **intervalos de retorno** (visitas após a primeira), não todas as visitas.
- **Interface:** `PartnerOverview` (carteira + clientes + ritmo + botão "copiar link") montado no painel do parceiro (`ShopShell`, papel `associate`); `CustomerRhythm` no perfil do cliente (`ArenaApp`). Componente visual `RhythmDashboard` reutilizado pelos dois, com faixa de dia da semana destacada e cartões de métricas; mostra "ainda não há dados suficientes" com menos de 3 retornos.
- **Regressão `supabase/tests/partner_tools.sql`:** 13 verificações em transação com `ROLLBACK` — carteira sem o valor do colega, clientes próprios, mediana de retorno (21 dias), atualização da própria bio, bloqueio de editar o slug/outro perfil. As regressões anteriores (equipe, provisionamento, permissões) continuam passando com a migration aplicada (50 verificações, zero falhas).
- Validação: typecheck, 76 testes, lint sem erros e build de produção aprovados. Verificado no navegador: a visão do parceiro mostra link, carteira, clientes e ritmo; o perfil do cliente mostra "Seu ritmo".

### Agenda: setas e fade corrigidos — 18/09/2026

O carrossel de datas da agenda tinha dois problemas: o contêiner flex com `overflow-x-auto` **não tinha `min-w-0`** (estourava a tela — 1112 px num viewport de 430 px, sem rolar nem desvanecer), e a seção `.booking-section` era um grid de coluna única sem `grid-template-columns` (a coluna implícita `auto` assumia a largura máxima do conteúdo). Correções: `min-w-0` no carrossel, `grid-template-columns: minmax(0, 1fr)` na seção, e um `useEffect` com `scrollIntoView` para manter o dia selecionado visível ao navegar pelas setas. Verificado: carrossel com 264 px, rolando até 1112 px, dia selecionado sempre visível.

### Modos de borda (retos, semi e arredondados) — 17/09/2026

Os três modos de canto quebravam a interface em alguns lugares. Causa raiz em `src/styles.css`: a regra genérica `:is(.arena-workspace, .brand-preview) button { border-radius: var(--button-radius) !important; }` forçava `--button-radius` (999 px no modo arredondado, 0 no reto) em **todo** botão, sem exceção:

- **Modo arredondado:** cartões de serviço, chips de dia e controles segmentados que usam `rounded-xl`/`rounded-lg` viravam pílulas (999 px), quebrando a aparência de cartão.
- **Modo reto:** botões circulares (`rounded-full`) viravam quadrados (0 px).
- O seletor de demonstração usava `calc(var(--button-radius) - 0.15rem)`, que no modo reto resultava em raio negativo (`-0.15rem`), inválido no CSS.

Correções aplicadas:

- Regras novas, com `!important` e especificidade maior, que vencem a regra genérica: `button:is(.rounded-xl, .rounded-lg)` usa `--control-radius`; `button:is(.rounded-2xl, .rounded-3xl)` usa `--panel-radius`; `button.rounded-full` permanece `9999px`.
- `border-radius: max(0rem, calc(var(--button-radius) - 0.15rem))` no seletor de demonstração para nunca ficar negativo.
- Verificado no navegador (teste isolado de um botão `rounded-xl`): reto = 0 px, semi = 14.4 px (0.9rem), arredondado = 19.2 px (1.2rem). Botão `rounded-full` permanece circular nos três modos. O cartão de serviço no modo arredondado real passou de 999 px para 19.2 px.
- A intenção original continua: botões de ação pequenos/médios viram cápsula no modo arredondado; cartões e chips mantêm raio de controle/painel. O gradiente metálico dos níveis de fidelidade não foi tocado.

### Fuso horário do agendamento — 17/09/2026

O agendamento do cliente (`ArenaApp`) e a agenda da loja (`ShopShell`) voltaram a calcular datas e horários no **fuso da barbearia** (`barbershops.timezone`), e não no fuso do aparelho de quem abre o app. A infraestrutura já existia em `src/lib/shop/appointments.ts` e não estava sendo usada.

- `ArenaApp` passou a carregar `barbershops.timezone` e usa `buildBookingDateKeys` (chaves de data puras) em vez de `buildBookingDays`, que montava objetos `Date` no fuso do aparelho e reintroduzia o fuso errado na conversão de volta.
- Consultas de ocupação usam `shopDayRange` e a busca de funcionamento usa `weekdayForDateKey`.
- O dia selecionado é realinhado ao fuso da loja quando ela é carregada, porque o estado inicial não conhece a loja.
- Exibição de datas e horários usa `formatShopDate`/`formatSlotLabel` com o fuso; bloqueios da loja usam `shopDateTime`.
- Regressão nova em `src/lib/shop/appointments.test.ts`: a mesma loja abre no mesmo instante de parede em fusos diferentes.
- Verificado no navegador com o aparelho em `Asia/Tokyo` e a loja em `America/Sao_Paulo`: "Hoje" segue a data da loja (17/09), não a do aparelho (18/09).
- Limitação conhecida: o gerador de demonstração monta horários com `setHours` do aparelho, então com o aparelho em outro fuso os horários fictícios do demo aparecem deslocados. Não afeta dados reais e o demo não foi alterado.

### Permissões configuráveis por papel — 17/09/2026

- **Antes:** cada regra de acesso era uma lista de papéis fixa no código (`has_shop_member_role(shop_id, array['owner','partner'])`). O usuário decidiu tornar a matriz configurável e persistida.
- **Migration `20260917150000_shop_role_permissions.sql` (aplicada):** cria `shop_role_permissions` e troca as listas de papéis por consultas à matriz. Pontos-chave:
  - **O padrão reproduz o comportamento anterior.** Não existe linha na tabela por padrão e a ausência de linha significa "usar `shop_permission_default`". Aplicar a migration sem configurar nada **não altera quem vê o quê**. Proteção contra escalada de privilégio: a matriz só é consultada por 11 permissões nomeadas, nunca como um "admin genérico".
  - A **governança societária continua separada**: `can_apply_protected_change` (sociedade igualitária precisa de aprovação) segue decidindo _se_ uma mudança pode ser aplicada, enquanto a matriz decide _quem tem a capacidade_. As políticas exigem as duas coisas.
  - Gravação só armazena o que difere do padrão, para que ajustes futuros nos padrões alcancem quem nunca personalizou.
  - Gravar exige `is_platform_admin()` ou `can_apply_protected_change()`; o dono não pode revogar a própria gestão de permissões; permissão/papel/valor inválidos são recusados antes de qualquer gravação.
- **Migration `20260917160000_shop_permissions_self_read.sql` (aplicada):** `get_my_shop_permissions` devolve apenas as permissões do próprio usuário. A matriz completa (`get_shop_permissions`) é restrita a quem administra a loja — um parceiro não lê a configuração dos outros papéis.
- **Migration `20260917170000_shop_permission_money_semantics.sql` (aplicada):** correção de semântica. A primeira versão tratava "ver valores" como um item só de dono/sócio, mas o sistema real tem dois níveis distintos: **valores do dia e próprios recebimentos** (dono, sócio e parceiro) e **relatórios financeiros da loja** (dono e sócio, e é o que libera a RPC `get_business_insights`). `view_own_earnings` virou `view_money` e os padrões foram corrigidos para preservar o acesso anterior.
- **`get_business_insights`** passou a aceitar quem tem `view_financial_all`, não apenas o papel legado `shop_admin`. O sócio já via os números na interface e não conseguia lê-los pela RPC; o corpo da função é idêntico ao da migration `20260916180000`, só a permissão mudou.
- **Interface:** `/platform → Acessos` carrega e grava a matriz real, com seletor de barbearia, os 11 itens por 4 papéis, estado de carregamento, erro visível e o interruptor do dono em "Alterar permissões" travado. Informar que a matriz é só uma prévia **não se aplica mais** — as regras valem na hora, no banco.
- **Capacidades (`src/lib/auth/capabilities.ts`):** `capabilitiesFor` aceita a matriz efetiva como quarto argumento e, quando ela existe, ela decide `viewFullShop`, `viewMoney`, `viewShopFinancials`, `editOwnCatalog`, `manageCatalog`, `manageTeam`, `manageOperations` e `viewReportsAnonymized`. Sem matriz carregada valem os padrões por papel. A sessão busca a matriz via `get_my_shop_permissions` junto do contexto de governança.
- **Regressão `supabase/tests/shop_role_permissions.sql`:** 36 verificações em transação com `ROLLBACK` — padrões por papel, autorização de gravação, sociedade igualitária bloqueando sócio isolado, proteção da gestão de permissões, recusa de entradas inválidas sem efeito parcial, gravação parcial, leitura da matriz e leitura das próprias permissões. O arquivo termina com `reset role` para não afetar as outras regressões na mesma transação.
- **Prova de não regressão:** as regressões `shop_team_governance.sql` e `shop_team_provisioning.sql` continuam passando com as três migrations aplicadas, na mesma transação (43 verificações, zero falhas).
- Validação da aplicação: typecheck, 76 testes (incluindo 3 novos sobre a matriz nas capacidades), lint sem erros e build de produção aprovados. Verificado no navegador: a matriz carrega os 11 itens com os valores que reproduzem o comportamento real; conceder "Visão geral da agenda" ao parceiro e salvar grava a linha no banco; revogar remove a linha e volta ao padrão.

### Correções da auditoria do sistema — 17/09/2026

Auditoria de código em todo o app (leitura apenas) gerou 16 achados confirmados. Correções aplicadas:

- **Gravidade alta — navegação de agenda bloqueada por permissão errada:** o botão "Dia anterior" estava dentro de `canChangeGlobalCatalog`, então Parceiro e Contratado só conseguiam avançar o dia ou voltar para "Hoje". Navegar na agenda não tem relação com o catálogo; o botão ficou sempre visível.
- **Gravidade alta — aba "Horários" fechava sozinha para Parceiro:** o filtro da barra inferior liberava a aba para `associate`, mas a guarda de `useEffect` redirecionava para "Agenda" porque `canManageOperations` é falso para esse papel. O formulário de bloqueio já tinha caminho explícito para Parceiro, portanto o acesso era intencional. A guarda passou a considerar o papel. Verificado: Parceiro permanece em "Horários" e o Dono vê o botão "Dia anterior" (44 px).
- **Gravidade média — respostas de RPC sem proteção:** `BusinessInsights` e `DataRights` gravavam o retorno direto no estado com `as unknown as`. Uma resposta vazia sem erro virava `null` e quebrava a renderização; um erro de rede deixava o painel carregando para sempre. Agora há verificação de tipo, valores padrão seguros e tratamento de exceção.
- **Gravidade média — banner de instalação do PWA cobria a barra inferior:** o banner (`z-[80]`) ocupava a mesma faixa das abas (`z-40`). O recuo passou a vir de variáveis no `body` (`--app-banner-bottom`), que somam a altura da barra quando ela existe. Verificado: o banner fica acima do menu.
- **Gravidade média — modal "Clube de Benefícios" sem semântica de diálogo:** ganhou `role="dialog"`, `aria-modal`, `aria-labelledby` e contenção de foco com Tab/Shift+Tab nos dois sentidos; o botão de fechar passou de 32 px para 44 px com `aria-label`. Verificado: o foco não escapa do diálogo.
- **Gravidade média — upload de ícone de serviço inacessível por teclado:** o seletor era um `<label>` com input `hidden` (não focável). Passou a ser um `<button>` real que aciona um input `sr-only`, seguindo o padrão já usado no `BrandIdentityEditor`.
- **Gravidade média — envio duplicado em formulários:** `createShop`, `inviteShopAdmin`, `createService` e `createStaff` dependiam só de `disabled={busy}`; um duplo clique no mesmo tick criava dois registros. Cada um recebeu guarda de reentrada no início.
- **Gravidade média — campos sem rótulo:** os interruptores da matriz "Acessos" ganharam `aria-label` por permissão e papel; os formulários "Novo bloqueio", "Nova barbearia" e "Adicionar profissional" ganharam `<label htmlFor>` visível via `useId`; o botão de status da barbearia ganhou `aria-label` com o nome da loja e a ação.
- **Gravidade média — selo de status inconsistente:** a lista "Meus agendamentos" montava o selo à mão e só tratava `confirmed`/`cancelled`, deixando "Concluído" cinza igual a "Em revisão". Passou a usar `.status-pill status-<estado>`, como as demais telas.
- **Gravidade baixa:** erro de reserva não era limpo ao trocar data/serviço/barbeiro/horário (ficava "preso" sugerindo falha na nova escolha); o diálogo de pesquisa da equipe mantinha resposta e erro do atendimento anterior ao reabrir; a opção "Sem frequência definida" usava a chave literal `undefined`, que não casava com o filtro `["skip", "none"]` das métricas — a chave virou `none` e o filtro aceita `undefined` para não contar respostas antigas; o contador do filtro de catálogo usava `bg-black/10` fixo e ficava ilegível sobre a marca escura, agora usa `bg-muted/60`; os atalhos "Loja" (plataforma) e "Plataforma" (loja) usavam `hidden sm:inline` e sumiam no celular, agora têm versão de ícone.
- **Painel "Acessos":** o botão dizia "Salvar permissões"/"Salvo com sucesso" sem persistir. Passou a informar que a matriz é uma prévia local. **Persistir as permissões de verdade exige migration e troca das políticas RLS — não foi feito.**

Validação: `typecheck`, 72 testes, lint com zero erros e build de produção aprovados. Medições no navegador em 430×932.

### Rodapé, rolagem e acessibilidade — 17/09/2026

- **Rodapé cortado no celular:** `DemoWorkspace` tinha `pb-10` (40 px) sobrando do antigo seletor de papéis flutuante. O `.demo-layout` ficava 40 px mais curto que a viewport e a barra `fixed` caía parcialmente fora da superfície do app. O recuo foi removido.
- **Fim da rolagem:** `.arena-workspace:has(.app-mobile-nav)` reserva `max(1rem, env(safe-area-inset-bottom)) + var(--app-nav-height) * 0.6` (`--app-nav-height: 4.8rem`), de modo que o conteúdo só é cortado **cerca de 40% para dentro** da barra (faixa pedida: 35% até o centro). Medido: 40% no app do cliente e 39% no painel da barbearia, com o último cartão encostando no menu em vez de parar antes dele.
- **Espaço morto removido:** o dashboard do cliente tinha `pb-32` (128 px) que criava **120 px de vazio** no fim da rolagem; agora sobram 8 px. O `pb-24` do painel da barbearia foi reduzido para `pb-8`.
- **Acessibilidade (auditoria medida no navegador):**
  - 24 interruptores da matriz "Acessos" não tinham nome acessível; cada um recebeu `aria-label` do tipo "Visão Geral da Agenda para Dono". Os cabeçalhos da tabela e os rótulos passaram a sair da mesma lista `ROLE_COLUMNS`, evitando divergência entre coluna e rótulo.
  - O formulário "Novo bloqueio" (Horários) tinha um `<select>` e um `<input>` sem rótulo; ganharam `<label htmlFor>` visível com `useId`.
  - Os formulários "Nova barbearia" e "Adicionar profissional" (admin global) dependiam só de `placeholder`; ganharam rótulos visíveis e associados, também via `useId`.
  - Verificado: app do cliente, as cinco abas do painel da barbearia e as quatro abas do admin global sem botão anônimo nem campo sem rótulo; `alt` presente em todas as imagens e sem `id` duplicado.
- **Modo claro:** os cartões de nível do modal "Clube de Benefícios" e da página pública `/politica` usavam `bg-white/5` e `border-white/10` sobre cartão claro — praticamente invisíveis. Passaram a usar tokens do tema (`bg-muted/40`, `border-border/60`) e a marca d'água de diamante virou `text-foreground`. O mesmo ajuste foi feito nos `border-white/30` dos selos do nível Exclusive.
- **Honestidade do painel "Acessos":** o botão dizia "Salvar permissões" e respondia "Salvo com sucesso" sem persistir nada. Agora informa que os interruptores montam uma **prévia local** ("Salvar prévia" e uma nota de que a regra só vale quando a política é publicada no banco). Persistir de verdade exige migration e ajuste das políticas RLS/RPC — não foi feito.
- Validação: typecheck, 72 testes, lint e build de produção aprovados. Medições no navegador em 360×800 e 430×932, sem rolagem horizontal em nenhuma tela.

### Ícones de serviço, seletor de demo e layout móvel — 17/09/2026

- Catálogo de ícones de serviço ampliado em `src/components/ui/service-icon.tsx`, agora em grupos por área (cabelo, barba, estética, unhas, bem-estar, corpo, clube, status, básicos) com busca por texto.
- Três fontes no mesmo padrão de traço: **Lucide** (base, identificador puro como `Scissors`), **Lucide Lab** (`@lucide/lab`, ISC, identificador `lab:*` — poste de barbeiro, secador, navalha, bigode, toalhas, perfume, sabonete, vestuário) e glifos portados de catálogos abertos em `src/components/ui/service-glyphs.tsx` (`glyph:*` — MingCute, Tabler e IconPark; espelho, pente, esmalte, batom, escova, máquina, pincel de barbear, massagem, aparador). Créditos e licenças estão no cabeçalho de cada arquivo.
- Identificadores já gravados no banco continuam válidos: o nome puro do Lucide segue sendo o formato padrão.
- O seletor de ícones em `ShopShell` ganhou busca e agrupamento, mantendo o envio de imagem própria.
- Seletor do modo demonstração (`DemoAccountMenu.tsx`) passou a usar a mesma superfície dos ícones do cabeçalho (`.app-demo-switcher`, 44 px, `#2c2d29`/`#46473e`) e é **sempre o primeiro ícone da direita para a esquerda** nos três cabeçalhos. Abaixo de 768 px ele volta a ser um único botão com a lista em popover; entre 768 e 1023 px a pílula mostra só os ícones.
- Correções de layout móvel em `src/styles.css`:
  - o recuo de `env(safe-area-inset-*)` no cabeçalho e o afastamento inferior da barra de navegação passaram a valer sempre, não apenas em `display-mode: standalone`; em modo instalado o cabeçalho recebe um piso de `3.25rem` para WebViews que não informam o recorte do topo;
  - `.arena-workspace > nav` deixou de forçar `position: relative`/`width: 100%` sobre a barra flutuante — as duas barras (`ArenaApp` e `ShopShell`) voltaram a ser `position: fixed` e simétricas;
  - a área reservada para a barra usa `:has(.app-mobile-nav)` no `.arena-workspace`, que é o contêiner de rolagem (`overflow: hidden` + `main` com `overflow-y: auto`).
- Contraste do menu de rodapé: a barra do painel da barbearia reutiliza `.app-mobile-nav` mas **não tem a pílula** do indicador, então o texto ativo herdava a cor de leitura e ficava branco sobre o fundo claro. Agora, sem `.app-mobile-nav-indicator`, o próprio botão ativo recebe `background: var(--primary)`; com pílula, mantém o texto na cor de leitura e acrescenta um anel de contraste no indicador.
- Validação: typecheck, 72 testes, lint dos arquivos alterados e build de produção aprovados; verificação no navegador em viewport de 430×932 (iPhone) confirmou cabeçalho sem estouro, barra de 398 px simétrica, folga de 65 px entre o último cartão e a barra e contraste do item ativo.

### Equipe profissional, sociedade e privacidade — 17/09/2026

- Nova fundação em `supabase/migrations/20260917120000_shop_team_governance.sql`: vínculos `shop_members` entre conta, barbearia e `staff`, papéis `owner`, `partner`, `associate` (parceiro) e `employee` (contratado), participação societária, catálogo individual `staff_services`, preço histórico no agendamento e slug público do profissional.
- Todos veem a própria agenda. A agenda da equipe é entregue pela RPC `get_team_schedule`: dono/sócio recebem detalhes completos; parceiro/contratado veem os colegas somente como horário ocupado, sem cliente, serviço ou valor.
- Dono e sócio veem a operação completa. Parceiro recebe indicadores próprios e visão global anonimizada com amostra mínima; contratado recebe apenas score/indicadores próprios, sem valores financeiros.
- Parceiro edita somente nome, duração, preço e disponibilidade dos próprios serviços. Contratado não edita catálogo nem vê fluxo de caixa. Mudanças de estado do próprio atendimento não permitem trocar cliente, serviço, profissional, horário ou preço pela API.
- Governança: sociedade igualitária cria `shop_change_requests`; nada operacional é aplicado enquanto faltarem aprovações dos demais sócios, o autor não aprova o próprio pedido e qualquer recusa encerra o pedido sem aplicação. Em sociedade majoritária, somente quem possui mais de 50% e a maior participação aplica mudanças. Identidade visual permanece livre para dono/sócio.
- O painel passou a exibir “Minha agenda” e “Agenda da equipe”, capacidades por papel, indicadores profissionais e a área “Decisões da sociedade” para aprovar, recusar ou cancelar solicitações.
- Link direto do profissional: `/app?shop=slug-da-barbearia&barber=slug-do-profissional`. O seletor fica fixo e a criação usa `create_direct_appointment`, que valida barbearia, profissional e serviço no banco.
- A sessão carrega `shopActors`, `activeShopActor`, modo de governança e capacidades. O acesso profissional à rota `/shop` não depende apenas do papel legado `shop_admin`.
- Contas vinculadas a mais de uma barbearia recebem um seletor de unidade no cabeçalho. A escolha é persistida localmente e o painel recalcula o papel/capacidades no banco antes de liberar controles da nova unidade.
- Migration aplicada no PostgreSQL remoto do VPS em 17/09/2026. A regressão `supabase/tests/shop_team_governance.sql` passou antes da aplicação, dentro de transação com rollback, e passou novamente depois da aplicação.
- A migration complementar `20260917130000_team_provisioning.sql` e a regressão `shop_team_provisioning.sql` também foram aplicadas/validadas. Plataforma → Barbearias agora cadastra contratado, parceiro ou sócio; a participação de um novo sócio é transferida do dono atual em uma única transação.
- A Edge Function `invite-shop-admin` foi atualizada no volume Coolify e o container reiniciado; o endpoint respondeu 200 ao preflight. Backup remoto anterior: `index.ts.bak-20260917-team-governance`.
- Validação da aplicação: typecheck, 72 testes, lint dos arquivos alterados, `git diff --check` e build de produção aprovados.

### Entrada do cliente e cartão de fidelidade — 16/09/2026

- Depois da primeira consulta de agendamentos, o cliente sem atendimento futuro é levado automaticamente de Início para **Agendar**. O redirecionamento acontece uma vez por sessão/cliente e espera o carregamento terminar; falhas de consulta não são tratadas como agenda vazia.
- O cartão **Próximo atendimento** é uma única área clicável e acessível por teclado; qualquer ponto do cartão abre **Reservas**.
- O cartão de fidelidade tem composição própria por nível: prata no Classic, bronze no Select, ouro no Privilege e fundo escuro holográfico no Exclusive. O selo com blur retorna ao canto superior direito e o nome do cliente usa a fonte de marca do sistema.
- A página inicial possui novas animações coreografadas: o cartão de fidelidade aparece do centro com um desfoque suave (blur). Em seguida, caso haja horário marcado, o cartão do próximo atendimento e o cartão de progresso deslizam de trás do cartão de fidelidade para cima e para baixo, respectivamente, como cartas de um deck se separando. Ambos (próximo atendimento e próximo nível) seguem o mesmo estilo visual de painel transparente ("glass").
- O clique no cartão de fidelidade (agora unificado) abre diretamente os privilégios do nível, removendo redundâncias. O acesso ao extrato virou um link direto dentro do próprio cartão.
- Na navegação inferior, o estado ativo é uma cápsula única que desliza entre Início, Agendar, Reservas e, quando habilitado, Esportes. A animação respeita `prefers-reduced-motion`.

### Identidade visual por barbearia — 16/09/2026 (revisada à noite)

- Editor único em `src/features/shop/BrandIdentityEditor.tsx`: logo (PNG/JPEG/WebP/SVG até 2 MB, clique ou arrastar), nome do cabeçalho, frase abaixo do nome, fonte (seis famílias self-hosted, fonte avulsa ou família com até 12 arquivos WOFF2/WOFF/TTF/OTF) e cores principal/destaque, com prévia ao vivo em formato de tela do cliente. A família é reconhecida pelos nomes dos arquivos, incluindo pesos, itálicos, fontes variáveis, pesos numéricos e hashes de build/CDN; arquivos que parecem pertencer a famílias diferentes são recusados e metadados AppleDouble (`._`) são ignorados.
- O editor guarda o próprio rascunho e só o substitui quando `barbershop_settings.updated_at` muda. Isso corrige o bug em que o painel da barbearia recarregava os ajustes a cada tick do relógio da demo e apagava a edição antes de salvar.
- Salvar é dedicado ("Salvar identidade"), com barra fixa no fim do editor mostrando "Alterações ainda não salvas", "Descartar" e o resultado. Preferências de agendamento (orientação, horizonte, pesquisas) ficaram em outro formulário com salvar próprio.
- Seletor de cor em popover (`BrandColorPicker`): amostra com texto de exemplo e razão de contraste, paleta nomeada, cor livre (`input type="color"`), código hexadecimal e "Padrão".
- Persistência em `src/lib/shop/branding-persist.ts`: upload aos buckets `barbershop-logos` e `barbershop-fonts`, remoção do arquivo ao tirar a personalização e Data URL na demo. A fonte de marca pode ser aplicada somente no cabeçalho ou também em títulos selecionados; textos, formulários e botões permanecem em Inter.
- **Admin global** personaliza qualquer barbearia: botão **Personalizar** em Plataforma → Barbearias abre o mesmo editor em diálogo. Na demo, a lista mostra a barbearia fictícia e as mudanças valem para as visões Barbearia e Cliente. A migration `20260916540000_platform_admin_branding_storage.sql` libera upload/atualização/exclusão para `is_platform_admin()`.
- Colunas: `display_name`, `logo_url`, `font_family`, `custom_font_url`, `custom_font_name`, `custom_font_faces`, `font_scope`, `primary_color`, `accent_color`, `tagline`. As migrations `20260916520000` a `20260916560000` e os buckets públicos `barbershop-logos`/`barbershop-fonts` foram aplicados e verificados no banco remoto em 16/09/2026. `custom_font_faces` guarda URL, arquivo, peso e estilo de cada variação. Cores viram variáveis locais do workspace; texto sobre a primária é derivado por contraste. Tema global e ícones/metadados da PWA não são personalizados.
- A migration `20260916570000_brand_font_face_and_storage_mime.sql` também foi aplicada: acrescenta `header_font_weight`/`header_font_style`, permite escolher a face exata da família no cabeçalho e aceita `application/octet-stream` no bucket de fontes para navegadores que enviam WOFF2 com MIME genérico. A validação do app continua limitada a WOFF2/WOFF/TTF/OTF.
- A migration `20260916580000_brand_corner_style.sql` acrescenta `corner_style`: cada barbearia escolhe cantos `square` (retos), `soft` (semi arredondados, padrão atual) ou `round` (botões cápsula e painéis mais arredondados). A prévia é imediata e o valor vale nos ambientes Cliente e Barbearia.
- As cores agora geram tokens separados para fundo e leitura: texto/ícones sobre a cor da marca recebem automaticamente preto ou branco, e cores usadas como texto sobre cartões off-white são ajustadas apenas na renderização até contraste WCAG AA. A cor de fundo escolhida e os gradientes de fidelidade permanecem intactos.

### Agenda, ocorrências e pontos

- Reservas e remarcações novas ficam **confirmadas automaticamente**.
- Não existem ações obrigatórias de registrar chegada/iniciar atendimento. O atendimento e a falta não são presumidos automaticamente.
- Ações principais da barbearia: concluir, cancelar e retirar confirmação. Confirmar pode continuar aparecendo para estados legados.
- Ocorrências opcionais após o início: atraso do cliente e atraso da barbearia, independentes, inteiros de 1 a 1.440 minutos. Vazio significa desconhecido, não zero; edição/remoção permitida, inclusive após conclusão.
- Falta explícita somente após término previsto, para reservas ativas, incompatível com atrasos/presença registrados; encerra sem pontos. Banco impede concluir falta para obter pontos.
- Dados antigos de chegada/início preservados, sem conversão automática em atrasos. Indicadores usam médias separadas e quantidade de registros.
- Implementação em `src/features/insights/` e migração `20260916300000_optional_occurrences.sql`.

### Módulo de espera por horário — implementado

- Controle em **Painel da barbearia → Ajustes → Agenda → Espera por horário**. Desligado por padrão.
- Antecedência mínima configurável de 0 a 1.440 minutos, padrão 30.
- Ao retirar a confirmação, só iniciar espera se couberem **10 minutos de retenção + 5 minutos de exclusividade**, inteiros, antes da antecedência mínima.
- Exemplo: atendimento 15h, antecedência 30 min → espera pode iniciar até 14h15. Depois disso, retirada libera imediatamente.
- Oportunidade “Pode ser liberado” / “Tenho interesse” aceita apenas um interessado. Após entrada, some para os demais; continua bloqueando reservas comuns.
- Ao fim da retenção, sem interessado libera ao público; com interessado concede 5 minutos exclusivos. Confirmação cria outra reserva confirmada, sem transferir a reserva original nem conceder pontos.
- Durante a retenção, barbearia pode restaurar a confirmação. Se o cliente original cancelar/remarcar, a restauração fica proibida, mas o prazo da espera é mantido.
- Desistência durante retenção reabre a oportunidade; durante exclusividade libera ao público. Expiração também libera.
- Desativar encerra todas as esperas imediatamente e avisa interessados; não cancela reservas já assumidas. Alterar antecedência preserva prazos existentes.
- Cancelamentos e remarcações comuns continuam liberando imediatamente. A regra de liberação imediata aprovada antes foi substituída **somente para retiradas elegíveis com o módulo ligado**.
- Arquivos: `src/features/waiting/` (modelos, demo, hook, componentes e testes); integração nos painéis de cliente/barbearia e no demo.
- Migração aplicada: `20260916500000_slot_waiting.sql`. Tabelas `slot_waits`, `waiting_events`; operações `get_waiting_state`, `waiting_action`, retirada de confirmação e consulta de intervalos ocupados atualizadas.
- Escritas de reservas protegidas no banco; prazos pelo relógio do servidor; avisos persistentes privados. Push, WhatsApp e e-mail **ainda não integrados**, apenas eventos preparados.
- Cron instalado no VPS em `/etc/cron.d/barba-slot-waiting`, a partir de `supabase/slot-waiting.cron`, executando a cada minuto. Consultas/escritas também validam prazo, sem depender do cron ou de navegador aberto para bloquear/liberar corretamente.
- Demo tem avanço de +1, +5 e +10 minutos no menu superior, útil para testar o ciclo sem esperar.

### Esportes

- Módulo por barbearia ativado pelo **admin global**, diferente da espera, que o dono configura.
- Desligado por padrão nas lojas reais, com proteção no banco contra ativação pelo dono.
- Demo tem placares fictícios. Programação/placares reais ainda dependem de integração futura; não apresentar como transmissão ao vivo existente.

### Pesquisas e acompanhamento

- Existe trabalho anterior de preferências de privacidade, questionários, respostas, indicadores, motivos de cancelamento e pedidos de exclusão. Referência: `docs/customer-insights.md` e `src/features/insights/`.
- Preservar os três níveis de coleta desejados pelo usuário, perguntas padronizadas, participação opcional e limites existentes. Não interpretar a intenção de métricas amplas como autorização para coleta oculta/invasiva.

### Tema, metadados e páginas de erro — 16/09/2026

- Preferência de tema (claro/escuro) agora é compartilhada e persistente: `src/lib/theme.ts` (funções puras, testadas) e `src/lib/use-theme.ts` (hook com `useSyncExternalStore`). Chave `arena:theme` no `localStorage`; sem escolha explícita, segue `prefers-color-scheme` e reage a mudanças do sistema e de outras abas.
- `__root.tsx` injeta um script inline (`themeBootstrapScript`) antes da primeira pintura, para páginas com SSR não piscarem no tema errado. O script espelha `resolveTheme`; o teste garante que os dois concordam em todas as combinações.
- Botão de tema disponível no cabeçalho do cliente (`ArenaApp`) e da barbearia (`ShopShell`), com `aria-pressed`.
- Corrigido: `/politica` lia `document` durante a renderização e quebrava no servidor (`ReferenceError: document is not defined`) em acesso direto/recarregamento. Agora usa o hook de tema e renderiza no servidor.
- `__root.tsx`: `lang="pt-BR"`, título e descrição do produto (substituindo "Lovable App"), `og:locale`, `color-scheme` e `theme-color`. Páginas 404 e de erro traduzidas e com os botões no padrão visual (cantos arredondados, altura mínima 44px). `HeadContent` deduplica `meta` por `name`; por isso há um único `theme-color`.
- Cliente: o sino mostra contador apenas de notificações não lidas e zera ao abrir a aba; o modal de benefícios VIP ganhou `role="dialog"`, título vinculado, fechamento por Esc/toque fora, foco inicial no botão fechar e devolução do foco ao sair.

## Reembolso — somente ideia registrada

Ler `docs/reembolso-futuro.md`. **Nenhuma cobrança, retenção ou devolução está ativa.**

- Esquecimento com pelo menos 3h de antecedência: gratuito / integral.
- Esquecimento com menos de 3h: intenção de reter/cobrar 30%.
- Outros motivos: integral.
- Cliente pode solicitar integral mesmo após retenção; barbeiro efetua devolução complementar.
- Ainda faltam definição de provedor, pagamento parcial/base dos 30%, reserva sem pagamento, habilitação por loja e situações sem motivo/falta/após início. Não inventar regras financeiras ao retomar.

## Validação da última implementação

Entrega de tema/metadados (16/09/2026): `npm run typecheck` passou; `npm test` **53 testes passaram** (6 novos em `src/lib/theme.test.ts`); `npm run build` passou; `git diff --check` passou; no servidor de desenvolvimento, `/politica` renderizou o conteúdo no servidor sem erro e uma rota inexistente devolveu 404 em português com o script de tema no `<head>`. `npm run lint` ficou com zero erros nos arquivos desta entrega; durante a validação, outra sessão gravou `src/routes/auth.tsx` (login com Google, com dois erros de formatação Prettier não tocados aqui) e sobrescreveu `ArenaApp.tsx`/`ShopShell.tsx`; as edições de tema/notificações foram reaplicadas sobre a versão nova. **Atenção:** essa versão nova do `ArenaApp.tsx` deixou de usar `formatShopDate`/fuso da barbearia (datas voltaram ao fuso do navegador) e removeu a fonte de display; conferir com o usuário antes de restaurar, pois contraria a regra documentada acima.

Validação anterior (módulo de espera):

- `npm run typecheck`: passou.
- `npm test`: **45 testes passaram**.
- `npm run lint`: zero erros; seis avisos já existentes de Fast Refresh em componentes UI.
- `npm run build`: passou; `git diff --check`: passou.
- Banco: `booking_reliability.sql` + `slot_waiting.sql` passaram em transação com rollback. Regressões de ocorrências, confirmação automática, faltas sem pontos e Esportes também passaram.
- `python3 supabase/tests/waiting_concurrency.py`: duas entradas simultâneas → um interessado; duas confirmações simultâneas → uma reserva; cron expirou e persistiu aviso **sem navegador/endpoint processando a espera**. Fixtures com UUIDs próprios removidas ao final.
- Conferência visual pelo Edge, em demo: configuração e retenção no layout móvel; cartão de espera do cliente em celular e desktop. Não presumir uma auditoria visual completa de todas as telas.
- Depois dessas validações, a última tarefa só acrescentou a skill MB e documentação do reembolso; o validador da skill passou.

## Observações para o próximo trabalho

- Existem muitos arquivos novos não rastreados, incluindo funcionalidades completas e migrações; `git diff --stat` sozinho não mostra todo o trabalho.
- Em 16/09/2026 houve uma passagem `/mb` de modernização visual compartilhada: cantos mais arredondados, Inter como tipografia do sistema, atmosfera de fundo, animações de painel/navegação com `prefers-reduced-motion`, estados vazios ilustrados (`EmptyState`) e cartões/botões mais suaves. A decisão mais recente permite fonte de marca enviada pela barbearia, limitada ao cabeçalho ou a títulos selecionados, sem atingir textos e controles. Gradientes de fidelidade e regras de negócio preservados.
- A demonstração abre só por **Abrir demonstração** (sem liga/desliga). Troca Admin / Barbearia / Cliente e saída ficam no **menu do ícone de perfil** (sutil, sem barra sobre o header). Ferramentas de relógio também nesse menu.
- Antes de abrir a demonstração, o admin global escolhe a barbearia. A sessão copia identidade, catálogo, equipe e funcionamento da escolhida, mas permanece inteiramente local; clientes e reservas continuam fictícios e aleatórios.
- PWA: manifesto em `/manifest.webmanifest`, ícones em `/public/icons`, service worker via `vite-plugin-pwa`, banner de instalação e metas Apple/Android. Em produção (HTTPS) o app pode ser instalado na tela inicial.
- A cópia portátil da skill serve à migração de contexto/provedor; manter coerência com a skill pessoal se atualizar as diretrizes no futuro.
- Navegação visual foi possível via automação nativa do Edge, apesar de a lista de navegadores conectados estar vazia. O Chrome aberto não tinha sessão do app; o Edge tinha demo autenticado. Não contornar autenticação para testes.

---

name: mb
description: Orientar mudanças de interface no projeto Barba & Cabelo para uma experiência moderna, intuitiva e acessível a diferentes idades. Aplicar quando o usuário invocar /mb ou $mb ou pedir melhorias visuais e de interação nesse projeto.

---
