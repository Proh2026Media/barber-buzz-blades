# Transição para a próxima IA — Barba & Cabelo

Atualizado em **23/09/2026**. Este documento resume decisões e entregas da conversa anterior; conferir o código antes de alterar comportamentos.

## Comece aqui

1. Ler `AGENTS.md`, `docs/mb-interface.md` e este documento. Para e-mail Titan, SMTP Coolify, login Google, Agenda/Contatos e domínio da API: [mb-operacao.md](mb-operacao.md).
2. Inspecionar `git status` e os arquivos relevantes ao próximo pedido. O workspace tem muitas alterações e arquivos não rastreados que compõem o aplicativo; **não descartar nem sobrescrever esse trabalho**.
3. Para retomar localmente, usar `npm run dev -- --host 0.0.0.0 --port 8080`. O endereço esperado é `http://localhost:8080`.
4. Continuar a partir do próximo pedido do usuário.

## Projeto e ambiente

- Pasta: `/Volumes/Alyson 1TB/OpenDesign/Barba & Cabelo` (o nome real contém `&`, não `&amp;`).
- Stack: React 19, TypeScript, TanStack Start/Router, Vite, Tailwind, componentes Radix e Supabase.
- Rotas principais: `/app` (cliente), `/shop` (barbearia), `/platform` (admin global), `/demo` (demo autorizado pelo admin).
- Dados e operação: [supabase/README.md](../supabase/README.md), [mb-operacao.md](mb-operacao.md). Não copiar chaves/senhas para o chat.

## Preferências do usuário

- Português, progresso concreto, pouca repetição. Identidade de barbearia masculina, madura e moderna.
- Cantos configuráveis (reto / semi / arredondado); semi como padrão até salvar outro. Cartões off-white; botões de ação com cores aprovadas. Skill `/mb` em `docs/mb-interface.md`.

## Entregas recentes e regras atuais

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
- Ainda não: espelhar cada agendamento do app automaticamente para o Google Calendar.

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
