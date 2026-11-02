# P-28 — T1 concluído: transporte fictício conferido

**02/11/2026 · A, B e T1 concluídos. C real e D não executadas.** A TI testou a ponte loopback com dados fictícios e encerrou seus recursos. Codex conferiu por leitura os artefatos e o estado posterior na VPS. Próximo: [fechar somente os requisitos restantes de C](2026-11-02-ti-flow-requisitos-restantes-c-p28.md), sem repetir T1, captura B, PR ou levantamento geral.

## 1. Fonte, autorização relatada e alcance

Lido inteiro **`relatorio-ti-flow-t1-p28-2026-11-02 131.md`**, 99 linhas, SHA-256 `2e5087e19af170da6f03ed81e80f6b8c494ac390b950bda9ca9e02dd4b75da3d`. O relatório registra autorização de Alyson para executar T1 **a partir da máquina da TI**, substituindo o Mac pessoal no lado local do túnel. Essa autorização é atribuída ao relato da TI; o recebimento do arquivo não foi tratado como nova autorização para executar C/D.

O teste atende ao [roteiro T1](2026-11-02-ti-flow-transporte-t1-p28.md) para transporte, Host e limpeza. A substituição da máquina local não comprova que o navegador do futuro consentimento alcançará o retorno: em C ele deve estar no mesmo ambiente do endpoint local do túnel, ou ter um caminho equivalente previamente fechado.

Esta frente continua sendo dependência da **P-28 do Barba & Cabelo**, pela separação Google do Drive do Flow escolhida pelo dono. Não abre desenvolvimento funcional do Flow nem altera o cliente de login do Barba & Cabelo.

## 2. Execução relatada pela TI

| Item            | Resultado relatado                                                                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Horários        | Início **01:16:03–01:16:05 Brasília** / 04:16:03–04:16:05 UTC; container/ponte ~01:16:27; HTTP ~01:16:57–01:17:05; encerramento **01:17:27** / 04:17:27 UTC, em 02/11 |
| APT             | Simulação: somente um pacote novo, zero atualizações/remoções; instalação de `socat=1.8.0.0-4ubuntu0.1` com `NEEDRESTART_SUSPEND=1`; pacote permanece instalado       |
| Imagem          | `oven/bun:1.4.2@sha256:296a79bbc988bb0a91ef11099af70a78a8cba98b73fd53f7b2a7715b7c86ced2`, amd64                                                                       |
| Operação        | `20261102T041627Z`; pasta `/root/flow-p28-t1-20261102T041627Z/`                                                                                                       |
| Container       | `flow-p28-t1-20261102T041627Z`, ID `8c9c84876beb631cfb9026735f3fbeb46eaaff875c67f8932789387983572a9b`; labels T1/operação                                             |
| Isolamento      | Rede `none`, sem portas Docker publicadas; somente pasta fictícia montada RO; sem B, credenciais ou banco                                                             |
| Ponte           | Socat no host → `docker exec` pelo ID completo → retransmissor Bun no loopback; bind somente `127.0.0.1:8765`                                                         |
| Túnel           | `ssh -L` na máquina da TI, também somente `127.0.0.1:8765`; nenhum túnel exigido no Mac pessoal                                                                       |
| HTTP pelo túnel | Corpo `p28-t1-ficticio`, Host incorreto **421**, POST **405**, callback fictício **404**                                                                              |
| Limpeza         | Ponte por PID próprio → túnel por PID próprio → container por ID/labels reconferidos; sem `pkill`, prune ou remoções globais                                          |

O encerramento por PID em arquivo privado difere das sessões em primeiro plano propostas, mas o relato identifica apenas processos próprios e preserva a ordem de limpeza. Não é instrução para reutilizar os PIDs históricos. A ausência de listener no box e os quatro HTTP são evidência da TI; Codex não repetiu o teste nem acessou essa máquina.

## 3. Conferência própria do Codex, somente leitura

Por SSH, sem nova instalação, container, túnel, listener, acesso ao Google ou leitura de B/env/banco:

- `dpkg-query`: **`ii 1.8.0.0-4ubuntu0.1`** para socat.
- Pasta T1 **0700**, root:root, sem link simbólico; os dois scripts **0400**, root:root. Metadados e log 0600; marcador de encerramento 0644 sob diretório 0700, sem dados de credencial. Nenhum ajuste remoto de permissão foi necessário ou feito.
- Os bytes dos dois scripts coincidem com os blocos do pacote T1: servidor **891 bytes**, SHA-256 `78cb8afb4395759e0f740af234f1b0bda676ff6c09bc6e28f5c868eac7f8ea37`; retransmissor **864 bytes**, SHA-256 `e6b8e527c70b166bf7e7c022cdb83853b29f9f71afaf93223a4703e3b9aada68`. São scripts fictícios, não cópias de segredo.
- Log fictício socat contém somente saída por sinal 15, às **04:17:18 UTC / 01:17:18 Brasília**, dentro da janela de encerramento relatada.
- **Zero** containers pelos labels T1/operação; o ID completo guardado também ausente. **Nenhum listener 8765** ou processo residual identificado da operação na VPS.

| Serviço Flow conferido | ID                                                                 | Saúde   | Início preservado                |
| ---------------------- | ------------------------------------------------------------------ | ------- | -------------------------------- |
| Banco                  | `80c3d9164c0785eb79b717f2153dca544dfb78bf2dd51ce767b5e752098d313f` | healthy | `2026-10-23T20:44:50.472960587Z` |
| Funções                | `d411e8225ad969f98d929f9ed471eb32450f098aab52206ce5b892f8aa49e2d4` | healthy | `2026-11-01T18:32:29.790943603Z` |

A TI relata ausência de reinícios; a leitura própria confirma esses dois serviços conhecidos, não uma auditoria nova de todas as stacks. Container removido não permite reinspecionar retroativamente sua rede/mounts; esses dados de execução são atribuídos ao relatório, com scripts e estado posterior conferidos.

## 4. O que foi encerrado e o que vem depois

**T1 atendido.** Não reinstalar socat, repetir os curls, abrir túnel no Mac ou executar novamente A/B para fechar essa entrega. Preservar pasta fictícia e logs; a cópia B continua sob sua custódia anterior, sem nova leitura.

T1 não usa Google nem valida credencial, consentimento, acesso a arquivos antigos, renovação real ou saída de rede de C. O runner de C precisará de HTTPS Google e não poderá simplesmente reutilizar `--network none`; o desenho de isolamento e o caminho do navegador ainda precisam ser fechados. O [arquivo restante para TI/Guardião](2026-11-02-ti-flow-requisitos-restantes-c-p28.md) delimita a devolutiva sem repetir a preparação geral.

URI local ainda ausente no último console relatado; nenhum novo estado Google foi inferido deste teste. A futura adição preserva a URI de produção e pertence ao cliente novo. Credencial candidata e manifesto ficam separados da conexão viva e de B. D exige seu próprio procedimento com barreira de escritores, nova captura, promoção e aceitação; não está autorizada por T1.

**Verificação desta entrega documental:** `scripts/verificar.sh` aprovado: tipos, **301 testes Barba & Cabelo**, formatação dos dez documentos e montagem; ESLint sem TS alterado. 24 links novos locais e quatro blocos Bash conferidos; scripts JS preservados. Não há mudança no código do aplicativo ou do Flow nem novo ensaio OAuth nesta revisão.
