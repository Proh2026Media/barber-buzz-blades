# Transição para a próxima IA — Barba & Cabelo

Atualizado em **03/10/2026**. Este documento resume decisões e entregas da conversa anterior; conferir o código antes de alterar comportamentos.

## Comece aqui

1. Ler `AGENTS.md`, `docs/mb-interface.md` e este documento. Para e-mail Titan, SMTP Coolify, login Google, Agenda/Contatos e domínio da API: [mb-operacao.md](mb-operacao.md).
2. Inspecionar `git status` e os arquivos relevantes ao próximo pedido. O workspace tem muitas alterações e arquivos não rastreados que compõem o aplicativo; **não descartar nem sobrescrever esse trabalho**.
3. Para retomar localmente, usar `npm run dev -- --host 0.0.0.0 --port 8080`. O endereço esperado é `http://localhost:8080`.
4. Continuar a partir do próximo pedido do usuário.

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
