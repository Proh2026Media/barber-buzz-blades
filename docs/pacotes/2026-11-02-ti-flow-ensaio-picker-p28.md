# P-28 — Para TI/Guardião: procedimento do ensaio Picker real

**Atualização de 03/11 — executado pela TI em 02/11, autorizado por Alyson às 17:00 Brasília.** [Resultado conferido](2026-11-03-flow-picker-conferido-p28.md): três principais acessíveis, duas renovações aprovadas (inclusive após vencimento), temporários retirados e privados preservados. Amostra antiga 0, cobertura do acervo não demonstrada; D não iniciada. **Não repetir os comandos abaixo, consentimento ou aprovação.** Próximo: [TI — cobertura/preparação operacional](2026-11-03-ti-flow-cobertura-preparacao-d-p28.md) e [Claude — composição/plano fictício](2026-11-03-claude-flow-plano-promocao-d-p28.md). O procedimento abaixo permanece como histórico da execução autorizada.

## 1. Escopo que a decisão deste ensaio abrange

- Uma **operação nova** Picker, com fonte exata #39 fora da API e diretórios novos root 0700/0600; nenhum candidato anterior sobrescrito. Mesma credencial Web nova já guardada pelo Guardião; sem segredo/cliente/API key novo.
- Temporários exclusivos: bridges/runner/alvos fictícios, política INPUT/encaminhamento apenas da interface Picker, ponte socat e túnel loopback no box TI. Primeiro demonstrar isolamento sem credencial, usando o procedimento já estabelecido em C, com nomes/IDs novos abaixo. Sem pacote novo ou reinício de serviço existente.
- **Habilitar Google Picker API apenas se ainda não habilitada**, somente no projeto `flow-proh-media-drive`. URIs já cadastradas somente conferidas/preservadas. Nada de DNS/IAM/Branding, outro tipo de cliente ou alterações no projeto Google compartilhado do Barba & Cabelo.
- Guardião deposita credencial na nova operação. TI/Guardião compara os três IDs originais privadamente e define amostra pequena de arquivos antigos; somente IDs vão ao manifesto, nunca o snapshot B/token antigo ao runner.
- **Um consentimento novo com Picker**, no navegador do mesmo box do túnel, somente drive.file, três principais e amostra selecionados explicitamente. GETs de metadados com o candidato novo, renovação imediata e após `access_expira_em`. Sem `configure`/`status`, nova raiz, upload, cópia, compartilhamento, revogação, promoção de conexão ou D.
- Retirada dos temporários próprios ao concluir/falhar; manter fonte e credencial/candidato/seleção/evidências privados, inclusive parcial. API habilitada, URI e socat permanecem; sem exclusão automática ou transferência para chat/Git/Mac.

A autorização usada na C anterior não será presumida como autorização deste consentimento novo. Os comandos abaixo são o procedimento **deste** ensaio, derivado das guardas C com variáveis/labels exclusivos Picker; não executar o roteiro C histórico nem reutilizar seus IDs. Suporte do Google ao modo integrado com cliente Web ainda será demonstrado no ensaio: recusa, cancelamento ou 403/404 exigem registrar/parar, sem fallback automático, ampliação de escopo ou novo consentimento em loop. Seleção concederá ao app acesso aos itens escolhidos, mesmo que uma leitura posterior falhe; não revogar automaticamente para desfazer.

## 2. Pré-condições e variáveis — após decisão

VPS `187.127.60.78`, root/TI; navegador no box TI do túnel. Confirmar porta 8765 livre nos dois lados, sem matar ocupantes. Obter/conferir os 20 blobs #39 conforme a seção 2.1, sem repetir A/B/T1 ou a suíte já revista. Registrar IDs/inícios/saúde do banco/funções Flow e contagem de containers para comparação posterior.

Conferir **172.16.10.0/24 e 198.18.0.0/29 sem conflito com redes Docker/rotas/VPN**; parar se houver conflito, sem alterar redes existentes. Conferir backend iptables/DOCKER-USER ativo e as três regras anteriores preservadas. Os comandos não migram backend. A porta 18080 do gateway futuro deve estar livre.

Na mesma sessão Bash root, conservar as variáveis até a retirada:

```bash
set -euo pipefail
umask 077
test "$(id -u)" -eq 0
P28_PICKER_TAG=$(python3 -c 'import secrets; print(secrets.token_hex(4))')
P28_PICKER_OP=$(date -u +%Y%m%dT%H%M%SZ)-$P28_PICKER_TAG
P28_PICKER_BASE=/root/flow-p28-picker-$P28_PICKER_OP
P28_PICKER_NET=flow-p28-picker-$P28_PICKER_OP
P28_PICKER_TESTNET=flow-p28-picker-ficticio-$P28_PICKER_OP
P28_PICKER_BR=p28p$P28_PICKER_TAG
P28_PICKER_F=P28PF_$P28_PICKER_TAG
P28_PICKER_I=P28PI_$P28_PICKER_TAG
P28_PICKER_GW=172.16.10.1
P28_PICKER_SRC=/root/flow-pr39-picker-$P28_PICKER_OP/src
P28_PICKER_BUN=oven/bun:1.4.2@sha256:296a79bbc988bb0a91ef11099af70a78a8cba98b73fd53f7b2a7715b7c86ced2
mkdir -m 700 "$P28_PICKER_BASE"
mkdir -m 700 "$P28_PICKER_BASE"/{cred,config,candidato,evid,ficticio}
printf '%s' p28-c-rede-ficticia > "$P28_PICKER_BASE/ficticio/index.html"
```

### 2.1. Fonte nova fixada, antes de seguir o bloco operacional

Com as variáveis definidas, obter **somente os 20 arquivos de `ferramentas/p28-drive`** do merge **`73d5317bb6ef1000198bdca13cb0270af4a059b0`**, árvore **`8e5be3054294d4762cd16afa53f1f456a75bbcd7`**. Usar o acesso GitHub/API já disponível, montando transporte/manifesto conferidos, como em A; não pedir login novo `gh`, copiar `.git`/`.env`, obter candidato real ou reinstalar pacotes.

Destino da fonte: **`$P28_PICKER_SRC`**, novo e fora das stacks/API. TI prepara os pais root/0700 e a fonte root/0500, arquivos 0400 (script pg15 pode ser 0500). Não reutilizar/sobrescrever fonte #38 ou diretório C anterior. Conferir código antes de criar o runner; nenhuma credencial nessa árvore. Depois do transporte, rodar na mesma sessão:

```bash
python3 - "$P28_PICKER_SRC" <<'P28_VALIDAR_FONTE_39'
import hashlib, pathlib, stat, sys
src = pathlib.Path(sys.argv[1])
esperados = {'ferramentas/p28-drive/README.md': '44d2496d851d7c78d2ca0abdbf46c5c851497d41', 'ferramentas/p28-drive/arquivo-privado.ts': '7492de2506a7e6bd2898ea4329bd33894deb82f0', 'ferramentas/p28-drive/artefato.ts': 'd9528923bb6a8447cef7a75129f1cdd138a8e525', 'ferramentas/p28-drive/bancada/bancada.ts': '59e29bf16369088cc3517530f8614fc79f02ffda', 'ferramentas/p28-drive/bancada/config.ts': '02976b41985195cbf40d17081d60d0d69bf965a1', 'ferramentas/p28-drive/bancada/ensaio.ts': '2f9cf78efc542aaa10f25f2c9a70df26ed0aec9e', 'ferramentas/p28-drive/bancada/google.ts': '8452f8a05a0465b1d2ed17ed1b1148902abf19ba', 'ferramentas/p28-drive/bancada/picker.ts': '7137de0ded984f21b22153ca1821bfbd6878ef7a', 'ferramentas/p28-drive/bancada/servidor.ts': 'b46b08e87124ec6acb140423cbd579d5eb356eab', 'ferramentas/p28-drive/banco.ts': '6fa8cb4390e98ca45f1824a0242dc55eb2b7c973', 'ferramentas/p28-drive/comum.ts': 'a5cc89f231fe252333629fc354540157a3e269da', 'ferramentas/p28-drive/fonte.ts': 'ad721413271d1fad30bcab4b27c87d688c28b705', 'ferramentas/p28-drive/integracoes.ts': '7a1b14d088640867fe62fca4987582f9691fa099', 'ferramentas/p28-drive/retorno.ts': '291928e02c80f5a511bde8ebacbfd17b1c3f1d33', 'ferramentas/p28-drive/teste/apoio.ts': '8ef6a0defb9437ae436fecc7aa8b15560e8ea093', 'ferramentas/p28-drive/teste/bancada.test.ts': '2d42aafb75e7b867a767eac9eb5d4bfc4d0ae54c', 'ferramentas/p28-drive/teste/esquema-ficticio.sql': 'cf107c681a55c036c36147165310bc4050a5956b', 'ferramentas/p28-drive/teste/pg15.sh': '7067afa9bba2c1eb735159fcfda96526b1d45da6', 'ferramentas/p28-drive/teste/postgres.test.ts': '8bb757f1c578f726a4119cab285cc9e30fe6d1cd', 'ferramentas/p28-drive/teste/unidade.test.ts': '1e4868c00af040d0750d33d39dcbd559eb04e608'}
assert src.is_dir() and not src.is_symlink()
entradas = list(src.rglob("*"))
for p in [src, *entradas]:
    s = p.lstat()
    assert s.st_uid == 0 and not stat.S_ISLNK(s.st_mode), "dono/link invalido"
    if p.is_dir():
        assert stat.S_IMODE(s.st_mode) == 0o500, "diretorio deve ser 0500"
    else:
        assert stat.S_ISREG(s.st_mode) and stat.S_IMODE(s.st_mode) in (0o400, 0o500)
atuais = {str(p.relative_to(src)) for p in entradas if p.is_file()}
assert atuais == set(esperados), "conjunto de arquivos divergente"
for nome, esperado in esperados.items():
    b = (src / nome).read_bytes()
    atual = hashlib.sha1(b"blob " + str(len(b)).encode() + b"\0" + b).hexdigest()
    assert atual == esperado, "blob divergente"
print("fonte_pr39_confere:20")
P28_VALIDAR_FONTE_39
docker image inspect "$P28_PICKER_BUN" --format '{{.Architecture}}'
P28_PICKER_NET_ID=$(docker network create --driver bridge \
  --subnet 172.16.10.0/24 --gateway "$P28_PICKER_GW" \
  -o "com.docker.network.bridge.name=$P28_PICKER_BR" \
  -o com.docker.network.bridge.enable_icc=false \
  --label p28.etapa=C-picker --label "p28.operacao=$P28_PICKER_OP" "$P28_PICKER_NET")
```

Esperado amd64; rede somente no bloco escolhido e **EnableIPv6=false**. Conferir labels/ID completo; sem credencial nesta fase. Registrar variáveis operacionais, IDs completos e recursos parciais em arquivo 0600 de `evid/`, atualizando-o após cada criação; não depender só da memória da sessão para a retirada. Nomes exclusivos não autorizam reutilizar cadeia/interface já existente: se uma criação colidir, parar e identificar.

## 3. Política de rede completa antes do runner

INPUT bloqueia serviços do próprio host; DOCKER-USER restringe encaminhamento. Saltos delimitados pela **interface exclusiva C**, sem reescrever regras Tailscale/produção. Primeiro preencher as cadeias, depois ligá-las; não inserir ACCEPT genérico de conexões estabelecidas antes dos bloqueios.

```bash
iptables -w -N "$P28_PICKER_F"
iptables -w -N "$P28_PICKER_I"
iptables -w -A "$P28_PICKER_I" -j DROP
for P28_PICKER_D in 0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 \
  169.254.0.0/16 172.16.0.0/12 192.0.0.0/24 192.0.2.0/24 \
  192.168.0.0/16 198.18.0.0/15 198.51.100.0/24 203.0.113.0/24 \
  224.0.0.0/4 240.0.0.0/4
do
  iptables -w -A "$P28_PICKER_F" -d "$P28_PICKER_D" -j DROP
done
iptables -w -A "$P28_PICKER_F" -d 187.127.60.78/32 -j DROP
for P28_PICKER_DNS in 1.1.1.1 1.0.0.1; do
  iptables -w -A "$P28_PICKER_F" -d "$P28_PICKER_DNS" -p udp --dport 53 -j ACCEPT
  iptables -w -A "$P28_PICKER_F" -d "$P28_PICKER_DNS" -p tcp --dport 53 -j ACCEPT
done
iptables -w -A "$P28_PICKER_F" -p tcp --dport 443 -j ACCEPT
iptables -w -A "$P28_PICKER_F" -j DROP
iptables -w -I DOCKER-USER 1 -i "$P28_PICKER_BR" \
  -m comment --comment "$P28_PICKER_OP" -j "$P28_PICKER_F"
iptables -w -I INPUT 1 -i "$P28_PICKER_BR" \
  -m comment --comment "$P28_PICKER_OP" -j "$P28_PICKER_I"
iptables -w -C DOCKER-USER -i "$P28_PICKER_BR" \
  -m comment --comment "$P28_PICKER_OP" -j "$P28_PICKER_F"
iptables -w -C INPUT -i "$P28_PICKER_BR" \
  -m comment --comment "$P28_PICKER_OP" -j "$P28_PICKER_I"
```

Conferir saltos no início das cadeias. Outros pacotes não casam com a interface C e seguem o caminho anterior. TCP/443 para destinos públicos é geral; **a ferramenta revisada restringe métodos/URLs Google**. Considerar DNAT e DNS embedded Docker: timeout ou `--dns` sozinho não prova o caminho do resolver. Se INPUT impedir DNS/HTTPS, não abrir acesso genérico ao host; parar antes da credencial.

Falha durante criação: não iniciar runner; retirar apenas recursos comprovadamente criados pela operação. Sem flush global, restauração global de firewall ou `|| true` mascarando erro.

## 4. UID coerente e verificação sem credenciais

Root 0:0 é necessário para fonte root 0500/0400 e arquivos privados root 0700/0600. Não abrir permissões nem manter a proposta C2 UID 1000.

```bash
P28_PICKER_ID=$(docker run -d --name "flow-p28-picker-bancada-$P28_PICKER_OP" \
  --label p28.etapa=C-picker --label "p28.operacao=$P28_PICKER_OP" --label p28.papel=bancada \
  --network "$P28_PICKER_NET_ID" --dns 1.1.1.1 --dns 1.0.0.1 \
  --user 0:0 --read-only --cap-drop ALL --security-opt no-new-privileges \
  --sysctl net.ipv6.conf.all.disable_ipv6=1 \
  --sysctl net.ipv6.conf.default.disable_ipv6=1 \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=128m,mode=1777 \
  --mount "type=bind,src=$P28_PICKER_SRC,dst=/work,readonly" \
  --mount "type=bind,src=$P28_PICKER_BASE,dst=/priv" \
  -w /work "$P28_PICKER_BUN" sleep infinity)
docker exec "$P28_PICKER_ID" bun -e \
  'import {readFileSync} from "node:fs";readFileSync("ferramentas/p28-drive/README.md");if(process.getuid()!==0)process.exit(2);console.log("fonte_legivel_uid_coerente")'
P28_PICKER_TESTNET_ID=$(docker network create --driver bridge --subnet 198.18.0.0/29 \
  --label p28.etapa=C-picker --label "p28.operacao=$P28_PICKER_OP" "$P28_PICKER_TESTNET")
P28_PICKER_FIX_ID=$(docker run -d --name "flow-p28-picker-ficticio-$P28_PICKER_OP" \
  --label p28.etapa=C-picker --label "p28.operacao=$P28_PICKER_OP" --label p28.papel=ficticio \
  --network "$P28_PICKER_TESTNET_ID" --ip 198.18.0.2 --user 0:0 \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  "$P28_PICKER_BUN" bun -e \
  'Bun.serve({hostname:"0.0.0.0",port:8080,fetch(){return new Response("p28-c-rede-ficticia")}})')
docker exec "$P28_PICKER_FIX_ID" bun -e \
  'let pronto=false;for(let i=0;i<30;i++){try{const r=await fetch("http://127.0.0.1:8080",{signal:AbortSignal.timeout(500)});if(await r.text()==="p28-c-rede-ficticia"){pronto=true;break}}catch{}await Bun.sleep(100)}if(!pronto)process.exit(2);console.log("alvo_ficticio_ativo")'
```

Conferir nos dois IDs completos labels/estado/redes, nenhuma PortBindings, raiz RO/capacidades removidas e mounts exatos. Runner somente C; fonte RO e pasta C RW, sem B/socket. Configuração IPv6 desabilitada no runner. `/priv` ainda sem credencial/configuração/candidato. O bind 0.0.0.0 acima é só no **servidor fictício dentro da rede fictícia sem porta publicada**, nunca na bancada OAuth/host.

Em uma sessão dedicada da VPS, manter em primeiro plano o servidor fictício do host, servindo **apenas a pasta fictícia**. Definir nessa sessão `P28_PICKER_GW` e `P28_PICKER_BASE` com os valores não secretos desta operação:

```bash
python3 -m http.server 18080 --bind "$P28_PICKER_GW" \
  --directory "$P28_PICKER_BASE/ficticio"
```

Na sessão principal, após ambos estarem prontos:

```bash
test "$(curl --noproxy '*' -fsS "http://$P28_PICKER_GW:18080/")" = p28-c-rede-ficticia
docker exec "$P28_PICKER_ID" bun -e \
  'for(const u of ["http://172.16.10.1:18080/","http://198.18.0.2:8080/"]){try{await fetch(u,{signal:AbortSignal.timeout(2000)});console.error("acesso_indevido");process.exit(2)}catch{console.log("alvo_ficticio_inacessivel")}}'
iptables -w -nvxL "$P28_PICKER_I"
iptables -w -nvxL "$P28_PICKER_F"
docker exec "$P28_PICKER_ID" bun -e \
  'for(const u of ["https://oauth2.googleapis.com/token","https://www.googleapis.com/drive/v3/about"]){const r=await fetch(u,{redirect:"error",signal:AbortSignal.timeout(10000)});if(r.status>=500)process.exit(2);console.log("https_sem_credencial",r.status)}'
```

Os últimos GETs são sondas HTTPS **sem tokens**; 4xx é compatível com endpoint que exige método/autorização. Não desabilitar TLS. Conferir contadores INPUT/DROP e encaminhamento para a faixa fictícia, regras/ordem e alvos ativos; timeout isolado não basta. Se Docker bloquear antes dessa cadeia, identificar e registrar a evidência correspondente. **Sem demonstrar proteção e saída funcional, não avançar.** Nenhum endereço da rede Flow/banco real é sondado.

Encerrar o servidor do host por Ctrl+C na sessão própria. Reconferir labels/ID antes de remover container/rede fictícios, sem remover a política da bancada:

```bash
test "$(docker inspect "$P28_PICKER_FIX_ID" --format '{{index .Config.Labels "p28.operacao"}}')" = "$P28_PICKER_OP"
docker rm -f "$P28_PICKER_FIX_ID"
test "$(docker network inspect "$P28_PICKER_TESTNET_ID" --format '{{index .Labels "p28.operacao"}}')" = "$P28_PICKER_OP"
docker network rm "$P28_PICKER_TESTNET_ID"
```

## 5. URI e arquivos privados — só após a fase anterior aprovada

No Google Cloud, TI/Guardião confirma o projeto dedicado **`flow-proh-media-drive` / 930474870480**. No catálogo APIs & Services → Library, conferir **Google Picker API**; se ainda não habilitada, habilitar somente essa API sob a decisão deste ensaio. Drive API já conhecida permanece. Não criar API key, origem JavaScript, cliente Desktop/Web novo, segredo ou alterar Branding/IAM/DNS. Registrar o estado antes/depois; API habilitada permanece após o teste. [Pré-requisito oficial](https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker).

Conferir o cliente Web existente **“Flow Drive (produção)”** e as duas URIs já conhecidas: `http://127.0.0.1:8765/oauth/callback` e `https://supabase.proh.media/functions/v1/google-drive/callback`. **Somente leitura/preservação de URI nesta operação.** Se faltar a URI local ou divergir projeto/cliente/tipo, parar com a divergência; não cadastrar/trocar para fazer o teste passar. Cliente antigo Flow e Auth Barba & Cabelo permanecem fora do escopo.

Guardião deposita `cred/cliente-novo.json`, formato **Web**, com `web.project_id`, `web.client_id`, `web.client_secret` já guardado e `web.redirect_uris` realmente conferidas no console. Tudo root:root/0600, sem symlinks ou valores em argumentos/logs/chat. Não criar segredo novo; editar JSON não cadastra URI no Google.

TI/Guardião compara privadamente os três IDs principais com a fonte original B e registra somente booleanos de correspondência no relatório. Não alterar os IDs para substituir raiz/Clientes/Lixeira; confirmação negativa interrompe antes do consentimento. Em seguida grava `config/manifesto-ids.json` 0600 com **somente IDs**. B não é alterada/montada no runner; nenhum token/segredo antigo sai dela. Formato ilustrativo, preenchido somente no arquivo privado:

```json
{
  "versao": 1,
  "principais": { "raiz": "<privado>", "clientes": "<privado>", "lixeira": "<privado>" },
  "referencias": ["<privado>"],
  "operador": ["<privado>"]
}
```

Cobrir uma amostra pequena de arquivos antigos relevantes, não apenas pastas, com IDs indicados deliberadamente pelo operador antes de abrir o Picker. Máximo total de 50 IDs, sem repetidos. As listas vazias de C provinham da ausência de fonte em B, não de prova de Drive vazio. Se não conseguir indicar arquivos, registrar a lacuna antes do consentimento; não marcar cobertura não exercitada como comprovada. Se não houver casos, documentar privadamente a ausência/limite; não inventar IDs nem declarar compatibilidade não exercitada. Cliente antigo é o OAuth Drive atual do Flow na configuração correspondente, nunca Auth B&C ou campo legado preenchido por palpite.

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
  "manifesto_ids": "/priv/config/manifesto-ids.json",
  "picker": { "permitir_pastas": true, "filtrar_por_ids": true }
}
```

`conferir` valida arquivos locais, **não consulta o Google**; a confirmação de URI no console é indispensável.

```bash
if docker exec "$P28_PICKER_ID" bun ferramentas/p28-drive/bancada/bancada.ts \
  conferir --config /priv/config/bancada.json \
  > "$P28_PICKER_BASE/evid/conferir.json" 2> "$P28_PICKER_BASE/evid/conferir.erro"
then P28_PICKER_RC=0; else P28_PICKER_RC=$?; fi
printf '%s\n' "$P28_PICKER_RC" > "$P28_PICKER_BASE/evid/conferir.exit"
test "$P28_PICKER_RC" -eq 0
```

Exigir exit 0 / `resultado:ok` / `modo:picker`, `permitir_pastas:true` e `filtrar_por_ids:true`, projeto/cliente/URI/manifesto coerentes. Os três principais são pastas e devem poder ser selecionados. Falha impede consentimento; não afrouxar modos, UID, validador ou escopo.

## 6. Ponte e um consentimento Picker no navegador do box TI

Copiar **somente** `/root/flow-p28-t1-20261102T041627Z/retransmissor.mjs` para `config/retransmissor.mjs`, root:root/0400. Conferir SHA-256 **`e6b8e527c70b166bf7e7c022cdb83853b29f9f71afaf93223a4703e3b9aada68`**. Não copiar PID antigo/servidor fictício. Reconferir labels/ID completo da bancada antes da ponte.

Na VPS, sessão dedicada em primeiro plano, com `P28_PICKER_ID` desta operação:

```bash
socat TCP4-LISTEN:8765,bind=127.0.0.1,reuseaddr,fork \
  "EXEC:docker exec -i $P28_PICKER_ID bun /priv/config/retransmissor.mjs 8765"
```

No box TI **do navegador**, sessão dedicada em primeiro plano:

```bash
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=2 \
  -L 127.0.0.1:8765:127.0.0.1:8765 root@187.127.60.78
```

Conferir binds somente 127.0.0.1:8765. Em outra sessão VPS, um `iniciar-picker`, com saídas privadas:

```bash
if docker exec "$P28_PICKER_ID" bun ferramentas/p28-drive/bancada/bancada.ts \
  iniciar-picker --config /priv/config/bancada.json \
  > "$P28_PICKER_BASE/evid/iniciar.json" 2> "$P28_PICKER_BASE/evid/iniciar.privado.log"
then P28_PICKER_RC=0; else P28_PICKER_RC=$?; fi
printf '%s\n' "$P28_PICKER_RC" > "$P28_PICKER_BASE/evid/iniciar.exit"
test "$P28_PICKER_RC" -eq 0
```

Operador/Guardião consulta o link de uso único **somente em terminal privado**, abre no navegador do box e confere cliente/conta/escopo antes de consentir. No Picker integrado, marca exatamente os três principais e toda a amostra esperada; a lista filtrada não autoriza selecionar itens diferentes nem substituir o manifesto. IDs passam apenas pelo navegador autorizado/Google e arquivos privados, sem aparecer no relatório público. Não colar link, cookie, state, código, conta ou tokens no chat/relatório. Prazo da ferramenta: 15 minutos; não iniciar cedo enquanto organiza o acesso. Não abrir painel Drive de produção.

Não prometer aviso de app não verificado nem sucesso; registrar impedimento real, sem contornar bloqueios/ampliar escopo/trocar conta automaticamente. Mesma conta com drive.file não garante acesso do cliente novo a arquivos antigos. A verificação de marca continua própria.

Exigir exit 0, etapa `iniciar-picker`, `situacao:concluido`, `selecao.situacao:completa`, `ensaio_aprovado:true`, candidato guardado e GETs concluídos, sem `interrompido`. O arquivo candidato deve identificar modo Picker e seu vínculo privado; não imprimir IDs/hashes desse vínculo. Exit 2 com candidato guardado é **parcial**: preservar e não repetir consentimento cegamente. Recusa antes da gravação também deve ser registrada, não escondida por tentativa automática.

## 7. Renovação imediata e depois do vencimento

Guardar cada renovação em arquivos novos, sem sobrescrever evidência:

```bash
P28_PICKER_RENOVACAO=$(date -u +%Y%m%dT%H%M%SZ)
test ! -e "$P28_PICKER_BASE/evid/renovar-$P28_PICKER_RENOVACAO.json"
if docker exec "$P28_PICKER_ID" bun ferramentas/p28-drive/bancada/bancada.ts \
  renovar --config /priv/config/bancada.json \
  > "$P28_PICKER_BASE/evid/renovar-$P28_PICKER_RENOVACAO.json" \
  2> "$P28_PICKER_BASE/evid/renovar-$P28_PICKER_RENOVACAO.erro"
then P28_PICKER_RC=0; else P28_PICKER_RC=$?; fi
printf '%s\n' "$P28_PICKER_RC" > "$P28_PICKER_BASE/evid/renovar-$P28_PICKER_RENOVACAO.exit"
test "$P28_PICKER_RC" -eq 0
```

Fazer uma imediata e outra **após `access_expira_em` do candidato**, sem mostrar token/alterar relógio. Manter apenas rede/runner necessários para a segunda; ponte/túnel podem encerrar após consentimento. Não executar outro `iniciar-picker` nem `iniciar`. A decisão Picker cobre a continuação da mesma operação após esse prazo.

**Ensaio Picker só aprovado** com seleção completa, cliente novo/conta esperada, escopo exatamente drive.file, três IDs originais e amostra antiga acessíveis/fora da lixeira, ambas as renovações exit 0 / `ensaio_aprovado:true` / `modo:picker` / **`vinculo_selecao:ok`**, sendo a segunda com **`apos_vencimento_registrado:true`**. Refresh diagnóstico com vínculo ausente/divergente/incompleto continua reprovado, mesmo se `renovado:true`. Guardar candidato, seleção, manifesto e evidências juntos, sem editar/remover seus campos/arquivos entre as renovações. Arquivo candidato existente, cache, callback ou renovação imediata não bastam.

Se retornar antes do vencimento: **Picker em curso**, horário UTC/Brasília restante e estado dos recursos, sem marcar concluída. Cobertura antiga insuficiente precisa constar do limite; não libera D.

## 8. Encerramento e devolutiva

Ordem: servidor OAuth encerrado → ponte socat → túnel SSH → retransmissores próprios restantes → containers próprios → rede fictícia se ainda existir → política/rede C. Reconferir IDs completos/labels antes de remover; sem `pkill`, prune, nome compartilhado ou snapshot global. Se a fase inicial falhar, retirar só o que de fato foi criado; não mascarar erro.

Depois de encerrar sessões/processos próprios:

```bash
test "$(docker inspect "$P28_PICKER_ID" --format '{{index .Config.Labels "p28.operacao"}}')" = "$P28_PICKER_OP"
docker rm -f "$P28_PICKER_ID"
iptables -w -D DOCKER-USER -i "$P28_PICKER_BR" \
  -m comment --comment "$P28_PICKER_OP" -j "$P28_PICKER_F"
iptables -w -D INPUT -i "$P28_PICKER_BR" \
  -m comment --comment "$P28_PICKER_OP" -j "$P28_PICKER_I"
iptables -w -F "$P28_PICKER_F"
iptables -w -X "$P28_PICKER_F"
iptables -w -F "$P28_PICKER_I"
iptables -w -X "$P28_PICKER_I"
test "$(docker network inspect "$P28_PICKER_NET_ID" --format '{{index .Labels "p28.operacao"}}')" = "$P28_PICKER_OP"
docker network rm "$P28_PICKER_NET_ID"
```

O flush acima é **só da cadeia exclusiva identificada**, nunca INPUT/DOCKER-USER/tabela inteira. Erro de retirada deve constar com recurso remanescente; não apagar algo de outra operação. Confirmar ausência de endpoints nas redes antes de remover. Não reutilizar variáveis/PIDs históricos.

Conferir zero containers/redes da operação, nenhum listener/túnel/retransmissor próprio ou salto/cadeia C restante; regras anteriores preservadas, banco/funções Flow com mesmos IDs/inícios e saudáveis. Socat instalado, Picker API habilitada, URIs existentes e pasta Picker permanecem; entradas/evidências/candidato parcial root 0700/0600, sem transferência para chat/Git/Mac ou limpeza automática. B e o candidato/configurações/evidências C em `/root/flow-p28-c-20261102T174701Z-ad137cf3/` não são alterados/apagados; não copiar o candidato antigo para a operação nova.

Devolver Markdown sem segredos: autorização/horários, recursos operacionais, resultado da fase sem credenciais e contadores, Picker API habilitada/já habilitada e URIs preservadas, custódia, contagens/cobertura de casos antigos, exit codes/booleanos seguros de iniciar/renovar e prova após vencimento, parcial/recusado quando ocorrer, limpeza/comparação dos serviços. Nada de valores privados, links de uso único, hashes de credencial/manifesto/evidência ou conteúdo B/candidato. Informar seleção/cobertura e `vinculo_selecao` somente por estados/contagens. Selecionar pasta não demonstra acesso recursivo ao acervo inteiro; aprovação da bancada não libera D automaticamente. D permanece separada, sem revogar cliente antigo ou alterar Barba & Cabelo.
