# Leia primeiro — Barba & Cabelo

Porta de entrada para o agente que vai continuar o projeto (Cursor, Claude Code, Codex e outros). Atualizado em **15/10/2026 (noite)**.

**Situação em 15/10 (noite):** a passagem de 15/10 foi concluída no Claude Code (entrada "Passagem de 15/10" no [CONTINUIDADE.md](CONTINUIDADE.md)). O que falta está no topo de [guia/pendencias.md](guia/pendencias.md): os pacotes do Google (P-69 e depois P-28) e os testes reais do dono.

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
