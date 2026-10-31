# MB — Operação (Coolify, e-mail, Google)

Atualizado em **13/10/2026** (Mapa rápido, Contas e IDs, e-mail, domínio da API e checklists) e em **15/10/2026** (certificado por loja automático). O texto original é de 23/09/2026; as seções 5, 5b, 5c e 5d mantêm as datas delas.  
Passo a passo operacional do Barba & Cabelo: e-mail do sistema (SMTP da Hostinger), Auth no Coolify, login Google e domínios. Linguagem curta, uma ação por etapa — no mesmo espírito do `/mb` (próximo passo claro, sem misturar assuntos).

**Fonte do estado atual:** [guia/banco-e-implantacao.md](guia/banco-e-implantacao.md) (seções 1, 10 e 11). Se este documento divergir dele, vale o guia.

**Não versionar senhas, tokens nem chaves.** Preencher só no Coolify / gerenciador de senhas.

---

## Mapa rápido

| O quê                         | Onde fica                                                                     | Status (13/10/2026)                                                                                                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App                           | Hostinger → `beauty.contheiner.digital`                                       | Em produção; usa `VITE_SUPABASE_*` gravadas na compilação                                                                                                                         |
| Supabase (Auth, DB)           | Coolify → `barba-cabelo` / `supabase-barba-cabelo`                            | Em uso                                                                                                                                                                            |
| API Supabase (oficial)        | `https://supabase-barbearia.proh.media`                                       | Em uso (`API_EXTERNAL_URL`); certificado válido                                                                                                                                   |
| API Supabase (mesmo servidor) | `https://supabasebeauty.contheiner.digital`                                   | Em uso: é o endereço que o site publicado usa e o retorno do login Google; certificado válido                                                                                     |
| `supabase-teste.proh.media`   | Outro serviço (Flow TEST)                                                     | **Não é mais deste projeto** desde 29/09/2026. Não usar                                                                                                                           |
| E-mail do sistema (SMTP)      | Hostinger, remetente `noreply@contheiner.digital`                             | Em uso desde 02/10/2026 (Auth e funções); Titan abandonado                                                                                                                        |
| Login Google (botão)          | OAuth no GoTrue (`GOTRUE_EXTERNAL_GOOGLE_*`)                                  | Restaurado em 30/09/2026                                                                                                                                                          |
| Google Agenda + Contatos      | Edge `google-connect` + card em Ajustes; cópia por `google-calendar-dispatch` | Ligado; verificação do Google pendente ([google-verificacao.md](google-verificacao.md))                                                                                           |
| WhatsApp (Evolution)          | Coolify `evolution-api` + funções no Supabase                                 | Ligado (por loja; ver seção 5)                                                                                                                                                    |
| Certificado por loja          | `/data/coolify/proxy/dynamic/beauty-shop-certs.yaml`                          | Automático desde 15/10/2026: timer `barba-cert-lojas` na VPS, a cada 10 min (seção 6 de [implantacao-certificado-loja-2026-10-13.md](implantacao-certificado-loja-2026-10-13.md)) |
| Servidor local (esta máquina) | `npm run dev -- --port 8090 --host`                                           | Porta 8090 (padrão do `scripts/foto.mjs`); sem `--port`, o Vite sobe em 8080                                                                                                      |

**Centralizar no Coolify:** Supabase, envs SMTP e secrets Google.  
**Fora do Coolify (inevitável):** caixa de e-mail na Hostinger (hPanel → E-mails); Client ID/Secret no Google Cloud (colar no Coolify); variáveis `VITE_*` no painel da Hostinger.  
**Não precisa** Google Workspace.

---

## Contas e IDs (referência)

| Item                                   | Valor                                                                                               |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Coolify (só pela rede Tailscale)       | `http://100.87.77.28:8000` (pelo IP público a porta 8000 é bloqueada; conferido em 13/10/2026)      |
| Projeto Coolify                        | `barba-cabelo`                                                                                      |
| Serviço                                | `supabase-barba-cabelo`                                                                             |
| UUID do serviço                        | `z2dbb7dkyzhc8vjiywq34mhn`                                                                          |
| VPS                                    | `187.127.60.78` (acesso SSH deste Mac: `ssh vps-barba`)                                             |
| App                                    | `https://beauty.contheiner.digital`                                                                 |
| Kong (oficial)                         | `https://supabase-barbearia.proh.media`                                                             |
| Kong (mesmo servidor, usado pelo site) | `https://supabasebeauty.contheiner.digital`                                                         |
| DNS de `contheiner.digital`            | Cloudflare (`april` / `kianchau.ns.cloudflare.com`, conferido em 13/10/2026); MX e SPF da Hostinger |

Detalhes extras do BaaS: [supabase/README.md](../supabase/README.md). Continuação do chat: [CONTINUIDADE.md](CONTINUIDADE.md).

---

## Situação dos passos de implantação (13/10/2026)

1. E-mail do sistema — **feito** (SMTP da Hostinger desde 02/10/2026; seção 1).
2. Coolify — SMTP do Auth e das funções — **feito** (seção 2).
3. "Esqueci a senha" — **feito** (e-mail chega em pt-BR, só com botão; CONTINUIDADE, 02/10/2026).
4. WhatsApp — conectar QR na loja + opt-in no perfil do cliente (seção 5).
5. Login Google no Coolify — **feito** (restaurado em 30/09/2026).
6. Google Agenda + Contatos — **ligado**; falta reenviar a verificação do Google (P-28, [google-verificacao.md](google-verificacao.md)).
7. Domínio `supabasebeauty` com TLS — **feito** (seção 4).
8. Site publicado com `VITE_SUPABASE_*` apontando para `supabasebeauty.contheiner.digital` — em uso.
9. Certificado do subdomínio de cada loja nova — **feito** (automático desde 15/10/2026: timer `barba-cert-lojas` na VPS, a cada 10 min; seção 5c).

---

## 1. E-mail do sistema — SMTP da Hostinger

Desde **02/10/2026** o e-mail do sistema (Auth e funções) sai pelo SMTP da Hostinger. O Titan foi **abandonado** (recusava a senha com erro 535); não seguir guias antigos do Titan e **não trocar MX/SPF para o Titan**: o domínio `contheiner.digital` usa MX `mx1`/`mx2.hostinger.com` e SPF `include:_spf.mail.hostinger.com` (conferido em 13/10/2026).

| Campo     | Valor (sem segredos)                                                    |
| --------- | ----------------------------------------------------------------------- |
| Host      | `smtp.hostinger.com`                                                    |
| Porta     | `465` (SSL)                                                             |
| Usuário   | a caixa `…@contheiner.digital` (endereço completo; senha só no Coolify) |
| Remetente | `noreply@contheiner.digital`                                            |
| Onde fica | Coolify → serviço `supabase-barba-cabelo` → variáveis `SMTP_*`          |

- A caixa é gerenciada no hPanel da Hostinger → **E-mails**.
- Auth e funções (`email-dispatch`) usam a **mesma** credencial; trocar a senha exige atualizar `SMTP_PASS` no Coolify (seção 2.3.1).
- Modelos dos e-mails do Auth em pt-BR: `public/email/*.html`, publicados no site e ligados por `GOTRUE_MAILER_TEMPLATES_*` / `GOTRUE_MAILER_SUBJECTS_*`.

---

## 2. Coolify — SMTP do Supabase Auth

As variáveis já estão preenchidas no servidor (conferido em 13/10/2026: `SMTP_HOST` da Hostinger, porta 465, remetente `noreply@contheiner.digital`). Esta seção serve para conferir ou refazer.

### 2.1 Abrir o serviço

1. Coolify → projeto **barba-cabelo**.
2. Serviço **supabase-barba-cabelo** (`z2dbb7…`).
3. Environment Variables / `.env`.

### 2.2 Preencher

```text
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=<caixa>@contheiner.digital
SMTP_PASS=<senha da caixa — só no Coolify>
SMTP_ADMIN_EMAIL=noreply@contheiner.digital
SMTP_SENDER_NAME=Barba & Cabelo
```

Manter (já configurado):

```text
GOTRUE_SITE_URL=https://beauty.contheiner.digital
ADDITIONAL_REDIRECT_URLS=https://beauty.contheiner.digital/**
```

O `docker-compose` mapeia isso para `GOTRUE_SMTP_*`.

### 2.3 Reiniciar

1. Reiniciar só o necessário (`supabase-auth` e, para as funções, o container de funções). **Não usar "Redeploy"** do serviço sem necessidade ([guia/banco-e-implantacao.md](guia/banco-e-implantacao.md), seção 1).
2. Conferir no container, sem imprimir valores secretos:
   - `GOTRUE_SMTP_HOST` contém `smtp.hostinger.com`
   - `GOTRUE_SMTP_ADMIN_EMAIL` = `noreply@contheiner.digital`
   - `GOTRUE_SITE_URL=https://beauty.contheiner.digital`

### 2.3.1 Se o servidor recusar o login (535)

Configuração atual: `SMTP_HOST=smtp.hostinger.com`, porta 465, usuário `…@contheiner.digital`, remetente `noreply@contheiner.digital`. Em 29/09 e 02/10/2026 a senha foi corrigida (login verificado). Se voltar a acontecer:

1. hPanel → **E-mails** → caixa usada em `SMTP_USER` → redefinir a senha (ou confirmar a atual).
2. Coolify → serviço `supabase-barba-cabelo` → atualizar `SMTP_PASS` (vale para o Auth e para as funções).
3. Reiniciar o serviço (Auth + Edge functions).
4. Testar com **Esqueci a senha** (2.4). A fila de e-mails do app tenta de novo sozinha a cada minuto.

### 2.4 Testar reset de senha

1. Abrir login do app (`/auth`).
2. **Esqueci a senha** → e-mail de conta real.
3. Checar inbox/spam.
4. Link deve abrir `/auth?recovery=1…` em `beauty.contheiner.digital` (ou localhost em dev).
5. Salvar nova senha.

**Se o domínio público falhar com “Failed to fetch”:** o build antigo ainda aponta para `*.supabase.co` morto. Testar local com `.env` atual, ou republicar com:

```text
VITE_SUPABASE_URL=https://supabasebeauty.contheiner.digital
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key do Coolify>
```

(`supabase-teste.proh.media` leva a outro serviço desde 29/09/2026: nunca usar.)

Variáveis `SUPABASE_*` **sem** `VITE_` não entram no bundle do navegador.

### 2.5 Onde a UI já permite trocar senha logado

- Cliente → **Perfil** → Redefinir senha
- Barbearia → bloco **Sua conta** (fim da página)
- Admin global → bloco **Sua conta** (fim da página)
- Demo: card oculto (não há conta real)

---

## 3. Login com Google (OAuth) + Agenda/Contatos

São **dois fluxos** no mesmo Client OAuth do Google Cloud:

| Fluxo                     | Para quê                          | Quem guarda o token                                 |
| ------------------------- | --------------------------------- | --------------------------------------------------- |
| **A — Entrar com Google** | Identidade (login)                | GoTrue / Auth                                       |
| **B — Agenda e Contatos** | Importar agenda e salvar contatos | Tabela `google_connections` + Edge `google-connect` |

O botão no `/auth` já chama `signInWithOAuth({ provider: "google" })` (fluxo A).  
Em **Ajustes da loja** o card **Google Agenda e Contatos** inicia o fluxo B.

### 3.1 Google Cloud Console (uma vez)

1. Criar (ou abrir) um projeto Google Cloud.
2. **APIs & Services** → **Library** → ativar:
   - **Google Calendar API**
   - **People API** (Contatos)
3. **OAuth consent screen** (External ou Internal):
   - App name, e-mail de suporte.
   - Escopos: `openid`, `email`, `profile`, `.../auth/calendar`, `.../auth/contacts`.
   - Em External, adicionar test users enquanto o app não estiver “em produção”.
4. **Credentials** → **Create OAuth client ID** → tipo **Web application**.
5. **Authorized redirect URIs** (todos):
   - `https://supabasebeauty.contheiner.digital/auth/v1/callback` ← login (fluxo A; é o retorno em uso desde 30/09/2026)
   - `https://beauty.contheiner.digital/auth/google-apps` ← Agenda/Contatos (fluxo B)
   - (local, se testar) `http://localhost:<porta>/auth/google-apps` — nesta máquina o servidor local roda em 8090; o relatório do TI de 31/10 informa `http://localhost:8080/auth/google-apps` no cliente. Não trocar a porta cadastrada automaticamente.
   - `https://supabase-teste.proh.media/auth/v1/callback`: **não é mais deste projeto** (leva ao Flow TEST desde 29/09/2026). **P-69 concluída em 31/10 segundo relatório recebido:** removidos esse retorno e, separadamente, a origem JavaScript antiga, com dois testes de login aprovados pelo dono. Não repetir. [Registro e conferência de domínio antes da P-28](pacotes/2026-10-31-google-dominio-p28.md).
   - O projeto Google Cloud do app é o `proh-media-drive` ([guia/banco-e-implantacao.md](guia/banco-e-implantacao.md), seção 11).
6. Copiar **Client ID** e **Client Secret**. Não versionar no Git.

Não precisa Google Workspace.

### 3.2 Coolify — login (fluxo A / GoTrue)

No `.env` do serviço Auth / stack Supabase:

```text
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=SEU_CLIENT_ID
GOTRUE_EXTERNAL_GOOGLE_SECRET=SEU_CLIENT_SECRET
```

1. Reiniciar `supabase-auth`.
2. Testar botão Google em `/auth`.
3. Redirect deve voltar para `beauty.contheiner.digital` / localhost.

### 3.3 Coolify — Agenda e Contatos (fluxo B)

No mesmo serviço das Edge Functions (`supabase-barba-cabelo` / funções), acrescentar:

```text
GOOGLE_OAUTH_CLIENT_ID=SEU_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET=SEU_CLIENT_SECRET
GOOGLE_OAUTH_REDIRECT_URI=https://beauty.contheiner.digital/auth/google-apps
APP_URL=https://beauty.contheiner.digital
GOOGLE_OAUTH_STATE_SECRET=uma-string-longa-aleatoria
```

Pode reutilizar o mesmo Client ID/Secret do login.  
Publicar a função `google-connect` e aplicar a migration `20260923140000_google_calendar_contacts.sql`.

**Uso na UI**

1. Entrar na loja → **Ajustes** → **Google Agenda e Contatos** → **Conectar Google**.
2. Se aparecer **“O Google não verificou este app”** (app em modo teste):
   - **Correção definitiva (recomendado em teste):** Google Cloud Console → projeto do OAuth (`9697media@gmail.com`) → **APIs & Services → OAuth consent screen → Test users** → **Add users** com o Gmail que vai autorizar a Agenda (pode ser outro e-mail).
   - **Atalho pontual:** na tela do aviso, **Avançado** → **Ir para … (não seguro)**.
   - Produção: publicar o app e passar pela verificação Google (escopos de Agenda/Contatos são sensíveis).
3. Na tela de contas Google, **escolha o Gmail da Agenda** — pode ser outro e-mail; não precisa ser o do login no Barba & Cabelo.
4. Autorizar Agenda + Contatos.
5. O retorno volta ao **mesmo domínio da loja** onde você estava logado (a sessão não fica no apex `beauty…`).
6. **Sincronizar agenda** importa eventos (~7 dias atrás a 60 à frente) em `google_calendar_events`.
7. Preencher nome/telefone/e-mail → **Salvar contato** cria entrada no Google Contatos.

O login do app e a conexão Agenda/Contatos são vínculos separados: a sessão do sistema fica no `auth.uid()`; o Gmail da Agenda fica só em `google_connections.google_email`.

### 3.4 Checklist Google (situação em 13/10/2026)

- [x] Calendar API + People API ativas (CONTINUIDADE, 03/10/2026)
- [x] Redirect URI do login (`supabasebeauty…/auth/v1/callback`) aceito pelo Google (30/09/2026)
- [x] `GOTRUE_EXTERNAL_GOOGLE_*` no Auth (login ligado; conferido no container em 13/10/2026)
- [x] `GOOGLE_OAUTH_*` nas Edge Functions + `google-connect` publicada
- [x] Migration `google_connections` aplicada
- [x] Login Google restaurado em `/auth` (30/09/2026)
- [ ] Reenviar a verificação OAuth do Google (P-28, tarefa do dono)

---

## 4. Domínios da API (Kong)

**Feito.** Os dois endereços levam ao mesmo Supabase da barbearia e respondem com certificado válido (`/auth/v1/health` → 401 sem chave, conferido em 13/10/2026):

| Endereço                                    | Papel                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `https://supabase-barbearia.proh.media`     | Oficial: `API_EXTERNAL_URL` e `SERVICE_URL_SUPABASEKONG`; a tarefa `barba-whatsapp-dispatch` chama este |
| `https://supabasebeauty.contheiner.digital` | Mesmo servidor; é o que o site publicado usa (`VITE_SUPABASE_URL`) e o retorno do login Google          |

- Os dois resolvem para `187.127.60.78`. O registro `supabasebeauty` fica na Cloudflare e precisa ser "DNS only" (sem proxy), senão o Let's Encrypt do Traefik quebra.
- `supabase-teste.proh.media` **não é mais deste projeto** (Flow TEST desde 29/09/2026). Não usar em `.env`, compilação, Google Cloud ou tarefas.
- Trocar o endereço usado pelo site exige ajustar `VITE_SUPABASE_URL` no painel da Hostinger e recompilar ([guia/banco-e-implantacao.md](guia/banco-e-implantacao.md), seção 2).

---

## 5d. Cadastro self-serve (landing + WhatsApp da plataforma)

Atualizado em **24/09/2026**.

### O que o barbeiro faz

1. Abrir `https://beauty.contheiner.digital/` (landing).
2. **Abrir minha barbearia** → `/cadastrar`.
3. Preencher nome da loja, nome, e-mail, senha e WhatsApp.
4. Receber código no WhatsApp (número da **plataforma**, não da loja).
5. Confirmar → conta + loja (dono) → painel `/shop`.

Admin continua podendo criar/convidar em `/platform`.

### Coolify / Evolution (obrigatório para o OTP)

1. No Coolify, envs das Edge Functions:

```text
EVOLUTION_API_URL=https://evolutionapi.contheiner.digital
EVOLUTION_API_KEY=…
PLATFORM_EVOLUTION_INSTANCE=platform-barba
```

2. Publicar funções `register-shop` e `platform-whatsapp`.
3. Aplicar migration `20260924120000_platform_signup_otp.sql`.
4. No app: **Plataforma → Visão geral → WhatsApp da plataforma → Conectar WhatsApp** (QR). Não precisa entrar no painel Evolution no dia a dia.

### Checklist

- [ ] `PLATFORM_EVOLUTION_INSTANCE` no Coolify
- [ ] Funções `register-shop` e `platform-whatsapp` publicadas
- [ ] Migration de OTP signup aplicada
- [ ] Admin conectou QR em Plataforma → Visão geral
- [ ] Teste ponta a ponta em `/cadastrar` com número real

---

## 5c. Domínios por barbearia (subdomínio + domínio próprio)

Atualizado em **23/09/2026**.

### Endereço público e link do barbeiro

- Com domínio próprio **ativo**, ele é o endereço público principal (`shopPublicOrigin`).
- Sem domínio próprio, usa o automático `https://{slug}.beauty.contheiner.digital/app`.
- Parceiro copia `…/app?barber={booking_slug}`. Paths legados no host da loja (`/ezequiel`) redirecionam para o mesmo.
- Em **Equipe**, o slug do profissional é editável. A Externa foi remontada uma vez (Ezequiel + Tiago) em 02/10/2026; o botão e a função `admin_reset_externa_barbearia` foram removidos. O site WordPress `externabarbearia.com.br` foi só referência de conteúdo — não entra como domínio do sistema até a loja configurar em Ajustes.

### Caminho A — subdomínio automático

| Item   | Valor                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Padrão | `https://{slug}.beauty.contheiner.digital`                                                                                                                                                                                                                                                                                                                                    |
| DNS    | Cloudflare: `*.beauty` → `187.127.60.78` (DNS only)                                                                                                                                                                                                                                                                                                                           |
| Proxy  | Traefik no VPS (`wildcard-beauty.yaml`) → Hostinger `beauty.contheiner.digital`                                                                                                                                                                                                                                                                                               |
| TLS    | Let’s Encrypt no Traefik, **um roteador por loja** em `beauty-shop-certs.yaml` (o curinga entrega o "TRAEFIK DEFAULT CERT"). Loja nova: automático desde 15/10/2026, timer `barba-cert-lojas` na VPS a cada 10 min (seção 6 de [implantacao-certificado-loja-2026-10-13.md](implantacao-certificado-loja-2026-10-13.md)). Conferir ou aplicar na hora: `scripts/cert-loja.sh` |
| Auth   | `ADDITIONAL_REDIRECT_URLS` com `https://beauty.contheiner.digital/**` e `https://*.beauty.contheiner.digital/**`                                                                                                                                                                                                                                                              |

Subdomínio `*.beauty…` e domínio próprio: o login Google abre um **pop-up** no apex (`beauty…`); a aba principal permanece no domínio da loja e recebe a sessão sem navegar para beauty. Logout usa `/auth` relativo. Código: `src/lib/auth/return-origin.ts`.

**Allow list do Auth (Coolify):** manter `ADDITIONAL_REDIRECT_URLS` com `https://beauty.contheiner.digital/**` (o callback OAuth do pop-up). Domínio próprio **não** precisa entrar na allow list.

**Bloqueio de 22/09 (resolvido):** `beauty.contheiner.digital` estava **sem registro A** na Cloudflare → Traefik não alcançava a Hostinger → **HTTP 502** em `*.beauty…`. Em 13/10/2026 `beauty` resolve para o IP da Hostinger (não o da VPS) e os subdomínios das lojas respondem 200. Registro necessário, para referência:

| Nome     | Tipo | Valor                                             | Proxy    |
| -------- | ---- | ------------------------------------------------- | -------- |
| `beauty` | A    | **IP do plano Hostinger** (hPanel → Plan details) | DNS only |

Não use o IP do VPS no `beauty` apex — isso criaria loop. O VPS só recebe `*.beauty`; o apex `beauty` deve ir à Hostinger.

Detalhe completo: [beauty-saas-infra.md](beauty-saas-infra.md).

### Caminho B — domínio próprio

O app é **TanStack Start** (não Nuxt). Descartar `tenant.ts` / `/lookup`: a barbearia é resolvida no browser via `resolve_shop_by_host` (subdomínio **e** domínio próprio ativo).

1. Ajustes → **Domínio da barbearia** → informar o domínio.
2. A Edge Function `shop-domain` grava no banco e chama o domain-manager `POST /add` (rota Traefik + TLS).
3. DNS do cliente: CNAME → `beauty.contheiner.digital` + TXT `_barba-verify…`.
4. **Verificar DNS** no painel (`shop-domain` action `verify` → marca `active` + reforça `/add`).
5. Remover domínio: `shop-domain` action `clear` → limpa banco + `DELETE /remove`.
6. Com status `active`, o subdomínio redireciona para o domínio próprio.

**Envs no Coolify (Edge Functions / Supabase), nunca no frontend:**

| Variável                 | Exemplo                                                      |
| ------------------------ | ------------------------------------------------------------ |
| `DOMAIN_MANAGER_URL`     | `https://doowrlcfv9wjlh3rktmbshcb.beauty.contheiner.digital` |
| `DOMAIN_MANAGER_API_KEY` | (chave do domain-manager — só no servidor)                   |

Script manual de fallback (se a API falhar): `scripts/sync-traefik-custom-domains.sh`.

### Checklist ops

- [x] Wildcard DNS `*.beauty` (Cloudflare → VPS)
- [x] Traefik `wildcard-beauty.yaml`
- [x] Auth redirects `*.beauty…`
- [x] `resolve_shop_by_host` cobre domínio próprio ativo
- [x] Função `shop-domain` (set/clear/verify + domain-manager)
- [x] Envs `DOMAIN_MANAGER_URL` + `DOMAIN_MANAGER_API_KEY` no Coolify
- [x] Deploy da Edge Function `shop-domain`
- [x] Registro A `beauty` → IP Hostinger (conferido em 13/10/2026)
- [x] Certificado por loja automático (15/10/2026: timer `barba-cert-lojas` do systemd na VPS, a cada 10 min, sem cron; seção 6 do [guia do certificado](implantacao-certificado-loja-2026-10-13.md))
- [ ] Hostinger rebuild do front (commit `cac9bc4` em `main`) — até lá UI só no local
- [ ] Testar `https://{slug}.beauty…/auth` e `/app`
- [ ] Testar domínio próprio de ponta a ponta

---

## 5b. Links, slugs e desvinculação

Atualizado em **22/09/2026**.

| Item                    | Comportamento                                                               |
| ----------------------- | --------------------------------------------------------------------------- |
| Slug da loja / barbeiro | Gerado automaticamente a partir do nome                                     |
| Rename                  | Cria redirect permanente do endereço antigo                                 |
| Apagar redirect         | Só na mão (Ajustes → Links); locked não apaga pela loja                     |
| Levar carteira          | Exclusivo; destino obrigatório; link antigo travado                         |
| Sociedade               | Outro sócio libera a carteira antes da saída                                |
| Abrir mão               | Clientes ficam; slug pode ser reutilizado pela loja                         |
| Cadastro                | `/auth?shop=slug` vincula o cliente à loja do link                          |
| Multi-loja              | Mesmo e-mail; link de outra loja pede confirmação; pontos **por barbearia** |

---

## 5. WhatsApp (Evolution API) — fase 1

Atualizado em **22/09/2026**.

### O que já está ligado

| Item                     | Valor                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------- |
| Evolution Coolify        | projeto `evolution-api` / UUID `ycr9loibkx8iim2swdmbhpgo`                           |
| URL                      | `https://evolutionapi.contheiner.digital` (v2.3.7)                                  |
| Modelo                   | **1 instância WhatsApp por barbearia**                                              |
| Auth OTP                 | Alternativa ao e-mail **só com** `/auth?shop=…`                                     |
| Migration                | `supabase/migrations/20260922010000_whatsapp_evolution.sql` (aplicada no DB remoto) |
| Edge Functions           | `whatsapp-dispatch`, `whatsapp-channel`, `auth-otp`                                 |
| Cron envio               | `/etc/cron.d/barba-whatsapp-dispatch` (a cada minuto)                               |
| Envs no Supabase Coolify | `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` (mesma key do Evolution)                   |

### Como conectar uma loja

1. Entrar no painel da barbearia como **dono** ou **sócio**.
2. **Ajustes** → card **WhatsApp da barbearia** → **Conectar WhatsApp**.
3. Escanear o QR no celular (WhatsApp → Aparelhos conectados).
4. **Atualizar** até status **Conectado**.
5. Ligar/desligar avisos de horário e lembrete conforme a loja.

### Cliente

1. **Perfil** → informar WhatsApp com DDD.
2. Ativar **Receber avisos por WhatsApp**.
3. Confirmação / remarcação / cancelamento e lembrete (padrão 24h) entram na fila `whatsapp_outbox`.
4. Em **Ajustes → WhatsApp**, a loja edita os textos (placeholders `{{loja}}`, `{{servico}}`, `{{profissional}}`, `{{quando}}`, `{{cliente}}`, `{{link_reserva}}`). Sem customização, valem os padrões.
5. Sino no card do cliente (diretório): envia aviso pré-definido por WhatsApp e e-mail (quando disponíveis).

### Recuperar senha por WhatsApp

1. Abrir login **com** `?shop=slug-da-loja` (link da barbearia).
2. **Esqueci a senha** → escolher **WhatsApp**.
3. Receber código de 6 dígitos → confirmar → definir nova senha.
4. Sem contexto de loja: só e-mail.

### Fora da fase 1

Lista de transmissão, campanhas, inbox de conversas, número único da plataforma.

### Google Agenda e e-mails de agendamento

#### Google Agenda + Contatos

Implementado e ligado: Edge `google-connect`, migration `google_connections` / `google_calendar_events`, UI em Ajustes. Operação: seção **3.3**.

Desde 29/09/2026 existe também a cópia dos agendamentos para a Agenda Google escolhida (opcional, desligada por padrão): fila `google_calendar_pushes`, enviada por `google-calendar-dispatch` dentro da tarefa de cada minuto.

#### E-mails operacionais

Fila `email_outbox`, enviada por `email-dispatch` (SMTP da Hostinger, seção 1) dentro da tarefa de cada minuto; tenta de novo sozinha quando falha. O WhatsApp continua sendo o canal principal quando a loja conecta o número.

---

## 6. Checklist geral

### E-mail (SMTP da Hostinger)

- [x] MX e SPF da Hostinger em `contheiner.digital` (conferido em 13/10/2026)
- [x] Caixa da Hostinger enviando como `noreply@contheiner.digital` (02/10/2026)
- [ ] DKIM/DMARC: não conferido

### Coolify Auth

- [x] SMTP preenchido (Hostinger, porta 465)
- [x] Reset de senha chega e o link funciona (02/10/2026)
- [x] Google OAuth (login) habilitado e botão funciona (30/09/2026)
- [x] `GOOGLE_OAUTH_*` + função `google-connect` (Agenda/Contatos)

### WhatsApp / Evolution

- [ ] Evolution respondendo em `evolutionapi.contheiner.digital`
- [ ] `EVOLUTION_API_*` no serviço `supabase-barba-cabelo`
- [ ] Loja conectou QR e status **open**
- [ ] Cliente com opt-in recebe confirmação de horário
- [ ] Cron `barba-whatsapp-dispatch` ativo

### Domínio API

- [x] `supabasebeauty` e `supabase-barbearia` → `187.127.60.78`
- [x] HTTPS com certificado válido nos dois (13/10/2026)
- [x] Site usando `supabasebeauty…`; Coolify com `supabase-barbearia…` como endereço oficial

### Produção do app

- [ ] `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` corretos no build
- [ ] Sem referência a `awecrsklxaeqxctfxirt.supabase.co`

---

## 7. Texto para colar em outro agente (ChatGPT etc.)

```text
Projeto Barba & Cabelo. Leia docs/LEIA-PRIMEIRO.md e docs/guia/banco-e-implantacao.md; operação em docs/mb-operacao.md.

E-mail do sistema: SMTP da Hostinger, remetente noreply@contheiner.digital (Titan abandonado).

Regras:
- Não mexer em MX/SPF sem o dono (hoje são da Hostinger).
- Não apagar DNS do site beauty.
- Não colocar senhas no Git nem no chat; só confirmar campos.
- Coolify: projeto barba-cabelo, serviço supabase-barba-cabelo (z2dbb7…); nunca "Redeploy" sem necessidade.
- Evolution: evolutionapi.contheiner.digital (instância por loja).
- App: beauty.contheiner.digital | API: supabase-barbearia.proh.media (oficial) e supabasebeauty.contheiner.digital (mesmo servidor, usado pelo site).
- supabase-teste.proh.media NÃO é deste projeto: não usar.
```

---

## 8. Avisos

- SMTP da Hostinger: serve para Auth (reset/convite) e avisos. Volume alto de marketing/lembretes pode exigir SMTP transacional depois — troca só as variáveis `SMTP_*` no Coolify.
- Google Workspace: **não necessário**.
- Org Lovable / ANA Brasil: **não usar** para este BaaS (conta correta: Proh / Hostinger VPS — ver `supabase/README.md`).
- WhatsApp: use número da **barbearia**, não pessoal do dono, se possível; respeite opt-in do cliente.
- Este documento é operação; interface do produto continua em [mb-interface.md](mb-interface.md) e na skill `mb`.
