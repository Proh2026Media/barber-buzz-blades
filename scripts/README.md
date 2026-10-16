# Scripts do projeto

Ferramentas de linha de comando usadas por agentes (Cursor, Codex, Claude Code) e pelo dono. Rodar sempre a partir da raiz do repositório. Regras gerais de trabalho: [AGENTS.md](../AGENTS.md) e [docs/guia/como-trabalhar.md](../docs/guia/como-trabalhar.md).

| Script                                                                       | Para quê                                                           | Quem chama                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------- |
| [vez.sh](#vezsh)                                                             | Só uma ferramenta edita por vez                                    | Agentes, à mão; Cursor pelos ganchos                     |
| [autossave.sh](#autossavesh)                                                 | Salva, envia ao `origin` (publica o site) e devolve a vez          | Agentes ao terminar; Cursor ao fim de cada resposta      |
| [cursor-pretool-vez.sh](#cursor-pretool-vezsh)                               | Bloqueia ferramentas do Cursor sem a vez                           | Só o gancho `preToolUse` do Cursor                       |
| [verificar.sh](#verificarsh)                                                 | Tipos, testes, eslint, prettier e montagem, com resumo             | Agentes antes de enviar                                  |
| [foto.mjs](#fotomjs)                                                         | Foto de uma tela do app no servidor local, com relatório           | Agentes ao mexer em interface                            |
| [banco-local.sh](#banco-localsh)                                             | Cópia local do banco no Docker para testar migrations e testes SQL | Agentes antes de levar migration ao servidor             |
| [copy-pwa.mjs](#copy-pwamjs)                                                 | Copia o service worker para a saída da montagem                    | `npm run build` (automático)                             |
| [sync-shop-domains.sh](#sync-shop-domainssh)                                 | Lista os domínios próprios das barbearias                          | À mão, em operação                                       |
| [sync-traefik-custom-domains.sh](#sync-traefik-custom-domainssh)             | Gera a configuração do Traefik para os domínios próprios           | À mão, no servidor (alternativa manual)                  |
| [cert-loja.sh](#cert-lojash)                                                 | Confere o certificado de cada loja ou grava na hora o que falta    | À mão, do Mac (`ssh vps-barba`)                          |
| [cert-loja-rotina.sh](#cert-loja-rotinash)                                   | Liga, confere ou desliga a rotina do certificado de loja nova      | À mão, do Mac (`ssh vps-barba`)                          |
| [vps/barba-cert-lojas.service e .timer](#vpsbarba-cert-lojasservice-e-timer) | Certificado de loja nova a cada 10 min, sozinho                    | O systemd da VPS (instalados pelo `cert-loja-rotina.sh`) |

---

## vez.sh

**O que faz.** Controla a "vez" entre ferramentas: só quem está com a vez edita o repositório. A vez fica gravada no GitHub, no ramo `vez` do remoto `origin` (arquivo `VEZ` com dono, descrição, máquina, início e última renovação), então vale entre máquinas e pastas diferentes. A gravação é atômica (`git push --force-with-lease` só no ramo `vez`, nunca na `main`).

**Comandos.**

| Comando                                         | Efeito                                                                            | Código de saída                                   |
| ----------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------- |
| `scripts/vez.sh pedir <ferramenta> [descrição]` | Pega a vez se estiver livre, vencida ou já for dessa ferramenta                   | 0 = ficou com a vez; 1 = com outra ou sem conexão |
| `scripts/vez.sh checar <ferramenta>`            | Confirma e renova a vez (pega se estiver livre). Usa um cache local de até 20 min | 0 = a vez é dela                                  |
| `scripts/vez.sh liberar <ferramenta>`           | Devolve a vez (só se for dessa ferramenta)                                        | 0 = liberada ou não era dela                      |
| `scripts/vez.sh status`                         | Mostra quem está com a vez                                                        | 1 = sem conexão                                   |

**Variáveis opcionais.** `VEZ_PRAZO_MIN` (padrão 30: a vez vence sozinha sem renovação), `VEZ_RENOVAR_MIN` (padrão 20: idade máxima do cache do `checar`), `VEZ_REMOTO` (padrão `origin`).

**Quando usar.** No começo de toda rodada de edição e antes de cada edição (regra da seção 9 do [AGENTS.md](../AGENTS.md)).

```bash
git pull --ff-only origin main
scripts/vez.sh pedir claude-code "ajuste na agenda"
scripts/vez.sh checar claude-code   # antes de cada edição; se sair com erro, parar
scripts/vez.sh status
```

---

## autossave.sh

**O que faz.** Fecha a rodada de trabalho de uma ferramenta:

1. confere a vez com `vez.sh checar <ferramenta>` — sem a vez, não salva nada (sai com 0 e avisa);
2. `git add -A`, excluindo `.env`, `.env.*` e arquivos `._*` do macOS;
3. se houver algo, cria o commit `Autossave (<ferramenta>): N arquivo(s)`;
4. se estiver na `main` e houver commits novos, envia ao `origin` (`git push origin HEAD:main`, sem `--force`); se o GitHub recusar, avisa para rodar `git pull --ff-only origin main`;
5. devolve a vez (`vez.sh liberar`).

**Atenção.** Enviar ao `origin` **publica o site** (o fluxo `.github/workflows/sync-instantanea-hub.yml` espelha o `origin` no Hostinger). Rodar [verificar.sh](#verificarsh) antes.

**Quando usar.** Ao terminar o trabalho verificado. No Cursor roda sozinho ao fim de cada resposta (gancho `stop` em [.cursor/hooks.json](../.cursor/hooks.json)).

```bash
scripts/verificar.sh && scripts/autossave.sh claude-code
```

---

## cursor-pretool-vez.sh

**O que faz.** Adaptador do [vez.sh](#vezsh) para o gancho `preToolUse` do Cursor ([.cursor/hooks.json](../.cursor/hooks.json), com `failClosed: true`). Roda `vez.sh checar cursor` e responde em JSON no formato que o Cursor espera: `{"permission":"allow"}` (saída 0) ou `{"permission":"deny", ...}` com a mensagem "BLOQUEADO pela vez" (saída 2).

**Quando usar.** Não se chama à mão. Se o Cursor travar com "BLOQUEADO pela vez", rodar `scripts/vez.sh status` para ver quem está com a vez (ver seção 9 do [AGENTS.md](../AGENTS.md)).

```bash
# Simular o que o Cursor faz:
echo '{}' | bash scripts/cursor-pretool-vez.sh
```

---

## verificar.sh

**O que faz.** Confere o trabalho antes de enviar, nesta ordem:

1. checagem de tipos — `npx tsc --noEmit`;
2. testes — `npm test` (lista de arquivos de teste no [package.json](../package.json));
3. eslint — só nos `.ts`/`.tsx` alterados (com `--tudo`: `eslint .`);
4. prettier `--check` — só nos alterados que ele formata (js, mjs, cjs, jsx, ts, tsx, json, css, html, md, yaml…; com `--tudo`: o projeto todo, respeitando `.prettierignore`);
5. montagem — `npm run build` (pulada com `--sem-build`).

"Alterados" = `git diff --name-only HEAD` + arquivos novos não ignorados (`git ls-files --others --exclude-standard`), sem `._*` e sem arquivos apagados. Funciona com espaço e `&` no caminho (a pasta do projeto tem os dois).

Termina com um resumo por etapa (`ok`, `falhou` ou `pulado`, com o tempo) e sai com **1 se alguma etapa falhou** (2 para opção inválida). Uma falha não interrompe as etapas seguintes, para o resumo mostrar tudo de uma vez.

**Quando usar.** Antes de todo `autossave.sh` (enviar ao `origin` publica o site). Use `--sem-build` durante o trabalho e a versão completa no fim. A montagem grava em `dist/` e `.output/`; em máquina com pouco disco, confira o espaço livre antes.

```bash
scripts/verificar.sh --sem-build   # rápido, durante o trabalho
scripts/verificar.sh               # completo, antes de enviar
scripts/verificar.sh --tudo        # eslint e prettier no projeto inteiro
```

Formatação errada se corrige com `npx prettier --write <arquivo>`.

---

## foto.mjs

**O que faz.** Abre uma página do app no servidor local num navegador sem janela, tira uma foto (PNG) e imprime **uma linha JSON por foto** com o que importa para revisar a tela: largura, rolagem lateral, janelas abertas, textos de dicionário sem tradução e erros do console.

**Quando usar.** Sempre que mexer em interface: para ver a tela de verdade no celular (390 px) e no computador, nos temas claro e escuro, antes de dizer que ficou pronto. Precisa do servidor local de desenvolvimento rodando: `npm run dev -- --port 8090 --host` (8090 é o padrão de `--base`). O `npm run dev` sozinho sobe na 8080; nesse caso, use `--base http://localhost:8080`.

```text
node scripts/foto.mjs <caminho> [mais caminhos...] [opções]
  <caminho>              caminho da página, ex.: "/demo?view=owner" ou "/auth"
  --base <url>           endereço do servidor local (padrão: http://localhost:8090)
  --largura <px>         padrão 390
  --altura <px>          padrão 844
  --escuro               tema escuro do aparelho (prefers-color-scheme: dark)
  --idioma <código>      idioma do app: pt-BR (padrão do app), pt-PT, en-US, en-GB ou es
  --pagina-inteira       foto da página inteira, inclusive a rolagem interna dos painéis
                         (até 8000 px)
  --sem-login            não simula conta (páginas públicas e /auth)
  --passos '<json>'      lista de passos, em ordem (ver abaixo)
  --avaliar '<js>'       expressão avaliada na página; o resultado entra no relatório
  --saida <pasta>        padrão: .fotos (ignorada pelo git)
  --nome <arquivo.png>   padrão: derivado do caminho, da largura e do tema (só com um caminho)
```

Vários caminhos na mesma chamada reaproveitam o navegador (mais rápido); cada um gera sua linha JSON.

**Idioma** (`--idioma`): grava a escolha na chave `arena:locale` do `localStorage` antes de qualquer script do app, a mesma que o seletor de idioma usa (`LOCALE_STORAGE_KEY` em `src/lib/i18n/locale.ts`). Sem a opção, vale o padrão do app (pt-BR). O nome padrão do arquivo ganha o idioma, ex.: `demo-owner-en-US-390-claro.png`. Valor fora da lista encerra com erro.

**Visões da demonstração** (`/demo?view=…`): `platform`, `owner`, `equal`, `minority`, `associate`, `employee`, `customer`.

**Passos** (`--passos`), executados em ordem depois que a página carrega:

| Passo                                 | O que faz                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{"esperar": 1200}`                   | espera N milissegundos                                                                                                                                                                                                                                                                                                                                                                         |
| `{"aba": "Agenda"}`                   | toca no item da barra inferior (`nav.app-mobile-nav`) com esse rótulo; se não achar, lista os rótulos que existem                                                                                                                                                                                                                                                                              |
| `{"clicar": "<seletor>"}`             | clica no primeiro elemento do seletor do Playwright, ex.: `header button:has-text("Parceiro")`                                                                                                                                                                                                                                                                                                 |
| `{"papel": ["tab", "Equipe"]}`        | toca no elemento com esse papel e nome acessível                                                                                                                                                                                                                                                                                                                                               |
| `{"digitar": ["<seletor>", "texto"]}` | preenche o campo                                                                                                                                                                                                                                                                                                                                                                               |
| `{"rolar": 600}`                      | rola a tela N pixels (roda do mouse no centro)                                                                                                                                                                                                                                                                                                                                                 |
| `{"foto": "nome.png"}`                | tira uma foto no meio da sequência, só da parte visível, na mesma pasta da foto final (`--saida`). Sem `.png`, a ferramenta acrescenta; sem nome, vira `passo-<N>.png` (N = posição do passo). Serve para roteiros com várias telas: o estado da `/demo` vive na memória e se perde ao recarregar, então cada tela é fotografada sem sair da página. A foto final continua sendo tirada no fim |
| `{"largura": 320}`                    | muda a largura da janela sem recarregar a página (a altura fica); o estado da demonstração continua. O relatório mede a largura do fim; o nome padrão da foto final continua com a de `--largura`                                                                                                                                                                                              |

**Relatório** (uma linha por foto):

```json
{
  "foto": ".fotos/demo-owner-390-claro.png",
  "larguraTela": 390,
  "larguraConteudo": 390,
  "rolagemLateral": false,
  "janelasAbertas": [],
  "chavesCruas": [],
  "errosConsole": [],
  "avaliacao": null,
  "endereco": "/demo?view=owner"
}
```

| Campo             | Significado                                                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `foto`            | arquivo gerado (`null` se a página não abriu)                                                                                                                               |
| `larguraTela`     | largura da janela                                                                                                                                                           |
| `larguraConteudo` | largura real do conteúdo; maior que a tela = estouro lateral                                                                                                                |
| `rolagemLateral`  | `true` se há rolagem para o lado ou algo passa da borda (`foraDaTela`); defeito no celular                                                                                  |
| `foraDaTela`      | só aparece quando algo passa da borda da tela: até 10 elementos ou textos, com a posição (ex.: `texto "…": de 380 a 412 px`)                                                |
| `janelasAbertas`  | títulos das janelas (`dialog`/`alertdialog`) visíveis                                                                                                                       |
| `chavesCruas`     | textos visíveis com cara de chave de dicionário (ex.: `shop.agenda.today`) — tradução faltando em `src/lib/i18n/`; domínios, e-mails e nomes de arquivo são ignorados       |
| `errosConsole`    | erros do console e exceções da página                                                                                                                                       |
| `avaliacao`       | resultado do `--avaliar`                                                                                                                                                    |
| `endereco`        | endereço final (mostra se a página redirecionou)                                                                                                                            |
| `erro`, `aviso`   | só aparecem quando algo deu errado (passo que falhou, página que não abriu, redirecionamento para `/auth`)                                                                  |
| `bloqueadas`      | só aparece se a página tentou acessar endereços de fora (abortados)                                                                                                         |
| `fotosDosPassos`  | só aparece com passos `foto`: os arquivos tirados no meio da sequência, com caminho relativo à raiz do projeto. As outras checagens do relatório valem só para a foto final |

Código de saída: **0** se a página abriu e os passos rodaram; **1** se não abriu, se o servidor respondeu 400 ou mais, se o app mostrou a tela de página não encontrada, se um passo falhou ou se o `--avaliar` deu erro (a foto do momento é salva mesmo assim).

**Login simulado e rede.** Por padrão a ferramenta simula a conta de um **admin da plataforma sem barbearia** (a `/demo` exige `platform_admin`: `src/routes/demo.tsx` → `requireRole` em `src/lib/auth/guards.ts` → `getSessionProfile` em `src/lib/auth/session.ts`). Ela grava uma sessão falsa na chave `sb-supabasebeauty-auth-token` do `localStorage` (a mesma de `src/integrations/supabase/client.ts`) e responde com dados falsos mínimos **toda** chamada cujo caminho comece com `/auth/v1`, `/rest/v1`, `/functions/v1`, `/storage/v1` ou `/realtime/v1` (perfil e vínculo `platform_admin` para a sessão; listas vazias para o resto). Só o servidor local e o Google Fonts passam; qualquer outro endereço é abortado e o WebSocket do realtime é fechado. **Nenhuma chamada chega ao banco real.** Com `--sem-login` não há sessão falsa (páginas públicas e `/auth`); as chamadas ao Supabase continuam respondidas com dados falsos e vazios. Fora da `/demo` (ex.: `/platform`, `/shop`) as telas abrem, mas vazias, porque não há dados de verdade.

**Requisitos.**

- Playwright (pacote `playwright-core`), procurado nesta ordem: variável `PLAYWRIGHT_CORE` (pasta do pacote); `playwright-core` ou `playwright` instalados no projeto; a versão mais nova dentro de `~/.cursor/extensions/*/dist/node_modules/playwright-core`, `~/.cursor/extensions/*/node_modules/playwright-core` e o mesmo em `~/.vscode/extensions/*`; `$(npm root -g)/playwright-core`. Nada fica fixo numa versão de extensão. Sem Playwright, a ferramenta explica como resolver (ex.: `npm install -g playwright-core`).
- Navegador: variável `CHROME_PATH`; Google Chrome; Microsoft Edge; por último, o chromium do próprio Playwright.

**Exemplos.**

```bash
node scripts/foto.mjs "/demo?view=owner"
node scripts/foto.mjs "/demo?view=owner" --largura 1280 --altura 800 --escuro
node scripts/foto.mjs /auth --sem-login
node scripts/foto.mjs "/demo?view=owner" --passos '[{"aba":"Equipe"},{"esperar":500}]'
node scripts/foto.mjs "/demo?view=owner" --passos '[{"clicar":"header button:has-text(\"Dono\")"}]'
node scripts/foto.mjs "/demo?view=customer" --pagina-inteira --avaliar 'document.title'
node scripts/foto.mjs "/demo?view=customer" --idioma en-US
# Várias telas sem recarregar (o estado da /demo se perde ao recarregar):
node scripts/foto.mjs "/demo?view=owner" --passos '[{"aba":"Agenda"},{"foto":"agenda.png"},{"aba":"Equipe"},{"foto":"equipe-390.png"},{"largura":320},{"foto":"equipe-320.png"}]'
# As sete visões de uma vez:
node scripts/foto.mjs "/demo?view=platform" "/demo?view=owner" "/demo?view=equal" \
  "/demo?view=minority" "/demo?view=associate" "/demo?view=employee" "/demo?view=customer"
```

Para olhar a foto, abrir o PNG (agentes: ferramenta de leitura de imagem). A pasta `.fotos/` é ignorada pelo git; apagar ao terminar (`rm -rf .fotos`), principalmente com pouco disco.

---

## banco-local.sh

Cópia local do banco no Docker deste Mac, para testar migrations e os testes SQL antes de levar ao servidor (nada vai à VPS). Criado em 16/10/2026; o guia de banco dizia que essa cópia "não está documentada".

```bash
open -a Docker                                   # se o Docker estiver desligado
scripts/banco-local.sh subir 20261014120000      # banco igual ao de produção (para na migration indicada)
scripts/banco-local.sh testes supabase/migrations/<nova>.sql   # todos os testes, com a nova na frente
scripts/banco-local.sh parar                     # apaga o container
```

- `subir` usa a imagem `supabase/postgres:15.8.1.085` (~3 GB na primeira vez), completa o que o Auth e o Storage criariam num Supabase completo (colunas de `auth.users`, `auth.identities`, `auth.sessions`, colunas de `storage.buckets/objects`), aplica as migrations em ordem (cada uma em transação) e cria um admin da plataforma fictício (alguns testes usam um).
- `testes` roda cada arquivo de `supabase/tests` dentro de `BEGIN … ROLLBACK` (as cadeias que dependem de `booking_reliability.sql` na mesma transação); `slug_redirects_departure.sql` abre e fecha a própria transação e roda sem as extras. Mostra `ok`/`XX` por arquivo e o total; sai com erro se algo falhou.
- Em 16/10/2026: 96 migrations, 1.074 PASS e 0 FAIL.
- Não substitui o ensaio no servidor (dados reais), mas pega erro de SQL, permissão e regressão antes.

## copy-pwa.mjs

**O que faz.** Depois do `vite build`, copia `sw.js` e os arquivos `workbox-*` de `dist/` para `.output/public/`, para o service worker do app instalável ser servido em produção. Se `dist/` ou `.output/public/` não existir, só avisa e sai com 0.

**Quando usar.** Não precisa chamar à mão: faz parte de `npm run build` e `npm run build:dev` ([package.json](../package.json)). Detalhes do app instalável: [docs/pwa.md](../docs/pwa.md).

```bash
npm run build   # vite build && node scripts/copy-pwa.mjs
```

---

## sync-shop-domains.sh

**O que faz.** Lista, em JSON formatado, os domínios próprios das barbearias pela função do banco `list_active_custom_domains` (criada em `supabase/migrations/20260922150000_shop_custom_domains.sql` e restrita a service role e admin da plataforma em `supabase/migrations/20261003150000_correcoes_auditoria.sql`). Só lê; não muda nada.

**Quando usar.** Em operação, para conferir quais domínios estão ativos ou pendentes antes de mexer no proxy (Traefik/Hostinger). Exige `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente — a chave de service role é secreta: nunca gravar em arquivo do repositório nem colar em conversa.

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... scripts/sync-shop-domains.sh
```

---

## sync-traefik-custom-domains.sh

**O que faz.** Lê os domínios pela mesma função `list_active_custom_domains` e **escreve** o arquivo de configuração dinâmica do Traefik `custom-shop-domains.yaml`, com uma rota HTTP (redireciona para HTTPS) e uma HTTPS (certificado `letsencrypt`) para cada domínio com situação `active`, todas apontando para o serviço `hostinger-beauty-custom`. Sem domínios ativos, grava uma rota de espera inofensiva.

**Variáveis.** Obrigatórias: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (secreta). Opcionais: `TRAEFIK_DYNAMIC_DIR` (padrão `/data/coolify/proxy/dynamic`, a pasta do proxy no servidor do Coolify) e `HOSTINGER_BEAUTY_URL` (padrão `http://beauty.contheiner.digital`).

**Quando usar.** Só como alternativa manual, no servidor, se a sincronização automática dos domínios (função `shop-domain` → domain-manager) falhar — ver [docs/beauty-saas-infra.md](../docs/beauty-saas-infra.md) (Caminho B) e [docs/mb-operacao.md](../docs/mb-operacao.md). Sobrescreve o arquivo de destino.

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... scripts/sync-traefik-custom-domains.sh
```

---

## cert-loja.sh

**O que faz.** Do Mac, roda pela conexão `ssh vps-barba` o [vps/cert-lojas-sync.sh](vps/cert-lojas-sync.sh), sem deixar arquivo na VPS. O script lê as lojas ativas no banco e acrescenta em `/data/coolify/proxy/dynamic/beauty-shop-certs.yaml` só os roteadores de certificado que faltam (nunca remove). Antes de gravar, faz cópia, valida o arquivo e troca de uma vez; no fim, diz se algum endereço ainda recebe o certificado padrão do Traefik.

**Quando usar.** Desde 15/10/2026 a loja nova não depende mais dele: o timer da VPS ([vps/barba-cert-lojas.service e .timer](#vpsbarba-cert-lojasservice-e-timer)) acrescenta o roteador sozinho em até ~10 min (P-27). O `cert-loja.sh` fica para conferir os certificados (a simulação mostra o de cada loja; o timer roda com `--sem-conferir`) ou para aplicar na hora, sem esperar a rodada. Por padrão só simula; `--aplicar` grava. Se coincidir com uma rodada do timer, a trava (`flock`) faz a segunda execução sair sem mexer. Guia, saída esperada e como desfazer: [docs/implantacao-certificado-loja-2026-10-13.md](../docs/implantacao-certificado-loja-2026-10-13.md).

```bash
scripts/cert-loja.sh             # simula: mostra o que faltaria e o certificado de cada loja
scripts/cert-loja.sh --aplicar   # grava os que faltam e confere o certificado
```

---

## cert-loja-rotina.sh

**O que faz.** Do Mac, cuida pela conexão `ssh vps-barba` da rotina automática do certificado de loja nova (P-27): um timer do systemd na VPS que roda o [vps/cert-lojas-sync.sh](vps/cert-lojas-sync.sh) a cada 10 minutos ([próxima seção](#vpsbarba-cert-lojasservice-e-timer)). Não usa o crontab do root nem `/etc/cron.d`.

| Comando                                | Efeito                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/cert-loja-rotina.sh status`   | Padrão, também sem argumento. Mostra se o timer está ligado (`Timer: enabled / active`), a próxima rodada, o resultado da última (`Última rodada: success (código 0)`) e até 20 linhas do registro da última hora. Sem o timer: "Rotina não instalada."                                                                                                                                                                                                         |
| `scripts/cert-loja-rotina.sh instalar` | Envia por `scp` os três arquivos de `vps/` para uma pasta temporária da VPS (permissão 700), confere a sintaxe (`bash -n`), instala o script em `/usr/local/sbin/barba-cert-lojas-sync.sh` (root, 0750) e as unidades em `/etc/systemd/system/` (root, 0644), confere as unidades (`systemd-analyze verify`), roda `daemon-reload` e `enable --now` do timer, mostra a próxima rodada e apaga a pasta temporária. Também serve para atualizar: instala por cima |
| `scripts/cert-loja-rotina.sh desligar` | `disable --now` do timer, apaga as duas unidades e roda `daemon-reload`. O script em `/usr/local/sbin` fica                                                                                                                                                                                                                                                                                                                                                     |

Outro argumento mostra o uso e sai com código 2.

**Variável opcional.** `VPS_SSH` (padrão `vps-barba`, o apelido SSH desta máquina).

**Quando usar.** **Já instalado em 15/10/2026.** `status` a qualquer hora, para conferir. `instalar` só quando `vps/cert-lojas-sync.sh` (ou uma das unidades) mudar: a VPS roda a cópia instalada, não o repositório. O SHA-256 conferido na passagem de 15/10 é `6a5f2944…3ddd` (completo na seção 6.4 do guia); se o do arquivo local continua igual, não reinstalar. `desligar` só por decisão do dono (ex.: cadastros falsos gastando a cota do Let's Encrypt). Nunca criar `/etc/cron.d/barba-cert-lojas` nem recriar o proxy do Coolify. Guia: [docs/implantacao-certificado-loja-2026-10-13.md](../docs/implantacao-certificado-loja-2026-10-13.md), seção 6.

```bash
scripts/cert-loja-rotina.sh                    # o mesmo que status
shasum -a 256 scripts/vps/cert-lojas-sync.sh   # antes de reinstalar: comparar com o da passagem
scripts/cert-loja-rotina.sh instalar           # só se vps/cert-lojas-sync.sh mudou
scripts/cert-loja-rotina.sh desligar
```

---

## vps/barba-cert-lojas.service e .timer

**O que fazem.** Unidades do systemd que rodam na VPS, sozinhas, o certificado de loja nova (P-27). Não se chamam à mão: o [cert-loja-rotina.sh](#cert-loja-rotinash) copia e liga.

| Arquivo                                                      | Instalado em                                   | O que tem                                                                                                                                                                                        |
| ------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [vps/barba-cert-lojas.timer](vps/barba-cert-lojas.timer)     | `/etc/systemd/system/barba-cert-lojas.timer`   | `OnCalendar=*:0/10` (minutos 00, 10, 20… de cada hora), `RandomizedDelaySec=30`, `Persistent=false` (não recupera rodada perdida), `WantedBy=timers.target`                                      |
| [vps/barba-cert-lojas.service](vps/barba-cert-lojas.service) | `/etc/systemd/system/barba-cert-lojas.service` | `Type=oneshot`, `ExecStart=/usr/local/sbin/barba-cert-lojas-sync.sh --aplicar --sem-conferir`, `SyslogIdentifier=barba-cert-lojas`, `Nice=10`, `TimeoutStartSec=180`, depois do `docker.service` |
| [vps/cert-lojas-sync.sh](vps/cert-lojas-sync.sh)             | `/usr/local/sbin/barba-cert-lojas-sync.sh`     | o script que o serviço roda (o mesmo do [cert-loja.sh](#cert-lojash))                                                                                                                            |

**Quando usar.** Mudou um dos três arquivos? Rodar `scripts/cert-loja-rotina.sh instalar`; senão a VPS continua com a versão antiga. Registro: `journalctl -t barba-cert-lojas` (na VPS) ou `scripts/cert-loja-rotina.sh status` (do Mac).
