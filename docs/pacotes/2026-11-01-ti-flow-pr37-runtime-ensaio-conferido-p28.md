# P-28 — PR #37 integrado e procedimento TI conferido

**Atualização de 01/11 — A concluída, não repetir:** reensaio #38 pela TI às 21:45 Brasília, **93/0/0**, 22 PG 15.19, limpeza e conferências do Codex registrados no [resultado de A](2026-11-01-flow-etapa-a-concluida-p28.md). Próximo é [decidir B — captura protegida](2026-11-01-ti-flow-captura-protegida-b-p28.md), pacote preparado, sem autorização/execução real. O texto abaixo é o modelo operacional anterior; seus códigos/contagens/estados de A pendente são históricos. Não executar fonte antiga, repetir testes, PR/merge ou #36. C/D próprios.

## 1. Merge e evidências conferidas

Alyson informou “PR #37 aprovado”. A consulta ao GitHub encontrou o [PR #37](https://github.com/Proh2026Media/flow-proh-media/pull/37) **já integrado externamente às 18:57:00 Brasília / 21:57:00 UTC de 01/11**. Não foi feito um segundo merge pelo Codex.

| Item                       | Resultado                                                                                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commit integrado           | `13f1dc9bc50d3ac15f62944d832a02cd66ef3a2a`                                                                                                                           |
| Head revisado              | `67e7fb785b7c11163438aa82a41e3d947a3ff212`                                                                                                                           |
| Árvore dos dois commits    | **Idêntica:** `ef708d8e4fd6cd24afc79d568f6d5682615982a7`                                                                                                             |
| Origem e espelho           | `Proh2026Media/flow-proh-media` e `PROH-Media/flow-proh-media`, main no commit integrado                                                                             |
| Aviso ao hub               | [Concluído com sucesso](https://github.com/Proh2026Media/flow-proh-media/actions/runs/41354592901); não é teste nem comprovação de instalação das ferramentas na VPS |
| Testes próprios anteriores | **86 testes, 576 asserções e quatro casos independentes aprovados**; código idêntico, sem nova rodada desnecessária                                                  |

Merge e espelhamento entregam as ferramentas no repositório. Não instalam Bun, não criam cópia das integrações e não migram o Google Drive. A proteção #36 instalada e o diagnóstico administrativo de 15:32:55 continuam atendidos.

## 2. Anexo da TI e ajustes do procedimento

Lido integralmente **`procedimento-ti-flow-pr37-runtime-ensaio-p28-2026-11-03.md`**. Apesar de 03/11 no nome, seu cabeçalho registra **01/11, 18:55–18:56 Brasília**. A indicação “draft/aberto” era válida antes do merge de 18:57 e está superada.

A TI relata leitura, sem execução: arquitetura amd64, root, umask 0022, 166 GB livres, Bun ausente, PostgreSQL em cache e porta 8765 livre naquele instante. Os testes do Codex não são testes executados pela TI. A fonte efetiva em banco foi reaproveitada do levantamento anterior, sem nova consulta de presença das variáveis. Não houve pull, container, captura, OAuth ou mudança de cron/env/Google nessa preparação.

O desenho de fonte somente leitura, imagem fixada, arquivos privados e namespace exclusivo do banco fictício é adequado para a etapa A, com estes ajustes concretos:

1. **Comando de PostgreSQL (§4.4):** retirar o comentário `# SEM -p` do meio da continuação com `\`. Ele encerra o comando antes de `--env-file`. O comando corrigido está na seção 3.
2. **Isolamento fictício:** usar `--network none` no PostgreSQL e `--network container:<ID-exato>` no runner. O loopback compartilhado atende à guarda; não há porta publicada nem acesso à rede de produção. O apoio da suíte já cria o esquema/marcador fictícios; não aplicá-los no banco real.
3. **Senha e descarte do fictício:** usar `POSTGRES_PASSWORD_FILE` com um arquivo descartável 0600. Remover o container fictício com `docker rm -v` para descartar também seu volume anônimo; nunca usar limpeza global. Preservar logs/fontes até decisão de descarte.
4. **OAuth (§4.8), somente para etapa futura C:** o comando `bun … iniciar` no host não corresponde ao runtime Docker proposto. Um listener em `127.0.0.1` dentro do container também não fica acessível ao túnel do host apenas por publicar uma porta Docker. Antes de C, fechar esse transporte explicitamente, por exemplo um túnel cujo destino termine no mesmo namespace do servidor da bancada. Não instalar Bun no host nem mudar o bind/usar rede host para contornar o ponto. Isso não impede A.

O roteiro abaixo contempla somente runtime e testes fictícios. Os comandos de captura e OAuth do anexo continuam propostas para suas etapas próprias.

**Validação desta preparação:** três blocos Bash abaixo passaram por `bash -n`; nenhum comando foi executado. Documentos/links conferidos, tipos, 301 testes Barba & Cabelo, formatação e montagem aprovados. Isso verifica a documentação e o repositório de acompanhamento; o resultado real da suíte na VPS só poderá ser registrado após A.

## 3. Etapa A pronta para decisão — runtime e suíte fictícia na VPS

**Efeitos propostos:** baixar a imagem Bun fixada, copiar somente as ferramentas do commit integrado para fora das stacks, criar um PostgreSQL temporário exclusivo, executar a suíte e remover seus containers/volume. Sem conexão, cópia ou credencial de produção. Operador Google, IDs de arquivos antigos e cliente novo não são necessários para A.

### 3.1 Fonte e transporte, na máquina com acesso ao GitHub

Executar em Bash **após autorização A**. O clone fica temporário na máquina do executor; somente o arquivo exportado chega à VPS, sem `.git`, `.env` ou credenciais de acesso ao GitHub.

```bash
set -euo pipefail
umask 077
P28_COMMIT=13f1dc9bc50d3ac15f62944d832a02cd66ef3a2a
P28_LOCAL=$(mktemp -d /tmp/flow-pr37-fonte.XXXXXX)
gh repo clone Proh2026Media/flow-proh-media "$P28_LOCAL/repo" -- --filter=blob:none --no-checkout
git -C "$P28_LOCAL/repo" cat-file -e "$P28_COMMIT^{commit}"
test "$(git -C "$P28_LOCAL/repo" rev-parse "$P28_COMMIT^{tree}")" = ef708d8e4fd6cd24afc79d568f6d5682615982a7
git -C "$P28_LOCAL/repo" archive --format=tar "$P28_COMMIT" ferramentas/p28-drive > "$P28_LOCAL/fonte.tar"
git -C "$P28_LOCAL/repo" ls-tree -r "$P28_COMMIT" ferramentas/p28-drive > "$P28_LOCAL/blobs.txt"
(
  cd "$P28_LOCAL"
  shasum -a 256 fonte.tar > fonte.sha256
)
ssh root@187.127.60.78 'test ! -e /root/fonte.tar && test ! -e /root/fonte.sha256 && test ! -e /root/blobs.txt'
scp "$P28_LOCAL/fonte.tar" "$P28_LOCAL/fonte.sha256" "$P28_LOCAL/blobs.txt" root@187.127.60.78:/root/
```

Não sobrescrever arquivos `fonte.tar`, `fonte.sha256` ou `blobs.txt` que já pertençam a outra operação: conferir antes e, se ocupados, usar nomes exclusivos de transporte em ambos os lados. Não enviar o clone inteiro. O tar exportado contém só `ferramentas/p28-drive/`.

### 3.2 Preparação e alvo fictício, em Bash como root na VPS

Registrar antes os IDs/horários de início dos containers existentes para comparar depois. Revalidar arquitetura, espaço e disponibilidade dos nomes abaixo. Se os nomes já existirem, parar e identificar seus donos; não remover por nome para abrir espaço.

```bash
set -euo pipefail
umask 077
test "$(id -u)" = 0
test "$(uname -m)" = x86_64
P28_UTC=$(date -u +%Y%m%dT%H%M%SZ)
P28_BASE=/root/flow-pr37-$P28_UTC
P28_SRC=$P28_BASE/src
P28_PRIV=$P28_BASE/priv
P28_PG=flow-p28-pg15-ficticio
P28_RUNNER=flow-p28-pr37-ensaio
P28_BUN=oven/bun:1.4.2@sha256:296a79bbc988bb0a91ef11099af70a78a8cba98b73fd53f7b2a7715b7c86ced2
P28_PGIMG=postgres:15-alpine@sha256:54e0dd8e8cddcdbb9156c2486eed5a43eccb7214d7c6828097d41ce049fb3984
if docker container inspect "$P28_PG" >/dev/null 2>&1; then
  printf 'Nome do PostgreSQL fictício ocupado; identificar antes de continuar.\n' >&2
  exit 1
fi
if docker container inspect "$P28_RUNNER" >/dev/null 2>&1; then
  printf 'Nome do runner ocupado; identificar antes de continuar.\n' >&2
  exit 1
fi
mkdir -m 700 "$P28_BASE"
mkdir -m 700 "$P28_SRC" "$P28_PRIV"
cd /root
sha256sum -c fonte.sha256
tar -xf fonte.tar -C "$P28_SRC"
test -f "$P28_SRC/ferramentas/p28-drive/teste/postgres.test.ts"
mv fonte.tar fonte.sha256 blobs.txt "$P28_BASE/"
chmod -R a-w "$P28_SRC"
docker pull "$P28_BUN"
docker image inspect "$P28_BUN" --format '{{.Id}} {{.Os}}/{{.Architecture}} {{.RepoDigests}}'
docker image inspect "$P28_PGIMG" --format '{{.Id}} {{.Os}}/{{.Architecture}} {{.RepoDigests}}'
docker run --rm --network none --user 0:0 --read-only \
  --cap-drop ALL --security-opt no-new-privileges \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m,mode=1777 \
  "$P28_BUN" bun --version
openssl rand -hex 24 > "$P28_PRIV/pg.password"
chmod 600 "$P28_PRIV/pg.password"
printf 'postgres://postgres:%s@127.0.0.1:5432/postgres\n' "$(cat "$P28_PRIV/pg.password")" > "$P28_PRIV/conexao-ficticio.url"
chmod 600 "$P28_PRIV/conexao-ficticio.url"
P28_PGID=$(docker run -d --name "$P28_PG" \
  --label p28.pr37=ensaio --label p28.papel=pg-ficticio \
  --network none --restart=no \
  -e POSTGRES_PASSWORD_FILE=/p28-senha \
  --mount "type=bind,src=$P28_PRIV/pg.password,dst=/p28-senha,readonly" \
  "$P28_PGIMG")
docker inspect "$P28_PGID" --format '{{.Id}} {{.Name}} {{.Config.Labels}} {{.HostConfig.NetworkMode}} {{.HostConfig.PortBindings}}'
```

Conferir **namespace `none` e nenhuma porta publicada**. Aguardar `docker exec "$P28_PGID" pg_isready -h 127.0.0.1 -U postgres`, com prazo máximo de 60 segundos; falha exige encerramento do fictício, sem trocar a URL por outra stack. O uso do arquivo de senha evita pôr seu valor em argv; é uma senha exclusivamente descartável deste ensaio.

### 3.3 Suíte e encerramento

Continuar na mesma sessão Bash, preservando as variáveis. Capturar o código de saída; não considerar sucesso uma execução que pule os 22 testes PostgreSQL. Nenhum arquivo de configuração Google é necessário para a suíte.

```bash
P28_RC=0
docker run --rm --name "$P28_RUNNER" \
  --label p28.pr37=ensaio --label p28.papel=runner-ensaio \
  --network "container:$P28_PGID" \
  --user 0:0 --read-only --cap-drop ALL --security-opt no-new-privileges \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=256m,mode=1777 \
  --mount "type=bind,src=$P28_SRC,dst=/work,readonly" \
  --mount "type=bind,src=$P28_PRIV,dst=/priv,readonly" \
  -w /work -e P28_PG_URL_ARQUIVO=/priv/conexao-ficticio.url \
  "$P28_BUN" bun test ferramentas/p28-drive > "$P28_PRIV/testes.log" 2>&1 || P28_RC=$?
printf 'Código de saída da suíte: %s\n' "$P28_RC"
test "$(docker inspect "$P28_PGID" --format '{{index .Config.Labels "p28.papel"}}')" = pg-ficticio
docker rm -fv "$P28_PGID"
rm -f "$P28_PRIV/pg.password" "$P28_PRIV/conexao-ficticio.url"
docker ps -a --filter label=p28.pr37=ensaio --format '{{.ID}} {{.Names}} {{.Status}}'
```

Revisar o resumo privado do log: expectativa **86 aprovados, zero falhas e zero pulados**, incluindo PostgreSQL. A versão alpine em cache pode diferir da 15.8 da revisão local: registrar `SHOW server_version` no banco fictício, sem atribuir-lhe uma versão ainda não executada.

Se houver interrupção, encerrar primeiro somente o runner criado nesta operação, conferindo seu label/ID; depois remover o PostgreSQL pelo ID guardado com seu volume (`-v`). Comparar IDs/horários/saúde dos containers anteriores e registrar qualquer diferença. Não reiniciar serviços existentes nem apagar fontes/logs/backups reais. A ausência do fictício e do runner deve ser comprovada; a imagem Bun e as fontes podem permanecer para as próximas etapas, sem processo ativo.

**Devolutiva de A:** commit/árvore, digests e IDs, versão Bun/PostgreSQL, isolamento/portas/mounts, resumo dos testes e saída, caminhos/modos privados, limpeza e comparação dos serviços existentes. Sem tokens ou valores de produção. Nenhum inventário geral novo ou relatório do Claude é necessário para autorizar esse ensaio.

## 4. O que vem depois

| Etapa                         | Situação e decisão necessária                                                                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — runtime e ensaio fictício | Procedimento acima pronto; aguarda autorização específica de Alyson. Não executado na VPS pelo Codex nesta rodada                                                                               |
| B — captura protegida         | Depois de A aprovado: revalidar presença das quatro variáveis, conexão privada e janela; capturar/validar em diretório 0700/arquivos 0600. Precisa decisão própria; sem restauração de produção |
| C — Google/ensaio real        | Operador/conta, manifesto privado de IDs, custódia, metadados Google e transporte do callback ainda por concluir; URI/consentimento próprios. Não bloqueiam A                                   |
| D — virada                    | Procedimento próprio com barreira contra cron, requisições e callbacks, promoção coerente, cache e aceitação; não autorizado pelo merge ou pelos testes                                         |

**Próxima decisão concreta:** autorizar somente A — runtime Docker temporário e suíte integral com dados fictícios, seguida de limpeza dos containers/volume de ensaio. B, C e D não estão incluídas nessa decisão. P-28 permanece pendente; #36, cliente Barba & Cabelo e cron atual preservados.
