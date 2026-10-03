# Verificação OAuth do Google — guia de reenvio

Guia prático para reenviar a verificação do app **Barba & Cabelo** no Google Cloud (OAuth consent screen → Verification Center), depois da reprovação de 03/10/2026.

| Item da verificação                   | Resultado                                                                                                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Requisitos da página inicial          | Aprovado                                                                                                                                                                             |
| Diretrizes da construção da marca     | Aprovado                                                                                                                                                                             |
| Solicitar escopos mínimos             | Aprovado                                                                                                                                                                             |
| Requisitos da política de privacidade | **Reprovado** — motivo: "não especifica mecanismos de proteção de dados sensíveis". **Corrigido em 03/10/2026** (seção "Política de privacidade" abaixo); falta publicar e reenviar. |
| Funcionalidade do app                 | **Reprovado** (o Google não deu detalhe na tela). Eventos importados agora visíveis no app e desconexão com revogação no Google (03/10/2026); falta publicar e gravar o vídeo novo.  |

**Legenda usada neste guia**

- **[Google]** — consta na documentação pública do Google sobre verificação de escopos sensíveis ou na política de dados das APIs. Antes de reenviar, conferir na fonte, porque o Google muda os textos com frequência: <https://support.google.com/cloud/answer/13464321> (verificação de escopos sensíveis), <https://developers.google.com/terms/api-services-user-data-policy> (política de dados do usuário) e a ajuda do próprio Verification Center.
- **[Dedução]** — conclusão a partir do código deste repositório ou de relatos comuns de reprovação. Não é regra escrita do Google.
- **[Código]** — fato conferido no repositório em 03/10/2026.

---

## 0. O que o app pede ao Google de verdade (conferido no código)

São **dois fluxos** no mesmo Client OAuth:

| Fluxo                             | Onde começa                                                                                                              | Escopos                                                                                                              | Onde fica no código                                                                                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — Entrar com Google** (login) | `/auth`, botão "Continuar com Google"                                                                                    | `openid`, `email`, `profile` (não sensíveis)                                                                         | `src/routes/auth.tsx` → `supabase.auth.signInWithOAuth({ provider: "google" })` (GoTrue)                                                                                                                            |
| **B — Agenda e Contatos**         | Painel da loja → **Ajustes → Avisos** (`/shop?secao=avisos`) → cartão **Google Agenda e Contatos** → **Conectar Google** | `openid`, `email`, `profile`, `https://www.googleapis.com/auth/calendar`, `https://www.googleapis.com/auth/contacts` | `supabase/functions/_shared/google.ts` (`GOOGLE_SCOPES`, `authUrl` com `access_type=offline` e `prompt=select_account consent`), `supabase/functions/google-connect`, retorno em `src/routes/auth_.google-apps.tsx` |

**Uso de cada escopo sensível na interface [Código]:**

| Escopo                        | Chamada à API                                                                                          | O que o usuário vê                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.../auth/calendar` (leitura) | `GET calendar/v3/users/me/calendarList`                                                                | Lista "Qual agenda sincronizar?" — o usuário escolhe uma agenda (nada é escolhido sozinho).                                                                                                                                                                                                                                                                                                                                                                         |
| `.../auth/calendar` (leitura) | `GET calendar/v3/calendars/{id}/events` (7 dias atrás a 60 dias à frente)                              | Botão **Sincronizar agenda** → aviso "N eventos importados de …" e, logo abaixo, a lista **Próximos eventos da Agenda Google** (título, dia, horário no fuso da barbearia e agenda de origem). Ficam na tabela `google_calendar_events` só título, início, fim, dia inteiro, agenda e link (sem descrição, participantes, local nem JSON completo). A lista vem de `list_my_google_calendar_events` e só mostra os eventos da própria pessoa e da agenda escolhida. |
| `.../auth/calendar` (escrita) | `POST/PATCH/DELETE calendar/v3/calendars/{id}/events` (Edge `google-calendar-dispatch`, a cada minuto) | Opção **Copiar agendamentos para esta agenda** (Não copiar / Só os meus / Todos da barbearia). Cada horário marcado no app aparece na Agenda Google com título "Serviço · Cliente"; remarcação e cancelamento atualizam ou retiram o evento.                                                                                                                                                                                                                        |
| `.../auth/contacts` (escrita) | `POST people/v1/people:createContact`                                                                  | Formulário **Salvar no Google Contatos** (nome, telefone, e-mail) → "Contato salvo no Google Contatos".                                                                                                                                                                                                                                                                                                                                                             |

**Desconectar [Código]:** o botão **Desconectar** chama `POST https://oauth2.googleapis.com/revoke` (token de atualização; se faltar ou falhar, o de acesso) e depois apaga do banco o token e os eventos importados (`google_connections` e `google_calendar_events`). Se a revogação der certo, o app mostra "Google desconectado. O acesso do app à sua conta Google foi revogado e os dados importados foram apagados." Se falhar (rede, token já revogado), a desconexão local acontece mesmo assim e o aviso manda remover o acesso em <https://myaccount.google.com/permissions>. Eventos já copiados para a Agenda Google ficam lá.

**Excluir a conta [Código]:** em Meu perfil → Meus dados e privacidade, antes de `delete_my_account` o app pede a mesma desconexão (melhor esforço, até 10 s; só quando há conexão Google e a pessoa não é dono/sócio ativo, porque nesse caso o banco recusa a exclusão). A exclusão apaga `google_connections` e `google_calendar_events` em cascata.

**Tokens [Código]:** desde `20261003190000_google_tokens_e_eventos.sql`, `google_connections` não tem mais leitura para `anon`/`authenticated` (só `service_role`); o app lê o estado por `get_my_google_connection()`, que não devolve tokens.

**Modo demonstração [Código]:** o cartão Google **não aparece** na loja de demonstração (`ShopShell.tsx`, condição `!demo`). O revisor precisa de uma conta real de loja (seção 4).

**Quem vê o cartão [Código]:** dono, sócio (`partner`) e parceiro (`associate`); o funcionário contratado não vê. Cada pessoa conecta a própria conta Google. O cartão tem o link **Como usamos os dados do Google**, que abre `/privacidade#dados-google`.

---

## 1. O que costuma causar reprovação em "Funcionalidade do app"

| Causa provável                                                                                                | Tipo                                                                                                                                   | Como se aplica aqui                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vídeo de demonstração ausente, privado ou incompleto                                                          | **[Google]** o vídeo é exigido para escopos sensíveis e deve mostrar o fluxo de consentimento e o uso de cada escopo                   | Se o vídeo enviado não mostrou Agenda **e** Contatos funcionando, isso basta para reprovar.                                                                                                                    |
| Tela de consentimento do vídeo sem o nome do app, ou fora do inglês                                           | **[Google]** pede o fluxo de autorização "como o usuário vê", com a tela de consentimento em inglês                                    | Gravar com o navegador e a conta Google em inglês.                                                                                                                                                             |
| Client ID não visível na barra de endereço durante o consentimento                                            | **[Google]** pede que o `client_id` apareça na URL da tela de consentimento, para confirmar que o projeto do vídeo é o mesmo do pedido | Na gravação, clicar na barra de endereço e mostrar o `client_id=…` (ampliar a tela).                                                                                                                           |
| Funcionalidade do escopo não demonstrada (só aparece "conectado")                                             | **[Google]** o vídeo deve mostrar como os dados de cada escopo são usados no app                                                       | Mostrar a lista de agendas, a importação, o evento criado na Agenda Google e o contato criado no Google Contatos.                                                                                              |
| Revisor não consegue acessar a área que usa os escopos (login obrigatório, conta sem loja, recurso escondido) | **[Dedução]** muito relatado; o formulário tem campo para instruções/credenciais de teste                                              | Aqui o cartão fica em Ajustes de uma loja real e não aparece na demonstração. Sem credenciais, o revisor não chega lá.                                                                                         |
| Dado lido e não usado de forma visível ao usuário                                                             | **[Dedução]** a política exige que o uso seja para recurso "visível ao usuário" e voltado a ele                                        | **Resolvido em 03/10 [Código]:** a lista **Próximos eventos da Agenda Google** aparece no cartão logo depois da sincronização. Mostrar no vídeo.                                                               |
| URL do app não é a mesma do domínio verificado / homepage                                                     | **[Google]** homepage e política precisam estar em domínio verificado do projeto                                                       | O retorno do fluxo B cai em `https://beauty.contheiner.digital/auth/google-apps` e depois volta ao domínio da loja (se houver domínio próprio). Gravar tudo em `beauty.contheiner.digital` para não confundir. |
| Descrição do pedido diferente do que o vídeo mostra                                                           | **[Dedução]**                                                                                                                          | Usar exatamente os textos da seção 3.                                                                                                                                                                          |
| Desconexão/revogação não demonstrada                                                                          | **[Dedução]** não é exigência explícita que eu tenha confirmado, mas ajuda e casa com a política de privacidade                        | Mostrar **Desconectar** no app (mensagem de acesso revogado) e, em myaccount.google.com/permissions, que o Barba & Cabelo sumiu da lista.                                                                      |

Sobre a reprovação da **política de privacidade [Google]**: a política precisa estar no mesmo domínio da homepage, ser acessível sem login e dizer como o app **acessa, usa, armazena e compartilha** os dados do Google, além de como o usuário pede exclusão. O motivo dado foi "não especifica mecanismos de proteção de dados sensíveis".

### Política de privacidade — o que está publicado (03/10/2026) [Código]

Página `/privacidade` (texto oficial em pt-BR; tradução de cortesia em pt-PT, en-US, en-GB e es). Para o revisor: <https://beauty.contheiner.digital/privacidade?lang=en#dados-google> abre em inglês direto na seção do Google (o navegador em inglês também abre em inglês sem o `?lang`). Os links do rodapé mantêm o `?lang`.

| Exigência                                              | Onde está                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dados acessados por escopo                             | Seção 4: login (`openid`, `email`, `profile`), Agenda (`.../auth/calendar`: lista de agendas não guardada; eventos de 7 dias atrás a 60 à frente; cópia opcional dos agendamentos) e Contatos (`.../auth/contacts`: só criar contato, sem ler a lista)                                                                                                                                                                                                              |
| Uso                                                    | Seção 4, "Nossos compromissos": só funções visíveis ao usuário, inclusive a lista de eventos importados                                                                                                                                                                                                                                                                                                                                                             |
| **Mecanismos de proteção** (motivo da reprovação)      | Seção 4, subtítulo **"Como protegemos os dados do Google"** (TLS; tokens só no servidor e fora da API pública; Row Level Security e função que confere a sessão para os eventos; minimização; segredo OAuth em variável protegida e painel em VPN; revogação e exclusão) e seção 5 inteira (`#seguranca`), com senhas bcrypt, códigos SHA-256 de 10 min, state OAuth com HMAC de 10 min e troca de código só no servidor, registros técnicos, resposta a incidentes |
| Armazenamento e retenção                               | Seção 4 (campos guardados) e seção 8 (tokens e eventos até desconectar ou excluir a conta; limpeza na sincronização)                                                                                                                                                                                                                                                                                                                                                |
| Compartilhamento                                       | Seção 4 (não transferimos, exceto infraestrutura e lei) e seção 6                                                                                                                                                                                                                                                                                                                                                                                                   |
| Sem venda, sem publicidade                             | Seção 4                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Sem IA/ML generalizada                                 | Seção 4                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Sem leitura humana (com as 4 exceções do Uso Limitado) | Seção 4                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Declaração de Uso Limitado com link                    | Seção 4, em destaque, com link para a Google API Services User Data Policy                                                                                                                                                                                                                                                                                                                                                                                          |
| Revogação e exclusão                                   | Seção 4 (último parágrafo) e seção 11 (desconectar com revogação no Google, excluir a conta, myaccount.google.com/permissions, e-mail)                                                                                                                                                                                                                                                                                                                              |

Afirmações conferidas no código e nas migrations em 03/10/2026. **Não afirmado de propósito** (não é verdade hoje): criptografia dos tokens em repouso no banco e criptografia de disco do servidor.

Declaração de Uso Limitado publicada (versão em inglês):

> Barba & Cabelo's use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

---

## 2. Roteiro do vídeo de demonstração (em inglês)

**Formato [Google]:** vídeo no YouTube como **Não listado** (não privado), link colado no formulário. Duração sugerida 3 a 5 minutos **[Dedução]**. Gravar no computador (tela larga, URL legível) é mais seguro que no celular **[Dedução]**; se gravar no celular, a barra de endereço precisa aparecer inteira no momento do consentimento.

**Preparação (antes de gravar):**

1. Navegador em janela anônima, idioma **English**; conta Google de teste também em inglês.
2. No app, trocar o idioma para **English (US)** no seletor de idioma.
3. Ter uma loja de teste (seção 4) com 1 profissional, 1 serviço e 1 cliente fictício.
4. Remover acessos antigos do app em <https://myaccount.google.com/permissions> na conta de teste, para a tela de consentimento aparecer completa.
5. Abrir em outra aba a Agenda Google e o Google Contatos da conta de teste (para mostrar o resultado).
6. Conferir que o nome do app na tela de consentimento é "Barba & Cabelo" (o mesmo da homepage).

**Cenas (narração ou legenda sugerida em inglês):**

| #   | O que mostrar                                                                                                                                                                                                                                                                                 | Narração/legenda sugerida                                                                                                                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Barra de endereço com `https://beauty.contheiner.digital`, a página inicial e o rodapé com **Privacy Policy** e **Terms of Use**. Clicar em Privacy Policy e rolar até a seção 4 (**Google user data**), parando em **How we protect Google user data** e na declaração de Limited Use.       | "This is Barba & Cabelo, a booking app for barbershops, at beauty.contheiner.digital. The privacy policy and terms are linked on the home page. The policy explains how we use and protect Google Calendar and Google Contacts data."                         |
| 2   | `/auth` → **Continue with Google** → tela de consentimento do login (só nome, e-mail e foto).                                                                                                                                                                                                 | "The shop owner signs in with Google. This sign-in only requests basic profile information: name, email address and profile picture."                                                                                                                         |
| 3   | Painel da loja → **Settings → Notifications and integrations** (Ajustes → Avisos) → cartão **Google Calendar and Contacts**. Ler a explicação do cartão. Tocar **Connect Google** e mostrar o aviso interno do app.                                                                           | "Calendar and Contacts are optional. The owner opens Settings and chooses Connect Google."                                                                                                                                                                    |
| 4   | Tela de seleção de conta e **tela de consentimento** com o nome "Barba & Cabelo" e os dois acessos (Calendar e Contacts). **Clicar na barra de endereço e dar zoom no `client_id=`**. Marcar as caixas e aceitar.                                                                             | "Here is the OAuth consent screen. It shows the app name, Barba & Cabelo, and the client ID in the address bar. The app requests access to Google Calendar and Google Contacts."                                                                              |
| 5   | Volta ao app: "Connected as …". Lista **Which calendar should sync?** aberta, escolher uma agenda.                                                                                                                                                                                            | "Calendar scope, read: the app lists the user's calendars so the owner can choose which one to use. Nothing is selected automatically."                                                                                                                       |
| 6   | Antes de gravar, criar 2 ou 3 eventos de teste na agenda escolhida (ex.: "Supplier meeting" amanhã às 10h). **Sync calendar** → mensagem "N events imported from …" → rolar até **Upcoming Google Calendar events** e mostrar os mesmos eventos (título, dia, horário e "Calendar: …").       | "Calendar scope, read: the app imports events from the chosen calendar, from 7 days ago to 60 days ahead, and shows them here so the owner can see busy times while managing bookings. Only the title and times are stored, and only this user can see them." |
| 7   | Em **Copy bookings to this calendar**, escolher **Only my appointments**. Criar um agendamento no app. Esperar cerca de 1 minuto e mostrar o evento aparecendo na Agenda Google (título "Service · Customer"). Remarcar ou cancelar e mostrar a atualização.                                  | "Calendar scope, write: every booking made in the app is copied to the chosen Google Calendar. Reschedules and cancellations update or remove the event."                                                                                                     |
| 8   | **Save to Google Contacts**: preencher nome e telefone de um cliente fictício → **Save contact** → abrir contacts.google.com e mostrar o contato criado.                                                                                                                                      | "Contacts scope: the owner can save a customer's name, phone and email to Google Contacts with one tap. The app only creates contacts the owner chooses to save."                                                                                             |
| 9   | **Copy bookings → Don't copy**, depois **Disconnect** no app e mostrar a mensagem "Google disconnected. The app's access to your Google Account was revoked and imported data was deleted." Abrir <https://myaccount.google.com/permissions> e mostrar que o Barba & Cabelo não aparece mais. | "The owner can stop copying and disconnect at any time. Disconnecting revokes the app's access with Google and deletes the stored Google tokens and imported events from our servers. Access can also be removed in the Google Account permissions page."     |
| 10  | Encerramento na homepage.                                                                                                                                                                                                                                                                     | "Google user data is used only to provide these features, is never sold, and is not used for advertising."                                                                                                                                                    |

Cuidados: não mostrar dados reais de clientes; não mostrar o Client Secret nem o `.env`; não editar o vídeo de forma que o consentimento pareça cortado **[Dedução]**.

---

## 3. Textos sugeridos (em inglês)

### 3.1 Justificativa dos escopos

**`https://www.googleapis.com/auth/calendar`**

> Barba & Cabelo is an appointment booking app for barbershops. Shop owners and professionals can optionally connect a Google account to (1) list their calendars and choose one, (2) import events from the chosen calendar (7 days back to 60 days ahead) so they can see busy times while managing bookings, and (3) automatically create, update and delete events in that calendar for each appointment booked, rescheduled or cancelled in the app. Reading the calendar list is required for the user to choose the calendar; reading events is required for the import; writing events is required for the booking copy. A read-only scope would not allow creating events, and an events-only scope would not allow listing the user's calendars for selection. Data is used only for these user-facing features.

Observação **[Dedução]**: existem escopos mais granulares de Agenda (por exemplo `calendar.events` e escopos de lista de agendas somente leitura), mas **não confirmei** se a combinação cobre todas as chamadas usadas. Como "Solicitar escopos mínimos" já foi aprovado, não mudar os escopos agora — mudar exigiria nova revisão.

**`https://www.googleapis.com/auth/contacts`**

> The shop owner can save a customer's name, phone number and email to their own Google Contacts with the "Save to Google Contacts" button, so they can reach the customer from their phone. The app calls people.createContact only when the user explicitly taps the button. The People API createContact method requires the contacts scope; there is no write-only alternative. The app does not read, list or export the user's existing contacts.

(Conferido no código: só `people:createContact` é chamado. Que não existe escopo só de escrita para `createContact` é o que eu entendo da documentação da People API — confirmar na referência do método antes de enviar.)

**`openid`, `email`, `profile`**

> Used for "Sign in with Google" and to show which Google account is connected to Calendar/Contacts in the settings screen.

### 3.2 Resposta ao e-mail do time de verificação

Responder **no mesmo fio do e-mail** recebido (o Google costuma pedir isso **[Dedução]**):

> Hello Google Trust & Safety team,
>
> Thank you for the review. We have addressed the issues raised:
>
> 1. Privacy policy: https://beauty.contheiner.digital/privacidade (English: https://beauty.contheiner.digital/privacidade?lang=en#dados-google) now describes which Google user data we access per scope (calendar list, calendar events, contacts created by the user, basic profile), how it is used, stored, retained and deleted, that it is not sold, not used for advertising or to train generalized AI/ML models, not read by humans except under the Limited Use exceptions, and how users can revoke access. The new subsection "How we protect Google user data" and section 5 "Security and protection of sensitive data" list the protection mechanisms in place (TLS in transit, OAuth tokens kept only on the server and unreadable through the public API, row-level security, data minimization, secrets in protected server variables, admin panel on a private network, token revocation on disconnect). It includes the Limited Use disclosure, is linked on the home page and matches the URL configured on the OAuth consent screen.
> 2. App functionality: we uploaded a new demo video (unlisted YouTube link: <LINK>) showing the full OAuth flow in English with the app name and the client ID in the address bar, and each requested scope being used in the app: listing calendars, importing events and showing them in the app ("Upcoming Google Calendar events"), copying bookings to Google Calendar, saving a contact to Google Contacts, and disconnecting (which revokes the token with Google).
> 3. Reviewer access: test credentials for a demo shop account were provided in the "test account" field of the verification form. The Google Calendar and Contacts feature is in Settings → Notifications and integrations → "Google Calendar and Contacts".
>
> Please let us know if anything else is needed.
>
> Best regards,
> Barba & Cabelo team

---

## 4. Acesso do revisor

1. Criar uma **conta nova só para a revisão** (e-mail próprio, ex.: um alias do domínio `contheiner.digital`; não usar e-mail pessoal nem de cliente).
2. Com ela, cadastrar uma **loja de teste real** em `/cadastrar` (não a demonstração — na demonstração o cartão Google fica escondido **[Código]**). Nome sugerido: "Demo Barbershop (Google review)".
3. Cadastrar 1 profissional, 1 serviço e 2 clientes **fictícios** (nomes e telefones inventados).
4. Conferir que essa conta entra direto no painel da loja e que o cartão **Google Agenda e Contatos** aparece em Ajustes → Avisos.
5. Informar as credenciais **somente no campo próprio do formulário** de verificação (ou na resposta ao e-mail, se pedirem), nunca no vídeo nem na descrição pública. Incluir o caminho: "Sign in at https://beauty.contheiner.digital/auth → Settings → Notifications and integrations → Google Calendar and Contacts".
6. Se o login exigir código por e-mail (OTP), **avisar no formulário** e preferir senha nessa conta; o revisor não terá acesso à caixa de e-mail **[Dedução]**.
7. O revisor usa a conta Google dele para o consentimento; não é preciso dar uma conta Google.
8. Depois da aprovação, trocar a senha ou desativar a conta de teste.

---

## 5. Checklist final antes de reenviar

**Google Cloud Console (OAuth consent screen / Branding):**

- [ ] Nome do app **"Barba & Cabelo"**, igual ao da homepage e do vídeo.
- [ ] Logo igual ao do site (o Google pede imagem quadrada; tamanho exato conferir na tela — eu sei de 120×120 px, **não confirmado** se mudou).
- [ ] **E-mail de suporte** do usuário preenchido e ativo; e-mail do desenvolvedor ativo (o Google responde nele).
- [ ] Homepage: `https://beauty.contheiner.digital`.
- [ ] Política de privacidade: `https://beauty.contheiner.digital/privacidade` — **o mesmo link** que está no rodapé da homepage (`PlatformLanding.tsx` linka `/privacidade` e `/termos` **[Código]**).
- [ ] Termos: `https://beauty.contheiner.digital/termos`.
- [ ] **Domínios autorizados** incluem `contheiner.digital`. Se o login (fluxo A) ainda usa o callback `supabase-teste.proh.media`, o domínio `proh.media` também precisa estar autorizado — e a tela de login pode mostrar "continue to supabase-teste.proh.media". **[Dedução]** isso pode confundir o revisor; preferir trocar para `supabasebeauty.contheiner.digital` antes de gravar (ver `docs/mb-operacao.md`, seções 3.1 e 4).
- [ ] Escopos cadastrados = exatamente os do código (`openid`, `email`, `profile`, `calendar`, `contacts`). Nada a mais.

**Google Search Console:**

- [ ] Domínio `contheiner.digital` (ou a propriedade `beauty.contheiner.digital`) **verificado** com uma conta que seja proprietária/editora do projeto Google Cloud **[Google]**.

**Site:**

- [ ] Homepage abre sem login e explica o que o app faz (já aprovado).
- [ ] **Publicado antes de gravar:** migration `20261003190000_google_tokens_e_eventos.sql` aplicada (cria `list_my_google_calendar_events` e tira a leitura direta dos tokens), Edge `google-connect` + `_shared/google.ts` atualizadas no volume Coolify (revogação e minimização) e frontend republicado (lista de eventos, política nova). Sem a migration, a lista de eventos mostra erro.
- [ ] `/privacidade?lang=en#dados-google` abre em inglês na seção 4, com **How we protect Google user data** e a frase de Limited Use.
- [ ] Texto do aviso interno antes de conectar (`integr.google.consentP1`, que fala em "verificação em análise") ajustado depois da aprovação.

**Formulário de verificação:**

- [ ] Link do vídeo (YouTube, não listado), abrindo em janela anônima.
- [ ] Justificativas da seção 3.1.
- [ ] Credenciais de teste no campo próprio (seção 4).
- [ ] Resposta no fio do e-mail (seção 3.2).

---

## Pendências de código

Resolvidas em 03/10/2026:

1. ~~Mostrar os eventos importados na interface~~ — lista **Próximos eventos da Agenda Google** no cartão (até 8 eventos futuros da agenda escolhida, no fuso da barbearia).
2. ~~Revogar o token no Google ao desconectar~~ — `revokeGoogleToken` em `_shared/google.ts`, chamado pela ação `disconnect`; também pedido antes de excluir a conta.

Em aberto:

3. **Domínio do login Google (fluxo A).** Confirmar se o GoTrue já usa `supabasebeauty.contheiner.digital/auth/v1/callback`; se não, a tela de consentimento do login mostra outro domínio.
4. **Tokens sem criptografia em repouso.** Ficam em texto na coluna, protegidos por permissão (só `service_role`). Melhoria possível: cifrar com Supabase Vault/pgsodium. A política não afirma criptografia em repouso.
5. **Janela de importação aceita do cliente.** `sync_calendar` aceita `time_min`/`time_max` no corpo; o cartão não envia, mas a política fala em 7 dias atrás e 60 à frente. Limitar no servidor deixaria a afirmação garantida.
6. **Fila `google_calendar_pushes` fica após desconectar** (só ids de agendamento/evento e status, sem token). Apagar junto na desconexão seria mais limpo.
7. **Texto do aviso antes de conectar** (`integr.google.consentP1`, "verificação em análise") ajustar depois da aprovação.
