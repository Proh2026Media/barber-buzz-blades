# Passagem para o ChatGPT — 24/10/2026

Documento para continuar o **Barba & Cabelo** no ChatGPT, saindo do Claude Code. Atualizado em 24/10/2026, 15:33 (horário de Brasília). Escrito para valer nos dois casos: o ChatGPT com acesso ao repositório (Codex ou ferramenta parecida) ou só um chat em que este texto é colado.

**Recado para colar no ChatGPT:**

> Leia `docs/passagem-chatgpt-2026-10-24.md` inteiro antes de editar qualquer arquivo. Depois siga `docs/LEIA-PRIMEIRO.md` e os guias em `docs/guia/`. Continue da seção "O que fazer agora". Não refaça o que esta página marca como já aplicado. Responda sempre em português do Brasil. Se você não tiver acesso ao repositório, diga isso na primeira resposta e trabalhe só com o que está neste texto.

## O que é o projeto (para quem chega sem nada)

App de agendamento e fidelidade **multiloja** para barbearias e salões, uso principal no celular. Front em TanStack Start (React + Vite + Tailwind v4), Supabase auto-hospedado no Coolify (VPS) e site publicado no Hostinger a partir do GitHub. Pasta no Mac do dono: `/Volumes/Alyson 1TB/OpenDesign/Barba & Cabelo`. Documentação em `docs/`: porta de entrada `docs/LEIA-PRIMEIRO.md`; guias em `docs/guia/` (como trabalhar, pendências, arquitetura, papéis, banco e implantação, histórico); diário de entregas `docs/CONTINUIDADE.md`; diretrizes de interface `docs/mb-interface.md`. Regras do repositório em `AGENTS.md` (o ChatGPT não lê sozinho: as que importam estão copiadas abaixo).

## Onde paramos

- **Última entrega (21–22/10/2026, Claude Code):** "interface por dispositivo". O dono pediu que tablet e computador fossem desenhados para cada aparelho, e não o celular esticado. Resultado: três faixas oficiais (celular até 767 px com a barra no pé, como sempre; tablet 768–1279 px com coluna lateral estreita de ícones; computador a partir de 1280 px com coluna lateral completa) e cada área refeita para a largura (Agenda, Serviços/Equipe/Horários, Ajustes em mestre-detalhe, app do cliente, plataforma, páginas públicas). O celular não mudou (fotos de 390 px comparadas pixel a pixel). Plano e decisões: `docs/dispositivos-2026-10-21.md`; registro: entradas de 22/10 em `docs/CONTINUIDADE.md`.
- **Depois, na mesma data (22/10, manhã):** P-79, o quadro da equipe passou a aparecer no tablet em pé.
- **Último commit publicado:** `9bbb55d` — "P-79: quadro da equipe no tablet em pé e rolagem até 'agora'" (22/10/2026, 17:26 de Brasília). Antes dele, `8ad4869` (22/10, 02:48) é a entrega por dispositivo inteira (107 arquivos). O site `https://beauty.contheiner.digital` já serve os dois (conferido em 24/10 pelo nome do CSS no HTML).
- **Banco:** última migration aplicada em produção continua `20261016130000_agendamento_pelo_painel` (aplicada em 20/10/2026, 20:04 de Brasília, pelo TI). Não houve migration nova desde então; a entrega por dispositivo foi só interface.
- **Função** `google-calendar-dispatch` na versão `9813ec59…` (20/10).
- **Disco:** igual ao `origin/main`, exceto `.env` (ver abaixo). Nenhum trabalho pendente fora do Git.
- **Teste do dono:** em 22/10 o dono ia testar no iPad e no computador enquanto a P-79 era feita. **Não se sabe o resultado** (nada foi relatado ao Claude). Perguntar ao dono é o primeiro passo.

## Já aplicado (não refazer)

| O quê                                                                                                      | Quando                                | Como foi conferido                                                                                                                             | Sinal de que precisaria repetir                                                                                                  |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Interface por dispositivo (commit `8ad4869`)                                                               | 22/10/2026, 02:48 (BR)                | `scripts/verificar.sh` completo (tipos, 285 testes, eslint, prettier, montagem); fotos em 390/768/1024/1280/1536                               | Se `git log` não mostrar `8ad4869` em `origin/main`, algo foi desfeito: parar e avisar o dono                                    |
| P-79: quadro da equipe desde 768 px, coluna do dia recolhida em 1024–1279, rolagem até "agora" (`9bbb55d`) | 22/10/2026, 17:26 (BR)                | Idem; revisor independente no navegador                                                                                                        | Idem                                                                                                                             |
| Migrations nº 95 e 96 e `google-calendar-dispatch` no servidor (P-73)                                      | 20/10/2026, 20:02–20:08 (BR), pelo TI | Conferido só lendo: 14 funções novas, gatilhos, chave `appointments_shop_client_fkey`; backup `/root/backup-barba-cabelo-20261020-230246.dump` | Se a consulta de funções novas do pacote `docs/implantacao-agendamento-painel-2026-10-16.md` (passo 2) der 0: parar e investigar |

## Trabalho no disco que não pode ser descartado

| Arquivo | Situação                                                                                                                                                                                  |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env`  | Modificado de propósito; tem as chaves do app e **nunca** vai para o Git (`scripts/autossave.sh` já o exclui). Não restaurar, não apagar, não copiar valores para documento ou relatório. |

Detalhes que parecem erro e não são: os arquivos `._*` espalhados pela pasta (inclusive dentro de `.git`) são do macOS no disco externo e geram o aviso `non-monotonic index` no git. Inofensivos; não corrigir à toa. A pasta `.claude/launch.json` está no `.gitignore` de propósito.

## Decisões — não perguntar de novo

| Id / tema      | Decisão                                                                                                                                                                                    | Situação                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Faixas         | celular < 768 px · tablet 768–1279 px · computador ≥ 1280 px; os mesmos números no CSS (`tablet:`, `pc:`) e no JavaScript (`useDevice` em `src/lib/device.ts`)                             | Feito                                                                          |
| Regra de ouro  | **Abaixo de 768 px nada muda sem pedido do dono.** Toda regra nova fica atrás de `tablet:`/`lg:`/`pc:` ou `@media (min-width: 768px)`                                                      | Vale daqui em diante                                                           |
| Tablet         | Coluna lateral estreita (6rem, ícone sobre o nome) no lugar da barra no pé; muda a decisão de 16/10. Reverter = subir o `@media (min-width: 768px)` da casca em `src/styles.css` para 1024 | Feito; **o dono ainda não disse se gostou** (ver "O que fazer agora", passo 2) |
| Toque × mouse  | Decidido pela largura; só tamanhos de alvo olham `pointer: fine` (36 px com mouse em alguns botões; toque continua com 44 px)                                                              | Feito                                                                          |
| Ferramenta     | Em 21/10 o dono passou do Cursor para o Claude Code; em 24/10 passa para o ChatGPT                                                                                                         | Esta passagem                                                                  |
| Servidor local | `npm run dev -- --port 8090 --host`, sem Docker; usa o Supabase de produção (dados reais)                                                                                                  | Comando abaixo                                                                 |
| Banco local    | Testar migrations na cópia local com `scripts/banco-local.sh` (Docker) só quando houver migration nova                                                                                     | Feito                                                                          |

**Em aberto, de propósito (decisões do dono):** P-71 ("reserva" × "agendamento" no resto do app); P-74 (o que passa para o admin global); P-76 (pontos retroativos do cliente do balcão); P-77 (o que o profissional vê ao buscar pelo número); P-92 (campo e prévia lado a lado só a partir de 1536 px em Ajustes e Relatórios); P-95 (folha inferior padronizada no celular, que é mudança de celular); e a cópia do backup do banco que ficou no computador do TI (tem dados pessoais: guardar com cuidado ou apagar).

## O que fazer agora, nesta ordem

1. **Antes de editar qualquer arquivo** (regra do repositório, seção 9 do `AGENTS.md`):

   ```bash
   cd "/Volumes/Alyson 1TB/OpenDesign/Barba & Cabelo"
   git pull --ff-only origin main
   scripts/vez.sh pedir chatgpt "o que vai fazer"
   ```

   Esperado: `Already up to date.` (ou um avanço rápido) e `vez: com chatgpt`. Se o `pull` falhar, **não edite** até a conexão voltar. Se responder `vez: com outra`, espere; a vez vence sozinha após 30 min sem renovação (`scripts/vez.sh status` mostra quem está com ela). Antes de cada edição: `scripts/vez.sh checar chatgpt`. Se o ChatGPT não tiver terminal nem repositório, pule esta seção e trabalhe só em orientação e texto: quem editar no Mac cumpre a regra.

2. **Perguntar ao dono o resultado do teste no iPad e no computador** (P-43). Em 22/10 ele ia testar; não há registro. O que olhar está na entrada "22/10/2026 — Interface por dispositivo" do `docs/CONTINUIDADE.md`, seção "O que o dono precisa testar". Se algo falhou: pedir o passo exato, a largura ou o aparelho e uma captura de tela, e corrigir **sem mexer no celular**. Se o dono não gostar da coluna estreita no tablet em pé, a reversão é só a faixa de CSS citada na tabela de decisões.

3. **P-90 — Agendar do cliente no tablet em pé (768–1023 px):** a última tela que ainda parece celular esticado nessa faixa. Onde: `src/features/customer/ArenaApp.tsx` (`wideBooking = useViewportAtLeast(1024)`), `src/features/customer/booking/BookingParts.tsx` (`DayStrip`, `DayCalendar`) e `src/styles/cliente.css`. Pronto quando: no iPad em pé os passos Serviço e Profissional ficam abertos (sem recolher em resumo com "Trocar"), o dia usa o calendário do mês ou a faixa de dias fecha no chip inteiro, e nada muda abaixo de 768. Conferir com fotos em 390 (igual ao antes), 768 e 1024.

4. **Depois, pela ordem da seção 1 de `docs/guia/pendencias.md`:** P-69 e P-28 são do dono (Google Cloud; pacotes prontos em `docs/pacotes/`); P-71 é decisão do dono; em seguida a seção 9 das pendências (P-80 em diante: ordenação nas tabelas, "Mais números do dia" em tiles, prévias por aparelho, cabeçalho em três zonas, etc.). Não renumerar pendências: item resolvido vira **feito** com a data; item novo recebe o próximo número livre (hoje o último é **P-95**).

5. **Ao terminar cada entrega:** registrar no topo de `docs/CONTINUIDADE.md` (modelo na seção 4 de `docs/guia/como-trabalhar.md`), atualizar `docs/guia/pendencias.md`, e só então:

   ```bash
   scripts/verificar.sh
   scripts/autossave.sh chatgpt
   ```

   O `verificar.sh` roda tipos, testes, eslint, prettier e a montagem; tem que terminar com `verificar: tudo ok.`. O `autossave.sh` faz o commit, envia ao `origin`, **publica o site** e devolve a vez. Um commit descritivo antes dele (`git commit -m "…"`) evita a mensagem genérica "Autossave (chatgpt): N arquivo(s)". Nunca envie trabalho quebrado nem arquivos soltos (`.fotos/`, rascunhos).

6. **Servidor local, quando o dono pedir** (sem Docker):

   ```bash
   cd "/Volumes/Alyson 1TB/OpenDesign/Barba & Cabelo"
   npm run dev -- --port 8090 --host
   ```

   Esperado: `Local: http://localhost:8090/` e `Network: http://` seguido do IP do Mac na rede e `:8090/` (nos últimos dias o IP foi 192.168.3.70; muda com a rede). Fotos de tela com `node scripts/foto.mjs /demo?view=owner --largura 768 --altura 1024 --pagina-inteira` (manual em `scripts/README.md`, inclusive as dicas de 22/10: como clicar nos itens da coluna lateral e o comparador pixel a pixel `scripts/comparar-png.mjs`).

## O que não é com o ChatGPT — pacotes para encaminhar

- **P-69:** tirar o retorno `supabase-teste` do cliente OAuth no Google Cloud. Pacote pronto: `docs/pacotes/2026-10-15-google-retorno-antigo-p69.md` (só o dono acessa o console).
- **P-28:** gravar o vídeo e reenviar a verificação do Google, depois da P-69. Pacote: `docs/pacotes/2026-10-15-google-reenviar-verificacao-p28.md`.
- **Migration nova no futuro:** aplicada pelo agente do servidor, com um pacote no modelo de `docs/implantacao-agendamento-painel-2026-10-16.md`. **Nenhuma ferramenta de código aplica migration em produção.**

## Regras que já causaram prejuízo

- **Só uma ferramenta edita por vez (a vez).** Editar sobre cópia desatualizada já apagou entregas publicadas. Fechar o Cursor, ou não abrir este projeto nele: os ganchos de `.cursor/hooks.json` pegam a vez como "cursor" sozinhos e publicam o site ao fim de cada resposta.
- **Enviar só ao `origin`, nunca só ao `hostinger`, e nunca `git push --force`.** O espelho copia o `origin` por cima; foi o que tirou do site as entregas de 26 a 29/09.
- **`.env` nunca no Git.** Não imprimir senhas, chaves nem tokens em respostas, documentos ou commits.
- **Testes de `supabase/tests/` só dentro de `BEGIN … ROLLBACK`.** Em 03/10 um teste rodado fora deixou dados em produção.
- **No Coolify, nunca "Restart" nem "Redeploy" do serviço.** Isso recria todos os containers do Supabase; reiniciar só o container das funções quando for preciso. Não recriar o proxy (incidente de 13/10, P-68). Não reiniciar a VPS.
- **Não mexer no outro projeto da VPS** (`vv3jo93anprhqezhtu4ewcpl`, `supabase.proh.media`), no `supabase-teste`, no crontab do root nem no DNS de `externabarbearia.com.br`. Não alterar dados reais de Arena e Externa.
- **Migration:** `pg_dump` antes, ensaio em `BEGIN … ROLLBACK` e uma por vez em transação. Dentro de `ssh … 'bash -s' <<'EOF'`, comando com `-c` vai sem `-i`, senão consome o resto do script (aconteceu em 20/10).
- **Interface:** `src/styles.css` fica fora de `@layer` e vence utilitários do Tailwind; a regra global força 44 px em qualquer botão; os cantos usam `!important`; a classe `bg-card` força cor escura (tirar o cartão só com fundo transparente quebra o tema escuro). Texto novo de interface só pelo dicionário `src/lib/i18n/messages/*.ts`, nos cinco idiomas (en-GB herda do en-US). Três modos de canto e dois temas em tudo que é novo. Detalhes em `docs/guia/arquitetura.md`, seções 8 e 16.
- **Acessos, sem segredos:** VPS pelo apelido `ssh vps-barba`; banco no container `supabase-db-z2dbb7dkyzhc8vjiywq34mhn`; funções no container `supabase-edge-functions-z2dbb7dkyzhc8vjiywq34mhn`; API em `https://supabase-barbearia.proh.media`; site em `https://beauty.contheiner.digital`. Escrita remota na VPS só com autorização do dono; leitura para conferir é permitida.

## O que esta passagem não conferiu

- **O resultado do teste do dono** no iPad, no computador e no celular físico depois de 22/10 (P-43): não há registro.
- **O que o ChatGPT alcança:** esta passagem supõe o caso mais limitado (só o texto colado, sem repositório). Se ele tiver acesso ao repositório, tudo aqui continua valendo; os comandos passam a ser dele.
- **Se o Cursor está fechado** no momento em que o ChatGPT começar: conferir com `scripts/vez.sh status`.
- **Fotos e comparações de 22/10** ficaram numa pasta temporária que o sistema apaga; o que ficou no repositório é o registro escrito e as ferramentas (`scripts/foto.mjs`, `scripts/comparar-png.mjs`).
