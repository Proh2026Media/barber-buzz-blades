# P-28 — Pacote para TI/Guardião: gatilho de publicação do Flow

**31/10/2026 · Destinatário: agente de TI, com o responsável pelo cofre de credenciais quando necessário.** Objetivo: restabelecer o aviso automático da origem do Flow ao hub e comprovar o espelhamento. O pedido ao Codex foi preparar este arquivo; nenhuma configuração ou execução remota foi realizada. Ao receber o pacote, seguir o escopo autorizado por Alyson no encaminhamento.

## 1. Diagnóstico já concluído

Não repetir inventário de Google, DNS, VPS, cron, variáveis ou hash da função Drive. O relatório TI de **19:50–19:52 de Brasília** já identificou a causa da publicação manual:

- [Execução com falha](https://github.com/Proh2026Media/flow-proh-media/actions/runs/41247580111): **`Segredo HUB_DISPATCH_TOKEN não cadastrado neste repositório.`**
- [Issue #17](https://github.com/Proh2026Media/flow-proh-media/issues/17): gatilho de sincronização parado.
- O workflow atual está habilitado para `Proh2026Media/flow-proh-media`. A afirmação anterior de que os dois workflows eram pulados foi corrigida.
- O Codex confirmou origem e espelho em `2cc490788209e32480282f8730e4f4062dfad2e7` após a publicação feita pelo Alyson. Isso é a referência do levantamento, não instrução para voltar a esse commit. Igualdade dos repositórios não comprova que o gatilho foi reparado.

**Tarefa única deste pacote:** corrigir a credencial do gatilho e validar a cadeia abaixo. Preparação do projeto Google/operador e PR de proteção Drive continuam em tarefas próprias.

## 2. Alvos exatos

| Papel                                | Alvo                                                                |
| ------------------------------------ | ------------------------------------------------------------------- |
| Origem do código e local do segredo  | `Proh2026Media/flow-proh-media`                                     |
| Nome do segredo de Actions na origem | `HUB_DISPATCH_TOKEN`                                                |
| Workflow a acionar na origem         | `.github/workflows/sync-instantanea-hub.yml`, branch `main`         |
| Repositório de controle              | `PROH-Media/hub-control`                                            |
| Workflow chamado pelo gatilho        | `hub-espelho.yml`, branch `main`, entrada `projeto=flow-proh-media` |
| Espelho que alimenta a publicação    | `PROH-Media/flow-proh-media`, branch `main`                         |
| Site a conferir                      | `https://flow.proh.media` — hospedagem pública Hostinger confirmada |

Fonte de configuração: [workflow do Flow](https://github.com/Proh2026Media/flow-proh-media/blob/main/.github/workflows/sync-instantanea-hub.yml). Não usar o repositório do Barba & Cabelo, o projeto inteiro do hub ou o workflow de backup como substitutos.

## 3. Preparar a execução

1. Conferir somente os metadados atuais necessários: se o segredo existe, estado do último gatilho e SHAs atuais de origem/espelho. Não recuperar nem imprimir valor de segredo. Se já houve correção com cadeia comprovada, registrar o resultado existente; não substituir credencial válida.
2. Confirmar que a `main` a espelhar contém trabalho revisado/verificado e que o espelho não tem entrega exclusiva a perder. O teste do gatilho pode publicar a `main` atual na Hostinger. Não usar commit vazio ou push manual para provocar a publicação.
3. Se o espelho divergir com trabalho exclusivo, houver bloqueio de acesso ou a causa atual diferir da ausência já diagnosticada, registrar a diferença para tratar no escopo correto. Não sobrescrever histórico ou ampliar permissões para contornar o bloqueio.

## 4. Cadastrar a credencial no destino correto

O responsável autorizado pelo cofre cadastra `HUB_DISPATCH_TOKEN` como **segredo do repositório de origem** `Proh2026Media/flow-proh-media`. Usar uma credencial dedicada ao gatilho; não copiar a de outro aplicativo nem alterar segredos dos demais projetos.

**Permissões previstas para o token de acesso granular:**

- Proprietário do recurso: **`PROH-Media`**.
- Acesso a repositório: somente **`PROH-Media/hub-control`**.
- Permissão de repositório: **Actions — leitura e escrita**; metadados básicos conforme o GitHub exigir. Sem escrita de código ou acesso aos demais repositórios.
- Definir validade conforme a política do cofre e registrar responsável/renovação, sem valor no relatório. Não adotar validade ilimitada por texto antigo do workflow.

A [documentação oficial do GitHub para disparar workflows](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event) pede a permissão Actions de escrita para tokens granulares. O token usado pelo workflow precisa alcançar o **hub**; o operador que cadastra o segredo precisa ter acesso administrativo apropriado à **origem**. São acessos distintos.

Inserir o valor diretamente no campo seguro do GitHub ou pelo procedimento protegido do cofre. Não colocar token em chat, documento, Git, argumento de comando, captura de tela ou log. A TI valida os resultados sem precisar receber o valor em texto.

Não alterar arquivos de workflow, versão da API, permissões da organização ou outros segredos por este pacote. Se surgir falha diferente, devolver código HTTP/erro sanitizado e etapa atingida; eventual mudança de código segue o PR do Flow.

## 5. Validar a cadeia pelo gatilho da origem

Com a execução autorizada e a `main` conferida, acionar **uma vez** o workflow da origem. Alternativa pelo GitHub CLI, usando a sessão autorizada do operador, sem token no comando:

```bash
gh workflow run sync-instantanea-hub.yml --repo Proh2026Media/flow-proh-media --ref main
```

Conferir, nesta ordem:

1. A execução da origem termina com sucesso no passo **“Pedir espelhamento ao hub”**; não apenas outro workflow verde.
2. Existe execução correspondente no hub para **`flow-proh-media`**, com resultado de sincronização ou confirmação de que já estava atualizado. Não acionar todos os projetos para testar apenas o Flow.
3. Origem e espelho correspondem ao mesmo commit esperado após a execução. Registrar os SHAs completos; não exigir `2cc4907` se houve entrega revisada posterior.
4. Site público e `/sobre-o-flow`, `/privacidade`, `/termos` continuam acessíveis sem sessão; registrar o bundle servido. Com o mesmo commit, bundle idêntico é normal: não inventar entrega nova para provar o gatilho.

Não abrir a aba Drive nem chamar funções para conferir publicação. Os testes públicos não incluem login, OAuth, arquivos ou dados reais.

**Critério de conclusão:** gatilho da origem e execução correspondente do hub comprovados, commits coerentes e páginas públicas acessíveis. HTTP 200, segredo cadastrado ou SHAs iguais, isoladamente, não fecham a tarefa. Após comprovar, o responsável pode encerrar a issue #17 com referência às evidências, se isso estiver incluído no encaminhamento autorizado. Falha sem alteração de código não exige outro PR.

## 6. Limites e devolutiva

Este pacote atua no gatilho GitHub do Flow. **Não inclui** mudanças em Google Cloud/OAuth, DNS/Pages, `APP_URL`, cron P-26, VPS, containers, banco, função Drive, cliente Barba & Cabelo ou stack de teste. Não usar push direto/manual no espelho como reparo; não fazer merge, force push ou redeploy do Coolify. A rotação de credencial VPS citada em outro relatório é tarefa separada.

Devolver **`relatorio-ti-flow-gatilho-p28-2026-10-31.md`**, contendo:

- Horários em Brasília e UTC; estado encontrado e ação efetivamente realizada.
- Nome/local do segredo e permissões/validade adotadas, **sem valor**, ou a dependência exata do responsável pelo cofre.
- SHAs de origem/espelho antes e depois; links e resultados das execuções da origem e do hub.
- Páginas/bundle conferidos e situação da issue #17.
- Resultado: **corrigido e comprovado**, **apenas preparado** ou **bloqueio identificado**, com a etapa exata e erro sanitizado. Distinguir falta de acesso de falha do sistema.
- Confirmação do escopo preservado; nenhuma credencial, token, conteúdo de `.env` ou saída de ambiente anexada.

Não devolver outro levantamento completo. O Codex usará esse resultado junto com o [PR de proteção a preparar pelo Claude/Flow](2026-10-31-flow-retorno-e-protecao-p28.md); reparar o gatilho não conclui nem autoriza a migração Drive.
