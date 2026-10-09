> **Status (09/10/2026):** o dono aprovou todas as recomendações da seção 5. **Feito e publicado (Claude Code):** ondas 1, 2, 3 e a parte de interface da 5. Detalhes e pendências em `docs/CONTINUIDADE.md`. **Falta:** onda 4 (convite com link, troca de senha, boas-vindas) e os itens que precisam de banco: contagem de administradores, bloqueio próprio e foto do Contratado, bloqueios de colegas sem motivo no banco, convite "aguardando aprovação", primeiro dono de loja criada pela plataforma e saída do Contratado sem levar clientes também no banco. Também falta o teste manual com contas reais num subdomínio de loja.

# Plano: separar os ambientes de forma clara, do primeiro acesso ao uso diário

O plano foi montado só com leitura do código e dos mapas já conferidos. Nenhum arquivo foi editado e nenhuma foto foi tirada.

## 1. Diagnóstico: 8 problemas centrais

1. **O login escolhe o ambiente pelo papel mais alto e ignora o que a pessoa queria fazer.**
   - Um profissional ou admin que toca "Agendar" sem estar logado entra e cai em `/shop` ou `/platform`. O horário escolhido se perde.
     - Regra que causa isso: `src/lib/auth/session.ts:147-170`.
     - Onde o destino é aplicado depois do login: `src/routes/auth.tsx:979-993`.
     - De onde sai o pedido de agendamento: `ShopLandingParts.tsx:92-103`.
   - O endereço `/` e o app instalado mandam sempre ao ambiente "mais alto", inclusive no domínio da própria loja (`src/routes/index.tsx:18-28` e `:46-57`; `public/manifest.webmanifest:7`).
   - Atritos do mapa que entram aqui: E1, S2, C1, PLAT-06, S7, E8, C2.

2. **Não existe como ir e voltar entre os ambientes.**
   - O menu do painel não leva ao app do cliente (`ShopAccountMenu.tsx:213-235`).
   - O app do cliente não tem nenhum link para `/shop` ou `/platform`.
   - O app do cliente não mostra que a pessoa está "como cliente" (`ArenaApp.tsx:2588-2642`).
   - Atritos: E2, S1, C3, P3, EMP-09, E11, C4.

3. **Quando o painel não sabe quem é a pessoa ("actor nulo"), ele libera poderes de dono.**
   - O admin ou o `shop_admin` antigo, sem vínculo de equipe, abre o painel numa loja escolhida a partir de _qualquer_ vínculo, inclusive de cliente (`ShopShell.tsx:239-243`).
   - Nesse caso as regras tratam a falta de papel como dono: `!actor || …` (`ShopShell.tsx:1329-1354`). Não há selo de papel.
   - "Ir para minha barbearia" aparece para todo admin, mesmo sem loja (`PlatformAccountMenu.tsx:69-72`).
   - O gerente de conta cai na área de cliente (`session.ts:31-37`).
   - Atritos: E9, PLAT-04 (deve subir para gravidade alta), E10.

4. **A loja que abre é imprevisível, e a troca deixa resquícios da loja anterior.**
   - A lista de lojas da pessoa não tem ordem (`session.ts:57-62` e `:79`).
   - A escolha fica guardada no aparelho sem proteção contra erro e sem separar por usuário (`ShopShell.tsx:162` e `:174`).
   - Ao trocar de loja, as permissões da loja anterior valem até o servidor responder (`ShopShell.tsx:170-229` e `:1421-1428`).
   - O painel ignora o domínio em que a pessoa está (`ShopShell.tsx:160-169`). O cliente também cai numa loja arbitrária (`ArenaApp.tsx:804-808`).
   - Atritos: E3, E4, S6, EMP-05, E7, E12, C5, C9.

5. **O convite não leva a pessoa a lugar nenhum, e as recusas acontecem sem explicação.**
   - Nenhum e-mail ou link é enviado (`supabase/functions/invite-shop-admin/index.ts:166-181`).
   - O texto do formulário promete e-mail mesmo assim (`pt-BR.ts:863`).
   - Não há troca obrigatória da senha temporária nem tela de boas-vindas.
   - Quem já tinha conta não recebe aviso nenhum.
   - Quem está sem acesso, removido ou com aprovação pendente é mandado a `/app` sem mensagem (`src/routes/shop.tsx:11`).
   - Um cliente que quer abrir uma barbearia com o mesmo e-mail fica sem saída (`register-shop/index.ts:498-512`).
   - Atritos: E5, S8, P2, EMP-04, E6.

6. **O selo de papel diz pouco, e as telas seguem o nome do papel em vez das permissões.**
   - O sócio aparece como "Dono", sem % e sem o modo da sociedade (`roles.tsx:9-16`).
   - Parceiro e contratado só percebem o próprio papel pelo que falta na tela.
   - O cartão "Seu acesso" fica escondido em Ajustes (`MyAccessCard.tsx`).
   - Há mais de 15 testes `role === "associate"` no painel. Por isso a matriz de permissões libera abas para o contratado cujos botões sempre falham. Exemplos: `ShopShell.tsx:752-791`, `:1144-1150` e `:1329-1346`.
   - O mesmo assunto, a sociedade, está repartido em dois lugares: a aba Equipe e Ajustes → Equipe e sociedade.
   - Os nomes dos papéis mudam entre a demonstração, o convite e o painel.
   - Atritos: S3, S4, P6, EMP-01, EMP-02, EMP-03, EMP-06, EMP-10, PLAT-08.

7. **A demonstração não reproduz os papéis reais e consulta o banco real.**
   - Na demonstração, o Parceiro ganha poderes de dono e fica com mais poder que o sócio (`ShopShell.tsx:176-185`, `:1336`, `:1342`, `:1344` e `:1721`).
   - A demonstração usa o id real da loja (`model.ts:346-367`).
   - As sugestões de catálogo leem e gravam no banco real (`PartnerCatalogSuggestions.tsx:89-125` e `:157-162`), embora a tela diga "Seguro · dados fictícios".
   - O cartão "Seu acesso" e a saída da loja não aparecem na demonstração.
   - Atritos: P1, P4, PLAT-02, P8, S5.

8. **Duas lacunas no cliente e na plataforma.**
   - Cliente com várias lojas:
     - A troca de loja fica escondida em Conta (C6).
     - As reservas de outras lojas somem sem aviso (C7).
     - Quem não tem loja vê um erro vermelho que não consegue resolver (C8).
   - Plataforma:
     - A contagem de "administradores" ignora os donos adicionados pela plataforma, então a lista de atenção diz que a loja está sem administrador (PLAT-01, alta).
     - A ficha da loja não lista a equipe (PLAT-05).
     - "Testar como…" da ficha joga o admin para outra aba (PLAT-07).

## 2. Princípios propostos

1. **Uma única lista "Minhas áreas" no menu da conta dos três ambientes.**
   - Mostra Plataforma, cada barbearia com o papel ali e Cliente, com ícone e selo.
   - Só aparece quando a conta tem 2 ou mais áreas. Uma conta só de cliente não vê nada novo.
2. **O cabeçalho sempre responde "onde estou" e "como quem".**
   - No painel: o nome da loja mais um selo de papel que pode ser tocado e abre "Seu acesso".
   - No app do cliente: selo "Cliente", só para quem tem mais de um papel.
   - Na plataforma: selo "Plataforma".
   - A marca da loja continua igual (cartões off-white, cores aprovadas). O que muda por ambiente é selo e ícone, não a paleta inteira.
3. **A intenção vence a hierarquia.**
   - Um link que pede algo específico (loja, profissional, horário, reserva) leva a esse algo.
   - A regra "nunca rebaixar" vale só para a entrada sem destino.
4. **Nada acontece em silêncio.**
   - Sem papel definido, não há poder nenhum.
   - Sem acesso, a pessoa vê uma mensagem dizendo o motivo.
   - A loja escolhida é estável e lembrada.
   - Toda troca de ambiente ou de loja é explícita, com a tela "Abrindo Barbearia X…".
5. **As telas seguem permissões com nome, e não o nome do papel.**
   - Matriz de permissões, cartão "Seu acesso", telas e banco usam a mesma regra.
6. **A demonstração nunca toca o real e se comporta igual ao real.**
   - Usa ids fictícios e nenhuma chamada ao banco enquanto está em modo demonstração.
   - Cada papel da demonstração tem as mesmas restrições do papel real.
7. **Um só vocabulário de papéis em todo lugar:** Dono · %, Sócio, Parceiro, Contratado, Gerente de conta, Admin.

## 3. Modelo-alvo por ambiente

**Cliente (`/app`)**

- **Entrada:**
  - Pela página da loja, pelo link do profissional ou pelo link de reserva, sempre chegando à loja e ao horário pedidos, mesmo que a pessoa tenha papel profissional.
  - Cadastro sem loja vai para um estado vazio neutro: "Peça o link à sua barbearia", com campo para colar o link.
- **Onde estou:** logo e nome da loja. Quando há mais de uma loja, o nome vira seletor. Para quem tem outro papel, aparece o selo "Cliente".
- **Abas:** as atuais (Início, Agendar, Reservas, Esportes, Conta).
- **O que vê:** dados só da loja aberta, mais um aviso quando há reservas em outra loja ("1 reserva na Loja B · Abrir").
- **Não vê:** nada do painel.
- **Como troca:** pelo seletor de loja no cabeçalho e por "Minhas áreas" no avatar (Painel da Barbearia X, Plataforma).

**Dono / Sócio (`/shop`)**

- **Entrada:** o login sem destino abre a última área usada. Se houver 2 ou mais lojas e nenhuma escolha salva, aparece "Em qual barbearia você vai trabalhar agora?".
- **Onde estou:**
  - Nome da loja (seletor de loja) e selo "Dono · 50%".
  - Selo curto do modo da sociedade: "Decide sozinho", "Decisão em conjunto" ou "Maior parte decide".
  - Tocar no selo abre "Seu acesso".
- **Abas:** Agenda, Serviços, Equipe, Horários, Ajustes.
- **Sociedade num lugar só:** pessoas e %, modo, aprovações e saída.
- **Botões Salvar:** quando a mudança vai para aprovação, isso é avisado _antes_ de salvar.
- **Como troca:** por "Minhas áreas", que inclui "Agendar como cliente" e, para quem é admin, "Plataforma".
- **Ver a própria página:** dois botões com rótulos distintos, "Ver como cliente" e "Abrir link público".

**Parceiro (`/shop`)**

- **Entrada:** pelo link do convite, que abre uma tela de boas-vindas mostrando a loja, o papel "Parceiro" e um resumo de "Seu acesso", e pede a criação da senha.
- **Onde estou:** selo "Parceiro" tocável. A aba se chama "Meus serviços", com a faixa "valem só na sua agenda".
- **Abas:** Agenda (com "Meu link e carteira" visível), Meus serviços, Horários (só os próprios bloqueios), Ajustes.
- **Vê:** a própria agenda, os próprios valores e a loja de forma anônima. Edita o próprio perfil público e o próprio link.
- **Não vê:** a agenda dos colegas nem o motivo dos bloqueios deles (depende de decisão do dono).
- **Como troca:** por "Minhas áreas".

**Contratado (`/shop`)**

- **Entrada:** a mesma do parceiro.
- **Onde estou:** selo "Contratado" tocável. Na Agenda, o selo "Valores ficam com o dono", com cadeado, no lugar de simplesmente sumir.
- **Abas:** Agenda e Ajustes. Mais Horários (próprios bloqueios), "Meu perfil e link" e "Sair da barbearia", se o dono decidir liberar.
- **Matriz de permissões:** não oferece ao Contratado células que não funcionam para ele.
- **Como troca:** por "Minhas áreas".

**Plataforma (`/platform`)**

- **Entrada:** login sem destino abre `/platform`, sempre no domínio principal.
- **Onde estou:** selo "Plataforma" no título. Na demonstração, o título vira "Plataforma · demonstração".
- **Abas:** as atuais.
- **Ficha da loja:**
  - Lista a equipe (nome, papel, %).
  - "Testar como…" abre os papéis ali mesmo e, ao sair da demonstração, volta à ficha.
- **Nova barbearia:** depois de criar, a primeira ação oferecida é "Adicionar dono".
- **Como troca:**
  - "Minhas áreas" lista só as lojas em que o admin é da equipe, com o papel em cada uma.
  - Sem vínculo de equipe, não há atalho. Para ver uma loja, usa a demonstração ou o modo de suporte, se for aprovado (decisão 4).
  - O gerente de conta segue a decisão 6.

## 4. Etapas de implementação em ordem

**Onda 1 — Fechar os vazamentos de "como quem" e da demonstração.** Sem banco, salvo o item 8.

1. Quando a pessoa não tem papel definido, o painel não libera nada:
   - A loja vem só da lista de lojas em que a pessoa é da equipe, nunca de um vínculo de cliente.
   - Sem essa lista, aparece uma tela vazia com "Voltar à plataforma".
   - Arquivos: `ShopShell.tsx:239-243`, `:1329-1354`, `:1509-1513` e `:1541-1546`.
2. "Ir para minha barbearia" só aparece quando a conta tem loja. Arquivo: `PlatformAccountMenu.tsx:69-72`.
3. Ao trocar de loja, as permissões são zeradas e aparece "Abrindo Barbearia X…", voltando à Agenda. Arquivo: `ShopShell.tsx:170-229` e `:1421-1428`.
4. A escolha de loja guardada no aparelho ganha proteção contra erro e uma chave separada por usuário. Arquivos: `ShopShell.tsx:162` e `:174`; `LoyaltyAdminPage.tsx:129-131`.
5. A lista de lojas passa a ter ordem fixa: papel mais alto e depois o vínculo mais antigo. Arquivo: `session.ts:57-62`. Falta confirmar se existe coluna de data para ordenar; se não existir, **precisa de banco**.
6. Demonstração:
   - Parceiro e Contratado deixam de aplicar mudanças.
   - As exceções feitas só para a demonstração saem das regras de papel.
   - As sugestões de catálogo ganham dados fictícios.
   - Ids fictícios para loja, equipe e serviços.
   - Um teste falha se algum componente chamar o banco em modo demonstração.
   - Arquivos: `ShopShell.tsx:176-185`, `:349-381`, `:1336`, `:1342`, `:1344` e `:1721`; `PartnerCatalogSuggestions.tsx`; `model.ts:346-367`; `DemoWorkspace.tsx:159-191`.
7. Texto do convite trocado para "Envie a senha temporária para a pessoa" (`pt-BR.ts:863`). Atualizar `docs/CONTINUIDADE.md:102`, que está desatualizado (PLAT-03).
8. A contagem de administradores passa a usar os donos e sócios ativos da equipe. Arquivos: `shopStats.ts:9-38`, `PlatformDashboard.tsx:87`, `PlatformShell.tsx:159-171`. **Provavelmente precisa de banco** (consulta ou permissão de leitura para o admin).

**Onda 2 — Entrada e troca de ambiente.** Sem banco.

1. A decisão de destino depois do login passa a seguir o pedido do link. Um destino `/app` com loja, profissional, dia, hora ou reserva é seguido. O destino genérico continua com a regra atual. Arquivos: `session.ts:147-170`, `auth.tsx:979-993`. Atualizar os testes em `session.test.ts`.
2. Novo componente "Minhas áreas", que reaproveita os dados de sessão já carregados. Entra em `ShopAccountMenu.tsx`, `PlatformAccountMenu.tsx` e no avatar do `ArenaApp.tsx` (`:2588-2642`). Inclui o selo "Cliente" para quem tem mais de um papel.
3. O `/` e o app instalado abrem a última área usada no aparelho. No domínio da loja, mostram a página pública com a barra "Você está vendo como cliente · Abrir painel", se a decisão 3 for nesse sentido. Arquivo: `src/routes/index.tsx:18-28` e `:46-57`.
4. As recusas de acesso passam a explicar o motivo: sem acesso, aguardando aprovação ou removido. A informação vai no endereço até `/app`, que mostra um aviso. Arquivos: `src/routes/shop.tsx:11`, `guards.ts:21-26`.
5. Primeiro acesso com 2 ou mais lojas: tela de escolha com cartões e papéis. No domínio da loja A, o painel abre a A quando a pessoa trabalha lá; caso contrário, avisa "Você está no endereço da A, mas trabalha na B". `/platform` sempre no domínio principal. Arquivo: `ShopShell.tsx:156-169`, usando `resolveShopFromCurrentHost` (`host.ts:45-53`).
6. Dois botões de página com rótulos distintos: "Ver como cliente" e "Abrir link público". Arquivos: `ShopShell.tsx:1892-1898`, `ShopLinkCard.tsx:88-92`, `ShopSetupChecklist.tsx:374-381`.

**Onda 3 — Clareza do papel dentro do painel.** Quase tudo sem banco.

1. Selo de papel tocável que abre "Seu acesso" resumido, mostrando "Dono · %" e o modo da sociedade. Arquivos: `roles.tsx`, `ShopShell.tsx:1500-1513`, `MyAccessCard.tsx`.
2. Aviso antes de salvar, quando a mudança vai para aprovação: "vai para aprovação de X". Arquivo: `ShopShell.tsx:1250-1258` e as abas protegidas.
3. Trocar os testes `role === "associate"` por permissões com nome (próprios bloqueios, próprio link, sair da loja, Google próprio) em `capabilities.ts`. Pontos em `ShopShell.tsx`: 432, 752, 912, 1148, 1173, 1344, 1361, 1647, 1882, 1995 e 2046.
4. A matriz de permissões trava ou explica as células sem efeito para o Contratado (`ShopPermissionsMatrix.tsx:142-143`).
5. O Contratado ganha bloqueios próprios, saída da loja e Google, conforme as decisões 7 e 8. Se mudar o padrão da matriz para o Contratado, **precisa de banco**.
6. Parceiro: aba "Meus serviços", faixa "só na sua agenda" e "Você atende / não atende" (`ServicesTab.tsx:251` e `:354-362`).
7. Cartão "Meu perfil e link" para todos os profissionais. O banco já libera a própria linha (migration `20260929170000`).
8. Sociedade num lugar só: juntar `ShopShell.tsx:1770-1786` e `:2019-2050`.
9. Bloqueios de colegas sem nome e sem motivo. **Precisa de banco** (filtro por RPC ou política). Arquivos: `ShopShell.tsx:418-423`, `BlocksCard.tsx`.

**Onda 4 — Convite e primeira chegada.** **Precisa de banco e de servidor.**

1. O convite envia um link de entrada no domínio da loja, por e-mail (fila `email_outbox`) ou WhatsApp. O resultado mostra um cartão pronto para compartilhar. Arquivos: `supabase/functions/invite-shop-admin/index.ts`, `ShopTeamAccessCard.tsx:833-845`.
2. Troca obrigatória da senha temporária no primeiro login. Exige uma marca no perfil.
3. Tela de boas-vindas "Você agora é Parceiro na Barbearia X". Aparece também para quem já tinha conta. Exige guardar "boas-vindas vista" por vínculo.
4. `/cadastrar` com sessão aberta: "Você vai usar a conta x@y". No erro de e-mail já em uso, mostrar "Entrar e abrir minha barbearia". Arquivos: `register-shop`, `cadastrar.tsx:80-83` e `:394-421`.
5. Gerente de conta conforme a decisão 6. Até lá, esconder o convite desse papel.
6. Guia de configuração guardado por loja no banco, com o passo "Equipe e sócios" (S9).

**Onda 5 — Cliente com várias lojas, plataforma e demonstração fiel.** Sem banco, salvo os itens marcados.

1. Cliente:
   - Seletor de loja no cabeçalho e última loja lembrada no aparelho.
   - Aviso de reservas em outra loja. Um link de reserva de outra loja abre a loja certa.
   - Corrigir o caso sem loja aberta, em que as reservas aparecem misturadas.
   - Estado vazio neutro para quem não tem loja.
   - "Entrar em {loja}?" passa a "Adicionar {loja} às minhas barbearias".
   - Arquivos: `ArenaApp.tsx:397-402`, `:804-848`, `:1566-1570` e `:2860-2870`; `CustomerProfile.tsx:474-512`; `pt-BR.ts:291-300`.
2. Profissional que abre o app da própria loja: explicar que isso cria a ficha de cliente dele (C11). Se a regra mudar, **precisa de banco**.
3. Plataforma:
   - Ficha da loja com a equipe. **Precisa de banco** para a leitura.
   - "Testar como…" abre os papéis na própria ficha e, ao sair, volta para ela.
   - O papel escolhido na demonstração fica no endereço (`?view=`).
   - Título "Plataforma · demonstração".
   - "Adicionar dono" logo depois de criar a loja.
   - Arquivos: `ShopDetail.tsx`, `PlatformShell.tsx:216-225`, `:275-285` e `:587-592`; `DemoWorkspace.tsx:106-137`; `NewShopDialog.tsx`.
4. Demonstração:
   - Personagens fictícios próprios para Parceiro e Contratado.
   - "Seu acesso" e a saída da loja simulada também na demonstração.
   - Visões de sócio igualitário e de sócio minoritário.
   - Mesmos nomes de papel do produto.
   - Arquivos: `DemoWorkspace.tsx:158-191`, `demo/roles.ts`, `ShopShell.tsx:1360-1366`.

## 5. Decisões que você precisa tomar antes

| #   | Pergunta                                                                                   | Recomendado                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | Quem tem papel profissional (ou é admin) e toca "Agendar" vai ao agendamento ou ao painel? | **Agendamento.** O painel fica só para o login sem destino.                                                                   |
| 2   | Onde fica a troca de ambiente?                                                             | **"Minhas áreas" no avatar dos três ambientes**, só para contas com 2 ou mais áreas, mais o selo "Cliente" no app do cliente. |
| 3   | O que o `/` e o app instalado abrem? E o `/` no domínio da loja, com sessão aberta?        | **A última área usada no aparelho.** No domínio da loja, **mostrar a página pública com a barra "Abrir painel"**.             |
| 4   | Como o admin entra numa loja à qual não está vinculado?                                    | **Só pela demonstração por enquanto.** Um modo de suporte com registro e prazo fica para depois.                              |
| 5   | Pessoa com 2 ou mais lojas e nenhuma escolha salva: abrir direto ou perguntar?             | **Perguntar no primeiro acesso** e lembrar a resposta. O painel segue o domínio quando a pessoa trabalha naquela loja.        |
| 6   | Gerente de conta: ambiente próprio, leitura no `/shop` ou esconder o papel?                | **Esconder o convite até existir tela.**                                                                                      |
| 7   | O Contratado pode bloquear o próprio horário, sair da loja e ligar o Google sozinho?       | **Sim para bloqueios e saída** (sair sem levar clientes). **Google: sim, só da própria agenda.**                              |
| 8   | A matriz deve deixar o dono dar ao Contratado poderes de gestão?                           | **Não.** Travar as células com o aviso "use Parceiro".                                                                        |
| 9   | Como chega o convite?                                                                      | **Link por WhatsApp e e-mail**, troca de senha obrigatória e aviso a quem já tinha conta.                                     |
| 10  | Nome do papel antigo `partner` e do dono com %?                                            | **"Dono · X%" para todos os donos.** `partner` sai do seletor da demonstração. Os modos aparecem como selo, e não como papel. |
| 11  | Demonstração com dados reais da loja?                                                      | **Não:** ids e dados fictícios, para que "dados fictícios" seja verdade.                                                      |
| 12  | Regra de "barbearia sem administrador"?                                                    | **Ter pelo menos um dono ou sócio ativo na equipe.**                                                                          |
| 13  | Cliente cadastrado sem link de loja: busca de lojas ou só "peça o link"?                   | **Só "peça o link", com um campo para colá-lo.**                                                                              |
| 14  | Parceiro vê os bloqueios dos colegas?                                                      | **Sim, como "Colega indisponível", sem nome nem motivo.**                                                                     |

## 6. Riscos e como verificar

**Riscos**

- **Mudar o destino do login pode abrir brecha de redirecionamento.** Aceitar só caminhos internos e só com os parâmetros conhecidos. Cobrir com testes da regra de destino para cada combinação de papel e destino (admin, dono, parceiro, cliente × `/app?shop&day`, `/shop`, vazio).
- **Tirar os poderes de quem não tem papel pode tirar o acesso de quem hoje depende do `shop_admin` antigo.** Antes da Onda 1, levantar no banco quantas contas têm `shop_admin` sem vínculo de equipe.
- **Trocar os testes de papel por permissões pode mudar o que parceiro e contratado veem.** Fazer testes de permissão por papel e comparar com o cartão "Seu acesso".
- **As sessões são separadas por domínio.** "Minhas áreas" e o painel seguindo o domínio podem pedir novo login. O texto precisa avisar isso.
- **Enviar ao `origin` publica o site.** Cada onda passa por checagem de tipos e montagem, e segue a regra da vez (`scripts/vez.sh`, `scripts/autossave.sh`).

**Verificação**

- Teste automático que falha se algum componente chamar o banco em modo demonstração.
- Fotos a 390×844 de cada papel, antes e depois de cada onda, em `/demo?view=customer|owner|partner|associate|employee|platform` (valores conferidos em `src/features/demo/roles.ts:34-69`). Em cada foto, conferir o cabeçalho (loja e selo), as abas e o menu da conta.
- Contas reais de teste, porque a demonstração não cobre vários papéis nem várias lojas. Cenários:
  - Admin que também é dono.
  - Dono numa loja e contratado em outra.
  - Cliente de duas lojas.
  - Cliente promovido a parceiro.
  - Contratado removido.
  - Admin sem loja.
- Para cada uma, conferir: o destino depois do login vindo de "Agendar", o `/` no domínio principal e no domínio da loja, a troca por "Minhas áreas" e a troca de loja sem resquício de permissões.
