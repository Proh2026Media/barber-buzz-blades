# P-28 — Para TI: reensaio da etapa A com PR #38 conferido

**01/11/2026 · Escopo: somente reensaio fictício de A na VPS.** [Correção revisada pelo Codex](2026-11-01-flow-pr38-portas-conferidas-p28.md): uma rodada independente **93/0/0**, incluindo 22 PostgreSQL, sem novo achado impeditivo nos pontos examinados. PR #38 já integrado pelo dono. Este roteiro prepara a execução da TI após a decisão do dono; não inclui captura real, Google ou virada.

## 1. O que já foi atendido

- Instalação #36/diagnóstico, merge #37 e seus quatro ajustes: não repetir.
- Runtime Bun e isolamento: já executados na primeira etapa A. As duas corridas antigas **85/1/0** continuam históricas, não aprovadas por sua união. Fontes/logs em `/root/flow-pr37-20261101T222727Z/` devem permanecer intactos.
- Correção das portas/prontidão: **PR #38 já integrado e revisado**. Não pedir novo PR, repetir levantamento geral ou obter dados Google para esse reensaio.

## 2. Código exato para a nova execução

| Item                              | Valor obrigatório                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| Repositório de origem             | `Proh2026Media/flow-proh-media`                                                     |
| Commit integrado                  | **`9837ebc873554d3e7685f792c18d01349418ed2e`**                                      |
| Head de conteúdo idêntico         | `a29722df60167708036af9172adadc035c77b71a`                                          |
| Árvore completa                   | `7dd39209a3a24815424970f2de726ecfefb75f8d`                                          |
| Subárvore `ferramentas/p28-drive` | **`fb576d0970c46fe9dcb918fa10be59d62f2111a3`**, 19 blobs                            |
| Fonte nova na VPS                 | `/root/flow-pr38-<UTC>/src/`, fora das stacks e da API, somente leitura             |
| Privados novos                    | `/root/flow-pr38-<UTC>/priv/`, 0700; arquivos 0600                                  |
| PostgreSQL fictício               | Nome exclusivo `flow-p28-pr38-ficticio-<UTC>`                                       |
| Runner                            | Nome exclusivo `flow-p28-pr38-ensaio-<UTC>`                                         |
| Labels                            | `p28.pr38=ensaio`, `p28.papel=pg-ficticio` ou `runner-ensaio`, `p28.operacao=<UTC>` |

Obter **somente os 19 arquivos das ferramentas** da árvore fixada. Pode usar a mesma API GitHub autorizada que funcionou na primeira execução: conferir SHA-1 Git de cada blob, montar tar/manifesto e SHA-256, transportar e verificar antes de usar. Não exigir novo login `gh`, enviar `.git`/`.env` ou copiar o repositório inteiro. Uma extração `git archive` do commit acima também serve, quando já houver acesso autenticado. Se a main tiver avançado, não trocar silenciosamente o código fixado; registrar o delta para revisão.

Os quatro blobs novos estão na [conferência do PR #38](2026-11-01-flow-pr38-portas-conferidas-p28.md#1-fonte-recebida-e-versão-conferida). Não executar novamente a pasta antiga do #37 nem sobrescrever seus logs. Usar nomes exclusivos também no transporte para evitar arquivos de outra operação.

## 3. Runtime e preparação

Usar o [roteiro operacional anterior, seção 3](2026-11-01-ti-flow-pr37-runtime-ensaio-conferido-p28.md#3-etapa-a-pronta-para-decisão--runtime-e-suíte-fictícia-na-vps) como modelo de criação/validação/limpeza, **substituindo commit, árvore, caminhos, nomes e labels pelos da seção 2**. Os comandos antigos com `13f1dc9` e expectativa 86 não são o código/critério deste reensaio.

Imagens fixadas, já disponíveis segundo a execução anterior:

- Bun: `oven/bun:1.4.2@sha256:296a79bbc988bb0a91ef11099af70a78a8cba98b73fd53f7b2a7715b7c86ced2`, Linux/amd64, esperado 1.4.2.
- PostgreSQL: `postgres:15-alpine@sha256:54e0dd8e8cddcdbb9156c2486eed5a43eccb7214d7c6828097d41ce049fb3984`, versão **15.19** observada pela TI. Conferir a versão real, sem atribuir-lhe 15.8 por causa da revisão local.

Revalidar somente o que depende do instante: nomes livres, imagem/digest, espaço para o ensaio e identificação dos containers existentes para comparar depois. Não reinstalar Bun no host ou reinventariar Google/produção. Com imagem em cache, não é necessário novo pull; qualquer obtenção necessária deve conservar o digest fixado.

Forçar `umask 077`. Gerar senha/URL **só fictícias** em arquivos 0600, sem valores em relatório ou argumentos. PostgreSQL novo/exclusivo, `--network none`, sem `-p`, sem rede Flow; senha por `POSTGRES_PASSWORD_FILE`. Inicialização vazia, sem dados/esquemas de outra stack. Aguardar `pg_isready` no máximo 60 s e registrar `SHOW server_version` no fictício. Confirmar ID/labels/network/PortBindings antes da suíte. O apoio da suíte prepara seu esquema/marcador; não aplicar nada em bancos existentes.

## 4. Suíte única completa

Na sessão que preparou o fictício, definir `P28_SRC`, `P28_PRIV`, `P28_PGID`, `P28_RUNNER`, `P28_UTC` e `P28_BUN` conforme acima. Conferir novamente que `P28_PGID` é o ID do **fictício recém-criado**, não nome/ID de uma stack existente. Com esse ID a URL `127.0.0.1` aponta somente para o banco fictício compartilhado pelo runner.

```bash
set -euo pipefail
umask 077
: "${P28_SRC:?}" "${P28_PRIV:?}" "${P28_PGID:?}" "${P28_RUNNER:?}" "${P28_UTC:?}" "${P28_BUN:?}"
test "$(docker inspect "$P28_PGID" --format '{{index .Config.Labels "p28.pr38"}}')" = ensaio
test "$(docker inspect "$P28_PGID" --format '{{index .Config.Labels "p28.papel"}}')" = pg-ficticio
test "$(docker inspect "$P28_PGID" --format '{{index .Config.Labels "p28.operacao"}}')" = "$P28_UTC"
test "$(docker inspect "$P28_PGID" --format '{{.HostConfig.NetworkMode}}')" = none
P28_RC=0
docker run --rm --name "$P28_RUNNER" \
  --label p28.pr38=ensaio --label p28.papel=runner-ensaio --label "p28.operacao=$P28_UTC" \
  --network "container:$P28_PGID" \
  --user 0:0 --read-only --cap-drop ALL --security-opt no-new-privileges \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=256m,mode=1777 \
  --mount "type=bind,src=$P28_SRC,dst=/work,readonly" \
  --mount "type=bind,src=$P28_PRIV,dst=/priv,readonly" \
  -w /work -e P28_PG_URL_ARQUIVO=/priv/conexao-ficticio.url \
  "$P28_BUN" bun test ferramentas/p28-drive > "$P28_PRIV/testes.log" 2>&1 || P28_RC=$?
printf 'Código de saída da suíte: %s\n' "$P28_RC"
```

Executar em Bash com `set -euo pipefail` e `umask 077`, como no preparo; falha nas conferências deve impedir a suíte. Raiz/fonte/entrada somente leitura, usuário que consegue ler o 0600, `/tmp` descartável. Sem Docker socket, mount amplo de `/root`, porta pública ou conexão de produção. Não trocar a guarda ou a rede para fazer testes passarem.

## 5. Critério e leitura do log

- **93 aprovados, zero falhas, zero pulados, saída 0**; distribuição esperada **34 unidade + 37 bancada + 22 PostgreSQL**. Conferir o log original, não apenas um extrator/resumo. Linux reportou 605 asserções na revisão; o objetivo é todos os casos sem omitir PostgreSQL.
- Registrar todas as linhas `[apoio] porta … ocupada antes do início` e o resumo final de realocações. As marcadas **“provocada pelo teste”** são regressões esperadas; houve três na rodada própria do Codex. Qualquer linha **sem “provocada”** deve aparecer na devolutiva, mesmo se a tentativa limitada resolver e a suíte ficar verde.
- A bancada real deve continuar recusando sua porta configurada ocupada; as realocações são somente do apoio de testes. Não configurar URI/porta Google, liberar 8765 ao público ou iniciar consentimento.
- Se falhar, preservar a corrida inteira e encerrar os recursos próprios; devolver o erro. Não repetir a suíte até obter verde nem aceitar a união de resultados parciais.

## 6. Limpeza e devolutiva

Encerrar primeiro apenas o runner desta operação, se ainda existir; depois conferir ID/labels do PostgreSQL fictício e removê-lo com seu volume anônimo (`docker rm -fv` pelo **ID guardado**). Apagar senha/URL descartáveis do ensaio. Preservar fonte, manifesto e log privado, com 0700/0600; não apagar arquivos da primeira etapa ou outros volumes.

Conferir ausência de containers desta operação com os filtros **`p28.pr38=ensaio` e `p28.operacao=<UTC>`**, não apenas o label antigo `p28.pr37`. Comparar IDs/horários/estado dos serviços existentes sem reiniciá-los. Sem limpeza global.

Retornar um Markdown objetivo: horário Brasília/UTC; commit/árvore/19 blobs e SHA-256 do transporte; imagens/versões/IDs; isolamento/portas/mounts; saída e contagens por arquivo; realocações provocadas/não provocadas; caminhos/modos; limpeza e diferenças dos serviços existentes. Nenhuma senha, URL privada ou token. Não é necessário outro relatório geral do Claude/TI.

**Encerramento de A:** somente após essa execução integral limpa e limpeza comprovada. Captura protegida B, Google/ensaio real C e virada D continuam fora deste reensaio e dependem de suas próprias etapas. A correção e o merge #38, por si, não concluem A nem migram o Drive.
