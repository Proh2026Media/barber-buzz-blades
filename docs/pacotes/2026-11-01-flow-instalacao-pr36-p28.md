# P-28 — Instalação autorizada da proteção Flow: preparação e ponto de retomada

**01/11/2026 · Instalação autorizada por Alyson; troca do código ainda não executada.** Os artefatos e a cópia do código atual estão prontos na VPS, fora da API. O Flow permanece com a versão anterior, saudável e sem reinício. O diagnóstico administrativo depende de uma intervenção pessoal no aviso de segurança do Edge.

## 1. Autorização e limites

Após a apresentação do [pacote TI revisão 2](2026-10-31-ti-flow-implantacao-pr36-revisao2-p28.md), Alyson respondeu **“faça o que for preciso”**. A autorização cobre instalar os dois arquivos revisados do PR #36, preparar cópia e retorno, parar/iniciar somente o container das funções Flow e validar por `diagnostico`, em período de baixo uso. Não pedir novamente essa mesma autorização.

A migração Google continua dependendo de procedimento e decisão próprios. Esta instalação não inclui trocar cliente, tokens ou segredos, alterar banco, cron, DNS, Google Cloud, guardas dos scripts, stack de teste ou Barba & Cabelo.

## 2. Conferências e preparação executadas

- Fonte dos artefatos: merge **`926298529da2b0e565599eb3e1f86d834e514be1`** do repositório Flow. Conteúdo obtido pelo conector GitHub com referência fixa; hashes conferidos localmente e na VPS.
- `index.ts` aprovado: **`e0db47fccb1e7e52852f385cc227b8df21d574d1`**.
- `protecao.ts` aprovado: **`711879fb7b390fbabfdd67c203139e975ea80f3f`**.
- Não foi copiado `protecao.test.ts`. Permanecem válidos os 94 testes do módulo e quatro regressões independentes já registrados, pois os blobs são os mesmos.
- Pré-verificação por SSH em **01/11, ~17:32 UTC / 14:32 Brasília**: pasta viva com apenas `index.ts` antigo, blob **`17e98b8278747857329dcf38d1412b682e3c714e`**; helper ausente; funções `running healthy`.
- Leitura de tráfego do Kong em **17:42:04 UTC / 14:42:04 Brasília**: logs disponíveis e zero requisições `/functions/v1/` nos cinco minutos anteriores. Isso é uma observação daquela janela; conferir novamente antes da parada.
- Preparação remota iniciada em **17:43:38 UTC / 14:43:38 Brasília**, operação **`20261101T174338Z`**. Cópia dos dois artefatos para staging exclusiva, diretórios de preparação privados, arquivos `root:root`/`0644`.
- Conferência posterior em **~17:46:50 UTC / 14:46:50 Brasília** confirmou ambos os hashes de staging e o hash antigo na cópia e na pasta viva. Container ainda saudável, iniciado em **31/10, 23:18:42.76895618 UTC / 20:18:42.76895618 Brasília**, sem reinício nesta operação.

| Item                                | Local na VPS                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| Pasta viva, ainda antiga            | `/data/coolify/services/vv3jo93anprhqezhtu4ewcpl/volumes/functions/google-drive` |
| Staging dos dois arquivos aprovados | `/root/staging-flow-google-drive-pr36-20261101T174338Z`                          |
| Backup desta preparação             | `/root/backup-flow-google-drive-pr36-20261101T174338Z`                           |
| Cópia conferida do código antigo    | Diretório `copia-arquivos` dentro do backup                                      |
| Registro de preparação              | Arquivo `preflight.json` dentro do backup, modo `0600`                           |

O registro remoto está na fase **`artefatos_e_copia_prontos_sem_parada`**. Contém manifesto, caminhos, horários e estado inicial dos containers. Trata-se de cópia do código, sem banco, credenciais ou configuração de integração; não substitui o backup protegido exigido na futura migração Google. A pasta viva original ainda não foi movida para `pasta-viva-pre-pr36`.

## 3. Bloqueio concreto antes da parada

O login existente foi usado no Edge sem revelar senha. A interface apresentou acesso ao Painel Admin. A sessão foi mantida na página pública **`https://flow.proh.media/sobre-o-flow`**, sem abrir a aba Drive ou chamar `status`.

Ao colar o comando de diagnóstico no DevTools, o Edge bloqueou a operação e exibiu o aviso de segurança que solicita **“permitir colagem”**. O comando não foi executado. A política de controle do computador exige que **o próprio usuário** examine e libere avisos de segurança do navegador; o agente não pode digitar a liberação nem contorná-la com outro método de entrada.

Alyson já foi avisado e recebeu o pedido para revisar o aviso, digitar pessoalmente a expressão indicada, pressionar Enter e informar quando concluir. A autorização da instalação continua válida; falta essa ação pessoal, não outra aprovação do pacote. Até que o diagnóstico esteja disponível, manter a pasta viva e o container atuais.

## 4. Retomada sem repetir trabalho

1. Confirmar que Alyson concluiu a liberação no próprio Edge. Não inferir a ação apenas de uma mensagem de autorização para o agente fazê-la.
2. Executar o diagnóstico com a sessão existente, enviando sua autorização apenas à API Flow; registrar somente HTTP, estados e contagens. Não imprimir/copiar tokens. Na versão antiga, o esperado é `404` com ação `diagnostico` desconhecida; autenticação ou conectividade pendentes devem ser resolvidas antes da parada. Não usar `status` como substituto.
3. Revalidar a vez, hashes vivos/staging/cópia, saúde, tráfego e lista de funções. Se houver mudança concorrente, reconciliar antes de continuar. A leitura de baixo uso de 14:42 não vale como janela indefinida.
4. Seguir o pacote revisão 2: preparar retorno verificado, parar somente **`supabase-edge-functions-vv3jo93anprhqezhtu4ewcpl`**, guardar a pasta viva original em `pasta-viva-pre-pr36` dentro do backup e promover staging. Ajustar diretório vivo para `0755`, arquivos para `0644`, `root:root`.
5. Conferir os dois hashes e ausência de pastas extras sob `volumes/functions/` antes de iniciar. Iniciar somente o container indicado; verificar saúde/importação e confirmar que DB/Auth/Kong/Storage/REST/MinIO mantiveram seus horários de início.
6. Executar `diagnostico` administrativo após a instalação. Saúde do container ou hash sozinho não comprova que o módulo foi carregado. Registrar estados e contagens, sem IDs privados/tokens. IDs inacessíveis ou na lixeira não autorizam recriação de pastas ou migração.
7. Se a implantação falhar, conferir o backup antes do retorno e preservar a versão nova fora da API em `pasta-pos-pr36`. Registrar horários UTC/Brasília, duração stop→healthy, hashes, diagnóstico e resultado do retorno, se usado.

Não executar a migração Google depois desta instalação por extensão da autorização. Após comprovar a proteção, preparar a linha de base e o pacote de cópia/restauração e ensaio, considerando o cron de produção ativo.

## 5. Resultado desta rodada

**Concluído:** autorização registrada, artefatos exatos conferidos, staging exclusiva e cópia do código antigo preparadas na VPS. **Pendente:** liberação pessoal do aviso, diagnóstico, troca do código e validação posterior. Nenhuma parada, instalação, alteração de integração ou migração foi realizada. Não marcar a PR #36 como implantada por causa desta preparação.

Documentação do Barba & Cabelo verificada com tipos, **301 testes**, formatação dos seis documentos e montagem aprovados; **15 links/âncoras locais novos** conferidos. ESLint não aplicável, sem TypeScript alterado. Essas verificações não substituem o diagnóstico de produção ainda pendente. `.env` e `.vscode/` locais preservados e excluídos do envio.
