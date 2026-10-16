# Como trabalhar neste projeto — manual para agentes de IA

Manual de operação para o agente que vai continuar o Barba & Cabelo, principalmente o **Agent do Cursor**. Vale também para Claude Code, Codex e outros. Atualizado em **12/10/2026**; seções 4.1 e 7 revistas em 15/10/2026.

Porta de entrada: [../LEIA-PRIMEIRO.md](../LEIA-PRIMEIRO.md). Regras persistentes: [../../AGENTS.md](../../AGENTS.md). Diário de entregas: [../CONTINUIDADE.md](../CONTINUIDADE.md).

## Índice

1. [Antes de começar](#1-antes-de-começar) — puxar, pegar a vez, ganchos do Cursor
2. [Durante o trabalho](#2-durante-o-trabalho) — idioma, dicionários, /mb, capacidades, demonstração, segredos
3. [Verificação](#3-verificação) — `scripts/verificar.sh`, comandos manuais, fotos das telas
4. [Ao terminar](#4-ao-terminar) — registrar, atualizar pendências, autossave (= publicar), envio recusado
5. [Banco de dados](#5-banco-de-dados) — migration e teste aqui; aplicação na VPS
6. [Trabalho com o dono](#6-trabalho-com-o-dono)
7. [Armadilhas conhecidas](#7-armadilhas-conhecidas)

Resumo em uma linha: **puxe → pegue a vez → trabalhe em pt-BR → verifique (tipos, testes, fotos) → registre → autossave**.

---

## 1. Antes de começar

### 1.1 Puxar o código

```bash
git pull --ff-only origin main
```

Se falhar, **não edite** até resolver. Sem conexão: espere ela voltar. Histórico divergente com a conexão funcionando: quase sempre é um commit local que não subiu — siga "Envio recusado" na [seção 4.3](#43-salvar-enviar-e-devolver-a-vez). Regra: [../../AGENTS.md](../../AGENTS.md), seção 9.

Por que o `origin` precisa estar sempre em dia: em 29/09/2026 as entregas de 26 a 29/09 foram só ao `hostinger`; o `origin` estava parado em `28a5406`, e o espelho do `hub-control` copiou o `origin` por cima, tirando as entregas do site ([../CONTINUIDADE.md](../CONTINUIDADE.md), "Vez entre ferramentas + incidente de envio forçado").

### 1.2 A vez entre ferramentas

Só uma ferramenta edita por vez. A vez mora no GitHub (`origin`, ramo `vez`), então vale entre máquinas. Script: [../../scripts/vez.sh](../../scripts/vez.sh).

| Comando                                               | Quando                   | Resultado                                                                                                                                                                                               |
| ----------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/vez.sh pedir <ferramenta> "o que vai fazer"` | ao começar               | código 0 e `vez: com <ferramenta>`; ou código 1 e, em stderr, `vez: com <dono> (<descrição>) desde DD/MM HH:MM` (outra ferramenta está com ela; linha 68) ou `vez: sem conexão com o GitHub` (linha 66) |
| `scripts/vez.sh checar <ferramenta>`                  | antes de **cada** edição | código 0 = a vez é sua (renova; pega se estiver livre); código 1 com as mesmas mensagens do `pedir`                                                                                                     |
| `scripts/vez.sh status`                               | ver quem está com a vez  | `vez: livre` ou `vez: com <dono> — <descrição> — máquina <nome> — desde DD/MM HH:MM`                                                                                                                    |
| `scripts/vez.sh liberar <dono-atual>`                 | soltar à mão             | só solta com o nome de quem está com a vez; com outro nome responde `vez: <nome> não estava com a vez` (código 0)                                                                                       |

- Nomes de ferramenta em uso no histórico: `cursor` e `claude-code` (mensagens "Autossave (…)" do `git log`: 9 e 23 em 12/10/2026). Para o Codex ou outra ferramenta, escolha um nome curto e use sempre o mesmo (sugestão: `codex`; ainda não usado no histórico).
- **Prazo:** a vez vence sozinha após `VEZ_PRAZO_MIN` minutos sem renovação (padrão 30; [../../scripts/vez.sh](../../scripts/vez.sh) linha 16). O `checar` só renova no GitHub depois de `VEZ_RENOVAR_MIN` (padrão 20; linha 17) — antes disso responde pelo cache local.
- Se a resposta for `vez: com <outra ferramenta> …`, **espere**. Liberar a vez de outra ferramenta só quando ela com certeza parou.
- Sem conexão com o GitHub, `pedir`/`checar` falham ("vez: sem conexão com o GitHub"): não edite.

### 1.3 O que o Cursor faz sozinho

Arquivo [../../.cursor/hooks.json](../../.cursor/hooks.json):

| Gancho                   | O que roda                                                                       | Efeito                                                                                                                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sessionStart` (linha 4) | `git pull --ff-only origin main` e `scripts/vez.sh pedir cursor "sessao Cursor"` | Se o pull falha, mostra "ATENCAO: nao consegui puxar da main…". Falha ao pedir a vez é silenciosa (`\|\| true`); aí o `preToolUse` tenta pegar a vez de novo e só bloqueia se outra ferramenta estiver com ela ou se não houver conexão.             |
| `preToolUse` (linha 9)   | `bash scripts/cursor-pretool-vez.sh`, com `failClosed: true`                     | Chama `vez.sh checar cursor`, que, sem cache válido, tenta pegar a vez ([../../scripts/vez.sh](../../scripts/vez.sh) linhas 104–114). Sem a vez → nega com "BLOQUEADO pela vez…". Se o próprio gancho falhar, a ação também é negada (`failClosed`). |
| `stop` (linha 15)        | `scripts/autossave.sh cursor` (`loop_limit: 3`)                                  | Ao fim de **cada resposta**: salva, envia ao `origin` (publica o site) e devolve a vez. Sempre termina como sucesso (`\|\| true`, e o autossave sai com 0): um envio recusado passa despercebido ([seção 4.3](#43-salvar-enviar-e-devolver-a-vez)).  |

Consequência importante: no Cursor, **toda resposta termina publicando o que estiver no disco e não estiver no `.gitignore`** (código pela metade, rascunhos, arquivos soltos). Não termine uma resposta com trabalho quebrado nem com temporários na pasta — verifique antes (seção 3). O arquivo não define filtro de ferramentas no `preToolUse`; se ele bloqueia também leituras, não confirmado.

### 1.4 Destravar

1. Apareceu "BLOQUEADO pela vez": rode `scripts/vez.sh status` no terminal.
2. Outra ferramenta está trabalhando → espere ela terminar (o autossave dela devolve a vez) ou até o prazo de 30 min vencer.
3. A outra ferramenta com certeza parou → `scripts/vez.sh liberar <dono-atual>`.
4. Último recurso (o gancho em si está quebrado): renomear `.cursor/hooks.json` e seguir a seção 9 do AGENTS.md à mão. **Cuidado:** a renomeação é uma mudança no projeto; o próximo autossave de qualquer ferramenta (`git add -A`) a enviaria ao `origin` e desligaria os ganchos em todas as máquinas. Renomeie só para destravar e volte ao nome original antes do próximo autossave.

### 1.5 Ferramentas sem ganchos (Claude Code, Codex)

Fazem tudo à mão: `git pull --ff-only origin main` → `scripts/vez.sh pedir <ferramenta> "…"` → `scripts/vez.sh checar <ferramenta>` antes de editar → `scripts/verificar.sh && scripts/autossave.sh <ferramenta>` no fim.

---

## 2. Durante o trabalho

### 2.1 Idioma

Tudo em **português do Brasil**: respostas, commits, documentação, comentários novos e textos do sistema. Regra: [../../.cursor/rules/idioma.mdc](../../.cursor/rules/idioma.mdc).

### 2.2 Texto novo de interface → todos os dicionários

- Dicionários em [../../src/lib/i18n/messages/](../../src/lib/i18n/messages/): `pt-BR.ts` (fonte, define `MessageKey`), `pt-PT.ts`, `en-US.ts`, `en-GB.ts`, `es.ts`. Idiomas em `LOCALES` de [../../src/lib/i18n/locale.ts](../../src/lib/i18n/locale.ts).
- `en-GB.ts` começa com `...enUS` e **sobrescreve só o que muda** no inglês britânico. Os outros quatro precisam da chave escrita.
- Na tela: `t("area.chave")` (exportado por [../../src/lib/i18n/index.ts](../../src/lib/i18n/index.ts)). Nada de texto fixo nas telas já traduzidas.
- Teste de paridade: [../../src/lib/i18n/translate.test.ts](../../src/lib/i18n/translate.test.ts) — todo idioma com as mesmas chaves do pt-BR, nenhuma tradução vazia e os mesmos `{marcadores}`. Roda no `npm test`.

### 2.3 Interface: diretrizes /mb

- Antes de mexer em tela ou fluxo, leia [../mb-interface.md](../mb-interface.md) e a skill [../../.cursor/skills/mb/SKILL.md](../../.cursor/skills/mb/SKILL.md) (com `references/`). A regra [../../.cursor/rules/mb.mdc](../../.cursor/rules/mb.mdc) fica sempre ativa no Cursor.
- Celular primeiro; toque de 44 px; três modos de canto (retos, semi arredondados — padrão —, arredondados); cartões off-white; cores de ação aprovadas.
- **Mostrar em vez de explicar** (diretriz do dono de 05/10/2026, [../mb-interface.md](../mb-interface.md) seção 4): ícone, selo, cor e exemplo antes de parágrafo.
- Registro da revisão MB: [../mb-revisao.md](../mb-revisao.md).

### 2.4 Reaproveitar os componentes comuns

- Tudo de estado, aviso, resultado, escolha, número, etapa, vazio e carregando sai de `@/components/visual` ([../../src/components/visual/](../../src/components/visual/)): `StatusBadge`, `Notice`, `ActionResult`, `ChoiceChips`, `ConfirmDialog`, `EmptyState`, `LoadingState`, `UnsavedBar`, entre outros.
- **Não recrie localmente.** Faltou variação → amplie o componente comum e confira os usos.
- Nunca escreva cor de estado à mão (`bg-emerald-50`…): use os tons `--tone-*` de [../../src/styles.css](../../src/styles.css).
- Catálogo completo e regras: [../mb-interface.md](../mb-interface.md), seção 4, "Componentes visuais comuns". Modelo implementado: [../../src/features/shop/settings/SlotModeSettings.tsx](../../src/features/shop/settings/SlotModeSettings.tsx).

### 2.5 Perguntar por capacidade, não por nome de papel

- A tela pergunta "pode fazer X?" a [../../src/lib/auth/capabilities.ts](../../src/lib/auth/capabilities.ts) (`capabilitiesFor`, tipo `ShopCapabilities`; capacidades com nome a partir da linha 21: `society`, `ownCatalog`, `ownBlocks`, `googleWholeShop`…). Testes: `capabilities.test.ts`.
- A onda 3 (09/10/2026) fez o `ShopShell` e o `shopPowers` perguntarem pelas capacidades ([../CONTINUIDADE.md](../CONTINUIDADE.md), "separação de ambientes, onda 3"). Ainda há comparações pelo nome do papel em `src/` (busca de 12/10/2026; lista não exaustiva — procure com `grep -rn 'role === "' src`):
  - só escolhem o rótulo do papel de um membro: [TeamTab.tsx](../../src/features/shop/catalog/TeamTab.tsx) linha 328 e [governance-diff.ts](../../src/features/shop/settings/governance-diff.ts) linha 416;
  - decidem o que a pessoa vê ou pode fazer: [AgendaInsights.tsx](../../src/features/shop/agenda/AgendaInsights.tsx) linhas 68–69 (ramo da demonstração), [TeamGovernance.tsx](../../src/features/shop/settings/TeamGovernance.tsx) linha 224 (`canReview`) e [LoyaltyAdminPage.tsx](../../src/features/loyalty/LoyaltyAdminPage.tsx) linha 144 (`canManage`, que espelha a regra do banco `loyalty_can_manage`);
  - dentro do próprio `capabilities.ts` (linhas 96, 111 e 122) é legítimo: é lá que o papel vira capacidade.
- **Código novo:** não compare o nome do papel. Falta capacidade → crie uma com nome e teste. Migrar os pontos de decisão acima é dívida técnica ainda sem id em [pendencias.md](pendencias.md) (12/10/2026).
- Quem age e em qual loja: [../../src/lib/auth/shop-acting.ts](../../src/lib/auth/shop-acting.ts). Detalhes de papéis: [papeis-e-permissoes.md](papeis-e-permissoes.md).
- A tela esconder um botão **não** é segurança: a regra de verdade fica no banco (RLS e RPCs).

### 2.6 A demonstração nunca toca o banco

- `/demo` (só `platform_admin`; [../../src/routes/demo.tsx](../../src/routes/demo.tsx) linha 40) usa dados fictícios.
- Trava de rede em [../../src/lib/demo-guard.ts](../../src/lib/demo-guard.ts): com a demonstração aberta só a sessão (`/auth/v1`) sai do aparelho.
- Componente novo que lê o banco precisa saber da demonstração (`useDemo()` de `src/features/demo/context.ts`). Chamada direta a `/functions/v1` passa por `guardedFetch`. O teste [../../src/lib/demo-guard.test.ts](../../src/lib/demo-guard.test.ts) falha se você esquecer.

### 2.7 Segredos, `.env` e arquivos `._*`

- Nunca escreva senha, chave, token ou conteúdo do `.env` em código, documento, commit ou resposta. Nome de variável pode; valor não.
- O `.env` **está rastreado no git** desde o commit `95bc8b4` (16/07/2026, `gpt-engineer-app[bot]`, do Lovable). O `.gitignore` só vale para arquivo não rastreado, por isso não o tira do git. Ele está no histórico do GitHub, nos dois remotos: **nunca** ponha chave secreta (`service_role`, senha, token) nesse arquivo.
- A versão rastreada só tem 6 variáveis públicas do Supabase — `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID` e as três `VITE_*` equivalentes — e aponta para o projeto antigo na nuvem do Supabase (`*.supabase.co`). A cópia desta máquina aponta para o servidor auto-hospedado ([../CONTINUIDADE.md](../CONTINUIDADE.md), 29/09/2026: "`.env` local também apontado para o endereço novo") e por isso aparece como alterada (`M .env`). É esperado: **nunca** `git add .env`, nunca `git commit -a`. O autossave já o exclui ([../../scripts/autossave.sh](../../scripts/autossave.sh) linha 17).
- Montagem do site: a orientação de 21/09/2026 é configurar `VITE_SUPABASE_URL` e a chave pública no painel do Hostinger e recompilar (CONTINUIDADE, "Diagnóstico do login em produção"; [banco-e-implantacao.md](banco-e-implantacao.md), seção 2). Se a montagem do Hostinger também lê o `.env` rastreado: não confirmado.
- O projeto está num volume externo (`/Volumes/Alyson 1TB`); o macOS cria arquivos `._*` ao lado dos arquivos (havia 780 em 12/10/2026). Estão no `.gitignore`, o autossave os exclui e o eslint os ignora. Não os edite nem os apague um a um.

---

## 3. Verificação

Só envie trabalho verificado: enviar ao `origin` publica o site (seção 4.3).

### 3.1 Um comando só

```bash
scripts/verificar.sh              # tipos, testes, eslint + prettier nos alterados, montagem
scripts/verificar.sh --sem-build  # pula a montagem (mais rápido, durante o trabalho)
scripts/verificar.sh --tudo       # eslint e prettier no projeto todo
```

- Ordem: `tsc` → `npm test` → eslint (só os `.ts`/`.tsx` alterados) → prettier `--check` nos alterados → `npm run build`. "Alterados" = `git diff HEAD` + arquivos novos não ignorados.
- Uma etapa que falha não interrompe as outras. No fim vem um resumo em pt-BR (ok/falhou/pulado por etapa) e código 1 se algo falhou.
- Rodado em 12/10/2026 com `--sem-build`: tipos ok (13 s), 249 testes ok, prettier ok. Ajuda: [../../scripts/README.md](../../scripts/README.md).
- **`--tudo` hoje falha por problemas antigos**, não pelo seu trabalho. Em 12/10/2026, `eslint .` deu 78 erros e 35 avisos nesta máquina: 52 erros vêm de `scratch/`, que só existe aqui; 26 são de formatação em `supabase/functions`; os 35 avisos estão em `src/`. O `prettier --check .` acusou 23 arquivos (entre eles docs antigos, a skill `mb`, os e-mails de `public/email/` e as funções). Detalhes: [pendencias.md](pendencias.md), P-44. Use o modo normal (só os alterados) como trava antes de enviar.

### 3.2 Comandos manuais equivalentes

| Etapa            | Comando                                                               | Observação                                                                                                                                                                                       |
| ---------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tipos            | `npm run typecheck` (= `tsc --noEmit`)                                | 11 a 13 s; passou limpo em 12/10/2026                                                                                                                                                            |
| Testes           | `npm test`                                                            | `node --test` com a lista de arquivos do `package.json`; 249 testes passando em 12/10/2026                                                                                                       |
| Estilo do código | `npx eslint <arquivos>`                                               | prefira os alterados; `npm run lint` (= `eslint .`) hoje falha por problemas antigos (seção 3.1)                                                                                                 |
| Formatação       | `npx prettier --check <arquivos>` / `npx prettier --write <arquivos>` | config em `.prettierrc` (largura 100, aspas duplas). Não rode `npm run format` (`prettier --write .`) sem decisão: reformataria de uma vez os 23 arquivos antigos, e o autossave publicaria tudo |
| Montagem         | `npm run build`                                                       | `vite build` + `scripts/copy-pwa.mjs`; grava em `dist/` e `.output/`                                                                                                                             |

**Teste novo não roda sozinho:** o script `test` do [../../package.json](../../package.json) lista cada arquivo `*.test.ts`. Ao criar um, acrescente-o lá.

### 3.3 Verificação visual com `scripts/foto.mjs`

Tira fotos das telas no servidor local (padrão `http://localhost:8090`), simulando por padrão um admin da plataforma sem barbearia (a `/demo` exige `platform_admin`); nenhuma chamada vai ao banco real. Ajuda completa: [../../scripts/README.md](../../scripts/README.md#fotomjs).

**Pré-requisitos**

- **Servidor local** rodando na porta do `--base` (veja "Servidor local" na seção 7).
- **Playwright** (`playwright-core`), que **não** está no `package.json`. O `foto.mjs` procura nesta ordem ([../../scripts/foto.mjs](../../scripts/foto.mjs) linhas 242–266): variável `PLAYWRIGHT_CORE` (pasta do pacote); `playwright-core` ou `playwright` instalados no projeto; a cópia mais nova dentro das extensões do Cursor ou do VS Code (ex.: `~/.cursor/extensions/*/dist/node_modules/playwright-core`); `$(npm root -g)/playwright-core`. Sem nenhum, sai com "não achei o Playwright (playwright-core) nesta máquina".
  - Para resolver: `npm install -g playwright-core` (fora do projeto) ou `PLAYWRIGHT_CORE="/caminho/node_modules/playwright-core" node scripts/foto.mjs …`.
  - Não acrescente o pacote ao `package.json` sem decisão: mudaria o lockfile, e o autossave publica.
  - Nesta máquina, em 12/10/2026, o pacote vem de uma extensão do Cursor (Kilo Code, `playwright-core` 1.57.0).
- **Navegador:** `CHROME_PATH`, Google Chrome ou Microsoft Edge; sem eles, o Chromium do próprio Playwright (linhas 279–287). Se não abrir, a mensagem pede para instalar o Chrome ou indicar outro com `CHROME_PATH`.

**Exemplos** (todos conferidos em 12/10/2026):

```bash
node scripts/foto.mjs "/demo?view=owner"
node scripts/foto.mjs "/demo?view=owner" --largura 320 --escuro
node scripts/foto.mjs "/demo?view=employee" --passos '[{"esperar":1200},{"aba":"Agenda"}]'
node scripts/foto.mjs "/demo?view=associate" --passos '[{"clicar":"header button:has-text(\"Parceiro\")"}]'
node scripts/foto.mjs "/demo?view=equal" --passos '[{"aba":"Equipe"},{"rolar":600}]' --pagina-inteira
node scripts/foto.mjs "/auth" --sem-login --passos '[{"papel":["tab","Cadastrar"]}]'
node scripts/foto.mjs "/auth" --sem-login --largura 1280 --avaliar 'document.title'
```

- O 4º abre a janela "Seu acesso nesta barbearia" (aparece em `janelasAbertas`).
- `clicar` e `papel` precisam achar um elemento **visível**; senão o passo falha por tempo (8 s). Ex.: na visão `owner` a 390 px, `header button:has-text("Parceiro")` existe na página, mas o clique não acontece.
- No painel as abas são botões, não `role="tab"`: use `aba` (barra de baixo) ou `{"papel":["button","Equipe"]}`, que toca o **primeiro** botão com esse nome (na Agenda, o seletor "Minha agenda | Equipe"). `["tab", …]` serve em telas com abas de verdade, como Entrar/Cadastrar em `/auth`.

Opções: `--base <url>`, `--largura <px>` (390), `--altura <px>` (844), `--escuro`, `--pagina-inteira`, `--sem-login`, `--passos '<json>'` (`esperar`, `aba`, `clicar`, `papel`, `digitar`, `rolar`), `--avaliar '<js>'`, `--saida <pasta>` (`.fotos`), `--nome <arquivo.png>`. Vários caminhos na mesma chamada reaproveitam o navegador e geram uma linha JSON cada.

**Visões da demonstração** (`/demo?view=…`, tipo `DemoRole` em [../../src/features/demo/chrome.ts](../../src/features/demo/chrome.ts)):

| Visão       | Quem é                     |
| ----------- | -------------------------- |
| `platform`  | admin da plataforma        |
| `owner`     | dono único                 |
| `equal`     | sociedade em partes iguais |
| `minority`  | sócio com a menor parte    |
| `associate` | Parceiro                   |
| `employee`  | Contratado                 |
| `customer`  | cliente                    |

**Matriz mínima para mudança de tela:** larguras **320** (celular pequeno), **390** (celular comum) e **1280** (computador), em tema **claro e escuro**, nas visões afetadas (aqui, 18 fotos em 6 chamadas):

```bash
for w in 320 390 1280; do
  node scripts/foto.mjs "/demo?view=owner" "/demo?view=employee" "/demo?view=customer" --largura $w
  node scripts/foto.mjs "/demo?view=owner" "/demo?view=employee" "/demo?view=customer" --largura $w --escuro
done
```

**Como ler a saída** (uma linha JSON por foto; campos em [../../scripts/foto.mjs](../../scripts/foto.mjs) linhas 641–719):

- **código de saída 1** → a página não abriu, o servidor respondeu 400 ou mais, um passo falhou, o `--avaliar` deu erro ou a foto não saiu. O motivo vem em `erro` (e em stderr). Também sai 1 sem Playwright ou sem navegador. Se a página abriu, a foto do momento da falha é salva mesmo assim.
- **`aviso` presente → foto inválida, mesmo com código 0.** O texto é "a página mandou para /auth: o login simulado não foi aceito": você fotografou a tela de login, não a página pedida.
- `endereco` → caminho final depois dos redirecionamentos (compare com o pedido).
- `rolagemLateral: true` ou `larguraConteudo` maior que `larguraTela` → algo vaza para o lado (defeito).
- `chavesCruas` não vazio → chave de dicionário aparecendo crua na tela (falta tradução).
- `errosConsole` não vazio → investigar.
- `janelasAbertas` → janelas/diálogos abertos no momento da foto.
- `bloqueadas` → endereços externos que a página tentou acessar e a ferramenta abortou (só aparece se houver).
- `avaliacao` → resultado do `--avaliar`.
- Abra as imagens (ferramenta de leitura de imagem do agente) e confira de fato: cantos, contraste no escuro, textos cortados.

**Onde ficam as fotos.** Em `.fotos/`, na raiz, que está no `.gitignore` (linha 56, acrescentada em 12/10/2026; confira com `git check-ignore .fotos/x.png`, que deve imprimir o caminho). Mesmo assim, **apague antes de terminar a resposta**, com `rm -rf .fotos`: o disco do Mac está quase cheio, e numa cópia sem essa linha do `.gitignore` o autossave do fim da resposta levaria as fotos ao `origin`. Para não deixar nada no projeto, use `--saida` com o scratchpad da ferramenta ou com `scratch/` (também ignorada).

### 3.4 Alternativa: navegador do próprio Cursor

O navegador embutido do Cursor também serve para abrir o servidor local (nesta rodada, `http://localhost:8090/demo?view=owner`), redimensionar e olhar. A página `/demo` exige uma conta `platform_admin` logada; páginas públicas e `/auth` abrem sem conta.

---

## 4. Ao terminar

### 4.1 Registrar a entrega em `docs/CONTINUIDADE.md`

- **Onde:** logo acima da entrada mais recente, que é a primeira seção depois do bloco "## Diretriz — interface visual e autoexplicativa…". Esse bloco e "## Comece aqui" ficam sempre no topo. O diário vai do mais novo para o mais antigo. Procure pelo título, não pelo número da linha: as linhas mudam a cada entrega.
- **Data do cabeçalho:** atualize o "Atualizado em" do topo, antes de "## Comece aqui" (em 12/10/2026 ainda dizia 03/10/2026, embora houvesse entregas de 05/10 e 09/10).
- **Formato** (o já usado):

```markdown
## Entrega — <tema em poucas palavras> (DD/MM, <Ferramenta>)

- **O que:** o que mudou para quem usa (em linguagem simples).
- **Onde:** arquivos principais (`src/...`), migrations e testes.
- **Como foi verificado:** verificar.sh (ok), fotos 320/390/1280 claro e escuro nas visões X e Y, testes SQL N PASS na cópia local.
- **Pendente:** o que ficou para depois, com o id de [guia/pendencias.md](guia/pendencias.md).
```

Se a entrega tem migration, acrescente "— **migration pendente na VPS**" ao título (como em "## Entrega — tempo de preparo entre atendimentos (05/10, Claude Code)"). Nas entradas de 13/10, o que já foi ao servidor leva "— **aplicado em produção**" ou "— **aplicado no servidor**" no título e diz o que não foi testado. Não copie código nem segredos; aponte arquivos.

### 4.2 Atualizar `docs/guia/pendencias.md`

Em [pendencias.md](pendencias.md): marque o que foi resolvido, crie itens novos com o próximo id (P-NN; o último id usado fica no topo do arquivo) e use só o vocabulário: "feito", "feito — falta aplicar no banco", "pendente", "a decidir", "não confirmado".

### 4.3 Salvar, enviar e devolver a vez

```bash
scripts/verificar.sh && scripts/autossave.sh <ferramenta>
```

O que o autossave faz ([../../scripts/autossave.sh](../../scripts/autossave.sh)): confere a vez → `git add -A` sem `.env`, `.env.*` e `._*` → commit "Autossave (<ferramenta>): N arquivo(s)" → envia ao `origin` (só no ramo `main`) → devolve a vez.

- **Enviar ao `origin` publica o site:** `.github/workflows/sync-instantanea-hub.yml` avisa o `PROH-Media/hub-control`, que espelha o `origin` no `hostinger`, e o Hostinger compila. Só envie trabalho verificado.
- `git add -A` leva **tudo** que não estiver no `.gitignore`: não deixe arquivos temporários no projeto (use o scratchpad da ferramenta ou a pasta `scratch/`, ignorada; `.fotos/` também é ignorada). Arquivos novos inesperados, como um `package-lock.json`, também iriam.
- **Nunca** `git push --force` na `main`; **nunca** enviar só ao `hostinger` (o espelho desfaz).

**Envio recusado ("o GitHub tem novidades").** Nesse caso o autossave já gravou o commit local (linhas 17–21), avisa em stderr (linha 26), **devolve a vez mesmo assim** (linha 30) e sai com 0. O `git pull --ff-only` que o aviso sugere **não resolve**: com commit local e novidades no GitHub, os históricos divergem e ele falha com "Not possible to fast-forward" (conferido numa cópia de teste em 12/10/2026). No Cursor a falha é silenciosa: o aviso fica no gancho `stop`, e a próxima sessão mostra "ATENCAO: nao consegui puxar da main…" mesmo com a conexão funcionando.

1. `git fetch origin && git log --oneline origin/main..HEAD` — lista os commits que não subiram.
2. `scripts/vez.sh pedir <ferramenta> "reenvio"` — a vez foi devolvida.
3. `git pull --rebase --autostash origin main` — põe seus commits por cima dos do GitHub. O `--autostash` é obrigatório nesta máquina: sem ele o git recusa por causa do `.env` alterado ("cannot pull with rebase: You have unstaged changes"). Deu conflito → pare e relate (`git rebase --abort` volta ao estado anterior). Nunca `--force`.
4. `scripts/verificar.sh` — o código mudou com as novidades.
5. `scripts/autossave.sh <ferramenta>` — envia e devolve a vez.

No Cursor, os passos 2 e 5 acontecem sozinhos: o `preToolUse` pega a vez e o `stop` roda o autossave.

---

## 5. Banco de dados

Supabase auto-hospedado na VPS (Coolify). Detalhes de servidores, ordem das migrations e publicação de funções: [banco-e-implantacao.md](banco-e-implantacao.md).

**Regra:** nunca aplique migration desta máquina no banco de produção. Quem aplica é o **agente da VPS**.

Fluxo de uma mudança de banco:

1. Migration em `supabase/migrations/AAAAMMDDHHMMSS_nome_curto.sql` (ex.: `20261005120000_tempo_preparo.sql`), depois da última existente.
2. Teste em `supabase/tests/<nome>.sql`. **O arquivo de teste não abre transação** (exceção: `slug_redirects_departure.sql`, com `begin;` e `rollback;` próprios nas linhas 4 e 80). Quem roda sempre embrulha, um teste (ou uma cadeia) por vez:

   ```bash
   { echo 'BEGIN;'; cat supabase/tests/<teste>.sql; echo 'ROLLBACK;'; } \
     | docker exec -i "$DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1
   ```

   - Modelo completo: [banco-e-implantacao.md](banco-e-implantacao.md), seção 6 (cadeias que dependem de `booking_reliability.sql`; nesta máquina não há `psql` nem banco local), e [../implantacao-preparo-2026-10-05.md](../implantacao-preparo-2026-10-05.md), seção 2.
   - Não junte `slug_redirects_departure.sql` a outros arquivos no mesmo `BEGIN`: o `rollback;` dele encerra a transação de fora, e o que viesse depois rodaria sem proteção.
   - **Nunca** rode arquivo de `supabase/tests/` fora de transação: em 03/10/2026 isso deixou dados de teste em produção ([../CONTINUIDADE.md](../CONTINUIDADE.md), "Incidente — teste rodado fora de transação").

3. A tela precisa funcionar **antes** da migration (ex.: o tempo de preparo só aparece quando a coluna `prep_minutes` vem do banco — entrega de 05/10).
4. Guia para o agente da VPS em `docs/implantacao-<tema>-AAAA-MM-DD.md`, no modelo de [../implantacao-preparo-2026-10-05.md](../implantacao-preparo-2026-10-05.md): backup antes, ensaio em `BEGIN … ROLLBACK`, sem "Redeploy" do Coolify, sem imprimir segredos.
5. Registre em [pendencias.md](pendencias.md) como "feito — falta aplicar no banco" e no CONTINUIDADE.

A VPS não tem credencial de envio ao GitHub (registro de 03/10/2026): o resultado da aplicação é registrado por uma máquina com envio.

---

## 6. Trabalho com o dono

- O dono **não é programador**. Fale em pt-BR simples, sem jargão; explique o efeito para o cliente ou o barbeiro, não o código.
- **Mostre em vez de explicar:** envie a foto da tela (seção 3.3) em vez de descrever o layout.
- Decisão de produto (regra de negócio, texto que o cliente vê, cobrança, permissões) é dele. Não decida sozinho: registre em [pendencias.md](pendencias.md) como "a decidir", com 2 ou 3 opções e a consequência de cada uma.
- Perguntas curtas e fechadas ("Opção A ou B?"), uma por vez quando possível.
- Ideias futuras já registradas (não implementar sem pedido): [../reembolso-futuro.md](../reembolso-futuro.md).

---

## 7. Armadilhas conhecidas

| Armadilha                                          | O que fazer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Espaço no disco do Mac                             | Em 12/10/2026 o disco interno chegou a 1,9 GB livres por causa de um gancho de backup do Claude Code (`~/.claude/hooks/backup-before-delete.py`, fora do projeto) que copiava pastas inteiras a cada `rm`; o gancho foi corrigido, as cópias foram para o disco externo e o disco interno ficou com cerca de 200 GB livres. Mesmo assim, confira com `df -h /` antes de gerar arquivos grandes e apague `.fotos`, saídas e temporários antes de terminar a resposta.                                                                                                                                                                                                                                                                                                        |
| Caminho com espaço e `&`                           | A pasta é `/Volumes/Alyson 1TB/OpenDesign/Barba & Cabelo`: sempre entre aspas no terminal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Servidor local                                     | `npm run dev` sem porta sobe em **8080**, padrão do `@lovable.dev/vite-tanstack-config` fora do Lovable (conferido no `dist/index.js` do pacote instalado; o `vite.config.ts` e o `package.json` não fixam porta); é a porta citada no "Comece aqui" do CONTINUIDADE e no [../mb-operacao.md](../mb-operacao.md). Nesta rodada (12/10/2026) o servidor roda em **8090** (`vite dev --port 8090 --host`), o padrão do `foto.mjs`. Vale a porta passada a `npm run dev -- --port`; se for outra, passe `--base` ao `foto.mjs`. Antes de subir outro, confira com `lsof -i :<porta>`.                                                                                                                                                                                          |
| Fotos e arquivos soltos                            | O `git add -A` do autossave leva tudo que não está no `.gitignore`. `.fotos/` e `scratch/` estão; outras pastas, não. Apague `.fotos` antes de terminar a resposta (seção 3.3).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Histórico do git pouco explicativo                 | O histórico começa com o modelo do Lovable e 396 commits do `gpt-engineer-app[bot]` (03/06 a 29/07/2026, mensagens como "Changes"); os autossaves dizem só "Autossave (…): N arquivo(s)". O porquê das mudanças está no [../CONTINUIDADE.md](../CONTINUIDADE.md), não no `git log`. Se o Lovable ainda edita o repositório: não confirmado.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Restos do Lovable                                  | `@lovable.dev/vite-tanstack-config` (base do `vite.config.ts`), `@lovable.dev/mcp-js` (sem uso; [pendencias.md](pendencias.md), P-46), `src/lib/lovable-error-reporting.ts` (usado em `src/routes/__root.tsx`), a pasta `.lovable/` e as exceções do `bunfig.toml`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `vite.config.ts`                                   | Não acrescente à mão `tanstackStart`, `viteReact`, `tailwindcss`, `tsConfigPaths` nem `nitro`: o `@lovable.dev/vite-tanstack-config` já os inclui, e duplicar quebra o app (aviso nas linhas 1–6). O preset do nitro fica em `node-server` por causa do Hostinger (linhas 16–24): o padrão do Lovable (Cloudflare) dá 503 lá.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Lockfile                                           | O projeto tem `bun.lock` e `bunfig.toml` e **não** tem `package-lock.json`. Um `npm install` criaria um `package-lock.json` (não está no `.gitignore`), que o autossave enviaria: se surgir, não envie sem decisão. Gerenciador oficial (bun × npm): não confirmado ([arquitetura.md](arquitetura.md), seção 17).                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `.env` alterado                                    | Normal nesta máquina (aponta para o servidor auto-hospedado). Nunca envie; nunca ponha segredo nele, porque a versão rastreada está no histórico do GitHub (seção 2.7).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Teste que não roda                                 | Arquivo `*.test.ts` novo precisa entrar no script `test` do `package.json`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Rotas                                              | `src/routeTree.gen.ts` é gerado automaticamente: não edite à mão. Convenções em [../../src/routes/README.md](../../src/routes/README.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Tela escondendo ≠ banco bloqueando                 | Várias regras valem "só na tela" e têm pendência de banco (ex.: bloqueio próprio e foto do Contratado, P-02 e P-03). P-01 e P-04 já têm migration (`20261013120000`), que só vale depois de aplicada na VPS. Veja [pendencias.md](pendencias.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Publicação acidental                               | No Cursor o autossave roda ao fim de cada resposta; fora do Cursor, `autossave.sh` também publica. Verifique antes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Autossave do Cursor publica e pode gravar por cima | O gancho `stop` faz `git add -A` e envia ao `origin` o que estiver no disco ao fim de cada resposta, sem rodar o `verificar.sh` (seção 1.3). Em 15/10/2026, às 20:50 (Brasília), o `dab56a7` publicou o código de P-31 e P-33 antes da conferência na tela. Em 13/10, o `03c5d32` voltou trechos do AGENTS.md e do CONTINUIDADE ao texto de antes do `6b08f73`, sem explicação no commit (parece cópia velha gravada por cima; intenção não confirmada). Ao retomar: compare o `git log` com a passagem mais recente ou a última entrada do CONTINUIDADE; abra na tela o que o autossave publicou sem conferência; desconfie de autossave que muda AGENTS.md ou CONTINUIDADE sem entrega que explique, e confira com `git show <commit> -- AGENTS.md docs/CONTINUIDADE.md`. |
| Envio recusado sem ninguém ver                     | O autossave sai com 0 e devolve a vez mesmo quando o GitHub recusa o envio. Ao começar, se o `git pull --ff-only` falhar com a conexão funcionando, siga a seção 4.3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

---

## Onde está cada coisa

- O que foi feito desde o início: [historico.md](historico.md)
- Mapa do código: [arquitetura.md](arquitetura.md)
- Papéis, ambientes, sociedade e Parceiro: [papeis-e-permissoes.md](papeis-e-permissoes.md)
- Banco, servidores e publicação: [banco-e-implantacao.md](banco-e-implantacao.md)
- Pendências priorizadas: [pendencias.md](pendencias.md)
- Ferramentas de linha de comando: [../../scripts/README.md](../../scripts/README.md)
- Operação (Coolify, Titan, Google): [../mb-operacao.md](../mb-operacao.md); PWA: [../pwa.md](../pwa.md)
