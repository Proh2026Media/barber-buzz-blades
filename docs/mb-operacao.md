# MB — Operação (Coolify, Titan, Google)

Atualizado em **23/09/2026**.  
Passo a passo operacional do Barba & Cabelo: e-mail (Titan), Auth no Coolify, login Google e pendências de domínio. Linguagem curta, uma ação por etapa — no mesmo espírito do `/mb` (próximo passo claro, sem misturar assuntos).

**Não versionar senhas, tokens nem chaves.** Preencher só no Coolify / gerenciador de senhas.

---

## Mapa rápido

| O quê | Onde fica | Status |
|-------|-----------|--------|
| App | Coolify / Hostinger → `beauty.contheiner.digital` | Em produção; conferir `VITE_SUPABASE_*` |
| Supabase (Auth, DB) | Coolify → `barba-cabelo` / `supabase-barba-cabelo` | Em uso |
| API Supabase (hoje) | `https://supabase-teste.proh.media` | OK |
| API Supabase (alvo) | `https://supabasebeauty.contheiner.digital` | Traefik pronto; **DNS A pendente** |
| E-mail humano + SMTP | Titan (Hostinger) | **A configurar** |
| Login Google (botão) | App pronto; OAuth no GoTrue | **A configurar no Coolify** |
| Sync Google Agenda + Contatos | Edge `google-connect` + card em Ajustes | **Código pronto; falta Client ID/Secret + APIs** |
| WhatsApp (Evolution) | Coolify `evolution-api` + funções no Supabase | **Fase 1 ligada** (por loja; ver seção 5) |
| Notificações in-app | App | OK |
| E-mail de agenda / lembretes | — | WhatsApp cobre o canal inicial; SMTP Titan ainda para Auth |

**Centralizar no Coolify:** app, Supabase, envs SMTP e secrets Google.  
**Fora do Coolify (inevitável):** caixas Titan no Hostinger; Client ID/Secret no Google Cloud (colar no Coolify).  
**Não precisa** Google Workspace.

---

## Contas e IDs (referência)

| Item | Valor |
|------|--------|
| Coolify (Tailscale) | `http://100.87.77.28:8000` |
| Projeto Coolify | `barba-cabelo` |
| Serviço | `supabase-barba-cabelo` |
| UUID do serviço | `z2dbb7dkyzhc8vjiywq34mhn` |
| VPS | `187.127.60.78` |
| App | `https://beauty.contheiner.digital` |
| Kong em uso | `https://supabase-teste.proh.media` |
| Kong alvo | `https://supabasebeauty.contheiner.digital` |
| DNS do domínio | Hostinger (`ns1` / `ns2.dns-parking.com`) |

Detalhes extras do BaaS: [supabase/README.md](../supabase/README.md). Continuação do chat: [CONTINUIDADE.md](CONTINUIDADE.md).

---

## Ordem sugerida

1. Titan — domínio/subdomínio + DNS + caixa `noreply@…`
2. Coolify — SMTP do Auth + reinício
3. Testar “Esqueci a senha”
4. WhatsApp — conectar QR na loja + opt-in no perfil do cliente (seção 5)
5. (Opcional) Login Google no Coolify  
6. Google Agenda + Contatos — Client ID, APIs e envs `GOOGLE_OAUTH_*` (seção 3.3)  
7. DNS `supabasebeauty` → TLS → trocar URL pública  
8. Republicar app com `VITE_SUPABASE_*` corretos  
9. (Futuro) e-mails de agendamento + broadcast WhatsApp

---

## 1. Titan — domínio e caixas

### 1.1 Escolher o domínio de e-mail

**Opção A (recomendada):** raiz  
- Ex.: `noreply@contheiner.digital`, `contato@contheiner.digital`

**Opção B:** subdomínio de marca  
- Ex.: `noreply@beauty.contheiner.digital`  
- Exige adicionar esse host no Titan e DNS próprio dele.

Caixa do **sistema** (SMTP): `noreply@…`  
Caixa **humana** (opcional): `contato@…`  
Não usar a caixa pessoal no SMTP do Auth.

### 1.2 Hostinger / Titan

1. Abrir hPanel Hostinger → **E-mails** / **Titan Email**.
2. Se o domínio/subdomínio não existir: **Adicionar / configurar e-mail**.
3. Seguir o assistente até a tela de **DNS**.

### 1.3 DNS (copiar do Titan — não inventar)

Na zona DNS de `contheiner.digital` (ou do subdomínio escolhido):

| Tipo | Nome | Valor | Prioridade |
|------|------|--------|------------|
| MX | `@` (ou o subdomínio) | o que o Titan mostrar (ex. `mx1.titan.email`) | 10 |
| MX | `@` (ou o subdomínio) | segundo MX do Titan | 20 |
| TXT SPF | `@` | em geral `v=spf1 include:spf.titan.email ~all` (ou o texto do Titan) | — |
| TXT DKIM | host indicado pelo Titan | chave longa do Titan | — |
| TXT DMARC (recomendado) | `_dmarc` | `v=DMARC1; p=none; rua=mailto:sua-caixa@dominio` | — |

**Cuidado**

- Um domínio/subdomínio só pode ter **um** conjunto de MX. Remover MX antigo de outro provedor se sobrar.
- Só **um** SPF por nome. Se já existir SPF, **unir** num único TXT.
- Não apagar A/CNAME do site (`beauty`, app, etc.) ao editar MX.
- Propagação: minutos a algumas horas (às vezes 24–48 h).

### 1.4 Validar e criar caixas

1. No Titan: **Verificar DNS** até status ativo.
2. Criar `noreply@SEU-DOMINIO` (sistema).
3. Opcional: `contato@SEU-DOMINIO`.
4. Guardar a senha fora do Git.
5. Se o Titan pedir: habilitar **3rd party apps** / SMTP.
6. Teste: webmail Titan → enviar para um Gmail pessoal.

### 1.5 Dados SMTP Titan (para a Parte 2)

| Campo | Valor |
|-------|--------|
| Host | `smtp.titan.email` |
| Porta preferida | `587` (STARTTLS) |
| Alternativa | `465` (SSL) |
| Usuário | e-mail completo `noreply@…` |
| Senha | senha da caixa |
| Remetente | o mesmo `noreply@…` |

---

## 2. Coolify — SMTP do Supabase Auth

Hoje o Auth já espera estas variáveis; estão **vazias** no VPS.

### 2.1 Abrir o serviço

1. Coolify → projeto **barba-cabelo**.
2. Serviço **supabase-barba-cabelo** (`z2dbb7…`).
3. Environment Variables / `.env`.

### 2.2 Preencher

```text
SMTP_HOST=smtp.titan.email
SMTP_PORT=587
SMTP_USER=noreply@SEU-DOMINIO
SMTP_PASS=SENHA_DA_CAIXA
SMTP_ADMIN_EMAIL=noreply@SEU-DOMINIO
SMTP_SENDER_NAME=Barba & Cabelo
```

Manter (já configurado):

```text
GOTRUE_SITE_URL=https://beauty.contheiner.digital
ADDITIONAL_REDIRECT_URLS=https://beauty.contheiner.digital/**
```

O `docker-compose` mapeia isso para `GOTRUE_SMTP_*`.

### 2.3 Reiniciar

1. Recriar/reiniciar pelo menos `supabase-auth`.
2. Conferir no container:
   - `GOTRUE_SMTP_HOST=smtp.titan.email`
   - `GOTRUE_SMTP_USER=noreply@…`
   - `GOTRUE_SITE_URL=https://beauty.contheiner.digital`

### 2.4 Testar reset de senha

1. Abrir login do app (`/auth`).
2. **Esqueci a senha** → e-mail de conta real.
3. Checar inbox/spam.
4. Link deve abrir `/auth?recovery=1…` em `beauty.contheiner.digital` (ou localhost em dev).
5. Salvar nova senha.

**Se o domínio público falhar com “Failed to fetch”:** o build antigo ainda aponta para `*.supabase.co` morto. Testar local com `.env` atual, ou republicar com:

```text
VITE_SUPABASE_URL=https://supabase-teste.proh.media
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key do Coolify>
```

Variáveis `SUPABASE_*` **sem** `VITE_` não entram no bundle do navegador.

### 2.5 Onde a UI já permite trocar senha logado

- Cliente → **Perfil** → Redefinir senha  
- Barbearia → bloco **Sua conta** (fim da página)  
- Admin global → bloco **Sua conta** (fim da página)  
- Demo: card oculto (não há conta real)

---

## 3. Login com Google (OAuth) + Agenda/Contatos

São **dois fluxos** no mesmo Client OAuth do Google Cloud:

| Fluxo | Para quê | Quem guarda o token |
|-------|----------|---------------------|
| **A — Entrar com Google** | Identidade (login) | GoTrue / Auth |
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
   - `https://supabase-teste.proh.media/auth/v1/callback` ← login (fluxo A)
   - `https://beauty.contheiner.digital/auth/google-apps` ← Agenda/Contatos (fluxo B)
   - (local, se testar) `http://localhost:8080/auth/google-apps`
   - (quando o domínio novo tiver TLS) `https://supabasebeauty.contheiner.digital/auth/v1/callback`
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
2. Autorizar Agenda + Contatos na tela do Google.
3. **Sincronizar agenda** importa eventos (~7 dias atrás a 60 à frente) em `google_calendar_events`.
4. Preencher nome/telefone/e-mail → **Salvar contato** cria entrada no Google Contatos.

### 3.4 Checklist Google

- [ ] Calendar API + People API ativas  
- [ ] Redirect URIs A e B no Client OAuth  
- [ ] `GOTRUE_EXTERNAL_GOOGLE_*` no Auth + reinício  
- [ ] `GOOGLE_OAUTH_*` nas Edge Functions + `google-connect` publicada  
- [ ] Migration `google_connections` aplicada  
- [ ] Login Google funciona em `/auth`  
- [ ] Card em Ajustes conecta e sincroniza  

---

## 4. Domínio `supabasebeauty.contheiner.digital`

### Já feito no Coolify

- Router Traefik separado para o host novo.
- Alias `supabase-teste.proh.media` continua com TLS válido.
- `SUPABASE_PUBLIC_URL` do Auth permanece no domínio **em uso** até o DNS/LE do novo fecharem.

### Falta (Hostinger DNS)

Criar **um** registro:

| Tipo | Nome | Valor |
|------|------|--------|
| A | `supabasebeauty` | `187.127.60.78` |

Só esse A — sem IPs extras.  
Hoje o DNS autoritativo responde **NXDOMAIN** para esse host → Let’s Encrypt não emite certificado.

### Depois do DNS propagar

1. Esperar certificado Let’s Encrypt no Traefik.
2. Testar: `https://supabasebeauty.contheiner.digital/auth/v1/health` (espera resposta do Kong, ex. 401 com apikey).
3. Atualizar no Coolify: `SERVICE_URL_SUPABASEKONG` / `SUPABASE_PUBLIC_URL` → domínio novo.
4. Atualizar `.env` local e build de produção (`VITE_SUPABASE_URL`).
5. Incluir redirect Google no Client OAuth (Parte 3).

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
- Em **Equipe**, o slug do profissional é editável. Em **Plataforma → Barbearias**, botão remonta a Externa (Ezequiel + Tiago) via `admin_reset_externa_barbearia`. O site WordPress `externabarbearia.com.br` foi só referência de conteúdo — não entra como domínio do sistema até a loja configurar em Ajustes.

### Caminho A — subdomínio automático

| Item | Valor |
|------|--------|
| Padrão | `https://{slug}.beauty.contheiner.digital` |
| DNS | Cloudflare: `*.beauty` → `187.127.60.78` (DNS only) |
| Proxy | Traefik no VPS (`wildcard-beauty.yaml`) → Hostinger `beauty.contheiner.digital` |
| TLS | Let’s Encrypt no Traefik |
| Auth | `ADDITIONAL_REDIRECT_URLS` com `https://beauty.contheiner.digital/**` e `https://*.beauty.contheiner.digital/**` |

Subdomínio `*.beauty…` e domínio próprio: o login Google abre um **pop-up** no apex (`beauty…`); a aba principal permanece no domínio da loja e recebe a sessão sem navegar para beauty. Logout usa `/auth` relativo. Código: `src/lib/auth/return-origin.ts`.

**Allow list do Auth (Coolify):** manter `ADDITIONAL_REDIRECT_URLS` com `https://beauty.contheiner.digital/**` (o callback OAuth do pop-up). Domínio próprio **não** precisa entrar na allow list.

**Bloqueio conhecido (22/09):** `beauty.contheiner.digital` está **sem registro A** na Cloudflare → Traefik não alcança a Hostinger → **HTTP 502** em `*.beauty…`. Criar na Cloudflare:

| Nome | Tipo | Valor | Proxy |
|------|------|-------|-------|
| `beauty` | A | **IP do plano Hostinger** (hPanel → Plan details) | DNS only |

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

| Variável | Exemplo |
|----------|---------|
| `DOMAIN_MANAGER_URL` | `https://doowrlcfv9wjlh3rktmbshcb.beauty.contheiner.digital` |
| `DOMAIN_MANAGER_API_KEY` | (chave do domain-manager — só no servidor) |

Script manual de fallback (se a API falhar): `scripts/sync-traefik-custom-domains.sh`.

### Checklist ops

- [x] Wildcard DNS `*.beauty` (Cloudflare → VPS)
- [x] Traefik `wildcard-beauty.yaml`
- [x] Auth redirects `*.beauty…`
- [x] `resolve_shop_by_host` cobre domínio próprio ativo
- [x] Função `shop-domain` (set/clear/verify + domain-manager)
- [x] Envs `DOMAIN_MANAGER_URL` + `DOMAIN_MANAGER_API_KEY` no Coolify
- [x] Deploy da Edge Function `shop-domain`
- [ ] Registro A `beauty` → IP Hostinger (desbloqueia 502 em `*.beauty` se ainda falhar)
- [ ] Hostinger rebuild do front (commit `cac9bc4` em `main`) — até lá UI só no local
- [ ] Testar `https://{slug}.beauty…/auth` e `/app`
- [ ] Testar domínio próprio de ponta a ponta

---

## 5b. Links, slugs e desvinculação

Atualizado em **22/09/2026**.

| Item | Comportamento |
|------|----------------|
| Slug da loja / barbeiro | Gerado automaticamente a partir do nome |
| Rename | Cria redirect permanente do endereço antigo |
| Apagar redirect | Só na mão (Ajustes → Links); locked não apaga pela loja |
| Levar carteira | Exclusivo; destino obrigatório; link antigo travado |
| Sociedade | Outro sócio libera a carteira antes da saída |
| Abrir mão | Clientes ficam; slug pode ser reutilizado pela loja |
| Cadastro | `/auth?shop=slug` vincula o cliente à loja do link |
| Multi-loja | Mesmo e-mail; link de outra loja pede confirmação; pontos **por barbearia** |

---

## 5. WhatsApp (Evolution API) — fase 1

Atualizado em **22/09/2026**.

### O que já está ligado

| Item | Valor |
|------|--------|
| Evolution Coolify | projeto `evolution-api` / UUID `ycr9loibkx8iim2swdmbhpgo` |
| URL | `https://evolutionapi.contheiner.digital` (v2.3.7) |
| Modelo | **1 instância WhatsApp por barbearia** |
| Auth OTP | Alternativa ao e-mail **só com** `/auth?shop=…` |
| Migration | `supabase/migrations/20260922010000_whatsapp_evolution.sql` (aplicada no DB remoto) |
| Edge Functions | `whatsapp-dispatch`, `whatsapp-channel`, `auth-otp` |
| Cron envio | `/etc/cron.d/barba-whatsapp-dispatch` (a cada minuto) |
| Envs no Supabase Coolify | `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` (mesma key do Evolution) |

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

### Recuperar senha por WhatsApp

1. Abrir login **com** `?shop=slug-da-loja` (link da barbearia).
2. **Esqueci a senha** → escolher **WhatsApp**.
3. Receber código de 6 dígitos → confirmar → definir nova senha.
4. Sem contexto de loja: só e-mail.

### Fora da fase 1

Lista de transmissão, campanhas, inbox de conversas, número único da plataforma.

### Google Agenda e e-mails de agendamento

#### Google Agenda + Contatos

Implementado (código): Edge `google-connect`, migration `google_connections` / `google_calendar_events`, UI em Ajustes.  
Operação: seção **3.3**. Ainda depende de Client ID/Secret no Coolify e APIs ativas no Google Cloud.

Não há ainda espelhamento automático de cada agendamento do app → Google Calendar (só importação sob demanda + salvar contato).

#### E-mails operacionais (confirmação, lembrete)

Ainda não ligados por SMTP; WhatsApp cobre o canal operacional inicial quando a loja conecta o número.

---

## 6. Checklist geral

### Titan

- [ ] Domínio/subdomínio verificado no Titan  
- [ ] MX + SPF + DKIM (e DMARC) ok  
- [ ] Caixa `noreply@…` envia pelo webmail  

### Coolify Auth

- [ ] SMTP preenchido  
- [ ] `supabase-auth` reiniciado  
- [ ] Reset de senha chega e o link funciona  
- [ ] Google OAuth (login) habilitado e botão funciona  
- [ ] `GOOGLE_OAUTH_*` + função `google-connect` (Agenda/Contatos)  

### WhatsApp / Evolution

- [ ] Evolution respondendo em `evolutionapi.contheiner.digital`  
- [ ] `EVOLUTION_API_*` no serviço `supabase-barba-cabelo`  
- [ ] Loja conectou QR e status **open**  
- [ ] Cliente com opt-in recebe confirmação de horário  
- [ ] Cron `barba-whatsapp-dispatch` ativo  

### Domínio API

- [ ] A `supabasebeauty` → `187.127.60.78`  
- [ ] HTTPS com certificado válido  
- [ ] App e Coolify apontando para a URL nova  

### Produção do app

- [ ] `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` corretos no build  
- [ ] Sem referência a `awecrsklxaeqxctfxirt.supabase.co`  

---

## 7. Texto para colar em outro agente (ChatGPT etc.)

```text
Projeto Barba & Cabelo. Siga docs/mb-operacao.md.

Objetivo agora: Parte 1 (Titan) + Parte 2 (SMTP no Coolify) e/ou validar WhatsApp (seção 5).

Domínio de e-mail: [contheiner.digital OU beauty.contheiner.digital]
Caixa do sistema: noreply@…

Regras:
- Não inventar MX/DKIM — copiar do Titan.
- Não apagar DNS do site beauty.
- Não colocar senhas no Git nem no chat; só confirmar campos.
- Coolify: projeto barba-cabelo, serviço supabase-barba-cabelo (z2dbb7…).
- Evolution: evolutionapi.contheiner.digital (instância por loja).
- App: beauty.contheiner.digital | API hoje: supabase-teste.proh.media
```

---

## 8. Avisos

- Titan free: bom para Auth (reset/convite). Volume alto de marketing/lembretes pode exigir SMTP transacional depois — troca só env no Coolify.
- Google Workspace: **não necessário** com Titan + Coolify.
- Org Lovable / ANA Brasil: **não usar** para este BaaS (conta correta: Proh / Hostinger VPS — ver `supabase/README.md`).
- WhatsApp: use número da **barbearia**, não pessoal do dono, se possível; respeite opt-in do cliente.
- Este documento é operação; interface do produto continua em [mb-interface.md](mb-interface.md) e na skill `mb`.
