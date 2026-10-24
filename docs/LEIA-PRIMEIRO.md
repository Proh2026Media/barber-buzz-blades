# Leia primeiro — Barba & Cabelo

Porta de entrada para o agente que vai continuar o projeto (Cursor, Claude Code, Codex e outros). Atualizado em **24/10/2026**.

**Passagem do dia (24/10/2026):** o dono passa a continuar o projeto no ChatGPT. Leia antes [passagem-chatgpt-2026-10-24.md](passagem-chatgpt-2026-10-24.md). As passagens anteriores ([21/10, Claude Code aplicativo](passagem-claude-code-app-2026-10-21.md); [15/10](passagem-claude-2026-10-15.md)) ficam como histórico.

**Situação em 22/10:** entrega "interface por dispositivo" do Claude Code (começou em 21/10 à noite): celular intocado, tablet (768–1279 px) com coluna estreita e computador (≥ 1280 px) com coluna completa, e cada área (Agenda, Serviços/Equipe/Horários, Ajustes, cliente, plataforma, páginas públicas) refeita para a largura. **Entregue; publicada em 22/10/2026.** Plano e decisões em [dispositivos-2026-10-21.md](dispositivos-2026-10-21.md) (seção 9 diz o que foi feito); registro na entrada de 22/10 do [CONTINUIDADE.md](CONTINUIDADE.md); o que ficou em [guia/pendencias.md](guia/pendencias.md), seção 9 (P-79 a P-95). Regras novas para quem mexer em tela: [mb-interface.md](mb-interface.md), seção 3, e [guia/arquitetura.md](guia/arquitetura.md), seção 8 ("Dispositivos") e 16. **O dono precisa testar no tablet e no computador** (roteiro no CONTINUIDADE; P-43): só foi visto em navegador emulado.

**Situação em 20/10:** entrega do Claude Code com agendamento pelo barbeiro no painel, apelido e cliente do balcão, selo de cliente recorrente, login Google no app instalado e simplificação visual (entrada de 16/10 no [CONTINUIDADE.md](CONTINUIDADE.md); análise em [analise-visual-2026-10-16.md](analise-visual-2026-10-16.md)). Antes da publicação, uma revisão de código (19 achados), um teste de interface completo (15) e uma revisão final independente (25) acharam e corrigiram defeitos (lista na mesma entrada). O site está no ar e, desde **20/10/2026**, as migrations nº 95 e 96 e a função `google-calendar-dispatch` estão aplicadas no servidor (P-73, pelo TI; entrada de 20/10 no CONTINUIDADE). Falta o teste do dono no celular (P-43). Novos registros: P-77 (decisão do dono) e P-78 (melhoria pequena). Depois, no topo de [guia/pendencias.md](guia/pendencias.md): os pacotes do Google (P-69 e P-28) e os testes reais do dono.

**Atualização de 24/10 — P-90 feita:** agendamento do cliente com escolhas abertas e calendário mensal desde 768 px; celular preservado (0 pixels diferentes em 390 px). Registro no [CONTINUIDADE.md](CONTINUIDADE.md). O dono ainda não testou no iPad nem no computador (P-43). A passagem do dia continua como histórico; não refazer a P-90.

**Atualização de 24/10 — P-80 aplicada:** cabeçalhos das tabelas ordenam no computador; diretório busca WhatsApp e mostra pontos conforme as permissões. Migration nº 97 aplicada pelo agente Claude na VPS em **24/10, 16:57:15 (Brasília)**, segundo o relatório entregue pelo dono, com backup, ensaio de 22 PASS e assinatura/privilégios corretos. Não reaplicar. Roteiro e registro em [implantacao-diretorio-contatos-pontos-2026-10-24.md](implantacao-diretorio-contatos-pontos-2026-10-24.md) e no CONTINUIDADE. Teste da interface em produção ainda pendente na P-43; pacotes Google também pendentes.

**Atualização de 24/10 — P-81 feita:** "Mais números do dia" fica aberto abaixo das duas colunas da Agenda desde 1024 px, com os mesmos dados e permissões. Celular preservado (comparação de 390 px sem diferenças); tablet em pé mantém o recolher. Sem atualização de banco. Próxima melhoria de interface: P-82 (prévias por aparelho nos editores); os testes reais seguem na P-43.

## O que é o projeto

App de agendamento e fidelidade **multiloja** para barbearias e salões, com uso principal no celular. Front em TanStack Start (React + Vite), Supabase auto-hospedado no Coolify e site publicado no Hostinger. Nasceu como protótipo do Lovable e foi reconstruído a partir de 14/09/2026. Resumo da trajetória: [guia/historico.md](guia/historico.md), seção 1.

## Antes de editar (obrigatório)

1. `git pull --ff-only origin main`. Se falhar, **não edite**.
2. `scripts/vez.sh pedir <ferramenta> "o que vai fazer"`. Se responder `vez: com <outra>`, espere.
3. `scripts/vez.sh checar <ferramenta>` antes de **cada** edição.
4. Ao terminar: `scripts/verificar.sh && scripts/autossave.sh <ferramenta>`.

No Cursor os passos 1 a 3 e o autossave rodam sozinhos pelos ganchos de [.cursor/hooks.json](../.cursor/hooks.json). Detalhes, mensagens de erro e como destravar: [guia/como-trabalhar.md](guia/como-trabalhar.md), seção 1. A regra completa está no [AGENTS.md](../AGENTS.md), seção 9.

## Três regras que já causaram estragos

- **Enviar ao `origin` publica o site.** No Cursor, o autossave roda ao fim de **cada resposta** e leva tudo o que estiver no disco e fora do `.gitignore`. Não termine uma resposta com trabalho quebrado nem com arquivos soltos (`.fotos/`, rascunhos).
- **Nunca envie só ao `hostinger`** e nunca use `git push --force` na `main`. O espelho copia o `origin` por cima: em 29/09/2026 as entregas tinham ido só ao `hostinger`, o `origin` estava atrasado, e o espelho tirou do site as entregas de 26 a 29/09.
- **Nunca copie segredos** (senhas, chaves, tokens, conteúdo do `.env`) para documentos, commits ou relatórios. O `.env` alterado nesta máquina é normal e não deve ser enviado.

## Roteiro de leitura

| Ordem | Documento                                                  | Quando ler                                                                                                   |
| ----- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1     | [guia/como-trabalhar.md](guia/como-trabalhar.md)           | Sempre. Vez, idioma, verificação, fotos das telas, como registrar a entrega e armadilhas conhecidas.         |
| 2     | [guia/pendencias.md](guia/pendencias.md)                   | Sempre. Lista única e priorizada (`P-01` em diante); a seção 1 traz as 5 recomendadas para a próxima rodada. |
| 3     | [guia/arquitetura.md](guia/arquitetura.md)                 | Antes de mudar código: stack, mapa de pastas, sessão e áreas, idiomas, tema, PWA, demonstração.              |
| 4     | [guia/papeis-e-permissoes.md](guia/papeis-e-permissoes.md) | Antes de mexer em papéis (Dono, Parceiro, Contratado), ambientes, sociedade ou privacidade.                  |
| 5     | [guia/banco-e-implantacao.md](guia/banco-e-implantacao.md) | Antes de criar migration, edge function, cron, domínio ou de publicar no servidor.                           |
| 6     | [guia/historico.md](guia/historico.md)                     | Para entender por que algo é como é: fases, ferramentas, incidentes e as regras que nasceram deles.          |

Também:

- **Interface:** [mb-interface.md](mb-interface.md) (diretrizes `/mb`, ler antes de mudar telas e fluxos) e [mb-revisao.md](mb-revisao.md) (revisão em andamento).
- **Ferramentas de linha de comando:** [../scripts/README.md](../scripts/README.md) (`vez.sh`, `autossave.sh`, `verificar.sh`, `foto.mjs` e outras).
- **Operação** (Coolify, e-mail do sistema, login Google, certificado de loja nova): [mb-operacao.md](mb-operacao.md), atualizado em 13/10 e 15/10; o estado dos servidores fica em [guia/banco-e-implantacao.md](guia/banco-e-implantacao.md). **PWA:** [pwa.md](pwa.md).
- **Tarefas para executor de fora** (agente da VPS, alguém no Google Cloud, no painel da Hostinger…): um pacote por tarefa, com regras, diagnóstico, passo a passo com esperado, como desfazer e o relatório de volta. Servidor: `docs/implantacao-<tema>-<data>.md`; o resto: [pacotes/](pacotes/). Passagens antigas entre ferramentas ficam como histórico (ex.: [passagem-claude-2026-10-15.md](passagem-claude-2026-10-15.md)).
- **Diário de entregas:** [CONTINUIDADE.md](CONTINUIDADE.md), do mais novo para o mais antigo. É longo; use-o para consultar o detalhe de uma entrega, não como primeira leitura. Os guias acima já resumem o que importa dele.

## Ao terminar uma entrega

1. Registre a entrega no [CONTINUIDADE.md](CONTINUIDADE.md) no modelo de [guia/como-trabalhar.md](guia/como-trabalhar.md), seção 4.
2. Atualize [guia/pendencias.md](guia/pendencias.md): marque como **feito** (com a data) o que foi resolvido e dê o próximo id livre ao que surgiu. Não renumere.
3. Se a entrega mudou algo descrito nos guias (estrutura, regra, papel, banco), corrija o capítulo correspondente na mesma entrega.
4. `scripts/verificar.sh && scripts/autossave.sh <ferramenta>`.

Toda comunicação, documentação e commit em **português do Brasil**.
