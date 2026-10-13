# Histórico do projeto — do Lovable à separação de ambientes

Escrito em 12/10/2026 a partir do `git log`, dos nomes das migrations em [`supabase/migrations/`](../../supabase/migrations/) e dos documentos em `docs/`. Cobre do primeiro commit até a última entrega registrada (09/10/2026). O registro detalhado de cada entrega continua em [CONTINUIDADE.md](../CONTINUIDADE.md); aqui fica o mapa.

**Índice**

1. [Resumo](#1-resumo)
2. [Sobre as datas](#2-sobre-as-datas)
3. [Linha do tempo por fases](#3-linha-do-tempo-por-fases)
4. [Ferramentas que trabalharam no projeto](#4-ferramentas-que-trabalharam-no-projeto)
5. [Incidentes e lições](#5-incidentes-e-lições)
6. [Regras que nasceram dos incidentes](#6-regras-que-nasceram-dos-incidentes)
7. [Estado no fim do histórico (09/10/2026)](#7-estado-no-fim-do-histórico-09102026)

Documentos irmãos: [arquitetura](arquitetura.md) · [papéis e permissões](papeis-e-permissoes.md) · [banco e implantação](banco-e-implantacao.md) · [como trabalhar](como-trabalhar.md) · [pendências](pendencias.md) · porta de entrada: [LEIA-PRIMEIRO](../LEIA-PRIMEIRO.md).

## 1. Resumo

- **Origem (03/06–29/07/2026):** protótipo gerado no Lovable — uma barbearia com notícias e placares esportivos ("Lâmina & Gol" no título da primeira tela; "Barba & Bola" no [README](../../README.md)). Uma tela só, dados fictícios, MCP de exemplo.
- **Reconstrução (14/09/2026 em diante):** virou o **Barba & Cabelo**, app de agendamento e fidelidade **multi-loja**, com Supabase auto-hospedado (Coolify) e front publicado no Hostinger. 85 migrations, de `20260914222150` a `20261005120000`.
- **Ondas principais:** fundação multi-loja e agenda (14–16/09) → equipe, sociedade e permissões (17–20/09) → produção, WhatsApp, Google e domínios (21–25/09) → revisão de usabilidade, idiomas e regra da vez (26–29/09) → clube de pontos e página pública (02/10) → auditoria de 115 bugs e implantações (03–04/10) → interface visual (05–08/10) → separação de ambientes (09/10).
- **Ferramentas:** Lovable, Cursor, Claude Code (provável em 4 commits de 21/09; principal desde 03/10), Grok como agente do servidor; Codex e Kilo Code aparecem nos documentos (ver [seção 4](#4-ferramentas-que-trabalharam-no-projeto)).
- **Em aberto no fim:** 3 migrations prontas e não aplicadas na produção, onda 4 da separação de ambientes e itens que dependem de banco — ver [pendências](pendencias.md).

## 2. Sobre as datas

As datas dos commits **não são confiáveis** para datar o trabalho:

- O commit do template (`f319173`) está datado de 01/01/2025, mas o nome é `template: tanstack_start_ts_2026-05-29`.
- Os commits do Lovable vêm em rajadas de segundos (337 commits em 05/06/2026), típico de sincronização/importação.
- O trabalho de 14 a 20/09 foi feito sem commit e entrou de uma vez em `4d827ca` ("feat: consolida aplicativo e identidade visual", 21/09, 180 arquivos, cerca de 30,9 mil linhas). O CONTINUIDADE já avisava: "Existem muitos arquivos novos não rastreados" (seção "Observações para o próximo trabalho").
- Desde a tarde de 02/10 (`8266080`, 17:05, primeiro autossave) predominam os commits "Autossave (ferramenta): N arquivo(s)" (`scripts/autossave.sh`), que juntam várias tarefas num commit (ex.: `ae00852`, 07/10, 225 arquivos). No mesmo dia ainda houve commits manuais misturados aos autossaves; o último é `6933e5b` (02/10, 17:54). A partir de 03/10, só autossaves.

**Use, nesta ordem:** a data no nome da migration (`AAAAMMDDhhmmss_…`), a data da seção do [CONTINUIDADE.md](../CONTINUIDADE.md) e só depois a do commit. Horários de produção aparecem nos documentos como "PT" (ex.: "17:44 PT"); o fuso exato dessa sigla é **não confirmado**.

Contagem do git em 12/10/2026: 499 commits — 396 do `gpt-engineer-app[bot]` (Lovable), 2 do Lovable (template e README) e 101 do usuário git `Flow01ProhMedia` (o dono; as ferramentas commitam com esse usuário).

## 3. Linha do tempo por fases

### Fase 0 — Protótipo no Lovable (03/06 a 29/07/2026)

- **Período:** commits de 03/06, 05/06, 15–16/07 e 29/07/2026.
- **O que foi feito:**
  - `644ae21` "Criou app de barbearia esportiva": primeira tela "Lâmina & Gol — Barbearia + Esportes ao vivo", abas Agenda/Esportes, "placares ao vivo".
  - Até 05/06: app único `UnifiedArenaApp` em `src/routes/index.tsx` (daí o nome "Arena" que ainda aparece em chaves como `arena:theme` e na loja fictícia "Arena Barber") e `politica.tsx` (conteúdo de `src/routes/` em `17dbf8a`, último commit de 05/06). O `auth.tsx` só entrou em 16/07: criado em `6df0eaf` e levado à linha principal pelo merge do MCP (`9453776`).
  - 15–16/07: `9453776` "Configurou MCP com OAuth" — ferramenta fictícia `list_matches`, rotas `/.mcp/*` e `/.lovable/oauth/consent`. Foi removida em 03/10 (ver Fase 6).
  - 29/07: `b51a578` "Add project README" — o README com a ideia original ("Crie um app para barbearias onde ele tem integrado notificacoes e resultado do mundo esportivo") continua no repositório.
- **Onde:** só código de tela; nenhuma migration (o `supabase/` tinha só `config.toml`). O Supabase usado era o do próprio Lovable, cujo endereço deixou de existir depois (ver incidente de 21/09).
- **Ferramenta:** Lovable (`gpt-engineer-app[bot]`).
- **Entre 30/07 e 13/09:** nenhum commit nem migration. O que aconteceu nesse intervalo é **não confirmado**.

### Fase 1 — Fundação multi-loja, agenda e cliente (14 a 16/09/2026)

- **O que foi feito:**
  - Base multi-loja: lojas, catálogo, agendamentos, pontos (`20260914222150_foundation_multi_tenant` → `20260914234500_loyalty`).
  - Agenda confiável, gestão das próprias reservas pelo cliente, disponibilidade da loja (`20260915120000` → `20260915160000`).
  - 16/09, 24 migrations: acompanhamento de clientes e privacidade (`customer_insights`, `privacy_requests`, pesquisas, motivos de cancelamento), ajustes da loja, ocorrências opcionais (atrasos e falta), módulo de Esportes, confirmação automática, lista de espera por horário (`20260916500000_slot_waiting`) e identidade visual por loja (`20260916520000` → `20260916580000_brand_corner_style`).
  - Tela: tema claro/escuro, identidade visual por barbearia, cartão de fidelidade por nível, passagem `/mb` de modernização visual.
- **Decisões do dono registradas:** reservas confirmadas automaticamente; sem "registrar chegada" obrigatório; espera com 10 min de retenção + 5 de exclusividade; Esportes ligado só pelo admin da plataforma; três modos de canto com "semi arredondado" como padrão; reembolso só como ideia ([reembolso-futuro.md](../reembolso-futuro.md), 16/09).
- **Fontes:** CONTINUIDADE, seções de 16/09 ("Tema, metadados e páginas de erro", "Identidade visual por barbearia", "Módulo de espera por horário", "Agenda, ocorrências e pontos"); [customer-insights.md](../customer-insights.md).
- **Testes unitários (`npm test`, node --test):** 45 → 53.
- **Ferramenta:** **não confirmado**. Indícios: Codex (a skill pessoal de interface fica em `~/.codex/skills/mb/SKILL.md`; o incidente de 18/09 cita `apply_patch`, comando do Codex) e Cursor (o histórico local do Cursor tinha uma versão de `src/styles.css` de 17/09 18:36, usada na reconstrução de 18/09).

### Fase 2 — Equipe, sociedade e permissões (17 a 20/09/2026)

- **O que foi feito:**
  - 17/09: equipe e sociedade (`20260917120000_shop_team_governance`: papéis `owner`, `partner`, `associate` = Parceiro, `employee` = Contratado; participação societária; pedidos de mudança com aprovação), cadastro de equipe pela plataforma, ícones de serviço, **matriz de permissões configurável** (`20260917150000` → `20260917170000`), ferramentas do Parceiro (carteira, clientes, ritmo — `20260917180000_partner_tools`), diretório de clientes.
  - 17/09: agenda e reservas voltam a usar o **fuso da loja**; auditoria de código com 16 achados corrigidos.
  - 18/09: fundo da logo e personalização pelo Parceiro (`20260918020000`), rodapé, rolagem, ritmo na demonstração.
  - 20/09: fotos de serviço no storage, cabeçalho/rodapé flutuantes, marca da loja no login e **login fotográfico com três modelos** (`20260920010000` → `20260920040000`).
- **Decisões do dono:** matriz de permissões persistida no banco (17/09); "cada barbeiro tem carteira e clientes próprios; dados financeiros globais nunca são compartilhados" (18/09); rolagem nativa em vez de controle próprio (18/09).
- **Testes unitários (`npm test`, node --test):** 72 → 80.
- **Ferramenta:** **não confirmado**. Os mesmos indícios da fase 1 (Codex e Cursor), e os dois caem nesta fase: a versão de 17/09 no histórico local do Cursor e o `apply_patch` de 18/09.

### Fase 3 — Produção, WhatsApp, Google e domínios (21 a 25/09/2026)

- **O que foi feito:**
  - 21/09: primeiro commit do dono (`4d827ca`, consolidação); fluxos `.github/workflows/sync-instantanea.yml` e `sync-instantanea-hub.yml` (`7f121f3`, `ccd2e40`); build no Hostinger (`43d60e3`, `a57017f`); diagnóstico do login em produção; manual de operação [mb-operacao.md](../mb-operacao.md).
  - 22/09: WhatsApp pela Evolution API (`20260922010000`), links com slug, redirecionamentos e saída de barbearia (`20260922140000`), domínio próprio por loja (`20260922150000`).
  - 23/09: login Google e Agenda/Contatos (`20260923140000`), multi-loja por link com pontos por loja (`20260923160000`), slug manual do profissional, login no domínio da loja (pop-up do Google).
  - 24/09: cadastro de dono pelo próprio site com código no WhatsApp (`20260924120000`), modelos de mensagem, recorrência, avisos por e-mail, governança, gerente de conta, exclusão da conta, páginas `/privacidade` e `/termos`.
  - 25/09: escolha da agenda Google, sociedade e acessos controlados pelo dono (`20260925140000`).
- **Plano da fase:** [plano-governanca-sociedade-gerente.md](../plano-governanca-sociedade-gerente.md) (24/09; fases A–F marcadas como feitas).
- **Decisões do dono:** "sócio" vira co-dono; dono controla níveis de acesso; admin e gerente têm controle total; fundador ancorado até transferir (25/09).
- **Ferramentas:** provavelmente Claude Code nos commits de infraestrutura de 21/09 (trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` em `7f121f3`, `ccd2e40`, `43d60e3` e `a57017f`; o trailer identifica o modelo, não a ferramenta); Cursor a partir de 22/09 (coautor `cursoragent@cursor.com` em 55 dos 56 commits de 22 a 29/09; a exceção é o merge `b1d67c3`).

### Fase 4 — Usabilidade, idiomas, saúde do sistema e regra da vez (26 a 29/09/2026)

- **O que foi feito:**
  - 26–27/09: revisão de usabilidade `/mb` (alvos de 44 px, foco nas janelas, erros em linguagem cotidiana) — registro em [mb-revisao.md](../mb-revisao.md); **5 idiomas** (pt-BR, pt-PT, en-US, en-GB, es) em todo o sistema.
  - 29/09: cópia dos agendamentos para a Agenda Google (`20260929130000`), fila de e-mail resiliente (`20260929150000`), correções de permissões (`20260929170000`, `20260929180000`), marca da loja no login (`20260929190000`); varredura tela × banco × servidor.
  - 29/09: regra da vez — `scripts/vez.sh`, `scripts/autossave.sh`, `.cursor/hooks.json` e seção 9 do [AGENTS.md](../../AGENTS.md) (`d59ee9c`, `17983a9`).
- **Incidentes:** envio forçado e troca do servidor `supabase-teste` (ver [seção 5](#5-incidentes-e-lições)).
- **Decisão do dono:** toda comunicação e todo texto em pt-BR por padrão (26/09).
- **Ferramentas:** Cursor (commits); Kilo Code tinha uma cópia de trabalho parada em `28a5406` desde 27/09 (`.kilo/worktrees/olivine-gallimimus`, sem envios; CONTINUIDADE, 29/09). Em 12/10 ela já não existe: `.kilo/` só tem `.gitignore`, e `git worktree list` mostra só a `main`.

### Fase 5 — Servidor estabilizado, clube de pontos e página pública (30/09 a 02/10/2026)

- **O que foi feito:**
  - 30/09: "o outro assistente" restaurou login Google, variáveis do Google e auto-confirmação no servidor (nome da ferramenta **não confirmado**).
  - 02/10: permissões das funções restauradas (`20261002105000_restore_function_grants`); e-mail do sistema passa para SMTP do Hostinger; Realtime religado; modelos de e-mail do login em pt-BR (`public/email/`).
  - 02/10: **clube de pontos como módulo** ligado pela plataforma e página `/shop/pontos` (`20261002110000`); **página pública da barbearia** (`20261002120000`, `20261002170000`); **regras de agendamento numa fonte só** e atualização instantânea (`20261002190000`); forma de oferecer os horários por loja (`20261002210000_slot_offer_mode`); fotos com enquadramento inteligente.
- **Ferramentas:** Cursor (`Autossave (cursor)` desde `8266080`); Grok como agente na VPS (e-mail, conferências).
- **Testes unitários (`npm test`, node --test):** 115 → 124.

### Fase 6 — Auditoria, Google, cadastro e implantações (03 a 04/10/2026)

- **O que foi feito:**
  - Correção do horário de funcionamento, quebrado desde 24/09 (`20261003130000_fix_hours_replace`).
  - **Auditoria de 115 bugs** (124 achados, 115 confirmados) — `20261003150000_correcoes_auditoria`, `20261003160000_otp_tentativas`.
  - Política de privacidade reescrita para a verificação do Google ([google-verificacao.md](../google-verificacao.md)), tokens do Google protegidos, WhatsApp do perfil confirmado por código (`20261003170000` → `20261003190000`).
  - Cadastro de cliente e dono com aceite, nome e WhatsApp; Acordo de Dados (`20261003200000`, `20261003210000`).
  - Ajustes finais (`20261003220000`: apagar a loja inteira, WhatsApp sem revelar número confirmado em outra conta, limpeza de códigos OTP) e decisões do dono (`20261003230000`: avisos de WhatsApp só para número confirmado, fuso da loja) — **feito — falta aplicar no banco**.
  - MCP de exemplo do Lovable removido (só frontend, já publicado). O pacote `@lovable.dev/mcp-js` continua no [`package.json`](../../package.json) e no [`bunfig.toml`](../../bunfig.toml), sem uso; a remoção está **pendente** (CONTINUIDADE, "Entrega — decisões do dono aplicadas", 03/10).
  - CEP com preenchimento do endereço, novo layout do `/auth`, WhatsApp obrigatório no cadastro.
  - 04/10, madrugada: correção de anomalias visuais em todo o sistema (88 + 33 itens), por fotos de tela.
- **Implantações no servidor (03/10):** 5 migrations aplicadas às 17:44 PT (pelo agente da VPS, o Grok) e 2 às 19:34 PT (pelo "agente da VPS"; que fosse o mesmo Grok é **não confirmado**), seguindo [implantacao-2026-10-03.md](../implantacao-2026-10-03.md) e [implantacao-cadastro-2026-10-03.md](../implantacao-cadastro-2026-10-03.md). Guias de [ajustes finais](../implantacao-ajustes-finais-2026-10-03.md) (migration `20261003220000` e as funções `google-connect` e `whatsapp-dispatch`) e de [decisões](../implantacao-decisoes-2026-10-03.md) (migration `20261003230000` e a função `register-shop`) prontos: **feito — falta aplicar no banco**, nessa ordem (ver [seção 7](#7-estado-no-fim-do-histórico-09102026)).
- **Decisões do dono:** aplicar as quatro recomendações (WhatsApp confirmado, aceite para contas antigas, remover MCP, fuso da loja); WhatsApp obrigatório no cadastro por e-mail, com avisos ligados por padrão.
- **Ferramentas:** Claude Code (autossave desde `ed90e43`); Grok na VPS; Cursor em 2 autossaves no começo do dia.
- **Testes unitários (`npm test`, node --test):** 124 → 148.

### Fase 7 — Tempo de preparo e interface "mostrar em vez de explicar" (05 a 08/10/2026)

- **O que foi feito:**
  - 05/10: forma dos horários com duas opções ("No tamanho do serviço" e "Ajustável", sem mudar o banco); **tempo de preparo** entre atendimentos (`20261005120000_tempo_preparo`, guia [implantacao-preparo-2026-10-05.md](../implantacao-preparo-2026-10-05.md); **feito — falta aplicar no banco**).
  - 05/10: diretriz do dono "interface visual e autoexplicativa" ([mb-interface.md](../mb-interface.md), seção 4); onda 1 e componentes visuais comuns em [`src/components/visual/`](../../src/components/visual/index.ts).
  - 07/10, onda 2: redesenho de 12 áreas (painel, ajustes, cliente, plataforma, entrada) — `ae00852`.
  - 08/10, onda 3: pendências da onda 2, limpeza de 670 chaves de tradução e cerca de 850 linhas de CSS — `4b88e44`.
- **Só interface:** as ondas 2 e 3 não mudaram banco nem permissões.
- **Ferramenta:** Claude Code.
- **Testes unitários (`npm test`, node --test):** 192 (07/10) → 195 (08/10).

### Fase 8 — Separação de ambientes (09/10/2026)

- **Plano:** [plano-ambientes.md](../plano-ambientes.md) — 8 problemas, 5 ondas, 14 decisões; o dono aprovou todas as recomendações.
- **O que foi feito (`e7328ee`, só interface):**
  - Onda 1: "como quem" — sem papel definido, nenhum poder ([`shop-acting.ts`](../../src/lib/auth/shop-acting.ts)); demonstração com ids fictícios e trava de rede ([`demo-guard.ts`](../../src/lib/demo-guard.ts)).
  - Onda 2: destino depois do login ([`destination.ts`](../../src/lib/auth/destination.ts)), "Minhas áreas", recusas explicadas.
  - Onda 3: capacidades com nome ([`capabilities.ts`](../../src/lib/auth/capabilities.ts)), selo de papel tocável, aviso "vai para aprovação de…".
  - Onda 5 (parte de interface): cliente com várias lojas, ficha da loja com equipe na plataforma, demonstração com personagens próprios.
- **Falta:** onda 4 (convite com link, troca de senha, boas-vindas) e os itens de banco listados no topo do plano — ver [pendências](pendencias.md).
- **Ferramenta:** Claude Code.

## 4. Ferramentas que trabalharam no projeto

| Ferramenta                        | Quando                                       | Como aparece                                                                                                                                                                                                                               |
| --------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lovable (`gpt-engineer-app[bot]`) | 03/06–29/07                                  | 396 commits; template e README pelo usuário "Lovable"/"lovable".                                                                                                                                                                           |
| Codex                             | não confirmado (provável 14–20/09)           | Skill `~/.codex/skills/mb/SKILL.md` citada no [AGENTS.md](../../AGENTS.md) como "cópia legada"; `apply_patch` no incidente de 18/09.                                                                                                       |
| Claude Code                       | 21/09 (provável); principal de 03/10 a 09/10 | Trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` em 4 commits de 21/09 (identifica o modelo, não a ferramenta; por isso "provável"); "Autossave (claude-code)" de 03/10 a 09/10; seções "(…, Claude Code)" no CONTINUIDADE. |
| Cursor                            | 22/09–03/10 (indício em 17/09)               | Coautor `cursoragent@cursor.com` em 55 dos 56 commits de 22–29/09 e nos 8 commits manuais de 02/10; "Autossave (cursor)" em 02–03/10; versão de 17/09 no histórico local do Cursor, usada para recuperar o CSS em 18/09.                   |
| Kilo Code                         | 27/09                                        | Cópia de trabalho em `.kilo/worktrees/olivine-gallimimus`, parada em `28a5406`, sem envios (CONTINUIDADE, 29/09). Em 12/10 já não existe: `.kilo/` só tem `.gitignore`, e `git worktree list` mostra só a `main`.                          |
| Grok                              | 02/10–03/10                                  | Agente com acesso à VPS (sem push no GitHub): e-mail Hostinger em 02/10 e implantação das 17:44 PT de 03/10; o registro no repositório foi feito por outra máquina.                                                                        |
| "outro assistente"                | 30/09                                        | Restaurou login Google e variáveis no servidor (CONTINUIDADE, 29/09 noite, item de 02/10). Ferramenta **não confirmada**.                                                                                                                  |

`Flow01ProhMedia` é o usuário git do dono e aparece em todos os commits feitos pelas ferramentas acima, fora do Lovable.

## 5. Incidentes e lições

Em ordem cronológica. Cada item traz o que aconteceu, a lição e a fonte. Os dois últimos (08 a 12/10) dependem em parte de fontes fora do repositório; o que vem delas está marcado como **não confirmado**.

### 16/09 — sessões sobrescrevendo o trabalho uma da outra

- **O que houve:** durante uma validação, outra sessão gravou `src/routes/auth.tsx` e sobrescreveu `ArenaApp.tsx` e `ShopShell.tsx`. A versão nova voltou a usar o fuso do navegador, contra a regra do fuso da loja.
- **Lição:** duas ferramentas no mesmo arquivo perdem trabalho. É uma das bases da regra da vez.
- **Fonte:** CONTINUIDADE, "Validação da última implementação".

### 18/09 — `src/styles.css` zerado

- **O que houve:** uma escrita interrompida de outra sessão deixou `src/styles.css` com 0 bytes. O conteúdo atual nunca tinha sido commitado. Foi reconstruído byte a byte com o histórico local do Cursor e o cache do Chrome.
- **Lição:** commitar `styles.css` com frequência e ter commit ou cópia antes de usar ferramentas que reescrevem arquivos inteiros.
- **Fonte:** CONTINUIDADE, "Incidente: `src/styles.css` zerado e reconstruído — 18/09/2026".

### 21/09 — login de produção com `Failed to fetch`

- **O que houve:** o pacote publicado apontava para o Supabase antigo da fase Lovable (o mesmo `project_id` de `supabase/config.toml` em `b51a578`), cujo endereço não resolvia mais.
- **Lição:** conferir as variáveis `VITE_SUPABASE_*` no Hostinger e republicar. Variáveis `SUPABASE_*` sem o prefixo `VITE_` não chegam ao navegador.
- **Fonte:** CONTINUIDADE, "Diagnóstico do login em produção — 21/09/2026".

### 22/09 a 03/10 — defeitos silenciosos em produção

- **O que houve:**
  - desde 22/09, ninguém conseguia sair de uma barbearia (`request_shop_departure`);
  - desde 24/09, as mudanças protegidas falhavam, porque havia duas versões de `request_shop_change` (`PGRST203`);
  - desde 24/09, o horário de funcionamento salvo pelo painel falhava (`hours.replace`).
- **Correção:** `20260929180000`, `20261003130000` e `20261003150000`, além da varredura tela × banco de 29/09.
- **Lição:** cada função chamada pela tela precisa de teste no banco. Hoje são 33 arquivos em `supabase/tests/`.
- **Fonte:** CONTINUIDADE, 29/09 ("Permissões da equipe") e as entregas de 02–03/10.

### 29/09, por volta de 19h20 — envio forçado tirou entregas do ar

- **O que houve:** a `main` do remoto `hostinger` foi rebobinada para `28a5406` (25/09), tirando do site as entregas de 26 a 29/09. Causa confirmada: o `origin` estava parado em 25/09, e o espelho `hub-control` copia o `origin` por cima do `hostinger`. Foi restaurado com envio normal de `35325ac`.
- **Lição:** enviar ao `origin` é o que publica. Nunca enviar só ao `hostinger` e nunca usar `--force`.
- **Fonte:** CONTINUIDADE, "Vez entre ferramentas + incidente de envio forçado (29/09/2026)".

### 29/09, noite — troca do servidor `supabase-teste`

- **O que houve:** o serviço foi reconfigurado no Coolify, e `supabase-teste.proh.media` passou a levar a outro servidor ("Flow TEST"). A tarefa de envios (WhatsApp, e-mail, Google) chamava esse endereço e respondia 500. O `.env` do serviço também voltou a uma base de 22/09: login Google desligado e SMTP recusado.
- **Lição:** o endereço oficial é `supabase-barbearia.proh.media`. **Não usar `supabase-teste`.** Há cópias `.env.bak-*` no servidor.
- **Fonte:** CONTINUIDADE, "Endereço do servidor mudou — `supabase-teste` agora é outro servidor".

### 02/10 — permissões perdidas na cópia do banco

- **O que houve:** a cópia do banco para o stack novo perdeu os `REVOKE`s. Funções com privilégio elevado ficaram liberadas para visitantes anônimos.
- **Correção:** `20261002105000_restore_function_grants`.
- **Lição:** conferir os privilégios depois de cada aplicação: passo 6 do [implantacao-2026-10-03.md](../implantacao-2026-10-03.md); nos guias seguintes, a conferência `has_function_privilege('anon', …)` fica na seção "Aplicar".
- **Fonte:** CONTINUIDADE, "Entrega — clube de pontos, página da barbearia e Ajustes reorganizados (02/10/2026)".

### 02/10 — Realtime religado à mão

- **O que houve:** o Realtime tinha sido parado de propósito e foi religado editando o `docker-compose.yml`. A configuração salva no Coolify ainda diz `restart: "no"`.
- **Lição:** não usar "Redeploy" do serviço no Coolify, porque ele desfaz ajustes manuais.
- **Fonte:** CONTINUIDADE, "Entrega — regras de agendamento numa fonte só e atualização instantânea (02/10/2026, noite)".

### 03/10, 17:19 PT — teste rodado fora de transação no banco de produção

- **O que houve:** o teste opcional `loyalty_program_module.sql` rodou em autocommit e deixou na produção uma loja de teste e 5 usuários `@example.invalid`. Foi limpo pelo script `supabase/manutencao/2026-10-03_limpeza_fixture_loyalty.sql` (passo 3b do guia).
- **Lição:** testes SQL sempre em `BEGIN … ROLLBACK`. O guia passou a trazer o comando exato.
- **Fonte:** CONTINUIDADE, "Incidente — teste rodado fora de transação no banco de produção"; [implantacao-2026-10-03.md](../implantacao-2026-10-03.md), passo 3b.

### 03/10 — VPS sem push no GitHub

- **O que houve:** `vez.sh pedir` falhou na VPS por falta de credencial. Os resultados das implantações tiveram de ser registrados por outra máquina.
- **Lição:** registrar sempre por uma máquina com push. Dar à VPS uma chave de escrita continua pendente.
- **Fonte:** CONTINUIDADE, "Implantação aplicada em produção — entregas de 03/10/2026".

### 08/10 e 09/10 — disco do Mac cheio (não confirmado)

- **O que houve:** segundo o registro da sessão do Claude Code, o disco do Mac encheu (`/private/tmp`) durante a verificação por fotos de tela da onda 3; os comandos falharam com `ENOSPC`, e a verificação foi interrompida e retomada depois de liberar espaço. Pela mesma fonte, em 09/10 o servidor local de desenvolvimento caiu com o disco quase cheio.
- **Situação:** **não confirmado** — a fonte fica fora do repositório, e nada disso está no CONTINUIDADE. Nenhum documento diz que a verificação da onda 3 ficou incompleta: o CONTINUIDADE (onda 3, 08/10, item "Verificação") registra como feitas as fotos de cliente, dono e plataforma em 390 claro e escuro, 320 e 1280, e do `/auth`.
- **Lição:** apagar fotos e saídas temporárias depois de conferir e não gerar arquivos grandes. A causa principal foi achada e corrigida em 12/10: um gancho de backup do Claude Code copiava pastas inteiras a cada `rm` ([como-trabalhar.md](como-trabalhar.md#7-armadilhas-conhecidas), "Espaço no disco do Mac").
- **Fonte:** registro da sessão do Claude Code, fora do repositório (outro agente não consegue conferir).

### Até 12/10 — ferramenta de fotos fora do repositório

- **O que houve:** a ferramenta de fotos de tela usada nas verificações ficava fora do repositório (CONTINUIDADE, "Entrega — correção de anomalias visuais em todo o sistema", 04/10: "Ferramenta de captura (fora do repositório): login de admin simulado no Playwright + `/demo?view=…`"). Em 12/10 o projeto ganhou ferramentas próprias em `scripts/`.
- **Não confirmado** (vem só da memória do Claude Code, fora do repositório): o nome da ferramenta antiga (`snap.mjs`), o local (pasta temporária em `/private/tmp`, que o macOS apagou entre 09/10 e 12/10) e a causa de uma quebra anterior (versão fixa do `playwright-core` dentro da extensão Kilo Code do Cursor).
- **Lição:** ferramentas reutilizáveis ficam em `scripts/` ([`foto.mjs`](../../scripts/foto.mjs) e [`verificar.sh`](../../scripts/verificar.sh), criadas em 12/10). O `foto.mjs` procura o Playwright sem versão fixa ([scripts/README.md](../../scripts/README.md), seção `foto.mjs`, "Requisitos").
- **Fonte:** CONTINUIDADE (04/10) para a ferramenta fora do repositório; o resto, memória do Claude Code.

### Ainda aberto

O crontab do root no servidor chama, a cada 15 min, uma função `google-drive/share-expire` que não existe neste projeto. Os erros 500 são inofensivos. Aguarda confirmação do dono antes de remover (CONTINUIDADE, "Varredura de saúde", 29/09).

## 6. Regras que nasceram dos incidentes

| Regra                                                                                                                                              | Origem                                                  | Onde está escrita                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Só uma ferramenta edita por vez; `git pull --ff-only` antes; `vez.sh pedir/checar`; `autossave.sh` ao terminar.                                    | 16/09, 18/09, 29/09                                     | [AGENTS.md](../../AGENTS.md), seção 9; [`scripts/vez.sh`](../../scripts/vez.sh); [`.cursor/hooks.json`](../../.cursor/hooks.json)              |
| Enviar ao `origin` publica o site; nunca enviar só ao `hostinger`; nunca `git push --force` na `main`.                                             | 29/09                                                   | AGENTS.md, seção 9, itens 5–7; [`sync-instantanea-hub.yml`](../../.github/workflows/sync-instantanea-hub.yml)                                  |
| Só enviar trabalho verificado (tipos e montagem).                                                                                                  | 29/09 (cada envio vai ao ar)                            | AGENTS.md, seção 9, item 5; [`scripts/verificar.sh`](../../scripts/verificar.sh)                                                               |
| Commitar `src/styles.css` com frequência; ter commit ou cópia antes de reescrever arquivos inteiros.                                               | 18/09                                                   | CONTINUIDADE, incidente de 18/09                                                                                                               |
| No servidor: backup antes; ensaio em `BEGIN … ROLLBACK`; migrations antes das funções; só reiniciar o container de funções; não imprimir segredos. | 03/10 (e 02/10)                                         | [implantacao-2026-10-03.md](../implantacao-2026-10-03.md), "Regras de segurança"                                                               |
| **Nunca** rodar arquivo de `supabase/tests/` fora de transação.                                                                                    | 03/10, 17:19 PT                                         | [implantacao-preparo-2026-10-05.md](../implantacao-preparo-2026-10-05.md), regras iniciais                                                     |
| Não usar "Redeploy" do serviço no Coolify.                                                                                                         | 02/10 (Realtime)                                        | implantacao-2026-10-03.md, regra 5                                                                                                             |
| Conferir privilégios (`anon` sem `EXECUTE`) depois de cada aplicação.                                                                              | 02/10 (`REVOKE`s perdidos)                              | [implantacao-2026-10-03.md](../implantacao-2026-10-03.md), passo 6; nos guias seguintes, seção "Aplicar" (`has_function_privilege('anon', …)`) |
| Não usar `supabase-teste.proh.media`; endereço oficial `supabase-barbearia.proh.media`.                                                            | 29/09                                                   | CONTINUIDADE, 29/09 noite; [mb-operacao.md](../mb-operacao.md)                                                                                 |
| Registrar resultados do servidor por uma máquina com push.                                                                                         | 03/10                                                   | CONTINUIDADE, 03/10; [implantacao-cadastro-2026-10-03.md](../implantacao-cadastro-2026-10-03.md), item 6                                       |
| Ao criar loja nova, acrescentar o roteador dela em `beauty-shop-certs.yaml` no servidor (certificado do subdomínio).                               | 02/10 (certificado padrão do Traefik)                   | CONTINUIDADE, "Domínio público + slug do barbeiro — 23/09/2026"                                                                                |
| A demonstração nunca chama o banco real (ids fictícios e trava de rede, com teste).                                                                | 09/10 (diagnóstico 7 do plano)                          | [plano-ambientes.md](../plano-ambientes.md), princípio 6; [`demo-guard.ts`](../../src/lib/demo-guard.ts)                                       |
| Ferramentas de verificação ficam em `scripts/`, não em pasta temporária; Playwright sem versão fixa; apagar `.fotos` depois.                       | 04/10–12/10 (ferramenta de captura fora do repositório) | [`scripts/README.md`](../../scripts/README.md); [como-trabalhar.md](como-trabalhar.md)                                                         |

## 7. Estado no fim do histórico (09/10/2026)

- **Banco:** 85 migrations no repositório. A produção estava com 82 em 03/10 (CONTINUIDADE, "ajustes finais"). Situação das 3 restantes, na **ordem obrigatória 220000 → 230000 → 20261005120000** (a 230000 vem depois da 220000, e o preparo depende das duas — começo de [implantacao-decisoes-2026-10-03.md](../implantacao-decisoes-2026-10-03.md) e de [implantacao-preparo-2026-10-05.md](../implantacao-preparo-2026-10-05.md)):
  - `20261003220000_ajustes_finais` — feito — falta aplicar no banco (e publicar `google-connect` e `whatsapp-dispatch`);
  - `20261003230000_decisoes_whatsapp_fuso` — feito — falta aplicar no banco (e publicar `register-shop`);
  - `20261005120000_tempo_preparo` — feito — falta aplicar no banco (nenhuma função para publicar).
  - Guia e efeito de cada uma: [pendencias.md](pendencias.md), P-21, P-22 e P-23.
  - Se alguma já foi aplicada depois de 05/10: **não confirmado** (nenhum registro no repositório).
- **Testes:** 33 arquivos em `supabase/tests/` (32 testes SQL e 1 teste de concorrência em Python, `waiting_concurrency.py`); 195 testes unitários (`npm test`, node --test) em 08/10 (CONTINUIDADE, onda 3). O número de 09/10 não foi registrado. Não há suíte de testes de interface no repositório; a conferência visual é feita por fotos ([`scripts/foto.mjs`](../../scripts/foto.mjs)).
- **Edge functions:** 12 pastas em `supabase/functions/` (11 funções + `_shared`).
- **Próximos passos:** ver [pendencias.md](pendencias.md); como retomar: [como-trabalhar.md](como-trabalhar.md).
