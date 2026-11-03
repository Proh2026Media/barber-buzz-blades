# P-28 — Para TI/Guardião: ensaio dos 15 itens, pronto para decisão

**03/11/2026 · Preparado, ainda não executado.** [#41 corrigido, integrado pelo dono e conferido](2026-11-03-flow-pr41-confirmacoes-d-v2-conferidos-p28.md), merge `d3f1c90`, ferramentas `1d65e1a`/25 arquivos. Conta e três IDs principais conferem; nove pastas totais/seis arquivos/zero atalhos, **15 IDs distintos sob Guardião**. Não repetir inventário, A/B/T1, instalação, merge ou duas renovações do antigo manifesto de três IDs.

Este é **um novo ensaio isolado**, com **um consentimento para selecionar os 15 itens**, GETs de metadados e duas renovações v2 (imediata e após o vencimento inicial). Nenhuma escrita de integração/Drive, parada de funções, cron ou etapa D. Tempo de bancada inclui esperar o horário de vencimento emitido; em 02/11 foi cerca de uma hora. Não confundir com janela de indisponibilidade de produção.

**Decisão específica de Alyson antes de executar:** o consentimento concede ao app acesso aos itens selecionados, embora a ferramenta só leia metadados. Frase proposta, a ser efetivamente autorizada pelo dono: “Autorizo o ensaio Picker da P-28 para os 15 itens confirmados, com operação e candidato novos, depósito da credencial existente pelo Guardião, um consentimento no box da TI, leituras de metadados, duas renovações v2 — uma após vencimento — e retirada dos temporários, preservando os arquivos privados. Não autorizo a etapa D por essa decisão.” Registrar autorização/horário antes da seção 2.

O roteiro abaixo é a **nova revisão operacional completa**; não executar os comandos históricos de 02/11. Mantém os controles de isolamento já usados, com fonte/operação/labels/diretórios próprios. Não precisa de outra entrega Claude para iniciar esse ensaio após a decisão. D continua com lacunas separadas de escrita real, admissão/drenagem e controle de recriação.

## 1. Escopo que a decisão deste ensaio abrange

- Uma **operação nova** Picker, com fonte exata #41 fora da API e diretórios novos root 0700/0600; nenhum candidato anterior sobrescrito. Mesma credencial Web nova já guardada pelo Guardião; sem segredo/cliente/API key novo.
- Temporários exclusivos: bridges/runner/alvos fictícios, política INPUT/encaminhamento apenas da interface Picker, ponte socat e túnel loopback no box TI. Primeiro demonstrar isolamento sem credencial, usando o procedimento já estabelecido em C, com nomes/IDs novos abaixo. Sem pacote novo ou reinício de serviço existente.
- **Google Picker API já habilitada em 02/11**, somente conferência no projeto `flow-proh-media-drive`. URIs já cadastradas somente conferidas/preservadas. Se o estado tiver mudado, parar; não reabilitar ou alterar Google automaticamente. Nada de DNS/IAM/Branding, outro tipo de cliente ou alterações no projeto Google compartilhado do Barba & Cabelo.
- Guardião deposita credencial na nova operação. TI/Guardião usa a lista privada de **15 IDs distintos já confirmados**, nove pastas/seis arquivos; somente IDs vão ao manifesto, nunca o snapshot B/token antigo ao runner.
- **Um consentimento novo com Picker**, no navegador do mesmo box do túnel, somente drive.file, os **15 itens selecionados explicitamente**, três principais + 12 adicionais. GETs de metadados com o candidato novo, renovação imediata e após `access_expira_em`. Sem `configure`/`status`, nova raiz, upload, cópia, compartilhamento, revogação, promoção de conexão ou D.
- Retirada dos temporários próprios ao concluir/falhar; manter fonte e credencial/candidato/seleção/evidências privados, inclusive parcial. API habilitada, URI e socat permanecem; sem exclusão automática ou transferência para chat/Git/Mac.

A integração do #41 e as autorizações usadas nas operações C/Picker anteriores não serão presumidas como autorização deste consentimento novo. O recebimento deste arquivo pela TI não substitui a decisão do dono. Os comandos abaixo são o procedimento **deste** ensaio, derivado das guardas C com variáveis/labels exclusivos Picker; não executar o roteiro C histórico nem reutilizar seus IDs. O modo integrado com cliente Web já funcionou para os três principais; agora se mede o conjunto adicional: recusa, cancelamento ou 403/404 exigem registrar/parar, sem fallback automático, ampliação de escopo ou novo consentimento em loop. Seleção concederá ao app acesso aos itens escolhidos, mesmo que uma leitura posterior falhe; não revogar automaticamente para desfazer.

## 2. Pré-condições e variáveis — após decisão

VPS `187.127.60.78`, root/TI; navegador no box TI do túnel. Confirmar porta 8765 livre nos dois lados, sem matar ocupantes. Obter/conferir os 25 blobs #41 conforme a seção 2.1, sem repetir A/B/T1 ou a suíte já revista. Registrar IDs/inícios/saúde do banco/funções Flow e contagem de containers para comparação posterior.

Conferir **172.16.10.0/24 e 198.18.0.0/29 sem conflito com redes Docker/rotas/VPN**; parar se houver conflito, sem alterar redes existentes. Conferir backend iptables/DOCKER-USER ativo e as três regras anteriores preservadas. Os comandos não migram backend. A porta 18080 do gateway futuro deve estar livre.

Na mesma sessão Bash root, conservar as variáveis até a retirada:

```bash
set -euo pipefail
umask 077
test "$(id -u)" -eq 0
P28_ACERVO_TAG=$(python3 -c 'import secrets; print(secrets.token_hex(4))')
P28_ACERVO_OP=$(date -u +%Y%m%dT%H%M%SZ)-$P28_ACERVO_TAG
P28_ACERVO_BASE=/root/flow-p28-acervo-$P28_ACERVO_OP
P28_ACERVO_NET=flow-p28-acervo-$P28_ACERVO_OP
P28_ACERVO_TESTNET=flow-p28-acervo-ficticio-$P28_ACERVO_OP
P28_ACERVO_BR=p28a$P28_ACERVO_TAG
P28_ACERVO_F=P28AF_$P28_ACERVO_TAG
P28_ACERVO_I=P28AI_$P28_ACERVO_TAG
P28_ACERVO_GW=172.16.10.1
P28_ACERVO_SRC=/root/flow-pr41-acervo-$P28_ACERVO_OP/src
P28_ACERVO_BUN=oven/bun:1.4.2@sha256:296a79bbc988bb0a91ef11099af70a78a8cba98b73fd53f7b2a7715b7c86ced2
mkdir -m 700 "$P28_ACERVO_BASE"
mkdir -m 700 "$P28_ACERVO_BASE"/{cred,config,candidato,evid,ficticio}
printf '%s' p28-c-rede-ficticia > "$P28_ACERVO_BASE/ficticio/index.html"
```

### 2.1. Fonte nova fixada, antes de seguir o bloco operacional

Com as variáveis definidas, obter **somente os 25 arquivos de `ferramentas/p28-drive`** do merge **`d3f1c90e60b678db9d4a6da1d32b3ea7f6babbfa`**, árvore **`1d65e1afc9bd5411f175a71cce087398ca7b919e`**. Usar o acesso GitHub/API já disponível, montando transporte/manifesto conferidos, como em A; não pedir login novo `gh`, copiar `.git`/`.env`, obter candidato real ou reinstalar pacotes.

Destino da fonte: **`$P28_ACERVO_SRC`**, novo e fora das stacks/API. TI prepara os pais root/0700 e a fonte root/0500, arquivos 0400 (script pg15 pode ser 0500). Não reutilizar/sobrescrever fonte #38 ou diretório C anterior. Conferir código antes de criar o runner; nenhuma credencial nessa árvore. Depois do transporte, rodar na mesma sessão:

```bash
python3 - "$P28_ACERVO_SRC" <<'P28_VALIDAR_FONTE_41'
import hashlib, pathlib, stat, sys
src = pathlib.Path(sys.argv[1])
esperados = {'ferramentas/p28-drive/README.md': '88599b7ab5aeafae4f5a85693cb513d9491ba884', 'ferramentas/p28-drive/aceitacao.ts': '550fb14a48bc18514ac3973b56e4b8ccc35a9735', 'ferramentas/p28-drive/arquivo-privado.ts': '7492de2506a7e6bd2898ea4329bd33894deb82f0', 'ferramentas/p28-drive/artefato.ts': 'd9528923bb6a8447cef7a75129f1cdd138a8e525', 'ferramentas/p28-drive/bancada/bancada.ts': 'eb3e7e4ee35d46084d4b49d75d2163a6ddfa4ddb', 'ferramentas/p28-drive/bancada/config.ts': '02976b41985195cbf40d17081d60d0d69bf965a1', 'ferramentas/p28-drive/bancada/ensaio.ts': '328aae528981c02d6ba2a85e07807771e5a6da2d', 'ferramentas/p28-drive/bancada/google.ts': '8452f8a05a0465b1d2ed17ed1b1148902abf19ba', 'ferramentas/p28-drive/bancada/picker.ts': '7137de0ded984f21b22153ca1821bfbd6878ef7a', 'ferramentas/p28-drive/bancada/servidor.ts': 'b46b08e87124ec6acb140423cbd579d5eb356eab', 'ferramentas/p28-drive/banco.ts': '6fa8cb4390e98ca45f1824a0242dc55eb2b7c973', 'ferramentas/p28-drive/comum.ts': 'a5cc89f231fe252333629fc354540157a3e269da', 'ferramentas/p28-drive/fonte.ts': 'ad721413271d1fad30bcab4b27c87d688c28b705', 'ferramentas/p28-drive/integracoes.ts': '86c76eda63df3b0b9bd37afbd2dfba92401c6c0c', 'ferramentas/p28-drive/promocao.ts': '46352bb41488e079fdad42c49844ded5618fe411', 'ferramentas/p28-drive/retorno.ts': '291928e02c80f5a511bde8ebacbfd17b1c3f1d33', 'ferramentas/p28-drive/teste/aceitacao.test.ts': 'abe631881c08de3d9e24c782d55d3f5165c23565', 'ferramentas/p28-drive/teste/apoio.ts': '8ef6a0defb9437ae436fecc7aa8b15560e8ea093', 'ferramentas/p28-drive/teste/bancada.test.ts': '7e5f4a019e2b86706762fdc1440b9da2f7cd2baa', 'ferramentas/p28-drive/teste/esquema-ficticio.sql': 'cf107c681a55c036c36147165310bc4050a5956b', 'ferramentas/p28-drive/teste/pg15.sh': '7067afa9bba2c1eb735159fcfda96526b1d45da6', 'ferramentas/p28-drive/teste/postgres.test.ts': 'fbc959b0cc8299192e5fc959bb345182500dfcb8', 'ferramentas/p28-drive/teste/promocao-apoio.ts': 'd17f8d114ee65e7f50c609ff1cf70592c397b510', 'ferramentas/p28-drive/teste/promocao.test.ts': 'bf807fd2837e20fb378e40f69db97f4aa27e6f07', 'ferramentas/p28-drive/teste/unidade.test.ts': '1e4868c00af040d0750d33d39dcbd559eb04e608'}
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
print("fonte_pr41_confere:25")
P28_VALIDAR_FONTE_41
docker image inspect "$P28_ACERVO_BUN" --format '{{.Architecture}}'
P28_ACERVO_NET_ID=$(docker network create --driver bridge \
  --subnet 172.16.10.0/24 --gateway "$P28_ACERVO_GW" \
  -o "com.docker.network.bridge.name=$P28_ACERVO_BR" \
  -o com.docker.network.bridge.enable_icc=false \
  --label p28.etapa=C-acervo --label "p28.operacao=$P28_ACERVO_OP" "$P28_ACERVO_NET")
```

Esperado amd64; rede somente no bloco escolhido e **EnableIPv6=false**. Conferir labels/ID completo; sem credencial nesta fase. Registrar variáveis operacionais, IDs completos e recursos parciais em arquivo 0600 de `evid/`, atualizando-o após cada criação; não depender só da memória da sessão para a retirada. Nomes exclusivos não autorizam reutilizar cadeia/interface já existente: se uma criação colidir, parar e identificar.

## 3. Política de rede completa antes do runner

INPUT bloqueia serviços do próprio host; DOCKER-USER restringe encaminhamento. Saltos delimitados pela **interface exclusiva do acervo**, sem reescrever regras Tailscale/produção. Primeiro preencher as cadeias, depois ligá-las; não inserir ACCEPT genérico de conexões estabelecidas antes dos bloqueios.

```bash
iptables -w -N "$P28_ACERVO_F"
iptables -w -N "$P28_ACERVO_I"
iptables -w -A "$P28_ACERVO_I" -j DROP
for P28_ACERVO_D in 0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 \
  169.254.0.0/16 172.16.0.0/12 192.0.0.0/24 192.0.2.0/24 \
  192.168.0.0/16 198.18.0.0/15 198.51.100.0/24 203.0.113.0/24 \
  224.0.0.0/4 240.0.0.0/4
do
  iptables -w -A "$P28_ACERVO_F" -d "$P28_ACERVO_D" -j DROP
done
iptables -w -A "$P28_ACERVO_F" -d 187.127.60.78/32 -j DROP
for P28_ACERVO_DNS in 1.1.1.1 1.0.0.1; do
  iptables -w -A "$P28_ACERVO_F" -d "$P28_ACERVO_DNS" -p udp --dport 53 -j ACCEPT
  iptables -w -A "$P28_ACERVO_F" -d "$P28_ACERVO_DNS" -p tcp --dport 53 -j ACCEPT
done
iptables -w -A "$P28_ACERVO_F" -p tcp --dport 443 -j ACCEPT
iptables -w -A "$P28_ACERVO_F" -j DROP
iptables -w -I DOCKER-USER 1 -i "$P28_ACERVO_BR" \
  -m comment --comment "$P28_ACERVO_OP" -j "$P28_ACERVO_F"
iptables -w -I INPUT 1 -i "$P28_ACERVO_BR" \
  -m comment --comment "$P28_ACERVO_OP" -j "$P28_ACERVO_I"
iptables -w -C DOCKER-USER -i "$P28_ACERVO_BR" \
  -m comment --comment "$P28_ACERVO_OP" -j "$P28_ACERVO_F"
iptables -w -C INPUT -i "$P28_ACERVO_BR" \
  -m comment --comment "$P28_ACERVO_OP" -j "$P28_ACERVO_I"
```

Conferir saltos no início das cadeias. Outros pacotes não casam com a interface C e seguem o caminho anterior. TCP/443 para destinos públicos é geral; **a ferramenta revisada restringe métodos/URLs Google**. Considerar DNAT e DNS embedded Docker: timeout ou `--dns` sozinho não prova o caminho do resolver. Se INPUT impedir DNS/HTTPS, não abrir acesso genérico ao host; parar antes da credencial.

Falha durante criação: não iniciar runner; retirar apenas recursos comprovadamente criados pela operação. Sem flush global, restauração global de firewall ou `|| true` mascarando erro.

## 4. UID coerente e verificação sem credenciais

Root 0:0 é necessário para fonte root 0500/0400 e arquivos privados root 0700/0600. Não abrir permissões nem manter a proposta C2 UID 1000.

```bash
P28_ACERVO_ID=$(docker run -d --name "flow-p28-acervo-bancada-$P28_ACERVO_OP" \
  --label p28.etapa=C-acervo --label "p28.operacao=$P28_ACERVO_OP" --label p28.papel=bancada \
  --network "$P28_ACERVO_NET_ID" --dns 1.1.1.1 --dns 1.0.0.1 \
  --user 0:0 --read-only --cap-drop ALL --security-opt no-new-privileges \
  --sysctl net.ipv6.conf.all.disable_ipv6=1 \
  --sysctl net.ipv6.conf.default.disable_ipv6=1 \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=128m,mode=1777 \
  --mount "type=bind,src=$P28_ACERVO_SRC,dst=/work,readonly" \
  --mount "type=bind,src=$P28_ACERVO_BASE,dst=/priv" \
  -w /work "$P28_ACERVO_BUN" sleep infinity)
docker exec "$P28_ACERVO_ID" bun -e \
  'import {readFileSync} from "node:fs";readFileSync("ferramentas/p28-drive/README.md");if(process.getuid()!==0)process.exit(2);console.log("fonte_legivel_uid_coerente")'
P28_ACERVO_TESTNET_ID=$(docker network create --driver bridge --subnet 198.18.0.0/29 \
  --label p28.etapa=C-acervo --label "p28.operacao=$P28_ACERVO_OP" "$P28_ACERVO_TESTNET")
P28_ACERVO_FIX_ID=$(docker run -d --name "flow-p28-acervo-ficticio-$P28_ACERVO_OP" \
  --label p28.etapa=C-acervo --label "p28.operacao=$P28_ACERVO_OP" --label p28.papel=ficticio \
  --network "$P28_ACERVO_TESTNET_ID" --ip 198.18.0.2 --user 0:0 \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  "$P28_ACERVO_BUN" bun -e \
  'Bun.serve({hostname:"0.0.0.0",port:8080,fetch(){return new Response("p28-c-rede-ficticia")}})')
docker exec "$P28_ACERVO_FIX_ID" bun -e \
  'let pronto=false;for(let i=0;i<30;i++){try{const r=await fetch("http://127.0.0.1:8080",{signal:AbortSignal.timeout(500)});if(await r.text()==="p28-c-rede-ficticia"){pronto=true;break}}catch{}await Bun.sleep(100)}if(!pronto)process.exit(2);console.log("alvo_ficticio_ativo")'
```

Conferir nos dois IDs completos labels/estado/redes, nenhuma PortBindings, raiz RO/capacidades removidas e mounts exatos. Runner somente deste ensaio; fonte RO e pasta nova RW, sem B/socket. Configuração IPv6 desabilitada no runner. `/priv` ainda sem credencial/configuração/candidato. O bind 0.0.0.0 acima é só no **servidor fictício dentro da rede fictícia sem porta publicada**, nunca na bancada OAuth/host.

Em uma sessão dedicada da VPS, manter em primeiro plano o servidor fictício do host, servindo **apenas a pasta fictícia**. Definir nessa sessão `P28_ACERVO_GW` e `P28_ACERVO_BASE` com os valores não secretos desta operação:

```bash
python3 -m http.server 18080 --bind "$P28_ACERVO_GW" \
  --directory "$P28_ACERVO_BASE/ficticio"
```

Na sessão principal, após ambos estarem prontos:

```bash
test "$(curl --noproxy '*' -fsS "http://$P28_ACERVO_GW:18080/")" = p28-c-rede-ficticia
docker exec "$P28_ACERVO_ID" bun -e \
  'for(const u of ["http://172.16.10.1:18080/","http://198.18.0.2:8080/"]){try{await fetch(u,{signal:AbortSignal.timeout(2000)});console.error("acesso_indevido");process.exit(2)}catch{console.log("alvo_ficticio_inacessivel")}}'
iptables -w -nvxL "$P28_ACERVO_I"
iptables -w -nvxL "$P28_ACERVO_F"
docker exec "$P28_ACERVO_ID" bun -e \
  'for(const u of ["https://oauth2.googleapis.com/token","https://www.googleapis.com/drive/v3/about"]){const r=await fetch(u,{redirect:"error",signal:AbortSignal.timeout(10000)});if(r.status>=500)process.exit(2);console.log("https_sem_credencial",r.status)}'
```

Os últimos GETs são sondas HTTPS **sem tokens**; 4xx é compatível com endpoint que exige método/autorização. Não desabilitar TLS. Conferir contadores INPUT/DROP e encaminhamento para a faixa fictícia, regras/ordem e alvos ativos; timeout isolado não basta. Se Docker bloquear antes dessa cadeia, identificar e registrar a evidência correspondente. **Sem demonstrar proteção e saída funcional, não avançar.** Nenhum endereço da rede Flow/banco real é sondado.

Encerrar o servidor do host por Ctrl+C na sessão própria. Reconferir labels/ID antes de remover container/rede fictícios, sem remover a política da bancada:

```bash
test "$(docker inspect "$P28_ACERVO_FIX_ID" --format '{{index .Config.Labels "p28.operacao"}}')" = "$P28_ACERVO_OP"
docker rm -f "$P28_ACERVO_FIX_ID"
test "$(docker network inspect "$P28_ACERVO_TESTNET_ID" --format '{{index .Labels "p28.operacao"}}')" = "$P28_ACERVO_OP"
docker network rm "$P28_ACERVO_TESTNET_ID"
```

## 5. URI e arquivos privados — só após a fase anterior aprovada

No Google Cloud, TI/Guardião confere somente o projeto dedicado **`flow-proh-media-drive` / 930474870480** e a Google Picker API **já habilitada em 02/11**. Drive API, cliente Web e URIs ficam como estão. Se algo tiver mudado, parar e relatar; nenhuma criação/habilitação/chave/segredo/Branding/IAM/DNS está incluída. [Modo integrado e seleção múltipla documentados](https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker).

Conferir o cliente Web existente **“Flow Drive (produção)”** e as duas URIs já conhecidas: `http://127.0.0.1:8765/oauth/callback` e `https://supabase.proh.media/functions/v1/google-drive/callback`. **Somente leitura/preservação de URI nesta operação.** Se faltar a URI local ou divergir projeto/cliente/tipo, parar com a divergência; não cadastrar/trocar para fazer o teste passar. Cliente antigo Flow e Auth Barba & Cabelo permanecem fora do escopo.

Guardião deposita `cred/cliente-novo.json`, formato **Web**, com `web.project_id`, `web.client_id`, `web.client_secret` já guardado e `web.redirect_uris` realmente conferidas no console. Tudo root:root/0600, sem symlinks ou valores em argumentos/logs/chat. Não criar segredo novo; editar JSON não cadastra URI no Google.

**Conta, três principais e conjunto já confirmados pelo Guardião em 03/11:** aproveitar a lista privada existente, sem reler B ou repetir inventário. Antes de depositar, confirmar apenas que o conjunto não mudou desde essa conferência; divergência interrompe o preparo. No manifesto novo, `principais` conserva os três IDs; `referencias:[]`; `operador` tem **exatamente 12 IDs distintos**, seis pastas restantes + seis arquivos (quatro Docs/dois PNG). Total **15**, sem repetir os principais. Só IDs, sem nomes/caminhos/conteúdo.

Não copiar manifesto/candidato antigos nem ampliar silenciosamente o conjunto. A pasta funcional Lixeira está incluída, a lixeira real Google está fora. Tudo deve estar fora da lixeira real no GET. Se aparecer item novo/ausente ou falta de permissão, parar com limite explícito; não selecionar subconjunto para conseguir aprovação. B histórica e qualquer captura com segredo/token antigo **não entram neste runner**. Cliente antigo no config é o OAuth Drive do Flow já conhecido, nunca Auth B&C.

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
if docker exec "$P28_ACERVO_ID" bun ferramentas/p28-drive/bancada/bancada.ts \
  conferir --config /priv/config/bancada.json \
  > "$P28_ACERVO_BASE/evid/conferir.json" 2> "$P28_ACERVO_BASE/evid/conferir.erro"
then P28_ACERVO_RC=0; else P28_ACERVO_RC=$?; fi
printf '%s\n' "$P28_ACERVO_RC" > "$P28_ACERVO_BASE/evid/conferir.exit"
test "$P28_ACERVO_RC" -eq 0
```

Exigir exit 0 / `resultado:ok` / `modo:picker`, `permitir_pastas:true` e `filtrar_por_ids:true`, projeto/cliente/URI/manifesto coerentes. Exigir também `manifesto.principais:3`, `referencias:0`, `operador:12`. As nove pastas devem poder ser selecionadas junto com os seis arquivos. Falha impede consentimento; não afrouxar modos, UID, validador ou escopo.

## 6. Ponte e um consentimento Picker no navegador do box TI

Copiar **somente** `/root/flow-p28-t1-20261102T041627Z/retransmissor.mjs` para `config/retransmissor.mjs`, root:root/0400. Conferir SHA-256 **`e6b8e527c70b166bf7e7c022cdb83853b29f9f71afaf93223a4703e3b9aada68`**. Não copiar PID antigo/servidor fictício. Reconferir labels/ID completo da bancada antes da ponte.

Na VPS, sessão dedicada em primeiro plano, com `P28_ACERVO_ID` desta operação:

```bash
socat TCP4-LISTEN:8765,bind=127.0.0.1,reuseaddr,fork \
  "EXEC:docker exec -i $P28_ACERVO_ID bun /priv/config/retransmissor.mjs 8765"
```

No box TI **do navegador**, sessão dedicada em primeiro plano:

```bash
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=2 \
  -L 127.0.0.1:8765:127.0.0.1:8765 root@187.127.60.78
```

Conferir binds somente 127.0.0.1:8765. Em outra sessão VPS, um `iniciar-picker`, com saídas privadas:

```bash
if docker exec "$P28_ACERVO_ID" bun ferramentas/p28-drive/bancada/bancada.ts \
  iniciar-picker --config /priv/config/bancada.json \
  > "$P28_ACERVO_BASE/evid/iniciar.json" 2> "$P28_ACERVO_BASE/evid/iniciar.privado.log"
then P28_ACERVO_RC=0; else P28_ACERVO_RC=$?; fi
printf '%s\n' "$P28_ACERVO_RC" > "$P28_ACERVO_BASE/evid/iniciar.exit"
test "$P28_ACERVO_RC" -eq 0
```

Operador/Guardião consulta o link de uso único **somente em terminal privado**, abre no navegador do box e confere cliente/conta/escopo antes de consentir. No Picker integrado, marca exatamente **os 15 IDs** (três principais + seis outras pastas + seis arquivos); a lista filtrada não autoriza selecionar itens diferentes nem substituir o manifesto. IDs passam apenas pelo navegador autorizado/Google e arquivos privados, sem aparecer no relatório público. Não colar link, cookie, state, código, conta ou tokens no chat/relatório. Prazo da ferramenta: 15 minutos; não iniciar cedo enquanto organiza o acesso. Não abrir painel Drive de produção.

Não prometer aviso de app não verificado nem sucesso; registrar impedimento real, sem contornar bloqueios/ampliar escopo/trocar conta automaticamente. Mesma conta com drive.file não garante acesso do cliente novo a arquivos antigos. A verificação de marca continua própria.

Exigir `selecao.selecionados:15`, `principais_selecionados:3`, `amostra_esperada:12`, `amostra_selecionada:12`, `extras:0`. Exigir exit 0, etapa `iniciar-picker`, `situacao:concluido`, `selecao.situacao:completa`, `ensaio_aprovado:true`, candidato guardado e GETs concluídos, sem `interrompido`. O arquivo candidato deve identificar modo Picker e seu vínculo privado; não imprimir IDs/hashes desse vínculo. Exit 2 com candidato guardado é **parcial**: preservar e não repetir consentimento cegamente. Recusa antes da gravação também deve ser registrada, não escondida por tentativa automática.

## 7. Renovação imediata e depois do vencimento

Guardar cada renovação em arquivos novos, sem sobrescrever evidência. O #41 grava evidência privada **versão 2** no diretório do candidato; não confundir com o JSON público em `evid/`. Provas v1 anteriores não são alteradas nem reaproveitadas:

```bash
P28_ACERVO_RENOVACAO=$(date -u +%Y%m%dT%H%M%SZ)
test ! -e "$P28_ACERVO_BASE/evid/renovar-$P28_ACERVO_RENOVACAO.json"
if docker exec "$P28_ACERVO_ID" bun ferramentas/p28-drive/bancada/bancada.ts \
  renovar --config /priv/config/bancada.json \
  > "$P28_ACERVO_BASE/evid/renovar-$P28_ACERVO_RENOVACAO.json" \
  2> "$P28_ACERVO_BASE/evid/renovar-$P28_ACERVO_RENOVACAO.erro"
then P28_ACERVO_RC=0; else P28_ACERVO_RC=$?; fi
printf '%s\n' "$P28_ACERVO_RC" > "$P28_ACERVO_BASE/evid/renovar-$P28_ACERVO_RENOVACAO.exit"
test "$P28_ACERVO_RC" -eq 0
```

Fazer uma imediata e outra **após `access_expira_em` do candidato**, sem mostrar token/alterar relógio. Manter apenas rede/runner necessários para a segunda; ponte/túnel podem encerrar após consentimento. Não executar outro `iniciar-picker` nem `iniciar`. A decisão Picker cobre a continuação da mesma operação após esse prazo.

**Ensaio Picker só aprovado** com seleção completa, cliente novo/conta esperada, escopo exatamente drive.file, **todos os 15 IDs** acessíveis/fora da lixeira real, ambas as renovações exit 0 / `ensaio_aprovado:true` / `modo:picker` / **`vinculo_selecao:ok` / `conta_confere:true`**, sendo a segunda com **`apos_vencimento_registrado:true`**. Além dos resumos públicos, TI/Guardião confere privadamente que existem **duas evidências v2**, com horários canônicos distintos, vinculadas ao mesmo candidato/operação/cliente/manifesto, conta conferida e todas as 15 leituras ok; ao menos uma posterior ao vencimento recalculado. Não imprimir conta, IDs ou hashes. A correção do #41 não conta cópias/horários equivalentes como segunda observação. Refresh diagnóstico com vínculo ausente/divergente/incompleto continua reprovado, mesmo se `renovado:true`. Guardar candidato, seleção, manifesto e evidências juntos, sem editar/remover seus campos/arquivos entre as renovações. Arquivo candidato existente, cache, callback ou renovação imediata não bastam.

Se retornar antes do vencimento: **Picker em curso**, horário UTC/Brasília restante e estado dos recursos, sem marcar concluída. Qualquer cobertura incompleta fica como parcial/reprovada; não libera D. Após duas renovações aprovadas, retirar os temporários; não usar `planejar-promocao` ou `aceitar-promocao` com capturas reais nesta operação, pois eles pertencem à futura D.

## 8. Encerramento e devolutiva

Ordem: servidor OAuth encerrado → ponte socat → túnel SSH → retransmissores próprios restantes → containers próprios → rede fictícia se ainda existir → política/rede do acervo. Reconferir IDs completos/labels antes de remover; sem `pkill`, prune, nome compartilhado ou snapshot global. Se a fase inicial falhar, retirar só o que de fato foi criado; não mascarar erro.

Depois de encerrar sessões/processos próprios:

```bash
test "$(docker inspect "$P28_ACERVO_ID" --format '{{index .Config.Labels "p28.operacao"}}')" = "$P28_ACERVO_OP"
docker rm -f "$P28_ACERVO_ID"
iptables -w -D DOCKER-USER -i "$P28_ACERVO_BR" \
  -m comment --comment "$P28_ACERVO_OP" -j "$P28_ACERVO_F"
iptables -w -D INPUT -i "$P28_ACERVO_BR" \
  -m comment --comment "$P28_ACERVO_OP" -j "$P28_ACERVO_I"
iptables -w -F "$P28_ACERVO_F"
iptables -w -X "$P28_ACERVO_F"
iptables -w -F "$P28_ACERVO_I"
iptables -w -X "$P28_ACERVO_I"
test "$(docker network inspect "$P28_ACERVO_NET_ID" --format '{{index .Labels "p28.operacao"}}')" = "$P28_ACERVO_OP"
docker network rm "$P28_ACERVO_NET_ID"
```

O flush acima é **só da cadeia exclusiva identificada**, nunca INPUT/DOCKER-USER/tabela inteira. Erro de retirada deve constar com recurso remanescente; não apagar algo de outra operação. Confirmar ausência de endpoints nas redes antes de remover. Não reutilizar variáveis/PIDs históricos.

Conferir zero containers/redes da operação, nenhum listener/túnel/retransmissor próprio ou salto/cadeia deste ensaio restante; regras anteriores preservadas, banco/funções Flow com mesmos IDs/inícios e saudáveis. Socat instalado, Picker API habilitada, URIs existentes e pasta nova permanecem; entradas/evidências/candidato parcial root 0700/0600, sem transferência para chat/Git/Mac ou limpeza automática. B e o candidato/configurações/evidências C em `/root/flow-p28-c-20261102T174701Z-ad137cf3/` não são alterados/apagados; não copiar o candidato antigo para a operação nova. Também preservar integralmente `/root/flow-p28-picker-20261102T213801Z-44958e51/`.

Devolver Markdown sem segredos: autorização/horários, recursos operacionais, resultado da fase sem credenciais e contadores, Picker API já habilitada e não alterada e URIs preservadas, custódia, contagens/cobertura de casos antigos, exit codes/booleanos seguros de iniciar/renovar e prova após vencimento, parcial/recusado quando ocorrer, limpeza/comparação dos serviços. Nada de valores privados, links de uso único, hashes de credencial/manifesto/evidência ou conteúdo B/candidato. Informar seleção/cobertura e `vinculo_selecao` somente por estados/contagens. Se os 15 passarem, registrar acesso por GET de metadados ao **conjunto observado/confirmado em 03/11**, não uma garantia de recursividade, conteúdo ou itens futuros. Aprovação da bancada não libera D automaticamente. D permanece separada, sem revogar cliente antigo ou alterar Barba & Cabelo.
