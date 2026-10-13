# Papéis, ambientes e permissões

Retrato do modelo **como está hoje (12/10/2026)**, depois das ondas 1, 2, 3 e 5 de 09/10/2026. Fontes principais: [plano-ambientes.md](../plano-ambientes.md), [plano-governanca-sociedade-gerente.md](../plano-governanca-sociedade-gerente.md), [CONTINUIDADE.md](../CONTINUIDADE.md) (seções de 17/09, 18/09, 22/09, 24/09, 25/09, 29/09 e 09/10), o código em [src/lib/auth/](../../src/lib/auth/) e as migrations citadas. Último commit conferido: `e7328ee` (09/10/2026).

Situações usadas: **feito**, **feito — falta aplicar no banco**, **pendente**, **a decidir**, **não confirmado**.

## Índice

1. [Glossário de papéis](#1-glossário-de-papéis)
2. [Ambientes](#2-ambientes)
3. [Como cada pessoa entra](#3-como-cada-pessoa-entra)
4. [O que cada papel vê e faz](#4-o-que-cada-papel-vê-e-faz)
5. [Governança da sociedade](#5-governança-da-sociedade)
6. [Jornada do Parceiro](#6-jornada-do-parceiro-do-convite-à-saída)
7. [Dinheiro: o que o sistema NÃO faz](#7-dinheiro-o-que-o-sistema-não-faz)
8. [Privacidade](#8-privacidade)
9. [Demonstração](#9-demonstração)
10. [Lacunas conhecidas](#10-lacunas-conhecidas)
11. [Onde mexer e como conferir](#11-onde-mexer-e-como-conferir)

## 1. Glossário de papéis

Existem **dois tipos de vínculo** no banco:

- `memberships.role` (enum `app_role`): `customer`, `shop_admin`, `platform_admin` (migration `20260914222150_foundation_multi_tenant.sql`, linha 5) e `account_manager` (acrescentado em `20260924170000_account_manager_and_expired_enums.sql`).
- `shop_members.role` (enum `shop_member_role`): `owner`, `partner`, `associate`, `employee` (`20260917120000_shop_team_governance.sql`, linha 4). Um vínculo por conta e por loja, ligado a um cartão de profissional (`staff_id`). Campo `active` marca quem saiu.

| Nome no código                  | Nome na tela (pt-BR)                 | O que é                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `customer` (memberships)        | Cliente                              | Cliente de uma loja. Uma conta pode ser cliente de várias lojas (uma linha por loja; pontos por loja desde `20260923160000_multi_shop_loyalty.sql`).                                                                                                                                                                                                                                                                                                                                                    |
| `owner` (shop_members)          | **Dono · X%** (`eq.role.ownerShare`) | Dono com participação (`ownership_percent` > 0 e ≤ 100). A soma dos donos ativos de uma loja precisa dar 100% e precisa haver ao menos um (`validate_shop_ownership`: no banco vale a versão de `20260924180000`, linha 852; a de `20261003220000_ajustes_finais.sql`, linha 36, que ignora loja apagada: **feito — falta aplicar no banco**). Dono único aparece "Dono · 100%".                                                                                                                        |
| fundador                        | Responsável principal                | Não é papel: `barbershops.founded_by_user_id` (`20260925140000_shop_society_founder_and_team.sql`). Não pode ser rebaixado nem desativado sem `transfer_shop_founder`.                                                                                                                                                                                                                                                                                                                                  |
| `partner` (shop_members)        | Igual a dono ("Dono · X%")           | Antigo "Sócio". Os ativos viraram `owner` com o mesmo % na migration `20260924180000` (bloco "Migra sócios"). O valor continua no enum; convites com `partner` viram `owner` (`apply_add_shop_member`, `invite-shop-admin/index.ts` linhas 67–68). No banco, toda checagem de dono usa `array['owner','partner']`. Na tela, `ROLE_META.partner` usa o mesmo selo de dono ([roles.tsx](../../src/features/shop/roles.tsx)); a matriz só mostra a coluna "Dono (sócio)" se alguém ainda tiver esse papel. |
| `associate` (shop_members)      | **Parceiro**                         | Profissional com agenda, catálogo, carteira e link próprios. Não decide pela loja.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `employee` (shop_members)       | **Contratado**                       | Profissional que vê a própria agenda e o próprio desempenho; não vê valores no padrão.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `account_manager` (memberships) | Gerente de conta                     | Equipe da plataforma, ligado a lojas em `account_manager_shops` (com `can_view_dashboard`). **Não tem tela própria:** entra pelo `/app` (`homeForRole`, [session.ts](../../src/lib/auth/session.ts) linhas 39–45). O vínculo é feito em Plataforma → Acessos (`AccountManagersPanel.tsx`).                                                                                                                                                                                                              |
| `platform_admin` (memberships)  | Plataforma (selo e "Minhas áreas")   | Admin global. No banco, `is_platform_admin()` libera quase tudo (`shop_permission_granted` devolve verdadeiro; o gatilho de governança deixa passar). Na tela, opera a `/platform` e a `/demo`. O `/shop` abre (`hasProfessionalAccess`, seção 2), mas sem vínculo de equipe (nem `shop_admin` antigo) mostra só "Você não está na equipe de nenhuma barbearia" (caso `none`, seção 3.4); **não entra no painel de uma loja sem vínculo de equipe**. O `/app` abre para qualquer conta logada.          |
| `shop_admin` (memberships)      | "Dono" (sem %)                       | Vínculo antigo de quem abria a loja. **Ainda é gravado** no cadastro de loja, junto do `owner` 100% (`register-shop/index.ts` linhas 588–601). Só vira o "como quem" do painel quando a conta não tem nenhum vínculo de equipe (caso `legacy-admin` em [shop-acting.ts](../../src/lib/auth/shop-acting.ts)): poderes de dono, gravando direto, sem sociedade, carteira nem saída.                                                                                                                       |

## 2. Ambientes

| Ambiente               | Rota e arquivo                                                                                                                                   | Quem abre                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App do cliente         | `/app` — [app.tsx](../../src/routes/app.tsx) (`requireSession`)                                                                                  | Qualquer conta logada. Abas: Início, Agendar, Reservas, Conta (e Esportes quando a loja liga `sports_enabled`; [ArenaApp.tsx](../../src/features/customer/ArenaApp.tsx) linhas 2539–2541).                   |
| Painel da barbearia    | `/shop` e `/shop/pontos` — [shop.tsx](../../src/routes/shop.tsx), [shop\_.pontos.tsx](../../src/routes/shop_.pontos.tsx) (`requireProfessional`) | Vínculo de equipe ativo, `shop_admin` antigo ou `platform_admin` (`hasProfessionalAccess`, session.ts linhas 197–203). Abas: Agenda, Serviços, Equipe, Horários, Ajustes (cada papel vê uma parte; seção 4). |
| Plataforma             | `/platform` — [platform.tsx](../../src/routes/platform.tsx) (`requireRole(["platform_admin"])`)                                                  | Só `platform_admin`. No domínio de uma loja, manda para o endereço principal.                                                                                                                                |
| Demonstração           | `/demo?view=…` — [demo.tsx](../../src/routes/demo.tsx) (`requireRole(["platform_admin"])`)                                                       | Só `platform_admin` (seção 9).                                                                                                                                                                               |
| Página pública da loja | `/` no domínio da loja ([index.tsx](../../src/routes/index.tsx)) e `/b/<slug>` ([b.$shopSlug.tsx](../../src/routes/b.$shopSlug.tsx))             | Qualquer pessoa. Com sessão aberta aparece a barra "Você está vendo como cliente · Abrir painel" (`SignedInBar`).                                                                                            |
| Link do profissional   | `/<slug-do-profissional>` no domínio da loja — [$barberSlug.tsx](../../src/routes/$barberSlug.tsx)                                               | Qualquer pessoa. Redireciona para `/app?shop=<loja>&barber=<slug>` (agenda daquele profissional). Também vale `/app?shop=…&barber=…` direto.                                                                 |

Recusas explicadas ([guards.ts](../../src/lib/auth/guards.ts), `refuse`, linhas 24–32): quem não pode abrir `/shop` vai a `/app?aviso=sem-acesso` ou `aviso=removido` (vínculo de equipe inativo); `/platform` e `/demo` sem permissão levam a `aviso=sem-plataforma`. O aviso só vai junto quando a área de entrada da conta (`homeForRole`) é o `/app`; senão a pessoa vai à própria área sem aviso (ex.: `shop_admin` antigo que abre `/platform` vai ao `/shop`). O texto de `aviso=aguardando` existe, mas o caso **ainda não é detectado** (precisa de banco; P-05).

## 3. Como cada pessoa entra

### 3.1 Destino depois do login

Regra em [destination.ts](../../src/lib/auth/destination.ts) (`decidePostAuthPath`, linhas 145–163; testes em `session.test.ts`). Situação: **feito** (onda 2, 09/10).

1. O destino pedido (`?next=`) é limpo por `sanitizeNext`: só caminhos internos conhecidos (`/app`, `/shop`, `/shop/pontos`, `/platform`, `/demo`, `/politica`, `/cadastrar`) e só parâmetros conhecidos e válidos (linhas 47–68). Endereço externo, `//` e barra invertida caem.
2. `/app` **com pedido de cliente** (loja, profissional, dia, hora, reserva ou `focus=whatsapp`) é seguido por qualquer papel. O "Agendar" da página pública não cai mais no painel.
3. `/shop` só se a conta tem painel; `/platform` e `/demo` só para `platform_admin`. Senão vale a área de entrada.
4. Sem destino ou com `/app` genérico: **última área usada no aparelho** (`arena:last-area:<user_id>` no `localStorage`, gravada por `useAreas.tsx`) se ainda for válida; senão a mais alta da conta: plataforma → painel → app.

O `/` e o app instalado seguem a mesma regra no endereço principal. No domínio de uma loja, pelo navegador, mostram a página pública com a barra "Abrir painel".

### 3.2 "Minhas áreas"

[MyAreas.tsx](../../src/features/account/MyAreas.tsx) com a lista em [areas.ts](../../src/lib/auth/areas.ts). Situação: **feito**.

- Aparece no menu da conta do painel, da plataforma e do app do cliente, **só para contas com 2 ou mais áreas**.
- Ordem: Plataforma (se `platform_admin`) → cada barbearia com o selo do papel ali ("Dono · 50%", "Parceiro", "Contratado") → "Agendar como cliente".
- A loja vai no endereço: `/shop?unidade=<id do vínculo>`. Trocar de área cobre a tela com "Abrindo {área}…".
- O app do cliente mostra o selo "Cliente" no cabeçalho para quem tem outro ambiente.

### 3.3 Qual loja o painel abre

`initialShopEntry` e `shopEntryForHost` em shop-acting.ts (linhas 351–388), nesta ordem:

1. Loja pedida em "Minhas áreas" (`?unidade=`).
2. Loja do domínio em que a pessoa está, se ela trabalha lá. Se não trabalha: aviso "Este endereço é de {host}. Você trabalha em {shop}" com o botão "Abrir endereço: {shop}" (chaves `shop.host.otherShop` e `shop.host.openRight`, [pt-BR.ts](../../src/lib/i18n/messages/pt-BR.ts) linhas 1872–1873; usadas em `ShopShell.tsx`, linhas 1872–1874).
3. Escolha salva no aparelho (`arena:active-shop-actor:<user_id>`; a chave antiga sem conta só como reserva).
4. Com 2 ou mais lojas e nada salvo: pergunta "Em qual barbearia você vai trabalhar agora?".
5. A única loja.

Ordem fixa das lojas: papel mais alto (dono/sócio → Parceiro → Contratado), depois o vínculo mais antigo (`shop_members.created_at`), depois o nome (`sortShopActors`). Ao trocar de loja, as permissões da anterior são descartadas e aparece "Abrindo {loja}…" até as novas chegarem.

### 3.4 "Como quem" no painel

`resolveShopActing` (shop-acting.ts linhas 54–77):

- `member`: tem vínculo de equipe ativo → poderes vêm das capacidades (seção 4).
- `legacy-admin`: só `shop_admin` antigo → poderes de dono, gravando direto.
- `none`: nenhum dos dois → **nenhum poder**. O painel nunca abre uma loja a partir de vínculo de cliente. O admin da plataforma sem loja vê "Você não está na equipe de nenhuma barbearia" com "Voltar à plataforma".

## 4. O que cada papel vê e faz

**Como a regra é montada:**

- No banco, a matriz `shop_role_permissions` guarda só o que difere do padrão; sem linha vale `shop_permission_default`. Catálogo de 11 permissões em `shop_permission_catalog()` (versão atual em `20260917170000_shop_permission_money_semantics.sql`, linhas 18–56). Gravar a matriz (`save_shop_permissions`, versão em `20260925140000_shop_society_founder_and_team.sql`, linha 754) exige `is_platform_admin()`, `is_account_manager_of()` ou `can_apply_protected_change()`; o dono não pode tirar de si "Alterar permissões". Ler a matriz inteira (`get_shop_permissions`, mesma migration, linha 718) é liberado também a qualquer dono/sócio, ao gerente da loja e a quem tem `manage_permissions`.
- Na tela, `capabilitiesFor` ([capabilities.ts](../../src/lib/auth/capabilities.ts), linhas 74–134) lê a matriz efetiva da própria conta (`get_my_shop_permissions`) e devolve capacidades com nome; `shopPowers` (shop-acting.ts linhas 173–243) traduz em abas e botões. As telas perguntam pela capacidade, nunca pelo nome do papel.
- Para o Contratado, `manage_services`, `manage_operations`, `manage_team` e `manage_permissions` ficam travadas (`EMPLOYEE_LOCKED_PERMISSIONS`), com o aviso "Contratado não muda a loja. Para mais autonomia, use Parceiro." A tela ignora essas 4 para o Contratado (`permissionLockedForRole`), mas o banco ainda aceita gravá-las (P-13).

### 4.1 Padrões da matriz (banco)

| Permissão                                      | Dono (`owner`/`partner`) | Parceiro | Contratado |
| ---------------------------------------------- | :----------------------: | :------: | :--------: |
| `view_agenda_all` Visão geral da agenda        |            ✓             |    —     |     —      |
| `view_money` Valores do dia e recebimentos     |            ✓             |    ✓     |     —      |
| `view_financial_all` Relatórios da loja        |            ✓             |    —     |     —      |
| `view_reports_global` Relatórios da unidade    |            ✓             |    —     |     —      |
| `view_reports_anonymized` Indicadores anônimos |            —             |    ✓     |     —      |
| `view_own_score` Indicadores próprios          |            ✓             |    ✓     |     ✓      |
| `manage_services` Catálogo geral               |            ✓             |    —     | — (trava)  |
| `manage_own_services` Próprios serviços        |            ✓             |    ✓     |     —      |
| `manage_operations` Funcionamento              |            ✓             |    —     | — (trava)  |
| `manage_team` Equipe                           |            ✓             |    —     | — (trava)  |
| `manage_permissions` Alterar permissões        |            ✓             |    —     | — (trava)  |

### 4.2 Capacidades e onde são garantidas

| O que                                                   | Dono · X%                                   | Parceiro                                              | Contratado                                                                           | Garantia                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Abas do painel                                          | Agenda, Serviços, Equipe, Horários, Ajustes | Agenda, Serviços ("Meus serviços"), Horários, Ajustes | Agenda, Ajustes (Serviços e Horários aparecem se o dono liberar "Serviços: os seus") | Tela (teste "as abas de cada papel", `capabilities.test.ts`)                                                                                                                                                                                                                              |
| Própria agenda completa                                 | ✓                                           | ✓                                                     | ✓                                                                                    | **Banco** (`get_team_schedule`, `is_own`)                                                                                                                                                                                                                                                 |
| Agenda da equipe com cliente, serviço e valor           | ✓                                           | só "ocupado"                                          | só "ocupado"                                                                         | **Banco** (`get_team_schedule`, `visibility = 'busy'`, migration `20261003150000_correcoes_auditoria.sql` linha 959)                                                                                                                                                                      |
| Mudar catálogo da loja, funcionamento, equipe           | via governança (seção 5)                    | —                                                     | —                                                                                    | **Banco** (RLS + `guard_protected_shop_change`)                                                                                                                                                                                                                                           |
| Identidade visual (logo, cores, cantos)                 | via governança                              | —                                                     | —                                                                                    | **Banco** (desde `20260924180000`, bloco "Branding só sociedade")                                                                                                                                                                                                                         |
| Catálogo próprio por cima do da loja (`staff_services`) | —                                           | ✓                                                     | só se o dono liberar "Serviços: os seus"                                             | **Banco** (política "Manage professional services" + `20260929170000_guard_own_professional_rows.sql`)                                                                                                                                                                                    |
| Sugerir preço/duração aos outros parceiros              | —                                           | ✓                                                     | —                                                                                    | **Banco** (`suggest_partner_catalog` só aceita `associate`)                                                                                                                                                                                                                               |
| Próprios bloqueios (folga, almoço)                      | via governança                              | ✓                                                     | só com "Serviços: os seus"                                                           | **Banco** (política "Professionals manage own blocks" exige `manage_own_services`)                                                                                                                                                                                                        |
| Próprio perfil (nome, "sobre") e link                   | ✓                                           | ✓                                                     | ✓                                                                                    | **Banco** (`guard_staff_profile_update`, versão em `20260922140000_slug_redirects_and_departure.sql` linha 1167: impede mudar loja ou se desativar; o slug só muda junto com o nome no mesmo UPDATE, brecha do banco que a tela não oferece; não vale para quem tem `can_view_full_shop`) |
| Própria foto                                            | ✓                                           | ✓                                                     | travada (sem serviços próprios)                                                      | **Banco** recusa (políticas de envio e troca do bucket `barbershop-services` em `20260924140000_service_description_staff_media.sql`, linhas 162–216); tela trava (`ownPhoto` em capabilities.ts)                                                                                         |
| Carteira própria ("Meu link e carteira")                | — (vê a loja toda)                          | ✓                                                     | —                                                                                    | **Só na tela** (ver seção 8)                                                                                                                                                                                                                                                              |
| Clientes e indicadores da loja inteira                  | ✓                                           | anonimizados                                          | só os próprios                                                                       | **Banco** (`get_professional_insights`, `get_business_insights` com `view_financial_all`)                                                                                                                                                                                                 |
| Sair da barbearia                                       | ✓ (levar carteira pede liberação)           | ✓ levando ou abrindo mão                              | ✓ só abrindo mão                                                                     | Levar carteira: recusada também no banco para o Contratado desde a migration `20261013120000` (falta aplicar na VPS; seção 10)                                                                                                                                                            |
| Google Agenda                                           | loja inteira                                | só a própria agenda                                   | só a própria agenda                                                                  | **Banco**: a cópia da loja inteira (`push_scope = 'shop'`) só vale para dono/sócio (`20260929130000_google_calendar_push.sql` linha 63)                                                                                                                                                   |
| Bloqueios de colegas                                    | com nome e motivo                           | "Colega indisponível"                                 | "Colega indisponível"                                                                | **Só na tela** (nome e motivo chegam ao aparelho)                                                                                                                                                                                                                                         |

O selo de papel no topo do painel ([RoleAccessButton.tsx](../../src/features/shop/RoleAccessButton.tsx)) é tocável e abre "Seu acesso" resumido: papel, modo da sociedade, se as mudanças "valem na hora" ou "esperam o OK de Ana", lista ✓/— e atalho para Ajustes → Equipe e sociedade.

## 5. Governança da sociedade

Versões atuais das funções:

- `shop_governance_mode`: `20260924180000_governance_notices_partners_account_manager.sql`, linha 1210 (mesma lógica da original de `20260917120000`).
- `can_apply_protected_change`: `20260917120000_shop_team_governance.sql`, linha 117 (versão única).
- `request_shop_change`: `20261003150000_correcoes_auditoria.sql`, linha 1223.
- `decide_shop_change`: `20260924180000`, linha 986.

### 5.1 Modos (`shop_governance_mode`)

| Modo no banco | Selo na tela        | Quando                        | Quem aplica sozinho (`can_apply_protected_change`) |
| ------------- | ------------------- | ----------------------------- | -------------------------------------------------- |
| `single`      | Decide sozinho      | 1 dono ativo                  | O dono                                             |
| `equal`       | Decisão em conjunto | 2+ donos, todos com o mesmo % | Ninguém: tudo vira pedido                          |
| `majority`    | Maior parte decide  | 2+ donos com % diferentes     | Só quem tem a maior parte **e** mais de 50%        |

`platform_admin` sempre aplica. O tipo escolhido no cadastro fica em `barbershops.society_intent` (`single`, `majority`, `equal`, `minority`), mas o modo efetivo é calculado pelos % ativos.

### 5.2 Pedidos e aprovações

- Toda mudança protegida passa por `request_shop_change(p_shop_id, p_kind, p_payload, …)`. Se a pessoa pode aplicar, aplica na hora e grava um registro `source = 'majority_log'`. Senão, cria `shop_change_requests` com `status = 'pending'` e `source = 'society'`.
- Votos em `shop_change_approvals`. `decide_shop_change`: quem pediu não aprova o próprio pedido; **qualquer recusa encerra** o pedido; em `equal` precisa do OK de todos os outros donos; em `majority` só o majoritário aprova.
- Convites de pessoas em sociedade sem poder de aplicar viram pedido `member.add` (`shop_add_member`, `20260925140000`).
- Telas: decisões em Ajustes → Equipe e sociedade (`TeamGovernance.tsx`); antes de salvar, os botões mostram **"Vai para aprovação de {nomes}"** (`ApprovalNote`, chave `approval.before`).

### 5.3 Gerente de conta

- `request_shop_change` vindo do gerente cria pedido `source = 'account_manager'` com prazo de 30 min por padrão (`expires_at`); sem resposta vira `expired` (`expire_shop_change_requests`). Um OK basta: em `equal`, de qualquer co-dono; em `single`/`majority`, de quem pode aplicar (o dono único ou o majoritário acima de 50%) (`decide_shop_change`, `20260924180000`, linhas 1022–1030).
- `guard_protected_shop_change` recusa gravação direta do gerente ("Gerente de conta precisa de aprovação do dono") em `services`, `staff`, `staff_services`, `business_hours`, `availability_blocks` e `barbershop_settings` (gatilhos em `20260917120000`, linhas 204–215; versão atual da função em `20260929170000_guard_own_professional_rows.sql`, linha 5).
- **Equipe e matriz: conflito entre premissas (a decidir).** O código segue a premissa 7 do [plano de governança](../plano-governanca-sociedade-gerente.md) (25/09: admin global e gerente da unidade "mantêm acesso total (override)" para convidar equipe, alterar papéis e editar a matriz), que conflita com a premissa 5 do mesmo plano (gerente "nunca aplica direto").
  - O gerente aplica direto, sem pedido, em `20260925140000_shop_society_founder_and_team.sql`: `shop_add_member` (linha 317), `shop_update_member` (linha 388), `platform_add_shop_member` (linha 577), `save_shop_permissions` (linha 766) e a política RLS "Owners manage team" de `shop_members` (linha 827).
  - A Edge `invite-shop-admin` ([index.ts](../../supabase/functions/invite-shop-admin/index.ts), linhas 234–236) manda o gerente para `platform_add_shop_member`, que aplica direto.
  - `can_manage_shop_society` (mesma migration, linha 42) também devolve verdadeiro para o gerente, mas nenhuma função, tela ou Edge a chama (conferido em 12/10).
  - **A decidir:** qual premissa vale.

## 6. Jornada do Parceiro: do convite à saída

Situação geral: **feito** (17/09, 18/09, 22/09, 24/09, 09/10 no CONTINUIDADE).

1. **Convite** — dono (ou admin) usa a Edge `invite-shop-admin`. Conta nova recebe **senha temporária mostrada na tela**; nenhum e-mail ou link é enviado; quem já tem conta usa a senha de sempre. Em sociedade sem poder de aplicar, o convite vira pedido. Link de convite, troca obrigatória de senha e boas-vindas: **pendente** (onda 4; P-15 a P-17).
2. **Catálogo próprio** — aba "Meus serviços": linhas em `staff_services` (preço, duração, nome, "Você atende / Você não atende") por cima do catálogo da loja, sem pedir aprovação. Pode sugerir o preço aos outros parceiros (`partner_catalog_suggestions`); cada um aceita ou mantém o seu.
3. **Preço gravado no agendamento** — o gatilho `appointments_enforce_service_terms` grava `appointments.booked_price_cents` com o preço do profissional (`staff_service_terms`) ao criar ou trocar serviço/profissional (versão mais nova no repositório: `20261005120000_tempo_preparo.sql`, linha 189: **feito — falta aplicar no banco**; em produção vale a de `20261003150000_correcoes_auditoria.sql`, linha 1126; a gravação de `booked_price_cents` é a mesma nas duas). Mudar o preço depois não altera atendimentos já marcados.
4. **Carteira** — `get_partner_wallet` (`20260917180000_partner_tools.sql`): soma dos próprios atendimentos **concluídos**, contagem e lista. É derivada, sem tabela própria.
5. **Clientes** — `get_partner_clients` (versão em `20260917190000_client_directory.sql`): nome, visitas, total gasto e última visita, só dos próprios atendimentos concluídos. Para quem tem visão geral da agenda (`can_view_full_shop`: admin da plataforma, `shop_admin` ou `view_agenda_all`, que o dono tem no padrão), devolve os clientes da loja inteira (linhas 17 e 36).
6. **Ritmo** — `get_partner_rhythm` e `get_customer_rhythm`: mediana de dias entre visitas, dia e hora preferidos; "ainda não há dados suficientes" com menos de 3 retornos.
7. **Link pessoal** — `/<slug-do-profissional>` no domínio da loja ou `/app?shop=…&barber=…`. O slug (`staff.booking_slug`) nasce do nome; depois, mudar só o nome não muda o slug (`trg_staff_auto_booking_slug`, versão em `20260923180000_booking_slug_manual_and_externa.sql`, linha 7). Na tela, só dono/sócio editam o endereço (`slugLocked={!powers.society}` em `ShopShell.tsx`); Parceiro e Contratado gravam só nome, "sobre" e foto (`saveOwnProfile`). No banco há uma brecha: `guard_staff_profile_update` aceita slug novo se o nome mudar no mesmo UPDATE (seção 10). Cartão "Meu perfil e link" em Ajustes → Pessoas.
8. **Saída** — `request_shop_departure` (versão em `20261003150000`, linha 317) e `complete_shop_departure` (versão atual em `20261003150000_correcoes_auditoria.sql`, linha 132). Só o próprio profissional, quem liberou a carteira, o admin da plataforma ou o servidor concluem a saída.
   - **Levar a carteira (`take`)**: exige já ser da equipe ativa da loja de destino. Os clientes com atendimento concluído com ele mudam o vínculo de cliente para a loja nova, com os pontos somados (resgates pendentes na loja de origem são devolvidos antes). O link antigo fica `locked` em `staff_slug_redirects` e continua levando ao profissional na loja nova. Dono que leva a carteira precisa da liberação de outro dono (`approve_portfolio_release`); dono único não pode levar.
   - **Abrir mão (`forfeit`)**: os redirecionamentos não travados são apagados e o slug fica livre para a loja reusar.
   - Nos dois casos o vínculo de equipe e o cartão de profissional ficam inativos.
   - Telas: `ShopDepartureCard.tsx` e `SlugRedirectsCard.tsx` em Ajustes.

## 7. Dinheiro: o que o sistema NÃO faz

- **Não existe pagamento, cobrança, comissão, repasse nem divisão de valores** entre loja, donos e parceiros. Nenhuma integração de pagamento ativa (só um comentário com `STRIPE_SECRET_KEY` em `src/lib/config.server.ts`, linha 24).
- "Carteira" e "valores" são **somas de preços registrados** nos atendimentos concluídos (`booked_price_cents`), apenas informativas.
- `ownership_percent` só decide quem governa a loja; não divide dinheiro.
- Reembolso e taxa de cancelamento são só ideia: [reembolso-futuro.md](../reembolso-futuro.md). Não inventar regras financeiras.

## 8. Privacidade

| Dado                                               | Quem vê                                                                                   | Garantia                                                                                                                                                          |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atendimentos dos colegas (cliente, serviço, valor) | Só quem tem `view_agenda_all` (dono no padrão)                                            | **Banco** (`get_team_schedule`)                                                                                                                                   |
| Matriz completa de permissões                      | Admin da plataforma, gerente da loja, qualquer dono/sócio e quem tem `manage_permissions` | **Banco** (`get_shop_permissions`, `20260925140000` linha 718; os demais leem só as próprias por `get_my_shop_permissions`)                                       |
| Relatórios financeiros da loja                     | `view_financial_all` (dono no padrão)                                                     | **Banco** (`get_business_insights`)                                                                                                                               |
| Valores do Contratado (carteira, total gasto)      | Contratado não vê no padrão (`view_money` desligado)                                      | **Só na tela.** `get_partner_wallet` e `get_partner_clients` devolvem valores a qualquer membro da equipe sobre os próprios atendimentos, sem checar `view_money` |
| Nome e motivo dos bloqueios dos colegas            | Escondidos para Parceiro e Contratado                                                     | **Só na tela** (chegam ao aparelho)                                                                                                                               |
| Dados da loja na demonstração                      | Nenhum dado real                                                                          | Trava de rede (seção 9)                                                                                                                                           |

## 9. Demonstração

- Endereço: `/demo?view=<visão>`, só para `platform_admin` ([demo.tsx](../../src/routes/demo.tsx)). O antigo `?view=partner` abre `equal`. Aberto pela ficha da loja com "Testar como…" (`/demo?volta=ficha`), volta à ficha ao sair.

| Visão       | Quem é                                                    |
| ----------- | --------------------------------------------------------- |
| `platform`  | Admin da plataforma ("Plataforma · demonstração")         |
| `owner`     | Dono · 100% (decide sozinho)                              |
| `equal`     | Dono · 50% com a sócia fictícia Ana (decisão em conjunto) |
| `minority`  | Dono · 30% (maior parte decide)                           |
| `associate` | Parceiro "Rafa Lima"                                      |
| `employee`  | Contratado "Léo Souza"                                    |
| `customer`  | Cliente                                                   |

- Mesmas regras de papel do real (`demoCapabilities` em shop-acting.ts): Parceiro e Contratado não mudam a loja. Diferença: na demonstração as mudanças dos donos valem na hora, e o Salvar avisa "No real, vai para aprovação de Ana".
- Dados fictícios: aparência e catálogo da loja escolhida são copiados com ids fictícios ([team.ts](../../src/features/demo/team.ts), `model.ts`).
- **Trava de rede** ([demo-guard.ts](../../src/lib/demo-guard.ts)): com a demonstração aberta e o endereço em `/demo`, toda chamada ao banco (tabelas, RPC, arquivos, funções) é recusada no `fetch` do cliente Supabase e em `guardedFetch`; só `/auth/v1/` passa. Teste em `src/lib/demo-guard.test.ts`.
- Foto de uma visão: `node scripts/foto.mjs "/demo?view=associate"` (ver [scripts/README.md](../../scripts/README.md) e [como-trabalhar.md](como-trabalhar.md)). A demonstração **não cobre** várias lojas nem vários papéis na mesma conta: para isso só contas reais de teste.

## 10. Lacunas conhecidas

Lista priorizada e única em [pendencias.md](pendencias.md) (coluna "Id"). As que tocam papéis, conferidas no código em 12/10/2026. Id "—" = ainda não está em pendencias.md.

| Id         | Lacuna                                                                                                                                                                    | Situação                                                                                                              | Fonte                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| P-01       | `request_shop_departure` aceita `p_mode = 'take'` de um Contratado que chame a RPC direto                                                                                 | feito — falta aplicar no banco (13/10, `20261013120000`)                                                              | CONTINUIDADE 09/10 onda 3; `20261003150000` linha 317 (a checagem do `take` na linha 382 só barra `owner`/`partner`)                      |
| P-02       | Bloqueio próprio do Contratado depende de "Serviços: os seus"                                                                                                             | pendente (banco)                                                                                                      | CONTINUIDADE 09/10 onda 3                                                                                                                 |
| P-03       | Foto do próprio perfil para o Contratado                                                                                                                                  | pendente (banco)                                                                                                      | Políticas do bucket `barbershop-services`, `20260924140000_service_description_staff_media.sql` linhas 162–216; CONTINUIDADE 09/10 onda 3 |
| P-04       | Nome e motivo dos bloqueios de colegas chegam ao aparelho                                                                                                                 | feito — falta aplicar no banco (13/10, `20261013120000`)                                                              | CONTINUIDADE 09/10 onda 3                                                                                                                 |
| P-05       | `aviso=aguardando` (convite esperando aprovação) não detectado                                                                                                            | pendente (banco)                                                                                                      | CONTINUIDADE 09/10 onda 2                                                                                                                 |
| P-06       | "Adicionar dono" em loja nova: o banco só aceita dono novo cedendo parte de outro dono                                                                                    | pendente (banco)                                                                                                      | CONTINUIDADE 09/10 onda 5                                                                                                                 |
| P-07       | Contagem de "Administradores" na lista de atenção e no painel geral da plataforma (PLAT-01)                                                                               | feito — falta aplicar no banco (13/10, `20261013120000`)                                                              | CONTINUIDADE 09/10 ondas 1 e 5                                                                                                            |
| P-13       | `save_shop_permissions` aceita gravar as 4 permissões travadas do Contratado (a tela as ignora)                                                                           | pendente (opcional)                                                                                                   | `20260925140000` linha 754                                                                                                                |
| P-15 a 17  | Convite com link, troca de senha obrigatória, boas-vindas (onda 4)                                                                                                        | P-16 feito — falta publicar a função `invite-shop-admin` (13/10); P-15 e P-17 pendentes                               | plano-ambientes.md, status no topo e seção 4 (onda 4)                                                                                     |
| P-19       | Gerente de conta sem tela própria; convite dele ainda visível na plataforma (a decisão 6 aprovou esconder o convite até existir tela)                                     | pendente (onda 4; decisão 6 aprovada em 09/10)                                                                        | plano-ambientes.md, decisão 6 e onda 4 item 5; `PlatformShell.tsx` linhas 571–574 e `ShopDetail.tsx` linha 245                            |
| P-40, P-41 | Teste manual com contas reais num subdomínio de loja                                                                                                                      | pendente                                                                                                              | plano-ambientes.md, status no topo                                                                                                        |
| —          | Carteira e clientes devolvem valores sem checar `view_money`                                                                                                              | pendente (banco); não está em pendencias.md (conferido em 12/10); incluir na integração                               | Leitura de `get_partner_wallet` (`20260917180000`, linha 50) e `get_partner_clients` (`20260917190000`, linha 11)                         |
| —          | Gerente aplica direto ao adicionar ou alterar membros e ao gravar a matriz (`shop_add_member`, `shop_update_member`, `platform_add_shop_member`, `save_shop_permissions`) | a decidir (premissa 5 × premissa 7); não está em pendencias.md (conferido em 12/10); incluir na integração            | Seção 5.3                                                                                                                                 |
| —          | Parceiro e Contratado conseguem trocar o próprio slug pela API se mudarem o nome no mesmo UPDATE                                                                          | pendente (banco; leitura do código, sem teste); não está em pendencias.md (conferido em 12/10); incluir na integração | `guard_staff_profile_update`, `20260922140000` linha 1167                                                                                 |
| —          | Em `majority` com 3+ donos e ninguém acima de 50%, ninguém aplica nem aprova                                                                                              | não confirmado (leitura do código, sem teste); não está em pendencias.md (conferido em 12/10)                         | `can_apply_protected_change` e `decide_shop_change`                                                                                       |

## 11. Onde mexer e como conferir

Antes de editar: regras da vez e verificação em [como-trabalhar.md](como-trabalhar.md); banco e migrations em [banco-e-implantacao.md](banco-e-implantacao.md).

| Para mudar…                                   | Arquivo                                                                                                                                      | Teste que precisa continuar passando                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| O que um papel vê ou faz na tela              | [capabilities.ts](../../src/lib/auth/capabilities.ts) e `shopPowers` em [shop-acting.ts](../../src/lib/auth/shop-acting.ts)                  | `src/lib/auth/capabilities.test.ts`, `src/lib/auth/shop-acting.test.ts`                                   |
| Destino depois do login e parâmetros aceitos  | [destination.ts](../../src/lib/auth/destination.ts)                                                                                          | `src/lib/auth/session.test.ts` (matriz papel × destino)                                                   |
| "Minhas áreas"                                | [areas.ts](../../src/lib/auth/areas.ts), [MyAreas.tsx](../../src/features/account/MyAreas.tsx)                                               | `src/lib/auth/session.test.ts`                                                                            |
| Nome, ícone e cor do selo de papel            | [roles.tsx](../../src/features/shop/roles.tsx) e o dicionário em [src/lib/i18n/messages/](../../src/lib/i18n/messages/) (chaves `eq.role.*`) | `npm test` (inclui `translate.test.ts`)                                                                   |
| Visões da demonstração                        | [roles.ts](../../src/features/demo/roles.ts), [team.ts](../../src/features/demo/team.ts), [demo.tsx](../../src/routes/demo.tsx)              | `src/features/demo/model.test.ts`, `src/lib/demo-guard.test.ts`                                           |
| Padrão da matriz ou regra no banco            | migration nova em `supabase/migrations/` (nunca editar uma já aplicada)                                                                      | `supabase/tests/shop_role_permissions.sql`, `shop_team_governance.sql`, `guard_own_professional_rows.sql` |
| Carteira, clientes, saída e redirecionamentos | migration nova                                                                                                                               | `supabase/tests/partner_tools.sql`, `slug_redirects_departure.sql`                                        |

**Testes SQL:** os arquivos de `supabase/tests/` **não rodam** no `npm test` (o `package.json` lista só arquivos `.ts`) nem no `scripts/verificar.sh` (que não chama `psql`). Rodar só em ensaio, dentro de `BEGIN … ROLLBACK`, como em [banco-e-implantacao.md](banco-e-implantacao.md) (seção 5, passo "Ensaio", e [seção 6](banco-e-implantacao.md#6-testes-sql)). **Nunca** no banco de produção fora de transação: foi o que causou o incidente de 03/10/2026 (CONTINUIDADE, "Incidente — teste rodado fora de transação no banco de produção (03/10, 17:19 PT)").

Regras ao mexer em papéis:

- Tela pergunta por **capacidade com nome**, nunca por `role === "associate"` (decisão da onda 3).
- Toda regra que protege dado ou dinheiro precisa estar **no banco**; a tela só esconde. Ao criar uma, atualize a coluna "Garantia" das seções 4 e 8.
- Mudou um padrão da matriz no banco? Mude também o padrão em `capabilitiesFor` (o argumento `fallback`) para tela e banco não divergirem. Hoje já divergem num ponto: o banco dá `manage_own_services` ao dono, a tela só ao Parceiro (sem efeito prático, porque o dono já gere o catálogo inteiro).
- Conferir a tela de cada papel: `node scripts/foto.mjs "/demo?view=owner"` (repita com `equal`, `minority`, `associate`, `employee`, `customer`, `platform`) e `scripts/verificar.sh` antes de enviar (ele não cobre os testes SQL; ver acima).
