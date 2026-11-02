# P-28 — Para TI: roteiro T1 fictício do transporte — concluído

**T1 executado pela TI em 02/11 e conferido:** [resultado, horários e limites](2026-11-02-flow-t1-concluido-p28.md). Autorização relatada para usar o box da TI no lugar do Mac; socat instalado, quatro HTTP atendidos e limpeza conferida. **Não repetir este roteiro.** Próximo: [requisitos restantes de C](2026-11-02-ti-flow-requisitos-restantes-c-p28.md), sem executar C/D. O texto abaixo preserva o procedimento original e seus pré-requisitos; as referências a execução futura descrevem seu estado na elaboração.

## 1. Efeitos exatos e pré-condições

- Host VPS `187.127.60.78`, root/TI. Imagem Bun **`oven/bun:1.4.2@sha256:296a79bbc988bb0a91ef11099af70a78a8cba98b73fd53f7b2a7715b7c86ced2`** já usada em A/B; conferir presença/arquitetura antes, sem `latest`.
- Instalação proposta **`socat=1.8.0.0-4ubuntu0.1`**. Simulação própria retornou um pacote novo, zero atualizações/remoções. Repetir a simulação antes de instalar; se o plano mudar, parar e apresentar a diferença. Sem `apt update`, `upgrade`, `autoremove` ou remoção de outros pacotes. `socat` permanece instalado após T1; não há desinstalação automática.
- Diretório novo **`/root/flow-p28-t1-<UTC>/`**, 0700/root, somente scripts fictícios/logs. Não montar fonte do Flow, pasta C com credenciais ou backup B.
- Um container exclusivo `flow-p28-t1-<UTC>`, labels `p28.etapa=T1` e `p28.operacao=<UTC>`, **`--network none`**, nenhuma porta publicada, usuário 0:0, raiz RO, capacidades removidas e sem Docker socket.
- Porta **127.0.0.1:8765** livre na VPS e no Mac. Se ocupada, identificar o dono e parar; não matar processos por porta ou trocar URI/configuração real.

## 2. Scripts fictícios completos

Criar, após autorização, os dois arquivos abaixo na pasta nova. Dono root, arquivos 0400; o diretório fica 0700. Sem importações da aplicação ou acesso ao Google. Porta 0 no servidor abaixo existe apenas para o teste local isolado; **na VPS o argumento é 8765**, sem alterar a validação da bancada real.

**`servidor.mjs`:**

```javascript
const porta = Number(process.argv[2] ?? "8765");
if (!Number.isInteger(porta) || porta < 0 || porta > 65535) {
  throw new Error("porta ficticia invalida");
}
const servidor = Bun.serve({
  hostname: "127.0.0.1",
  port: porta,
  fetch(req) {
    const headers = {
      "content-type": "text/plain",
      "cache-control": "no-store",
      connection: "close",
    };
    if (req.headers.get("host") !== `127.0.0.1:${servidor.port}`) {
      return new Response("host recusado", { status: 421, headers });
    }
    if (req.method !== "GET") return new Response("metodo recusado", { status: 405, headers });
    if (new URL(req.url).pathname !== "/")
      return new Response("rota ausente", { status: 404, headers });
    return new Response("p28-t1-ficticio", { status: 200, headers });
  },
});
console.log(JSON.stringify({ ficticio: true, host: "127.0.0.1", porta: servidor.port }));
```

**`retransmissor.mjs`:**

```javascript
import { createConnection } from "node:net";
const porta = Number(process.argv[2] ?? "8765");
if (!Number.isInteger(porta) || porta < 1024 || porta > 65535) {
  throw new Error("porta de destino invalida");
}
const destino = createConnection({ host: "127.0.0.1", port: porta, allowHalfOpen: true });
destino.once("connect", () => {
  process.stdin.pipe(destino);
  destino.pipe(process.stdout);
});
destino.setTimeout(120_000, () => destino.destroy(new Error("prazo esgotado")));
destino.on("error", () => {
  process.exitCode = 1;
});
process.stdin.on("error", () => destino.destroy());
process.stdout.on("error", () => destino.destroy());
destino.on("end", () => {
  process.stdin.unpipe(destino);
  process.stdin.destroy();
  destino.end();
});
destino.on("close", () => {
  process.stdin.unpipe(destino);
  process.stdin.destroy();
  process.stdout.end();
});
```

O retransmissor só conecta ao loopback da porta indicada. Não interpreta requisições nem registra URLs/corpos. O `socat` do host abre `docker exec` no ID imutável do container; não depende de PID host reutilizável ou de um script Python incompleto.

## 3. Instalação e container — após autorização T1

Registrar antes IDs/início/saúde dos serviços existentes; não reiniciar nenhum deles. Na VPS, em Bash como root:

```bash
set -euo pipefail
umask 077
test "$(id -u)" -eq 0
apt-get -s --no-install-recommends install socat=1.8.0.0-4ubuntu0.1
# Conferir: zero upgrades/remocoes, somente socat novo. So entao:
NEEDRESTART_SUSPEND=1 apt-get -y --no-install-recommends --no-remove install socat=1.8.0.0-4ubuntu0.1
P28_T1_UTC=$(date -u +%Y%m%dT%H%M%SZ)
P28_T1_BASE=/root/flow-p28-t1-$P28_T1_UTC
P28_T1_NOME=flow-p28-t1-$P28_T1_UTC
P28_T1_BUN=oven/bun:1.4.2@sha256:296a79bbc988bb0a91ef11099af70a78a8cba98b73fd53f7b2a7715b7c86ced2
mkdir -m 700 "$P28_T1_BASE"
# Gravar os dois scripts da secao 2, root:root/0400, antes do docker run.
test -f "$P28_T1_BASE/servidor.mjs"
test -f "$P28_T1_BASE/retransmissor.mjs"
chown root:root "$P28_T1_BASE/servidor.mjs" "$P28_T1_BASE/retransmissor.mjs"
chmod 400 "$P28_T1_BASE/servidor.mjs" "$P28_T1_BASE/retransmissor.mjs"
P28_T1_ID=$(docker run -d --name "$P28_T1_NOME" \
  --label p28.etapa=T1 --label "p28.operacao=$P28_T1_UTC" \
  --network none --user 0:0 --read-only --cap-drop ALL --security-opt no-new-privileges \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m,mode=1777 \
  --mount "type=bind,src=$P28_T1_BASE,dst=/t1,readonly" \
  -w /t1 "$P28_T1_BUN" bun /t1/servidor.mjs 8765)
test "$(docker inspect "$P28_T1_ID" --format '{{index .Config.Labels "p28.etapa"}}')" = T1
test "$(docker inspect "$P28_T1_ID" --format '{{index .Config.Labels "p28.operacao"}}')" = "$P28_T1_UTC"
test "$(docker inspect "$P28_T1_ID" --format '{{.HostConfig.NetworkMode}}')" = none
docker inspect "$P28_T1_ID" --format '{{.Id}} {{.State.Running}} {{.HostConfig.PortBindings}}'
docker logs "$P28_T1_ID"
```

Conferir container em execução, sem PortBindings e mensagem fictícia de pronto em 127.0.0.1:8765. O comentário de conferência APT não é uma aprovação automática; se já houver versão instalada ou plano diferente, não reinstalar/downgradear silenciosamente. Registrar a situação para ajustar o passo.

`NEEDRESTART_SUSPEND=1` vale somente para esse comando: o hook APT da VPS foi lido e confirma que ele evita iniciar o `needrestart`. Não editar a configuração permanente nem aceitar reinícios de serviços por este teste; manutenção pendente continua fora do escopo. A simulação de pacotes não é, sozinha, garantia de que hooks não tentariam reiniciar serviços.

## 4. Ponte e túnel — sessões dedicadas em primeiro plano

Na VPS, manter as variáveis da criação ou recuperar **o ID completo guardado** e conferir seus labels. Em uma sessão dedicada, manter o comando em primeiro plano:

```bash
set -euo pipefail
case "$P28_T1_ID" in *[!a-f0-9]*|"") exit 1 ;; esac
test "${#P28_T1_ID}" -eq 64
test "$(docker inspect "$P28_T1_ID" --format '{{index .Config.Labels "p28.etapa"}}')" = T1
test "$(docker inspect "$P28_T1_ID" --format '{{index .Config.Labels "p28.operacao"}}')" = "$P28_T1_UTC"
socat TCP4-LISTEN:8765,bind=127.0.0.1,reuseaddr,fork \
  "EXEC:docker exec -i $P28_T1_ID bun /t1/retransmissor.mjs 8765"
```

Sem `-t`, `-v`, `-x` ou logs de payload. Se o container morrer, o ID não é redirecionado a outro processo; `docker exec` falha. Não trocar para nome de outro container ou PID para contornar erro.

No Mac da TI/operador, outra sessão dedicada:

```bash
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=2 \
  -L 127.0.0.1:8765:127.0.0.1:8765 root@187.127.60.78
```

Conferir no host e Mac que a porta escuta **somente 127.0.0.1**, não IPv6 aberto ou todas as interfaces. Não cadastrar URI Google para esses testes.

## 5. Critérios no Mac e limpeza

Executar em outra sessão do Mac, pelo túnel:

```bash
curl --noproxy '*' -fsS http://127.0.0.1:8765/
curl --noproxy '*' -sS -o /dev/null -w '%{http_code}\n' -H 'Host: errado.invalid' http://127.0.0.1:8765/
curl --noproxy '*' -sS -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:8765/
curl --noproxy '*' -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8765/oauth/callback
```

Esperado, nessa ordem: **`p28-t1-ficticio`, 421, 405, 404**. O callback fictício 404 não abre OAuth. Confirmar ainda o ID/labels, rede none, ausência de porta Docker publicada, mounts só da pasta T1 e nenhum acesso a B, credencial ou banco. Falha de resolução DNS não é usada como única prova de isolamento; o runner não tem rede externa.

Encerrar nesta ordem: **ponte socat (Ctrl+C na sua sessão) → túnel SSH (Ctrl+C) → container fictício pelo ID guardado**. Antes de remover o container, reconferir labels T1/operação; usar `docker rm -f "$P28_T1_ID"`, sem volumes globais ou redes de outras stacks. Não usar `pkill`, PID de arquivo público em `/tmp`, `prune` ou desinstalação automática de pacote.

Conferir: zero containers dos labels T1/operação; porta 8765 sem listener na VPS/Mac; sem retransmissores da operação; IDs/início/saúde dos serviços anteriores preservados. Se alguma sessão falhar, identificar apenas seus processos/ID antes de encerrar. Preservar pasta/logs T1; fonte/cópia A/B permanecem intactas.

**Devolutiva TI:** horários Brasília/UTC, simulação/instalação e versão socat, imagem/ID/labels, rede/portas/mounts, quatro resultados HTTP, encerramento e comparação de serviços. Sem contas, tokens ou Google. T1 só será concluído após esse resultado real; nenhuma execução VPS está atestada por este pacote.

Depois de T1, retomar as pendências específicas de C real: segredo novo previamente guardado, manifesto privado sob TI/Guardião, propriedade/custódia e URI. Consentimento e candidato continuam exigindo decisão própria; D não está incluída.

**Validação prévia do pacote:** seis verificações locais dos scripts fictícios aprovadas após corrigir encerramento com stdin aberto. Não executaram socat, SSH ou VPS. Tipos, 301 testes Barba & Cabelo, formatação dos oito documentos e montagem aprovados; 20 links/âncoras locais e quatro blocos Bash conferidos. Esse era o estado prévio; execução real T1/instalação posteriormente atendidas conforme o resultado no topo.
