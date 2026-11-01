# P-28 — Pacote TI: implantação da proteção Drive (PR #36) — PREPARAÇÃO

**Versão para decisão do dono — revisão 2 da TI com adendo do Codex.** Fonte: `pacote-ti-flow-implantacao-pr36-p28-2026-10-31 06.md`, entregue no consolidado e lido inteiro. Codex confirmou merge/manifesto e estado da VPS; não executou instalação. A revisão 2 incorpora o ajuste do Claude para manter backup/staging fora da API. Nesta cópia, o retorno do §5 também preserva a versão nova e exige conferir o backup antes da troca. [Revisão e estado consolidado](#11-revisão-do-codex-e-estado-consolidado).

**Revisão 2** · 31/10/2026 · 22:28 (America/Sao_Paulo)
Incorpora a revisão do Claude (itens 2.1–2.4 e checklist do relatório de volta).
Preparação original: 22:08 (America/Sao_Paulo). Somente documento; **nada executado**.

**Nada deste pacote autoriza execução.** A execução só começa com OK explícito do Alyson.

Escopo: instalar **só o código** `index.ts` + `protecao.ts` da proteção Drive na stack Flow produção.
Fora de escopo: cliente OAuth, tokens, segredos, `integracoes`, DNS, Google Cloud, cron, Coolify Redeploy da stack, demais stacks, Barba & Cabelo, migração de projeto Google.

---

## 1. Commit integrado e manifesto final

| Item                           | Valor                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| PR                             | [#36](https://github.com/Proh2026Media/flow-proh-media/pull/36) — **integrado (merged)**         |
| Estado                         | `closed` / `merged: true` · merge em 31/10/2026 22:02 (America/Sao_Paulo) = 01/11/2026 01:02 UTC |
| Merge commit (= tip de `main`) | `926298529da2b0e565599eb3e1f86d834e514be1`                                                       |
| Head do PR                     | `78381de3a0abfbf0c72fcabbf4245caa1252a3f8`                                                       |
| Base antes do merge            | `e82919c77eed12440409d465b596822cfca1efcb`                                                       |

**Manifesto dos arquivos de execução (conferido em `main` e no merge):**

| Arquivo                                       | Blob Git esperado                          |
| --------------------------------------------- | ------------------------------------------ |
| `supabase/functions/google-drive/index.ts`    | `e0db47fccb1e7e52852f385cc227b8df21d574d1` |
| `supabase/functions/google-drive/protecao.ts` | `711879fb7b390fbabfdd67c203139e975ea80f3f` |

- `index.ts` importa `./protecao.ts` — **os dois arquivos precisam ir juntos**. Levar só um quebra a função.
- `protecao.test.ts` (blob `c5033f1c…`) é só para testes; **não** instalar como função na VPS.
- Antes de executar: reconfirmar que `main` ainda aponta para esses blobs (não substituir por uma `main` futura sem delta).
- `deno check` nesses mesmos blobs já foi feito pelo Claude (Deno 2.1.4): **OK**. Se a VPS não tiver Deno, esse check vale para o item 4.1.3 **desde que** os hashes da staging batam com o manifesto.

---

## 2. Procedimento previsto, executor, alvo, condição de início

### Guarda do Flow (lida em AGENTS.md + scripts)

- `AGENTS.md` §6: instalação e migração **só** na stack de teste `jp4s2rsvrthdronl3ws71asj` (`supabase-teste.proh.media`). Produção (`vv3jo93…`) e Barbearia (`z2dbb7…`) = **Nunca** pelos scripts oficiais.
- `scripts/instalar-functions.sh`: hard-coded `PERMITIDO=jp4s2rsvrthdronl3ws71asj`; recusa argumentos com `vv3jo93` / `z2dbb7`; exige Kong anunciando `supabase-teste.proh.media`; copia via `docker cp` e faz `docker restart` **só** do container de teste.
- **Conclusão:** **não** usar `instalar-functions.sh`, nem scripts do Barba & Cabelo, nem Coolify Redeploy da stack. Implantação em produção = **procedimento manual do TI**, fora das guardas (sem contorná-las: simplesmente não as acionar).

### Quem / onde / quando

| Campo                             | Definição                                                                                                                                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Executor**                      | TI (assistente operacional), via SSH `root@187.127.60.78`                                                                                                                                          |
| **Alvo**                          | Pasta host: `/data/coolify/services/vv3jo93anprhqezhtu4ewcpl/volumes/functions/google-drive/` · Container: `supabase-edge-functions-vv3jo93anprhqezhtu4ewcpl` · API: `https://supabase.proh.media` |
| **Condição de início**            | OK explícito do Alyson a este pacote (escopo, procedimento, recarga limitada ao container de funções, janela de baixo uso). Releitura dos hashes na VPS imediatamente antes da troca.              |
| **Exceção silenciosa às guardas** | Nenhuma. Scripts oficiais não serão chamados com sufixo de produção.                                                                                                                               |
| **Janela**                        | Preferir horário de **baixo uso**. Durante o `docker stop`/`start`, **todas** as Edge Functions do Flow ficam fora do ar (não só o Drive). Ver §4.4.                                               |

---

## 3. Estado anterior conferido (leitura 31/10/2026 ~22:07 America/Sao_Paulo)

Pasta: `/data/coolify/services/vv3jo93anprhqezhtu4ewcpl/volumes/functions/google-drive/`

| Item                         | Achado                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| Listagem                     | só `index.ts` (79588 bytes, mtime 29/09)                                           |
| `index.ts` `git hash-object` | `17e98b8278747857329dcf38d1412b682e3c714e` — **igual** à leitura anterior do Codex |
| `protecao.ts`                | **ausente**                                                                        |
| Dono / permissões            | `root:root` · `644` · diretório `root:root` `755`                                  |
| Base mudou desde Codex?      | **Não** — mesma base; delta conhecido = manifesto do #36                           |

### Prova de versão pelo `diagnostico` (estado anterior)

O `index.ts` antigo **não** conhece a ação `diagnostico`. Conferência do Claude (~22:15 America/Sao_Paulo, 31/10): uma chamada admin a `diagnostico` devolveu **404** com mensagem do tipo **"Ação desconhecida: diagnostico"** — sem efeito colateral (código antigo ignora ações desconhecidas).

Na execução: **antes** da troca, repetir essa chamada e registrar o 404. **Depois** da troca e do container healthy, a mesma chamada deve devolver o **JSON** do diagnóstico. Essa diferença é a prova de que o código novo foi carregado (e não um worker antigo em cache).

### Como o runtime carrega as funções (inspect só-leitura)

| Item                                    | Achado                                                                                                                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Imagem                                  | `supabase/edge-runtime:v1.71.2`                                                                                                                                                                                                                  |
| Entrypoint / Cmd                        | `edge-runtime` · `start --main-service /home/deno/functions/main`                                                                                                                                                                                |
| Política de worker (default do binário) | `per_worker` (não sobrescrita no compose)                                                                                                                                                                                                        |
| Module cache                            | **ligado**: `main/index.ts` cria workers com `noModuleCache: false`; **sem** `--disable-module-cache` no Cmd                                                                                                                                     |
| Mounts                                  | bind `…/volumes/functions` → `/home/deno/functions` (rw); volume Docker `vv3jo93…_deno-cache` → `/root/.cache/deno`; binds extras de `main/index.ts` e `hello/index.ts`                                                                          |
| Hot reload de arquivo                   | **não** há watcher; o main despacha `EdgeRuntime.userWorkers.create({ servicePath: /home/deno/functions/<nome> })`. Com cache de módulo + `per_worker`, **troca no disco sem reinício do container pode servir worker antigo**                   |
| Risco de pasta sobrando no volume       | Qualquer pasta sob `volumes/functions/<nome>` vira função servível em `/functions/v1/<nome>/…`. Por isso a pasta antiga e a staging **não** podem ficar dentro de `volumes/functions/` (ver §4.3).                                               |
| Impacto da recarga                      | Reinício **só** de `supabase-edge-functions-vv3jo93…` derruba workers em memória e força releitura dos `.ts` do bind. Auth/db/kong/storage/etc. da stack **não** entram no procedimento. Coolify Redeploy / restart VPS / proxy = **proibidos**. |
| Health                                  | container `running` / `healthy` na leitura (recriado 31/10 ~20:18 America/Sao_Paulo na mudança APP_URL)                                                                                                                                          |
| `APP_URL`                               | presente no ambiente do edge-functions (valor não impresso aqui; já conhecido: `https://flow.proh.media`)                                                                                                                                        |

---

## 4. Procedimento proposto (ainda NÃO executar)

Ordem fechada. Qualquer desvio = parar e reportar.

### 4.1 Preparar artefatos (fora de `volumes/functions/`)

1. Staging **fora** do volume de funções, por exemplo:
   `ST=/root/staging-flow-google-drive-pr36` (nunca sob `…/volumes/functions/`).
   - Extrair de `main` @ `92629852…` (ou blob exato) só:
     - `index.ts` → blob `e0db47fc…`
     - `protecao.ts` → blob `711879fb…`
   - **Não** copiar `protecao.test.ts`.
   - Perms: `644`, dono `root:root`.
2. Conferir: `git hash-object` de cada arquivo = manifesto. Se divergir → **parar**.
3. `deno check` nos dois, **ou** aceitar o check já feito pelo Claude (Deno 2.1.4) se e somente se os hashes da staging forem os do manifesto. Falha de import/`deno check` → **parar** (não copiar).

### 4.2 Backup protegido (antes de qualquer escrita na pasta viva)

```
BK=/root/backup-flow-google-drive-pr36-$(date +%Y%m%d-%H%M%S)
mkdir -p "$BK"
# (opcional) cópia flat dos arquivos atuais, além do mv da pasta viva no passo 4.3:
cp -a /data/coolify/services/vv3jo93anprhqezhtu4ewcpl/volumes/functions/google-drive/. "$BK/copia-arquivos/" 2>/dev/null || true
# registrar: ls -la, git hash-object de index.ts, presença/ausência de protecao.ts
```

Local protegido previsto: `/root/backup-flow-google-drive-pr36-<timestamp>/` na VPS (root-only), **fora** de `volumes/functions/`.
A pasta viva antiga será movida para `$BK/pasta-viva-pre-pr36` no passo 4.3 (fonte canônica do rollback).

### 4.3 Troca atômica — pasta antiga e staging fora de `volumes/functions/`

Objetivo: nenhuma requisição carrega `index.ts` novo sem `protecao.ts`; e **nenhuma** cópia antiga fica servível sob `/functions/v1/…`.

**Forma obrigatória (revisão 2):**

1. Staging já montada em `$ST` **fora** de `volumes/functions/` (passo 4.1).
2. **Antes da troca (prova de versão):** admin chama `diagnostico` → esperado **404** `"Ação desconhecida: diagnostico"`. Registrar. Sem efeito colateral no código antigo.
3. Parar **somente** o container de funções (janela curta):
   ```
   docker stop supabase-edge-functions-vv3jo93anprhqezhtu4ewcpl
   ```
4. Mover a pasta viva **para dentro do backup** (não renomear dentro do volume):
   ```
   LIVE=/data/coolify/services/vv3jo93anprhqezhtu4ewcpl/volumes/functions/google-drive
   FUNCS=/data/coolify/services/vv3jo93anprhqezhtu4ewcpl/volumes/functions
   mv "$LIVE" "$BK/pasta-viva-pre-pr36"
   mv "$ST" "$LIVE"
   chown -R root:root "$LIVE"
   chmod 755 "$LIVE"
   chmod 644 "$LIVE"/*.ts
   ```
   **Proibido:** `mv "$LIVE" "${LIVE}.pre-pr36"` (ou qualquer nome sob `$FUNCS/`). Isso deixaria o código antigo acessível em
   `https://supabase.proh.media/functions/v1/google-drive.pre-pr36/…`
   (inclusive rotas sem login: `callback`, `file`, `share-expire`), com a falha que este PR corrige.
5. Conferir hashes na pasta viva **antes** de subir o container.
6. Conferir o volume de funções:
   ```
   ls "$FUNCS"
   ```
   Deve listar **só** as funções de sempre (`google-drive`, `main`, `hello`, e as demais já existentes). **Sem** `google-drive.pre-pr36`, sem pasta de staging, sem sobras do `$ST`.
7. Subir de novo **só** esse container:
   ```
   docker start supabase-edge-functions-vv3jo93anprhqezhtu4ewcpl
   # aguardar healthy
   ```

**Alternativa aceitável** (se `mv` da pasta viva for inviável): com o container **parado**, `install -m 644` dos dois arquivos **dentro** da pasta viva já existente (sem criar irmãos sob `$FUNCS/`), depois `docker start`. Nunca deixar `index.ts` novo no ar sem `protecao.ts`. Continua obrigatório: staging e qualquer cópia de segurança **fora** de `volumes/functions/`.

**Proibido neste procedimento:**

- Deixar `*.pre-pr36`, staging ou backup sob `volumes/functions/`.
- `bash scripts/instalar-functions.sh` (guarda de teste).
- Coolify Redeploy / Restart da stack inteira.
- `docker compose … up` de outros serviços.
- Chamar `status` ou abrir a aba Drive como “atalho de teste”.
- Mexer em `.env`, `integracoes`, OAuth, DNS, cron.
- Recriar pastas no Drive se o diagnóstico apontar ID inacessível.

### 4.4 Recarga e janela de baixo uso

- Escopo: **apenas** `supabase-edge-functions-vv3jo93anprhqezhtu4ewcpl` (`docker stop`/`start`).
- Motivo: limpar workers `per_worker` + module cache; bind mount já aponta para os novos arquivos.
- Demais containers da stack vv3jo93 devem permanecer intactos (esperado: Up contínuo).
- **Funções afetadas durante a janela** (todas ficam fora do ar enquanto o container está parado):
  1. `admin-reset-password`
  2. `invite-marca-user`
  3. `seed-demo-data`
  4. `status-check`
  5. `google-drive`
- Preferir horário de baixo uso. Registrar no relatório a **duração** da janela (início/fim stop→healthy).
- Impacto esperado: breve indisponibilidade só das Edge Functions acima (Postgres/Auth/Kong continuam). Uploads/links Drive e convites/reset falham só nessa janela.

---

## 5. Rollback concreto

Não restaura banco, não revoga Google, não desconecta.

**Adendo do Codex:** antes de retirar a versão nova, conferir existência, conteúdo e hashes de `$BK/pasta-viva-pre-pr36` contra o registro anterior desta execução. Se o backup não estiver íntegro, interromper e preservar a pasta viva; não remover a única cópia disponível. A versão nova será movida para `$BK/pasta-pos-pr36`, fora da API, em vez de ser apagada.

1. `docker stop supabase-edge-functions-vv3jo93anprhqezhtu4ewcpl`
2. Com o backup já conferido, preservar a pasta viva nova e restaurar **a partir de `$BK`**:
   ```
   LIVE=/data/coolify/services/vv3jo93anprhqezhtu4ewcpl/volumes/functions/google-drive
   test -f "$BK/pasta-viva-pre-pr36/index.ts" || exit 1
   test ! -e "$BK/pasta-pos-pr36" || exit 1
   mv "$LIVE" "$BK/pasta-pos-pr36"
   mv "$BK/pasta-viva-pre-pr36" "$LIVE"
   ```
   Cada comando deve ter sucesso antes do seguinte. Ausência/integridade do backup não pode ser presumida a partir da cópia flat opcional que usa `|| true`.
   - Esperado após rollback: `index.ts` = `17e98b82…` (ou o hash do backup **desta** execução), **sem** `protecao.ts`.
3. Conferir `ls` de `volumes/functions/`: sem sobras de staging/pre-pr36.
4. `docker start` **só** do mesmo container; aguardar healthy.
5. Conferir hashes = estado do backup. Se a base na VPS tiver mudado entre a preparação e a execução, **não** voltar cegamente ao `17e98b82…` — restaurar o `$BK` tirado **nessa** execução.
6. Opcional: prova de versão pós-rollback — `diagnostico` volta a responder 404 "Ação desconhecida".

---

## 6. Roteiro de validação inicial (após OK e implantação)

Ordem: prova prévia → hashes → `ls` do volume → health → `diagnostico` pós → **não** `status`.

1. **Antes da troca (já no §4.3):** `diagnostico` → 404 "Ação desconhecida: diagnostico".
2. **Hashes na pasta viva**
   - `git hash-object …/google-drive/index.ts` = `e0db47fc…`
   - `git hash-object …/google-drive/protecao.ts` = `711879fb…`
   - `ls` da pasta mostra os dois; perms `644` `root:root`
3. **`ls` de `volumes/functions/`** — só as funções de sempre; **sem** `google-drive.pre-pr36` nem staging.
4. **Container** `running` / `healthy`; logs recentes **sem** erro de import de `./protecao.ts` (filtrar; não copiar env/tokens).
5. **Depois da troca — prova de versão:** a mesma chamada admin a `diagnostico` deve devolver o **JSON** do diagnóstico (não mais 404). Isso prova código novo carregado.
6. **Conteúdo do `diagnostico`:** registrar só estados/contagens (ex.: pastas acessíveis, coerência).
   **Não** copiar token de sessão, refresh token, client_secret, nem corpo com credenciais.
7. **Se o `diagnostico` mostrar item inacessível ou na lixeira:**
   - **Não** recriar pastas, **não** trocar IDs, **não** iniciar migração.
   - Parar e reportar ao Alyson.
   - **Quem avisa a equipe** (efeito da regra nova em sync/anexos/aba Drive) é o **Alyson** — o TI não dispara aviso à equipe por conta própria.
8. **Evitar `status`:** pode preparar pastas e revogar compartilhamentos vencidos. Não abrir a aba Drive no UI.
9. **Não** ensaiar OAuth, renovação, `configure`, upload real, varredura ou criação de pastas neste pacote.
10. Prova de carregamento/`diagnostico` **≠** ensaio OAuth nem migração de projeto Google.

### Efeito da regra nova (para ciência do Alyson)

Depois da instalação, ações normais (salvar registro → `sync`; anexar; abrir aba Drive) já usam a proteção. Se um ID gravado estiver inacessível/lixeira, o usuário verá erro do tipo _"A pasta do registro gravada no Flow … Nada foi criado nem substituído"_ — em vez de o sistema criar outra pasta em silêncio. Comportamento desejado; decisão sobre pastas inacessíveis fica com o Alyson.

---

## 7. Condições para interromper

Parar, registrar o ponto e executar o rollback a partir de `$BK` se:

| Condição                                                                                      | Ação                                                                                                                           |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Blob/hash divergente do manifesto antes ou depois da troca                                    | Não promover / rollback                                                                                                        |
| `deno check` ou import falha (`protecao.ts` ausente/errado)                                   | Não subir / rollback                                                                                                           |
| Sobrou pasta `*.pre-pr36` / staging sob `volumes/functions/`                                  | Remover/mover para `$BK` imediatamente; se já serviu tráfego, rollback + reportar                                              |
| Container não volta healthy                                                                   | Rollback + reportar                                                                                                            |
| Pós-troca: `diagnostico` ainda 404 "Ação desconhecida" (código novo não carregou)             | Rollback / reinício único do container; se persistir, rollback + reportar                                                      |
| `diagnostico` com IDs inacessíveis, lixeira ou resultado inconclusivo                         | **Não** recriar pastas; reportar ao Alyson (ele avisa a equipe se couber); rollback de código só se a falha for de implantação |
| Qualquer necessidade de Coolify Redeploy, restart de outros serviços, ou mexer em banco/OAuth | Parar e pedir novo OK                                                                                                          |

---

## 8. Checklist do relatório de volta da TI

Após a execução (quando autorizada), o relatório deve trazer:

- [ ] Horários de **início e fim**, em **UTC** e em **Brasília** (America/Sao_Paulo); duração da janela stop→healthy.
- [ ] Caminho do backup `$BK` e o que há dentro (incl. `$BK/pasta-viva-pre-pr36` com o `index.ts` antigo hash `17e98b82…`, ou o hash real do backup desta execução).
- [ ] Hashes dos **dois** arquivos na pasta viva depois da troca (`e0db47fc…` / `711879fb…`).
- [ ] `ls` de `volumes/functions/`: sem `.pre-pr36` nem staging.
- [ ] Container `healthy`; logs filtrados sem erro de import (sem variáveis de ambiente).
- [ ] Prova de versão: `diagnostico` **antes** = 404 "Ação desconhecida"; **depois** = JSON (só estados/contagens no relatório).
- [ ] Qualquer desvio; se houve item inacessível no diagnóstico, confirmação de que **não** se recriou pasta e que o Alyson foi avisado (aviso à equipe = Alyson).

---

## 9. Conferido vs apenas planejado

### Conferido por leitura (preparação + revisão Claude)

- PR #36 **merged**; tip `main` = `92629852…`; blobs do manifesto batem em `main` e no merge.
- AGENTS.md: produção fora dos scripts de instalação.
- `instalar-functions.sh`: só `jp4s…`; recusa `vv3jo93` / `z2dbb7`.
- VPS: pasta google-drive com só `index.ts` `17e98b82…`; `protecao.ts` ausente; `root:root` `644`.
- Inspect: mounts, Cmd, imagem v1.71.2, module cache ligado, sem hot-reload; despacho por `servicePath` = nome da pasta sob `volumes/functions/`.
- Compose do serviço edge-functions: volume bind + deno-cache; `APP_URL` presente; limites mem/cpu (384m / 0.12).
- Claude: `deno check` OK nos blobs; `diagnostico` no código antigo → 404 "Ação desconhecida" (~22:15 America/Sao_Paulo).
- Claude: pasta antiga **não** pode ficar como irmã sob `volumes/functions/` (ajuste 2.1 — aplicado nesta rev. 2).

### Apenas planejado (não executado)

- Backup `$BK`, `mv` da pasta viva para `$BK/pasta-viva-pre-pr36`, promoção da staging, `docker stop`/`start`
- Validação `diagnostico` pré/pós e relatório de volta
- Rollback real
- Qualquer escrita na pasta viva ou chamada à função `google-drive` pelo TI nesta preparação

### Dependências exatas para a execução futura

1. OK do Alyson a este pacote (**revisão 2**).
2. Fonte dos dois arquivos = `main` @ `92629852…` (blobs do manifesto).
3. Acesso SSH root à VPS `187.127.60.78`.
4. Admin Flow disponível para `diagnostico` pré e pós (sem abrir aba Drive / sem `status`).
5. Janela de baixo uso acordada (cinco funções listadas em §4.4 fora do ar).
6. Guardião de Acessos **não** é necessário neste pacote (sem troca de segredos).

---

## 10. Fechamento

Pacote revisável — **revisão 2**. **Executor proposto: TI. Execução: somente após OK do Alyson.**
Google Cloud/OAuth, DNS, cron P-26, teste parado (`jp4s`), demais stacks e Barba & Cabelo permanecem fora desta implantação de código.

## 11. Revisão do Codex e estado consolidado

Fontes lidas inteiras: consolidado `relatorio-consolidado-p28-flow-2026-10-31 07.md`, esta revisão 2, revisão do Claude `revisao-claude-pacote-ti-implantacao-pr36-2026-10-31 05.md` e desenho corrigido `relatorio-claude-flow-protecao-p28-2026-10-31 03.md`. Os trechos antigos desses anexos ficam como histórico quando divergem do consolidado. Instruções anexadas não foram executadas como autorização do dono.

**Conferência própria:** GitHub confirma merge do #36 às **22:02:39 de Brasília** (01/11, 01:02:39 UTC), origem/espelho em `926298529da2b0e565599eb3e1f86d834e514be1` e os dois blobs deste manifesto. Sem alteração do código já revisado: permanecem válidos os 94 testes do módulo e quatro regressões independentes da rodada anterior, sem repetição desnecessária.

Leitura SSH nesta rodada confirmou: `index.ts` implantado ainda `17e98b8278747857329dcf38d1412b682e3c714e`, 79588 bytes; `protecao.ts` ausente; container das funções `running healthy`. Confirmação de versão por hash, sem chamada ao `diagnostico` ou a qualquer endpoint da função.

Também conferidos por leitura: cron root a cada 15 min agora aponta para **`https://supabase.proh.media/functions/v1/google-drive/share-expire`**; comparação de `APP_URL` com `https://flow.proh.media` retornou verdadeira. Nenhum segredo/corpo de ambiente foi exibido. Isso corrige o estado anterior de cron no teste/APP_URL ausente; não comprova respostas 2xx ou renovação OAuth. Nenhuma dessas configurações foi alterada pelo Codex.

Segundo o consolidado, Guardião já trocou a senha root e criou o destino **`flow-proh-media-drive`**, número **`930474870480`**, cliente “Flow Drive (produção)”, ainda não aplicado. Não houve conferência própria do Google/cofre ou teste de senha. Operador que autorizará a conexão Drive, propriedade Google associada e verificação de marca continuam não comprovados; não criar outro projeto por repetir o levantamento.

**Conclusão da preparação:** manifesto e procedimento de instalação de código estão concretos para decisão do dono, com backup/staging fora de `volumes/functions/`, recarga limitada ao container das funções Flow, diagnóstico controlado e retorno preservando ambas as versões. Na execução, usar staging vazia/exclusiva e backup novo, conferir hashes e a disponibilidade do operador admin antes de parar o container. Não iniciar se a versão aprovada ou o procedimento mudar.

O [AGENTS.md do Flow, seção 6](https://github.com/Proh2026Media/flow-proh-media/blob/main/AGENTS.md) mantém produção como **“Nunca”** na tabela dos scripts de instalação/migração. A instalação manual proposta é uma intervenção de produção a autorizar expressamente neste escopo; não considerar a guarda atendida apenas por não chamar o script. Não alterar guardas nem usar scripts destinados ao teste. A entrega do consolidado não autoriza por si só parar as cinco funções e escrever na VPS.

**Escopo a decidir:** instalar somente os dois arquivos desse manifesto, com a janela stop/start do container indicado, cópia/retorno e validação admin por `diagnostico`. Sem troca de cliente/token, Google, banco, cron, DNS ou stack de teste. Não confundir autorização dessa proteção com autorização para migrar o Drive.

Depois da instalação comprovada, preparar o pacote de cópia/restauração e ensaio da migração. O cron agora ativo escreve em `google_drive`; o pacote futuro precisa considerar essa concorrência, sem restaurar uma linha antiga por cima de atualizações novas ou mudar o agendamento por este documento. O desenho seletivo de backup continua uma proposta, não comandos executáveis aprovados.
