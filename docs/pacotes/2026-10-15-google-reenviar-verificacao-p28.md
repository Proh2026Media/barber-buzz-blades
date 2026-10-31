# Google: gravar o vídeo e reenviar a verificação do login, da Agenda e dos Contatos (P-28) — 15/10/2026

**Atualização de 31/10/2026, complemento de ~17:00 — não iniciar este roteiro ainda:** P-69 concluída e preservada. TI identificou o cliente **Supabase Google Drive** no **Flow produção**, configurado e conectado. `proh.media` segue nos retornos desse cliente e nos três links da marca **Proh Media**, não verificada; Audience Em produção não é aprovação. Propriedade de `proh.media` associada ao IAM ainda não comprovada. [Resultado, seção 10](2026-10-31-google-dominio-p28.md), e [proposta de separar o Drive preservando o cliente atual do Barba & Cabelo](2026-10-31-google-separacao-flow-p28.md), pendente de decisão sobre continuidade do Flow e preparação operacional. Resolver a separação/identidade e marca/domínios, depois revisar este pacote antes de gravar/reencaminhar. Não usar desconexão/revogação como teste automático no projeto compartilhado: pode afetar a mesma conta nos dois clientes. Aprovações de 03/10 são históricas; nenhuma migração, alteração Google ou reenvio foi feito nesta atualização.

**Quem executa:** uma pessoa com a conta Google que administra o projeto `proh-media-drive` (papel Owner ou Editor), mais alguém para gravar o vídeo (pode ser a mesma pessoa) · **Onde:** Google Cloud Console (Google Auth Platform), Google Search Console, o site https://beauty.contheiner.digital, Google Agenda e Google Contatos de uma conta de teste, YouTube e a caixa de e-mail que recebeu a reprovação do Google · **Escrito por:** Claude (Claude Code), a pedido do dono do Barba & Cabelo, em 15/10/2026 às 21:50 de Brasília (UTC−3; 00:50 UTC de 16/10).

**Suposição:** quem executa recebe só este texto, sem o repositório e sem a conversa que o gerou. Tudo o que é preciso está aqui; os links do fim são apoio. **Pendência:** P-28. **Pré-requisito:** P-69, que é o pacote A (`2026-10-15-google-retorno-antigo-p69.md`). **Horários:** todos em Brasília (UTC−3).

**Nomes de tela:** este texto usa os nomes do console, do app e do Google em inglês, porque o vídeo é em inglês. Em 2025 o Google mudou o menu de OAuth: o caminho novo é **Google Auth Platform**; o antigo era **APIs & Services** (APIs e serviços). A tabela "Onde fica cada coisa no console", antes do passo a passo, traz os dois caminhos.

## Recado para colar

> Leia este documento inteiro antes de abrir qualquer tela. A tarefa é gravar um vídeo em inglês e reenviar a verificação do Google do app Barba & Cabelo, no projeto `proh-media-drive`, sem criar cliente OAuth, sem trocar de projeto e sem mudar escopos. O pacote A (P-69) precisa estar feito antes: o passo 2 confere. Siga os passos na ordem, confira o esperado de cada um e pare se algo vier diferente. No fim, devolva o relatório pedido, sem senhas.

## Objetivo

Reenviar, no **Verification Center** do projeto `proh-media-drive`, o pedido de verificação do app Barba & Cabelo, com um vídeo novo em inglês. O vídeo mostra a tela de consentimento do Google com o `client_id` visível na barra de endereço e o uso de cada permissão sensível: Agenda (lista de agendas, importação de eventos, cópia de um horário) e Contatos (salvar um contato). Termina com a desconexão.

Por quê: o Google reprovou o pedido em 03/10/2026 em dois itens. "Política de privacidade" já foi corrigida e publicada. "Funcionalidade do app" veio sem detalhe; a causa provável é o vídeo antigo não mostrar o uso de cada permissão. Enquanto não houver aprovação, quem conecta a Agenda vê o aviso "Google hasn't verified this app".

## Regras de segurança (obrigatórias)

1. **Projeto:** só o `proh-media-drive` (número `1072350331037`). Não use o `barba-e-cabelo` (número `712948893200`): o app não usa esse projeto.
2. **Cliente OAuth:** não crie cliente nem projeto e não troque de projeto. Não apague, desative nem renomeie cliente nenhum, e não mexa em **Client secrets**. Neste pacote, o cliente só é aberto para leitura. Uma troca de cliente exige plano próprio e ensaio de login e conexões existentes; o resultado não pode ser presumido a partir dos testes da P-69, e a verificação precisa corresponder à configuração usada.
3. **Configuração:** não mude **Branding**, **Audience**, **Authorized domains** nem os escopos de **Data Access**. Mudar a marca ou os escopos reabre a análise do que já foi aprovado. O que vier diferente do esperado: pare e relate. Nesta tarefa, só muda o conteúdo do pedido de verificação (justificativas, link do vídeo e instruções ao revisor).
4. **Pré-requisito:** sem a P-69 feita (passo 2), não grave nem reenvie.
5. **Um reenvio só:** se o passo 1 mostrar análise em andamento, não reenvie.
6. **Segredos:** não abra, copie, baixe nem filme o **Client secret**; não grave o console do Google Cloud; não copie o Client ID completo para o relatório (no vídeo ele precisa aparecer). As senhas das contas de teste ficam nas Chaves do macOS do dono, serviço "Barba e Cabelo - Loja Teste". Elas não vão para documento, chat (nem de IA), vídeo, legenda, descrição do YouTube, e-mail ou relatório. Se quem executa não é o dono, o dono digita as senhas na hora ou combina um canal seguro. As credenciais do revisor vão só no campo próprio do formulário do Google, digitadas pelo dono. Única exceção: sem formulário (passo 9, item 1), o próprio dono decide como entregá-las no fio do e-mail com o Google; quem executa nunca as escreve.
7. **Dados:** use só a Loja Teste (`loja-teste`) e dados inventados. A Loja Teste B (`loja-teste-b`) só é aberta na conferência do **My areas** (passo 5.3), sem mudar nada nela. Nunca as lojas Arena Barber e Externa, nem contas de clientes reais. A conta Google do vídeo é de teste, sem agenda nem contatos reais.
8. **Login do app:** não conclua "Continue with Google" (Continuar com Google) com nenhuma conta Google na tela de login do app. Uma conta Google nova cria cadastro novo no app. O passo 2.3 só abre a tela do Google e fecha a aba.
9. **Pare e relate** diante de qualquer diferença do esperado, com print. Não tente consertar por conta própria.
10. **Código e servidor:** nada de código, banco, servidor, Coolify, DNS, Cloudflare nem painel da Hostinger. Se você tiver o repositório, não faça commit nem push: enviar ao `origin` publica o site.

## O que você precisa ter em mãos

| Item                                                                                          | Onde está                                                                | Observação                                                                                                                                 |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Conta Google com papel Owner ou Editor no projeto `proh-media-drive`                          | Com o dono; é a mesma do pacote A                                        | Sem senha neste texto                                                                                                                      |
| Caixa de e-mail do **Developer contact information** do projeto                               | Com o dono                                                               | É onde chegou a reprovação de 03/10/2026; a resposta vai no mesmo fio                                                                      |
| Relatório do pacote A (P-69) e a decisão do dono sobre `proh.media` em **Authorized domains** | Com o dono                                                               | Usados nos passos 2 e 3                                                                                                                    |
| Conta Google **de teste** para o consentimento, com idioma em inglês                          | O dono indica qual                                                       | Sem agenda nem contatos reais. Não use a conta dona do projeto se ela tiver dados reais. Se não houver conta de teste, pare e peça ao dono |
| Conta do app: dono da Loja Teste, `dono@loja-teste.invalid`                                   | Senha nas Chaves do macOS do dono, serviço "Barba e Cabelo - Loja Teste" | Para o ensaio, o vídeo e, se o dono aprovar, o revisor do Google                                                                           |
| Conta do app: cliente da Loja Teste, `cliente@loja-teste.invalid`                             | Mesmo serviço das Chaves do macOS                                        | Só para marcar os horários de teste                                                                                                        |
| Computador com Chrome, gravador de tela e microfone (ou edição com legendas em inglês)        | —                                                                        | Tela de pelo menos 1920×1080, para o endereço ficar legível                                                                                |
| Conta do YouTube para publicar o vídeo como **Unlisted**                                      | O dono decide qual                                                       | —                                                                                                                                          |

Dados que não são segredo: projeto `proh-media-drive`, número `1072350331037`; site https://beauty.contheiner.digital; Loja Teste em https://loja-teste.beauty.contheiner.digital.

## Já feito — não refazer

- **Política de privacidade** corrigida em 03/10/2026 e publicada. Conferido no código em 15/10/2026: a versão em inglês tem "4. Google user data", o subtítulo "How we protect Google user data", a frase de Limited Use e "5. Security and protection of sensitive data". A página no ar não foi aberta nesta preparação; o passo 4 confere. Não editar.
- **No app (03/10/2026):** os eventos importados aparecem no cartão do Google; **Disconnect Google** revoga o acesso no Google e apaga tokens e eventos importados; os tokens não são lidos pela API pública. A função foi publicada de novo em 13/10/2026 (15:13 e 18:10) e passou a limpar também a fila de cópias ao desconectar. **Com conta Google real, nada disso foi testado:** por isso o passo 6 é um ensaio completo antes de gravar.
- **Textos do cartão em inglês:** conferidos no código em 15/10/2026. São os nomes usados no roteiro. A tela não foi aberta nesta preparação.
- **Escopos do app** (código, 15/10/2026): `openid`, `email`, `profile`, `https://www.googleapis.com/auth/calendar` e `https://www.googleapis.com/auth/contacts`. São os mesmos do pedido reprovado. Não mudar.
- **Aprovado pelo Google em 03/10/2026:** página inicial, marca (branding) e escopos mínimos. Não mexer.
- **Google Calendar API e People API** já estão ativadas no `proh-media-drive` (03/10/2026). Não mexer.
- **Login com Google:** voltou a funcionar em 30/09/2026 pelo retorno `https://supabasebeauty.contheiner.digital/auth/v1/callback` (último teste registrado; o pacote A testa de novo). Conferido em 13/10/2026, só lendo: o retorno antigo `supabase-teste` já não existe no servidor nem no código. A configuração do Auth não foi mudada nesse dia; o login usa `supabasebeauty` desde 30/09. Se o retorno antigo ainda existir, está só no cliente OAuth do console, e isso é o pacote A.
- **Loja Teste** e contas `@loja-teste.invalid` criadas em 13/10/2026; a Loja Teste continuava ativa em 15/10/2026. A conta `dono@` também é Contratado na "Loja Teste B" desde um teste de 13/10/2026.
- **P-69 concluída e complemento de domínio recebido em 31/10:** cliente Drive identificado no Flow produção, com conexão registrada e uso recente não conclusivo; responsável e continuidade ainda não confirmados. O outro cliente usa dois retornos em `proh.media`, e os três links da marca **Proh Media**, não verificada, apontam para `https://proh.media`. Propriedade de `contheiner.digital` confirmada pelo TI; propriedade de `proh.media` associada ao IAM não comprovada. Sem análise em andamento, segundo o relato; estado publicado/rascunho não distinguido. Resolver identidade/separação antes deste roteiro. **Demais itens não confirmados:** escopos cadastrados; conta Google de teste pronta; acesso e serviço na Loja Teste (passo 5); troca por **My areas** (P-40; passo 5.3); campos e textos atuais do formulário de reenvio (passo 9).

## Onde fica cada coisa no console

| O quê                                            | Caminho novo (Google Auth Platform) | Caminho antigo                                                                                            |
| ------------------------------------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Status da verificação e reenvio                  | **Verification Center**             | **OAuth consent screen** → "Prepare for verification" ou "Submit for verification"                        |
| Nome, logo, links, domínios autorizados, e-mails | **Branding**                        | **OAuth consent screen** → App information, App domain, Authorized domains, Developer contact information |
| Status de publicação e tipo de usuário           | **Audience**                        | **OAuth consent screen** → Publishing status, User type                                                   |
| Cliente OAuth e endereços de retorno             | **Clients**                         | **Credentials** → OAuth 2.0 Client IDs                                                                    |
| Escopos                                          | **Data Access**                     | **OAuth consent screen** → Scopes                                                                         |

Para chegar: menu ☰ → **APIs & Services** → **OAuth consent screen** (hoje abre a Google Auth Platform), ou procure "Google Auth Platform" na busca do console. Atalhos, que devem abrir com o projeto escolhido; se algum não abrir, use o menu:

- https://console.cloud.google.com/auth/overview?project=proh-media-drive
- https://console.cloud.google.com/auth/clients?project=proh-media-drive
- https://console.cloud.google.com/auth/branding?project=proh-media-drive

Com o console em português, os nomes vêm traduzidos. Se não achar a tela, confira o projeto no seletor do topo e procure o cliente pelos endereços do passo 2.

## Passo a passo

Prints: nomeie com o passo, por exemplo `p28-03-branding.png`. Eles são a cópia de segurança desta tarefa e vão no relatório. Antes do passo 9, não clique em **Save**, **Edit**, **Publish app**, **Delete**, **Add** nem **Submit** em tela nenhuma do console.

### Passo 0 — Lugar certo: conta e projeto (só leitura)

**Onde:** https://console.cloud.google.com/home/dashboard?project=proh-media-drive

1. Entre com a conta Google que administra o projeto.
2. No seletor de projeto do topo, escolha o de ID `proh-media-drive`.
3. No painel (**Dashboard** ou **Welcome**), veja o cartão **Project info**. Tire um print.

**Esperado:** **Project ID** `proh-media-drive` e **Project number** `1072350331037`. O nome exibido pode ser outro; valem o ID e o número.

**Se vier diferente:** a conta não enxerga o projeto ou o número não bate → pare e relate.

### Passo 1 — Diagnóstico: o reenvio já foi feito? (só leitura)

**Onde:** **Google Auth Platform** → **Verification Center**. Caminho antigo: **APIs & Services** → **OAuth consent screen**, quadro da verificação.

Leia o status sem clicar em botão nenhum. Tire um print.

**Esperado** (o texto exato não foi confirmado): o pedido anterior aparece reprovado ou pedindo ação, com data por volta de 03/10/2026. A marca pode aparecer como verificada.

**Se vier diferente:**

- Análise em andamento ("In review", "Pending", "Submitted" ou parecido) com data depois de 03/10/2026 → alguém já reenviou. Não reenvie. Faça só os passos 3 e 4, que são só leitura, e relate.
- Verificado ou aprovado para Calendar e Contacts → não há o que reenviar. Relate.
- Qualquer outra coisa → pare e relate com o print.

### Passo 2 — Pré-requisito: a P-69 (pacote A) está feita

O pacote A tira do cliente OAuth o retorno antigo `https://supabase-teste.proh.media/auth/v1/callback`. Desde 29/09/2026 esse endereço leva a um serviço de outro projeto. O pacote A vem antes deste por dois motivos: o revisor do Google vê o cliente e os domínios do projeto, e um retorno que aponta para outro sistema confunde a análise; e a decisão sobre o domínio `proh.media` sai do relatório dele.

**2.1 — Relatório do pacote A** (peça ao dono).

**Esperado:** "Caso A" com **Save** feito, ou "Caso B" (já estava feito); no teste "Entrar com Google", "Voltou ao app com a conta aberta: sim"; "Desfazer: não foi preciso". Anote também se `proh.media` está em **Authorized domains** e a decisão do dono sobre ele (manter ou retirar).

**Se vier diferente:** sem relatório, "Caso C", desfazer feito ou login com erro → pare. A P-28 espera o pacote A terminar.

**2.2 — Conferência no console** (só leitura).

**Onde:** **Google Auth Platform** → **Clients** (antigo: **APIs & Services** → **Credentials** → **OAuth 2.0 Client IDs**). Abra o cliente do tipo **Web application** que tem `https://beauty.contheiner.digital/auth/google-apps` em **Authorized redirect URIs**. Não clique em **Save**.

**Esperado em Authorized redirect URIs:**

| Endereço                                                     | Deve estar                   |
| ------------------------------------------------------------ | ---------------------------- |
| `https://supabasebeauty.contheiner.digital/auth/v1/callback` | presente (login com Google)  |
| `https://beauty.contheiner.digital/auth/google-apps`         | presente (Agenda e Contatos) |
| `https://supabase-teste.proh.media/auth/v1/callback`         | **ausente**                  |

Outras linhas (por exemplo `localhost`) podem existir: anote e não mexa. Tire um print só da área dos endereços, sem o **Client ID** e sem **Client secrets**. Deixe esta página aberta numa aba: o **Client ID** dela é comparado com o da tela do Google no passo 6.

**Se vier diferente:**

- `supabase-teste.proh.media` ainda na lista → a P-69 não foi feita, ou foi desfeita. Pare. Não apague a linha por este documento: o pacote A tem a cópia de segurança, a conferência e o modo de desfazer.
- Falta uma das duas linhas que devem estar → pare e relate: o login ou a Agenda quebrariam.

**2.3 — Conferência na tela de login do app** (sem criar conta).

**Onde:** janela anônima nova do Chrome, sem nenhuma conta Google conectada nela.

1. Abra https://beauty.contheiner.digital/auth e clique em **Continue with Google** (em português, **Continuar com Google**).
2. Na página do Google, leia o texto "to continue to …" (ou "para continuar…").
3. Feche a janela sem digitar e-mail nem escolher conta.

**Esperado:** o texto cita "Barba & Cabelo" ou `supabasebeauty.contheiner.digital`.

**Se vier diferente:** cita `supabase-teste.proh.media`, ou aparece página de erro do Google → pare e relate com print.

### Passo 3 — Diagnóstico da configuração e cópia de segurança (só leitura)

Para cada tela, tire o print antes de qualquer outra coisa.

**3.1 — Audience** (antigo: **OAuth consent screen** → Publishing status e User type).

**Esperado:** "Publishing status: **In production**" e "User type: **External**".

**Se vier diferente:** "Testing" ou outra coisa → pare e relate. Não clique em **Publish app** sem o dono.

**3.2 — Branding** (antigo: **OAuth consent screen** → App information e App domain).

| Campo                             | Esperado                                                  |
| --------------------------------- | --------------------------------------------------------- |
| App name                          | `Barba & Cabelo`                                          |
| User support email                | preenchido                                                |
| App logo                          | presente, a mesma marca do site                           |
| Application home page             | `https://beauty.contheiner.digital`                       |
| Application privacy policy link   | `https://beauty.contheiner.digital/privacidade`           |
| Application Terms of Service link | `https://beauty.contheiner.digital/termos`                |
| Developer contact information     | preenchido (é o e-mail que recebe as respostas do Google) |

**Se vier diferente:** pare e relate. Não corrija: a marca já foi aprovada, e mudar reabre a análise dela.

**3.3 — Authorized domains** (na mesma tela).

| O que aparece                                   | O que fazer                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| só `contheiner.digital`                         | Siga                                                                                                                                                                                                                                                                                                                                                                                                    |
| `contheiner.digital` e `proh.media`             | Siga a decisão do dono (passo 2.1). **Manter:** siga e, no passo 3.5, anote se `proh.media` aparece verificado. **Retirar:** a retirada é uma mudança à parte, que o dono combina; enquanto o domínio estiver na lista, pare antes do passo 9. **Sem decisão:** pode ir até o passo 8 (vídeo publicado), mas pare antes do passo 9 e pergunte ao dono. Em nenhum caso apague domínio por este documento |
| falta `contheiner.digital`, ou há outro domínio | Pare e relate                                                                                                                                                                                                                                                                                                                                                                                           |

**3.4 — Data Access** (antigo: **OAuth consent screen** → Scopes).

**Esperado, exatamente:**

- **Your non-sensitive scopes:** `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`
- **Your sensitive scopes:** `.../auth/calendar` e `.../auth/contacts`
- **Your restricted scopes:** nenhum

**Se vier diferente:** escopo a mais ou a menos → pare e relate. Não acrescente nem retire escopos: "escopos mínimos" foi aprovado em 03/10/2026, e o projeto pode atender outro sistema do dono.

**3.5 — Search Console.**

**Onde:** https://search.google.com/search-console, com a mesma conta. Abra a lista de propriedades e, na propriedade, **Settings** → **Users and permissions**.

**Esperado:** aparece `contheiner.digital` (propriedade de domínio) ou `https://beauty.contheiner.digital/`, e esta conta é **Owner**. O Google pede que os domínios autorizados estejam verificados por um Owner ou Editor do projeto. Se `proh.media` ficou na lista (3.3), anote se ele também aparece verificado.

**Se vier diferente:**

- A propriedade de `contheiner.digital` não aparece para esta conta, ou a conta não é Owner → anote e siga até o passo 8, mas pare antes do passo 9 e pergunte ao dono. A marca foi aprovada em 03/10/2026, então o domínio deve estar verificado por outra conta do projeto; só o dono confirma.
- `proh.media` ficou em **Authorized domains** (o dono decidiu manter) e não aparece verificado para esta conta → mesmo caso: anote, siga até o passo 8 e pare antes do passo 9. Só o dono confirma se outra conta Owner ou Editor do projeto verificou esse domínio.
- Verificar domínio exige registro no DNS e não é desta tarefa.

**3.6 — E-mail da reprovação.**

Na caixa do **Developer contact information**, ache o e-mail do Google sobre a reprovação, por volta de 03/10/2026. Em geral o assunto cita o projeto. Anote assunto e data.

**Esperado:** o e-mail existe, e não há e-mail mais novo do Google pedindo outra coisa.

**Se vier diferente:** e-mail mais novo com outro pedido → pare e relate o pedido, sem dados pessoais. E-mail não encontrado → relate e siga; no passo 9 o dono decide onde responder.

**Esperado ao fim do passo 3:** de 6 a 9 prints guardados e nenhuma mudança feita.

### Passo 4 — Site: páginas públicas em inglês (só leitura)

**Onde:** janela anônima, sem login no app.

1. Abra https://beauty.contheiner.digital. No botão de idioma do topo (ícone 文A), escolha **English (US)**.
   **Esperado:** a página inicial abre sem login, em inglês, e o rodapé mostra **Privacy Policy** e **Terms of Use**.
2. Abra https://beauty.contheiner.digital/privacidade?lang=en#dados-google.
   **Esperado:** página em inglês, na seção "4. Google user data", com o subtítulo "How we protect Google user data" e a frase "Barba & Cabelo's use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements." Mais abaixo, "5. Security and protection of sensitive data".
3. Abra https://beauty.contheiner.digital/termos?lang=en.
   **Esperado:** termos em inglês.

Detalhe conhecido, sem efeito na análise: o título da aba do navegador pode continuar em português.

**Se vier diferente:** pare e relate com print. Corrigir página é código, não é desta tarefa.

### Passo 5 — Preparar contas, navegador e dados de teste

**5.1 — Navegador.** Chrome no computador. Clique com o botão direito na barra de endereço e marque **Always show full URLs**. Abra uma janela anônima nova para o ensaio e a gravação; nela, entre no Google só com a conta Google de teste.

**5.2 — Conta Google de teste.**

- Primeiro, dados reais: abra o Google Calendar e https://contacts.google.com e confira que a conta não tem agenda nem contatos reais. Só siga se não tiver.
- Idioma: https://myaccount.google.com/language → **English (United States)**.
- Fuso da Agenda: Google Calendar → **Settings** → **General** → **Time zone** → (GMT-03:00) Brasília ou São Paulo, o mesmo fuso da Loja Teste. Assim o horário é igual no app e no Google.
- Acessos antigos: abra https://myaccount.google.com/permissions. Se "Barba & Cabelo" aparecer, não remova ainda. Pergunte ao dono se esta conta Google está conectada à Agenda de alguma loja real (Arena Barber, Externa) ou de outra conta do app. Se estiver, pare e peça outra conta de teste: remover o acesso aqui, e o **Disconnect Google** do 6.10, que revoga no Google, cortam também essa conexão. Se não estiver, abra e remova o acesso; assim a tela de consentimento aparece completa.
- Eventos: crie 2 ou 3 eventos de teste no calendário principal, em inglês e nos próximos dias. Exemplos: "Supplier meeting" amanhã, das 10:00 às 10:30; "Dentist appointment" daqui a 3 dias, das 15:00 às 16:00.

**Esperado:** conta em inglês, sem agenda nem contatos reais, sem acesso do Barba & Cabelo, com 2 ou 3 eventos de teste.

**Se vier diferente:**

- A conta tem agenda ou contatos reais → pare e peça outra conta ao dono.
- "Barba & Cabelo" aparece em permissions e o dono diz que esta conta Google está conectada à Agenda de uma loja real (Arena Barber, Externa) ou de outra conta do app, ou não sabe dizer → não remova o acesso. Pare e peça outra conta de teste.

**5.3 — App, conta do dono da Loja Teste.** Na janela anônima, em https://beauty.contheiner.digital/auth, deixe o idioma em **English (US)** e entre com `dono@loja-teste.invalid` e a senha das Chaves do macOS. Ainda como dono:

1. Abra **Team** e anote o nome do profissional do dono. Nos registros de 13/10 ele aparece como "Dono"; a conta foi criada como "Dono Teste".
2. Mesmo que a Loja Teste abra direto, abra o menu da conta, seção **My areas**, e confira que aparecem Loja Teste e Loja Teste B. Clique na Loja Teste B ("Opening Loja Teste B…"). Se aparecer "You're now … at Loja Teste B", clique em **Get started** e não mude nada nessa loja. Pelo mesmo menu, volte para a Loja Teste. Anote no relatório.

**Esperado:** abre o painel da "Loja Teste", com os menus **Schedule**, **Services**, **Team**, **Hours** e **Settings**. Em **Services**, há pelo menos 1 serviço ativo feito pelo dono. Em **My areas** aparecem as duas lojas, e a volta abre de novo o painel da Loja Teste.

**Se vier diferente:**

- Abriu outra loja (a conta também está na "Loja Teste B") → use **My areas** e escolha a Loja Teste. Anote: entra no texto do revisor (passo 9).
- **My areas** não mostra as duas lojas, ou a troca não funciona → anote no relatório. Se o painel aberto é o da Loja Teste, siga com o ensaio e a gravação, mas pare antes do passo 9 e peça ao dono outra conta para o revisor. Se não é, pare e relate.
- Apareceu janela de aceite dos termos → aceite (é conta de teste) e anote.
- Não há serviço → cadastre um, só na Loja Teste (por exemplo "Haircut", 30 minutos, feito pelo dono).
- A senha não entra, ou o app pede código → pare e relate.

**5.4 — Horário A, para o ensaio.** Em outro navegador, ou numa janela normal (não a anônima), abra https://loja-teste.beauty.contheiner.digital/auth e entre com `cliente@loja-teste.invalid`. Na aba **Agendar** (Book), escolha exatamente o profissional do dono anotado no 5.3, nunca **Qualquer profissional** (Any professional), que pode já vir marcado. Escolha um serviço dele (em 13/10 havia "Corte", 30 min). Marque para amanhã ou para o próximo dia com horário livre; em 13/10, a Loja Teste pedia 2 h de antecedência. Depois, saia da conta.

**Esperado:** horário marcado com o profissional do dono.

**Se vier diferente:** a conta não entra, ou não há horário livre com o profissional do dono nos próximos dias → pare e relate.

### Passo 6 — Ensaio completo, sem gravar

**Por quê:** a lista de eventos, a cópia de horários e a desconexão com revogação nunca foram testadas com conta Google real. Só grave depois que tudo funcionar uma vez.

**Onde:** a janela anônima do passo 5, com o dono da Loja Teste no painel e o app em inglês.

| #    | Ação                                                                                                                                                        | Esperado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1  | **Settings** → **Notifications and integrations** → cartão **Google Calendar and Contacts** → **Connect Google**                                            | Janela do app "Before connecting Google Calendar", com os passos. Clique em **I understand — connect**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 6.2  | Na página do Google, antes de escolher a conta, clique na barra de endereço e veja se aparece `client_id=` (anote). Depois, escolha a conta de teste        | Pode aparecer "Google hasn't verified this app": confira a barra do mesmo jeito e anote; depois clique em **Advanced** e em **Go to … (unsafe)**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 6.3  | Tela de consentimento                                                                                                                                       | Nome "Barba & Cabelo" e dois acessos com caixa de marcar: Google Calendar (algo como "See, edit, share, and permanently delete all the calendars you can access using Google Calendar") e Google Contacts ("See, edit, download, and permanently delete your contacts"). Clique na barra de endereço e use a tecla End ou as setas até aparecer `client_id=`; o valor é igual ao **Client ID** da aba do passo 2.2 (em geral começa com `1072350331037-`). Anote em que página o `client_id=` aparece (escolha de conta, aviso ou consentimento): a cena 4 do vídeo o mostra nessa página. Marque as duas caixas → **Continue** |
| 6.4  | Volta ao app                                                                                                                                                | Página de retorno e, em poucos segundos, o cartão com **Connected** e o e-mail da conta de teste                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 6.5  | **Which calendar should sync?** → escolha o calendário principal                                                                                            | "Calendar selected: …"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 6.6  | Bloco **From Google to here** → **Sync calendar**                                                                                                           | "N events imported from “…”" e, logo abaixo, os eventos de teste por dia, com horário                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 6.7  | Bloco **From here to Google** → **Only my appointments**                                                                                                    | "Done. Future times will start showing in Google Calendar in about a minute." Em 1 a 2 minutos, o horário A aparece no Google Calendar com o título "serviço · cliente" (recarregue a página). O título sai em português, por exemplo "Corte · Cliente Teste", com "(a confirmar)" no fim se o horário estiver pendente. Isso é o esperado; não renomeie o serviço                                                                                                                                                                                                                                                              |
| 6.8  | **Schedule** → dia do horário A → menu **⋯** → **Cancel appointment** → confirme em **Cancel appointment**                                                  | Em 1 a 2 minutos, o evento some do Google Calendar (recarregue)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 6.9  | No cartão, **Save to Google Contacts**: Name `Demo Customer`, Phone `+1 202-555-0143` (número inventado, de faixa reservada para ficção) → **Save contact** | "Contact saved to Google Contacts." e o contato aparece em contacts.google.com                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 6.10 | **From here to Google** → **Don't copy**. Depois, **⋯** (More Google options) → **Disconnect Google** → **Disconnect and delete imports**                   | "Google disconnected. The app's access to your Google Account was revoked and imported data was deleted."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 6.11 | https://myaccount.google.com/permissions                                                                                                                    | Barba & Cabelo não aparece                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

**Se vier diferente:** em qualquer linha, pare, tire print da mensagem exata e relate. Não grave. Atenção à 6.10: se a mensagem disser "We couldn't confirm the revocation with Google", a revogação falhou; pare. Se o nome na tela de consentimento não for "Barba & Cabelo", ou o `client_id` não for igual ao do console, pare. Se o `client_id=` não aparecer em nenhuma página do fluxo (6.2 e 6.3), pare e não grave.

**Depois do ensaio:**

- apague o contato "Demo Customer" em contacts.google.com;
- deixe os eventos de teste, que servem para a gravação;
- no app, saia da conta do dono (menu da conta → **Sign out**).

### Passo 7 — Gravar o vídeo

**Antes de gravar:**

1. **Horário B:** repita o passo 5.4 (o cliente marca outro horário com o mesmo profissional do dono, amanhã ou no próximo dia com horário livre). Entre como dono na janela anônima. Se o horário aparecer pendente em **Schedule**, clique em **Confirm** no cartão dele; assim o título no Google não leva "(a confirmar)". Depois, saia da conta do dono.
2. Confira https://myaccount.google.com/permissions: Barba & Cabelo não aparece.
3. Na janela anônima, deixe abertas duas abas do Google com a conta de teste: Google Calendar, no dia do horário B, e Google Contacts.
4. App em **English (US)**, sem login. Feche notificações, outras janelas e qualquer coisa com dados pessoais. Gerenciador de senhas fora da tela.
5. Gravador pronto. No Mac: Cmd+Shift+5 → **Record Entire Screen**, ou QuickTime Player → **File** → **New Screen Recording**. Microfone, se for narrar.

**Cenas** (a coluna da direita é a narração, ou a legenda em inglês):

| #   | Na tela                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Narração ou legenda                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | https://beauty.contheiner.digital sem login, em inglês. Role até o rodapé (**Privacy Policy** e **Terms of Use**). Clique em **Privacy Policy**, vá à seção "4. Google user data", pare em "How we protect Google user data" e na frase de Limited Use. Mostre o título da seção 5                                                                                                                                                                                                                                                                                           | "This is Barba & Cabelo, a booking app for barbershops, at beauty.contheiner.digital. The privacy policy and the terms of use are linked on the home page. Section 4 of the privacy policy explains how we use and protect Google Calendar and Google Contacts data, and includes the Limited Use disclosure."                             |
| 2   | https://beauty.contheiner.digital/auth. Mostre o botão **Continue with Google**, sem clicar. Pause a gravação, entre com e-mail e senha do dono da Loja Teste e retome com o painel da Loja Teste aberto (se abrir outra loja, troque em **My areas** antes de retomar)                                                                                                                                                                                                                                                                                                      | "Shop owners sign in here. Signing in with Google is optional and only requests basic profile information: name, email address and profile picture. For this demo we use a demo shop owner account."                                                                                                                                       |
| 3   | Painel → **Settings** → **Notifications and integrations** → cartão **Google Calendar and Contacts**. Mostre os três benefícios. Clique em **Connect Google**, mostre a janela "Before connecting Google Calendar" e clique em **I understand — connect**                                                                                                                                                                                                                                                                                                                    | "Google Calendar and Contacts are optional. The owner opens Settings, then Notifications and integrations, and chooses Connect Google. The app first explains what happens next."                                                                                                                                                          |
| 4   | Mostre o `client_id=` na página em que ele apareceu no ensaio (6.3): clique na barra de endereço, leve o cursor até `client_id=` e segure de 3 a 5 segundos; se puder, aproxime com a lupa do sistema. Se foi na escolha de conta ou no aviso, mostre ali, antes de seguir, sem cortar. Na escolha de conta, escolha a conta de teste. Se aparecer "Google hasn't verified this app", mostre, clique em **Advanced** e em **Go to … (unsafe)**, sem cortar. Na tela de consentimento, mostre o nome "Barba & Cabelo" e os dois acessos. Marque as duas caixas → **Continue** | "This is Google's OAuth consent screen. It shows the app name, Barba & Cabelo, and the client ID in the address bar. The app requests access to Google Calendar and Google Contacts, and the owner allows both." Se o aviso aparecer: "Google shows this warning while the verification is pending. The owner continues through Advanced." |
| 5   | Volta ao app: **Connected** com o e-mail de teste. Em **Which calendar should sync?**, escolha o calendário                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | "Calendar scope, read: the app lists the user's calendars so the owner can choose which one to use. Nothing is selected automatically."                                                                                                                                                                                                    |
| 6   | **From Google to here** → **Sync calendar** → mensagem "… events imported from …". Role e mostre os eventos. Troque para a aba do Google Calendar e mostre os mesmos eventos                                                                                                                                                                                                                                                                                                                                                                                                 | "Calendar scope, read: the app imports events from the chosen calendar, from 7 days ago to 60 days ahead, and shows them here, so the owner can see busy times while managing bookings. We store only the title, the start and end times, the calendar and the event link, and only this user can see them."                               |
| 7   | **From here to Google** → **Only my appointments** → mensagem "Done…". Pause enquanto espera cerca de 1 minuto e retome antes de recarregar o Google Calendar: mostre o horário B como evento "serviço · cliente". Volte ao app → **Schedule** → horário B → **⋯** → **Cancel appointment** → confirme. Pause de novo, retome e recarregue o Google Calendar: o evento sumiu                                                                                                                                                                                                 | "Calendar scope, write: with Only my appointments, each booking made in the app is copied to the chosen Google Calendar within about a minute. When a booking is cancelled, the event is removed."                                                                                                                                         |
| 8   | **Save to Google Contacts**: Name `Demo Customer`, Phone `+1 202-555-0143` → **Save contact** → "Contact saved to Google Contacts." Na aba do Google Contacts, recarregue e mostre o contato                                                                                                                                                                                                                                                                                                                                                                                 | "Contacts scope: the owner can save a customer's name, phone and email to Google Contacts. The app only creates the contacts the owner chooses to save. It does not read or list existing contacts."                                                                                                                                       |
| 9   | **From here to Google** → **Don't copy**. **⋯** → **Disconnect Google** → janela "Disconnect the Google account?" → **Disconnect and delete imports** → mensagem de revogação. Abra https://myaccount.google.com/permissions e mostre que Barba & Cabelo não está na lista                                                                                                                                                                                                                                                                                                   | "The owner can stop copying and disconnect at any time. Disconnecting revokes the app's access with Google and deletes the stored Google tokens and imported events from our servers. The app no longer appears in the Google Account's third-party connections."                                                                          |
| 10  | Volte à política, seção 4, e encerre                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | "Google user data is used only to provide these features. It is never sold and is not used for advertising."                                                                                                                                                                                                                               |

**Cuidados:**

- Sem cortes da cena 3 até a volta ao app na cena 5: o consentimento não pode parecer editado. Pausas valem só no login (cena 2) e nas esperas da cena 7.
- Tudo em inglês: app, páginas do Google e narração ou legendas. Exceção esperada: o título do evento copiado sai em português (veja o 6.7).
- Nunca na tela: senha, **Client secret**, console do Google Cloud, dados reais.
- Duração sugerida: de 3 a 5 minutos. É uma sugestão do guia do projeto, não regra do Google.
- Se precisar regravar depois de conectar: desconecte pelo app (cena 9), confira myaccount.google.com/permissions, recrie o horário B se ele foi cancelado e grave de novo desde a cena 1.

**Depois de gravar:** assista ao vídeo inteiro. Confira que o `client_id` está legível, que nenhuma senha ou dado real aparece e que as cenas 3 a 5 estão sem corte. Apague o contato "Demo Customer" em contacts.google.com.

**Esperado:** um arquivo de vídeo de 3 a 5 minutos, em inglês, com as 10 cenas.

### Passo 8 — Publicar no YouTube como não listado

1. Envie o vídeo. Título: `Barba & Cabelo – Google OAuth verification demo (Google Calendar and Google Contacts)`. Descrição curta, sem dados pessoais: `Demo of the OAuth consent flow and of how Barba & Cabelo (https://beauty.contheiner.digital) uses the Google Calendar and Google Contacts scopes.`
2. **Audience:** "No, it's not made for kids".
3. **Visibility:** **Unlisted** (Não listado). Nunca **Private**: o revisor não conseguiria assistir.
4. Espere o YouTube terminar o processamento em alta definição.

**Esperado:** um link `https://youtu.be/…` que abre numa janela anônima, sem login, e toca o vídeo inteiro; em 1080p, o `client_id` fica legível.

**Se vier diferente:** o vídeo não abre sem login, ou o `client_id` fica ilegível → corrija a visibilidade ou espere o processamento em alta definição. Não envie o link ao Google antes disso.

### Passo 9 — Reenviar o pedido (muda o pedido de verificação)

**Antes:** pare aqui e fale com o dono se:

- o passo 3.3 terminou em "sem decisão" ou "retirar" sobre `proh.media`;
- o passo 3.5 não achou verificado, por uma conta Owner ou Editor do projeto, cada domínio que ficou em **Authorized domains**: `contheiner.digital` e, se o dono decidiu manter, `proh.media`;
- a troca por **My areas** falhou no passo 5.3 (o dono indica outra conta para o revisor).

**Onde:** **Google Auth Platform** → **Verification Center**. Caminho antigo: **OAuth consent screen** → "Prepare for verification" ou "Submit for verification".

1. Clique no botão de reenvio que a tela mostrar. O nome não foi confirmado: pode ser "Prepare for verification", "Submit for verification" ou "Resubmit". Se não houver botão e a tela mandar responder ao e-mail do Google, pare antes de responder e chame o dono. Sem formulário, as credenciais do revisor não chegam ao Google. O dono decide como entregá-las (ele mesmo, no fio do e-mail; o texto "Acesso do revisor", abaixo, serve de base). Nesse caso, pule os itens 2 a 6 e, no item 7, troque o item 3 da "Resposta ao Google" pelo texto "Item 3 — caminho só e-mail", logo abaixo dela.
2. Siga as etapas. Em cada uma, confira que os dados batem com os prints do passo 3. Não mude Branding, domínios, escopos nem cliente.
3. Onde pedir a justificativa dos escopos sensíveis, cole os textos abaixo, um por escopo. Se houver um campo só para todos, cole os dois, um depois do outro. Se o campo já tiver um texto antigo, copie esse texto para o relatório antes de trocar: é o backup.
4. Onde pedir o vídeo ("Demo video", "YouTube link" ou parecido), cole o link do passo 8. Se já houver um link antigo, anote-o no relatório antes de trocar.
5. Onde houver campo para o revisor ("Test account", "Additional information", "Notes" ou parecido), cole o texto "Acesso do revisor". O dono decide qual conta vai e digita o e-mail e a senha direto nesse campo. O texto foi escrito para o dono da Loja Teste; se o dono escolher outra conta, ajuste o nome da loja. Tire um print do formulário preenchido sem a senha à vista.
6. Se aparecer pergunta que este documento não responde, pare e relate a pergunta exata. Se não, clique em **Submit** (ou equivalente).
7. Responda no **mesmo fio** do e-mail da reprovação (passo 3.6) com o texto "Resposta ao Google", trocando `[VIDEO LINK]` pelo link. No caminho só e-mail (item 1), envie só depois da decisão do dono e troque o item 3 pelo texto "Item 3 — caminho só e-mail". Não ponha credenciais no e-mail; se o Google pedir, quem responde é o dono.

**Esperado:** mensagem de confirmação no console e status como "In review" ou "Verification in progress" (texto exato não confirmado). Tire um print. No caminho só e-mail, o esperado é a resposta enviada no fio; o status no console pode não mudar (não confirmado).

**Se vier diferente:** erro ao enviar → copie o texto exato, não tente de novo e relate.

**Justificativa do escopo `https://www.googleapis.com/auth/calendar`:**

```text
Barba & Cabelo is an appointment booking app for barbershops. Shop owners and professionals can optionally connect a Google account to (1) list their calendars and choose one, (2) import events from the chosen calendar (7 days back to 60 days ahead) so they can see busy times while managing bookings, and (3) automatically create, update and delete events in that calendar for each appointment booked, rescheduled or cancelled in the app. Reading the calendar list is required for the user to choose the calendar; reading events is required for the import; writing events is required for the booking copy. A read-only scope would not allow creating events, and an events-only scope would not allow listing the user's calendars for selection. Data is used only for these user-facing features.
```

**Justificativa do escopo `https://www.googleapis.com/auth/contacts`:**

```text
The shop owner can save a customer's name, phone number and email to their own Google Contacts with the "Save to Google Contacts" button, so they can reach the customer from their phone. The app calls people.createContact only when the user explicitly taps the button. The People API createContact method requires the contacts scope; there is no write-only alternative. The app does not read, list or export the user's existing contacts.
```

**Se pedirem justificativa de `openid`, `email` e `profile`:**

```text
Used for "Sign in with Google" and to show which Google account is connected to Calendar/Contacts in the settings screen.
```

**Acesso do revisor** (campo do formulário; o dono completa e-mail e senha ali mesmo):

```text
Test account (demo barbershop owner)
- Sign in at https://beauty.contheiner.digital/auth with the email and password below. Please do not use "Continue with Google" for this account.
- Email: (typed here by the app owner)
- Password: (typed here by the app owner)
- The app opens in Portuguese. On the sign-in page, use the language button at the top and choose "English (US)".
- After signing in, the dashboard of the demo shop "Loja Teste" opens. If another shop opens, use "My areas" and choose "Loja Teste".
- Go to Settings → Notifications and integrations → Google Calendar and Contacts → Connect Google, and use your own Google account to grant access.
- If the app asks you to accept the Terms of Use, please accept them to continue.
```

**Resposta ao Google** (no mesmo fio do e-mail):

```text
Hello Google Trust & Safety team,

Thank you for the review. We have addressed the issues raised:

1. Privacy policy: https://beauty.contheiner.digital/privacidade (English: https://beauty.contheiner.digital/privacidade?lang=en#dados-google) now describes which Google user data we access per scope (calendar list, calendar events, contacts created by the user, basic profile), how it is used, stored, retained and deleted, that it is not sold, not used for advertising or to train generalized AI/ML models, not read by humans except under the Limited Use exceptions, and how users can revoke access. The subsection "How we protect Google user data" and section 5 "Security and protection of sensitive data" list the protection mechanisms in place (TLS in transit, OAuth tokens kept only on the server and unreadable through the public API, row-level security, data minimization, secrets in protected server variables, admin panel on a private network, token revocation on disconnect). It includes the Limited Use disclosure, is linked on the home page and matches the URL configured on the OAuth consent screen.

2. App functionality: we uploaded a new demo video (unlisted YouTube link: [VIDEO LINK]) showing the full OAuth flow in English, with the app name and the client ID in the address bar, and each requested scope being used in the app: listing calendars ("Which calendar should sync?"), importing events and showing them in the app ("From Google to here"), copying bookings to Google Calendar and removing them when cancelled ("From here to Google"), saving a contact to Google Contacts ("Save to Google Contacts"), and disconnecting, which revokes the token with Google.

3. Reviewer access: test credentials for a demo shop owner account were provided in the verification form. Sign in at https://beauty.contheiner.digital/auth, switch the language to English (US), then go to Settings → Notifications and integrations → Google Calendar and Contacts.

Please let us know if anything else is needed.

Best regards,
Barba & Cabelo team
```

**Item 3 — caminho só e-mail** (só quando não houve formulário, passo 9, item 1; substitui o item 3 acima):

```text
3. Reviewer access: the app owner will send test credentials for a demo shop owner account in a separate reply. Sign in at https://beauty.contheiner.digital/auth, switch the language to English (US), then go to Settings → Notifications and integrations → Google Calendar and Contacts.
```

### Passo 10 — Conferir e limpar

1. **Verification Center:** print do status depois do envio.
2. **Antes × depois:** abra de novo **Branding**, **Audience**, **Clients** (o cliente do app) e **Data Access**. Compare com os prints do passo 3.
3. **Limpeza:** contato "Demo Customer" apagado; eventos de teste apagados do Google Calendar da conta de teste; horários A e B cancelados na Loja Teste; Barba & Cabelo fora de myaccount.google.com/permissions; saída das contas do app nos dois navegadores.
4. **Não apague:** a Loja Teste, as contas de teste e o vídeo. O revisor do Google vai precisar deles até a decisão.

**Esperado:** pedido em análise; telas iguais às do passo 3; limpeza feita.

**Se vier diferente:** alguma tela mudou → veja "Como desfazer" e relate.

## Como saber que deu certo

- **Verification Center** mostra o pedido enviado em 15/10/2026 ou depois, em análise (print). No caminho só e-mail (passo 9, item 1), vale a resposta enviada no fio, com data e hora; o status no console pode demorar a mudar (não confirmado).
- O link do vídeo abre numa janela anônima sem login, como **Unlisted**, em inglês, e mostra: o nome "Barba & Cabelo" e o `client_id` legível na barra durante o consentimento; a lista de agendas; a importação e os eventos listados; o horário copiado para o Google Calendar e retirado depois do cancelamento; o contato salvo e visto no Google Contacts; a desconexão com a mensagem de revogação e o app fora de myaccount.google.com/permissions.
- **Branding**, **Audience**, **Clients** e **Data Access** estão iguais aos prints do passo 3.
- A resposta foi enviada no mesmo fio do e-mail da reprovação.
- A decisão do Google pode levar dias ou semanas (prazo não confirmado). Quem acompanha é o dono, pelo e-mail.

## Como desfazer

- **Configuração do projeto:** este pacote não muda nada nela. Se algum campo mudou por engano, volte cada um ao valor do print do passo 3, salve e relate. Nunca recrie, apague nem desative o cliente OAuth.
- **Pedido enviado:** não há botão conhecido para desfazer um reenvio (não confirmado). Para corrigir algo enviado errado, responda no mesmo fio do e-mail com a correção, depois de combinar com o dono.
- **Vídeo com algo que não podia aparecer** (senha, dado real, console): troque na hora para **Private** ou apague, grave de novo e relate. Se o link já tinha ido ao Google, avise o dono antes de apagar: o revisor precisa de um link que funcione.
- **Dados de teste:** apague o contato e os eventos de teste, cancele os horários na Loja Teste e remova o acesso do Barba & Cabelo em myaccount.google.com/permissions, se ele ficou.
- Não há nada a desfazer no banco, no servidor nem no site.

## Fora do escopo

- **Pacote A (P-69):** este pacote só confere que ele foi feito; não apaga endereço de retorno.
- **Authorized domains:** não acrescentar nem retirar domínio (`proh.media` inclusive). A decisão é do dono.
- Verificar domínio no Search Console: exige DNS. Se faltar, relatar.
- Criar cliente OAuth ou projeto, trocar de projeto, mudar escopos, mudar a marca, clicar em **Publish app**, mexer em **Test users**, em **Client secrets** ou nas APIs ativadas.
- Código, banco, servidor, Coolify, DNS, Cloudflare e painel da Hostinger.
- Lojas reais (Arena Barber, Externa) e contas de clientes reais.
- Apagar a Loja Teste ou as contas de teste: o revisor do Google vai usá-las até a decisão.
- **Fica com o dono:** escolher a conta do revisor e digitar a senha no formulário (sem formulário, entregar as credenciais ele mesmo no fio do e-mail); decidir sobre `proh.media`; responder a novos e-mails do Google; depois da aprovação, trocar a senha da conta de teste e pedir a troca do aviso do app que fala em verificação "under review"; os testes com contas reais da P-42; registrar o resultado na P-28 (`docs/guia/pendencias.md`) e no `docs/CONTINUIDADE.md`, a partir do relatório.
- **Observação para o dono** (não bloqueia): a política chama a lista de eventos de "Upcoming Google Calendar events", mas no cartão o bloco visível se chama "From Google to here"; aquele nome só existe para leitor de tela. Se o revisor estranhar, o ajuste é de código, num pedido à parte.

## Documentos de apoio (no repositório)

Estes links funcionam com o arquivo em `docs/pacotes/` no repositório. Quem recebe só este texto não precisa deles: o essencial está acima.

- [Pacote A — P-69, retorno antigo do Google](2026-10-15-google-retorno-antigo-p69.md)
- [Guia de reenvio da verificação do Google (03/10/2026)](../google-verificacao.md)
- [Passagem de 15/10/2026, pacotes A e B](../passagem-claude-2026-10-15.md)
- [Pendências P-28 e P-69](../guia/pendencias.md)
- [Banco e implantação, seção 11 (Google)](../guia/banco-e-implantacao.md#11-e-mail-whatsapp-e-google)
- [Loja Teste: contas e limpeza](../testes-reais-loja-teste.md)
- [Regras do projeto (AGENTS.md)](../../AGENTS.md)

## Relatório para devolver

Copie, preencha e devolva ao dono com os prints. Sem senhas, sem **Client secret**, sem Client ID completo e sem valores de `.env`.

```text
RELATÓRIO — P-28, reenvio da verificação do Google (pacote de 15/10/2026)

Quem executou: ____   Quem gravou: ____
Início: __/__/2026 __:__   Fim: __/__/2026 __:__   Fuso: Brasília (UTC−3) | outro: ____

Passo 0 — Project ID: ____   Project number: ____
Passo 1 — status no Verification Center ANTES (texto exato): ____
Passo 2 — relatório do pacote A recebido: sim | não   Caso: A | B | C
- Authorized redirect URIs (lista): ____
- Texto "to continue to ..." no teste do login: ____
- Decisão do dono sobre proh.media: manter | retirar | sem decisão | não se aplica
Passo 3
- Publishing status: ____   User type: ____
- Branding, campo a campo (igual | diferente): ____
- Authorized domains: ____
- Escopos (non-sensitive / sensitive / restricted): ____
- Search Console (cada domínio de Authorized domains: verificado sim | não; papel desta conta): ____
- E-mail da reprovação (assunto e data): ____
- Prints de backup (nomes): ____
Passo 4 — página inicial: ok | não   política: ok | não   termos: ok | não
Passo 5 — conta Google de teste usada: ____   loja aberta ao entrar: Loja Teste | outra: ____
- Barba & Cabelo em permissions antes do ensaio: não aparecia | aparecia e foi removido (dono confirmou que não há conexão real)
- Profissional do dono (Team): ____   My areas: as duas lojas aparecem sim | não; volta para a Loja Teste ok | falhou
Passo 6 — ensaio, linha a linha (ok | falhou + texto exato):
- 6.1 ____  6.2 ____  6.3 ____ (página em que o client_id apareceu: ____)
- 6.4 ____  6.5 ____  6.6 ____  6.7 ____  6.8 ____  6.9 ____  6.10 ____  6.11 ____
Passo 7/8 — link do vídeo (Unlisted): ____   duração: ____
- Minuto em que o client_id aparece: ____   apareceu "Google hasn't verified this app": sim | não
Passo 9
- Caminho usado: formulário | só e-mail
- Texto e link antigos que estavam nos campos (backup): ____
- O que foi colado em cada campo (sem senha): ____
- Data e hora do envio: ____   mensagem exibida: ____
- Resposta no fio do e-mail: data e hora ____
Passo 10 — status DEPOIS: ____   telas iguais às do passo 3: sim | não (qual mudou)
- Limpeza (contato, eventos, horários A e B, permissions): ____
Diferenças do esperado (com print e texto exato): ____
```
