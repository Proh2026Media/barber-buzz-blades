# Passagem para o Claude Code (aplicativo) — 21/10/2026

Documento para continuar o Barba & Cabelo no **Claude Code como programa** (aplicativo de computador ou terminal), saindo da extensão do Claude Code dentro do Cursor. Atualizado em 21/10/2026, 20:06 (horário de Brasília).

**Recado para colar no Claude Code:**

> Leia `docs/passagem-claude-code-app-2026-10-21.md` inteiro antes de editar qualquer arquivo. Depois siga `docs/LEIA-PRIMEIRO.md`. Continue da seção "O que fazer agora". Não refaça o que esta página marca como já aplicado. Responda sempre em português do Brasil.

## Onde paramos

É o mesmo Claude Code e a mesma pasta, só que fora do Cursor. Nada se perde se o aplicativo abrir **a mesma pasta**:

- `/Volumes/Alyson 1TB/OpenDesign/Barba & Cabelo`

Com ela, a memória do projeto é a mesma (`~/.claude/projects/-Volumes-Alyson-1TB-OpenDesign-Barba---Cabelo/memory/`), e o `AGENTS.md` e as skills de `~/.claude/skills/` também.

A última entrega foi a de 16/10/2026:

- agendamento pelo barbeiro no painel ("Agendar" e "Agendar aqui");
- cliente do balcão, com apelido e convite para o app;
- selo de cliente recorrente;
- login com Google no app instalado;
- simplificação visual, com coluna lateral no computador.

A entrega passou por quatro rodadas de revisão. Detalhes na entrada de 16/10 do [CONTINUIDADE.md](CONTINUIDADE.md) e em [analise-visual-2026-10-16.md](analise-visual-2026-10-16.md).

- **Último commit publicado:** `c1224f0` ("Registro: migrations 95 e 96 e google-calendar-dispatch aplicadas no servidor (20/10)"). O código da entrega está em `40d6c98` (16/10, 07:11).
- **Banco:** última migration aplicada em produção é `20261016130000_agendamento_pelo_painel`, em 20/10/2026, 20:04 de Brasília, pelo TI.
- **Função** `google-calendar-dispatch` na versão `9813ec59…`.

## Já aplicado (não refazer)

- **Migrations nº 95 e 96 e função `google-calendar-dispatch`** (P-73), em 20/10/2026, 20:02–20:08 de Brasília, pelo TI, com o pacote [implantacao-agendamento-painel-2026-10-16.md](implantacao-agendamento-painel-2026-10-16.md).
  - Conferido pelo Claude Code em 20/10, só lendo: 14 funções novas, gatilhos `memberships_link_shop_clients` e `appointments_guard_client_columns`, chave `appointments_shop_client_fkey`, permissões e API pública.
  - Backup do banco: `/root/backup-barba-cabelo-20261020-230246.dump`.
  - Se um dia a consulta de funções novas do passo 2 desse pacote der 0, algo foi desfeito: parar e investigar. Enquanto der 14, não mexer.
- **Site publicado** com o código da entrega (Hostinger, a partir do `origin`). Os avisos "Avisar hub" e "Avisar blindagem" do GitHub rodaram com sucesso em 16/10 e 20/10.

## Trabalho no disco que não pode ser descartado

| Arquivo | Situação                                                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.env`  | Modificado localmente, de propósito. Tem as chaves do app e **nunca** vai para o Git (o `scripts/autossave.sh` já o exclui). Não restaurar nem apagar. |

Fora isso, o disco está igual ao `origin/main`. Os arquivos `._*` espalhados pela pasta (inclusive dentro de `.git`) são do macOS no disco externo. Geram o aviso "non-monotonic index" no git e são inofensivos: não corrigir à toa.

## Decisões — não perguntar de novo

| Id              | Decisão                                                                                                                                      | Situação       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Ferramenta      | O dono deixa a extensão no Cursor e usa o Claude Code como programa (21/10/2026)                                                             | Esta passagem  |
| Banco local     | Testar migrations na cópia local com `scripts/banco-local.sh` (Docker) só quando houver migration nova; o servidor do app **não usa Docker** | Feito          |
| Servidor do app | `npm run dev -- --port 8090 --host`, acessível na rede local; usa o Supabase de produção (dados reais)                                       | Comando abaixo |

**Em aberto, de propósito (decisões do dono):**

- P-74: o que passa para o admin global;
- P-76: pontos retroativos do cliente do balcão;
- P-77: o que o profissional vê ao buscar pelo número;
- P-71: "reserva" × "agendamento";
- a cópia do backup do banco que ficou no computador do TI (tem dados pessoais): guardar com cuidado ou apagar.

## O que fazer agora, nesta ordem

1. **Abrir o projeto no Claude Code** na pasta `/Volumes/Alyson 1TB/OpenDesign/Barba & Cabelo`, nunca uma cópia dela.
2. **Fechar o Cursor, ou não abrir este projeto nele.** Os ganchos de `.cursor/hooks.json` pegam a vez como "cursor" ao abrir o projeto e fazem autossave (que publica o site) ao fim de cada resposta do agente do Cursor. Se a vez ficar presa no Cursor, rode `scripts/vez.sh status`. Só com o Cursor fechado, libere com `scripts/vez.sh liberar cursor`.
3. **No começo de cada sessão:** `git pull --ff-only origin main`, depois `scripts/vez.sh pedir claude-code "o que vai fazer"`. Antes de cada edição: `scripts/vez.sh checar claude-code`. Ao terminar: `scripts/verificar.sh`, depois `scripts/autossave.sh claude-code` (envia ao `origin`, publica o site e devolve a vez). Regras completas em `AGENTS.md`, seção 9.
4. **Servidor local**, quando o dono pedir, sem Docker:
   ```bash
   cd "/Volumes/Alyson 1TB/OpenDesign/Barba & Cabelo"
   npm run dev -- --port 8090 --host
   ```
   Esperado: `Local: http://localhost:8090/` e `Network: http://<IP do Mac>:8090/`. O IP muda com a rede: nos últimos dias foi 192.168.3.70, 192.168.155.104 e 192.168.68.102. O servidor para quando a sessão fecha.
5. **Teste do dono no celular (P-43)**, a primeira pendência real:
   - no painel da barbearia, o botão **Agendar** no topo da Agenda e o **Agendar aqui** nos horários livres;
   - agendar um cliente pelo WhatsApp, tanto um que já tem conta (o nome entra sozinho) quanto um sem cadastro (convite);
   - no iPhone, com o app instalado na tela de início, **Continuar com Google**: a janela do Google pede para fechar e o app entra sozinho;
   - a lista de espera com "Qualquer profissional" (P-31, nunca conferida em aparelho físico).

   Se algo falhar, pedir ao dono o passo exato e uma captura de tela.

6. **Depois, pela ordem de [guia/pendencias.md](guia/pendencias.md), seção 1:**
   - P-69 e P-28 (Google Cloud, pacotes prontos, só o dono acessa);
   - P-71 (decisão);
   - P-75 (próximas simplificações visuais);
   - P-78 (desistência no Google no iPhone).
7. **Ao terminar cada entrega:** atualizar [CONTINUIDADE.md](CONTINUIDADE.md) e [guia/pendencias.md](guia/pendencias.md), verificar e publicar como no item 3.

## O que não é com o Claude Code — pacotes para encaminhar

- **P-69:** tirar o retorno `supabase-teste` do cliente OAuth no Google Cloud. Pacote: [pacotes/2026-10-15-google-retorno-antigo-p69.md](pacotes/2026-10-15-google-retorno-antigo-p69.md).
- **P-28:** gravar o vídeo e reenviar a verificação do Google, depois da P-69. Pacote: [pacotes/2026-10-15-google-reenviar-verificacao-p28.md](pacotes/2026-10-15-google-reenviar-verificacao-p28.md).
- **Migration nova no futuro:** aplicada pelo agente do servidor, com um pacote no modelo de [implantacao-agendamento-painel-2026-10-16.md](implantacao-agendamento-painel-2026-10-16.md), gerado pela skill `pacote-para-agente`. O Claude Code não aplica migration em produção.

## Regras que já causaram prejuízo

- **Só uma ferramenta edita por vez (a vez).** Editar sobre cópia desatualizada já apagou entregas publicadas.
- **Enviar só ao `origin`, nunca só ao `hostinger`, e nunca `git push --force`.** O espelho copia o `origin` por cima; foi o que tirou do site as entregas de 26 a 29/09.
- **`.env` nunca no Git.** Não imprimir senhas, chaves nem tokens.
- **Testes de `supabase/tests/` só dentro de `BEGIN … ROLLBACK`.** Em 03/10 um teste rodado fora deixou dados em produção.
- **No Coolify, nunca "Restart" nem "Redeploy" do serviço.** Isso recria todos os containers do Supabase; reiniciar só o container das funções quando for preciso. Não recriar o proxy (incidente de 13/10, P-68). Não reiniciar a VPS.
- **Não mexer no outro projeto da VPS** (`vv3jo93anprhqezhtu4ewcpl`, `supabase.proh.media`), no `supabase-teste`, no crontab do root nem no DNS de `externabarbearia.com.br`. Não alterar dados reais de Arena e Externa.
- **Migration:** `pg_dump` antes, ensaio em `BEGIN … ROLLBACK` e uma por vez em transação.
  - Dentro de `ssh … 'bash -s' <<'EOF'`, comando com `-c` vai sem `-i`, senão consome o resto do script (aconteceu em 20/10).
- **Acessos, sem segredos:**
  - VPS pelo apelido `ssh vps-barba`;
  - banco no container `supabase-db-z2dbb7dkyzhc8vjiywq34mhn`;
  - funções no container `supabase-edge-functions-z2dbb7dkyzhc8vjiywq34mhn`;
  - API em `https://supabase-barbearia.proh.media`;
  - site em `https://beauty.contheiner.digital`.
  - Escrita remota na VPS só com autorização do dono; leitura para conferir é permitida.

## O que esta passagem não conferiu

- **Se o aplicativo carrega o `AGENTS.md` sozinho** (a extensão carregava). Na primeira sessão, peça "resuma as regras do projeto". Se ele não citar a vez nem o português do Brasil, crie um `CLAUDE.md` na raiz com a linha `@AGENTS.md`.
- **O teste em aparelho físico e o login real com Google** depois da aplicação de 20/10 (P-43).
- **O estado do Cursor** (aberto ou fechado) e de quem estará com a vez quando o aplicativo abrir.
