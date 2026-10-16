# Passagem para a Claude — 15/10/2026

> **Concluída em 15/10/2026 (noite) no Claude Code.** O que foi feito e o que ficou estão na entrada "Passagem de 15/10" do [CONTINUIDADE.md](CONTINUIDADE.md) e no topo de [guia/pendencias.md](guia/pendencias.md). Este texto fica como registro: vários pontos abaixo ("sem commit", "último commit `aa5a358`", P-31/P-32/P-38 a fazer) já não valem.

Documento para continuar o Barba & Cabelo na Claude, no mesmo papel de [LEIA-PRIMEIRO.md](LEIA-PRIMEIRO.md) quando o trabalho veio da Claude para o Cursor. Atualizado na noite de **15/10/2026** (horário de Brasília).

**Recado para colar na Claude:**

> Leia `docs/passagem-claude-2026-10-15.md` inteiro antes de editar qualquer arquivo. Depois siga `docs/LEIA-PRIMEIRO.md`. Continue da seção "O que fazer agora". Não refaça o que esta página marca como já aplicado no servidor. Não descarte o trabalho que está no disco e ainda não entrou no Git.

## Onde paramos

O dono pediu, em 15/10, para fazer tudo o que ainda dava para fazer daqui e deixar pronto o que depender de outra pessoa. Um agente do Cursor começou. Parte foi para o servidor. Parte ficou no disco, sem commit e sem conferência na tela. Os guias [guia/pendencias.md](guia/pendencias.md) e [CONTINUIDADE.md](CONTINUIDADE.md) pararam na noite de **13/10** e ainda descrevem como pendente coisa que o servidor já tem.

Último commit publicado: `aa5a358` (`origin/main`), "Autossave (cursor): 6 arquivo(s)". Ele só registra o IP de login e os guias da noite de 13/10. **Não** contém o trabalho de 15/10 listado abaixo.

Última migration aplicada no banco: `20261014120000_registro_login_ip` (13/10, 18:59, Brasília). Nada de banco novo em 15/10.

## Já aplicado no servidor em 15/10 (não refazer)

Conferido por leitura nesta passagem, por volta das 20:45 de Brasília. Horários do servidor abaixo estão em UTC; 16:36 UTC = 13:36 em Brasília.

### P-67 — `PLATFORM_BASE_HOST` corrigido

- Container `supabase-edge-functions-z2dbb7dkyzhc8vjiywq34mhn`: o valor em execução é `beauty.contheiner.digital`.
- Arquivo `/data/coolify/services/z2dbb7dkyzhc8vjiywq34mhn/.env`: a mesma linha está certa.
- Cópia anterior: `/data/coolify/services/z2dbb7dkyzhc8vjiywq34mhn/.env.bak-p67-20261015-163639`.
- O registro da variável no Coolify foi atualizado às 16:36:45 UTC. O texto fica criptografado no banco do Coolify (256 caracteres), então esta passagem não leu o valor pela tabela. O arquivo e o container, que são o que as funções usam, estão certos.
- **Não** abrir Restart nem Redeploy do serviço para "conferir". Um Restart recria todos os containers do Supabase.
- Se um dia o container voltar a mostrar `dominios.beauty.contheiner.digital`, o passo a passo antigo está na P-67 de [guia/pendencias.md](guia/pendencias.md). Só então repetir. Enquanto estiver `beauty.contheiner.digital`, não mexer.

### P-27 — certificado de loja nova, rotina ligada

A proposta antiga da seção 6 de [implantacao-certificado-loja-2026-10-13.md](implantacao-certificado-loja-2026-10-13.md) era um arquivo em `/etc/cron.d/`. **Essa não foi a que entrou.** Entrou um timer do systemd, sem crontab e sem recriar o proxy.

- Timer `barba-cert-lojas.timer`: habilitado e ativo. Últimas rodadas (até 23:40 UTC) terminaram com sucesso: "Nada a acrescentar: todas as lojas ativas já têm roteador."
- Não existe `/etc/cron.d/barba-cert-lojas`. Não criar.
- Script instalado: `/usr/local/sbin/barba-cert-lojas-sync.sh`. O hash SHA-256 é o mesmo de `scripts/vps/cert-lojas-sync.sh` neste disco (`6a5f2944f9f2a79c02dc30307953086817a95729a7656ab7b1ea00bd0bd73ddd`).
- Unidades no servidor: `/etc/systemd/system/barba-cert-lojas.service` e `barba-cert-lojas.timer`.
- Lojas ativas que a rotina enxerga: `arena-barber`, `externabarbearia`, `loja-teste`, `loja-teste-b`. As quatro já têm roteador.
- Do Mac: `scripts/cert-loja-rotina.sh status`. Desligar, se um dia precisar: `scripts/cert-loja-rotina.sh desligar` (o script em `/usr/local/sbin` permanece).
- **Não** recriar o proxy do Coolify. Recriar à mão tira as redes e derruba as APIs (P-68, queda de ~2,5 min em 13/10).

O que falta da P-27 é só versionar e descrever: os três arquivos abaixo estão no disco e **não** estão no Git. A seção 6 do guia ainda diz "não instalada" e ainda ensina o cron. Corrigir o guia para descrever o systemd que já roda. Não instalar de novo.

## Trabalho no disco que não pode ser descartado

`git status` na noite de 15/10. Não apagar, não reverter e não sobrescrever para "começar limpo".

| Arquivo                                           | Situação                                                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/features/waiting/model.ts`                   | Função nova `waitOpportunities` (P-31)                                                               |
| `src/features/waiting/model.test.ts`              | Teste novo. `node --test src/features/waiting/model.test.ts`: 9 passaram, 0 falharam, nesta passagem |
| `src/features/waiting/WaitingUI.tsx`              | Modo "oportunidades" usa `waitOpportunities`                                                         |
| `src/features/customer/ArenaApp.tsx`              | "Qualquer profissional" vê as vagas de todos; aba Esportes usa `showSportsTab`                       |
| `src/features/customer/sports.ts`                 | **Arquivo novo**, não rastreado. Jogos fictícios saíram de `SportsBoard.tsx` para cá                 |
| `src/features/customer/SportsBoard.tsx`           | Passa a ler `sports.ts`                                                                              |
| `src/features/platform/ShopDetail.tsx`            | Dica no interruptor de Esportes                                                                      |
| `src/lib/i18n/messages/{pt-BR,pt-PT,en-US,es}.ts` | Só a chave nova `plat.shop.sportsHint`                                                               |
| `scripts/cert-loja-rotina.sh`                     | **Novo**, não rastreado. Instala o timer a partir do Mac                                             |
| `scripts/vps/barba-cert-lojas.service`            | **Novo**, não rastreado. Já está instalado na VPS                                                    |
| `scripts/vps/barba-cert-lojas.timer`              | **Novo**, não rastreado. Já está instalado na VPS                                                    |
| `.env`                                            | Alterado só na ordem das linhas. **Não entra em commit.** O `scripts/autossave.sh` já exclui `.env`  |

A tela **não** foi aberta no navegador nesta passagem. O teste automático cobre a conta da lista de espera, não o desenho da aba nem o celular.

Detalhe para não "corrigir" à toa: em `WaitingUI`, o modo oportunidades chama `waitOpportunities` com `staffId` nulo. Quem filtra o profissional escolhido é o `ArenaApp`, antes de passar a lista. Os dois filtros juntos funcionam no teste da função. Ao fechar a P-31, deixar uma conta só e conferir na tela os dois casos: um profissional escolhido, e "Qualquer profissional".

`sports_enabled` está desligado nas quatro lojas (Arena, Externa, Loja Teste e Loja Teste B). Publicar o trecho de Esportes não esconde uma aba que alguém já usa hoje.

## Decisões de 15/10 — não perguntar de novo

O dono pediu para seguir. Estas opções ficaram combinadas nesta conversa. [guia/pendencias.md](guia/pendencias.md) ainda lista várias como "a decidir". Tratar como decididas.

| Id              | Decisão                                                                                                                                                                                                                           | No código / no servidor                                                                                                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-31            | Quem escolhe "Qualquer profissional" vê as vagas da lista de espera de todos os barbeiros. Cada vaga usa a duração daquele profissional. Se ele não faz o serviço, a vaga não aparece.                                            | Começado nos arquivos da tabela acima. Falta conferir na tela e publicar.                                                                                                                                                                                       |
| P-32            | A aba deixa de se chamar "Reservas". pt-BR: **Meus agendamentos**. Se não couber na barra a 320 px, a barra mostra **Agendamentos**. pt-PT: **As minhas marcações**. en-US: **My appointments** (en-GB herda). es: **Mis citas**. | **Não feito.** `nav.bookings` continua "Reservas" / "Marcações" / "Bookings" / "Reservas".                                                                                                                                                                      |
| P-33            | A aba Esportes só aparece com o módulo ligado pela plataforma **e** com pelo menos um jogo acontecendo ou por vir. Jogo encerrado não conta.                                                                                      | `showSportsTab` está no disco. Fora da demonstração, `sportsMatches()` devolve lista vazia: **não existe cadastro de jogos de verdade**. No app real a aba continua oculta mesmo com o módulo ligado. Não inventar API de placar, não integrar serviço externo. |
| P-34            | Não há bônus de pontos no check-in em dia de jogo.                                                                                                                                                                                | Nada a programar. Só registrar na pendência.                                                                                                                                                                                                                    |
| P-35 e P-50     | O acerto com o Parceiro continua fora do app. Sem comissão, aluguel de cadeira nem cobrança aqui.                                                                                                                                 | Nada a programar. Só registrar.                                                                                                                                                                                                                                 |
| P-37            | O profissional que abre o app da própria loja continua ganhando ficha de cliente, com o aviso que já existe.                                                                                                                      | Nada a mudar. Só registrar.                                                                                                                                                                                                                                     |
| P-38            | No cadastro da barbearia, perguntar se o dono quer avisos por WhatsApp. A opção já vem marcada. A função não pode mais gravar o aceite sempre ligado, ignorando a tela.                                                           | **Não feito.** `supabase/functions/register-shop/index.ts` ainda manda `p_opt_in: true` (por volta da linha 122).                                                                                                                                               |
| P-26            | A tarefa do crontab do root que chama `google-drive/share-expire` fica como está. É de outro projeto.                                                                                                                             | Não apagar. Só registrar a decisão.                                                                                                                                                                                                                             |
| P-27            | Timer a cada 10 minutos, systemd, sem cron, sem recriar o proxy.                                                                                                                                                                  | **Aplicado na VPS.** Falta o Git e o guia.                                                                                                                                                                                                                      |
| P-67            | `PLATFORM_BASE_HOST` = `beauty.contheiner.digital` no Coolify, no `.env` do serviço e no container das funções.                                                                                                                   | **Aplicado.** Não repetir.                                                                                                                                                                                                                                      |
| P-70            | Pausa fixa da loja toda, quando a sociedade exige aprovação, continua para depois do primeiro uso real.                                                                                                                           | Não fazer agora.                                                                                                                                                                                                                                                |
| Reinício da VPS | Não testar. O mesmo servidor tem outros projetos.                                                                                                                                                                                 | Só registrar que o teste não foi feito.                                                                                                                                                                                                                         |

Continua em aberto de propósito, sem decisão nova: P-14 (opcional), P-30 (manter "Toda semana"), P-36 (sugestão: não trocar de domínio ao mudar de loja), P-39 (acordo de dados, revisão de advogado), P-45 (dividir o pacote), P-49 (reembolso, sem meio de pagamento).

## O que fazer agora, nesta ordem

1. `git pull --ff-only origin main`. Se falhar, não editar.
2. `scripts/vez.sh pedir claude-code "continuar a passagem de 15/10"`. Se a resposta for que a vez está com outra ferramenta, esperar. Antes de cada edição: `scripts/vez.sh checar claude-code`.
3. Preservar os arquivos da tabela acima. Completar em cima deles.
4. **P-31.** Conferir no navegador, no tamanho de celular: um profissional escolhido vê só as vagas dele; "Qualquer profissional" vê as de todos, e some a vaga de quem não faz o serviço ou cuja duração não cabe. Demonstração (`/demo`) serve para a conta. Se for na Loja Teste, não deixar dados de teste para trás.
5. **P-32.** Trocar `nav.bookings` nos quatro dicionários. Abrir a barra em 320 px e, se "Meus agendamentos" não couber, usar o texto curto só na barra. en-GB não tem arquivo próprio.
6. **P-33.** Deixar como está no disco: aba só com módulo e jogo ao vivo ou futuro; sem fonte real, a aba não aparece fora da demonstração. Completar o registro. Não criar integração.
7. **P-38.** Pergunta no cadastro, já marcada, texto nos quatro dicionários. A função `register-shop` grava o que a pessoa escolheu. Antes de publicar: cópia da função em `/root/functions-backup-<data>/`, publicar só essa função, reiniciando só o container das funções. Não usar Redeploy. Sem login, a função já responde 400 ("Informe um WhatsApp válido"); repetir essa conferência. Não criar loja real para testar.
8. Registrar no [guia/pendencias.md](guia/pendencias.md) e no [CONTINUIDADE.md](CONTINUIDADE.md) as decisões que são só registro (P-26, P-34, P-35, P-37, P-50, P-70, reinício não feito) e o que ficou aplicado (P-27, P-67). Não renumerar. O próximo id livre continua **P-71** se nascer item novo. Atualizar a seção 6 do guia do certificado: systemd instalado; a proposta de `/etc/cron.d/` não vale mais.
9. Versionar os três scripts novos junto com o código. Não versionar `.env` nem arquivo `._*`.
10. `scripts/verificar.sh`. Se passar, o autossave envia ao `origin` e **publica o site**. Não terminar com a tela quebrada.
11. Ao terminar: `scripts/vez.sh liberar claude-code` (o autossave já libera).

## O que não é com a Claude — pacotes para encaminhar

Estes pontos não se resolvem no repositório nem na VPS. O dono (ou um agente com acesso à conta indicada) executa. Não há senha nem chave neste texto.

### Pacote A — Google Cloud, tirar o retorno antigo (P-69)

Quem executa: alguém com acesso ao projeto Google Cloud **`proh-media-drive`**. No servidor e no código este retorno já não existe. Conferido em 13/10.

1. Abrir Google Cloud Console → APIs e serviços → Credenciais.
2. Abrir o cliente OAuth do tipo Web usado pelo app.
3. Em **URIs de redirecionamento autorizados**, apagar só esta linha: `https://supabase-teste.proh.media/auth/v1/callback`.
4. Manter estas duas: `https://supabasebeauty.contheiner.digital/auth/v1/callback` e `https://beauty.contheiner.digital/auth/google-apps`.
5. Salvar.
6. Se `proh.media` estiver em "Domínios autorizados" da tela de consentimento só por causa daquele endereço, anotar e avaliar a retirada **antes** de reenviar a verificação (pacote B). Não apagar domínio no escuro.
7. Como saber que deu certo: "Entrar com Google" uma vez no site `https://beauty.contheiner.digital` abre a conta Google e volta ao app. O endereço `supabase-teste.proh.media` não aparece na lista de retornos.
8. Como desfazer: recolocar a URI apagada e salvar. Não muda banco nem servidor.

### Pacote B — reenviar a verificação do login e da Agenda Google (P-28)

Quem executa: a mesma conta Google, projeto `proh-media-drive`, com alguém para gravar o vídeo. Guia completo, com o roteiro do vídeo e o que o revisor precisa ver: [google-verificacao.md](google-verificacao.md).

Resumo do que falta, sem refazer o que o código já tem desde 03/10:

- A política de privacidade foi corrigida; a página pública é `https://beauty.contheiner.digital/privacidade?lang=en#dados-google`.
- Falta gravar o vídeo em inglês, com a tela de consentimento e o `client_id` visível na barra de endereço, mostrando Agenda (lista, importar, copiar um horário) e Contatos (salvar um contato), e a desconexão.
- Reenviar no Verification Center. Não criar outro cliente OAuth. Não trocar o projeto.

### Pacote C — só o dono, no uso real

Não há configuração de terceiro. Fica para quando o dono quiser testar de verdade. Roteiro da loja de teste: [testes-reais-loja-teste.md](testes-reais-loja-teste.md). Senhas só nas Chaves do macOS, serviço "Barba e Cabelo - Loja Teste". Não copiar senha para documento.

- **P-42:** WhatsApp real (código e confirmação), login Google real, Agenda Google com conta real, cadastro de ponta a ponta, foto real de serviço e de profissional, `/shop/pontos` com o dono.
- **P-43:** celular físico (teclado, safe area do iOS, leitor de tela, rede lenta, app instalado).
- **P-40, o que a Loja Teste não fechou:** painel `/platform` com a conta de administrador do dono; sociedade 50/50 pela tela; troca "Minhas áreas" e o aviso de estar no endereço de uma loja trabalhando em outra.
- **P-39:** advogado para o rascunho `/acordo-de-dados` (foro, RGPD, artigos citados no próprio texto). Não publicar como definitivo.

## Regras que já causaram prejuízo

- Enviar ao `origin` publica o site. O espelho copia o `origin` por cima do `hostinger`. Nunca enviar só ao `hostinger`. Nunca `git push --force` na `main`.
- Não commitar `.env` nem arquivo `._*` do macOS. Se aparecer erro "non-monotonic index" no Git, a causa conhecida é `._pack-*.idx` em `.git/objects/pack`.
- Não usar Redeploy no Coolify. Não recriar o proxy à mão. Se o proxy for recriado, religar na hora as redes dos serviços (P-68) ou usar "Restart Proxy" do painel.
- Não reiniciar a VPS para teste.
- Não mexer no outro projeto da mesma VPS (`vv3jo93anprhqezhtu4ewcpl`, `supabase.proh.media`), no stack Flow TEST, no `supabase-teste`, no crontab do root, nem no DNS de `externabarbearia.com.br`.
- Não alterar dados reais da Arena nem da Externa. Loja Teste e Loja Teste B podem receber teste; limpar o que o teste criou.
- Não imprimir senha, chave, token nem conteúdo do `.env`.
- Backup com `pg_dump` em `/root/backup-barba-cabelo-*.dump` antes de migration. Ensaio em `BEGIN … ROLLBACK`. Nunca rodar arquivo de `supabase/tests/` fora de transação.
- Acesso SSH desta máquina: apelido `vps-barba`. Banco: container `supabase-db-z2dbb7dkyzhc8vjiywq34mhn`. Stack: `z2dbb7dkyzhc8vjiywq34mhn`.
- Site: `https://beauty.contheiner.digital`. API: `https://supabase-barbearia.proh.media`. Loja Teste: `https://loja-teste.beauty.contheiner.digital`.
- TanStack Start permanece travado em `>=1.167.50 <1.169.0` (P-55). Não soltar a faixa.
- Texto novo de tela entra em `src/lib/i18n/messages/` nos quatro idiomas. pt-BR é a fonte. en-GB herda en-US.
- Idioma com o dono e nos commits: português do Brasil.

## O que esta passagem não conferiu

- Nenhuma tela no navegador.
- O texto descriptografado da variável dentro do painel do Coolify (só a data de gravação, o `.env` e o container).
- Login Google, WhatsApp real e celular físico.
- Se o pacote A ainda encontra a URI antiga: isso só o console do Google mostra.
