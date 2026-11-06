# P-28 — Para Claude/Flow: fechar três pendências do #43

**06/11/2026 · Desenvolvimento e testes fictícios.** Arquivo para **Claude, que desenvolve o Flow**, dependência Google da P-28 do Barba & Cabelo. [Revisão e evidências](2026-11-06-flow-revisao-pr43-p28.md).

Relatório `relatorio-claude-flow-ajustes-pr42-p28-2026-11-05.md` lido inteiro. O [#43 já foi integrado](https://github.com/Proh2026Media/flow-proh-media/pull/43) em **05/11 às 13:42:16 Brasília**: head `129e63ea2627716cba0d5f0dc1b48a8ff6fbe298`, merge `ff4471debf671f42a42fa55896a26c900e868e9b`, mesmo conteúdo. Trabalhar da main atual, com a vez/AGENTS do Flow, em **novo ramo e PR em rascunho**; não pedir outro merge do #43.

## Preservar o que passou

Codex reproduziu **154/0/0** ferramentas, Linux/amd64, Bun 1.4.2 e PG 15.8 fictício; **128/128 Vitest**; tipos do aplicativo e lint, saídas 0. Nove independentes deram **5 passaram / 4 falharam**, correspondendo aos **três pontos abaixo**.

Passaram: upload novo persistido/continuação com ticket; falha marcada depois de fechar bloqueia; retorno recusa divergência e preserva a mudança; retorno normal funciona; resposta perdida após COMMIT com barreira reaberta informa `barreira_perdida` e par promovido. **Preservar essas correções.** As pendências são da reclassificação e transição, sem refazer os quatro itens anteriores do zero.

## F1. Incerteza anterior exige reconciliação comprovada

No #43, fechar converte `incerto` em `incerto_anterior`, ignorado pela drenagem e condição operacional. Linha preservada/contagem no recibo não comprovam o efeito externo.

**Dois negativos reproduzidos com classe/módulo reais e PG:**

1. `comBarreira` retorna **502** antes do fechamento, modelando resposta externa perdida/efeito desconhecido. `incertas=1`. Fechar/drenar, carência cumprida, emite prova com `incertas=0`, `incertas_anteriores=1`, sem reconciliar.
2. `worker.admitir` → fechar → `worker.encerrar(admissao, true)`. Drenar recusa. `abrirBarreira` → fechar novamente → drenar passa sem investigação. A geração nova contorna a recusa anterior.

**Exigido:** ambos seguem impedindo prova/aplicação enquanto o efeito não for comprovadamente encerrado/sem efeito. Tratar inclusive `incerto_anterior` existente. Mesma regra na drenagem, dentro do LOCK e na reconciliação do COMMIT. Idade, abrir/fechar ou flag de ignorar não substituem prova.

Classificar falha comprovadamente sem efeito só com evidência apropriada; acrescentar controle positivo de reconciliação válida, além dos dois negativos. O atual B2 precisa refletir esse contrato, não validar liberação automática pela anterioridade.

## F2. Tornar a transição do legado demonstrável

`drive_instalacao` marca uma chamada nova, não o último início antigo/término de uploads. O hook usa PUT único, mas não configura `xhr.timeout`, nem cancela sessão ao instalar/fechar.

**Reprodução:** hook real com apenas importações React/Supabase substituídas, XHR simulado. Init responde como #36, sem ticket; PUT fica pendente, sem finish. Gravar marco, fechar e chamar `drenar` com `carenciaH:24`, relógio marco +25 h. Atual: **prova emitida**, PUT pendente, timeout 0. Tempo simulado, sem Google real/espera de 25 h.

O padrão XHR não fornece esse limite automático com timeout zero. Drive documenta sessão por uma semana; são condições distintas, sem garantia de 24 h. [Padrão XHR](https://xhr.spec.whatwg.org/#the-timeout-attribute), [upload Drive](https://developers.google.com/workspace/drive/api/guides/manage-uploads).

**Exigido:** definir/testar corte efetivo de novos inícios antigos, convivência de instâncias/abas e prova de término/reconciliação dos uploads anteriores sem registro. Pendência desconhecida mantém recusa com motivo preciso. Trocar 24 h por outro prazo, ou acrescentar timeout só ao hook novo, não encerra sessões/abas antigas nem comprova estado remoto.

Entregar proposta operacional executável com premissas verificáveis. Dependências de decisão/alteração real ficam separadas da implementação fictícia. A carência sugerida **não foi escolhida** como substituta da prova.

## F3. Cobrir aba antiga com função nova e barreira fechada

Aba antiga ignora o ticket do init novo; finish manda `drive_file_id`, sem ticket. `resolverFinish` aceita ticket das appProperties com barreira aberta, mas a continuação do roteador só lê `corpo.ticket` e recusa antes do handler.

**Reprodução, funções reais e PG:**

1. Registrar upload pendente do mesmo dono, como init novo.
2. `resolverFinish(deps, undefined, ticketDoArquivo, dono)` retorna `tipo: ticket` em estado aberto.
3. Fechar e chamar `comBarreira` com continuação equivalente ao roteador: `continuacaoAutorizada(deps, undefined, dono)`.
4. Atual: **503**, handler não executado, `uploads_pendentes=1`. Controle com ticket no corpo passa em 200 e conclui.

É bloqueio de continuidade, **não falso zero**. Compatibilidade hook novo/#36 não demonstra combinação inversa. Corrigir continuação autorizada ou entregar transição verificável que resolva essa combinação antes da manutenção. Preservar dono/permissões e recusa de ticket trocado/usuário diferente, sem finish arbitrário ou consulta Google irrestrita para furar barreira.

**Cobrir:** função antiga + hook novo; função nova + aba antiga; novo + novo. Incluir init em voo na troca, finish com barreira aberta/fechada, erro/abandono e retomada da janela. Testar a fronteira efetiva do roteador com dependências simuladas/handler fictício, além de inspeção estática.

## Entrega e limites

- Novo PR/head/manifesto e relatório por F1/F2/F3. Negativos devem reprovar o #43; positivos preservam o atendido. PG fictício para concorrência/transação, Google simulado. Distinguir código executado, modelo e revisão estática.
- Manter `exigirAlvoFicticio`, `restaurar-ficticio` e guardas de instaladores/migrations. O AGENTS do Flow limita instaladores à stack de teste; comandos reais continuam fora desta correção, sem bypass.
- Leitura Codex **06/11 às 10:46:39 Brasília**: função viva ainda #36, `barreira.ts` ausente; banco/funções healthy com mesmos IDs/inícios. Não é preciso outro inventário TI para corrigir. Merge não autoriza instalação.
- Não executar VPS/Google/cron/Coolify, nova manutenção, cancelamento real, D ou revogação do cliente antigo. A/B/T1, Picker dos 15, candidato/evidências v2 atendidos/sob custódia; sem novo consentimento/renovação/pedido de segredos.
- Após revisão, preparar procedimentos concretos de instalação/ativação e D para decisão própria do dono. Destinatário agora: **Claude/desenvolvimento**, não TI/execução.
