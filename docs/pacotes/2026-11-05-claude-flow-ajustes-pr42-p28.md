# P-28 — Para Claude/Flow: quatro correções do #42 em novo PR

> **Atualização de 06/11:** pedido respondido pelo #43, já integrado. [Revisão atual: correções atendidas e três pendências](2026-11-06-flow-revisao-pr43-p28.md); [próximo arquivo Claude: F1/F2/F3](2026-11-06-claude-flow-ajustes-pr43-p28.md). O conteúdo abaixo permanece como histórico, sem repetir os quatro pedidos do zero.

**05/11/2026 · Revisão com reproduções fictícias; sem instalação ou D.** [Resultado consolidado](2026-11-05-flow-revisao-pr42-p28.md). O dono já integrou #42 às **12:41:20 Brasília**, merge `3c77d329667adc13ed01767598307545af579d37`, mesmo conteúdo do head `8c7edbc`. Não pedir outro merge do #42. Trabalhar em **novo ramo/PR em rascunho**, com a vez e AGENTS vigentes do Flow; sem main direta.

Suítes próprias passaram: ferramentas **145/0/0**, Linux/amd64 Bun 1.4.2 e PostgreSQL 15.8 fictício; app/função Vitest **122/122**. Cinco controles independentes finais deram **1/4**, com controle de retorno normal passando e quatro falhas abaixo. Fonte preservada. Corrigir essas lacunas antes de homologar barreira/virada.

## A. Cobrir o ciclo inteiro do upload retomável

Hoje o contador termina em `upload-init`, mas `src/hooks/use-drive-upload.ts` envia por PUT direto à sessão Google e chama `upload-finish` depois. A barreira pode fechar/drenar enquanto esse envio externo está ativo e recusar a finalização com 503. O relatório reconheceu isso; aviso de janela não cumpre a prova de drenagem pedida.

Implementar acompanhamento persistente do ciclo, vinculado a usuário/operação autorizados: novos inícios são barrados; continuações já admitidas podem terminar de modo controlado; o registro só sai após coerência Drive/banco ou cancelamento/reconciliação **comprovados**. Prazo, abandono, reinício ou perda de resposta não significam upload concluído. URLs de sessão são privadas, não devem aparecer em logs/recibos públicos.

Tratar a transição da versão antiga: sessões abertas antes da instalação não passam a estar contabilizadas só porque a nova tabela/linha começa vazia. Propor/ensaiar a compatibilidade de frontend/função e a identificação de pendências legadas, sem novo consentimento, revogação automática ou exclusão de arquivos. Se ajustar o hook, preservar comportamento/permissões e compatibilidade com a versão da função ainda instalada; frontend pode ser publicado separadamente. Não introduzir alteração visual alheia à tarefa.

**Regressões exigidas:** init → transferência externa simulada ainda pendente → fechar/drenar não emite prova; finish autorizado conclui → zero comprovado. Também abandono/erro, worker reiniciado, continuação de outro usuário recusada, início novo recusado e versão legada. Integrar o teste ao ciclo real com dependências simuladas; o modelo independente reproduziu o intervalo, sem chamar o handler/Google reais.

## B. Eliminar a corrida da limpeza de falha

`Barreira.encerrar` lê aberta e depois apaga. Reprodução determinística com classe real + PG:

1. Ação de escrita retorna 502; `encerrar` lê aberta.
2. Pausar antes do DELETE do registro (latência simulada).
3. `fecharBarreira` fecha; há **uma atividade ativa**.
4. Liberar DELETE; `drenar` encontra zero, **incertas=0** e emite prova.

Preservar efeitos potencialmente incertos de modo que essa intercalação não os apague. Acrescentar outra leitura de estado antes do DELETE ainda deixa uma janela. Classificar falhas comprovadamente sem efeito quando apropriado; não eliminar incertezas por prazo, aviso ou simples decisão de zerar contadores. O mecanismo deve manter a segurança com múltiplos workers e durante a mudança de geração.

Teste a intercalação acima sobre a implementação efetiva, além do caso já coberto de falha depois de a barreira estar fechada. Uma chamada aguardando o Google continua atividade relevante mesmo sem SQL ativo.

## C. Retorno precisa do posterior conhecido como estado esperado

`cmdRetornar` lê `--posterior`, mas passa `pre.conteudo` recém-capturado como esperado a `aplicarComBarreira`. Assim, uma mudança inesperada entre promoção e retorno vira estado legitimado e é sobrescrita.

Reprodução com comandos reais/fictícios: fechar/drenar → promover → alterar um campo desconhecido em `google_drive` → `retornar-ficticio` com as duas capturas originais. Atual: **0 / retornado**, alteração apagada. Esperado: recusa por divergência, preservando a alteração e a barreira.

Usar o par posterior conhecido como esperado; conferir dentro do LOCK e manter a política estrita de referências/varredura. A nova captura pré-retorno continua sendo custódia/diagnóstico, **não substitui o esperado**. Validar que as imagens pertencem ao fluxo correto. Sem force, sem reescrever referências, entidades ou histórico. Exercitar divergência de credencial, ID e campo desconhecido, com controle positivo do retorno normal e varredura permitida.

## D. Reconciliação também deve validar a barreira

`aplicarComBarreira` captura erro, relê o par e pode devolver sucesso sem conferir estado/geração/atividade. Reprodução com a CLI: no gancho `aposCommit`, executar **`abrirBarreira` real do módulo** e lançar erro para simular resposta perdida. Atual: **0 / aplicado_reconciliado**, barreira aberta e geração diferente.

Reconciliar sob uma observação coerente do par **e** da condição operacional: mesma geração fechada, sem atividade/incerteza. Barreira perdida/aberta/trocada ou atividade nova não podem gerar sucesso seguro. Informar que o par pode ter sido gravado e parar com resultado inequívoco; não reaplicar nem retornar automaticamente. Não confundir “par promovido” com “operação segura para continuar”.

Testar erro antes/depois do COMMIT com barreira válida (comportamento positivo anterior), reabertura, troca de geração e atividade/incerteza surgida na reconciliação. Provar que não há dupla aplicação e que nenhuma divergência é escondida como não aplicada.

## Entrega e limites

- Novo PR/head/manifesto, descrição reescrita pelo resultado final, testes novos negativos/positivos e checks pertinentes. Separar protocolo modelado de código efetivamente executado; testes PG para transação/concorrência, Google sempre simulado.
- Reutilizar composição/aceitação #40/#41, sem refazer A/B/T1, Picker dos 15 ou pedir candidato/B/segredos reais. Manter `exigirAlvoFicticio`, `restaurar-ficticio`, instaladores/migrations e regras do AGENTS; comandos reais continuam fora da entrega.
- Não acessar/alterar VPS, Google, cron, Coolify ou produção. Codex conferiu por leitura que os arquivos vivos ainda são #36 e `barreira.ts` está ausente; não é necessário outro inventário TI para decidir a correção.
- Não instalar #42 nem a correção por causa do merge/relatório. Depois da revisão, o procedimento de instalação/ativação/janela é etapa concreta própria para decisão de Alyson. D segue não autorizada e não executada.
