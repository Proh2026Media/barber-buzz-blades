# P-28 — C2 conferida: confirmações aproveitadas e procedimento C corrigido

**Estado posterior — C parcial, não repetir a preparação:** [resultado e temporários encerrados](2026-11-02-flow-etapa-c-parcial-p28.md). Próximo: [preparação seletiva Picker para Claude, só fictícios](2026-11-02-claude-flow-picker-seletivo-p28.md). O restante registra a revisão anterior à execução C, não o estado atual da VPS.

**02/11/2026 · Somente revisão, sem execução de C/D.** Lido inteiro `relatorio-ti-flow-preparacao-c2-p28-2026-11-02.md`, **286 linhas**, elaborado pela TI às **13:54 Brasília**. SHA-256: `717211176c85c31779fb4a295ac841acdd452b3d4ee144967c591c679cd7d2d1`. O anexo contém confirmações e propostas; seus comandos não foram tratados como autorização.

Próximo: [procedimento C consolidado para decisão](2026-11-02-ti-flow-execucao-c-p28.md), corrigindo usuário/rede e incluindo verificação sem credenciais antes do Google real. Não pedir outro inventário geral, segredo, PR, captura B ou T1.

## 1. Confirmações aproveitadas

| Item                   | Estado                                                                                                                                                                                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Segredo novo existente | **Disponível segundo o Guardião**, confirmação às 13:53 Brasília baseada na custódia de 31/10, sem reabrir o cofre nesta preparação. Corresponde ao cliente Web novo “Flow Drive (produção)”, projeto `flow-proh-media-drive` / 930474870480. Não pedir segredo novo nem rotação |
| Custódia original      | Guardião informa cofre compartilhado 1Password; nenhum valor, fragmento, hash de segredo ou ID do item recebido/lido pelo Codex                                                                                                                                                  |
| Manifesto futuro       | TI + Guardião responsáveis; extração privada seletiva de B e indicação de arquivos antigos na C autorizada. Cliente antigo é o Drive Flow atual, não Auth Barba & Cabelo                                                                                                         |
| Custódia C             | Root/TI na VPS, `/root/flow-p28-c-<UTC>/`, diretórios 0700/arquivos 0600, separada de B/API/Git; candidato parcial preservado; retenção até decisão explícita, sem limpeza automática                                                                                            |
| Navegador              | Mesmo box da TI do endpoint `ssh -L`, coerente com T1; sem exigir túnel no Mac do dono                                                                                                                                                                                           |
| URI                    | Local ainda ausente no último estado relatado; adicionar futuramente só no cliente novo, preservando produção                                                                                                                                                                    |

A disponibilidade é confirmação do Guardião, não verificação do valor pelo Codex. Não reabrir essa pendência porque o segredo não foi exposto ao chat. Depósito condicionado à decisão de C.

## 2. Correções operacionais

**UID 1000 incompatível com a custódia root.** Leitura própria SSH confirmou fonte `/root/flow-pr38-20261102T004233Z/src` **0500/root** e README **0400/root**. C2 mantém `/priv` 0700/0600 root, mas propõe `--user 1000:1000`: esse usuário não atravessa/lê as pastas; o validador também exige dono igual ao UID atual. O procedimento usa **0:0**, capacidades removidas, no-new-privileges e raiz RO, preservando os modos. Não tornar arquivos públicos nem mudar donos para contornar a falha.

**DOCKER-USER não cobre todo acesso ao host.** Leitura própria: três DROP existentes em DOCKER-USER (eth0/8000, 6001, 6002); INPUT com política ACCEPT e salto `ts-input`. Destinos locais da VPS passam por INPUT, não apenas encaminhamento. A proposta C2 deixa essa lacuna para serviços do host/gateway. O procedimento acrescenta cadeia INPUT fechada com salto exclusivo da interface C, além da cadeia de encaminhamento; não altera regras Tailscale/produção. [Cadeias Docker](https://docs.docker.com/engine/network/firewall-iptables/), [INPUT/FORWARD — Netfilter](https://www.netfilter.org/documentation/HOWTO/packet-filtering-HOWTO-6.html).

**HTTPS público não significa somente Google.** ACCEPT TCP/443 é geral para destinos públicos. A descrição corrigida distingue firewall de endereços/portas da porteira de métodos/URLs Google da ferramenta revisada. Bloqueios privados precedem permissões, considerando DNAT; sem ACCEPT genérico de conexões estabelecidas antes deles. Recursos e cadeias exclusivos por operação; sem flush global ou `|| true` indiscriminado. [Ordem e DNAT](https://docs.docker.com/engine/network/firewall-iptables/).

**Timeout sem serviço não comprova DROP.** `192.0.2.1` é documentação, não RFC1918; `.250` não está reservado como alvo fictício e pode passar a existir na produção. O procedimento não sonda a rede Flow. Sua fase inicial usa servidores fictícios ativos em host/bridge próprios e contadores/regras, antes de credenciais. Se não demonstrar proteção e saída funcional, não avançar ao Google.

Nenhuma rede C existia na consulta própria. Nenhuma regra aplicada/removida, container, listener, pasta C, URI ou credencial criado nesta revisão. Sem leitura de B/env/dados do banco. Os comandos corrigidos são proposta revisada, não teste realizado na VPS.

## 3. Propriedade/marca: trecho contraditório conciliado

C2 afirma “CONFIRMADO”, descreve a propriedade `proh.media` abrindo no Search Console, mas diz que o nível da conta não foi aberto e termina com “evidência específica [...] ainda não conferida”. Aproveitar como **acesso à propriedade e domínio autorizado relatados**, sem converter em prova completa de titular verificado/associação ao projeto. Há papéis distintos de usuário/proprietário. Quando for necessário fechar a verificação da marca, pedir só essa evidência específica, sem novo inventário. [Papéis Search Console](https://support.google.com/webmasters/answer/7687615).

`drive.file` é não sensível e tem acesso por arquivo; não significa acesso automático do cliente novo aos arquivos antigos nem dispensa todos os requisitos de marca. Não prometer aviso de “app não verificado” ou consentimento certamente disponível: registrar a tela/recusa real, sem ampliar escopo ou contornar bloqueio. [Escopos Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [estados da marca](https://support.google.com/cloud/answer/15549049), [políticas OAuth](https://developers.google.com/identity/protocols/oauth2/policies).

Essa ressalva documental não bloqueia indefinidamente o ensaio: a decisão de C abrange tentar o fluxo com cliente/escopo delimitados; o resultado real dirá se é viável. A conclusão da verificação correspondente continua própria, sem alteração DNS/IAM/Branding por esta revisão.

## 4. Encaminhamento

O [arquivo C para TI/Guardião](2026-11-02-ti-flow-execucao-c-p28.md) consolida efeitos, comandos, entradas privadas, renovação após vencimento e retirada. A/B/T1 concluídos; C gera/testa candidato separado, **sem promover no banco**. D exige barreira de escritores, nova captura e aceitação antes da reabertura.

Objetivo preservado: dependência Google da **P-28 do Barba & Cabelo**, sem nova frente funcional Flow, alteração do cliente B&C ou novo PR.

**Validação documental:** tipos, **301 testes Barba & Cabelo**, formatação dos oito documentos e montagem aprovados; 19 links novos locais, 12 blocos Bash, cinco trechos JavaScript e dois esquemas JSON conferidos. Sintaxe não atesta execução de firewall/Google; a fase inicial de C deve demonstrar o isolamento depois da decisão, antes de credenciais. Nenhum código do aplicativo/Flow alterado.
