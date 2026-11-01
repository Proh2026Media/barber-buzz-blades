# P-28 — Revisão do PR #37: quatro ajustes antes do ensaio real

**Ajustes atendidos no retorno:** head `67e7fb7`, mesmo PR #37, com **86 testes e quatro regressões independentes aprovados**. [Conferência das correções e próximos passos](2026-11-01-flow-pr37-ajustes-conferidos-p28.md). As quatro observações abaixo preservam o resultado do head `90135bb`; não solicitar a mesma correção outra vez. Merge e execução real continuam decisões próprias.

**01/11/2026 · Para Claude/Flow, via Alyson.** Resultado da revisão do commit **`90135bb4072f4b443ddf02cfd62582ab96a1e170`**: **72/72 testes da entrega aprovados**, mas quatro casos adicionais reproduziram falhas. Corrigir e adicionar regressões **no mesmo PR #37** antes de avançar para uso com credenciais reais. Sem merge, publicação, restauração de produção ou novo consentimento autorizado por este documento.

## 1. Fontes e estado conferidos

Os dois anexos entregues por Alyson são **idênticos**, não revisões diferentes:

- `relatorio-claude-flow-bancada-p28-2026-11-01.md`;
- `relatorio-claude-flow-bancada-p28-2026-11-01 1.md`.

Cada um tem 328 linhas e 21.137 bytes; SHA-256 comum **`1a0ecdb963f929766b8319a4892466918d17ec945704634e997f1ae779432493`**. Conteúdo integral lido; instruções dos anexos confrontadas com o código, sem tratá-las como autorização adicional.

GitHub confirmou [PR #37](https://github.com/Proh2026Media/flow-proh-media/pull/37) aberto/em rascunho, não integrado; head `90135bb4072f4b443ddf02cfd62582ab96a1e170`, base `926298529da2b0e565599eb3e1f86d834e514be1`, 21 arquivos no diff. Vinte arquivos de ferramentas/package foram obtidos pela referência fixa e conferidos contra seus blobs; `PROGRESSO.md` é o registro adicional. Função instalada #36, interface, migrations e guardas existentes não mudam neste diff.

## 2. Verificação independente

- Cópia temporária fora dos repositórios; sem instalação de dependências. **Bun 1.4.2**, PostgreSQL **15.8** em container Docker exclusivo, porta aleatória publicada somente em `127.0.0.1`, inicialização vazia e dados fictícios. Nenhum banco da VPS acessado.
- **72 testes aprovados, zero falhas, 438 asserções**, incluindo os 20 de PostgreSQL. As ferramentas exercitam COMMIT/ROLLBACK, bloqueio real, referências, arquivos e OAuth simulado. Os 106 testes completos do Flow, tipos/lint e 15 rodadas descritos pelo Claude não foram repetidos integralmente pelo Codex.
- Quatro reproduções independentes adicionais, com rede externa bloqueada no código de teste. Os casos abaixo foram observados, não apenas inferidos da leitura.
- Container exclusivo removido após o ensaio; arquivo temporário de acesso descartado. Não utilizado o helper de remoção com nome fixo, para preservar qualquer container de outra sessão.
- Houve separadamente consulta de fonte oficial e duas sondagens HTTP de protocolo ao `tokeninfo` com **marcador fictício sem valor de credencial**. POST no corpo e no cabeçalho responderam 400/`invalid_token`. Nenhuma troca/renovação de token válido, autorização ou leitura de Drive real. Isso verifica recepção do método, não a compatibilidade completa com um token válido.

Artefatos locais desta revisão: `/tmp/barba-p28-pr37.Qolh1G`, reprodução `revisao-codex.ts`, logs `/tmp/barba-p28-pr37-testes-exatos.log` e `/tmp/barba-p28-pr37-regressoes.log`. São apoios temporários, sem credenciais reais; os gatilhos e critérios estão descritos abaixo para inclusão no próprio conjunto do Flow.

## 3. Ajustes solicitados

Prioridade **média (P2)** nos quatro casos. Apesar dos testes aprovados, não considerar a bancada pronta para credenciais reais enquanto essas condições permanecerem.

### 3.1 Renovação com escopo errado termina com código de sucesso

Fonte: [bancada.ts, linha 137](https://github.com/Proh2026Media/flow-proh-media/blob/90135bb4072f4b443ddf02cfd62582ab96a1e170/ferramentas/p28-drive/bancada/bancada.ts#L137) e [ensaio.ts, linhas 172–179](https://github.com/Proh2026Media/flow-proh-media/blob/90135bb4072f4b443ddf02cfd62582ab96a1e170/ferramentas/p28-drive/bancada/ensaio.ts#L172).

**Gatilho:** `renovar` obtém access token e o tokeninfo confirma o cliente novo, mas informa `drive.file openid`. O mesmo problema existe para escopo insuficiente quando o cliente confere.

**Observado:** o resultado traz `renovado: true`, `cliente_novo_confere: true`, `escopo: escopo_a_mais` e nenhuma `leituras`; a CLI retorna **0**. A condição `!r.publico.leituras?.interrompido` aceita `undefined`, sem conferir o escopo. Um procedimento que usa o código de saída interpreta a etapa recusada como sucesso.

**Correção:** sucesso exige escopo `ok` e resultado de leituras presente e concluído, além do cliente/renovação válidos. Preservar a distinção entre renovar o token e aprovar o ensaio. Incluir testes da **CLI**, para escopo adicional, insuficiente, leituras ausentes e caminho válido. Resultados recusados precisam retornar código não zero, sem ampliar escopos ou iniciar leituras indevidas.

### 3.2 Decimal JSONB pode mudar, com cópia aprovada e pós-COMMIT “confere”

Fonte: [banco.ts, linha 98](https://github.com/Proh2026Media/flow-proh-media/blob/90135bb4072f4b443ddf02cfd62582ab96a1e170/ferramentas/p28-drive/banco.ts#L98), [comum.ts, linhas 132–135](https://github.com/Proh2026Media/flow-proh-media/blob/90135bb4072f4b443ddf02cfd62582ab96a1e170/ferramentas/p28-drive/comum.ts#L132) e [artefato.ts, linha 248](https://github.com/Proh2026Media/flow-proh-media/blob/90135bb4072f4b443ddf02cfd62582ab96a1e170/ferramentas/p28-drive/artefato.ts#L248).

**Gatilho real no PostgreSQL fictício:** inserir diretamente como JSONB um campo desconhecido de `google_drive.dados` com o literal **`9007199254740991.1`**, sem passar antes por objeto/number JavaScript.

**Observado:** `capturar` faz `JSON.parse` e o valor vira **`9007199254740991`**. Esse número arredondado é inteiro seguro, então o validador aceita; a cópia é considerada apta. `restaurarPar` grava o valor alterado e retorna `pos_commit: confere`, porque a comparação já usa o valor convertido. Uma comparação JSONB no banco com o literal original retorna falsa.

**Correção:** preservar a representação numérica sem perda ou recusar a captura **antes de aprovar/promover o arquivo**, verificando a equivalência com o JSONB original. Não basta testar `Number.isSafeInteger` depois do parse; nem converter o literal a Number na preparação do teste. Usar PostgreSQL para provar igualdade do original e restaurado, ou recusa explícita sem cópia final. Cobrir decimais longos, fração perto de `2^53`, expoentes/valores muito pequenos e os inteiros já tratados. O requisito é não produzir backup silenciosamente diferente; a solução pode recusar valores não preserváveis com código seguro.

### 3.3 Falha posterior ao candidato salvo informa que ele não foi guardado

Fonte: [servidor.ts, linhas 84–86](https://github.com/Proh2026Media/flow-proh-media/blob/90135bb4072f4b443ddf02cfd62582ab96a1e170/ferramentas/p28-drive/bancada/servidor.ts#L84) e [109–126](https://github.com/Proh2026Media/flow-proh-media/blob/90135bb4072f4b443ddf02cfd62582ab96a1e170/ferramentas/p28-drive/bancada/servidor.ts#L109).

**Gatilho:** troca/cliente/escopo/conta válidos, `guardarCandidato` concluído, leituras válidas; a gravação da evidência falha depois (simulada como erro de escrita).

**Observado:** `candidato.json` existe, mas `aoConcluir` recebe `situacao: recusado`, **`candidato_guardado: false`**. O tratamento de erro usa a mesma recusa dos caminhos anteriores à gravação, ocultando o estado parcial. A conexão de produção não foi alterada; a divergência é entre arquivo da bancada e relatório.

**Correção:** acompanhar o ponto em que o candidato foi confirmado e informar o estado parcial com `candidato_guardado: true` quando for o caso. A mensagem deve orientar preservar a bancada para conferência, sem apagar o candidato, revogar Google ou refazer o consentimento automaticamente. Testar falha na escrita do próprio candidato (sem arquivo) e falha depois do candidato/evidência, inclusive ausência de dados sensíveis no resultado. O limite de 15 minutos e o encerramento também devem respeitar o estado que já foi persistido.

### 3.4 Link simbólico em ancestral passa pela guarda de arquivo privado

Fonte: [arquivo-privado.ts, linhas 29–64](https://github.com/Proh2026Media/flow-proh-media/blob/90135bb4072f4b443ddf02cfd62582ab96a1e170/ferramentas/p28-drive/arquivo-privado.ts#L29) e [76–116](https://github.com/Proh2026Media/flow-proh-media/blob/90135bb4072f4b443ddf02cfd62582ab96a1e170/ferramentas/p28-drive/arquivo-privado.ts#L76).

**Gatilho fictício:** criar `base/atalho -> base/real`, com `base/real/interno` existente, e usar `base/atalho/interno/operacao` como destino.

**Observado:** `criarDiretorioOperacao`, `gravarPrivado` e `lerPrivado` aceitam e seguem o ancestral. O `lstat` vê o diretório imediato real; `O_NOFOLLOW` protege o último componente do temporário, não os ancestrais. Isso não cumpre a guarda prometida de destino sem redirecionamento por link.

**Correção:** estabelecer base física confiável e conferir componentes abaixo dela, inclusive leitura dos arquivos de entrada, sem depender apenas do `lstat` final. Considerar também a troca de caminho entre conferência e abertura. Manter compatibilidade com bases temporárias físicas do macOS, sem tratar o alias padrão do sistema como permissão para qualquer link criado pelo operador. Acrescentar testes para link no arquivo, diretório imediato e ancestral, além de destino físico válido e preservação dos modos privados.

## 4. Pontos atendidos e limites preservados

A organização fora das funções servíveis, SQL parametrizado, captura consistente, retorno do par em uma transação, trava real de tabela, retenção da varredura e guarda do banco fictício estão exercitados pelo conjunto aprovado. Não pedir reimplementação de #36 ou reabrir o diagnóstico já concluído.

O limite de escritor antigo em voo está documentado e testado pela entrega; a barreira operacional permanece requisito da futura virada. O restaurador continua restrito ao fictício, sem opção de desvio para produção. Não transformar a revisão em autorização para restauração real.

As consultas de conta e tokeninfo para validar a autorização candidata cabem na finalidade da bancada; não há motivo demonstrado para ampliar para `openid email`. A [biblioteca oficial Google usa POST no tokeninfo](https://github.com/googleapis/google-auth-library-nodejs/blob/main/src/auth/oauth2client.ts#L1172); a sondagem com marcador apenas confirmou a recepção do método nas duas formas, sem provar sucesso com credencial válida. O ensaio real e sua autorização continuam próprios.

## 5. Devolutiva solicitada

Atualizar **o PR #37 existente**, conforme as regras do Flow, e devolver relatório com commit e manifesto do delta, regressões adicionadas e resultados próprios dos testes completos das ferramentas e PostgreSQL fictício. Não repetir quinze rodadas se a suíte estiver estável sem nova preocupação; a validação relevante agora são os quatro casos adicionais e suas correções.

Separar ajuste de código, resultado com dados fictícios e pendências operacionais da TI. Sem credenciais nos anexos, comentários/review enviados por ferramenta, merge/deploy, backup secreto, restauração/alteração de produção, URI/consentimento real ou repetição da instalação. A revisão operacional da TI pode continuar, mas nenhum comando deve usar material real antes de rever os ajustes e preparar a etapa concreta para decisão do dono.
