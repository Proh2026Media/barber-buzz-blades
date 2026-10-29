# Leia primeiro — Barba & Cabelo

Porta de entrada para o agente que vai continuar o projeto (Cursor, Claude Code, Codex e outros). Atualizado em **29/10/2026**.

**Passagem do dia (24/10/2026):** o dono passa a continuar o projeto no ChatGPT. Leia antes [passagem-chatgpt-2026-10-24.md](passagem-chatgpt-2026-10-24.md). As passagens anteriores ([21/10, Claude Code aplicativo](passagem-claude-code-app-2026-10-21.md); [15/10](passagem-claude-2026-10-15.md)) ficam como histórico.

**Atualização de 29/10 — P-104:** correção da tela de acesso após relato de falta de responsividade. Nome longo deixa de ficar encoberto pela sobreposição do cartão; modelos cedem para uma coluna conforme largura útil e fonte; controles e recuperação se reorganizam em área estreita. CSS compartilhado do acesso em `src/styles/acesso.css`. Três referências móveis de Entrar preservadas pixel a pixel; nomes longos, texto ampliado e larguras fracionárias conferidos. Evidências e limites na seção P-104 de [revisao-visual-integral-2026-10-29.md](revisao-visual-integral-2026-10-29.md). Sem migration ou tarefa para TI; não presumir encerrada a revisão de todo o sistema.

**Atualização de 29/10 — P-103:** continuação no cadastro da barbearia e nas janelas de Serviço/Profissional. Cadastro com resumo ligado à tarefa e campos pela largura útil; Serviço com detalhes em faixa; janelas mais amplas no PC e reorganização com fonte ampliada. Convites conferidos e mantidos como painel curto. Celular, regras e identidade preservados. Comparações e limites na seção P-103 de [revisao-visual-integral-2026-10-29.md](revisao-visual-integral-2026-10-29.md). Sem migration ou tarefa para TI.

**Atualização de 29/10 — P-102:** evolução da consistência com o seletor inicial e login explicitamente reorganizados para computador. Marca/formulário em moldura compartilhada com a prévia, cadastro longo com marca acompanhando a rolagem e cabeçalhos de tarefa alinhados em Serviços, Equipe, Agenda e Horários. Celular preservado. Comparações e limites na seção P-102 de [revisao-visual-integral-2026-10-29.md](revisao-visual-integral-2026-10-29.md). Sem migration ou tarefa para TI.

**Atualização de 29/10 — P-101:** o dono considerou insuficiente a P-100. A organização vigente agora coloca título/ação junto à tarefa e recompõe Conta, Avisos, Esportes, Pontos, Clube, Agenda, Ajustes, relatórios e página pública, incluindo janelas de computador desde 1024 px. Inventário e comparações em [revisao-visual-integral-2026-10-29.md](revisao-visual-integral-2026-10-29.md). As descrições anteriores de portal no cabeçalho, índice lateral de Ajustes e composição da P-100 ficam como histórico quando divergirem. Não presumir aprovação estética do dono.

**Atualização de 29/10 — P-100:** nova composição para computador após o dono considerar insuficientes as entregas anteriores. Navegação contínua, agenda/listagens integradas, horários em duas áreas, Ajustes com índice lateral e agendamento do cliente agrupado. As regras novas começam em 1280 px; celular e tablet preservados. Detalhes na seção 13 de [dispositivos-2026-10-21.md](dispositivos-2026-10-21.md). Esta é a organização atual; os registros P-97/P-98 abaixo são históricos quando divergirem.

**Situação em 22/10:** entrega "interface por dispositivo" do Claude Code (começou em 21/10 à noite): celular intocado, tablet (768–1279 px) com coluna estreita e computador (≥ 1280 px) com coluna completa, e cada área (Agenda, Serviços/Equipe/Horários, Ajustes, cliente, plataforma, páginas públicas) refeita para a largura. **Entregue; publicada em 22/10/2026.** Plano e decisões em [dispositivos-2026-10-21.md](dispositivos-2026-10-21.md) (seção 9 diz o que foi feito); registro na entrada de 22/10 do [CONTINUIDADE.md](CONTINUIDADE.md); o que ficou em [guia/pendencias.md](guia/pendencias.md), seção 9 (P-79 a P-95). Regras novas para quem mexer em tela: [mb-interface.md](mb-interface.md), seção 3, e [guia/arquitetura.md](guia/arquitetura.md), seção 8 ("Dispositivos") e 16. **O dono precisa testar no tablet e no computador** (roteiro no CONTINUIDADE; P-43): só foi visto em navegador emulado.

**Situação em 20/10:** entrega do Claude Code com agendamento pelo barbeiro no painel, apelido e cliente do balcão, selo de cliente recorrente, login Google no app instalado e simplificação visual (entrada de 16/10 no [CONTINUIDADE.md](CONTINUIDADE.md); análise em [analise-visual-2026-10-16.md](analise-visual-2026-10-16.md)). Antes da publicação, uma revisão de código (19 achados), um teste de interface completo (15) e uma revisão final independente (25) acharam e corrigiram defeitos (lista na mesma entrada). O site está no ar e, desde **20/10/2026**, as migrations nº 95 e 96 e a função `google-calendar-dispatch` estão aplicadas no servidor (P-73, pelo TI; entrada de 20/10 no CONTINUIDADE). Falta o teste do dono no celular (P-43). Novos registros: P-77 (decisão do dono) e P-78 (melhoria pequena). Depois, no topo de [guia/pendencias.md](guia/pendencias.md): os pacotes do Google (P-69 e P-28) e os testes reais do dono.

**Atualização de 24/10 — P-90 feita:** agendamento do cliente com escolhas abertas e calendário mensal desde 768 px; celular preservado (0 pixels diferentes em 390 px). Registro no [CONTINUIDADE.md](CONTINUIDADE.md). O dono ainda não testou no iPad nem no computador (P-43). A passagem do dia continua como histórico; não refazer a P-90.

**Atualização de 24/10 — P-80 aplicada:** cabeçalhos das tabelas ordenam no computador; diretório busca WhatsApp e mostra pontos conforme as permissões. Migration nº 97 aplicada pelo agente Claude na VPS em **24/10, 16:57:15 (Brasília)**, segundo o relatório entregue pelo dono, com backup, ensaio de 22 PASS e assinatura/privilégios corretos. Não reaplicar. Roteiro e registro em [implantacao-diretorio-contatos-pontos-2026-10-24.md](implantacao-diretorio-contatos-pontos-2026-10-24.md) e no CONTINUIDADE. Teste da interface em produção ainda pendente na P-43; pacotes Google também pendentes.

**Atualização de 24/10 — P-81 feita:** "Mais números do dia" fica aberto abaixo das duas colunas da Agenda desde 1024 px, com os mesmos dados e permissões. Celular preservado (comparação de 390 px sem diferenças); tablet em pé mantém o recolher. Sem atualização de banco. Os testes reais seguem na P-43.

**Atualização de 24/10 — P-82 feita:** editores de marca, página pública e tela de entrada têm prévias de celular, tablet e computador a partir de 768 px. A escolha é temporária e mantém o rascunho; as molduras usam larguras próprias para reproduzir o leiaute. Celular preservado. Sem migration ou tarefa para a VPS. Testes em aparelhos reais continuam na P-43.

**Atualização de 24/10 — P-83 feita:** cabeçalho em três zonas desde 1280 px nas áreas da loja, cliente e plataforma: identidade | seção atual | ação principal e conta. Os controles existentes de agendar, criar serviço, adicionar profissional e criar barbearia passam ao topo; cliente ganha acesso ao agendamento no cabeçalho. A demonstração usa o menu de perfis existente para caber nas três zonas. Celular e tablet mantidos; sem migration. Continuação concluída no bloco abaixo.

**Atualização de 24/10 — continuação P-84 a P-94:** concluídas P-84, P-85, P-86, P-87, P-88, P-89, P-91, P-93 e P-94: painel lateral da agenda, clube dentro de Ajustes, matriz editável, pausa em duas colunas, limpeza de componentes, catálogo em tabela desde 768, cenários da demonstração, fixture pública e correções visuais. Sem migration ou tarefa nova na VPS. P-92/P-95 aguardam escolha; testes físicos e integrações reais seguem em P-42/P-43. P-14/P-45 permanecem opcionais, fora deste bloco de interface.

**Atualização de 24/10 — revisão geral de tablet e computador (P-96, incluindo P-92):** primeira rodada de reorganização, preservando celular e identidade; depois o dono informou que não percebeu melhorias significativas (complemento P-97 abaixo). Ajustes com navegação secundária compacta e campos/prévias pela largura útil; Horários com colunas independentes e Pausa fixa em janela ampla; Equipe sem lateral vazia; agendamento do cliente com escolhas lado a lado no tablet e revisão lateral só no computador; matriz de Acessos, lista de barbearias, relatórios e Clube redistribuídos. Inventário e validação na seção 10 de [dispositivos-2026-10-21.md](dispositivos-2026-10-21.md). P-92 concluída pela autorização deste pedido; P-95 continua fora do escopo porque altera o celular. P-42/P-43 continuam pendentes para aparelhos e integrações reais. Sem migration.

**Retorno do dono e complemento P-97 (24/10):** a primeira revisão foi considerada pouco perceptível. Recompostas as tarefas principais: Agenda com navegação/resumo em faixas e atendimentos na largura completa; Ajustes com categorias no topo desde 768, liberando largura para os formulários; Agendar com escolhas roláveis à esquerda e calendário/horários à direita desde 1024, revisão abaixo do calendário. Celular preservado. Registro e comparação na seção 11 de [dispositivos-2026-10-21.md](dispositivos-2026-10-21.md). Não tratar a aprovação técnica como aprovação da experiência pelo dono.

**Continuação de 28/10 — P-98:** Serviços e Equipe abrem em tabela no tablet/computador; Horários da loja ganha semana visual, prévia em faixa e áreas de bloqueio/pausa; Meus agendamentos usa linhas pela largura disponível; ficha da barbearia na plataforma recebe mais espaço, com índice compacto e retorno à tabela. Início do cliente, pontos, Início da plataforma, Relatórios e Acessos mantêm as composições já adequadas. Validação e limites na seção 12 de [dispositivos-2026-10-21.md](dispositivos-2026-10-21.md). P-42/P-43 ainda dependem de integrações reais/aparelhos físicos; não há nova implantação de banco.

**Continuação de 28/10 — P-72:** demonstração com serviços, preços e durações por profissional; condições compartilhadas por escolha do cliente, grade, painel e lista de espera. Bruno: corte de 45 min/R$ 55; Rafa: barba de 30 min/R$ 65; Dani sem barba. Reservas e remarcações conservam os valores correspondentes. Sem migration ou tarefa para o TI. P-42/P-43 continuam dependendo de aparelhos/integrações reais; P-95 permanece fora por alterar o celular.

**Continuação de 28/10 — fechamento das pendências executáveis:** P-44 (recarga de componentes sem avisos), P-45 (idiomas sob demanda), P-48 (testes da guarda e banco local) e P-75 (painéis de assuntos e Google compacto em tablet/computador). P-78 com código e **nº 98 aplicada em 28/10, 19:17 (Brasília)**, conforme relatório recebido em 29/10: [pacote do agente da VPS](implantacao-falha-login-google-2026-10-28.md). Celular preservado; P-95 não autorizada por conflitar com essa orientação. Próximos passos são Google Cloud/verificação (P-69/P-28), testes reais (P-42/P-43) e decisões de produto/jurídicas. Detalhes e limites no topo de [guia/pendencias.md](guia/pendencias.md) e no CONTINUIDADE. Não reaplicar a nº 97.

**Publicação confirmada — P-99 (28/10, 18:57:47 Brasília):** o site público passou a servir a entrega `34310f5`, após origin e espelho atualizados. Conferido por HTTP, pacote principal 1.124.849 bytes com idiomas separados. Não há ação adicional de Hostinger; a nº 98 também foi aplicada às 19:17; faltam os testes reais. [Registro](implantacao-falha-login-google-2026-10-28.md#publicação-na-hostinger-confirmada-p-99).

**Registro de 29/10 — P-78 aplicada:** relatório do agente Claude confirma a nº 98 em produção desde **28/10/2026, 19:17:07–19:17:10 (Brasília)**, com backup, 18 PASS/ROLLBACK e permissões esperadas. Hashes do relatório conferem com o repositório; sem nova consulta à VPS nesta sessão. **Não reaplicar. Nenhuma migration escrita permanece pendente.** Testar cancelamento e conclusão do login Google no iPhone instalado e no Android/navegador (P-42/P-43). [Pacote atualizado](implantacao-falha-login-google-2026-10-28.md).

**Continuação de 29/10 — P-71 feita:** dono escolheu “agendamento” nas telas do cliente. Padronizados 26 textos do dicionário pt-BR em remarcação, cancelamento, avisos, link de acesso, contadores por barbearia e categoria da cópia de dados. Termos jurídicos/de privacidade e pontos reservados preservados; sem mudança de layout, regra, URL ou migration. Outros idiomas e verbos como “reservar” mantidos. P-71 deixa de ser decisão pendente.

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
