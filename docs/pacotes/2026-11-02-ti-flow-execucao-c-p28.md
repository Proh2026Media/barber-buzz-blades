# P-28 — Para TI/Guardião: roteiro C — executado parcialmente

**Executado pela TI em 02/11, resultado parcial:** [resumo/limites e retirada dos temporários](2026-11-02-flow-etapa-c-parcial-p28.md), candidato privado preservado, raiz 404 e exit 2. Não repetir este roteiro, consentimento ou renovação para contornar o acesso. C autorizada já executada; não pedir a mesma decisão novamente. Próximo: [Claude preparar modo seletivo Picker com testes fictícios](2026-11-02-claude-flow-picker-seletivo-p28.md), sem Google real/D. O restante preserva o procedimento original, inclusive o encerramento já cumprido; referências a decisão futura descrevem seu estado na elaboração.

## 1. Efeitos delimitados de C

- Temporários na VPS: duas bridges, dois containers Bun fixados, cadeias/saltos de firewall exclusivos da interface C, servidor fictício só no gateway C, ponte socat loopback e túnel no box TI. Sem pacote novo/restart, rede host, porta Docker publicada ou socket Docker dentro do runner.
- Verificação do isolamento **antes de credencial**; depois, adicionar URI local no cliente novo preservando produção, depositar o segredo já guardado e extrair de B **somente IDs necessários**, sem levar tokens/segredos antigos para C.
- Um consentimento Google com a conta Drive atual e escopo **somente drive.file**; candidato separado, GETs de metadados antigos e renovação imediata e após vencimento. Preservar candidato parcial/evidências e retirar recursos temporários próprios.
- Sem promoção nas integrações vivas, `configure`, `status`, nova raiz, upload, compartilhamento, revogação, DNS/IAM/Branding ou D. A URI local adicionada permanece no cliente novo para esta bancada; não há remoção automática.

Falha não autoriza ampliar escopo, trocar conta, recriar segredo ou repetir consentimento automaticamente. O cliente Auth Barba & Cabelo permanece preservado. A execução só começa depois da decisão do dono; o recebimento deste arquivo não a substitui.

## 2. Pré-condições e variáveis — após decisão

VPS `187.127.60.78`, root/TI; navegador no box TI do túnel. Confirmar porta 8765 livre nos dois lados, sem matar ocupantes. Conferir os 19 blobs da fonte preservada contra o manifesto #38 já registrado, sem repetir a suíte. Registrar IDs/inícios/saúde do banco/funções Flow e contagem de containers para comparação posterior.

Conferir **172.16.10.0/24 e 198.18.0.0/29 sem conflito com redes Docker/rotas/VPN**; parar se houver conflito, sem alterar redes existentes. Conferir backend iptables/DOCKER-USER ativo e as três regras anteriores preservadas. Os comandos não migram backend. A porta 18080 do gateway futuro deve estar livre.

Na mesma sessão Bash root, conservar as variáveis até a retirada:

```bash
set -euo pipefail
umask 077
test "$(id -u)" -eq 0
P28_C_TAG=$(python3 -c 'import secrets; print(secrets.token_hex(4))')
P28_C_OP=$(date -u +%Y%m%dT%H%M%SZ)-$P28_C_TAG
P28_C_BASE=/root/flow-p28-c-$P28_C_OP
P28_C_NET=flow-p28-c-$P28_C_OP
P28_C_TESTNET=flow-p28-c-ficticio-$P28_C_OP
P28_C_BR=p28c$P28_C_TAG
P28_C_F=P28CF_$P28_C_TAG
P28_C_I=P28CI_$P28_C_TAG
P28_C_GW=172.16.10.1
P28_C_SRC=/root/flow-pr38-20261102T004233Z/src
P28_C_BUN=oven/bun:1.4.2@sha256:296a79bbc988bb0a91ef11099af70a78a8cba98b73fd53f7b2a7715b7c86ced2
mkdir -m 700 "$P28_C_BASE"
mkdir -m 700 "$P28_C_BASE"/{cred,config,candidato,evid,ficticio}
printf '%s' p28-c-rede-ficticia > "$P28_C_BASE/ficticio/index.html"
docker image inspect "$P28_C_BUN" --format '{{.Architecture}}'
P28_C_NET_ID=$(docker network create --driver bridge \
  --subnet 172.16.10.0/24 --gateway "$P28_C_GW" \
  -o "com.docker.network.bridge.name=$P28_C_BR" \
  -o com.docker.network.bridge.enable_icc=false \
  --label p28.etapa=C --label "p28.operacao=$P28_C_OP" "$P28_C_NET")
```

Esperado amd64; rede somente no bloco escolhido e **EnableIPv6=false**. Conferir labels/ID completo; sem credencial nesta fase. Registrar variáveis operacionais, IDs completos e recursos parciais em arquivo 0600 de `evid/`, atualizando-o após cada criação; não depender só da memória da sessão para a retirada. Nomes exclusivos não autorizam reutilizar cadeia/interface já existente: se uma criação colidir, parar e identificar.

## 3. Política de rede completa antes do runner

INPUT bloqueia serviços do próprio host; DOCKER-USER restringe encaminhamento. Saltos delimitados pela **interface exclusiva C**, sem reescrever regras Tailscale/produção. Primeiro preencher as cadeias, depois ligá-las; não inserir ACCEPT genérico de conexões estabelecidas antes dos bloqueios.

```bash
iptables -w -N "$P28_C_F"
iptables -w -N "$P28_C_I"
iptables -w -A "$P28_C_I" -j DROP
for P28_C_D in 0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 \
  169.254.0.0/16 172.16.0.0/12 192.0.0.0/24 192.0.2.0/24 \
  192.168.0.0/16 198.18.0.0/15 198.51.100.0/24 203.0.113.0/24 \
  224.0.0.0/4 240.0.0.0/4
do
  iptables -w -A "$P28_C_F" -d "$P28_C_D" -j DROP
done
iptables -w -A "$P28_C_F" -d 187.127.60.78/32 -j DROP
for P28_C_DNS in 1.1.1.1 1.0.0.1; do
  iptables -w -A "$P28_C_F" -d "$P28_C_DNS" -p udp --dport 53 -j ACCEPT
  iptables -w -A "$P28_C_F" -d "$P28_C_DNS" -p tcp --dport 53 -j ACCEPT
done
iptables -w -A "$P28_C_F" -p tcp --dport 443 -j ACCEPT
iptables -w -A "$P28_C_F" -j DROP
iptables -w -I DOCKER-USER 1 -i "$P28_C_BR" \
  -m comment --comment "$P28_C_OP" -j "$P28_C_F"
iptables -w -I INPUT 1 -i "$P28_C_BR" \
  -m comment --comment "$P28_C_OP" -j "$P28_C_I"
iptables -w -C DOCKER-USER -i "$P28_C_BR" \
  -m comment --comment "$P28_C_OP" -j "$P28_C_F"
iptables -w -C INPUT -i "$P28_C_BR" \
  -m comment --comment "$P28_C_OP" -j "$P28_C_I"
```

Conferir saltos no início das cadeias. Outros pacotes não casam com a interface C e seguem o caminho anterior. TCP/443 para destinos públicos é geral; **a ferramenta revisada restringe métodos/URLs Google**. Considerar DNAT e DNS embedded Docker: timeout ou `--dns` sozinho não prova o caminho do resolver. Se INPUT impedir DNS/HTTPS, não abrir acesso genérico ao host; parar antes da credencial.

Falha durante criação: não iniciar runner; retirar apenas recursos comprovadamente criados pela operação. Sem flush global, restauração global de firewall ou `|| true` mascarando erro.

## 4. UID coerente e verificação sem credenciais

Root 0:0 é necessário para fonte root 0500/0400 e arquivos privados root 0700/0600. Não abrir permissões nem manter a proposta C2 UID 1000.

```bash
P28_C_ID=$(docker run -d --name "flow-p28-c-bancada-$P28_C_OP" \
  --label p28.etapa=C --label "p28.operacao=$P28_C_OP" --label p28.papel=bancada \
  --network "$P28_C_NET_ID" --dns 1.1.1.1 --dns 1.0.0.1 \
  --user 0:0 --read-only --cap-drop ALL --security-opt no-new-privileges \
  --sysctl net.ipv6.conf.all.disable_ipv6=1 \
  --sysctl net.ipv6.conf.default.disable_ipv6=1 \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=128m,mode=1777 \
  --mount "type=bind,src=$P28_C_SRC,dst=/work,readonly" \
  --mount "type=bind,src=$P28_C_BASE,dst=/priv" \
  -w /work "$P28_C_BUN" sleep infinity)
docker exec "$P28_C_ID" bun -e \
  'import {readFileSync} from "node:fs";readFileSync("ferramentas/p28-drive/README.md");if(process.getuid()!==0)process.exit(2);console.log("fonte_legivel_uid_coerente")'
P28_C_TESTNET_ID=$(docker network create --driver bridge --subnet 198.18.0.0/29 \
  --label p28.etapa=C --label "p28.operacao=$P28_C_OP" "$P28_C_TESTNET")
P28_C_FIX_ID=$(docker run -d --name "flow-p28-c-ficticio-$P28_C_OP" \
  --label p28.etapa=C --label "p28.operacao=$P28_C_OP" --label p28.papel=ficticio \
  --network "$P28_C_TESTNET_ID" --ip 198.18.0.2 --user 0:0 \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  "$P28_C_BUN" bun -e \
  'Bun.serve({hostname:"0.0.0.0",port:8080,fetch(){return new Response("p28-c-rede-ficticia")}})')
docker exec "$P28_C_FIX_ID" bun -e \
  'let pronto=false;for(let i=0;i<30;i++){try{const r=await fetch("http://127.0.0.1:8080",{signal:AbortSignal.timeout(500)});if(await r.text()==="p28-c-rede-ficticia"){pronto=true;break}}catch{}await Bun.sleep(100)}if(!pronto)process.exit(2);console.log("alvo_ficticio_ativo")'
```

Conferir nos dois IDs completos labels/estado/redes, nenhuma PortBindings, raiz RO/capacidades removidas e mounts exatos. Runner somente C; fonte RO e pasta C RW, sem B/socket. Configuração IPv6 desabilitada no runner. `/priv` ainda sem credencial/configuração/candidato. O bind 0.0.0.0 acima é só no **servidor fictício dentro da rede fictícia sem porta publicada**, nunca na bancada OAuth/host.

Em uma sessão dedicada da VPS, manter em primeiro plano o servidor fictício do host, servindo **apenas a pasta fictícia**. Definir nessa sessão `P28_C_GW` e `P28_C_BASE` com os valores não secretos desta operação:

```bash
python3 -m http.server 18080 --bind "$P28_C_GW" \
  --directory "$P28_C_BASE/ficticio"
```

Na sessão principal, após ambos estarem prontos:

```bash
test "$(curl --noproxy '*' -fsS "http://$P28_C_GW:18080/")" = p28-c-rede-ficticia
docker exec "$P28_C_ID" bun -e \
  'for(const u of ["http://172.16.10.1:18080/","http://198.18.0.2:8080/"]){try{await fetch(u,{signal:AbortSignal.timeout(2000)});console.error("acesso_indevido");process.exit(2)}catch{console.log("alvo_ficticio_inacessivel")}}'
iptables -w -nvxL "$P28_C_I"
iptables -w -nvxL "$P28_C_F"
docker exec "$P28_C_ID" bun -e \
  'for(const u of ["https://oauth2.googleapis.com/token","https://www.googleapis.com/drive/v3/about"]){const r=await fetch(u,{redirect:"error",signal:AbortSignal.timeout(10000)});if(r.status>=500)process.exit(2);console.log("https_sem_credencial",r.status)}'
```

Os últimos GETs são sondas HTTPS **sem tokens**; 4xx é compatível com endpoint que exige método/autorização. Não desabilitar TLS. Conferir contadores INPUT/DROP e encaminhamento para a faixa fictícia, regras/ordem e alvos ativos; timeout isolado não basta. Se Docker bloquear antes dessa cadeia, identificar e registrar a evidência correspondente. **Sem demonstrar proteção e saída funcional, não avançar.** Nenhum endereço da rede Flow/banco real é sondado.

Encerrar o servidor do host por Ctrl+C na sessão própria. Reconferir labels/ID antes de remover container/rede fictícios, sem remover a política da bancada:

```bash
test "$(docker inspect "$P28_C_FIX_ID" --format '{{index .Config.Labels "p28.operacao"}}')" = "$P28_C_OP"
docker rm -f "$P28_C_FIX_ID"
test "$(docker network inspect "$P28_C_TESTNET_ID" --format '{{index .Labels "p28.operacao"}}')" = "$P28_C_OP"
docker network rm "$P28_C_TESTNET_ID"
```

## 5. URI e arquivos privados — só após a fase anterior aprovada

TI/Guardião no console confirma cliente **novo** “Flow Drive (produção)”, projeto `flow-proh-media-drive` / 930474870480, e adiciona **`http://127.0.0.1:8765/oauth/callback`** se ausente, preservando `https://supabase.proh.media/functions/v1/google-drive/callback`. Registrar antes/depois sem valores privados. Não tocar no cliente antigo Flow ou Auth Barba & Cabelo.

Guardião deposita `cred/cliente-novo.json`, formato **Web**, com `web.project_id`, `web.client_id`, `web.client_secret` já guardado e `web.redirect_uris` realmente conferidas no console. Tudo root:root/0600, sem symlinks ou valores em argumentos/logs/chat. Não criar segredo novo; editar JSON não cadastra URI no Google.

TI/Guardião lê B privadamente e grava `config/manifesto-ids.json` 0600 com **somente IDs**. B não é alterada/montada no runner; nenhum token/segredo antigo sai dela. Formato ilustrativo, preenchido somente no arquivo privado:

```json
{
  "versao": 1,
  "principais": { "raiz": "<privado>", "clientes": "<privado>", "lixeira": "<privado>" },
  "referencias": ["<privado>"],
  "operador": ["<privado>"]
}
```

Cobrir arquivos antigos relevantes, não apenas pastas. Se não houver casos, documentar privadamente a ausência/limite; não inventar IDs nem declarar compatibilidade não exercitada. Cliente antigo é o OAuth Drive atual do Flow na configuração correspondente, nunca Auth B&C ou campo legado preenchido por palpite.

Criar `config/bancada.json` 0600, com caminhos **internos do container** e valores privados reais:

```json
{
  "versao": 1,
  "host": "127.0.0.1",
  "porta": 8765,
  "redirect_uri": "http://127.0.0.1:8765/oauth/callback",
  "credencial": "/priv/cred/cliente-novo.json",
  "projeto_esperado": "flow-proh-media-drive",
  "cliente_antigo_id": "<OAuth Drive Flow atual, privado>",
  "conta_esperada": "<conta Drive atual, privada>",
  "diretorio_privado": "/priv/candidato",
  "manifesto_ids": "/priv/config/manifesto-ids.json"
}
```

`conferir` valida arquivos locais, **não consulta o Google**; a confirmação de URI no console é indispensável.

```bash
if docker exec "$P28_C_ID" bun ferramentas/p28-drive/bancada/bancada.ts \
  conferir --config /priv/config/bancada.json \
  > "$P28_C_BASE/evid/conferir.json" 2> "$P28_C_BASE/evid/conferir.erro"
then P28_C_RC=0; else P28_C_RC=$?; fi
printf '%s\n' "$P28_C_RC" > "$P28_C_BASE/evid/conferir.exit"
test "$P28_C_RC" -eq 0
```

Exigir exit 0 / `resultado:ok`, projeto/cliente/URI/manifesto coerentes. Falha impede consentimento; não afrouxar modos, UID, validador ou escopo.

## 6. Ponte e um consentimento no navegador do box TI

Copiar **somente** `/root/flow-p28-t1-20261102T041627Z/retransmissor.mjs` para `config/retransmissor.mjs`, root:root/0400. Conferir SHA-256 **`e6b8e527c70b166bf7e7c022cdb83853b29f9f71afaf93223a4703e3b9aada68`**. Não copiar PID antigo/servidor fictício. Reconferir labels/ID completo da bancada antes da ponte.

Na VPS, sessão dedicada em primeiro plano, com `P28_C_ID` desta operação:

```bash
socat TCP4-LISTEN:8765,bind=127.0.0.1,reuseaddr,fork \
  "EXEC:docker exec -i $P28_C_ID bun /priv/config/retransmissor.mjs 8765"
```

No box TI **do navegador**, sessão dedicada em primeiro plano:

```bash
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=2 \
  -L 127.0.0.1:8765:127.0.0.1:8765 root@187.127.60.78
```

Conferir binds somente 127.0.0.1:8765. Em outra sessão VPS, um `iniciar`, com saídas privadas:

```bash
if docker exec "$P28_C_ID" bun ferramentas/p28-drive/bancada/bancada.ts \
  iniciar --config /priv/config/bancada.json \
  > "$P28_C_BASE/evid/iniciar.json" 2> "$P28_C_BASE/evid/iniciar.privado.log"
then P28_C_RC=0; else P28_C_RC=$?; fi
printf '%s\n' "$P28_C_RC" > "$P28_C_BASE/evid/iniciar.exit"
test "$P28_C_RC" -eq 0
```

Operador/Guardião consulta o link de uso único **somente em terminal privado**, abre no navegador do box e confere cliente/conta/escopo antes de consentir. Não colar link, cookie, state, código, conta ou tokens no chat/relatório. Prazo da ferramenta: 15 minutos; não iniciar cedo enquanto organiza o acesso. Não abrir painel Drive de produção.

Não prometer aviso de app não verificado nem sucesso; registrar impedimento real, sem contornar bloqueios/ampliar escopo/trocar conta automaticamente. Mesma conta com drive.file não garante acesso do cliente novo a arquivos antigos. A verificação de marca continua própria.

Exigir exit 0, `situacao:concluido`, candidato guardado e GETs concluídos, sem `interrompido`. Exit 2 com candidato guardado é **parcial**: preservar e não repetir consentimento cegamente. Recusa antes da gravação também deve ser registrada, não escondida por tentativa automática.

## 7. Renovação imediata e depois do vencimento

Guardar cada renovação em arquivos novos, sem sobrescrever evidência:

```bash
P28_C_RENOVACAO=$(date -u +%Y%m%dT%H%M%SZ)
test ! -e "$P28_C_BASE/evid/renovar-$P28_C_RENOVACAO.json"
if docker exec "$P28_C_ID" bun ferramentas/p28-drive/bancada/bancada.ts \
  renovar --config /priv/config/bancada.json \
  > "$P28_C_BASE/evid/renovar-$P28_C_RENOVACAO.json" \
  2> "$P28_C_BASE/evid/renovar-$P28_C_RENOVACAO.erro"
then P28_C_RC=0; else P28_C_RC=$?; fi
printf '%s\n' "$P28_C_RC" > "$P28_C_BASE/evid/renovar-$P28_C_RENOVACAO.exit"
test "$P28_C_RC" -eq 0
```

Fazer uma imediata e outra **após `access_expira_em` do candidato**, sem mostrar token/alterar relógio. Manter apenas rede/runner necessários para a segunda; ponte/túnel podem encerrar após consentimento. Não executar outro `iniciar`. A decisão C cobre a continuação da mesma operação após esse prazo.

**C só aprovada** com consentimento concluído, cliente novo/conta esperada, escopo exatamente drive.file, três IDs principais e cobertura antiga acessíveis/fora da lixeira, renovação exit 0 / `ensaio_aprovado:true` e **`apos_vencimento_registrado:true`**. Arquivo candidato existente, cache, callback ou renovação imediata não bastam.

Se retornar antes do vencimento: **C em curso**, horário UTC/Brasília restante e estado dos recursos, sem marcar concluída. Cobertura antiga insuficiente precisa constar do limite; não libera D.

## 8. Encerramento e devolutiva

Ordem: servidor OAuth encerrado → ponte socat → túnel SSH → retransmissores próprios restantes → containers próprios → rede fictícia se ainda existir → política/rede C. Reconferir IDs completos/labels antes de remover; sem `pkill`, prune, nome compartilhado ou snapshot global. Se a fase inicial falhar, retirar só o que de fato foi criado; não mascarar erro.

Depois de encerrar sessões/processos próprios:

```bash
test "$(docker inspect "$P28_C_ID" --format '{{index .Config.Labels "p28.operacao"}}')" = "$P28_C_OP"
docker rm -f "$P28_C_ID"
iptables -w -D DOCKER-USER -i "$P28_C_BR" \
  -m comment --comment "$P28_C_OP" -j "$P28_C_F"
iptables -w -D INPUT -i "$P28_C_BR" \
  -m comment --comment "$P28_C_OP" -j "$P28_C_I"
iptables -w -F "$P28_C_F"
iptables -w -X "$P28_C_F"
iptables -w -F "$P28_C_I"
iptables -w -X "$P28_C_I"
test "$(docker network inspect "$P28_C_NET_ID" --format '{{index .Labels "p28.operacao"}}')" = "$P28_C_OP"
docker network rm "$P28_C_NET_ID"
```

O flush acima é **só da cadeia exclusiva identificada**, nunca INPUT/DOCKER-USER/tabela inteira. Erro de retirada deve constar com recurso remanescente; não apagar algo de outra operação. Confirmar ausência de endpoints nas redes antes de remover. Não reutilizar variáveis/PIDs históricos.

Conferir zero containers/redes da operação, nenhum listener/túnel/retransmissor próprio ou salto/cadeia C restante; regras anteriores preservadas, banco/funções Flow com mesmos IDs/inícios e saudáveis. Socat instalado, URI local e pasta C permanecem; entradas/evidências/candidato parcial root 0700/0600, sem transferência para chat/Git/Mac ou limpeza automática. B não é alterada/apagada.

Devolver Markdown sem segredos: autorização/horários, recursos operacionais, resultado da fase sem credenciais e contadores, URI adicionada/preservada, custódia, contagens/cobertura de casos antigos, exit codes/booleanos seguros de iniciar/renovar e prova após vencimento, parcial/recusado quando ocorrer, limpeza/comparação dos serviços. Nada de valores privados, links de uso único, hashes de credencial ou conteúdo B/candidato. D permanece separada, sem revogar cliente antigo ou alterar Barba & Cabelo.
