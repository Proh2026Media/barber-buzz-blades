# Fluxo completo — beauty.contheiner.digital

## Visão geral do fluxo (requisição de slug.beauty.contheiner.digital)

```
Usuário
  └─► DNS: slug.beauty.contheiner.digital
        └─► Cloudflare (nameservers: april.ns.cloudflare.com / kianchau.ns.cloudflare.com)
              └─► Registro wildcard: *.beauty → 187.127.60.78 (DNS only, sem proxy)
                    └─► VPS (187.127.60.78) — Coolify + Traefik
                          └─► wildcard-beauty.yaml (roteador Traefik)
                                └─► Hostinger shared hosting
                      └─► beauty.contheiner.digital (TanStack Start)
                            └─► browser: resolve_shop_by_host(hostname)
```

---

## 1. DNS — Cloudflare

**Domínio registrado:** Hostinger (contheiner.digital)
**Nameservers apontados para:** Cloudflare (free plan)
**Por que Cloudflare e não Hostinger?** O dns-parking.com (Hostinger) aceita registros wildcard na UI mas não os serve para sub-zonas — registros `*.beauty` eram silenciosamente ignorados. Cloudflare free suporta wildcard em sub-zonas corretamente.

### Registros ativos no Cloudflare:

| Nome | Tipo | Valor | Proxy |
|---|---|---|---|
| `*.beauty` | A | 187.127.60.78 | DNS only (cinza) |
| `supabasebeauty` | A | 187.127.60.78 | DNS only |
| `evolutionapi` | A | 187.127.60.78 | DNS only |
| `beauty` | MX (pri 10) | mx1.titan.email | DNS only |
| `beauty` | MX (pri 20) | mx2.titan.email | DNS only |
| `beauty` | TXT | v=spf1 include:spf.titan.email ~all | DNS only |
| `_dmarc.beauty` | TXT | v=DMARC1; p=none | DNS only |
| `titan1._domainkey.beauty` | TXT | v=DKIM1; k=rsa; p=MIGf... | DNS only |

**Regra crítica:** registros que vão para o VPS (187.127.60.78) DEVEM ser "DNS only" (nuvem cinza), nunca proxied. O Traefik precisa terminar o TLS diretamente — se proxied, o Cloudflare intercepta o TLS e o Let's Encrypt do Traefik quebra.

---

## 2. VPS — Coolify + Traefik (187.127.60.78)

**Plataforma:** Coolify (self-hosted, gerencia o Traefik como proxy reverso)
**Arquivo de configuração dinâmica:** `wildcard-beauty.yaml`

### wildcard-beauty.yaml (Dynamic Configuration no Coolify):

```yaml
http:
  routers:
    wildcard-beauty-http:
      rule: HostRegexp(`.+\.beauty\.contheiner\.digital`)
      entryPoints: [http]
      middlewares: [redirect-to-https]
      service: hostinger-beauty
      priority: 10
    wildcard-beauty-https:
      rule: HostRegexp(`.+\.beauty\.contheiner\.digital`)
      entryPoints: [https]
      service: hostinger-beauty
      tls:
        certResolver: letsencrypt
      priority: 10
  services:
    hostinger-beauty:
      loadBalancer:
        passHostHeader: false   # ← envia o host original no X-Forwarded-Host
        servers:
          - url: "http://beauty.contheiner.digital"
```

**O que faz:** qualquer subdomínio `*.beauty.contheiner.digital` é capturado, TLS é encerrado pelo Traefik (certificado wildcard via Let's Encrypt), e a requisição é encaminhada para o Hostinger.

**`passHostHeader: false`** é essencial: faz o Traefik enviar `Host: beauty.contheiner.digital` para o Hostinger (que só conhece esse hostname), mas preserva o host original no header `X-Forwarded-Host: slug.beauty.contheiner.digital` — que é o que o Nuxt usa para identificar o tenant.

---

## 3. Hostinger — app Barba & Cabelo (TanStack Start)

**URL interna:** beauty.contheiner.digital (shared hosting)
**Framework:** TanStack Start / React (não Nuxt)

**Tenant:** o browser resolve a barbearia com `src/lib/shop/host.ts` → RPC `resolve_shop_by_host` (subdomínio `{slug}.beauty…` **e** domínio próprio com status `active`). Não usar middleware Nuxt `tenant.ts` nem `/lookup` do domain-manager no app.

**Domínio próprio (ops):** a Edge Function `shop-domain` chama o domain-manager no servidor:

- `POST /add` `{ domain, slug }` ao salvar / após verificar DNS
- `DELETE /remove` `{ domain }` ao remover

Envs só no Coolify: `DOMAIN_MANAGER_URL`, `DOMAIN_MANAGER_API_KEY`.

---

## 4. E-mail — Titan Mail (beauty@contheiner.digital)

Configurado via registros DNS na Cloudflare apontando para o Titan:
- MX → mx1/mx2.titan.email
- SPF → spf.titan.email
- DKIM → titan1._domainkey.beauty (chave RSA configurada)
- DMARC → p=none (monitoramento)

---

## Caminho B — Domínios personalizados por barbearia

**Status no app (22/09/2026):** banco/UI + Edge Function `shop-domain` (set/clear/verify → domain-manager `/add` `/remove`).

**Ops pendente:**
1. `beauty.contheiner.digital` precisa de registro **A** na Cloudflare apontando para o **IP da Hostinger** (shared hosting), senão o Traefik devolve **502** nos subdomínios.
2. Colocar `DOMAIN_MANAGER_URL` + `DOMAIN_MANAGER_API_KEY` nas envs das Edge Functions no Coolify e fazer deploy de `shop-domain`.
3. Incluir o domínio em `ADDITIONAL_REDIRECT_URLS` do Auth se login/OAuth for usado nesse host.
4. Fallback manual: `scripts/sync-traefik-custom-domains.sh`.