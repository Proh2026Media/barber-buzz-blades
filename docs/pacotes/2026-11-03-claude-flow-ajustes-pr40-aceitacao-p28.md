# P-28 — Para Claude/Flow: ajuste do #40 e aceitação fora do handler

**Atendido em 03/11:** #41 integrado pelo dono em `d3f1c90` às 12:03:36 Brasília e [conferido pelo Codex, 136/0/0 + 8/0](2026-11-03-flow-pr41-confirmacoes-d-v2-conferidos-p28.md). Falha temporal corrigida e aceitação externa atendida. Não pedir outro PR/merge para esses pontos. [Próximo: TI/Guardião, ensaio dos 15 para decisão](2026-11-03-ti-flow-ensaio-acervo-15-p28.md). Pedido original abaixo, sem execução real de D.

**03/11/2026 · Novo PR, desenvolvimento/testes exclusivamente fictícios.** [Revisão consolidada](2026-11-03-flow-pr40-arvore-proposta-d-conferidos-p28.md). #40 já integrado pelo dono, main/espelho `321870b93e4b78ccac517be4cbf111c2cc5af770`, ferramentas `913bd2bf126580f9e0a683d679e44c4d972aa97f`. Não pedir outro merge do #40. Leia AGENTS vigente do Flow, use ramo `ia/*` e a vez; devolver PR em rascunho. Sem main, VPS, Google/cofre, candidato real ou produção.

## 1. Ajuste necessário, reproduzido independentemente

A suíte própria passou **125/0/0**, Bun 1.4.2 Linux/amd64 e PostgreSQL 15.8 fictício. Cinco controles independentes deram **4/1**. A falha está em `promocao.ts`, `renovacoesAprovadas`: `horarios` deduplica texto, enquanto os limites temporais usam o instante de `Date.parse`.

Reprodução mínima com os apoios atuais e Google simulado:

1. `bancadaAprovada({renovacoesHoras:[1.5]})`: uma só renovação após vencimento.
2. Copiar o JSON dessa evidência para outro nome aceito por `RE_EVIDENCIA_RENOVACAO`.
3. No JSON copiado, mudar apenas `horario` de `…Z` para `…+00:00`. Confirmar `Date.parse` idêntico.
4. `comporPromocao(carregarEntradasPromocao(...))` aceita **duas** renovações, ambas posteriores. Esperado: `renovacoes_insuficientes` (uma observação válida distinta).

Validar o formato temporal conforme o escritor real e deduplicar **o instante normalizado**, com `ultima_em` coerente/canônica. Preservar a exigência de duas observações efetivamente distintas, pelo menos uma após vencimento. Não afrouxar para v1 nem alterar candidato/evidência existente para fazê-los passar.

Adicionar regressões: duplicata literal, representação equivalente do mesmo instante, horário inválido/futuro e controles positivos de duas renovações distintas, inclusive **ambas depois do vencimento**. A duplicação foi feita só em fixture, não há alegação de duplicação real pela TI. `libera_d:false` e ausência de escrita em produção continuam obrigatórios.

## 2. Próxima peça delimitada: aceitação externa somente de leitura

A TI propôs parar o runtime Flow como barreira e usar `diagnostico` antes de reabrir. O diagnóstico roda nesse runtime; ligá-lo reabre escritores. Preparar uma ferramenta de conferência **fora do handler**, com funções puras/Google simulado nos testes, sem adicionar rota ou modo de escrita em produção.

O contrato a implementar/documentar:

- Receber por **arquivos privados** a imagem imediatamente anterior fresca, a captura pós-COMMIT das duas integrações e os dados privados de referência necessários da bancada/aprovação revisada. Não imprimir valores, e-mail, IDs, tokens ou hashes secretos, nem aceitar credenciais em argumentos de processo.
- Validar formato/origem/duas linhas; recompor em memória o par esperado a partir da imagem anterior fresca e conferir **o par que veio da captura pós-COMMIT**, cliente/refresh/IDs e campos preservados conforme o contrato de promoção/varredura. Não confundir candidato separado aprovado com prova de que o banco contém o par correto. A captura será feita pela ferramenta já existente, somente em uma D futura autorizada; nesta entrega tudo é fictício.
- Usar **a credencial e o refresh desse par capturado** para obter access token somente em memória. Conferir emissor, conta esperada e escopo exato `drive.file`; então GET de metadados dos IDs do manifesto. Reutilizar a porteira de destinos/métodos atual. Sem qualquer criação, upload, download de conteúdo, compartilhamento, revogação, callback, `status`, `configure` ou escrita de conexão.
- Saída pública somente booleanos, estados, contagens e código de saída inequívoco. Sem registrar o corpo do provedor. Não persistir access token nem modificar candidato/manifesto/evidências anteriores; eventual resumo privado novo precisa de caminho exclusivo e modos já estabelecidos.
- Divergência de par/conta/cliente/escopo/ID, erro de rede e 403/404 devem reprovar a conferência. Não reduzir o conjunto automaticamente para o que funcionou. Não executar `ensureRootFolders` nem resolver um 404 criando pastas.
- Declarar o limite: é aceitação externa de credencial/par/metadados, **não prova da execução do handler vivo, de arquivos futuros ou de leitura de conteúdo**. Cache frio por parada/início, fonte efetiva e código instalado pertencem à operação TI. Diagnóstico do handler após reabertura será acompanhamento posterior, não motivo para reabrir antes da aceitação externa.

Nome/CLI são decisão de implementação; devolver os comandos que de fato existirem. As duas capturas pertencem à futura operação D, não à bancada de consentimento: não montar B histórica ou imagem com segredo antigo no runner OAuth. Provar nos testes que valores do cliente/token antigos nunca são enviados ao Google. Nenhum comando de escrita em banco real, bypass/force ou alteração de guarda de `restaurar-ficticio` nesta entrega. L1 (escrita real) continua em etapa própria; o pacote anterior deliberadamente não a pediu.

## 3. Testes e devolutiva

- Reproduzir a falha temporal, corrigir e mostrar a regressão passando com o controle das duas renovações reais simuladas distinto. Suíte existente/guards e checks do Flow.
- Aceitação: par pós-COMMIT correto passa; candidato correto com par capturado errado **não passa**; conta/cliente/escopo errados, 403/404 e falha de rede reprovam. Observar chamadas permitidas e provar zero escrita/persistência de token, zero vazamento público e preservação dos arquivos de entrada.
- Reusar PostgreSQL fictício onde houver captura/transação; sem ligar stack de teste parada ou usar conexão real. Informar plataforma/versões e testes realmente executados.
- PR/head/manifesto, fonte e políticas, comandos reais, resultados/limites e proposta de integração com a barreira TI. Não integrar main nem executar a nova ferramenta sobre artefatos reais.

A TI relata nove pastas e seis arquivos, mas falta ligar a observação à conta e aos três IDs originais. Estamos preparando um futuro ensaio **novo**, possivelmente com os 15 itens explícitos, e as duas evidências v2 desse novo candidato. Não pedir duas renovações v2 agora do manifesto antigo só para depois repetir tudo; não consentir ou tocar Google nesta entrega. Codex conciliará os retornos e montará o próximo passo para decisão, sem liberar D por este arquivo.
