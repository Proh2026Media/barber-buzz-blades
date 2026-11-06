# P-28 — Para Claude/Flow: três ajustes nos mecanismos do #44

**06/11/2026 · Desenvolvimento e ensaios fictícios.** [Revisão completa](2026-11-06-flow-revisao-pr44-p28.md). Este arquivo é para **Claude/desenvolvimento**, dependência Google da P-28 do Barba & Cabelo.

Relatório `relatorio-claude-flow-pendencias-pr43-p28-2026-11-06.md` lido inteiro. [#44 integrado](https://github.com/Proh2026Media/flow-proh-media/pull/44) em **06/11 às 11:16:06 Brasília**, head `08f0b1ee421c3c09f7bcef85d86dae4335569ac1`, merge/main/espelho `e9b65d4813052aa3d37ef78a3e36028f88530eaf`, mesmo conteúdo. Trabalhar da main atual, com a vez e AGENTS do Flow, em **novo ramo e PR em rascunho**. Não pedir outro merge do #44.

## Preservar o atendido

**F3 atendida:** aba antiga conclui sob barreira fechada, outro dono recebe 503 sem Google. Incerteza registrada antes do fechamento não é mais ignorada ao abrir/fechar; `incerto_anterior` bloqueia. Retorno normal/divergente e `barreira_perdida` preservados. Não refazer esses itens do zero.

Codex executou **165/0/0** ferramentas com PG 15.8 fictício/Bun 1.4.2 Linux; **138/138 Vitest**, tipos do app/lint limpos. Nove independentes finais: **6 passaram / 3 falharam**. A reprodução do cron executa corpos originais extraídos de três funções, dependências simuladas e classe real; handler Deno inteiro não executado.

## F1a. Falha externa capturada não pode desaparecer por HTTP 200

`comBarreira` só considera exceção ou status ≥500; `encerrar` apaga os efeitos em sucesso. O caminho real do cron captura falha do DELETE em `revogarVencidos`, grava erro e devolve 200 em `handleShareExpire`.

**Reprodução:** usar os corpos originais de `revogarPermissao` (index 1204–1208), `revogarVencidos` (1265–1282) e `handleShareExpire` (1569–1579), sob `comBarreira`, com admin/Google simulados. A consulta DELETE passa por **`chamarComRegistro` e perde a resposta (status 0)**. A captura interna registra um erro, e a resposta final é 200. Fechar → verificar legado vazio fictício → drenar. Atual: **incertas=0, prova emitida**.

**Exigido:** alteração externa de resultado desconhecido segue contabilizada independentemente do status público/catch da rota. Registrar efeito não basta se `encerrar` o descarta. Preservar contrato/resposta do cron; não trocar apenas seu 200 por 500 para satisfazer o teste. Distinguir ausência comprovada de efeito, alteração bem-sucedida e falha incerta; compensação só com evidência.

Testar também erro externo capturado com resposta 4xx, sucesso normal sem pendência artificial, ação somente leitura e múltiplas chamadas/compensações. O negativo deve falhar sobre o #44 usando chamada externa registrada, não somente um 502 sem efeito.

## F1b. Reconciliar permissão no arquivo correto

`referenciasAtivas` constrói `Set<permissionId>` global; `reconciliarIncertas` ignora `ef.arquivo` ao conferir criação/remoção. Google documenta que o permissionId de um destinatário é o mesmo em arquivos diferentes. [Compartilhamento Drive](https://developers.google.com/workspace/drive/api/guides/manage-sharing).

**Reprodução:** banco tem P ativa em B. Registrar com `chamarComRegistro` POST `files/A/permissions`, resposta `{id:P}`; a ação termina em 502 antes de persistir A. Fechar/capturar e reconciliar. Atual: **1 reconciliada, 0 pendentes, zero chamadas Google**, incerteza apagada e prova emitida. O registro de B legitimou uma permissão sem vínculo em A.

**Exigido:** conferir a associação **arquivo + permissão** em criação/remoção. Usar comprovação remota apropriada quando necessária ao resultado desconhecido; ausência de prova do alvo correto mantém recusa. Não autorizar por existir mesmo destinatário em outro arquivo.

Regressões: mesmo permissionId em dois alvos; criação órfã em A com B ativo; remoção em A com B ativo; alvo/ID ausente; resultado remoto desconhecido/erro; controles coerentes do par exato. Leituras limitadas, sem inventário global nem escrita Google real.

## F2a. Token presente não pode virar fim silencioso da listagem

`verificarLegado`, linha 408, transforma nextPageToken fora de `[A-Za-z0-9_.~-]+` em undefined. Isso encerra a listagem com sucesso, sem demonstrar que acabaram os resultados. O token da API é opaco, sem esse alfabeto imposto pelo contrato. [files.list](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list).

**Reprodução:** duas páginas simuladas; primeira tem arquivo coerente, segunda tem órfão. Token `pagina-ficticia-2` → 2 páginas/1 órfão, drenagem recusada (controle). Alterar só o token para `pagina-ficticia-2=` → 1 página/0 órfãos, **prova emitida**. Não foi observação de token literal no Google real; testa tratamento de formato não suportado.

**Exigido:** codificar/transportar token opaco corretamente, ajustando a porteira, ou recusar explicitamente formato não suportado. Nunca concluir lista por token presente rejeitado. Resposta incompleta/inesperada mantém recusa e não gera recibo aprovador; validar a cobertura/fim da listagem, preservando páginas vazias intermediárias com token. Testes com tokens que precisem de codificação, órfão na última página e controle completo sem órfãos.

## Entrega e limites

- Novo PR/head/manifesto e relatório pelos três achados; negativos reprovam o #44 e positivos preservam F3/retorno/reconciliação atendidos. Google simulado, PG fictício para concorrência/transação; distinguir código executado, extração, modelo e teste estático.
- Preservar `exigirAlvoFicticio`, `restaurar-ficticio`, guardas de instalação/migration e bloqueio de produção. Não criar flag de bypass. AGENTS limita instaladores à stack de teste.
- Consulta Codex **06/11 às 11:24:07 Brasília**: arquivos vivos #36, barreira ausente, banco/funções healthy com mesmos IDs/inícios. Agora não é necessário inventário TI ou instalação para corrigir os três pontos.
- A proposta de instalar, reiniciar workers, aguardar/verificar legado e executar janela/D **não foi autorizada por este retorno**. A disponibilidade de AsyncLocalStorage e o corte efetivo dos workers antigos pertencem ao futuro procedimento revisado. Nada de acessar/alterar VPS, Google, cron, Coolify, sessões ou compartilhamentos reais nesta correção.
- A/B/T1, Picker dos 15, candidato e evidências v2 já atendidos/sob custódia; sem repetir consentimento/renovação, pedir segredos ou revogar cliente antigo. Depois da revisão, preparar operação concreta para decisão do dono. **Destinatário agora: Claude, não TI/execução.**
