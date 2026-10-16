# Google Cloud: tirar o retorno antigo do cliente OAuth (P-69) — 15/10/2026

**Quem executa:** pessoa ou agente com acesso de edição ao projeto Google Cloud `proh-media-drive` · **Onde:** Google Cloud Console, no navegador de um computador, e o site https://beauty.contheiner.digital (só para testar o login) · **Escrito por:** Claude (Claude Code), a pedido do dono do Barba & Cabelo, em 15/10/2026, por volta das 21:50 (horário de Brasília, UTC−3).

**Suposição:** quem executa recebe só este texto. Não precisa do repositório, da VPS nem do Coolify. **Tempo:** cerca de 20 minutos, mais 5 minutos de espera antes do teste final. **Pendência:** P-69. A P-28 (reenviar a verificação do Google) é outro pacote.

**Nomes de tela:** este texto usa os nomes do console em inglês. Se o console estiver em português, os nomes vêm traduzidos; os equivalentes conhecidos estão entre parênteses. Em 2025 o Google mudou o menu de OAuth: o caminho novo é **Google Auth Platform** (Branding, Audience, Clients, Data Access, Verification Center); o antigo era **APIs & Services** (APIs e serviços) → **Credentials** (Credenciais) e **OAuth consent screen**. Cada passo traz os dois caminhos.

## Recado para colar

> Leia este documento inteiro antes de executar qualquer coisa. A tarefa é no Google Cloud Console, projeto `proh-media-drive`: apagar uma URI de retorno antiga do cliente OAuth do app Barba & Cabelo e testar o login uma vez. Siga os passos na ordem, confira o resultado esperado de cada um e pare se algo vier diferente. Em "Authorized domains", só anote: não mude nada. No fim, devolva o relatório da seção "Relatório para devolver".

## Objetivo

Tirar de **Authorized redirect URIs** do cliente OAuth do tipo Web do app a linha `https://supabase-teste.proh.media/auth/v1/callback`, mantendo as duas que o app usa: `https://supabasebeauty.contheiner.digital/auth/v1/callback` (login) e `https://beauty.contheiner.digital/auth/google-apps` (Agenda e Contatos). Desde 29/09/2026 o endereço antigo leva a um serviço de outro projeto: um retorno autorizado que aponta para fora do app não tem uso e só traz risco e confusão para a verificação do Google (P-28). Junto, anotar sem mudar como está `proh.media` em **Authorized domains**, para o dono decidir antes de reenviar a verificação.

## Em uma tela

1. Confirmar a conta e o projeto `proh-media-drive` (passo 0).
2. No site, ver qual retorno o login usa hoje, sem entrar (passo 1).
3. Achar o cliente OAuth do app e anotar as listas: é a cópia de segurança (passos 2 e 3).
4. Anotar **Authorized domains** e quem usa `proh.media`, só lendo (passo 4).
5. Apagar só a linha antiga e salvar (passo 6). Conferir (passo 7).
6. "Entrar com Google" uma vez no site e devolver o relatório.

**Nunca nesta tarefa:** retirar ou acrescentar domínio, mexer em segredo do cliente, criar ou excluir cliente ou projeto, reenviar a verificação.

## Regras de segurança (obrigatórias)

1. A única mudança é apagar a linha `https://supabase-teste.proh.media/auth/v1/callback` de **Authorized redirect URIs** do cliente do app e clicar em **Save** nessa página. Nenhuma outra tela recebe **Save**.
2. Faça o diagnóstico e a cópia de segurança (passos 1 a 3) antes de mudar.
3. Só o projeto `proh-media-drive` e só o cliente **Web application** achado no passo 2. Não edite outros clientes. Não mexa no projeto `barba-e-cabelo`.
4. **Authorized domains:** só ler e anotar. Não retire `proh.media` e não acrescente domínio.
5. Não crie, exclua nem renomeie cliente OAuth ou projeto. Não mexa em **Client secrets** (Add secret, Disable, Delete, Download JSON). Trocar o cliente ou o segredo derruba o login de todos os clientes do app e atrapalha a verificação.
6. Não copie para o relatório nem para chat: senha, código de verificação, segredo do cliente nem o Client ID completo. Nos prints, cubra só o segredo do cliente; o Client ID pode aparecer (é público: vai em cada endereço de login). Senha e código de verificação nunca aparecem em print.
7. Teste de login só com uma conta Google que já entra no app. Uma conta nova cria cadastro no app.
8. Se qualquer tela ou resultado vier diferente do esperado, **pare** e relate o que viu, com print. Não tente consertar por conta própria. A única ação permitida sem perguntar é "Como desfazer", se o login falhar depois da mudança.
9. Nada de servidor, Coolify, Supabase, DNS, Hostinger nem repositório. Não faça commit nem push: neste projeto, enviar ao GitHub publica o site.

## O que você precisa ter em mãos

| Item                                                                                       | Onde está                                                                                                                                                | Observação                                                                                 |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Conta Google com permissão de edição no projeto `proh-media-drive` (papel Owner ou Editor) | Com o dono. Os registros de 24/09/2026 citam a conta `9697media@gmail.com` no projeto OAuth; não confirmado se é ela que administra o `proh-media-drive` | Senha e código de verificação ficam com quem entra; não vão para relatório, chat nem print |
| Navegador num computador, com janela anônima                                               | —                                                                                                                                                        | Tela larga ajuda a ler o endereço (`redirect_uri=`, `client_id=`)                          |
| Conta Google que já entra no app Barba & Cabelo                                            | De preferência a do dono                                                                                                                                 | Só para o teste final (1 minuto). Sem ela, o dono faz o teste                              |
| Bloco de notas e prints                                                                    | —                                                                                                                                                        | Para as listas antes e depois e para o relatório                                           |
| Segredo do cliente, senhas do servidor, `.env`                                             | Não são necessários                                                                                                                                      | Esta tarefa não usa segredo nenhum                                                         |

Dados do projeto (não são segredo): ID `proh-media-drive`, número `1072350331037`. Site: https://beauty.contheiner.digital.

## Já feito — não refazer

- **Servidor e código já não usam** `https://supabase-teste.proh.media/auth/v1/callback`. Conferido em 13/10/2026, só lendo: serviço de login em execução, arquivo de ambiente, compose e as 123 variáveis salvas no Coolify, além do código. Nada a fazer na VPS, no Coolify, no Supabase nem no repositório.
- **O login com Google usa** `https://supabasebeauty.contheiner.digital/auth/v1/callback`. O Google aceita esse retorno desde 30/09/2026 (login restaurado nessa data); o servidor estava com ele em 13/10/2026.
- **A Agenda e Contatos usam** `https://beauty.contheiner.digital/auth/google-apps`.
- **`supabase-teste.proh.media` não é deste app** desde 29/09/2026: leva ao Flow TEST, outro projeto da mesma VPS. Em 13/10/2026 respondia 503. Não mexer nele.
- **Projeto Google do app:** `proh-media-drive` (número `1072350331037`), conferido em 03/10/2026. O `barba-e-cabelo` (número `712948893200`) não é usado pelo app.
- **Google Calendar API e People API** já estão ativadas no `proh-media-drive` (03/10/2026). Não mexer.
- **Não confirmado:** se a linha antiga ainda está no cliente OAuth. Nenhum registro do projeto mostra a lista atual do console: em 13/10 só o servidor e o código foram conferidos. O passo 3 confere.
- **Não confirmado:** se `proh.media` está em **Authorized domains** e por quê. O passo 4 anota.
- **Não confirmado:** se o projeto tem outros clientes OAuth (de outros apps) e se eles usam `proh.media`. O passo 4 anota.
- **Não confirmado:** que outras linhas o cliente tem (origens JavaScript, `localhost`). O passo 3 anota.
- **Não confirmado hoje:** o retorno que o login usa na produção. O último teste de login com Google registrado nos documentos do projeto é de 30/09/2026. O passo 1 confere, sem entrar e sem mudar nada.

## Passo a passo

### Passo 0 — Lugar certo: conta e projeto (só leitura)

**Onde:** https://console.cloud.google.com/ (atalho direto: https://console.cloud.google.com/home/dashboard?project=proh-media-drive).

1. Entre com a conta Google que tem acesso ao projeto.
2. No seletor de projeto do topo, ao lado do logo "Google Cloud", escolha o projeto de ID `proh-media-drive`.
3. No painel (**Dashboard** ou **Welcome**), veja o cartão **Project info**.

**Esperado:** **Project ID** `proh-media-drive` e **Project number** `1072350331037`. O nome exibido pode ser outro; o que vale é o ID e o número.

**Se vier diferente:** a conta não enxerga `proh-media-drive`, ou o número não bate → pare e relate. Não use o projeto `barba-e-cabelo`.

### Passo 1 — Diagnóstico no site: qual retorno o login usa hoje (só leitura)

**Onde:** janela anônima do navegador (Chrome: Ctrl+Shift+N; no Mac, Cmd+Shift+N).

1. Abra https://beauty.contheiner.digital/auth e clique em **Continuar com Google** (com o site em inglês: **Continue with Google**). O botão fica abaixo do formulário de entrada, depois de "ou continue com"; role a página se precisar.
2. A página vai para o Google (`accounts.google.com`). **Não escolha conta.**
3. Clique na barra de endereço e procure o trecho `redirect_uri=`. O endereço vem codificado: `%3A%2F%2F` quer dizer `://`, e `%2F` quer dizer `/`.
4. No mesmo endereço, procure `client_id=` e copie para o bloco de notas o valor que vem depois, até `.apps.googleusercontent.com`. Ele serve só para comparar no passo 2; não vai para o relatório.
5. Feche a janela anônima sem escolher conta. Nada mudou: ninguém entrou e nenhuma conta foi criada.

**Esperado:** logo depois de `redirect_uri=` aparece `https%3A%2F%2Fsupabasebeauty.contheiner.digital%2Fauth%2Fv1%2Fcallback`, isto é, `https://supabasebeauty.contheiner.digital/auth/v1/callback`. A tela do Google pode dizer "to continue to supabasebeauty.contheiner.digital" ou "to continue to Barba & Cabelo"; as duas servem.

**Se vier diferente:**

- `redirect_uri=` com `supabase-teste.proh.media` → **pare**, sem apagar nada: o login ainda usa o endereço antigo e quebraria. Relate.
- Página de erro do Google (por exemplo "Error 400: redirect_uri_mismatch") ou erro do site antes de chegar ao Google → **pare** e relate com print. O login já estava com problema antes desta tarefa.
- Outro domínio → pare e relate.

### Passo 2 — Achar o cliente OAuth do app (só leitura)

**Onde:** Google Cloud Console, projeto `proh-media-drive`.

- **Caminho novo:** menu ☰ → **Google Auth Platform** → **Clients**. Atalho: https://console.cloud.google.com/auth/clients?project=proh-media-drive
- **Caminho antigo:** menu ☰ → **APIs & Services** (APIs e serviços) → **Credentials** (Credenciais), seção **OAuth 2.0 Client IDs** (IDs do cliente OAuth 2.0). Atalho: https://console.cloud.google.com/apis/credentials?project=proh-media-drive
- Se nenhum dos dois bater, digite `Clients` ou `Credentials` na busca do topo do console e confira o ID do projeto no seletor.

1. Na lista **OAuth 2.0 Client IDs**, anote de cada cliente: **Name**, **Type** e **Creation date**. Não copie o Client ID para o relatório.
2. Ache o cliente do tipo **Web application** cujo **Client ID** é igual ao `client_id` do passo 1. Compare o começo e o fim. Em geral, o Client ID começa pelo número do projeto: `1072350331037-`.
3. Clique no **nome** dele para abrir, não na lixeira da linha (ela exclui o cliente inteiro). Só abrir: não mude nada ainda.

**Esperado:** exatamente um cliente **Web application** com o mesmo Client ID do passo 1. A página dele tem as seções **Authorized JavaScript origins** (Origens JavaScript autorizadas) e **Authorized redirect URIs** (URIs de redirecionamento autorizados).

**Se vier diferente:** nenhum cliente com esse Client ID, mais de um, ou de outro tipo → pare e relate. Não crie cliente novo.

### Passo 3 — Cópia de segurança e diagnóstico do cliente (só leitura)

**Onde:** a página do cliente aberta no passo 2.

1. Copie para o bloco de notas, **na ordem e com o texto exato**, todas as linhas de **Authorized JavaScript origins** e todas as de **Authorized redirect URIs**. Essa anotação é a cópia de segurança: é com ela que se desfaz.
2. Tire um print da página. Se a área **Client secrets** (ou **Client secret**) mostrar o segredo inteiro, deixe essa parte fora do print ou cubra. O Client ID pode aparecer no print (regra 6).
3. Compare **Authorized redirect URIs** com esta tabela:

| Linha                                                        | O que acontece com ela                  |
| ------------------------------------------------------------ | --------------------------------------- |
| `https://supabase-teste.proh.media/auth/v1/callback`         | **Sai.** É a única mudança desta tarefa |
| `https://supabasebeauty.contheiner.digital/auth/v1/callback` | **Fica.** Retorno do login com Google   |
| `https://beauty.contheiner.digital/auth/google-apps`         | **Fica.** Retorno da Agenda e Contatos  |

**Esperado — um destes casos:**

- **Caso A:** a linha `https://supabase-teste.proh.media/auth/v1/callback` está na lista, e as duas que ficam também. → Siga para o passo 4.
- **Caso B:** a linha antiga não está, não há nenhuma outra com `supabase-teste`, e as duas que ficam estão. → A tarefa já foi feita: **não mude nada**. Faça só o passo 4 e o teste de login de "Como saber que deu certo", e relate.
- **Caso C:** falta uma das duas que ficam, ou a linha exata não está mas existe outra com `supabase-teste` (com barra no fim, outro caminho etc.). → **Pare** e relate. Não acrescente nem apague nada.

Qualquer outra linha (por exemplo `http://localhost:8090/auth/google-apps`, ou um endereço em `proh.media` como `https://supabase-barbearia.proh.media/auth/v1/callback`) fica como está: só anote. O mesmo vale para **Authorized JavaScript origins**: nenhuma origem muda nesta tarefa, nem a que tiver `supabase-teste`.

### Passo 4 — Anotar os domínios autorizados e quem usa `proh.media` (só leitura)

**Por que só anotar:** a lista **Authorized domains** vale para o projeto inteiro, isto é, para todos os clientes OAuth do `proh-media-drive`, e não só para o do app. O nome do projeto sugere que ele pode atender a outros apps da PROH Media (não conferido). A API oficial deste app, `https://supabase-barbearia.proh.media`, também fica em `proh.media`. E mexer na **Branding** de um app em verificação pode pedir nova revisão (dedução). Por isso, retirar `proh.media` é decisão do dono, junto com o reenvio da verificação (P-28).

**Onde:**

- **Caminho novo:** **Google Auth Platform** → **Branding**, seção **Authorized domains**. Atalho: https://console.cloud.google.com/auth/branding?project=proh-media-drive
- **Caminho antigo:** **APIs & Services** → **OAuth consent screen** (Tela de permissão OAuth): o resumo do app, ou **Edit app** → seção **Authorized domains** (Domínios autorizados). Atalho: https://console.cloud.google.com/apis/credentials/consent?project=proh-media-drive

1. Copie a lista **Authorized domains** inteira e diga se `proh.media` está nela.
2. Copie também, da seção **App domain**: **Application home page**, **Application privacy policy link** e **Application Terms of Service link**.
3. Saia da página **sem clicar em Save**. Se o navegador avisar que há alterações não salvas, escolha sair sem salvar: algo foi mexido sem querer, e sair descarta.
4. Volte à lista de clientes do passo 2. Para cada **outro** cliente (não o do app), abra só para ler. Anote toda origem ou retorno cujo domínio seja `proh.media` ou termine em `.proh.media` (por exemplo `https://algo.proh.media` ou `https://algo.proh.media/auth/v1/callback`), com o nome do cliente e a linha exata. Saia com **Cancel** ou com a seta de voltar, sem salvar. Se houver mais de 5 outros clientes, anote só os nomes e não abra nenhum.
   - **Cuidado:** na lista de clientes há uma lixeira em cada cliente, e no topo da página do cliente pode haver o botão **Delete** (Excluir). Os dois excluem o cliente inteiro: não clique neles. Se aparecer uma janela que fale em excluir o cliente (por exemplo "Delete OAuth client?" ou com o nome do cliente), clique em **Cancel** (Cancelar).
5. Opcional, só leitura: em **Audience**, o **Publishing status** ("In production" ou "Testing"); em **Verification Center**, o status da verificação.

**Esperado (é o que os registros do projeto indicam; não confirmado):** `contheiner.digital` na lista; home page `https://beauty.contheiner.digital`; política `https://beauty.contheiner.digital/privacidade`; termos `https://beauty.contheiner.digital/termos`. `proh.media` pode estar ou não.

**Se vier diferente:** só anote. Nada desta tela muda nesta tarefa; se algo precisar de correção, entra no reenvio da verificação (P-28), com o dono.

### Passo 5 — Ensaio

Não se aplica: o console do Google não tem modo de teste para esta mudança. A proteção é o passo 1 (o login não usa o endereço antigo) e a anotação do passo 3 (permite recolocar a linha exata).

### Passo 6 — Aplicar: apagar só a linha antiga (muda o console)

Só no **Caso A** do passo 3.

**Onde:** a página do cliente do app (passo 2), seção **Authorized redirect URIs**.

1. Na linha `https://supabase-teste.proh.media/auth/v1/callback`, clique no ícone de lixeira (ou no X) à direita **dessa linha**. O ícone pode aparecer só quando o mouse passa sobre a linha.
   - **Cuidado:** apagar a linha não abre janela de confirmação: ela só some da lista. Na lista de clientes há uma lixeira em cada cliente, e no topo da página do cliente pode haver o botão **Delete** (Excluir). Os dois excluem o cliente inteiro: não clique neles. Se aparecer uma janela que fale em excluir o cliente (por exemplo "Delete OAuth client?" ou com o nome do cliente), clique em **Cancel** (Cancelar).
2. Antes de salvar, confira na tela:
   - a linha antiga sumiu;
   - `https://supabasebeauty.contheiner.digital/auth/v1/callback` e `https://beauty.contheiner.digital/auth/google-apps` continuam;
   - as outras linhas anotadas no passo 3 continuam iguais, inclusive as de **Authorized JavaScript origins**;
   - o **Name** do cliente não mudou.
3. Clique em **Save** (Salvar), no fim da página. Anote o horário, com fuso.

**Esperado:** nenhuma mensagem de erro. O console pode mostrar uma confirmação curta (por exemplo "OAuth client saved") e pode voltar para a lista de clientes. Se não aparecer mensagem, siga para o passo 7: a prova é a lista conferida de novo. O aviso "It may take 5 minutes to a few hours for settings to take effect" é texto fixo da página e já aparecia antes do **Save**: não é resposta ao **Save**.

**Se vier diferente:** se apagou a linha errada, clique em **Cancel** antes de salvar e recomece o passo 6. Se o **Save** mostrar qualquer erro, copie o texto exato, clique em **Cancel**, pare e relate. Não mexa em outras telas para "resolver".

### Passo 7 — Conferir no console (só leitura)

1. Se o console voltou para a lista de clientes, abra de novo o cliente do app: clique no **nome** dele (o mesmo **Name** do passo 2). Se já estiver na página do cliente, recarregue (F5; no Mac, Cmd+R).
2. Copie de novo, na ordem, as linhas de **Authorized JavaScript origins** e de **Authorized redirect URIs**. Tire um print, sem o segredo.

**Esperado:** igual à anotação do passo 3, menos a linha `https://supabase-teste.proh.media/auth/v1/callback`.

**Se vier diferente:** se sumiu qualquer outra linha, recoloque-a já, como em "Como desfazer", e relate.

## Como saber que deu certo

1. **No console:** em **Authorized redirect URIs** do cliente do app não há mais `https://supabase-teste.proh.media/auth/v1/callback`; continuam `https://supabasebeauty.contheiner.digital/auth/v1/callback` e `https://beauty.contheiner.digital/auth/google-apps`; o resto está igual ao passo 3.
2. **"Entrar com Google", uma vez:** espere pelo menos 5 minutos depois do **Save**. Numa janela anônima nova (senão o site pode entrar direto, sem passar pelo Google), abra https://beauty.contheiner.digital/auth, clique em **Continuar com Google** e escolha uma conta Google que **já entra no app** (de preferência a do dono).
   - **Esperado:** em poucos segundos a página volta para `https://beauty.contheiner.digital` com a conta aberta (a área do app, não a tela de entrada) e sem página de erro do Google. Tire um print.
   - Se o app pedir para completar algo (aceitar os termos, informar o WhatsApp), o login já deu certo. Não precisa completar; anote no relatório.
   - Não use conta Google nova: o primeiro login cria um cadastro no app. Se você não tem uma conta que já entra no app, peça ao dono para fazer este teste e anote o que ele contar.
   - Depois, saia da conta no app se o computador não for do dono.
3. **Se o login falhar de qualquer jeito** (por exemplo "Error 400: redirect_uri_mismatch", "Access blocked" ou erro do site): tire print (o Client ID pode aparecer; regra 6); se for a página de erro do Google, abra **error details** (ou leia "Request details") e copie a linha `redirect_uri=`. Vá na hora para "Como desfazer", teste de novo depois de 5 minutos e relate as duas tentativas.

## Como desfazer

**Quando:** se o teste de login falhar depois da mudança, ou se alguma linha além da antiga tiver saído por engano. Desfazer só recoloca o que estava, então pode ser feito na hora, sem esperar o dono: o login dos clientes reais depende disso. Conte no relatório.

**Se o cliente do app chegou a ser excluído** (por exemplo, ele sumiu da lista de clientes): pare e avise o dono na hora, porque o login com Google e a Agenda e Contatos param para todos. Não crie cliente novo. Os passos abaixo não servem para esse caso.

1. Abra a página do cliente do app (passo 2).
2. Em **Authorized redirect URIs**, clique em **+ Add URI** (Adicionar URI) e cole exatamente:

```text
https://supabase-teste.proh.media/auth/v1/callback
```

3. Se outra linha saiu por engano, acrescente-a do mesmo jeito, com o texto exato anotado no passo 3.
4. Clique em **Save**. Se o console voltar para a lista de clientes, abra de novo o cliente do app pelo **nome**; se continuar na página do cliente, recarregue. Confira que a lista voltou a ser igual à do passo 3.
5. Espere 5 minutos e repita o teste de login.

Esta tarefa não muda nada no servidor, no banco nem no repositório; não há mais nada a desfazer. Se o console recusar o **Save** por causa de domínio (por exemplo "Invalid Redirect: domain must be added to the authorized domains list before submitting"), pare e relate. Não acrescente nem retire domínio por conta própria.

## Fora do escopo

- **Retirar `proh.media` de Authorized domains.** Fica com o dono, depois de ler o passo 4 do relatório, junto com o reenvio da verificação (P-28). Critério sugerido: só retirar se nenhum cliente do projeto usar endereço em `proh.media` (origem ou retorno) e se home page, política e termos estiverem em `contheiner.digital`. Lembrar que a API oficial do app é `https://supabase-barbearia.proh.media` e que mudar a Branding pode pedir nova revisão.
- **Verificação do Google (P-28):** reenviar, gravar o vídeo, mexer em **Branding**, **Audience** (publishing status, test users), **Data Access** (escopos) ou **Verification Center**. É outro pacote.
- Criar, excluir ou renomear cliente OAuth; criar ou trocar de projeto; qualquer coisa no projeto `barba-e-cabelo`.
- **Client secrets:** ver, baixar, criar, desativar ou excluir.
- Origens JavaScript e outros retornos (`localhost`, outros endereços em `proh.media`): só anotar.
- Outros clientes OAuth do projeto, chaves de API, contas de serviço, APIs ativadas (Google Calendar API, People API), IAM e faturamento.
- Servidor, Coolify, Supabase, DNS, Hostinger e o próprio `supabase-teste.proh.media` (é de outro projeto).
- **Repositório:** o executor não edita nada nem envia ao GitHub. Registrar o resultado na P-69 (`docs/guia/pendencias.md`) e no `docs/CONTINUIDADE.md` fica com o dono e com a ferramenta que estiver com a vez, a partir do relatório.

## Referências no repositório (apoio)

Quem recebe só este texto não precisa delas: o essencial está acima. Caminhos a partir da raiz do repositório:

- `docs/passagem-claude-2026-10-15.md`, seção "O que não é com a Claude — pacotes para encaminhar" (pacotes A e B)
- `docs/guia/pendencias.md`, P-69 e P-28
- `docs/google-verificacao.md`
- `docs/guia/banco-e-implantacao.md`, seção 11

## Relatório para devolver

Copie o bloco abaixo, preencha e devolva ao dono com os prints. No texto: sem senha, sem código de verificação, sem segredo e sem Client ID completo. Nos prints, só o segredo fica coberto (regra 6).

```text
RELATÓRIO — P-69, retorno antigo do Google (pacote de 15/10/2026)

Quem executou: ____ (pessoa ou agente)
Início: __/__/2026 __:__   Fim: __:__   Fuso: ____ (ex.: Brasília, UTC−3)

Passo 0 — projeto
- Project ID: ____   Project number: ____

Passo 1 — retorno em uso, antes de mudar
- Domínio logo depois de "redirect_uri=": ____
- Texto "to continue to ..." na tela do Google: ____

Passo 2 — clientes OAuth do projeto (nome / tipo / data de criação)
- Cliente do app: ____ / ____ / ____
- Client ID do cliente do app igual ao do passo 1: sim | não
- Outros clientes: ____ (ou "nenhum")

Passo 3 — ANTES (texto exato, na ordem)
Authorized JavaScript origins:
- ____
Authorized redirect URIs:
- ____
Caso: A | B | C

Passo 4 — domínios (só leitura)
- Authorized domains: ____
- proh.media está na lista: sim | não
- Application home page: ____
- Application privacy policy link: ____
- Application Terms of Service link: ____
- Outros clientes com endereço em proh.media (cliente e linha): ____ (ou "nenhum")
- Publishing status (opcional): ____   Verification status (opcional): ____

Passo 6 — aplicar
- Horário do Save: __:__ (fuso ____)   Mensagem exibida: ____

Passo 7 — DEPOIS (texto exato, na ordem)
Authorized JavaScript origins:
- ____
Authorized redirect URIs:
- ____

Teste "Entrar com Google"
- Horário: __:__   Conta usada: do dono | outra que já entrava no app
- Voltou ao app com a conta aberta: sim | não   Endereço final: ____
- Erro (texto exato), se houve: ____

Desfazer: não foi preciso | feito às __:__ — o que foi recolocado: ____
Não mexi em Authorized domains, Branding, Audience, Data Access,
Verification Center, Client secrets, outros clientes nem APIs: confirmo | não (explique)
Diferenças do esperado: ____
Prints anexados: ____
```
