# P-28 — Ensaio dos 15 itens concluído e conferido

**03/11/2026 · Aprovado para o conjunto observado de 15 IDs: nove pastas e seis arquivos.** Seleção completa, GETs e duas renovações v2, uma depois do vencimento. Temporários retirados, serviços preservados. **Não repetir inventário, consentimento, renovações ou A/B/T1. D não autorizada nem executada por esse resultado.** Próximo: [Claude/Flow — barreira e promoção/retorno ensaiados com fictícios](2026-11-03-claude-flow-barreira-promocao-d-p28.md).

## 1. Fonte, autorização e custódia

Relatório `relatorio-ti-flow-ensaio-acervo-15-p28-2026-11-03.md` lido integralmente, **168 linhas**, SHA-256 `625854edb9db7510412498bfec2868c4246b59ea325e8e95aa79d17edf466ba2`. Registra autorização específica de Alyson às **12:18 Brasília / 15:18 UTC de 03/11**, abrangendo nova operação, credencial existente pelo Guardião, um consentimento dos 15 itens, metadados, duas renovações v2 e retirada; exclui D expressamente. Não pedir novamente essa autorização já atendida.

| Item                        | Registro/conferência                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Operação                    | `20261103T152301Z-233f1c84`                                                                                                  |
| Base privada                | `/root/flow-p28-acervo-20261103T152301Z-233f1c84/`                                                                           |
| Fonte privada fora da API   | `/root/flow-pr41-acervo-20261103T152301Z-233f1c84/src`                                                                       |
| Versão                      | #41, merge `d3f1c90e60b678db9d4a6da1d32b3ea7f6babbfa`, ferramentas `1d65e1afc9bd5411f175a71cce087398ca7b919e`                |
| Fonte conferida por leitura | **25/25 blobs esperados** iguais à fonte fixada/revisada                                                                     |
| Custódia conferida          | Base/cred/config/candidato/evid root:root 0700; credencial, configuração, manifesto e candidato root:root 0600, sem symlinks |

Codex conferiu por SSH somente código, metadados, resumos/códigos de saída e uma projeção permitida das duas evidências v2 no servidor. O parser não devolveu conta, IDs, cliente ou hashes privados; a igualdade desses campos foi devolvida só como booleanos. **Não abriu o conteúdo de credencial, configuração, manifesto, candidato ou B**, nem calculou/exportou hash desses arquivos secretos. Nenhuma chamada Google, escrita remota, renovação ou execução do ensaio repetida pelo Codex.

## 2. Resultado corroborado pelos arquivos salvos

Todos os horários abaixo são de **03/11**, em Brasília (UTC−03). Horários precisos vêm do campo `horario` dos resumos, não de uma nova execução.

| Etapa                               | Horário Brasília         | Resultado conferido                                                                                                                                                                             |
| ----------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `conferir`                          | ~12:54, segundo TI       | Exit 0, resultado ok, modo Picker, manifesto 3 principais/0 referências/12 operador                                                                                                             |
| `iniciar-picker` concluído/leituras | **12:57:52.683**         | Exit 0, concluído, seleção completa 15/15, 3 principais + 12 adicionais, zero extras, candidato guardado, conta/cliente/escopo ok, aprovado; 3 principais ok + operador 12 ok, não interrompido |
| Renovação imediata                  | **12:58:48.861**         | Exit 0, renovado/aprovado, modo Picker, vínculo ok, conta/cliente/drive.file ok, todas as 15 leituras ok; antes do vencimento registrado                                                        |
| Vencimento inicial                  | **13:57:47**, segundo TI | Valor do candidato não relido pelo Codex; comparar com a segunda renovação sem atribuir a ele outra hora                                                                                        |
| Renovação posterior                 | **13:57:52.215**         | Exit 0, renovado/aprovado, vínculo e conta ok, 15 leituras ok, `apos_vencimento_registrado:true`                                                                                                |

**Conciliação de horário:** a linha aproximada “~13:00 / UTC+0” do anexo é inconsistente na redação. O resumo de conclusão é **15:57:52.683Z = 12:57:52.683 Brasília**, antes da renovação imediata. Não interpretar “12:57 UTC+0” como horário do evento nem pedir outro ensaio por essa aproximação. A segunda renovação ficou **5,215 s após o vencimento relatado**; o próprio resumo marca posterior ao vencimento.

Duas evidências privadas, ambas 0600/root, verificadas por projeção:

| Arquivo privado de renovação                | Versão/horário    | Leituras                                                                         |
| ------------------------------------------- | ----------------- | -------------------------------------------------------------------------------- |
| `evidencia-20261103T155853Z-renovacao.json` | v2, 15:58:48.861Z | 15/15 estado ok e HTTP 200, grupos 1 raiz + 1 clientes + 1 lixeira + 12 operador |
| `evidencia-20261103T165756Z-renovacao.json` | v2, 16:57:52.215Z | Mesmo conjunto, 15/15 estado ok e HTTP 200                                       |

Operação, cliente, conta e hash declarado do candidato iguais entre as duas; horários canônicos distintos. Isso corrobora a coerência das duas provas **sem abrir/recalcular o candidato real**. O vínculo exato com o candidato/manifesto é prova do produtor revisado/Guardião e aparece `ok` nos resultados; não atribuir a este exame uma releitura secreta. Os nomes dos arquivos refletem o momento de gravação após as consultas e podem diferir alguns segundos do campo `horario`.

## 3. Retirada e preservação

Conferência própria por leitura: zero containers/redes com a operação, cadeias `P28AF_233f1c84`/`P28AI_233f1c84` ausentes, nenhum listener 8765/8766/18080 na VPS e tmux `p28acervo` ausente. **36 containers**. DOCKER-USER contém três DROP eth0 por porta original **8000/6001/6002**, com `conntrack --ctorigdstport`; INPUT conserva política ACCEPT e salto `ts-input`. Não houve nova escrita de regra. A preservação durante a janela é relatada pela TI; esta leitura confirma o estado final, sem inventar um snapshot anterior idêntico por texto.

| Serviço      | Estado próprio conferido                                                          |
| ------------ | --------------------------------------------------------------------------------- |
| DB Flow      | `80c3d9164c07…`, healthy, início `2026-10-23T20:44:50.472960587Z`, RestartCount 0 |
| Funções Flow | `d411e8225ad9…`, healthy, início `2026-11-01T18:32:29.790943603Z`, RestartCount 0 |

B histórica preservada (6.987 bytes/root 0600), candidato C anterior (468 bytes/root 0600) e Picker de três (801 bytes/root 0600), sem ler conteúdos. Base acervo/fonte/candidato/evidências mantidos. Encerramento do túnel/socat/HTTP 8766 e retirada do arquivo de abertura no box são evidências TI, não observação local do Codex. API/URIs existentes e cliente B&C preservados segundo TI; sem consulta Google própria ou revogação.

Sondas iniciais/contadores de isolamento e observação do Picker pertencem à TI. DROP próprio para a faixa fictícia ficou zero e foi complementado pela evidência Docker; não chamar contador zero de prova de bloqueio. Egresso público 443 não é whitelist Google; a ferramenta restringe os destinos/métodos. Nenhuma nova sonda nesta revisão.

## 4. O que está fechado e o que falta

**Ensaio C ampliado concluído no conjunto observado:** conta/IDs já confirmados, seleção dos 15, GET de metadados das nove pastas/seis arquivos, duas renovações v2 e custódia/retirada atendidos. Não comprova recursividade geral, leitura de conteúdo, itens futuros ou escrita de produção. O cliente/conexão vivos continuam anteriores; a nova credencial/candidato permanecem fora da integração viva.

**Próximo trabalho é código/preparação de D:** [pacote Claude](2026-11-03-claude-flow-barreira-promocao-d-p28.md) para controle de admissão/drenagem e mecanismo de promoção/retorno/reconciliação, com dados fictícios e alvo real ainda bloqueado. Reutilizar composição/aceitação #40/#41, sem refazer Picker ou pedir arquivos secretos. A TI não precisa repetir relatório/inventário; depois do PR revisado receberá procedimento operacional específico.

D continua exigindo uma imagem fresca após barreira, par atômico, aceitação externa antes de reabrir escritores, reconciliação de COMMIT desconhecido e retorno comprovado. Não remover guardas de produção dos instaladores/restaurador fictício. Nenhuma janela, parada, cron, Coolify, instalação ou virada está autorizada pelo ensaio; propriedade/marca e verificação final B&C seguem próprias.

## 5. Cópia de trabalho desta revisão

O volume `/Volumes/Alyson 1TB` não estava montado. O relatório em Downloads, acesso HTTPS ao GitHub e SSH de leitura estavam disponíveis. Foi criada **cópia temporária limpa do origin**, feito `pull --ff-only` e obtida a vez normalmente. O fluxo de salvamento continua pelo origin após as verificações exigidas; não é alteração na cópia do volume ausente. Nenhum `.env`/`.vscode/` do workspace original foi lido, copiado ou alterado. Dependências da cópia temporária instaladas com o `bun.lock` congelado, sem mudar lock/dependências.

## 6. Verificação da entrega documental

`scripts/verificar.sh` saída 0 na cópia temporária: tipos, **301 testes B&C**, Prettier dos oito documentos e montagem aprovados. Eslint não aplicável, nenhum TS/TSX alterado. **38 links locais** conferidos e diff sem erro de espaço. Nenhum teste Flow/Google, consentimento ou renovação repetido; conferência remota só de leitura. Formatação dos dois registros reconferida depois de inserir o resultado.
