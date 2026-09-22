# MB — Operação (Coolify, Titan, Google)

Atualizado em **21/09/2026**.  
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
| Login Google (botão) | App pronto; OAuth no GoTrue | **A configurar** |
| Sync Google Agenda | — | **Ainda não existe no código** |
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
6. DNS `supabasebeauty` → TLS → trocar URL pública
7. Republicar app com `VITE_SUPABASE_*` corretos
8. (Futuro) Google Agenda + e-mails de agendamento + broadcast WhatsApp

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

## 3. Login com Google (OAuth)

O botão no `/auth` já chama `signInWithOAuth({ provider: "google" })`. Falta habilitar no GoTrue.

### 3.1 Google Cloud Console

1. Criar (ou abrir) um projeto Google Cloud.
2. **APIs & Services** → **OAuth consent screen** (External ou Internal, conforme a conta).
3. **Credentials** → **Create OAuth client ID** → tipo **Web application**.
4. **Authorized redirect URIs**:
   - `https://supabase-teste.proh.media/auth/v1/callback`
   - (quando o domínio novo tiver TLS) `https://supabasebeauty.contheiner.digital/auth/v1/callback`
5. Copiar **Client ID** e **Client Secret**.

Não precisa Google Workspace.

### 3.2 Coolify (Auth)

Acrescentar no `.env` do serviço (nomes exatos podem variar levemente conforme a versão da stack; o essencial é habilitar Google no GoTrue):

```text
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=SEU_CLIENT_ID
GOTRUE_EXTERNAL_GOOGLE_SECRET=SEU_CLIENT_SECRET
```

Se a stack Coolify usar outro prefixo de env, alinhar ao `docker-compose` do serviço `supabase-auth` antes de reiniciar.

1. Reiniciar `supabase-auth`.
2. Testar botão Google em `/auth`.
3. Redirect deve voltar para o app em `beauty.contheiner.digital` / localhost.

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

#### Google Agenda

**Não implementado.** A agenda do app é só no banco.

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
- [ ] (Opcional) Google OAuth habilitado e botão funciona  

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
