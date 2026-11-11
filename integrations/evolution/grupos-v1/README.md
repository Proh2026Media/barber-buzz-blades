# Extensão local da Evolution — grupos do B&C

**Estado em 11/11/2026:** código para revisão, testes locais e imagem local construída. Não instalada, não publicada em registry, sem sessão WhatsApp ou grupo real. O adaptador B&C continua bloqueado. Este pacote não autoriza implantação.

## Base e artefatos

- Fonte pública: [EvolutionAPI/evolution-api](https://github.com/EvolutionAPI/evolution-api/tree/cd800f2976e1e5b682fbf86a01ee4d85ae61f370), revisão `cd800f2976e1e5b682fbf86a01ee4d85ae61f370`, identificada pela TI; versão 2.3.7/Baileys 7.0.0-rc.9.
- Versão local: `2.3.7-bc.groups.1`. Dependências mantidas pelo lockfile; alterações de versão somente na raiz do pacote.
- [Patch completo, incluindo quatro arquivos de testes](evolution-bc-groups.patch) e [SHA-256](SHA256SUMS). O patch aplica em checkout limpo da revisão acima.
- Dockerfile incluído no patch: `Dockerfile.bc-groups`. Base fixada em `evoapicloud/evolution-api@sha256:1bd8afc4a6cf48822e6cf02469aeae7bd35a12a6b616eacd1291926307f4d339`.
- Esse digest é o índice OCI de arquiteturas; seu filho Linux/AMD64 é `sha256:456b4104b0ddffbb092d6b3c0560a4ae86fc3e014e885b882aca4b1b371dfc81`. A relação foi conferida no manifesto público; os dois valores não demonstram, por si, divergência de instalação. Não houve consulta nova à VPS.
- Imagem construída somente no Docker local: `local/bc-evolution-groups:2.3.7-bc.groups.1`, Linux/AMD64. Digest de configuração `sha256:66a93d32664f5593a69393ae77749a89363aa8afb2f4752c536e8120ada59c68`; índice/ID local da construção `sha256:0a55253391f9780393bd3917e460af0c3954f3b7ac1e8f6696789820e2aa30c2`. Não são referência de registry disponível para instalação. Uma nova construção pode gerar digest diferente.

## O que a extensão acrescenta

| Bloco | Implementação local                                                                                            | Limite                                                                                    |
| ----- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| A     | Modos de adição/aprovação, metadados completos e consulta com conferência do administrador                     | Campo ausente permanece desconhecido; consulta real ainda não homologada                  |
| B     | Consulta/decisão de pedidos, evento de entrada, PN/LID preservados e conflito recusado                         | Consentimento, equipe e vínculo continuam sendo decisão do B&C; nunca autopromover        |
| C     | UUID estável entre retries do mesmo evento, contrato `bc-groups-v1`, remoção da `apikey` no envelope de grupos | Não adiciona fila persistente, ordem nem garantia de entrega                              |
| D     | Diário persistente por instância/chave antes de criar, unicidade e estado desconhecido conservador             | Queda entre WhatsApp e gravação pode exigir revisão manual; nunca recriar automaticamente |
| E     | Evento de recibo por participante, conservando identidade e horários originais                                 | Não identifica sozinho o Cliente nem transforma recibo agregado em entrega comprovada     |

A criação aceita exclusivamente números da Plataforma presentes na lista explícita, sem participantes comerciais nem promoção. Persiste o JID conhecido antes de qualquer configuração posterior. `created` significa apenas que o ID foi gravado, não que o grupo está protegido ou liberado para uso. Não usa nome, descrição ou horário para recuperar identidade.

Os endpoints antigos da Evolution continuam disponíveis e têm suas permissões anteriores. O futuro adaptador B&C precisa usar exclusivamente o novo contrato para criação; o diário não protege chamadas feitas por fora dele. A chave administrativa da Evolution permanece segredo de servidor.

## Contrato HTTP

Prefixo `/group`; todas as rotas terminam em `/:instanceName` e reutilizam as guardas existentes de instância, sessão e API key. A instância vem somente do caminho. Parâmetros extras são recusados. Limite adicional de 60 requisições válidas por minuto/instância, em memória por processo; não é uma quota distribuída ou persistente.

| Método/rota                   | Corpo POST ou consulta GET                                               |
| ----------------------------- | ------------------------------------------------------------------------ |
| GET `bcCapabilities`          | Sem parâmetros                                                           |
| GET `bcInspect`               | `groupJid`                                                               |
| POST `updateMemberAddMode`    | `groupJid`, `mode`: `admin_add` ou `all_member_add`                      |
| POST `updateJoinApprovalMode` | `groupJid`, `mode`: `on` ou `off`                                        |
| GET `joinRequests`            | `groupJid`                                                               |
| POST `joinRequests`           | `groupJid`, `participants`, `action`: `approve` ou `reject`              |
| POST `bcCreate`               | `operationId` UUID, `subject`, `participants` (até cinco PN autorizados) |
| GET `bcCreateStatus`          | `operationId`                                                            |

A extensão exige conexão aberta e identidade própria autorizada inclusive para consulta de operação. Durante queda, o diário continua no banco; consulta HTTP depende da recuperação da instância ou diagnóstico interno autorizado. Aprovação exige pedido ainda pendente e confirmação de `restrict=true`, `memberAddMode=false`, `joinApprovalMode=true`. O B&C deverá conferir novamente consentimento e composição antes de decidir.

## Configuração futura, desligada por padrão

`BC_GROUPS_EXTENSION_ENABLED=false` é o padrão da imagem. A ativação exige simultaneamente flag verdadeira, nome exato em `BC_GROUPS_INSTANCES` (lista separada por vírgulas) e mapa JSON `BC_GROUPS_PLATFORM_JIDS` de instância para PN JIDs autorizados. Não há número real ou segredo neste pacote. Ausência/erro da configuração bloqueia operações.

Eventos novos: `GROUP_JOIN_REQUEST` → `group.join-request`; `MESSAGE_RECEIPT_UPDATE` → `message-receipt.update`. Preservados `GROUP_PARTICIPANTS_UPDATE` e o nome nativo com hífen; registrado `GROUPS_UPDATE`, mantendo alias legado. Configuração de eventos precisa ser revisada por instância. Cabeçalho personalizado depende do webhook local da instância; não substituir consumidores existentes sem inventário.

UUID cobre retries no mesmo processamento, não nova emissão independente após reinício. Pode haver zero entregas, duplicatas e ordem invertida. Reconciliação por consulta continua obrigatória. Eventos habilitados de grupos não transportam `apikey`; demais eventos/instâncias mantêm comportamento anterior.

## Banco e inicialização

A tabela `BcGroupOperation` possui unicidade por instância/chave e não é removida por exclusão em cascata da instância. Incluídas migrations PostgreSQL e MySQL `20261111190000_bc_group_operations` e respectivos modelos Prisma. São migrations **do banco da Evolution**, distintas das nº 105/106 do B&C. O provedor efetivo de produção não foi consultado nesta rodada.

O novo Dockerfile inicia diretamente `node dist/main.js`: **não aplica migrations nem imprime a URL do banco ao reiniciar**. Geração do cliente Prisma ocorre na construção, com endereço fictício, sem conexão. `DATABASE_PROVIDER` de construção aceita `postgresql` (padrão) ou `mysql`; deve corresponder ao banco real antes de uma futura implantação. Alterar a imagem sem a etapa de banco adequada não é uma implantação válida. Volumes, sessões e reversão precisam de roteiro próprio autorizado.

## Reproduzir somente localmente

Em checkout separado da revisão exata, confira `SHA256SUMS` a partir desta pasta, execute `git apply --check` e aplique o patch. A pasta `test/` é ignorada no projeto original, mas os testes estão incluídos no patch. Não usar `git clean` no projeto do usuário.

```sh
npm ci --ignore-scripts --no-audit --no-fund
DATABASE_CONNECTION_URI='postgresql://local:local@127.0.0.1:59999/local' npx --no-install prisma generate --schema prisma/postgresql-schema.prisma
npx --no-install tsc --noEmit
npm run test:bc-groups
npm run build
```

Para o ensaio PostgreSQL, executar `python3 testar-banco-local.py /caminho/do/checkout-evolution-com-patch` a partir desta pasta. O roteiro exige Docker local, cria container próprio na porta 54332, recusa nome ocupado, instala somente a migration nova, executa dois testes e remove apenas o container que criou. Usa credencial fictícia local; nenhum banco do B&C ou da VPS é acessado.

Construção local, a partir do checkout com patch (substituir o hash pelo conteúdo de `SHA256SUMS`):

```sh
docker build --platform linux/amd64 -f Dockerfile.bc-groups --build-arg BC_PATCH_SHA256=HASH_DO_PATCH -t local/bc-evolution-groups:2.3.7-bc.groups.1 .
```

Não executar esse container com sessões reais. A construção não inicia a aplicação. Publicação de imagem e instalação continuam fora do escopo.

## Verificações e limites

**26 testes aprovados:** 20 de política/concorrência simulada, dois HTTP reais em loopback, dois do controlador de webhook com transporte simulado e dois com PostgreSQL real descartável/duas conexões. Incluem autenticação das oito rotas, isolamento do parâmetro de instância, enums, limite, identidade conflitante, falta de administrador, perda de confirmação, operação única após reinício de clientes e preservação de ID no retry.

Tipos TypeScript, lint dos arquivos de produção alterados, montagem e validação Prisma PostgreSQL/MySQL aprovados. Imagem Linux/AMD64 construída sobre base fixada. Testes do host usaram Node 26; construção Docker usa Node 24 da imagem base. MySQL foi validado como schema, não ensaiado com servidor MySQL. Aplicação do patch em checkout limpo conferida.

Não houve teste real de WhatsApp, criação sem participante adicional, admissão, identidade PN/LID ao vivo ou entrega de mensagem. Regras de consentimento/revogação/troca de equipe são responsabilidade do B&C e precisam do ensaio integrado. O pacote não elimina o risco de restrição pela Meta.

Próximo trabalho: integrar o adaptador B&C, convites/remoções, reconciliação, fila de eventos de negócio e recibos ao cliente correto, mantendo o bloqueio até completar testes locais e definir piloto autorizado. [Registro de entrega](../../../docs/pacotes/2026-11-11-evolution-extensao-grupos-local.md).
