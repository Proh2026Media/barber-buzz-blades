# P-28 — Pacote TI v3.1 conferido: checagem, modelo e janela D

> **07/11/2026 — cópia conferida pelo Codex/B&C para a TI/Guardião, com ciência do Claude/Flow.** Base integral: `2026-11-07-claude-ti-pacote-janela-d-v3-p28.md` do Claude, 338 linhas, SHA-256 `77e280e773968068b891c427c59b9072cd4e65bcb2b8f923734ad37bc272166c`. Esta cópia v3.1 incorpora somente três precisões documentais: mensagem real do comando vazio; alcance da saída 1, que não prova ausência do registro de operação; e saída 3 deixando a barreira **como estiver**, pois ela pode já estar aberta. Comandos de operação, alvo, hashes, marco, data e autorizações preservados. [Revisão do #49 e resultados próprios](2026-11-07-flow-revisao-pr49-p28.md). O documento prepara a execução pela TI; não a autoriza.

**Revisão de código concluída pelo Codex em 07/11:** #49 integrado `7861c5bafa258e3fecd9bc8af13056f9e47dd969`, conteúdo igual ao head `52cb499`; **F1/F2 atendidas, sem achado de código aberto no escopo**. Próprios 214/214 ferramentas sem pulos (runtime incluído), 148/148 app Flow, 7/7 independentes; tipos do app/lint limpos. Função com os três hashes da E1b, sem reinstalação/reinício da espera. Próximo retorno: relatório da Parte 1 pela TI em 13/11 às 17h45, com A1 já relatada; A2/modelo e A3/janela seguem próprios. Nenhuma nova programação ou merge Claude solicitado. Revisão não substitui autorização operacional.

## Ficha do ciclo

| Campo                           | Valor                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ciclo**                       | P-28 · separação Google do Flow                                                                                                                                                                                                                                                                                                                                                                 |
| **Etapa atual**                 | Nova E2: espera de 168 h depois da **E1b** (`p28-barreira-7`), até **13/11/2026 17:30:07 BRT**. Este pacote cobre **E2→E3** (checagem), **E3** (modelo da autorização) e **E4** (janela D).                                                                                                                                                                                                     |
| **Este documento**              | Pacote Claude v3, conferido pelo Codex em 07/11/2026 · **v3.1 documental**, substitui a cópia v3 neste encaminhamento; função e ferramentas iguais às revisadas                                                                                                                                                                                                                                 |
| **De → Para**                   | Codex/B&C → **TI/Guardião**, entregue por Alyson; ciência Claude/Flow, autor do pacote v3 e das ferramentas                                                                                                                                                                                                                                                                                     |
| **Responde a**                  | `2026-11-06-claude-flow-ajustes-pr46-pr48-p28.md` (Codex: achados F1/F2 nas ferramentas) e `relatorio-ti-p28-etapa1b-reinstalacao-2026-11-06.md` (TI: valores da E1b, já preenchidos aqui)                                                                                                                                                                                                      |
| **O que mudou da v2**           | (1) **Saída 3 também quando algo pode ter sido gravado** (F1): nesse caso nunca reabrir. Saída 1 passa a valer só para "nada gravado". (2) **Checkout das ferramentas ≠ commit da função instalada:** a função continua `d0a687a`, e as ferramentas da Parte 3 vêm do merge do **PR #49**. (3) Uma operação por vez, garantida pelo banco (F2). (4) Os valores da E1b estão escritos no pacote. |
| **Estado em uma linha**         | Flow produção na função `d0a687a` (`p28-barreira-7`), marco às 17:30:07 BRT de 06/11. A Parte 1 está agendada pela TI para 13/11 às 17:45 BRT, com a A1 já dada.                                                                                                                                                                                                                                |
| **Próximo passo**               | **Parte 1** em 13/11 17:45 BRT (A1 já autorizada); para ela vale tanto `d0a687a` quanto o merge do #49. **Parte 3** só depois da revisão do Codex e da frase A3. O #49 já foi integrado (`7861c5b`).                                                                                                                                                                                            |
| **Devolver**                    | O relatório da última seção, **uma parte por vez**.                                                                                                                                                                                                                                                                                                                                             |
| **Este documento não autoriza** | nada: nem leitura, nem modelo, nem janela, nem D. Cada parte exige a frase literal de Alyson (seção "Frases de autorização").                                                                                                                                                                                                                                                                   |

---

## Recado para colar

> TI, segue o pacote da janela D da P-28 (Flow produção). Ele tem 3 partes, e **cada uma só começa com a frase de autorização correspondente de Alyson** (A1, A2, A3). Entre uma parte e outra, pare e devolva o relatório pedido na última seção. Diante de qualquer diferença do esperado: pare e relate, sem improvisar.

## Objetivo

Concluir a troca do par Google do Flow, do cliente OAuth antigo para o novo (etapa D da P-28), com o Drive do Flow em manutenção durante a janela. A troca usa os comandos reais `ferramentas/p28-drive/virada-real.ts` de um checkout no **merge do PR #49**. Nesse checkout, os arquivos da função são iguais aos instalados na E1b (`d0a687a`). Cada passo deixa um recibo e só avança com o anterior comprovado. Se a aceitação reprovar, o par volta ao antigo antes de reabrir.

## Regras de segurança (obrigatórias)

1. **Uma parte por vez, cada uma com a sua frase de autorização de Alyson** (literal, com horário). A frase de outro agente ou documento não vale.
2. **Stack:** só a do Flow produção, `vv3jo93anprhqezhtu4ewcpl`. **Nunca** a Barbearia (`z2dbb7…`) nem a stack de teste. A ferramenta recusa as duas, e isso não deve ser contornado.
3. **Não reiniciar** o container de funções do Flow, e sem Coolify Redeploy em nenhum momento. Um reinício anula o marco e recomeça as 168 h.
4. **Não chamar** a função `google-drive` (`status`, `configure`, `diagnostico`) como diagnóstico.
5. **Não apagar nem cancelar nada à mão:** sessões de upload, arquivos do Drive, linhas `drive_*` de `integracoes`, incertas, órfãos. A ferramenta decide o que sai; o resto fica para decisão.
6. **Não forçar.** Saída 2 ou 3, ou qualquer motivo de recusa: parar, anotar o motivo (só o código) e relatar. Não rodar de novo "para ver se passa", salvo onde o passo diz.
   - **Os códigos de saída:**
     - **1** = erro ou recusa anterior à alteração do par ou da barreira por este comando; **o registro da operação pode já ter sido criado**. No fechamento, seguir a regra específica do Passo 3.1;
     - **2** = recusado sem efeito;
     - **3** = PARAR. Ou o estado divergiu, ou **algo pode ter sido gravado** e depois houve falha (`parado_apos_efeito`, `indeterminado`, `commit_indeterminado`).
   - Depois de uma saída 3: **nunca reabrir, repetir nem retornar** por conta própria. Deixar a barreira como estiver e relatar.
   - Se houver um arquivo `parado-….json` na pasta do passo, é o recibo de parada: anotar só o nome.
     6a. **Um comando por vez.** Não rodar dois comandos da ferramenta ao mesmo tempo, nem em duas janelas. O banco recusa uma segunda operação (`outra_operacao_em_curso`, `admissao_ocupada`), mas a regra é não tentar.
7. **Segredos:** nenhum valor de senha, token, URL de conexão, URL de sessão, `client_id`/`client_secret`, conteúdo de recibo ou ID privado do acervo no relatório. Recibos e autorização ficam 0600, em pasta 0700, sob custódia da TI.
8. **Sem Git:** não fazer commit nem push no repositório do Flow. Só ler o checkout.
9. **Tudo o que não está aqui está fora:** DNS, IAM, Branding, cliente OAuth antigo (não revogar), Barba & Cabelo, cobranças.

## O que você precisa ter em mãos

- **Máquina de operação** com: acesso de rede ao banco do Flow produção (container `supabase-db-vv3jo93…`) e às APIs do Google; o **Bun 1.4.x**; e um checkout do repositório `Proh2026Media/flow-proh-media`. Isso **não foi confirmado** pelo Claude, e o Passo 1.1 confere.
  - **Dois commits diferentes, que não se confundem:**

    | O quê                                                      | Commit                                                                                                                                                                   | Onde se confere                                         |
    | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
    | **Função instalada** na pasta viva (não muda neste pacote) | `d0a687a675c6d7ddd26739a5f566a7e71c7fb992` (merge do #48)                                                                                                                | hashes da pasta viva (Passo 1.2) e recibo de instalação |
    | **Checkout das ferramentas** (`virada-real.ts`)            | **Partes 1 e 2:** `d0a687a…` ou o merge do #49. **Parte 3:** **só o merge do PR #49**: `7861c5bafa258e3fecd9bc8af13056f9e47dd969` (integrado em 07/11/2026 13:10:04 BRT) | `git rev-parse HEAD` (Passo 1.1)                        |

  - Nos dois casos, os 3 arquivos da função **dentro do checkout** têm os mesmos hashes da E1b. A ferramenta confere o recibo de instalação contra eles.

- **Arquivo de conexão** (0600) com a URL do PostgreSQL do Flow produção, de um usuário que possa ler `pg_control_system()` (no Supabase, em geral o superusuário `supabase_admin`). O valor fica no painel do Coolify da stack e não entra no relatório.
- **Arquivo de origens** (0600), no mesmo formato já usado nas capturas A/B: `{"versao":1,"variaveis":{"GOOGLE_CLIENT_ID":<true|false>,"GOOGLE_CLIENT_SECRET":<…>,"DRIVE_TOKEN_SECRET":<…>,"DRIVE_CRON_SECRET":<…>}}`. Ele traz só a **presença** de cada variável no container de funções do Flow, refeita na hora.
- **Bancada aprovada do cliente novo** (`bancada.json`, sob custódia desde A/B/T1).
- **Recibo de instalação da E1b**, só como referência. No dia é feito um **novo**.
- **Pasta de operação nova** (0700), por exemplo `/root/flow-p28-d-<STAMP>/`.
- **Marcadores `<…>` deste pacote** (só se sabem no dia):
  - `<STAMP>`: data/hora UTC da criação da pasta, gerada pelo próprio bloco de variáveis;
  - `<true|false>`: presença de cada variável no container de funções;
  - `<operacao_id>`: sai do Passo 2.1;
  - `<valida_de>`/`<valida_ate>`: a janela que Alyson escolher;
  - `<parte…>`: o nome do relatório de cada parte.

## Já feito — não refazer

- **E1b (reinstalação `p28-barreira-7`, 06/11/2026):** merge do #48 na pasta viva, 3 arquivos. Hashes: `barreira.ts` `6de959d8fd4cf03f108f82a4c48daff0f5516f57e23424ca80cc5bd0e40d2abd`, `index.ts` `460d5a9b964f91030ffe8dcea2bf2ba901dd9b5c5f31ac2171334bab17b4a506`, `protecao.ts` `8d8b1c0ad8dce25b46bba881c22f46d9038bef50e010d3c163768114fb970c34`.
  - **StartedAt** do container de funções: `2026-11-06T20:25:17.402850757Z` (17:25:17 BRT).
  - **Marco:** `versao = p28-barreira-7`, `desde = 2026-11-06T20:30:07.445Z` (17:30:07 BRT).
  - **Data mínima** (marco + 168 h): **2026-11-13T20:30:07.445Z = 13/11/2026 17:30:07 BRT**.
  - Cópia de retorno da v6: `/root/flow-p28-install-v7-20261106T202514Z/retorno-v6/`.
  - A E1 anterior (`57f8fd4`, `p28-barreira-6`) foi substituída.
- **A1 já dada por Alyson** (registrada pela TI); a Parte 1 está agendada para 13/11 às 17:45 BRT.
- **Correções F1/F2 do Codex:** feitas só nas ferramentas, no PR #49. A função não mudou, então não há reinstalação nem recomeço das 168 h.
- **Cópia de retorno da #36:** `/root/flow-p28-retorno-20261106T165705Z/`.
- **Site:** já está publicado com o hook do ticket (#43). O Claude leu o arquivo no ar `flow.proh.media/assets/index-BigA63fh.js`, publicado em 06/11 18:41:44 UTC (15:41:44 BRT). **Não precisa publicar o site.**
- **A, B, T1, Picker dos 15, candidato e evidências v2:** atendidos, sob custódia. Não repetir consentimento, renovação nem inventários.
- **Não confirmado** (o Passo 1.1 confere): a máquina de operação descrita acima.

---

## Frases de autorização (Alyson diz; a TI registra literal, com horário)

Elas existem para Alyson conferir e copiar. **Não valem só por estarem neste documento.**

- **A1 — checagem pré-janela (só leitura):**
  > Autorizo, a partir de 13/11/2026 17:30:07, a checagem pré-janela da P-28 no Flow produção, só de leitura: StartedAt do container de funções, hashes da pasta viva, marco de instalação, recibo de instalação novo e contagens da barreira (inclusive ações presas). Não autorizo modelo de autorização, janela nem D.
- **A2 — modelo da autorização (só leitura):**
  > Autorizo rodar o virada-real.ts autorizacao-modelo no Flow produção, só leitura, e me entregar o operacao_id. Não autorizo janela nem D.
- **A3 — janela D:** dita por Alyson **e** escrita dentro do arquivo de autorização, no campo `frase`. Precisa conter "Autorizo" e o `operacao_id`:
  > Autorizo a operação `<operacao_id>` (etapa D da P-28) na stack vv3jo93anprhqezhtu4ewcpl, entre `<valida_de>` e `<valida_ate>` (no máximo 12 h): fechar a barreira, verificar o legado, reconciliar incertas e uploads, drenar, promover o par novo, aceitar e reabrir — ou retornar ao par antigo e reabrir se a aceitação reprovar. Não autorizo Redeploy, reinício, cancelar sessões, apagar arquivos nem revogar o cliente antigo.

---

## Passo a passo

**Variáveis usadas nos blocos** (definir uma vez na máquina de operação; os valores reais não entram no relatório):

```bash
REPO=/caminho/do/checkout/flow-proh-media     # Partes 1–2: d0a687a ou merge do #49 · Parte 3: SÓ o merge do #49
OP=/root/flow-p28-d-$(date -u +%Y%m%dT%H%M%SZ) # pasta nova da operação
mkdir -m 700 "$OP"
CONEXAO="$OP/conexao.url"        # 0600, URL do PostgreSQL do Flow produção (não imprimir)
ORIGENS="$OP/origens.json"       # 0600, presença das 4 variáveis
BANCADA=/caminho/da/bancada.json # custódia A/B/T1
```

### PARTE 1 — Checagem pré-janela (precisa da frase A1)

#### Passo 1.0 — Lugar e hora certos

- **Onde:** máquina de operação.
- **O quê:** `date -u` e `TZ=America/Sao_Paulo date`.
- **Esperado:** **depois** de 13/11/2026 17:30:07 BRT (20:30:07 UTC).
- **Se vier diferente:** antes disso, não seguir.

#### Passo 1.1 — Ferramenta e checkout

```bash
cd "$REPO" && git rev-parse HEAD && (cd supabase/functions/google-drive && sha256sum barreira.ts index.ts protecao.ts) && bun --version && bun ferramentas/p28-drive/virada-real.ts; echo "saida=$?"
```

- **Esperado:**
  - **HEAD:**
    - nas Partes 1 e 2: `d0a687a675c6d7ddd26739a5f566a7e71c7fb992` ou `7861c5bafa258e3fecd9bc8af13056f9e47dd969` (merge do #49);
    - na Parte 3, **só** `7861c5bafa258e3fecd9bc8af13056f9e47dd969` (merge do #49);
  - os 3 hashes da função **no checkout** iguais aos da E1b ("Já feito");
  - Bun 1.4.x;
  - a ferramenta responde `❌ argumentos: comando_desconhecido` com `saida=1`, o que prova que ela roda.
- **Se vier diferente:** parar e relatar. Atenção: o HEAD do checkout **não** é o commit da função instalada, e um não substitui o outro na conferência. A função se confere pelos hashes da pasta viva (Passo 1.2).

#### Passo 1.2 — Container sem reinício e pasta viva igual

- **Onde:** VPS.
- **O quê:** `docker inspect -f '{{.State.StartedAt}}'` do container `supabase-edge-functions-vv3jo93…`, e `sha256sum` dos arquivos da pasta viva `…/volumes/functions/google-drive/`.
- **Esperado:**
  - StartedAt **igual a `2026-11-06T20:25:17.402850757Z`**;
  - exatamente 3 arquivos, com os 3 hashes da E1b de "Já feito".
- **Se vier diferente:** StartedAt diferente → **parar** (o marco venceu; o caminho é `instalacao-remarcar` e mais 168 h, que é decisão nova de Alyson). Hash diferente → parar.

#### Passo 1.3 — Recibo de instalação NOVO (vale 2 h)

- **O quê:** gravar `$OP/recibo-instalacao.json` (0600) no formato do recibo de 06/11, com:
  - `arquivos`: os **3 hashes completos** (64 caracteres) lidos agora;
  - `conteiner_iniciado_em`: o StartedAt lido agora;
  - `conferido_em`: o horário desta leitura (UTC, ISO).
- **Esperado:** arquivo 0600 e JSON válido. A partir daqui, a Parte 3 precisa começar em menos de 2 h, senão refazer este passo.

#### Passo 1.4 — Marco e contagens (só leitura)

- **O quê:** SQL só de leitura em `public.integracoes`. Não imprimir `instancia` nem dados:
  - `dados->>'desde'` e `dados->>'versao'` de `id='drive_instalacao'`;
  - contagem de `id LIKE 'drive_atividade:%'` por `dados->>'estado'`;
  - contagem de `id LIKE 'drive_upload:%'`;
  - contagem de `id LIKE 'drive_operacao:%'`;
  - existência de `id='drive_barreira'`;
  - **ações presas** (só tipo, estado e número, sem IDs):
    ```sql
    SELECT dados->>'acao' AS acao, dados->>'estado' AS estado, count(*) AS n FROM public.integracoes
     WHERE id LIKE 'drive_atividade:%' AND (dados->>'estado' <> 'ativa' OR (dados->>'iniciado_em')::timestamptz < now() - interval '10 minutes')
     GROUP BY 1, 2 ORDER BY 1, 2;
    ```
- **Esperado:**
  - `desde = 2026-11-06T20:30:07.445Z` e `versao = p28-barreira-7`;
  - a consulta de ações presas **sem linhas**. Se houver, anotar: as da versão 7 sem efeito gravado saem no Passo 3.3, e as da versão 6 ficam como `nao_verificavel` e bloqueiam (decisão de Alyson);
  - `drive_operacao` = 0;
  - `drive_barreira` ausente (barreira aberta).
- **Anotar:** os números de atividades e uploads.
- **Se vier diferente:** marco diferente → parar. `incerto` > 0 → anotar (a Parte 3 vai tentar reconciliar, e o que não for comprovado bloqueia).

**Fim da Parte 1:** devolver o relatório (Parte 1) e **parar**.

### PARTE 2 — Modelo da autorização (precisa da frase A2)

#### Passo 2.1 — Gerar o modelo (só leitura)

```bash
cd "$REPO" && bun ferramentas/p28-drive/virada-real.ts autorizacao-modelo --conexao "$CONEXAO" --stack vv3jo93anprhqezhtu4ewcpl --bancada "$BANCADA" --destino "$OP/modelo"; echo "saida=$?"
```

- **Esperado:** `saida=0`, com JSON na tela (`operacao_id`, `stack`, `banco`, `comandos: 10`) e arquivo `autorizacao-modelo-….json` em `$OP/modelo` (0600).
- **Se vier diferente:**
  - `alvo_nao_identificavel`: o usuário da conexão não lê `pg_control_system()`. Parar e relatar (troca de usuário é decisão);
  - `par_atual_ausente` ou qualquer outro motivo: parar.

#### Passo 2.2 — Entregar o `operacao_id` a Alyson

- **O quê:** mandar **só** o `operacao_id` e o horário.
- **Depois:** Alyson define `valida_de`/`valida_ate` (até 12 h) e diz a frase A3.
- **Preenchimento:** a TI copia o modelo para `$OP/autorizacao.json` (0600) e preenche `valida_de`, `valida_ate` (ISO UTC), `autorizado_por` ("Alyson Viana") e `frase` (A3 literal). Não mexer em mais nenhum campo. Um campo alterado depois de começar faz a ferramenta recusar (`autorizacao_alterada`).

**Fim da Parte 2:** devolver o relatório (Parte 2) e **parar** até a janela.

### PARTE 3 — Janela D (precisa da frase A3, dentro da janela)

**Antes de começar:**

- o checkout tem de estar no merge do PR #49 (refazer o Passo 1.1 com esse HEAD);
- a revisão do Codex sobre o #49 tem de ter voltado sem achado aberto (Alyson confirma);
- se passaram mais de 2 h do Passo 1.3, refazer os Passos 1.2 e 1.3.

Todos os comandos rodam com `cd "$REPO"`, e `AUT="$OP/autorizacao.json"`.

#### Passo 3.1 — Fechar a barreira (o Drive do Flow passa a responder 503)

```bash
bun ferramentas/p28-drive/virada-real.ts barreira-fechar --conexao "$CONEXAO" --autorizacao "$AUT" --destino "$OP/1-fechar"; echo "saida=$?"
```

- **Esperado:** `saida=0` e `$OP/1-fechar/barreira-fechada.json`.
- **Se vier diferente:**
  - `saida=1`: o comando recusou antes de alterar a barreira; **não presumir o estado atual nem tentar reabrir sem recibo válido**. Parar e relatar, sem repetir: o registro da operação pode ter ficado aberto, e o próximo passo é decisão de Alyson com o Claude.
    - Exemplos: `outra_operacao_em_curso`, `admissao_ocupada`, `autorizacao_*`, `alvo_*`;
  - `saida=3` (`commit_indeterminado`, `parado_apos_efeito`): a barreira **pode estar fechada**. **PARAR TUDO** e relatar.

#### Passo 3.2 — Legado (uploads da versão anterior)

```bash
bun ferramentas/p28-drive/virada-real.ts uploads-legado-verificar --conexao "$CONEXAO" --origens "$ORIGENS" --barreira "$OP/1-fechar/barreira-fechada.json" --instalacao "$OP/recibo-instalacao.json" --autorizacao "$AUT" --destino "$OP/2-legado"; echo "saida=$?"
```

- **Esperado:** `saida=0` e `orfaos_legado: 0`.
- **Se vier diferente:**
  - `saida=2` com órfão: parar;
  - `listagem_*`, `sem_files`, `conferencia_vencida`, `marco_anterior_ao_conteiner` ou outro motivo: parar.
  - Em qualquer recusa, ir para o Passo 3.10 (reabrir sem trocar o par).

#### Passo 3.3 — Incertas

```bash
bun ferramentas/p28-drive/virada-real.ts incertas-reconciliar --conexao "$CONEXAO" --origens "$ORIGENS" --barreira "$OP/1-fechar/barreira-fechada.json" --autorizacao "$AUT" --destino "$OP/3-incertas"; echo "saida=$?"
```

- **Esperado:** `saida=0` e `pendentes: 0`.
- **Se `pendentes` > 0:** anotar os motivos (só os códigos) e ir para o Passo 3.10.

#### Passo 3.4 — Uploads abertos (sem cancelar)

```bash
bun ferramentas/p28-drive/virada-real.ts uploads-reconciliar --conexao "$CONEXAO" --cancelar nao --autorizacao "$AUT" --destino "$OP/4-uploads"; echo "saida=$?"
```

- **Esperado:** `restantes: 0`.
- **Se restar algum** (`saida=2`): ir para o Passo 3.10. Cancelar sessão (`--cancelar sim`) é decisão nova de Alyson.
- **`saida=3`** (`parado_apos_efeito`): **parar tudo** e relatar. O par não mudou, mas o recibo pode não ter sido gravado.

#### Passo 3.5 — Drenar (prova de zero)

```bash
bun ferramentas/p28-drive/virada-real.ts barreira-drenar --conexao "$CONEXAO" --barreira "$OP/1-fechar/barreira-fechada.json" --prazo-s 600 --legado "$OP/2-legado/legado-verificado.json" --autorizacao "$AUT" --destino "$OP/5-drenar"; echo "saida=$?"
```

- **Esperado:** `saida=0` e `$OP/5-drenar/prova-drenagem.json`.
- **Se vier diferente:** `saida=2` → Passo 3.10.

#### Passo 3.6 — Promover o par novo

```bash
bun ferramentas/p28-drive/virada-real.ts promover --conexao "$CONEXAO" --origens "$ORIGENS" --bancada "$BANCADA" --prova "$OP/5-drenar/prova-drenagem.json" --autorizacao "$AUT" --destino "$OP/6-promover"; echo "saida=$?"
```

- **Esperado:** `saida=0`, com `resultado` `aplicado` ou `aplicado_reconciliado`, e os arquivos `imagem-anterior.json` e `captura-posterior.json`.
- **Se vier diferente:**
  - `saida=2` (`nao_aplicado`): nada gravado, comprovado pela releitura → Passo 3.10;
  - `saida=1` (por exemplo `par_novo_diferente_da_autorizacao`, bancada que não abre): a recusa veio **antes** de qualquer escrita no par → relatar e ir para o Passo 3.10;
  - `saida=3`: **PARAR TUDO**. Não reabrir, não retornar, não repetir; relatar imediatamente. Os casos são:
    - `divergente` ou `barreira_perdida`;
    - `indeterminado`: a releitura falhou;
    - `parado_apos_efeito`: o COMMIT aconteceu ou pode ter acontecido, e depois falhou a captura posterior, um arquivo ou o recibo.
  - Com `saida=3`, anotar da tela só `resultado`, `resultado_aplicacao`, `gravou_no_banco` (`true`, `false` ou `possivel`), `captura_posterior_gravada` e `motivo`.

#### Passo 3.7 — Aceitação externa (só leitura)

```bash
bun ferramentas/p28-drive/integracoes.ts aceitar-promocao --anterior "$OP/6-promover/imagem-anterior.json" --posterior "$OP/6-promover/captura-posterior.json" --bancada "$BANCADA"; echo "saida=$?"
```

- **Esperado:** `saida=0` e `aceito: true` → Passo 3.8.
- **Se vier diferente:** `saida=2` (reprovada) → Passo 3.9.

#### Passo 3.8 — Aprovada: reabrir

```bash
bun ferramentas/p28-drive/virada-real.ts barreira-abrir --conexao "$CONEXAO" --barreira "$OP/1-fechar/barreira-fechada.json" --autorizacao "$AUT" --destino "$OP/8-abrir"; echo "saida=$?"
```

- **Esperado:** `saida=0`. A operação fica encerrada, e o Drive do Flow volta a atender.
- **Se vier diferente:** `saida=3` (`commit_indeterminado`, `parado_apos_efeito`): a barreira **pode já estar aberta**, e a operação fica em curso. Não repetir; parar e relatar.

#### Passo 3.9 — Reprovada: retornar ao par antigo, depois reabrir

```bash
bun ferramentas/p28-drive/virada-real.ts retornar --conexao "$CONEXAO" --origens "$ORIGENS" --prova "$OP/5-drenar/prova-drenagem.json" --anterior "$OP/6-promover/imagem-anterior.json" --posterior "$OP/6-promover/captura-posterior.json" --autorizacao "$AUT" --destino "$OP/9-retornar"; echo "saida=$?"
```

- **Esperado:** `saida=0` e `resultado: retornado` → reabrir com o comando do Passo 3.8.
- **Se vier diferente:** qualquer saída 3 → **parar tudo**, sem reabrir, e relatar:
  - `divergente`, `barreira_perdida` ou `indeterminado`;
  - `parado_apos_efeito`: o retorno pode ter sido gravado e o recibo não.
- `saida=2` (`nao_retornado`): nada gravado; parar e relatar (sem reabrir com o par novo reprovado).

#### Passo 3.10 — Recusa antes de promover: reabrir sem trocar o par

- **O quê:** se qualquer passo entre 3.2 e 3.5 recusou com saída 1 ou 2 (ou o 3.6 deu `nao_aplicado`/saída 1), o par **não mudou**. Rodar o comando do Passo 3.8 (reabrir).
- **Nunca** vir para cá depois de uma **saída 3**, em nenhum passo.
- **Depois:** relatar o motivo. A próxima tentativa precisa de **nova** autorização, porque esta se encerra ao reabrir.

## Como saber que deu certo

- **Parte 1:**
  - StartedAt (`2026-11-06T20:25:17.402850757Z`) e hashes iguais aos de 06/11;
  - marco `p28-barreira-7`, `desde = 2026-11-06T20:30:07.445Z`;
  - recibo novo gravado;
  - `drive_operacao` = 0.
- **Parte 2:** `autorizacao-modelo` com saída 0 e `operacao_id` entregue a Alyson.
- **Parte 3:**
  - todos os passos com saída 0;
  - `aceito: true`;
  - `barreira-abrir` com saída 0;
  - `barreira-estado` depois (com a mesma autorização) mostra a barreira **aberta** e 0 incertas;
  - o Drive do Flow volta a atender (um uso normal por Alyson, sem chamar `status`/`configure`).

## Como desfazer

- **Antes de promover:** o par não muda. Basta reabrir (Passo 3.10).
- **Depois de promover, com aceitação reprovada:** `retornar` (Passo 3.9), que volta exatamente ao par antigo, e depois reabrir.
- **Saída 3 em qualquer ponto:** não desfazer nada sozinho. Deixar a barreira **como estiver**, sem tentar abrir ou fechar novamente, e relatar. Ela pode já estar aberta, conforme o Passo 3.8. O próximo passo é decisão de Alyson com apoio do Claude.
- **Função:** este pacote não muda a função. O retorno dela para a #36 (`/root/flow-p28-retorno-20261106T165705Z/` + reinício do container) só acontece com decisão nova, e vale lembrar que ele anula o marco.

## Fora do escopo

- Instalar, reinstalar ou reiniciar a função; Coolify Redeploy.
- Cancelar sessões de upload, apagar arquivos ou linhas, zerar incertas/órfãos à mão.
- Revogar o cliente OAuth antigo, DNS, IAM, Branding, publicação do site (já publicado), Barba & Cabelo.
- O caminho do cron com `revogacao_sem_registro` (reabrir, deixar a varredura confirmar, fechar e reconciliar): se aparecer, relatar. Ele precisa de nova autorização.

## Relatório para devolver

Devolver **uma parte por vez**, começando o documento com a **Ficha do ciclo** (modelo na seção 7 do relatório consolidado do Claude), **com o campo "Responde a"** citando este pacote (`2026-11-07-ti-flow-janela-d-v3-conferida-p28.md`). Nome: `relatorio-ti-p28-<parte1-checagem|parte2-modelo|parte3-janela>-AAAA-MM-DD.md`.

**Parte 1:**

1. Frase A1 literal e horário (BRT e UTC).
2. Saídas do Passo 1.1: HEAD do checkout (dizer se é `d0a687a` ou o merge do #49), os 3 hashes da função no checkout, versão do Bun e `saida=1` da ferramenta.
3. StartedAt atual e os 3 hashes da pasta viva, com igual ou diferente.
4. Confirmação de que o recibo novo tem os 3 hashes **completos** (os da E1b), sem colar o arquivo, e o seu `conferido_em`.
5. Marco (`desde`, `versao`), as contagens do Passo 1.4 e a tabela de ações presas.
6. Saúde do Flow e da Barbearia (healthy e StartedAt).

**Parte 2:**

1. Frase A2 literal e horário.
2. Saída do `autorizacao-modelo`: o JSON da tela, que não tem segredo.
3. `valida_de`/`valida_ate` combinados com Alyson.
4. Confirmação de que só os 4 campos foram preenchidos, e o caminho da custódia (sem conteúdo).

**Parte 3:**

1. Frase A3 literal e horário.
2. Para cada passo, de 3.1 a 3.10: horário, `saida=` e o resultado ou motivo (só os códigos e contagens).
3. Aceitação: `aceito` e motivo, se reprovou.
4. Estado final: barreira aberta ou fechada, `barreira-estado` (só números) e saúde do Flow e da Barbearia.
5. Se houve saída 3: em que passo parou e os campos `resultado`, `resultado_aplicacao`, `gravou_no_banco`, `captura_posterior_gravada` e `motivo`, sem valores. Também o nome do arquivo `parado-….json`, se houver.
6. HEAD do checkout usado na Parte 3, que tem de ser o merge do #49.
7. Nenhum valor de conexão, token, URL de sessão, client_id/secret ou conteúdo de recibo/autorização.
