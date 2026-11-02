# P-28 — Etapa B pronta para decisão: captura protegida das integrações Flow

**01/11/2026 · Preparação concluída, sem execução.** A [etapa A está concluída](2026-11-01-flow-etapa-a-concluida-p28.md). Este pacote delimita a próxima decisão de Alyson: **uma captura somente leitura das integrações reais e sua validação offline**, com arquivo secreto preservado na própria VPS. A autorização anterior era apenas do reensaio fictício; não executar B pelo recebimento do relatório de A.

## 1. Escopo proposto para aprovação

Usar a ferramenta já revisada para ler as duas integrações e os mapas de referências, gravar a cópia privada e validá-la. Sem mudar dados/configuração no banco, cron, ambiente, Google ou permissões. Não pausar serviços, iniciar PostgreSQL, executar testes na rede de produção, restaurar ou migrar. Uma captura e uma validação, registrando o início após a autorização.

O arquivo contém **credenciais/token reais e referências privadas**; permanece sob custódia da TI/root na VPS. Não enviar ao chat, Git, navegador, máquina local ou outro serviço. Preservá-lo sem exclusão automática até decisão de descarte do dono; a proposta antiga de 30 dias depois da virada estável não é autorização para apagar. Nenhum segredo deve aparecer em argumento, saída pública, captura de tela ou relatório.

Operador Google, manifesto de arquivos antigos e credencial do cliente novo são dependências de C, **não necessárias para esta cópia B**. Não pedir novamente criação de projeto, acesso DNS, PR/merge, instalação #36 ou inventário geral.

## 2. Versão e alvo fixados

| Item                                             | Valor                                                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Código                                           | `Proh2026Media/flow-proh-media`, commit **`9837ebc873554d3e7685f792c18d01349418ed2e`**                   |
| Ferramentas                                      | Subárvore `fb576d0970c46fe9dcb918fa10be59d62f2111a3`, **19 blobs**                                       |
| Fonte já preservada                              | `/root/flow-pr38-20261102T004233Z/src/`, `root:root`, sem escrita; conferir blobs/dono, sem sobrescrever |
| Bun                                              | `oven/bun:1.4.2@sha256:296a79bbc988bb0a91ef11099af70a78a8cba98b73fd53f7b2a7715b7c86ced2`                 |
| Rede Docker, somente captura                     | **`vv3jo93anprhqezhtu4ewcpl`**, Flow produção                                                            |
| DB fonte                                         | **`supabase-db-vv3jo93anprhqezhtu4ewcpl`**, banco **`postgres`**                                         |
| Container de funções para presença das variáveis | **`supabase-edge-functions-vv3jo93anprhqezhtu4ewcpl`**                                                   |
| Diretório novo                                   | **`/root/backup-flow-integracoes-p28-<UTC>/`**, 0700, `root:root`, fora de API/stack/Git                 |

Não usar scripts de instalação/migração ou desativar suas guardas. Nenhum endereço de outra stack, inclusive teste ou Barba & Cabelo. A opção `--stack` é metadado informado, não prova do alvo: conferir o container/rede/banco e a conexão de fato.

## 3. Preparo privado após autorização de B

1. Registrar horário Brasília/UTC, IDs/saúde/início de DB e funções Flow. Conferir fonte, digest/arquitetura Bun e rede reais. A imagem foi obtida novamente no reensaio A; não presumir presença permanente, nem usar `latest` se precisar obter o digest fixado.
2. Criar diretório **novo e físico** acima, com `umask 077`, e subdiretórios `entrada`, `saida` e `logs`, todos 0700, `root:root`. Não reaproveitar nem sobrescrever cópia existente. A ferramenta criará `saida/operacao`; esse filho deve estar **ausente** antes de `capturar`.
3. Ler a configuração atual das funções **somente para presença não vazia** de `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DRIVE_TOKEN_SECRET`, `DRIVE_CRON_SECRET`. Gravar `entrada/origens.json`, versão 1, quatro booleans no formato da ferramenta. A linha de base é quatro `false`: se divergir, parar e relatar só os booleans/origem, sem alterar env ou ampliar a cópia. Não substituir a leitura por nomes apenas: variável definida vazia conta como ausente.
4. TI gerar **na VPS**, a partir da configuração já gerenciada da stack alvo, `entrada/conexao.url` 0600, `root:root`, sem exibir valor. Conferir em memória protocolo PostgreSQL, banco `postgres`, host/IP e porta privados pertencentes ao DB Flow identificado na rede acima. O host deve resolver para o DB desse ID, sem ambiguidade entre aliases de stacks. Não pedir senha ao dono, transmiti-la ao Codex ou procurar credenciais de outras stacks. Se a conexão não puder ser identificada com segurança, parar com essa pendência específica.
5. Conferir arquivos físicos, donos/modos e que o UID 0 do runner consegue ler os 0600. A experiência de A mostrou que `--cap-drop ALL` não contorna fonte pertencente ao UID 1000: normalizar a fonte verificada para root, conservando-a sem escrita; **não** abrir acesso a segredos para terceiros.

Formato de `origens.json` quando a linha de base for confirmada, sem valores secretos:

```json
{
  "versao": 1,
  "variaveis": {
    "GOOGLE_CLIENT_ID": false,
    "GOOGLE_CLIENT_SECRET": false,
    "DRIVE_TOKEN_SECRET": false,
    "DRIVE_CRON_SECRET": false
  }
}
```

A conexão pode usar o papel já gerenciado que tenha acesso de leitura às tabelas; não criar papel, alterar RLS/grants ou usar opção que imprima consultas/valores. Não colocar URL ou segredo em argv/env do runner. Se não houver fonte compatível em banco, esta aprovação B não autoriza adaptar o formato para credenciais do ambiente.

## 4. Captura — somente runner dedicado na rede Flow

Definir, na mesma sessão Bash, `P28_B_BASE` como o diretório novo, `P28_B_UTC` como seu UTC, `P28_B_SRC` como a fonte conferida e `P28_B_BUN` como a imagem fixada. Confirmar nomes livres. Nenhum `bun test`, `planejar`, `restaurar-ficticio`, `configure`, `status` ou comando Google faz parte desta execução.

```bash
set -euo pipefail
umask 077
: "${P28_B_BASE:?}" "${P28_B_UTC:?}" "${P28_B_SRC:?}" "${P28_B_BUN:?}"
test -d "$P28_B_BASE/saida"
test ! -e "$P28_B_BASE/saida/operacao"
docker run --rm --name "flow-p28-captura-$P28_B_UTC" \
  --label p28.etapa=B --label "p28.operacao=$P28_B_UTC" \
  --network vv3jo93anprhqezhtu4ewcpl \
  --user 0:0 --read-only --cap-drop ALL --security-opt no-new-privileges \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=128m,mode=1777 \
  --mount "type=bind,src=$P28_B_SRC,dst=/work,readonly" \
  --mount "type=bind,src=$P28_B_BASE/entrada,dst=/entrada,readonly" \
  --mount "type=bind,src=$P28_B_BASE/saida,dst=/cap" \
  -w /work "$P28_B_BUN" \
  bun ferramentas/p28-drive/integracoes.ts capturar \
    --conexao /entrada/conexao.url --origens /entrada/origens.json \
    --fonte producao --stack vv3jo93anprhqezhtu4ewcpl --destino /cap/operacao \
  > "$P28_B_BASE/logs/captura.json" 2> "$P28_B_BASE/logs/captura-erro.log"
```

O código conferido abre **`REPEATABLE READ READ ONLY`**, limita a consulta a 30 s e termina em **`ROLLBACK`**; não escreve no banco. Captura o par inteiro `google_oauth`/`google_drive` com desconhecidos/nulos/presença preservados e mapas de IDs das seis tabelas; os mapas não incluem nomes/conteúdo de negócio. Destino esperado: **`saida/operacao/copia-integracoes.json`**.

Cron continua ativo. A transação fornece uma imagem consistente naquele instante; não é barreira contra escritores e não substitui a nova imagem imediatamente anterior à futura virada D. Não suspender cron/funções para esta captura B.

## 5. Validação offline e critérios obrigatórios

Depois de `capturar` retornar 0, executar em **outro runner, sem rede e sem montar `entrada`**:

```bash
set -euo pipefail
umask 077
docker run --rm --name "flow-p28-validacao-$P28_B_UTC" \
  --label p28.etapa=B --label "p28.operacao=$P28_B_UTC" \
  --network none --user 0:0 --read-only --cap-drop ALL --security-opt no-new-privileges \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=128m,mode=1777 \
  --mount "type=bind,src=$P28_B_SRC,dst=/work,readonly" \
  --mount "type=bind,src=$P28_B_BASE/saida,dst=/cap,readonly" \
  -w /work "$P28_B_BUN" \
  bun ferramentas/p28-drive/integracoes.ts validar --copia /cap/operacao/copia-integracoes.json \
  > "$P28_B_BASE/logs/validacao.json" 2> "$P28_B_BASE/logs/validacao-erro.log"
```

Conferir os resumos JSON privados, sem imprimir a cópia:

- Ambos os comandos com **saída 0**; captura `resultado: "ok"`; validação `resultado: "aprovada"` e **`apta_para_restaurar: "sim"`**. **Saída 0 sozinha não basta:** a CLI pode aprovar o formato e ainda informar inaptidão no campo.
- Fonte `tipo: "producao"`, stack exata acima; `origens.credencial: "banco"`, `origens.variaveis_parciais: false`, origem do cron coerente com a linha de base em banco; **`quantidades.integracoes_presentes: 2`**. Conferir origem separadamente: o rótulo de aptidão não substitui essa verificação.
- Arquivo não vazio, integridade do formato conferida, contagens/mapas presentes e sem perda de dados/precisão. O aviso **`legado_sem_client_id`** já é previsto no contrato: preservar a ausência e registrá-lo, sem preencher o campo ou inventar a origem do token; ele não impede B se os demais critérios passarem. Ausência de uma linha, origem diferente, divergência de par, recusa numérica ou outro aviso precisa de análise; não corrigir os dados/configuração para fazer a cópia caber.
- Revalidar os quatro booleans ao final e comparar aos iniciais. Mudança de origem durante a captura impede declarar B concluída, sem revogar ou alterar variáveis.
- Cópia e logs físicos, `root:root`, arquivos 0600 e diretórios 0700, fora da API/Git. Guardar verificações de integridade privadas; não publicar hash de documento secreto, tokens, credenciais ou IDs de arquivos/clientes.

`apta_para_restaurar: "sim"` significa que os campos mínimos/par foram aceitos; **não é permissão nem comando de restauração em produção**. O restaurador entregue continua restrito ao fictício, sem desvio de guarda. Esta etapa não ensaia a cópia real em outro banco.

## 6. Encerramento, falhas e devolutiva

Os runners usam `--rm`. Se houver erro/interrupção, identificar e encerrar apenas o runner desta operação pelos labels/ID, preservar cópia parcial/logs 0600 e relatar a falha. Não sobrescrever ou apagar automaticamente o resultado para repetir; diretório novo só depois de entender o motivo.

Ao fim, remover somente o arquivo descartável **`entrada/conexao.url`**, após confirmar o fechamento dos runners; conservar origens/cópia/logs privados. Conferir ausência de containers pelos filtros `p28.etapa=B` e `p28.operacao=<UTC>`, donos/modos e saúde/início dos serviços existentes. Sem reiniciar, remover volumes ou executar limpeza global.

Devolver Markdown **sem segredos** com horários, commit/19 blobs, runtime, alvo verificado, quatro booleans antes/depois, fonte efetiva, saídas e estados dos dois comandos, contagens/tamanho/validação, caminhos/modos/custódia e limpeza/saúde. Resumos completos, conteúdo e hashes do arquivo secreto ficam na VPS; no relatório público só campos permitidos e integridade confere/não confere.

**B só pode ser marcada concluída após captura/validação/limpeza comprovadas.** Nesta preparação nada disso foi executado, nenhum diretório de backup real foi criado ou segredo obtido. Google/consentimento/URI/candidato (C) e virada/barreira de escritores (D) continuam próprios.
