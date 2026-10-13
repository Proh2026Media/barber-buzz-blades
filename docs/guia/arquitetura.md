# Arquitetura — mapa do código

Mapa do Barba & Cabelo para quem vai **mudar código**. Tudo aqui foi conferido no código e no git em 12/10/2026; o que não deu para conferir está marcado como "não confirmado". O histórico detalhado de cada entrega fica no [CONTINUIDADE](../CONTINUIDADE.md). Porta de entrada: [LEIA-PRIMEIRO](../LEIA-PRIMEIRO.md).

## Índice

1. [Stack e versões](#1-stack-e-versões)
2. [Como o app é servido](#2-como-o-app-é-servido)
3. [Mapa de pastas](#3-mapa-de-pastas)
4. [Sessão, acesso e áreas](#4-sessão-acesso-e-áreas)
5. [Os quatro "shells"](#5-os-quatro-shells)
6. [Loja pelo endereço](#6-loja-pelo-endereço)
7. [Idiomas](#7-idiomas)
8. [Tema e modos de canto](#8-tema-e-modos-de-canto)
9. [PWA](#9-pwa)
10. [Modo demonstração](#10-modo-demonstração)
11. [Uso do Supabase](#11-uso-do-supabase)
12. [Edge functions](#12-edge-functions)
13. [Integrações externas](#13-integrações-externas)
14. [Testes, lint e formatação](#14-testes-lint-e-formatação)
15. [Onde mexer para…](#15-onde-mexer-para)
16. [Armadilhas](#16-armadilhas)
17. [Não confirmado e a decidir](#17-não-confirmado-e-a-decidir)

Documentos irmãos: [papéis e permissões](papeis-e-permissoes.md) · [banco e implantação](banco-e-implantacao.md) · [como trabalhar](como-trabalhar.md) · [pendências](pendencias.md) · [histórico](historico.md).

---

## 1. Stack e versões

Versões declaradas em [package.json](../../package.json) (instaladas em `node_modules` entre parênteses, conferidas em 12/10).

| Peça                     | Pacote                                                                                    | Versão                                       |
| ------------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------- |
| Interface                | `react`, `react-dom`                                                                      | ^19.2.0 (19.2.5)                             |
| Rotas                    | `@tanstack/react-router` + `@tanstack/router-plugin`                                      | ^1.168.25 / ^1.167.28                        |
| Framework (SSR/servidor) | `@tanstack/react-start`                                                                   | ^1.167.50                                    |
| Montagem                 | `vite`                                                                                    | ^7.3.1 (7.3.2)                               |
| Servidor da montagem     | `nitro`                                                                                   | 3.0.260603-beta (fixa)                       |
| Configuração Vite        | `@lovable.dev/vite-tanstack-config`                                                       | 2.7.7 (fixa)                                 |
| Estilos                  | `tailwindcss` + `@tailwindcss/vite`, `tw-animate-css`                                     | ^4.2.1 (4.2.4)                               |
| Componentes              | Radix (`@radix-ui/*`), shadcn estilo `new-york`                                           | ver [components.json](../../components.json) |
| Ícones                   | `lucide-react`, `@lucide/lab`                                                             | ^0.575.0 / ^0.7.0                            |
| Dados                    | `@supabase/supabase-js`                                                                   | ^2.110.5                                     |
| Cache de consultas       | `@tanstack/react-query`                                                                   | ^5.83.0                                      |
| Formulários              | `react-hook-form`, `zod`, `@hookform/resolvers`                                           | ^7.71.2 / ^4.4.3 / ^5.2.2                    |
| Gráficos, datas, avisos  | `recharts`, `date-fns`, `sonner`                                                          | ^2.15.4 / ^4.1.0 / ^2.0.7                    |
| PWA                      | `vite-plugin-pwa`                                                                         | ^1.3.0                                       |
| Tipos                    | `typescript`                                                                              | ^5.8.3 (5.9.3)                               |
| Fontes                   | `@fontsource-variable/*` (Inter, Manrope, Montserrat, Nunito Sans, Roboto, Source Sans 3) | ^5.3.0                                       |

- shadcn: [components.json](../../components.json) — `style: new-york`, `baseColor: slate`, CSS em `src/styles.css`, apelidos `@/components`, `@/components/ui`, `@/lib`, `@/hooks`.
- Apelido `@/*` → `./src/*` em [tsconfig.json](../../tsconfig.json) (`strict: true`, `allowImportingTsExtensions: true`).
- Gerenciador de pacotes: o projeto tem `bun.lock` e [bunfig.toml](../../bunfig.toml) (trava de 24 h para versões novas), mas os scripts e as verificações registradas usam `npm run …`. Qual é o oficial: não confirmado.
- **Pacote sem uso:** `@lovable.dev/mcp-js` (^0.22.2) segue no `package.json` e no `minimumReleaseAgeExcludes` do `bunfig.toml`, mas nada em `src` o importa. O MCP de exemplo saiu em 03/10/2026 (comentário em [vite.config.ts](../../vite.config.ts), linhas 20–21; CONTINUIDADE, "decisões do dono aplicadas", 03/10). Remoção: pendente ([pendencias.md](pendencias.md), P-46).

## 2. Como o app é servido

- [vite.config.ts](../../vite.config.ts) usa `defineConfig` do `@lovable.dev/vite-tanstack-config`, que **já inclui** tanstackStart, React, Tailwind, tsconfig-paths e nitro — não adicionar de novo (comentário no topo do arquivo).
- `nitro.preset: "node-server"` ([vite.config.ts:23](../../vite.config.ts)): a Hostinger roda Node, não Cloudflare. Fixado no commit `a57017f` (21/09/2026, "Build na Hostinger: fixar nitro preset node-server").
- `npm run build` = `vite build && node scripts/copy-pwa.mjs`. Saída em `.output/` (`.output/public` para estáticos); o service worker sai em `dist/` e é copiado para `.output/public` por [scripts/copy-pwa.mjs](../../scripts/copy-pwa.mjs).
- Entrada do servidor: [src/server.ts](../../src/server.ts) (embrulha o SSR e troca erro 500 cru por página de erro, [src/lib/error-page.ts](../../src/lib/error-page.ts)); [src/start.ts](../../src/start.ts) registra o middleware de erro e o `attachSupabaseAuth`.
- **Quase todas as rotas são `ssr: false`** (rodam só no navegador, a sessão fica no `localStorage`). Têm SSR ligado só `/` (para robôs do Google lerem a página inicial — [src/routes/index.tsx:27](../../src/routes/index.tsx)) e as páginas legais (`/politica`, `/privacidade`, `/termos`, `/acordo-de-dados`).
- Publicação: enviar ao `origin` → GitHub Actions avisa o `hub-control` → espelho no repositório da Hostinger → a Hostinger compila. Detalhes e regras em [AGENTS.md](../../AGENTS.md) seção 9 e em [banco-e-implantacao.md](banco-e-implantacao.md).
- Caminho de uma requisição de subdomínio (Cloudflare → Traefik na VPS → Hostinger): [beauty-saas-infra.md](../beauty-saas-infra.md).
- Funções de servidor do TanStack (`createServerFn`): só existe o exemplo [src/lib/api/example.functions.ts](../../src/lib/api/example.functions.ts), que nada usa. A lógica de servidor vive no banco (RPC) e nas edge functions.

## 3. Mapa de pastas

### Raiz

| Caminho                      | O que é                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/`                       | o app                                                                                                                                                                                                                                                                                                                                                                                                               |
| `supabase/migrations/`       | 85 migrations SQL (de `20260914222150_foundation_multi_tenant.sql` a `20261005120000_tempo_preparo.sql`); as 3 últimas estão **feito — falta aplicar no banco** (nota abaixo da tabela)                                                                                                                                                                                                                             |
| `supabase/tests/`            | 32 testes SQL no git (+ `waiting_concurrency.py`, local e fora do git)                                                                                                                                                                                                                                                                                                                                              |
| `supabase/functions/`        | 11 edge functions + `_shared/`                                                                                                                                                                                                                                                                                                                                                                                      |
| `supabase/manutencao/`       | scripts de manutenção pontual: `2026-10-03_limpeza_fixture_loyalty.sql`, limpeza do incidente de 03/10 (passo 3b de [implantacao-2026-10-03.md](../implantacao-2026-10-03.md); rodado em produção em 03/10, CONTINUIDADE linha 273)                                                                                                                                                                                 |
| `supabase/slot-waiting.cron` | modelo do cron da VPS (`/etc/cron.d/barba-slot-waiting`) que roda `process_slot_waits()` a cada minuto                                                                                                                                                                                                                                                                                                              |
| `public/`                    | `manifest.webmanifest`, `icons/`, `images/`, `email/` (modelos de e-mail do Auth em pt-BR)                                                                                                                                                                                                                                                                                                                          |
| `scripts/`                   | vez, autossave, PWA, domínios e as ferramentas de verificação ([scripts/README.md](../../scripts/README.md))                                                                                                                                                                                                                                                                                                        |
| `.cursor/`                   | regras (`idioma.mdc`, `mb.mdc`), skill `mb`, `hooks.json` da vez                                                                                                                                                                                                                                                                                                                                                    |
| `.github/workflows/`         | [sync-instantanea-hub.yml](../../.github/workflows/sync-instantanea-hub.yml): **a publicação** (avisa o `PROH-Media/hub-control`, segredo `HUB_DISPATCH_TOKEN`). [sync-instantanea.yml](../../.github/workflows/sync-instantanea.yml): aviso à "Blindagem", outro controle (cofre `Proh2026Media/backup-control`, segredo `BLINDAGEM_TOKEN`); também dispara a cada envio à `main` do `origin`, mas **não publica** |

**Migrations ainda fora do banco (12/10/2026)** — situação das três: **feito — falta aplicar no banco**.

| Migration                               | O que o CONTINUIDADE registra                          |
| --------------------------------------- | ------------------------------------------------------ |
| `20261003220000_ajustes_finais`         | "não aplicada" (03/10, linha 237)                      |
| `20261003230000_decisoes_whatsapp_fuso` | "banco e `register-shop` pendentes" (03/10, linha 222) |
| `20261005120000_tempo_preparo`          | "migration pendente na VPS" (05/10, linha 176)         |

- Último registro de aplicação: `20261003210000_slugify_acentos` (03/10, 19:34 PT, linha 246). Se as três foram aplicadas depois sem registro: não confirmado.
- Ordem obrigatória: 220000 → 230000 → 120000 ([implantacao-preparo-2026-10-05.md](../implantacao-preparo-2026-10-05.md)). Guias e o que cada uma destrava: [pendencias.md](pendencias.md), P-21 a P-23.

### `src/` (arquivos soltos)

- [src/router.tsx](../../src/router.tsx) — cria o roteador (`trailingSlash: "never"`, `QueryClient` no contexto).
- [src/routeTree.gen.ts](../../src/routeTree.gen.ts) — **gerado** pelo plugin do roteador; não editar.
- [src/styles.css](../../src/styles.css) — Tailwind 4, variáveis de tema, raios (`--radius`, `--control-radius`, `--panel-radius`, `--button-radius`), regras dos modos de canto (~4 mil linhas).
- [src/hooks/use-mobile.tsx](../../src/hooks/use-mobile.tsx) — `useIsMobile` (quebra em 768 px).

### `src/routes/` — uma rota por arquivo

| Arquivo                                                          | Endereço            | O que faz                                                                                                               |
| ---------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [\_\_root.tsx](../../src/routes/__root.tsx)                      | (todas)             | `<html>`, metas, scripts de tema/idioma antes da pintura, `PwaRegister`, banner de instalação, `Toaster`, 404 e erro    |
| [index.tsx](../../src/routes/index.tsx)                          | `/`                 | SSR; no endereço principal mostra `PlatformLanding`, no da loja `ShopLanding`; app instalado ou logado vai à área certa |
| [auth.tsx](../../src/routes/auth.tsx)                            | `/auth`             | entrar, cadastrar cliente, senha, código por WhatsApp, Google (≈2,5 mil linhas)                                         |
| [auth\_.google-apps.tsx](../../src/routes/auth_.google-apps.tsx) | `/auth/google-apps` | retorno do Google Agenda/Contatos (chama `google-connect`)                                                              |
| [cadastrar.tsx](../../src/routes/cadastrar.tsx)                  | `/cadastrar`        | cadastro do dono e da barbearia (chama `register-shop`)                                                                 |
| [app.tsx](../../src/routes/app.tsx)                              | `/app`              | app do cliente (`ArenaApp`); aceita `?shop`, `?barber`, `?tab`, `?reserva`, `?day`, `?time`, `?aviso`…                  |
| [shop.tsx](../../src/routes/shop.tsx)                            | `/shop`             | painel da barbearia (`ShopShell`), exige `requireProfessional`                                                          |
| [shop\_.pontos.tsx](../../src/routes/shop_.pontos.tsx)           | `/shop/pontos`      | administração do clube de pontos (`LoyaltyAdminPage`)                                                                   |
| [platform.tsx](../../src/routes/platform.tsx)                    | `/platform`         | painel da plataforma (`PlatformShell`), só `platform_admin`; no domínio de loja manda ao principal                      |
| [demo.tsx](../../src/routes/demo.tsx)                            | `/demo`             | demonstração (`DemoWorkspace`), só `platform_admin`; `?view=`, `?shop=`, `?volta=ficha`                                 |
| [b.$shopSlug.tsx](../../src/routes/b.$shopSlug.tsx)              | `/b/<loja>`         | página pública da loja no endereço principal                                                                            |
| [$barberSlug.tsx](../../src/routes/$barberSlug.tsx)              | `/<profissional>`   | link do profissional no endereço da loja → `/app?barber=…&shop=…`; lista de nomes reservados no topo                    |
| [politica.tsx](../../src/routes/politica.tsx)                    | `/politica`         | regras do clube de pontos (SSR)                                                                                         |
| [privacidade.tsx](../../src/routes/privacidade.tsx)              | `/privacidade`      | política de privacidade (SSR)                                                                                           |
| [termos.tsx](../../src/routes/termos.tsx)                        | `/termos`           | termos de uso (SSR)                                                                                                     |
| [acordo-de-dados.tsx](../../src/routes/acordo-de-dados.tsx)      | `/acordo-de-dados`  | acordo de tratamento de dados (SSR)                                                                                     |

Convenções em [src/routes/README.md](../../src/routes/README.md). O `_` em `shop_.pontos` e `auth_.google-apps` tira a rota do aninhamento (não herda o layout de `/shop` nem de `/auth`).

### `src/features/` — uma pasta por assunto

| Pasta                                                 | Conteúdo                                                                                                                                                                                                    |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [account/](../../src/features/account/)               | "Minhas áreas" (`MyAreas.tsx`, `useAreas.tsx`): troca entre plataforma, lojas e app do cliente                                                                                                              |
| [auth/](../../src/features/auth/)                     | peças das telas de entrada (`entry/`: código, Google, regras de senha, aceite) e troca de senha                                                                                                             |
| [customer/](../../src/features/customer/)             | app do cliente: `ArenaApp.tsx` (≈3,7 mil linhas), agendamento (`booking/`), cartão de membro, várias lojas (`shop-choice.ts`), reserva por link (`ReservationAccessGate.tsx`), placares (`SportsBoard.tsx`) |
| [demo/](../../src/features/demo/)                     | demonstração: `DemoWorkspace.tsx`, estado fictício (`model.ts`), papéis (`roles.ts`), equipe (`team.ts`), contextos                                                                                         |
| [insights/](../../src/features/insights/)             | relatórios, pesquisas, ritmo, motivos de cancelamento, central de privacidade e direitos do titular                                                                                                         |
| [legal/](../../src/features/legal/)                   | moldura das páginas legais, versões dos textos (`versions.ts`), aceite de termos novos (`TermsUpdateGate.tsx`)                                                                                              |
| [loyalty/](../../src/features/loyalty/)               | clube de pontos: regra (`program.ts`), selo de nível, recompensas, página `/shop/pontos`                                                                                                                    |
| [marketing/](../../src/features/marketing/)           | página inicial da plataforma e página pública da loja (`ShopLanding.tsx`)                                                                                                                                   |
| [platform/](../../src/features/platform/)             | painel da plataforma: `PlatformShell.tsx`, lojas, ficha da loja, acessos, gerentes de conta, WhatsApp da plataforma                                                                                         |
| [register-owner/](../../src/features/register-owner/) | regras do cadastro do dono (prévia do link, WhatsApp) e fuso horário                                                                                                                                        |
| [shop/](../../src/features/shop/)                     | painel da barbearia: `ShopShell.tsx` (≈2,6 mil linhas) + `agenda/`, `catalog/` (serviços e equipe), `hours/`, `settings/` (Ajustes), marca, permissões, diretório de clientes                               |
| [waiting/](../../src/features/waiting/)               | lista de espera por horário (`useWaiting.ts`, `model.ts`, telas)                                                                                                                                            |

### `src/components/`

- [ui/](../../src/components/ui/) — componentes shadcn/Radix (botão, diálogo, folha, abas…) + alguns próprios (`schedule-picker`, `service-icon`, `staff-photo`, `empty-state`).
- [visual/](../../src/components/visual/) — **componentes visuais comuns da diretriz MB** (status, avisos, escolhas em cartões/chips, etapas, números, confirmação). Importar de `@/components/visual` ([index.ts](../../src/components/visual/index.ts)). Regra em [mb-interface.md](../mb-interface.md), seção 4.
- Soltos: `LanguageSwitcher`, `LanguageSettingsCard`, `ThemeToggle`, `NotFoundPage`, `pwa-install-banner`.

### `src/lib/`

| Caminho                                                                               | Conteúdo                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [auth/](../../src/lib/auth/)                                                          | sessão, guardas, áreas, destino pós-login, poderes no painel, erros amigáveis, WhatsApp do cadastro, ponte de login no domínio da loja (`return-origin.ts`), RPC opcional                                                                  |
| [i18n/](../../src/lib/i18n/)                                                          | idiomas (ver seção 7)                                                                                                                                                                                                                      |
| [shop/](../../src/lib/shop/)                                                          | loja pelo endereço (`host.ts`), marca e cantos (`branding.ts`, `branding-persist.ts`), regras de horários (`appointments.ts`), sinal de agenda (`availability-signal.ts`), fotos de serviço, favicon, links (`shop-link.ts`, `slugify.ts`) |
| [whatsapp/](../../src/lib/whatsapp/)                                                  | modelos de mensagem e variáveis (`templates.ts`)                                                                                                                                                                                           |
| [address/](../../src/lib/address/)                                                    | CEP → endereço (ViaCEP)                                                                                                                                                                                                                    |
| [integrations/](../../src/lib/integrations/)                                          | mensagens amigáveis para erros de Google/WhatsApp/domínio                                                                                                                                                                                  |
| `theme.ts`, `use-theme.ts`, `use-theme-preference.ts`                                 | tema claro/escuro/sistema                                                                                                                                                                                                                  |
| `demo-guard.ts`                                                                       | trava de rede da demonstração                                                                                                                                                                                                              |
| `pwa.ts`, `standalone.ts`                                                             | registro do service worker; "aberto pelo ícone instalado?"                                                                                                                                                                                 |
| `utils.ts`, `use-return-focus.ts`, `use-scroll-indicators.ts`                         | `cn()` e ajudantes de foco e rolagem                                                                                                                                                                                                       |
| `error-capture.ts`, `error-page.ts`, `lovable-error-reporting.ts`, `config.server.ts` | infraestrutura herdada do modelo Lovable                                                                                                                                                                                                   |

### `src/integrations/supabase/`

- [client.ts](../../src/integrations/supabase/client.ts) — cliente do navegador (`import { supabase } from "@/integrations/supabase/client"`). Lê `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`; sessão no `localStorage` com chave fixa `sb-supabasebeauty-auth-token`; fluxo PKCE; o `fetch` passa pela trava da demonstração.
- [types.ts](../../src/integrations/supabase/types.ts) — tipos do banco (`Tables<…>`, `Enums<…>`). Atualizado junto com as migrations (ex.: CONTINUIDADE, "tempo de preparo", 05/10); se é gerado ou editado à mão: não confirmado.
- `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts` — do modelo Lovable, para funções de servidor. `client.server.ts` e `auth-middleware.ts` não têm nenhum uso no código. `auth-attacher.ts` (`attachSupabaseAuth`) só é registrado em [start.ts](../../src/start.ts), como `functionMiddleware`; ele só age em chamadas de `createServerFn`, e a única que existe (o exemplo da seção 2) não é chamada.

## 4. Sessão, acesso e áreas

Ordem de leitura recomendada, todos em [src/lib/auth/](../../src/lib/auth/):

1. **[session.ts](../../src/lib/auth/session.ts)** — `getSessionProfile()` monta o `SessionProfile`: sessão do Supabase + `profiles` + `memberships` (papéis globais: `customer`, `shop_admin`, `platform_admin`, `account_manager`) + `shop_members` ativos (papéis na loja: `owner`, `partner`, `associate`, `employee`). Para a primeira loja da lista chama as RPCs `get_shop_access_context` (modo de sociedade) e `get_my_shop_permissions` e calcula `capabilities`. Se o esquema faltar, cai para cliente. Também tem `resolvePostAuthPath`, `hasProfessionalAccess`, `professionalRefusal`.
2. **[guards.ts](../../src/lib/auth/guards.ts)** — usados no `beforeLoad` das rotas: `requireSession` (sem sessão → `/auth?next=`), `requireRole` (`/platform`, `/demo`), `requireProfessional` (`/shop`, `/shop/pontos`). Na recusa, `refuse()` (linhas 28–32) leva o motivo para `/app?aviso=` **quando a área principal da conta (`homeForRole`) é o app do cliente**; senão manda para a área principal sem aviso (ex.: `shop_admin` antigo → `/shop`, `platform_admin` → `/platform`). Motivos aceitos: `sem-acesso`, `removido`, `aguardando`, `sem-plataforma` (`ACCESS_NOTICES` em [destination.ts](../../src/lib/auth/destination.ts)); as guardas hoje só emitem `sem-acesso`, `removido` e `sem-plataforma`.
3. **[capabilities.ts](../../src/lib/auth/capabilities.ts)** — `capabilitiesFor(actor, modo, podeAplicar, permissões)` → `ShopCapabilities` (capacidades com nome: `society`, `ownCatalog`, `ownBlocks`, `googleWholeShop`…). **A tela pergunta pela capacidade, nunca pelo nome do papel.** `EMPLOYEE_LOCKED_PERMISSIONS` trava permissões sem efeito para o Contratado.
4. **[shop-acting.ts](../../src/lib/auth/shop-acting.ts)** — "quem age no painel e com qual poder": `resolveShopActing` (`member`, `legacy-admin` ou `none`), `shopPowers` → `ShopPowers` (`writeMode`: `direct` só para o `shop_admin` antigo, `governed` passa pela governança, `none`), escolha da loja salva no aparelho (`arena:active-shop-actor`), entrada pelo host (`initialShopEntry`, `shopEntryForHost`).
5. **[destination.ts](../../src/lib/auth/destination.ts)** — para onde ir depois de entrar: link específico vence; senão a última área usada no aparelho (`arena:last-area:<usuário>`); senão a mais alta (plataforma → painel → app). Só caminhos e parâmetros conhecidos passam (sem redirecionamento aberto). Sem dependência de navegador nem banco (testável no Node).
6. **[areas.ts](../../src/lib/auth/areas.ts)** — lista "Minhas áreas" (plataforma, cada loja com o papel e a parte do dono, app do cliente), usada pelos três menus de conta via [useAreas.tsx](../../src/features/account/useAreas.tsx) (que grava a última área).

> **Atenção aos nomes:** `owner` e `partner` = **Dono** (`partner` é o antigo "Sócio" e usa o mesmo selo, "Dono · X%"); `associate` = **Parceiro**; `employee` = **Contratado**; `account_manager` = Gerente de conta. Não ligue `partner` a "Parceiro". Fontes: `ROLE_META` em [roles.tsx](../../src/features/shop/roles.tsx), comentário de `ROLE_RANK` em [shop-acting.ts](../../src/lib/auth/shop-acting.ts) (linha 28) e [papeis-e-permissoes.md](papeis-e-permissoes.md).

Regras de papéis, nomes na tela e governança da sociedade: [papeis-e-permissoes.md](papeis-e-permissoes.md) e [plano-ambientes.md](../plano-ambientes.md).

## 5. Os quatro "shells"

| Shell                                                          | Rota        | Abas / estrutura                                                                                                                                                                 |
| -------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ArenaApp](../../src/features/customer/ArenaApp.tsx)           | `/app`      | `dashboard`, `agenda`, `reservas`, `pontos`, `perfil`, `notifications`, `esportes` (estado `tab`, linha 255)                                                                     |
| [ShopShell](../../src/features/shop/ShopShell.tsx)             | `/shop`     | `agenda`, `servicos`, `equipe`, `horarios`, `configuracoes` (linha 394) → `agenda/AgendaTab`, `catalog/ServicesTab`, `catalog/TeamTab`, `hours/HoursTab`, `settings/SettingsHub` |
| [PlatformShell](../../src/features/platform/PlatformShell.tsx) | `/platform` | `overview`, `shops`, `permissions`, `insights`; no endereço `?aba=` com `visao-geral`, `barbearias`, `acessos` ou `relatorios` ([tabs.ts](../../src/features/platform/tabs.ts))  |
| [DemoWorkspace](../../src/features/demo/DemoWorkspace.tsx)     | `/demo`     | renderiza um dos três acima dentro de `DemoContext`, conforme a visão escolhida                                                                                                  |

Comum aos três shells (ArenaApp, ShopShell, PlatformShell): classe `arena-workspace` + `brandCornerClass(...)` + `brandFontScopeClass(...)` no contêiner; `BrandRootVariables` copia as variáveis `--brand-*` para `<html>` (janelas em portal); `TermsUpdateGate` pede aceite de termos novos (desligado na demonstração).

Não é comum: `useAvailabilitySignal` ([availability-signal.ts](../../src/lib/shop/availability-signal.ts)) fica no ArenaApp e na aba Agenda do ShopShell (os dois fora da demonstração) e na página pública `ShopLanding`; não está no PlatformShell. Ele recarrega horários e agenda quando chega um sinal de mudança da loja (seção 11).

## 6. Loja pelo endereço

Arquivo: [src/lib/shop/host.ts](../../src/lib/shop/host.ts).

| Endereço                                                                                                                   | Como é tratado                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Principal: `PLATFORM_BASE_HOST` (`VITE_PLATFORM_BASE_HOST`, padrão `beauty.contheiner.digital`), `localhost` e `127.0.0.1` | `isPlatformApexHost()` verdadeiro; `resolveShopFromCurrentHost()` devolve `null`; loja vem de `?shop=` ou `/b/<loja>` |
| Subdomínio `<loja>.beauty.contheiner.digital`                                                                              | RPC `resolve_shop_by_host(p_host)` → `kind: "subdomain"`                                                              |
| Domínio próprio (status `active`)                                                                                          | mesma RPC → `kind: "custom"`; `maybeRedirectToCanonical` leva o subdomínio ao domínio próprio                         |

- `shopPublicOrigin` e `platformSubdomainUrl` montam links públicos.
- Login no domínio da loja: o Google abre em pop-up no endereço principal e a sessão volta por mensagem ([return-origin.ts](../../src/lib/auth/return-origin.ts); `VITE_APP_ORIGIN` opcional).
- Domínio próprio no servidor: edge functions `shop-domain`/`domain-verify` + domain-manager do Traefik ([beauty-saas-infra.md](../beauty-saas-infra.md)).

## 7. Idiomas

Pasta [src/lib/i18n/](../../src/lib/i18n/). Idiomas: `pt-BR` (padrão), `pt-PT`, `en-US`, `en-GB`, `es` ([locale.ts](../../src/lib/i18n/locale.ts)).

- **Dicionários** em `messages/`: [pt-BR.ts](../../src/lib/i18n/messages/pt-BR.ts) é a fonte — `MessageKey = keyof typeof ptBR`. `pt-PT`, `en-US` e `es` são dicionários completos (`Record<MessageKey, string>`).
- **en-GB herda do en-US**: [en-GB.ts](../../src/lib/i18n/messages/en-GB.ts) faz `...enUS` e sobrescreve só ~90 chaves com grafia britânica (90 em 12/10/2026; ≈130 linhas, contra ≈4,2 mil dos outros). Chave nova: não precisa tocar no en-GB, salvo se a grafia britânica mudar.
- **Tradução**: [translate.ts](../../src/lib/i18n/translate.ts) — `translate(locale, key, vars)`; se faltar, cai para pt-BR; `{nome}` é trocado por `vars.nome`.
- **Uso**: na tela, `const { t, locale, intlLocale } = useI18n()` ([use-i18n.ts](../../src/lib/i18n/use-i18n.ts)); fora do React, `t()` e `getLocale()` de `@/lib/i18n`. Escolha salva em `localStorage` (`arena:locale`); no servidor sempre pt-BR; script `localeBootstrapScript` ajusta `<html lang>` antes da pintura.
- **Teste de paridade**: [translate.test.ts](../../src/lib/i18n/translate.test.ts) exige as **mesmas chaves** e os **mesmos `{marcadores}`** em todos os idiomas e nenhum texto vazio.
- **Páginas legais são traduzidas** (`/politica`, `/privacidade`, `/termos`, `/acordo-de-dados`), com aviso de tradução de cortesia fora do pt-BR (`legal.courtesyNotice` em [LegalPageShell.tsx](../../src/features/legal/LegalPageShell.tsx)). O idioma delas é escolhido por [legal-locale.ts](../../src/features/legal/legal-locale.ts) (seletor da página > `?lang=` > idioma salvo > idioma do navegador > pt-BR), sem mudar a escolha do resto do app.
- **Ficam em pt-BR de propósito:** modelos de WhatsApp, dados cadastrados pela loja, dados fictícios da demo e título e descrição da página no HTML do servidor (CONTINUIDADE, "idiomas", 26/09). Exceção desde 03/10: `/privacidade`, `/termos` e `/acordo-de-dados` já saem com título e descrição no idioma do `?lang=` ([legal-head.ts](../../src/features/legal/legal-head.ts); CONTINUIDADE, "ajustes finais de 03/10").

## 8. Tema e modos de canto

- **Tema claro/escuro** (por aparelho): [theme.ts](../../src/lib/theme.ts) (`light`, `dark`, `system`; chave `arena:theme`; `themeBootstrapScript` aplica a classe `dark` antes da pintura), [use-theme.ts](../../src/lib/use-theme.ts), [use-theme-preference.ts](../../src/lib/use-theme-preference.ts). Telas: `ThemeToggle` e [ThemeSettingsCard.tsx](../../src/features/shop/settings/ThemeSettingsCard.tsx).
- **Modos de canto** (por barbearia, coluna `barbershop_settings.corner_style`, migration `20260916580000_brand_corner_style.sql`, padrão `'soft'`): `square` (retos), `soft` (semi arredondados, padrão), `round` (arredondados).
  - Valores em `BRAND_CORNER_OPTIONS` ([branding.ts](../../src/lib/shop/branding.ts)): reto 0; semi `0.9rem`/`1.35rem`/`0.9rem`; arredondado `1.2rem`/`2rem`/`999px` (controle/painel/botão).
  - `brandVariables(...)` gera `--radius`, `--control-radius`, `--panel-radius`, `--button-radius` e as cores `--brand-*`; `brandCornerClass()` dá `brand-corners-<modo>`.
  - Regras de exceção em [styles.css](../../src/styles.css) (`rounded-xl/lg` → raio de controle, `rounded-2xl/3xl` → painel, `rounded-full` fica redondo). História do conserto: CONTINUIDADE, "Modos de borda", 17/09.
  - Editor: [BrandIdentityEditor.tsx](../../src/features/shop/BrandIdentityEditor.tsx).
- Cores de ação, cartões off-white e gradientes de fidelidade: regra em [mb-interface.md](../mb-interface.md).

## 9. PWA

- Manifesto único: [public/manifest.webmanifest](../../public/manifest.webmanifest) (ligado em `__root.tsx`; `manifest: false` no plugin para não duplicar).
- `VitePWA` em [vite.config.ts](../../vite.config.ts) (linha 27): `registerType: "autoUpdate"`, precache só de `icons/*` e do manifesto, **sem** `navigateFallback`; páginas em `NetworkFirst` (4 s), scripts/estilos em `StaleWhileRevalidate`.
- Registro: [src/lib/pwa.ts](../../src/lib/pwa.ts) — só em produção (desligado no `npm run dev`), procura versão nova a cada hora.
- Cópia do `sw.js`/`workbox-*` de `dist/` para `.output/public`: [scripts/copy-pwa.mjs](../../scripts/copy-pwa.mjs).
- Banner "Instalar o app": [pwa-install-banner.tsx](../../src/components/pwa-install-banner.tsx). Guia: [pwa.md](../pwa.md).

## 10. Modo demonstração

- Rota `/demo` (só `platform_admin`); visões `platform`, `owner`, `equal`, `minority`, `associate`, `employee`, `customer` ([chrome.ts](../../src/features/demo/chrome.ts)); `?view=partner` antigo vira `equal`.
- Estado fictício em memória: [model.ts](../../src/features/demo/model.ts) (`createDemoState`, `demoReducer`); equipe fictícia em [team.ts](../../src/features/demo/team.ts).
- Componentes perguntam `const demo = useDemo()` ([context.ts](../../src/features/demo/context.ts)) e, se houver, usam o estado fictício em vez do banco (30 componentes chamam `useDemo()` em 12/10/2026).
- **Trava de rede** [src/lib/demo-guard.ts](../../src/lib/demo-guard.ts): enquanto a demonstração está aberta e o endereço começa com `/demo`, nada vai ao banco (só `/auth/v1/` passa). Fica no `fetch` do [client.ts](../../src/integrations/supabase/client.ts) e em `guardedFetch` (chamadas diretas a `/functions/v1/…`). O [demo-guard.test.ts](../../src/lib/demo-guard.test.ts) **falha se surgir chamada direta a `/functions/v1` sem `guardedFetch`** e também se um arquivo de `src/features` que lê o banco não souber da demonstração (regra na seção 16).
- Exceção: com `?shop=<id>` ("Testar como…" da ficha da loja), o `DemoWorkspace` lê loja, ajustes, serviços, equipe e horários reais **antes** de armar a trava.
- Fotos da demo sem login real: `node scripts/foto.mjs "/demo?view=owner"` ([scripts/README.md](../../scripts/README.md)).

## 11. Uso do Supabase

- **RPC é o caminho principal**: o front chama ~84 funções distintas (`supabase.rpc("…")`), ex.: `get_available_slots`, `create_direct_appointment`, `request_shop_change`, `get_team_schedule`, `resolve_shop_by_host`. Mudanças protegidas do painel vão por `request_shop_change` (aplica ou pede aprovação dos donos).
- **Tabelas direto** (`.from("…")`, sob RLS): 22 tabelas; as mais usadas são `barbershop_settings`, `staff`, `profiles`, `services`, `barbershops`, `availability_blocks`, `staff_services`, `appointments`, `shop_members`.
- **RPC que pode não existir ainda**: [optional-rpc.ts](../../src/lib/auth/optional-rpc.ts) (`callOptionalRpc`) — o site às vezes vai ao ar antes da migration; a chamada falha em silêncio.
- **Arquivos (Storage)**: buckets `barbershop-logos` e `barbershop-fonts` ([branding-persist.ts](../../src/lib/shop/branding-persist.ts)) e `barbershop-services` (fotos de serviço e de profissional, [service-image.ts](../../src/lib/shop/service-image.ts)).
- **Realtime**: um só canal, `availability:<loja>` em `availability_signals` ([availability-signal.ts](../../src/lib/shop/availability-signal.ts)). Enquanto o canal não está conectado, o gancho consulta o último sinal a cada 15 s e tenta o Realtime de novo a cada 5 min.
  - Realtime **religado em 02/10/2026 (~18h)** (CONTINUIDADE, "regras de agendamento numa fonte só", linha 342; a entrada das 12h30 do mesmo dia, linha 400, ainda o dava como desligado).
  - Risco registrado: a configuração salva no Coolify ainda diz `restart: "no"`, então um "Redeploy" desliga o Realtime de novo e o app volta à consulta de 15 s. O realtime também está sem limite de CPU e memória. As duas coisas: a decidir pelo dono ([pendencias.md](pendencias.md), P-25).
- Tarefas agendadas do banco (cron na VPS, ex.: `process_slot_waits()` a cada minuto, [supabase/slot-waiting.cron](../../supabase/slot-waiting.cron)) e aplicação de migrations: [banco-e-implantacao.md](banco-e-implantacao.md).

## 12. Edge functions

Pasta [supabase/functions/](../../supabase/functions/) (Deno). Chamadas pelo app com `guardedFetch` em `${base}/functions/v1/<nome>` ou com `supabase.functions.invoke`.

| Função                     | Para quê                                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth-otp`                 | código por WhatsApp para entrar, confirmar número e reserva por link                                                                                  |
| `register-shop`            | cadastro do dono + barbearia com código pelo WhatsApp da plataforma (`request`, `verify`, `register`)                                                 |
| `invite-shop-admin`        | convidar dono/equipe ou gerente de conta (painel da loja e plataforma)                                                                                |
| `platform-whatsapp`        | estado/QR do WhatsApp da plataforma (só `platform_admin`)                                                                                             |
| `whatsapp-channel`         | WhatsApp de cada barbearia na Evolution API (`create`, `connect`, `status`, `logout`, `settings`)                                                     |
| `whatsapp-dispatch`        | envio da fila de WhatsApp, lembretes, séries recorrentes, limpezas; chama `email-dispatch` e `google-calendar-dispatch` (cron do host, a cada minuto) |
| `email-dispatch`           | envio da fila de e-mail por SMTP (`denomailer`)                                                                                                       |
| `google-connect`           | Google Agenda/Contatos: conectar, listar e escolher agenda, sincronizar, salvar contato, desconectar                                                  |
| `google-calendar-dispatch` | copia atendimentos para a Agenda Google                                                                                                               |
| `shop-domain`              | domínio próprio da loja (`set`, `clear`, verificar) + domain-manager                                                                                  |
| `domain-verify`            | compatibilidade: só verifica DNS (preferir `shop-domain`)                                                                                             |
| `_shared/`                 | `evolution.ts`, `google.ts`, `dns.ts` (DNS por HTTPS), `domain-manager.ts`                                                                            |

Publicação das funções (volume do Coolify + reinício do container): [banco-e-implantacao.md](banco-e-implantacao.md).

## 13. Integrações externas

| Integração               | Onde no código                                                                                                                                                                                                            | Situação                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| WhatsApp (Evolution API) | `_shared/evolution.ts`, `auth-otp`, `register-shop`, `whatsapp-channel`, `whatsapp-dispatch`; telas `WhatsAppChannelCard.tsx`, `PlatformWhatsAppCard.tsx`; modelos em [templates.ts](../../src/lib/whatsapp/templates.ts) | feito                                                                                                                                             |
| Login com Google         | `supabase.auth.signInWithOAuth` em [auth.tsx](../../src/routes/auth.tsx) (provedor do Auth)                                                                                                                               | feito (CONTINUIDADE, 02/10)                                                                                                                       |
| Google Agenda e Contatos | `_shared/google.ts`, `google-connect`, `google-calendar-dispatch`, rota `/auth/google-apps`, [GoogleConnectionCard.tsx](../../src/features/shop/settings/GoogleConnectionCard.tsx)                                        | feito; verificação do Google em [google-verificacao.md](../google-verificacao.md)                                                                 |
| E-mail (SMTP)            | `email-dispatch` (variáveis `SMTP_*`/`GOTRUE_SMTP_*`); modelos do Auth em `public/email/`                                                                                                                                 | feito; desde 02/10 é **SMTP da Hostinger**, Titan abandonado (CONTINUIDADE linha 400). [mb-operacao.md](../mb-operacao.md) ainda descreve o Titan |
| CEP (endereço)           | [postal-code.ts](../../src/lib/address/postal-code.ts) → ViaCEP no navegador; tela `CepAddressHelper.tsx`                                                                                                                 | feito (só Brasil)                                                                                                                                 |
| Dados de esportes        | [SportsBoard.tsx](../../src/features/customer/SportsBoard.tsx) usa placares fictícios (linha 26: "fora dela ainda não há fonte de jogos")                                                                                 | pendente — sem fonte real                                                                                                                         |
| Domínios próprios        | `shop-domain`, `_shared/domain-manager.ts`, `scripts/sync-*-domains.sh`                                                                                                                                                   | feito                                                                                                                                             |

Nomes de variáveis de ambiente das funções aparecem nos arquivos; **valores ficam só no Coolify** — nunca copiar.

## 14. Testes, lint e formatação

- **Testes do front**: `npm test` = `node --test` em 28 arquivos listados no [package.json](../../package.json): `theme`, `auth/session`, `auth/shop-acting`, `auth/capabilities`, `demo-guard`, `shop/appointments`, `shop/branding`, `shop/service-image`, `demo/model`, `insights/model`, `insights/occurrences`, `waiting/model`, `whatsapp/templates`, `auth/friendly-error`, `integrations/friendly-error`, `auth/signup-phone`, `register-owner/owner-signup`, `register-owner/timezones`, `i18n/translate`, `loyalty/program`, `marketing/shop-landing`, `address/postal-code`, `shop/agenda/model`, `shop/catalog/format`, `shop/hours/model`, `shop/settings/governance-diff`, `shop/shop-link`, `customer/shop-choice`.
  - Ficam **fora** da lista: `src/lib/shop/favicon.test.ts` e `src/lib/shop/slugify.test.ts`.
  - O Node roda `.ts` direto: arquivo testado importa com caminho relativo e extensão `.ts` (ex.: `./capabilities.ts`) e não pode depender de `@/…`, React ou do cliente Supabase. Regra nova testável → arquivo "puro" separado (como `agenda/model.ts`, `destination.ts`).
  - Adicionou um `*.test.ts`? Inclua-o no script `test` do `package.json`.
- **Testes do banco**: `supabase/tests/*.sql` (32), rodados **dentro de transação com rollback** e alguns em cadeia (o arquivo diz de qual depende). Houve incidente de teste rodado fora de transação em produção (CONTINUIDADE, 03/10 17:19). Como rodar: [banco-e-implantacao.md](banco-e-implantacao.md).
- **Tipos**: `npm run typecheck` (`tsc --noEmit`).
- **Lint**: `npm run lint` (`eslint .`, [eslint.config.js](../../eslint.config.js): typescript-eslint, react-hooks, react-refresh, prettier como regra; ignora `**/._*`, `.output`, `dist`…).
- **Formatação**: Prettier ([.prettierrc](../../.prettierrc): 100 colunas, aspas duplas, vírgula final). `npm run format` formata o projeto **inteiro** — prefira `npx prettier --write <arquivos>`.
- **Tudo de uma vez**: `scripts/verificar.sh` (tipos → testes → eslint/prettier nos alterados → montagem; `--sem-build`, `--tudo`). Fotos de tela: `node scripts/foto.mjs`. Ambos em [scripts/README.md](../../scripts/README.md) e [como-trabalhar.md](como-trabalhar.md).

## 15. Onde mexer para…

| Tarefa                                           | Arquivos                                                                                                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Texto novo ou corrigido na tela                  | `src/lib/i18n/messages/pt-BR.ts` + `pt-PT.ts`, `en-US.ts`, `es.ts` (e `en-GB.ts` só se a grafia mudar)                                                                  |
| Nova rota/página                                 | novo arquivo em `src/routes/` (o `routeTree.gen.ts` se regenera); se for `/<algo>` de 1º nível, incluir em `RESERVED` de `src/routes/$barberSlug.tsx`                   |
| Quem pode abrir uma área                         | `src/lib/auth/guards.ts`, `src/lib/auth/session.ts`                                                                                                                     |
| Para onde a pessoa vai depois de entrar          | `src/lib/auth/destination.ts` (+ `session.test.ts`)                                                                                                                     |
| Poder de um papel no painel                      | `src/lib/auth/capabilities.ts`, `src/lib/auth/shop-acting.ts` (+ testes); regra no banco: [papeis-e-permissoes.md](papeis-e-permissoes.md)                              |
| Menu "Minhas áreas"                              | `src/lib/auth/areas.ts`, `src/features/account/MyAreas.tsx`                                                                                                             |
| Tela de entrar/cadastrar cliente                 | `src/routes/auth.tsx`, `src/features/auth/entry/`                                                                                                                       |
| Cadastro de barbearia                            | `src/routes/cadastrar.tsx`, `src/features/register-owner/`, `supabase/functions/register-shop/`                                                                         |
| Agendamento do cliente                           | `src/features/customer/ArenaApp.tsx`, `src/features/customer/booking/`, `src/lib/shop/appointments.ts`                                                                  |
| Agenda da barbearia                              | `src/features/shop/agenda/` (regras em `model.ts`)                                                                                                                      |
| Serviços e equipe                                | `src/features/shop/catalog/` (`ServicesTab.tsx`, `TeamTab.tsx`, `ServiceForm.tsx`, `StaffForm.tsx`)                                                                     |
| Horário de funcionamento e bloqueios             | `src/features/shop/hours/`                                                                                                                                              |
| Ajustes da barbearia                             | `src/features/shop/settings/SettingsHub.tsx` e cartões da mesma pasta                                                                                                   |
| Marca, cores, fonte, cantos                      | `src/lib/shop/branding.ts`, `src/lib/shop/branding-persist.ts`, `src/features/shop/BrandIdentityEditor.tsx`, `src/styles.css`                                           |
| Página pública da loja                           | `src/features/marketing/ShopLanding.tsx`, `ShopLandingParts.tsx`, `shop-landing.ts`; editor em `src/features/shop/settings/LandingEditor.tsx`                           |
| Página inicial da plataforma                     | `src/features/marketing/PlatformLanding.tsx`                                                                                                                            |
| Clube de pontos                                  | `src/features/loyalty/` (regra em `program.ts`), `src/routes/shop_.pontos.tsx`, `src/routes/politica.tsx`                                                               |
| Lista de espera                                  | `src/features/waiting/`                                                                                                                                                 |
| Relatórios, pesquisas, privacidade               | `src/features/insights/`                                                                                                                                                |
| Painel da plataforma                             | `src/features/platform/` (`PlatformShell.tsx`, `ShopsPanel.tsx`, `ShopDetail.tsx`, `tabs.ts`)                                                                           |
| Demonstração (dados ou visões)                   | `src/features/demo/model.ts`, `team.ts`, `roles.ts`, `DemoWorkspace.tsx`                                                                                                |
| Mensagens de WhatsApp                            | `src/lib/whatsapp/templates.ts`, `src/features/shop/WhatsAppChipEditor.tsx`, `supabase/functions/whatsapp-dispatch/`                                                    |
| Google Agenda/Contatos                           | `src/features/shop/settings/GoogleConnectionCard.tsx`, `src/routes/auth_.google-apps.tsx`, `supabase/functions/google-connect/`, `supabase/functions/_shared/google.ts` |
| Domínio próprio / subdomínio                     | `src/lib/shop/host.ts`, `src/features/shop/settings/ShopDomainCard.tsx`, `supabase/functions/shop-domain/`                                                              |
| Componente visual comum (status, aviso, escolha) | `src/components/visual/`                                                                                                                                                |
| Tema claro/escuro                                | `src/lib/theme.ts`, `src/lib/use-theme.ts`, `src/features/shop/settings/ThemeSettingsCard.tsx`                                                                          |
| Textos legais e versões                          | `src/routes/{termos,privacidade,acordo-de-dados}.tsx`, `src/features/legal/versions.ts`                                                                                 |
| Ícones, manifesto, cache offline                 | `public/manifest.webmanifest`, `public/icons/`, `vite.config.ts`, `src/lib/pwa.ts`                                                                                      |
| Regra do banco (função, tabela, permissão)       | nova migration em `supabase/migrations/` + teste em `supabase/tests/` + `src/integrations/supabase/types.ts`                                                            |

## 16. Armadilhas

- **Arquivos `._*`**: o disco externo do Mac cria cópias `._nome` (ex.: `src/routes/._auth.tsx`). São lixo do macOS, ignorados pelo git (`.gitignore`) e pelo eslint; não abrir nem editar.
- **Gerados, não editar**: `src/routeTree.gen.ts`; `client.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts` trazem "automatically generated", mas o `client.ts` já foi ajustado à mão (trava da demo, chave de sessão fixa) — se mexer, preserve esses pontos.
- **Não duplicar plugins** no `vite.config.ts` (ver seção 2).
- **Chamada nova a edge function**: sempre `guardedFetch` ou `supabase.functions.invoke`, senão o `demo-guard.test.ts` falha.
- **Arquivo novo em `src/features` que cita `@/integrations/supabase/client`**: o teste "todo componente que lê o banco sabe da demonstração" ([demo-guard.test.ts](../../src/lib/demo-guard.test.ts), linhas 133–155) exige uma destas três coisas, senão o `npm test` falha:
  1. chamar `useDemo()` e usar dados fictícios na demonstração (o caminho normal);
  2. se ele nunca aparece na demonstração, constar em `OUTSIDE_DEMO`, com o motivo;
  3. se recebe da tela um sinal de demonstração (prop), constar em `DEMO_BY_PROP` com uma expressão que case com a condição real no código (comentários não contam).
  - As duas listas ficam no próprio `src/lib/demo-guard.test.ts`. O teste também falha se uma delas guardar arquivo que já não lê o banco: ao tirar o acesso ao banco, tire o arquivo da lista.
- **Texto cru na tela**: todo texto passa por `t("chave")`; o relatório do `foto.mjs` tem o campo `chavesCruas` para conferir isso.
- **Site × banco**: o site publica a cada envio ao `origin`, mas as migrations são aplicadas à mão no servidor — use `callOptionalRpc` para RPC nova e confira [pendencias.md](pendencias.md) para migrations ainda não aplicadas (em 12/10/2026, as 3 últimas; nota na seção 3).
- **Cópia local `src/features/customer/ArenaApp.tsx.backup`**: fora do git (o `.gitignore` ignora `*.backup`), mas aparece em `grep -r` e em contagens feitas assim; `git grep` e `rg` a pulam. Não editar e ignorar nas buscas. Apagar: a decidir com o dono.
- **Porta local**: o CONTINUIDADE ("Comece aqui") cita `8080`; nesta rodada o servidor local roda em `http://localhost:8090` (padrão do `foto.mjs`). Vale a porta passada a `npm run dev -- --port`.

## 17. Não confirmado e a decidir

- Gerenciador de pacotes oficial (bun × npm): os dois aparecem (`bun.lock`, `bunfig.toml`, `pwa.md` usa `bun run build`; scripts e verificações usam `npm`).
- Se `src/integrations/supabase/types.ts` é gerado por ferramenta ou mantido à mão.
- Como a Hostinger inicia o servidor Node (comando e versão do Node no servidor).
- Se o Realtime continua ligado hoje: não confirmado (último registro: religado em 02/10/2026, ~18h; um "Redeploy" no Coolify o desliga — seção 11).
- Arquivos de servidor do modelo Lovable: `src/lib/api/example.functions.ts`, `src/integrations/supabase/client.server.ts` e `auth-middleware.ts` não têm nenhum uso no código (`src/lib/config.server.ts` só é usado pelo exemplo). `auth-attacher.ts` só é registrado em `start.ts`, como `functionMiddleware`, e não tem efeito enquanto nenhuma `createServerFn` for chamada. Remover: a decidir.
