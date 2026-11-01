# P-28 — Etapa A executada com falha: corrigir portas dos testes Flow

**01/11/2026 · Encaminhamento direcionado ao Claude/Flow.** A TI executou a etapa A, mas as duas rodadas terminaram em **85 aprovados / 1 falha / 0 pulados**. Não aprovar pela união dos resultados nem repetir corridas até aparecer uma verde. Corrigir o apoio dos testes em PR próprio; depois revisar e fazer o reensaio isolado da TI. Nenhuma captura real ou migração está liberada por este arquivo.

## 1. Retorno da TI incorporado

Fonte entregue por Alyson e lida inteira: **`relatorio-ti-flow-etapa-a-pr37-p28-2026-11-01.md`**, 158 linhas. O relatório registra autorização de Alyson **somente para A** e execução em 01/11. Não é nova autorização para B, C ou D.

| Item                | Resultado relatado pela TI                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Linha de base       | 22:24:29 UTC / **19:24:29 Brasília**                                                                                                               |
| Rodada 1            | 22:27:27–22:27:58 UTC; **85/1/0**, saída **1**, 567 asserções                                                                                      |
| Rodada 2            | 22:28:55–22:29:15 UTC; **85/1/0**, saída **1**, 559 asserções                                                                                      |
| PostgreSQL          | **22/22 aprovados em ambas**, versão fictícia **15.19**                                                                                            |
| Bun                 | **1.4.2**, imagem/digest fixados no roteiro                                                                                                        |
| Código              | Commit integrado `13f1dc9bc50d3ac15f62944d832a02cd66ef3a2a`, árvore `ef708d8e4fd6cd24afc79d568f6d5682615982a7`                                     |
| Isolamento          | PostgreSQL `--network none`, nenhuma porta publicada; runner no namespace do PostgreSQL fictício; fonte/entrada somente leitura, sem Docker socket |
| Limpeza             | Dois PostgreSQL fictícios e seus volumes removidos, runners removidos, senhas/URLs descartadas                                                     |
| Serviços existentes | TI relata os mesmos **36 IDs**, sem mudança de início/status; Flow DB/funções saudáveis                                                            |

Na primeira rodada falhou **“3.1 caminho válido: código 0 e ensaio aprovado”**; na segunda, **“3.1 leituras ausentes (cliente divergente) e interrompidas: código 2”**. Ambas chegaram ao mesmo `ErroFerramenta: servidor: porta_ocupada` em `bancada/bancada.ts:91`. O segundo ensaio passou no caso que havia falhado no primeiro; isso não atende ao critério de uma execução integral limpa.

Fonte final: **`/root/flow-pr37-20261101T222727Z/`**. Logs privados `priv/testes.log` e `priv-retry1/testes.log`, modo 0600; diretórios 0700, `src` sem escrita. Tar SHA-256 relatado: `6d1600bd3b1b21bb267cc5ccf732f16e15e6b009fb08b20b1a6326e060aef2d5`. TI usou a API GitHub autorizada e conferiu cada blob, porque `gh` não estava autenticado em sua máquina; só as ferramentas foram transportadas. Não pedir login/clone novo para desfazer esse transporte já válido.

Bun e fontes ficaram preservados, sem processo de ensaio ativo. Não reinstalar #36, repetir diagnóstico, criar outro cliente Google ou refazer os quatro ajustes do #37.

## 2. Conferências próprias do Codex

Realizadas nesta rodada, separadas do relato da TI:

- **SSH somente leitura:** os dois logs confirmam as falhas e casos acima. Os **19 blobs** de `src/ferramentas/p28-drive/` na VPS são idênticos aos arquivos revisados no head `67e7fb7`, de árvore idêntica ao commit integrado. Consulta Docker por label não encontrou containers de ensaio restantes.
- **Intervalo efêmero medido no host da VPS:** `/proc/sys/net/ipv4/ip_local_port_range` = **32768–60999**. Parte dele coincide com o sorteio dos testes; nenhuma configuração foi alterada. O namespace fictício já havia sido removido, portanto seu intervalo específico não foi medido nesta consulta.
- **Fonte conferida:** `teste/bancada.test.ts:35` usa `20000 + Math.floor(Math.random() * 20000)`, sem consultar/reservar a porta. `montar()` aplica essa porta ao formulário/configuração; `fluxo()` espera `pronto`, mas só observa o resultado de `comandoIniciar()` depois de `pronto` e dos pedidos HTTP. Há outra espera semelhante no teste de sessão/Host/método.
- **Reprodução controlada local:** ocupante HTTP real em loopback, resultado do sorteio controlado para apontar a ele, configuração e identidades fictícias. A seleção original escolheu a porta ocupada; `comandoIniciar` recusou com `porta_ocupada`, **zero chamadas ao provedor**, nenhum link emitido e sinal de prontidão sem resolução. Servidor e dados descartáveis removidos ao fim. Apoio: `/tmp/barba-p28-a-colisao.ts`, Bun 1.4.2.

**Precisão do diagnóstico:** o relatório menciona bind de `8765`, mas os testes não estão fixos nessa porta; sorteiam **20000–39999**. Os logs não registram o número da porta conflitante nem quem a ocupava. Colisão com conexões efêmeras ou outro sorteio é compatível com o código e a faixa medida, **não causa específica comprovada das duas corridas**. A escolha sem reserva e o tratamento incompleto da falha de inicialização são problemas confirmados. Não culpar o PostgreSQL 15.19 ou mudar o isolamento para encobri-los.

Não houve nova suíte na VPS pelo Codex nem instalação/alteração remota nesta conferência. Os 86 testes e quatro regressões aprovados anteriormente em PostgreSQL 15.8 continuam evidência daquela versão/ambiente, sem transformar as duas corridas atuais em aprovação.

## 3. Correção solicitada ao Claude/Flow

Trabalhar em **`Proh2026Media/flow-proh-media`**, na main integrada mais recente, conforme `AGENTS.md`: vez, branch `ia/*`, PR próprio inicialmente em rascunho, notas/`PROGRESSO.md`, Bun e testes. **O #37 já está integrado; não reabrir ou empilhar mudanças sem conferir a main atual.** Não editar simultaneamente com outra ferramenta. Não há necessidade de novo relatório geral ou de implementar outra bancada.

### Portas e ciclo de vida do apoio de testes

1. Substituir a escolha cega por um mecanismo de alocação de porta que trate ocupação real e concorrência. Preferir alocação pelo sistema operacional com propriedade/reserva até o uso. Se o desenho exigir fechar um listener antes de outro assumir a porta, tratar explicitamente essa janela; um simples “consultar porta livre, fechar e usar” ainda tem disputa.
2. Se optar por tentativas limitadas no apoio, restringi-las **somente** a `EADDRINUSE` antes de qualquer link, requisição, candidato ou efeito do caso. Não repetir o teste inteiro, erros de regra, timeout, asserções ou resultados parciais. Registrar/limitar o motivo para não converter falha em aprovação silenciosa.
3. Observar a rejeição de `comandoIniciar()` imediatamente enquanto se espera a prontidão. Se não conseguir iniciar, devolver o erro original sem rejeição solta, espera pendurada ou consumir o prazo inteiro do teste. Resolver os dois pontos de espera e encerrar recursos em caminhos de sucesso e erro.
4. Cobrir todos os testes que abrem listener, inclusive o ocupante intencional. Cada fixture deve possuir/encerrar seus recursos; não fechar servidores de outro caso ou procurar e matar processos por porta.

### Preservar o comportamento real e as guardas

A bancada real deve continuar exigindo loopback, porta/URI coerentes, Host exato, credencial/conta/escopo esperados, state/cookie e escrita privada. **Uma porta configurada realmente ocupada deve continuar recusada**; não mudar automaticamente sua porta ou o redirect real. Não aceitar porta 0 na configuração real, afrouxar o validador, trocar para `0.0.0.0`/rede host, mudar a faixa efêmera do servidor ou remover testes de erro para obter resultado verde.

Manter as quatro correções do #37, as guardas do restaurador fictício e os 22 testes PostgreSQL. A mudança deve se concentrar no apoio dos testes; qualquer alteração compartilhada necessária precisa estar explicada e protegida por regressão. Não alterar interface, `supabase/functions`, migrations, conexão/segredos, cron ou Google.

### Evidência pedida no PR

- Regressão determinística para a colisão no preparo: ocupante controlado, nenhum provedor chamado, erro propagado e recursos liberados; quando houver realocação restrita ao apoio, provar que a tentativa ocupada não realizou efeitos.
- Regressão para a rejeição antes do sinal de prontidão, sem erro assíncrono solto/espera pendurada. Manter a recusa de porta ocupada na bancada real.
- Suíte completa aprovada em PostgreSQL 15 fictício: **86 casos existentes + novos**, zero falhas e zero pulados, incluindo os **22 PostgreSQL**. Informar versão e comando; sem conexão real. Aumentar o total pelos casos novos é esperado.
- Conferência em Linux/Bun 1.4.2 com o mesmo modelo de isolamento da TI. Rodadas repetidas podem demonstrar estabilidade, mas todas devem ser relatadas, inclusive falhas; não filtrar até uma verde.
- Commit, arquivos alterados, testes e limites; sem segredos. Lint/tipos pertinentes ao que mudou, distinguindo problemas anteriores se houver.

## 4. Reensaio da TI após correção revisada

**Não rodar uma terceira tentativa do mesmo código agora.** Depois do PR corretivo revisado e da decisão do dono, fixar o novo commit/manifesto e repetir somente a etapa A conforme [roteiro existente](2026-11-01-ti-flow-pr37-runtime-ensaio-conferido-p28.md), com o mesmo isolamento. Fonte antiga/logs ficam preservados para comparação; não sobrescrevê-los. Se Bun/digest já estão disponíveis e corretos, não reinstalar no host nem refazer inventários de Google/produção.

O critério é uma execução integral com todos os casos aprovados, saída zero, nenhum pulado e bloco PostgreSQL completo; depois comprovar limpeza dos containers/volumes próprios e preservação dos serviços existentes. Retornar apenas versão/manifesto, contagens, logs privados, isolamento, limpeza e diferenças. Não avançar por “PG passou” ou pela união das duas corridas falhas.

## 5. Estado e próxima ação

| Parte                         | Estado                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| Merge #37 e quatro ajustes    | **Atendidos**, não repetir                                                                       |
| Runtime/isolamento da etapa A | **Executados** pela TI; fontes e Bun preservados                                                 |
| Aprovação integral da etapa A | **Pendente**, duas corridas 85/1/0; correção do apoio de portas/prontidão e reensaio necessários |
| B — captura protegida         | Não executada; decisão própria após A                                                            |
| C — Google/ensaio real        | Não executado; operador/IDs privados/custódia/Google/transporte do callback pendentes            |
| D — virada                    | Não executada; procedimento/barreira de escritores/aceitação próprios                            |

**Encaminhar este arquivo ao Claude que desenvolve o Flow.** Não é preciso pedir outro diagnóstico geral à TI. O próximo retorno útil é o PR corretivo e seus testes; Codex revisa antes de novo reensaio da TI. Nenhuma mensagem ou instrução foi enviada a outro agente por ferramenta nesta rodada.

**Validação deste registro no Barba & Cabelo:** tipos, **301 testes**, formatação dos sete documentos e montagem aprovados por `scripts/verificar.sh`; dez links locais novos/do encaminhamento conferidos. Sem alteração de código de aplicação ou execução de correção no Flow. Esses resultados não encerram a etapa A: a falha da suíte Flow continua pendente.
