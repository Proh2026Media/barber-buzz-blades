# Banco, servidores e publicação

Guia de retomada para agentes de código (Cursor, Codex, Claude Code) e para o dono. Escrito em 12/10/2026 a partir do código, do git e dos documentos citados. O registro detalhado de cada entrega continua em [CONTINUIDADE.md](../CONTINUIDADE.md); aqui fica o mapa.

Situações usadas: **feito**, **feito — falta aplicar no banco**, **pendente**, **a decidir**, **não confirmado**.

**Horários:** os commits estão em -0300 (`git log`). O CONTINUIDADE marca horários com "PT" sem dizer o fuso; pelos registros de 03/10/2026, esse "PT" equivale a -03, o horário de Brasília (dedução, não confirmado). Indícios: a implantação das "17:44 PT" usou o commit `2223949` (17:32 -0300), e o backup `backup-barba-cabelo-20261003-2233.dump`, nomeado pelo relógio da VPS, é dado como "19:33 PT" (3 h de diferença, como se a VPS estivesse em UTC). Aqui os horários "PT" aparecem como no CONTINUIDADE.

> Nunca copie para documentos, commits ou relatórios: senhas, chaves, tokens, conteúdo do `.env`. Nomes de variáveis podem aparecer; valores não.

## Índice

1. [Visão da infraestrutura](#1-visão-da-infraestrutura)
2. [Como o site é publicado](#2-como-o-site-é-publicado)
3. [Inventário das 87 migrations](#3-inventário-das-87-migrations)
4. [Como escrever uma migration nova](#4-como-escrever-uma-migration-nova)
5. [Como as migrations são aplicadas](#5-como-as-migrations-são-aplicadas)
6. [Testes SQL](#6-testes-sql)
7. [Edge functions](#7-edge-functions)
8. [Tarefas agendadas (cron) e manutenção](#8-tarefas-agendadas-cron-e-manutenção)
9. [Segredos (só nomes)](#9-segredos-só-nomes)
10. [Domínios e certificados](#10-domínios-e-certificados)
11. [E-mail, WhatsApp e Google](#11-e-mail-whatsapp-e-google)
12. [O que falta aplicar no servidor](#12-o-que-falta-aplicar-no-servidor)

---

## 1. Visão da infraestrutura

| Peça                                                                                    | Onde roda                                                                                                                                              | Endereço                                                                                                    | Fonte                                                                                                                                                        |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Site (React + TanStack Start, compilado pelo Vite)                                      | Hostinger (hospedagem compartilhada), rodando como servidor Node (seção 2)                                                                             | `https://beauty.contheiner.digital`                                                                         | [beauty-saas-infra.md](../beauty-saas-infra.md) §3; [vite.config.ts](../../vite.config.ts)                                                                   |
| Supabase auto-hospedado (Postgres, Auth/GoTrue, REST, Storage, Realtime, Kong, funções) | VPS Hostinger, gerenciada pelo **Coolify** (projeto `barba-cabelo`, serviço `supabase-barba-cabelo`, sufixo dos containers `z2dbb7dkyzhc8vjiywq34mhn`) | API: `https://supabase-barbearia.proh.media` e `https://supabasebeauty.contheiner.digital` (mesmo servidor) | Endereços: CONTINUIDADE "Endereço do servidor mudou" (29/09/2026). Nomes no Coolify: [mb-operacao.md](../mb-operacao.md) "Contas e IDs" (ver o aviso abaixo) |
| Proxy reverso e certificados                                                            | Traefik do Coolify, na mesma VPS                                                                                                                       | —                                                                                                           | [beauty-saas-infra.md](../beauty-saas-infra.md) §2                                                                                                           |
| WhatsApp                                                                                | Evolution API no Coolify (projeto `evolution-api`)                                                                                                     | `https://evolutionapi.contheiner.digital`                                                                   | [mb-operacao.md](../mb-operacao.md) §5                                                                                                                       |
| E-mail do sistema                                                                       | SMTP da Hostinger                                                                                                                                      | —                                                                                                           | CONTINUIDADE "Endereço do servidor mudou" (item de 02/10/2026)                                                                                               |

- O painel do Coolify e o IP da VPS estão na tabela do topo de [supabase/README.md](../../supabase/README.md) e em [mb-operacao.md](../mb-operacao.md) ("Contas e IDs"). O Coolify só abre pela rede Tailscale.
- **Aviso — trechos desatualizados nessas fontes:** três trechos ainda dão `supabase-teste.proh.media` como endereço em uso e `supabasebeauty.contheiner.digital` como alvo à espera de DNS: a tabela do Coolify no topo de `supabase/README.md` (linhas 13–14), as variáveis do app no mesmo arquivo (linhas 99–104) e a tabela "Contas e IDs" de mb-operacao.md. Ignore essas linhas: os endereços certos estão na tabela acima. Também não use o bloco "Para reaplicar / outro ambiente" do README (linhas 200–205: `scp` + `psql -f`, sem `-1` e sem backup); aplique pelo procedimento da [seção 5](#5-como-as-migrations-são-aplicadas).
- **`supabase-teste.proh.media` não é mais deste projeto**: desde 29/09/2026 leva a outro serviço (Flow TEST). Não usar. O host `*.supabase.co` antigo (nuvem Lovable) está morto; `supabase/config.toml` ainda guarda o `project_id` dele, sem uso conhecido. Fonte: CONTINUIDADE (29/09/2026 e "Diagnóstico do login em produção", 21/09/2026).
- O Studio não tem domínio público; acesso por túnel SSH, conforme [supabase/README.md](../../supabase/README.md) ("Studio").
- Serviços do Supabase em 02/10/2026: `meta`, `studio` e `supavisor` religados com `unless-stopped`; `analytics`, `vector` e `imgproxy` desligados de propósito. O `realtime` foi religado às ~18h de 02/10/2026 (a entrada das 12h30 o dava como desligado). Fonte: CONTINUIDADE (02/10/2026).
- **Não usar "Redeploy" do serviço no Coolify sem necessidade.** Ele recria todos os containers do serviço a partir da configuração salva no Coolify e desfaz o que só estiver no `docker-compose.yml` do servidor. Desde 13/10/2026 a configuração salva tem, no `realtime-dev`, `restart: unless-stopped` e limite de 0,5 CPU / 512 MB, iguais ao arquivo do servidor (P-25; CONTINUIDADE, entrega de 13/10). Para mexer num container só: `docker compose -p z2dbb7dkyzhc8vjiywq34mhn -f docker-compose.yml up -d --no-deps <serviço>` na pasta do serviço, depois de conferir com `--dry-run` que só ele muda. Fonte: CONTINUIDADE "Regras de agendamento numa fonte só" (02/10/2026) e [implantacao-2026-10-03.md](../implantacao-2026-10-03.md), regra 5.
- A VPS **não tem credencial de push** no GitHub. O agente da VPS devolve o relatório e outra máquina registra no CONTINUIDADE. Fonte: CONTINUIDADE "Implantação aplicada em produção" (03/10/2026).

## 2. Como o site é publicado

```
git push origin main            (Proh2026Media/barber-buzz-blades — fonte da verdade)
  └─► .github/workflows/sync-instantanea-hub.yml
        └─► dispara hub-espelho.yml em PROH-Media/hub-control
              └─► espelha origin no remoto "hostinger" (PROH-Media/barber-buzz-blades)
                    └─► a Hostinger compila e publica beauty.contheiner.digital (~1 min)
```

- O fluxo [sync-instantanea-hub.yml](../../.github/workflows/sync-instantanea-hub.yml) roda a cada push na `main` (e à mão, por `workflow_dispatch`). Só age se o repositório for `Proh2026Media/barber-buzz-blades`. Usa o segredo de Actions `HUB_DISPATCH_TOKEN`. Se falhar, abre a issue "Gatilho de sincronizacao parado" no próprio repositório. Segundo o comentário do arquivo, existe ainda uma rede de segurança por cron no hub, a cada 2 horas.
- O fluxo [sync-instantanea.yml](../../.github/workflows/sync-instantanea.yml) **não publica**: ele avisa `Proh2026Media/backup-control` (`backup-multi.yml`, "cofre" de backup) com o segredo `BLINDAGEM_TOKEN`.
- Remotos locais: `origin` → `Proh2026Media/barber-buzz-blades`; `hostinger` → `PROH-Media/barber-buzz-blades` (conferido com `git remote -v`).
- **Nunca enviar só ao `hostinger`**: o espelho copia o `origin` por cima e desfaz a publicação. Foi o que tirou entregas do ar em 29/09/2026 (CONTINUIDADE "Vez entre ferramentas + incidente de envio forçado").
- **Nunca usar `git push --force`** na `main` de nenhum remoto ([AGENTS.md](../../AGENTS.md), seção 9).
- O envio normal é feito por [scripts/autossave.sh](../../scripts/autossave.sh) `<ferramenta>`: confere a vez, faz commit sem `.env` nem `._*`, envia ao `origin` e devolve a vez. Antes de enviar, rodar `scripts/verificar.sh` (ver [como-trabalhar.md](como-trabalhar.md) e [scripts/README.md](../../scripts/README.md)).
- **O site não é estático: roda como servidor Node.** A montagem usa o Nitro com `preset: "node-server"` ([vite.config.ts](../../vite.config.ts), linhas 16–24) e gera a pasta `.output/`; depois, [scripts/copy-pwa.mjs](../../scripts/copy-pwa.mjs) copia o service worker (`sw.js` e `workbox-*`) de `dist/` para `.output/public`. **Não trocar o preset:** sem ele vale o padrão do Lovable, `cloudflare-module`, que gera um worker que o Node da Hostinger não roda (503, segundo o comentário do arquivo; preset fixado no commit `a57017f`, 21/09/2026).
- No navegador, o site usa `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`, gravadas **na hora da compilação**. Trocar o endereço da API exige ajustar essas variáveis no painel da Hostinger e recompilar; variáveis sem prefixo não substituem as `VITE_*` no navegador. Fonte: CONTINUIDADE "Diagnóstico do login em produção" (21/09/2026).
- No servidor (SSR), [src/integrations/supabase/client.ts](../../src/integrations/supabase/client.ts) (linhas 39–41) usa `process.env.SUPABASE_URL` e `process.env.SUPABASE_PUBLISHABLE_KEY` como reserva quando as `VITE_*` faltam. [auth-middleware.ts](../../src/integrations/supabase/auth-middleware.ts) (linhas 36–37) e `client.server.ts` leem só variáveis sem prefixo, mas nenhum arquivo de `src/` os importa hoje (conferido com `grep` em 12/10/2026). Se essas variáveis estão configuradas no painel da Hostinger: **não confirmado**.
- O comando de compilação configurado na Hostinger é **não confirmado** (o projeto define `npm run build` = `vite build && node scripts/copy-pwa.mjs` em `package.json`).
- **Publicar o site não aplica nada no banco nem nas funções.** Migrations e Edge functions vão à VPS por outro caminho (seções 5 e 7). Por isso a tela nova precisa funcionar com o banco antigo (ver seção 4).

## 3. Inventário das 91 migrations

Pasta: [supabase/migrations/](../../supabase/migrations/). A situação vem destas fontes:

- **[A]** [supabase/README.md](../../supabase/README.md) ("Migrations") e CONTINUIDADE "Varredura de saúde — tela × banco × servidor" (29/09/2026): "as 66 migrations do repositório têm tabelas/colunas/funções/gatilhos presentes no banco" (as 66 primeiras da lista).
- **[B]** Entradas do CONTINUIDADE de 29/09/2026 e de 02/10/2026 a 03/10/2026 que marcam "(aplicada)", e [implantacao-2026-10-03.md](../implantacao-2026-10-03.md), que parte de "75 migrations já aplicadas em produção".
- **[C]** CONTINUIDADE "Implantação aplicada em produção — entregas de 03/10/2026" (03/10/2026, 17:44 PT, com o repositório em `2223949`).
- **[D]** CONTINUIDADE "Entrega — cadastro de cliente e dono…" (aplicada em 03/10/2026, 19:34 PT, com o HEAD `ddf9fbb`).
- **[E]** CONTINUIDADE "ajustes finais", "decisões do dono aplicadas" e "tempo de preparo", mais os guias [implantacao-ajustes-finais-2026-10-03.md](../implantacao-ajustes-finais-2026-10-03.md), [implantacao-decisoes-2026-10-03.md](../implantacao-decisoes-2026-10-03.md) e [implantacao-preparo-2026-10-05.md](../implantacao-preparo-2026-10-05.md). Não há registro de aplicação depois de 05/10/2026.
- **[F]** CONTINUIDADE "Aplicação da noite de 13/10 e Loja Teste" (13/10/2026): as cinco pelo guia [implantacao-noite-2026-10-13.md](../implantacao-noite-2026-10-13.md), entre 15:12:47 e 15:12:55 (horário de Brasília), com backup e ensaio de 144 PASS.

| #   | Arquivo                                                      | Para que serve                                                                               | Situação                                                   |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | `20260914222150_foundation_multi_tenant`                     | Barbearias, perfis, vínculos (`memberships`) e RLS base                                      | aplicada [A]                                               |
| 2   | `20260914231500_shop_catalog`                                | Serviços e profissionais; semente da Arena Barber                                            | aplicada [A]                                               |
| 3   | `20260914233000_appointments`                                | Agendamentos, sem sobreposição por profissional                                              | aplicada [A]                                               |
| 4   | `20260914234500_loyalty`                                     | Pontos de fidelidade e conta criada no cadastro                                              | aplicada [A]                                               |
| 5   | `20260915120000_booking_reliability`                         | Intervalos ocupados sem dados de outros clientes; bloqueia reserva no passado                | aplicada [A]                                               |
| 6   | `20260915143000_customer_booking_management`                 | Remarcação atômica pelo cliente; histórico com nomes preservados                             | aplicada [A]                                               |
| 7   | `20260915160000_shop_availability`                           | Funcionamento semanal, dias fechados e bloqueios                                             | aplicada [A]                                               |
| 8   | `20260916100000_customer_insights`                           | Preferências opcionais, pesquisas e indicadores por papel                                    | aplicada [A]                                               |
| 9   | `20260916120000_privacy_requests`                            | Exportar a própria conta e fila de pedidos de exclusão                                       | aplicada [A]                                               |
| 10  | `20260916140000_post_service_surveys`                        | Avaliação depois do atendimento concluído                                                    | aplicada [A]                                               |
| 11  | `20260916160000_cancellation_reasons`                        | Cancelamento atômico com motivo opcional                                                     | aplicada [A]                                               |
| 12  | `20260916180000_aggregate_insights`                          | Médias agregadas, com amostra mínima de 5                                                    | aplicada [A]                                               |
| 13  | `20260916200000_service_interest_survey`                     | Pergunta sobre interesse em novos serviços                                                   | aplicada [A]                                               |
| 14  | `20260916220000_service_interest_insights`                   | Distribuição agregada desse interesse                                                        | aplicada [A]                                               |
| 15  | `20260916240000_staff_recorded_surveys`                      | Respostas presenciais registradas pela equipe                                                | aplicada [A]                                               |
| 16  | `20260916260000_shop_settings`                               | Identidade exibida, instruções e horizonte da agenda                                         | aplicada [A]                                               |
| 17  | `20260916280000_enforce_shop_survey_setting`                 | Interruptor de pesquisas valendo também no banco                                             | aplicada [A]                                               |
| 18  | `20260916300000_optional_occurrences`                        | Atrasos opcionais e falta confirmada                                                         | aplicada [A]                                               |
| 19  | `20260916320000_shop_sports_module`                          | Módulo Esportes por loja (desligado por padrão)                                              | aplicada [A]                                               |
| 20  | `20260916340000_auto_confirm_bookings`                       | Confirmação automática de reservas                                                           | aplicada [A]                                               |
| 21  | `20260916360000_guard_sports_module`                         | Só o admin da plataforma liga Esportes                                                       | aplicada [A]                                               |
| 22  | `20260916380000_reschedule_requested_status`                 | Novo valor de enum (aplicar em transação separada)                                           | aplicada [A]                                               |
| 23  | `20260916400000_release_withdrawn_booking`                   | Retirar confirmação libera o horário na hora                                                 | aplicada [A]                                               |
| 24  | `20260916500000_slot_waiting`                                | Espera opcional por horário (`slot_waits`)                                                   | aplicada [A]                                               |
| 25  | `20260916520000_shop_branding`                               | Identidade visual por loja e bucket de logos                                                 | aplicada [A]                                               |
| 26  | `20260916530000_shop_branding_font_and_svg`                  | Fonte escolhida e logo SVG seguro                                                            | aplicada [A]                                               |
| 27  | `20260916540000_platform_admin_branding_storage`             | Admin da plataforma gerencia logos                                                           | aplicada [A]                                               |
| 28  | `20260916550000_shop_custom_brand_font`                      | Fonte própria enviada pela loja                                                              | aplicada [A]                                               |
| 29  | `20260916560000_shop_custom_font_family`                     | Família de fonte com vários arquivos                                                         | aplicada [A]                                               |
| 30  | `20260916570000_brand_font_face_and_storage_mime`            | Face exata da fonte no cabeçalho; MIME `octet-stream`                                        | aplicada [A]                                               |
| 31  | `20260916580000_brand_corner_style`                          | Modo de cantos (retos, semi, arredondados)                                                   | aplicada [A]                                               |
| 32  | `20260917120000_shop_team_governance`                        | Papéis profissionais, sociedade e links diretos                                              | aplicada [A]                                               |
| 33  | `20260917130000_team_provisioning`                           | Plataforma vincula conta ao profissional em transação                                        | aplicada [A]                                               |
| 34  | `20260917140000_service_icons`                               | Ícone do serviço e bucket                                                                    | falhou no remoto; efeito aplicado pela nº 41 (nota abaixo) |
| 35  | `20260917150000_shop_role_permissions`                       | Matriz de permissões por papel                                                               | aplicada [A]                                               |
| 36  | `20260917160000_shop_permissions_self_read`                  | Cada membro lê as próprias permissões                                                        | aplicada [A]                                               |
| 37  | `20260917170000_shop_permission_money_semantics`             | Separa `view_money` de `view_financial_all`                                                  | aplicada [A]                                               |
| 38  | `20260917180000_partner_tools`                               | Carteira, clientes e ritmo do parceiro                                                       | aplicada [A]                                               |
| 39  | `20260917190000_client_directory`                            | Diretório de clientes com escopo por papel                                                   | aplicada [A]                                               |
| 40  | `20260918020000_logo_background_and_associate_branding`      | Fundo da logo; parceiro edita a marca                                                        | aplicada [A]                                               |
| 41  | `20260920010000_service_images_storage`                      | Corretiva das imagens de serviço e Storage                                                   | aplicada [A]                                               |
| 42  | `20260920020000_floating_chrome`                             | Cabeçalho e rodapé flutuantes (opção visual)                                                 | aplicada [A]                                               |
| 43  | `20260920030000_public_auth_branding`                        | Marca da loja antes do login (RPC pública)                                                   | aplicada [A]                                               |
| 44  | `20260920040000_login_visuals`                               | Modelos fotográficos do login; RPC v2                                                        | aplicada [A]                                               |
| 45  | `20260922010000_whatsapp_evolution`                          | Canal WhatsApp por loja, fila de saída, OTP                                                  | aplicada [A]                                               |
| 46  | `20260922140000_slug_redirects_and_departure`                | Slugs automáticos, redirecionamentos e saída da loja                                         | aplicada [A]                                               |
| 47  | `20260922150000_shop_custom_domains`                         | Subdomínio e domínio próprio por loja                                                        | aplicada [A]                                               |
| 48  | `20260923120000_preserve_domain_verify_token`                | Mantém o token TXT ao salvar o mesmo domínio                                                 | aplicada [A]                                               |
| 49  | `20260923121000_domain_cname_target_instructions`            | Alvo do CNAME do domínio próprio                                                             | aplicada [A]                                               |
| 50  | `20260923140000_google_calendar_contacts`                    | Conexões Google (Agenda e Contatos)                                                          | aplicada [A]                                               |
| 51  | `20260923160000_multi_shop_loyalty`                          | Pontos por loja; entrar em loja nova pelo link                                               | aplicada [A]                                               |
| 52  | `20260923180000_booking_slug_manual_and_externa`             | Slug do profissional editável                                                                | aplicada [A]                                               |
| 53  | `20260924120000_platform_signup_otp`                         | OTP do cadastro de dono sem loja                                                             | aplicada [A]                                               |
| 54  | `20260924140000_service_description_staff_media`             | Descrição do serviço; foto e bio do profissional                                             | aplicada [A]                                               |
| 55  | `20260924150000_whatsapp_message_templates`                  | Modelos de mensagem por loja                                                                 | aplicada [A]                                               |
| 56  | `20260924160000_recurrence_notices_email_links`              | Link da reserva, fila de e-mail, avisos e séries                                             | aplicada [A]                                               |
| 57  | `20260924170000_account_manager_and_expired_enums`           | Valores de enum (precisam de commit antes do uso)                                            | aplicada [A]                                               |
| 58  | `20260924180000_governance_notices_partners_account_manager` | Avisos pendentes, co-dono, sugestões, gerente de conta                                       | aplicada [A]                                               |
| 59  | `20260924190000_delete_my_account`                           | Exclusão da própria conta                                                                    | aplicada [A]                                               |
| 60  | `20260925120000_google_selected_calendar`                    | Agenda Google escolhida pelo usuário                                                         | aplicada [A]                                               |
| 61  | `20260925140000_shop_society_founder_and_team`               | Fundador, equipe e sociedade pelo dono                                                       | aplicada [A]                                               |
| 62  | `20260925160000_whatsapp_templates_and_calendar_choice`      | Modelos oficiais do WhatsApp                                                                 | aplicada [A]                                               |
| 63  | `20260929130000_google_calendar_push`                        | Cópia dos agendamentos para a Agenda Google                                                  | aplicada [A]                                               |
| 64  | `20260929150000_email_outbox_recovery`                       | Fila de e-mail que se recupera e tenta de novo                                               | aplicada [A]                                               |
| 65  | `20260929170000_guard_own_professional_rows`                 | Parceiro/Contratado editam as próprias linhas                                                | aplicada [A]                                               |
| 66  | `20260929180000_request_shop_change_single`                  | Remove versão duplicada de `request_shop_change`                                             | aplicada [A]                                               |
| 67  | `20260929190000_public_branding_font_weight_type`            | Corrige tipo que quebrava a marca no login                                                   | aplicada [B]                                               |
| 68  | `20261002100000_drop_reset_externa`                          | Remove a função de uso único da Externa                                                      | aplicada [B]                                               |
| 69  | `20261002105000_restore_function_grants`                     | Reaplica os `REVOKE`/`GRANT` perdidos na cópia do banco                                      | aplicada [B]                                               |
| 70  | `20261002110000_loyalty_program_module`                      | Clube de pontos como módulo por loja                                                         | aplicada [B]                                               |
| 71  | `20261002120000_public_shop_landing`                         | Página pública da barbearia                                                                  | aplicada [B]                                               |
| 72  | `20261002170000_public_shop_landing_team_cards`              | Cartões por profissional na página pública                                                   | aplicada [B]                                               |
| 73  | `20261002190000_booking_rules_single_source`                 | Regras de agendamento numa fonte só; sinais de disponibilidade                               | aplicada [B]                                               |
| 74  | `20261002210000_slot_offer_mode`                             | Forma de oferecer horários por loja                                                          | aplicada [B]                                               |
| 75  | `20261003130000_fix_hours_replace`                           | Corrige gravação do funcionamento pelo painel                                                | aplicada [B]                                               |
| 76  | `20261003150000_correcoes_auditoria`                         | Correções da auditoria de 03/10/2026 (inclui saída da loja)                                  | aplicada [C]                                               |
| 77  | `20261003160000_otp_tentativas`                              | Limite de tentativas de código OTP                                                           | aplicada [C]                                               |
| 78  | `20261003170000_pendencias_edge_whatsapp`                    | Mensagem longa do WhatsApp cortada, não descartada                                           | aplicada [C]                                               |
| 79  | `20261003180000_verificar_whatsapp_perfil`                   | WhatsApp do perfil confirmado por código                                                     | aplicada [C]                                               |
| 80  | `20261003190000_google_tokens_e_eventos`                     | Tokens do Google fora da API; lista de eventos                                               | aplicada [C]                                               |
| 81  | `20261003200000_cadastro_aceite`                             | Aceite dos termos, nome e WhatsApp no cadastro                                               | aplicada [D]                                               |
| 82  | `20261003210000_slugify_acentos`                             | `slugify_pt` sem trocar letras acentuadas                                                    | aplicada [D]                                               |
| 83  | `20261003220000_ajustes_finais`                              | Apagar loja inteira; `save_my_whatsapp`; limpeza de OTP                                      | aplicada em 13/10/2026 [F]                                 |
| 84  | `20261003230000_decisoes_whatsapp_fuso`                      | Aviso só a WhatsApp confirmado; fuso por loja                                                | aplicada em 13/10/2026 [F]                                 |
| 85  | `20261005120000_tempo_preparo`                               | Tempo de preparo entre atendimentos                                                          | aplicada em 13/10/2026 [F]                                 |
| 86  | `20261013120000_regras_papel_banco`                          | Contratado sem levar clientes; bloqueios de colegas sem nome/motivo; donos para a plataforma | aplicada em 13/10/2026 [F]                                 |
| 87  | `20261013150000_antecedencia_minima`                         | Antecedência mínima para o cliente reservar (padrão 30 min)                                  | aplicada em 13/10/2026 [F]                                 |
| 88  | `20261013180000_papeis_atuais_e_fuso`                        | Fuso rápido; `list_pending_shop_changes` volátil; 19 funções pelos papéis da equipe          | aplicada em 13/10/2026 [G]                                 |
| 89  | `20261013190000_saida_equipe_reservas`                       | Reconvite, reativação, reservas de quem sai, liberação do Parceiro; `apply_*` fechadas       | aplicada em 13/10/2026 [G]                                 |
| 90  | `20261013200000_saida_aguarde_dono`                          | Mensagem "Aguarde a liberação do dono" ao concluir a saída                                   | aplicada em 13/10/2026 [G]                                 |
| 91  | `20261013210000_convite_boas_vindas_papeis`                  | Link de convite, boas-vindas, primeiro dono, cartão existente, bloqueio e foto próprios      | aplicada em 13/10/2026 [H]                                 |
| 92  | `20261013220000_pausa_semanal`                               | Pausa fixa semanal: regra que gera bloqueios por 120 dias; `list_shop_blocks` com `rule_id`  | aplicada em 13/10/2026 [I]                                 |
| 93  | `20261013230000_guia_loja_e_emails`                          | Guia da loja no banco (`shop_setup_guides`) e e-mails para o admin da plataforma             | aplicada em 13/10/2026 [J]                                 |

Nota da nº 34: no banco remoto ela falhava em `text = uuid`, e por isso a coluna `icon` e o bucket não existiam. A nº 41 (`20260920010000_service_images_storage`) cria o mesmo efeito e foi aplicada; o arquivo da nº 34 também recebeu o cast correto (`barbershop_id::text`) para instalações novas. Fonte: CONTINUIDADE "Slider da espera e imagens de serviço" (20/09/2026).

Ordem em que foram aplicadas (13/10/2026): 83 → 84 → 85 → 86 → 87, e depois 88 → 89 (16:42) e 90 (17:06, [G] = [implantacao-equipe-saida-2026-10-13.md](../implantacao-equipe-saida-2026-10-13.md)) e 91 (17:50, [H] = [implantacao-convite-papeis-2026-10-13.md](../implantacao-convite-papeis-2026-10-13.md)) e 92 (18:01, [I] = [implantacao-pausa-semanal-2026-10-13.md](../implantacao-pausa-semanal-2026-10-13.md)) e 93 (18:08, [J] = [implantacao-guia-e-emails-2026-10-13.md](../implantacao-guia-e-emails-2026-10-13.md)). A 85 recria `apply_shop_change` a partir da versão da 84. A 86 não depende delas (recria `request_shop_departure` a partir da nº 76, já aplicada). A 87 depende da 85 (recria `available_slots_internal`, `appointments_enforce_service_terms` e `apply_shop_change` a partir das versões dela). Guia único das cinco: [implantacao-noite-2026-10-13.md](../implantacao-noite-2026-10-13.md).

## 4. Como escrever uma migration nova

Regras tiradas das migrations recentes e dos incidentes registrados no CONTINUIDADE.

1. **Nome:** `supabase/migrations/AAAAMMDDHHMMSS_nome_curto.sql`, com data posterior à última (`20261013210000` em 13/10/2026). Os nomes recentes estão em pt-BR (`tempo_preparo`, `ajustes_finais`).
2. **Cabeçalho:** comentário em pt-BR dizendo o problema, a regra e de qual migration cada função foi copiada (padrão de `20261003150000_correcoes_auditoria.sql` e `20261005120000_tempo_preparo.sql`).
3. **Idempotente:** os guias exigem que a migration possa ser reaplicada sem erro. Usar `add column if not exists`, `create or replace function`, `drop policy if exists` antes de `create policy` e `drop trigger if exists` antes de `create trigger`.
4. **Partir da versão mais recente da função.** Antes de recriar uma função, achar a última migration que a define (`grep -l "function public.<nome>" supabase/migrations/*.sql | tail -1`). Recriar a partir de versão antiga desfaz correções.
5. **`security definer` sempre com `set search_path = public`** (padrão de todas as funções da `20261005120000`).
6. **Permissões explícitas no fim do arquivo:** `revoke all on function … from public, anon, authenticated;` e depois `grant execute` só para quem usa. No Postgres, função nova nasce executável por `PUBLIC`. Em 02/10/2026 descobriu-se que a cópia do banco para o stack novo tinha perdido os `REVOKE`s: funções com privilégio elevado, inclusive filas internas, estavam liberadas para visitantes anônimos. A `20261002105000_restore_function_grants.sql` corrigiu isso (CONTINUIDADE "Entrega — clube de pontos…", 02/10/2026, e cabeçalho da própria migration). A data da cópia não está registrada.
7. **RLS em toda tabela nova** (`enable row level security` + políticas). Tabela sensível sem `SELECT` para `anon`/`authenticated` (exemplo: `google_connections` desde a `20261003190000`).
8. **Armadilhas já vividas:**
   - duas versões da mesma função com argumentos diferentes → a API responde `PGRST203` (29/09/2026); ao mudar assinatura, apagar a antiga;
   - tipo de retorno diferente do tipo da coluna (`smallint` × `integer`) → erro `42804` (29/09/2026);
   - variável PL/pgSQL com o nome de uma coluna → `column reference "status" is ambiguous` (03/10/2026); usar prefixo `v_`;
   - valor novo de enum precisa de commit antes do uso → migration separada (`20260924170000`, `20260916380000`).
9. **A tela precisa funcionar antes da migration.** O site publica sozinho e o banco vem depois. Exemplo: o campo de preparo só aparece quando a coluna `prep_minutes` chega do banco (CONTINUIDADE, 05/10/2026).
10. **Tipos do front:** atualizar [src/integrations/supabase/types.ts](../../src/integrations/supabase/types.ts) junto com a migration. Não há banco acessível daqui para gerar os tipos automaticamente (nem script para isso no `package.json`), então na prática a edição é manual (dedução; o CONTINUIDADE de 05/10/2026 só cita o arquivo).
11. **Teste novo** em `supabase/tests/<nome>.sql` (seção 6) e **guia de implantação** `docs/implantacao-<tema>-AAAA-MM-DD.md`, no modelo dos existentes: pré-requisitos, backup, ensaio com a contagem de `PASS` esperada, aplicação, conferência de privilégios com a saída esperada e relatório.
12. Registrar no CONTINUIDADE com "migration pendente na VPS" até o agente da VPS confirmar.

## 5. Como as migrations são aplicadas

O banco não tem pipeline automático: as migrations são aplicadas à mão com `psql` dentro do container do Postgres (nenhum documento do projeto usa a Supabase CLI para isso). Quem aplica é o **agente com acesso à VPS** (no registro de 03/10/2026, o Grok), seguindo um guia `docs/implantacao-*.md`. O procedimento-mãe é [implantacao-2026-10-03.md](../implantacao-2026-10-03.md):

1. `git pull --ff-only origin main` e conferir o commit.
2. Achar os containers: `DB` (`supabase-db-z2dbb7dkyzhc8vjiywq34mhn`) e `FN` (funções).
3. **Backup:** `docker exec "$DB" pg_dump -U postgres -d postgres -Fc > /root/backup-barba-cabelo-$STAMP.dump`, com tamanho maior que zero. Sem backup, não seguir.
4. **Diagnóstico:** conferir com `pg_proc`/`information_schema` o que já existe (evita aplicação parcial).
5. **Ensaio:** migrations + testes dentro de `BEGIN … ROLLBACK`, via `docker exec -i "$DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1`. Qualquer `ERROR` ou `FAIL:` → parar e relatar; não consertar a migration no servidor.
6. **Aplicar uma por vez**, cada uma em transação (`psql … -1 < arquivo.sql`). Se falhar, parar.
7. `NOTIFY pgrst, 'reload schema';`
8. **Conferir privilégios** com `has_function_privilege`/`has_table_privilege` (saída esperada escrita no guia).
9. Publicar funções, se houver (seção 7), e fazer o teste de fumaça.
10. Relatório ao dono, sem segredos. Outra máquina registra no CONTINUIDADE.

**Desfazer:** não existe "down". Funções voltam do backup da pasta. O banco só volta com `pg_restore` do dump, **com autorização explícita do dono**, porque apaga o que foi gravado depois.

**Incidente de 03/10/2026, 17:19 PT** (CONTINUIDADE "Incidente — teste rodado fora de transação"): `loyalty_program_module.sql` foi rodado no banco de produção **sem** `BEGIN`. Parou em `Not allowed`, porque o usuário simulado por `set_config(..., true)` só vale dentro da transação, e deixou uma loja de teste com 5 usuários `@example.invalid`. A limpeza esbarrou no gatilho `validate_shop_ownership` e foi feita pelo script de [supabase/manutencao/](../../supabase/manutencao/) (seção 8). Lição: **nunca rodar um arquivo de `supabase/tests/` sozinho no servidor.**

## 6. Testes SQL

- Pasta [supabase/tests/](../../supabase/tests/): 34 arquivos `.sql` e 1 script Python (`waiting_concurrency.py`).
- **Ensaio no próprio banco de produção a partir desta máquina (13/10/2026):** o Mac do dono tem o apelido SSH `vps-barba` para a VPS. Funciona mandar o arquivo pela entrada padrão: `{ echo 'BEGIN;'; cat <migration> <teste>; echo 'ROLLBACK;'; } | ssh vps-barba 'docker exec -i supabase-db-z2dbb7dkyzhc8vjiywq34mhn psql -U postgres -d postgres -X -v ON_ERROR_STOP=1'`. Serve **só** para consulta de leitura e ensaio desfeito; aplicar continua com o agente da VPS ou com autorização do dono. Ao encadear vários testes numa transação, pôr entre eles `reset role; select set_config('request.jwt.claim.sub','',true);` (sem isso o teste seguinte roda como o usuário simulado pelo anterior). Ensaio com `add column` trava a tabela até o `ROLLBACK` (71 s no ensaio das três pendentes): evitar horário de movimento.
- **Formato:** o arquivo não abre nem fecha transação. Ele cria dados com UUIDs aleatórios, simula o usuário com `set_config('request.jwt.claim.sub', <id>, true)` + `set local role authenticated` e chama uma função `pg_temp` que faz `raise notice 'PASS: …'` ou `raise exception 'FAIL: …'` (exemplo: `tempo_preparo.sql`).
- **Rodar sempre assim** (na VPS; `DB` = container do Postgres):

  ```bash
  { echo 'BEGIN;'
    cat supabase/migrations/<migration_nova>.sql   # só se ela ainda não estiver aplicada
    cat supabase/tests/<teste>.sql
    echo 'ROLLBACK;'
  } | docker exec -i "$DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 2>&1 | grep -E 'PASS|FAIL|ERROR|ROLLBACK'
  ```

- **Cadeias:** estes rodam depois de `booking_reliability.sql`, na mesma transação, porque usam a tabela `booking_test_context` criada por ele: `aggregate_insights`, `cancellation_reasons`, `customer_insights`, `optional_occurrences`, `post_service_surveys`, `privacy_requests`, `service_interest_insights`, `service_interest_survey`, `slot_waiting`, `staff_recorded_surveys`. O `auto_confirmation_modules` roda depois de `booking_reliability` **e** `optional_occurrences` (cabeçalho de cada arquivo).
- **Exceções conhecidas:**
  - `privacy_requests.sql` precisa da coluna `auth.users.phone` (existe em produção; numa cópia local sem GoTrue, rodar como `supabase_admin`);
  - `correcoes_auditoria.sql` foi ajustado para valer antes e depois da `20261003180000` (CONTINUIDADE 03/10/2026).
- **Na máquina local (conferido em 12/10/2026):**
  - `psql`, `pg_dump` e `deno`: ausentes;
  - `docker` (Docker Desktop) e a Supabase CLI (`supabase` 2.119.0): instalados, mas o daemon do Docker estava parado ("Cannot connect to the Docker daemon");
  - antes de baixar a imagem `supabase/postgres:15.8.1.085`, conferir o espaço livre no disco interno do Mac, onde fica o disco do Docker Desktop (98% ocupado, ~11 GB livres em 12/10/2026);
  - a Supabase CLI não serve para aplicar migrations neste projeto: [supabase/config.toml](../../supabase/config.toml) só guarda o `project_id` da nuvem Lovable antiga, cujo endereço não resolve mais (CONTINUIDADE "Diagnóstico do login em produção", 21/09/2026).
- As entregas de 03/10/2026 e 05/10/2026 foram validadas numa cópia local com a imagem `supabase/postgres:15.8.1.085`, mas o passo a passo dessa cópia **não está documentado** (não confirmado).
- `python3 supabase/tests/waiting_concurrency.py` testa concorrência real da espera ([supabase/README.md](../../supabase/README.md), "Espera opcional por horário").
- Testes do front (`npm test`, `node --test` com a lista do `package.json`) são outra coisa: rodam pelo `scripts/verificar.sh`.

## 7. Edge functions

Código em [supabase/functions/](../../supabase/functions/) (Deno), com código comum em `_shared/` (`dns.ts`, `domain-manager.ts`, `evolution.ts`, `google.ts`).

| Função                     | O que faz                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `auth-otp`                 | Códigos por WhatsApp (recuperar senha, confirmar número)                                                                       |
| `register-shop`            | Cadastro de dono e loja com OTP pelo WhatsApp da plataforma                                                                    |
| `platform-whatsapp`        | Status/QR do WhatsApp da plataforma (só `platform_admin`)                                                                      |
| `whatsapp-channel`         | Conectar o WhatsApp de uma loja (QR)                                                                                           |
| `whatsapp-dispatch`        | Roda as rotinas periódicas do banco, dispara e-mail e Agenda Google e envia a fila do WhatsApp (detalhe logo abaixo da tabela) |
| `email-dispatch`           | Envia a fila `email_outbox` por SMTP                                                                                           |
| `google-connect`           | Conectar Google, listar e escolher agenda, importar eventos, revogar                                                           |
| `google-calendar-dispatch` | Copia agendamentos para a Agenda Google                                                                                        |
| `invite-shop-admin`        | Convite de pessoa para a equipe: link de entrada, e-mail pela fila, cartão existente (senha temporária só como reserva)        |
| `shop-invite`              | Página do convite (`/convite`): mostra loja e papel e entra pelo link enquanto a conta não tem senha própria (sem sessão)      |
| `shop-domain`              | Domínio próprio: salvar, remover, verificar (chama o domain-manager)                                                           |
| `domain-verify`            | Versão antiga só de verificação; preferir `shop-domain`                                                                        |

**O que `whatsapp-dispatch` faz a cada chamada** (o cron do host a chama a cada minuto, seção 8; código em [index.ts](../../supabase/functions/whatsapp-dispatch/index.ts), a partir da linha 25):

1. roda `process_whatsapp_reminders` (lembretes), `extend_booking_series` (séries recorrentes), `process_pending_client_notices` (avisos pendentes) e `expire_shop_change_requests` (vencimento dos pedidos de mudança da sociedade);
2. uma vez por hora (no minuto 17, em UTC), roda `purge_auth_otp_challenges`. Pelos registros, chamada e função ainda não estão no servidor: a chamada entrou no commit `d94d678` e a função vem na migration nº 83 (seção 12). No minuto 23 roda `extend_availability_block_rules` (pausas fixas semanais, migration nº 92), que mantém 120 dias de bloqueios gerados;
3. dispara `email-dispatch` e `google-calendar-dispatch`;
4. pega até 20 itens da fila `whatsapp_outbox` (`claim_whatsapp_outbox`, linha 79) e envia pela Evolution API.

O código não confere o resultado dos passos 1 a 3.

**Como publicar** (passo 7 de [implantacao-2026-10-03.md](../implantacao-2026-10-03.md)):

1. Descobrir a pasta montada no container de funções (`docker inspect "$FN"`, destino `/home/deno/functions`). Segundo [supabase/README.md](../../supabase/README.md), fica em `/data/coolify/services/z2dbb7dkyzhc8vjiywq34mhn/volumes/functions/`.
2. Backup da pasta (`cp -a`).
3. `rsync -a --delete --exclude '._*' supabase/functions/<fn>/ "$VOL/<fn>/"`, só das funções da entrega.
4. `docker restart "$FN"`: **só** o container de funções; nunca banco, Kong, Auth, REST ou Storage.
5. `docker logs --tail 80 "$FN"` sem erro de inicialização; `OPTIONS` em `/functions/v1/<fn>` responde 200/204.

Não há Deno na máquina local: as funções não são compiladas antes de subir, só passam por eslint (CONTINUIDADE 03/10/2026).

## 8. Tarefas agendadas (cron) e manutenção

Ficam no **cron do host da VPS** (`/etc/cron.d/`). Não é `pg_cron`: nenhuma migration usa `cron.schedule`.

| Arquivo no servidor                    | Frequência    | O que roda                                                                                                                                                              | No repositório?                                                     |
| -------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `/etc/cron.d/barba-slot-waiting`       | a cada minuto | `select public.process_slot_waits();` via `docker exec` no Postgres; falha vai ao syslog `barba-slot-waiting`                                                           | sim: [supabase/slot-waiting.cron](../../supabase/slot-waiting.cron) |
| `/etc/cron.d/barba-whatsapp-dispatch`  | a cada minuto | chama a função `whatsapp-dispatch` em `supabase-barbearia.proh.media` (em 29/09/2026 trocada do endereço antigo; cópia em `/root/barba-whatsapp-dispatch.bak-20260929`) | não                                                                 |
| `/etc/cron.d/barba-insights-retention` | diária        | `purge_customer_usage()` (eventos opcionais com mais de 90 dias)                                                                                                        | não ([customer-insights.md](../customer-insights.md))               |

- **Se `barba-whatsapp-dispatch` parar, não para só o WhatsApp:** param também os lembretes, os avisos pendentes, a extensão das séries recorrentes, o vencimento dos pedidos de mudança da sociedade, o envio de e-mails e as cópias para a Agenda Google, porque tudo isso roda dentro de `whatsapp-dispatch` (seção 7). Foi o que aconteceu em 29/09/2026, quando a tarefa chamava o endereço antigo (CONTINUIDADE "Endereço do servidor mudou": "WhatsApp, e-mail e Google parados").
- Ao mover o banco ou trocar o nome do container, reinstalar as três tarefas e ajustar o nome do container.
- **A decidir (dono):** o crontab do root chama a cada 15 min uma função `google-drive/share-expire` que não existe neste projeto (erros 500 inofensivos). Provavelmente é de outro projeto; não remover sem confirmação (CONTINUIDADE "Varredura de saúde", 29/09/2026).
- [supabase/manutencao/2026-10-03_limpeza_fixture_loyalty.sql](../../supabase/manutencao/2026-10-03_limpeza_fixture_loyalty.sql): limpeza do incidente de 03/10/2026, **já executada** (`LIMPEZA OK`, `COMMIT`; CONTINUIDADE 03/10/2026, 17:44 PT). Rodar de novo aborta sem apagar nada. Serve de modelo para scripts de manutenção: conferir contagens antes, abortar se algo não bater e conferir de novo antes do `COMMIT`.

## 9. Segredos (só nomes)

Os valores ficam no Coolify, na Hostinger, no GitHub ou no `.env` local (rastreado no git desde o Lovable, só com variáveis públicas: nunca ponha chave secreta nele; o `autossave.sh` não envia as alterações locais). Para conferir se uma variável existe sem mostrar o valor, use o laço do passo 7.4 de [implantacao-2026-10-03.md](../implantacao-2026-10-03.md).

| Onde                                          | Variáveis                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edge functions (Coolify)                      | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `APP_URL`, `SITE_URL`, `PLATFORM_BASE_HOST`, `PLATFORM_EVOLUTION_INSTANCE`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `AUTHENTICATION_API_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL`, `SMTP_SENDER_NAME`, `GOTRUE_SMTP_*` (reserva), `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_OAUTH_STATE_SECRET`, `GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID`, `GOTRUE_EXTERNAL_GOOGLE_SECRET`, `DOMAIN_MANAGER_URL`, `DOMAIN_MANAGER_API_KEY`, `DOMAIN_CNAME_TARGETS` (lidos com `Deno.env.get` no código) |
| Auth/serviço Supabase (Coolify)               | `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL`, `SERVICE_URL_SUPABASEKONG`, `SERVICE_SUPABASEANON_KEY`, `GOTRUE_SITE_URL`, `GOTRUE_URI_ALLOW_LIST`, `ADDITIONAL_REDIRECT_URLS`, `GOTRUE_SMTP_*`, `GOTRUE_EXTERNAL_GOOGLE_*`, `GOTRUE_MAILER_TEMPLATES_*`, `GOTRUE_MAILER_SUBJECTS_*`, `ENABLE_EMAIL_AUTOCONFIRM` (citados no CONTINUIDADE e em [mb-operacao.md](../mb-operacao.md))                                                                                                                                                                                                                                                                                                                  |
| Compilação do site (Hostinger) e `.env` local | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, `VITE_PLATFORM_BASE_HOST`, `VITE_APP_ORIGIN`; o `.env` local também tem `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID`                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Scripts de domínio                            | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TRAEFIK_DYNAMIC_DIR`, `HOSTINGER_BEAUTY_URL`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| GitHub Actions (`origin`)                     | `HUB_DISPATCH_TOKEN`, `BLINDAGEM_TOKEN`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

- O `.env` do serviço já voltou sozinho a uma base antiga uma vez (29/09/2026), apagando as variáveis do Google, `APP_URL` e `PLATFORM_EVOLUTION_INSTANCE`. Há cópias `.env.bak-*` na pasta do serviço no servidor (CONTINUIDADE "Endereço do servidor mudou").
- `PLATFORM_EVOLUTION_INSTANCE` ausente → login e confirmação por WhatsApp respondem "indisponível"; não inventar valor.

## 10. Domínios e certificados

Fontes: [beauty-saas-infra.md](../beauty-saas-infra.md), [mb-operacao.md](../mb-operacao.md) §4 e §5c, CONTINUIDADE "Domínios por barbearia" (22/09/2026) e "Domínio público + slug do barbeiro" (23/09/2026, com nota de 02/10/2026).

| Endereço                                                              | Caminho                                                                                                                                                           |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `beauty.contheiner.digital`                                           | Site na Hostinger (raiz: página da plataforma)                                                                                                                    |
| `<slug>.beauty.contheiner.digital`                                    | DNS curinga `*.beauty` → VPS → Traefik (`wildcard-beauty.yaml`) → Hostinger, com `passHostHeader: false`; o navegador acha a loja pela RPC `resolve_shop_by_host` |
| Domínio próprio da loja                                               | TXT + CNAME pelo dono em Ajustes; a função `shop-domain` chama o domain-manager (`POST /add`, `DELETE /remove`)                                                   |
| `supabase-barbearia.proh.media` / `supabasebeauty.contheiner.digital` | API do Supabase (Kong)                                                                                                                                            |
| `evolutionapi.contheiner.digital`                                     | Evolution API                                                                                                                                                     |

- **Certificado dos subdomínios de loja:** o roteador curinga (`HostRegexp`) não emite certificado por host (o Traefik entregava o "TRAEFIK DEFAULT CERT"). Em 02/10/2026 foi criado `/data/coolify/proxy/dynamic/beauty-shop-certs.yaml`, com um roteador `Host(...)` por loja (arena-barber, externabarbearia). **Ao criar loja nova, acrescentar o roteador dela nesse arquivo** (pendente de automação; hoje é manual).
- Registros que apontam para a VPS precisam ser "DNS only" (sem proxy), senão o Let's Encrypt do Traefik quebra.
- [scripts/sync-shop-domains.sh](../../scripts/sync-shop-domains.sh): lista os domínios próprios ativos/pendentes pela RPC `list_active_custom_domains` (precisa de `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente).
- [scripts/sync-traefik-custom-domains.sh](../../scripts/sync-traefik-custom-domains.sh): reserva manual que gera `custom-shop-domains.yaml` na pasta dinâmica do Traefik (padrão `/data/coolify/proxy/dynamic`) com um roteador por domínio próprio ativo, apontando para a Hostinger. Roda na VPS.
- **Domínio próprio não precisa entrar em `ADDITIONAL_REDIRECT_URLS` do Auth.** Num endereço de loja (subdomínio ou domínio próprio), o login com Google abre um pop-up no endereço principal (`beauty…`), cujo retorno já está liberado, e os links de e-mail (recuperar senha, confirmar cadastro) também voltam pelo endereço principal (`platformOAuthCallbackUrl` e `buildPlatformAuthUrl` em [src/lib/auth/return-origin.ts](../../src/lib/auth/return-origin.ts), usados em [src/routes/auth.tsx](../../src/routes/auth.tsx)). Manter na lista `https://beauty.contheiner.digital/**` e `https://*.beauty.contheiner.digital/**`. Fontes: [mb-operacao.md](../mb-operacao.md) §5c; CONTINUIDADE "Auth no domínio da loja" (23/09/2026). O item 3 do "Caminho B" de [beauty-saas-infra.md](../beauty-saas-infra.md) (22/09/2026) ainda manda incluir o domínio na lista: está superado.
- **Não confirmado:** quem responde o DNS de `contheiner.digital` hoje. [beauty-saas-infra.md](../beauty-saas-infra.md) diz Cloudflare (registros `*.beauty`, `supabasebeauty`, `evolutionapi`); [mb-operacao.md](../mb-operacao.md) (23/09/2026) diz Hostinger `dns-parking`. A seção 4 de mb-operacao ("DNS A pendente" para `supabasebeauty`) está desatualizada: desde 30/09/2026 o retorno do Google usa `supabasebeauty…/auth/v1/callback` (CONTINUIDADE, item de 02/10/2026).

## 11. E-mail, WhatsApp e Google

| Assunto                          | Situação conhecida                                                                                                                                                                                                                           | Onde ler                                                                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| E-mail do sistema                | Desde 02/10/2026: SMTP da Hostinger, remetente `noreply@contheiner.digital`; Titan abandonado. Auth e funções usam a mesma credencial. Modelos do Auth em pt-BR em `public/email/*.html`, publicados no site e ligados por `GOTRUE_MAILER_*` | CONTINUIDADE "Endereço do servidor mudou" (02/10/2026). [mb-operacao.md](../mb-operacao.md) §1–2 ainda descreve o Titan (desatualizado)              |
| WhatsApp                         | Evolution API, uma instância por loja + instância da plataforma (`PLATFORM_EVOLUTION_INSTANCE`) para OTP do cadastro; fila `whatsapp_outbox` enviada a cada minuto                                                                           | [mb-operacao.md](../mb-operacao.md) §5 e §5d                                                                                                         |
| Google (login, Agenda, Contatos) | Cliente OAuth do projeto Google Cloud `proh-media-drive`; a verificação do Google vale para ele. Calendar API e People API ativadas                                                                                                          | CONTINUIDADE "Google — projeto real do app" (03/10/2026); [google-verificacao.md](../google-verificacao.md) (reenvio da verificação, tarefa do dono) |

## 12. O que falta aplicar no servidor

**Nada pendente das migrations escritas.** Última migration aplicada em produção: **`20261013210000_convite_boas_vindas_papeis`** (13/10/2026, 17:50:22 horário de Brasília; backup `/root/backup-barba-cabelo-20261013-205006.dump`; funções `invite-shop-admin` e `shop-invite` publicadas às 17:50 e 17:53; guia [implantacao-convite-papeis-2026-10-13.md](../implantacao-convite-papeis-2026-10-13.md)). Antes dela, `20261013200000_saida_aguarde_dono` (17:06:09; backup `/root/backup-barba-cabelo-20261013-2006.dump`; seção 8 do guia [implantacao-equipe-saida-2026-10-13.md](../implantacao-equipe-saida-2026-10-13.md)). Antes dela, `20261013190000_saida_equipe_reservas` (16:42:55; backup `/root/backup-barba-cabelo-20261013-1942.dump`), `20261013180000_papeis_atuais_e_fuso` (16:42:50) e **`20261013150000_antecedencia_minima`** (15:12:54). As cinco abaixo foram aplicadas nessa data pelo guia único [implantacao-noite-2026-10-13.md](../implantacao-noite-2026-10-13.md), a partir do Mac do dono pelo acesso `ssh vps-barba`: backup `/root/backup-barba-cabelo-20261013-1811.dump` (1,2 MB), ensaio de 144 PASS desfeito, aplicação 15:12:47–15:12:55, conferências iguais às esperadas e as funções `google-connect`, `whatsapp-dispatch`, `register-shop` e `invite-shop-admin` publicadas às 15:13 (cópia das antigas em `/root/functions-backup-20261013-1811`). Detalhes no CONTINUIDADE (entrega de 13/10, "Aplicação da noite"). Os itens ficam como histórico.

1. **Migration `20261003220000_ajustes_finais.sql`** + funções **`google-connect`** e **`whatsapp-dispatch`**. Guia: [implantacao-ajustes-finais-2026-10-03.md](../implantacao-ajustes-finais-2026-10-03.md) (ensaio: 25 PASS; privilégios `f|f|f`). A última publicação de funções registrada no CONTINUIDADE (03/10/2026, 19:34 PT) usou o HEAD `ddf9fbb`. Depois dele só mudaram `google-connect` e `whatsapp-dispatch` (`d94d678`) e `register-shop` (`08732f5`); confira com `git diff --stat ddf9fbb HEAD -- supabase/functions`. Pelos registros de 02/10/2026 e 03/10/2026, as demais funções no servidor estão iguais às do repositório (dedução, não confirmado).
2. **Migration `20261003230000_decisoes_whatsapp_fuso.sql`** + função **`register-shop`** (mudou em `08732f5`, 03/10/2026 20:32 -0300). Guia: [implantacao-decisoes-2026-10-03.md](../implantacao-decisoes-2026-10-03.md) (ensaio: 43 PASS; `f|t|2`). Antes de aplicar, anotar quantos clientes deixam de receber WhatsApp até confirmar o número. O guia pede também para **relatar**, sem desligar, se o Auth tem o servidor OAuth 2.1 apontando para `/.lovable/oauth/consent`.
3. **Migration `20261005120000_tempo_preparo.sql`** (sem funções). Guia: [implantacao-preparo-2026-10-05.md](../implantacao-preparo-2026-10-05.md) (pré-requisito `t|t`; ensaio: 43 PASS; conferência `0|0|f|f`). Até ela, salvar o tempo de preparo não funciona (o campo fica escondido).
4. **Migration `20261013120000_regras_papel_banco.sql`** + função **`invite-shop-admin`** (marca de senha temporária). Guia: [implantacao-regras-papel-2026-10-13.md](../implantacao-regras-papel-2026-10-13.md) (ensaio: 19 PASS, já feito em produção em 13/10; conferência `f|t|f|3`).
5. **Migration `20261013150000_antecedencia_minima.sql`** (sem funções; depende do item 3). Ao aplicar, todas as lojas passam a exigir 30 minutos de antecedência. Ensaio: 14 PASS (cópia da estrutura, 13/10); conferência `0|f|f|f|t`.
6. **Registrado** no CONTINUIDADE em 13/10/2026.

Em 13/10/2026 uma consulta de leitura confirmou que os itens 1 a 3 continuam fora do banco (`f|f|f`), e o ensaio encadeado dos três deu 111 PASS sem deixar nada gravado. Na mesma data, numa cópia da estrutura do banco num container temporário da VPS (já removido), a cadeia dos cinco itens com os testes deu 144 PASS, e os cinco seguidos dos testes de agenda, 131 PASS.

Pendências de servidor que não são migration prontas:

- **Feito (13/10/2026, P-25):** `restart: unless-stopped` e limite de 0,5 CPU / 512 MB do `realtime-dev` gravados na configuração salva do Coolify e no arquivo do servidor; só o `realtime-dev` foi recriado; realtime conferido antes e depois (CONTINUIDADE, entrega de 13/10).
- **Pendente:** dar à VPS um acesso de push ao GitHub, ou manter o registro por outra máquina (CONTINUIDADE 03/10/2026).
- **Feito em parte (13/10/2026, P-27):** roteador de certificado por loja nova em `beauty-shop-certs.yaml` (seção 10) com um comando: `scripts/cert-loja.sh` (simula por padrão; `--aplicar` grava). Guia: [implantacao-certificado-loja-2026-10-13.md](../implantacao-certificado-loja-2026-10-13.md). Falta decidir a automação (cron).
- **A decidir (P-67):** `PLATFORM_BASE_HOST` do container das funções vale `dominios.beauty.contheiner.digital`; a `invite-shop-admin` contorna. Corrigir no ambiente do Coolify exige janela autorizada.
- **Feito (13/10/2026):** P-56, P-57 e P-58, nas migrations 88 e 89.
- **A decidir:** tarefa `google-drive/share-expire` no crontab do root (seção 8).
- **Feito (13/10/2026):** os itens de banco do plano de ambientes (bloqueio e foto próprios do Contratado, convite aguardando, primeiro dono, convite com link e boas-vindas) entraram na migration 91. Ainda sem migration: P-10 (pausa semanal) e P-20 (guia da loja no banco). Prioridade em [pendencias.md](pendencias.md).

Veja também: [LEIA-PRIMEIRO.md](../LEIA-PRIMEIRO.md) · [arquitetura.md](arquitetura.md) · [papeis-e-permissoes.md](papeis-e-permissoes.md) · [como-trabalhar.md](como-trabalhar.md) · [historico.md](historico.md)
