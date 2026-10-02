# Revisão MB — Barba & Cabelo

Atualizado em **26/09/2026**. Fonte: [mb-interface.md](mb-interface.md). Regra: `.cursor/rules/mb.mdc`. Skill: `.cursor/skills/mb/`.

## Inventário de jornadas

| Jornada | Papel | Status revisão |
| --- | --- | --- |
| Acesso / login / Google / OTP | Cliente e loja | Feito — erros amigáveis; reenvio OTP (auth + gate + cadastrar) |
| Agendar / remarcar | Cliente | Feito — linguagem e recuperação de horário |
| Reservas / cancelar / recorrência | Cliente | Feito — diálogo com contexto |
| Cancelar na agenda da loja | Equipe | Feito — diálogo com contexto |
| Navegação inferior / perfil | Cliente | Feito — aba Conta + “Você está em…” |
| Configurações WhatsApp / Google | Loja | Feito — erros traduzidos + reconectar |
| Cadastro de loja OTP | Dono | Feito — reenvio com cooldown 60s |
| Cantos / identidade visual | Loja | Já alinhado ao perfil MB (não alterado) |
| Agenda / Serviços / Equipe / Horários | Equipe | Auditoria de toque, rótulos e textos no celular — ajustado toque |
| Esportes | Cliente | Filtros com 44px |

## Achados e tratamento

| Prioridade | Achado | Tratamento | Verificação |
| --- | --- | --- | --- |
| Bloqueio | Sucesso de booking sempre “confirmada” | Copy → “Horário reservado” + próximo passo | Código |
| Bloqueio | Erro de booking limpava horário | Limpa só no sucesso; “Atualizar horários” | Código |
| Frequente | Cancelamento sem contexto | Resumo serviço/data/hora; CTAs nomeados | Código |
| Frequente | `window.confirm` na recorrência | `AlertDialog` | Código |
| Frequente | Erros de auth crus | `friendlyAuthError` (inclui envio principal do login, Google, perfil, troca de senha e catálogo) | Navegador (login com senha errada) |
| Frequente | Gate/cadastro sem reenviar OTP | Reenvio (+ cooldown no cadastrar) | Código |
| Frequente | Perfil fora da nav | Aba **Conta**; header com `aria-current`; faixa “Você está em…” | Código |
| Secundário | Dialog “Close” | “Fechar” | Código |
| Secundário | Input / TimePicker / header toque | ≥ 44px | Código |
| Secundário | Erros técnicos Google/WhatsApp | `friendlyIntegrationError` + reconectar | Código |
| Pendente | Validação em aparelho real | Ainda não | — |

## Verificado nesta rodada

- Lint e tipos sem erros nos arquivos alterados; 80/80 testes; `npm run build` concluído.
- Navegador emulado 390×844: `/auth` renderiza; senha errada agora mostra “E-mail ou senha incorretos…” (antes “Invalid login credentials”) e preserva e-mail/senha. `/cadastrar` renderiza (envio de código não disparado para não mandar WhatsApp real).
- Testes automáticos novos para modelos de WhatsApp e mensagens de erro (95/95). Encontraram e corrigiram: link Markdown `[texto](url)` passava sem aviso na validação.
- `npm run typecheck` completo sem erros (corrigidos os tipos antigos da demonstração, rotas e `vite.config.ts`).
- Publicado no Hostinger (build concluído); em produção, senha errada mostra a mensagem amigável.
- Telas logadas no navegador emulado 390×844 (demo e painel real, sem salvar nada):
  - Reserva: resumo antes de confirmar, horário e botão ≥ 44px, sucesso “Horário reservado” com próximo passo.
  - Cancelamento: janela com resumo e botões nomeados; Esc fecha sem cancelar. **Corrigido:** após cancelar não havia confirmação — agora aparece “Horário cancelado: …” (e aviso ao parar repetição).
  - Aba Conta: `aria-current="page"` e faixa “Você está em Perfil”.
  - Editor WhatsApp: pílulas de 18px no texto, prévia formatada, troca de dado, restaurar com confirmação. **Corrigido:** menu da pílula abria fora da tela (âncora `fixed` dentro de cartão com transform); itens do menu com 44px e “(atual)” para leitor de tela; texto “alguns emojis contam como dois”.
  - Aviso do Google: cabe no celular; “Agora não” fecha sem iniciar o OAuth. **Corrigido:** o X de fechar das janelas (componente compartilhado) tinha 16px de largura — agora 44×44.
- Auditoria automática no celular (painel da loja e app do cliente): nenhum texto em inglês nem botão sem nome. **Corrigido:** interruptores (componente compartilhado) com área de toque 44×44 sem mudar o visual; alternador Grade/Lista, motivos de bloqueio em Horários e filtros de Esportes com 44px.
- **Não** executado: aparelho físico, teclado virtual real, leitor de tela real, conexão lenta; OAuth do Google até o fim (exige conta Google e altera dados reais).

## Idiomas (fase 1 — 26/09/2026)

- Idiomas: Português (Brasil, padrão), Português (Portugal), English (US), English (UK) e Español. Escolha salva no aparelho (`arena:locale`); pt-BR remove a chave.
- Estrutura em `src/lib/i18n/`: dicionários em `messages/` (pt-BR é a fonte e define as chaves), `translate()` com `{variável}` e reserva em pt-BR, `useI18n()` para telas e `t()` para mensagens fora do React. O atributo `lang` da página acompanha a escolha (script no `__root.tsx`).
- Onde trocar: seletor no topo das páginas públicas (início, login, cadastro da barbearia, termos, privacidade, política) e cartão **Idioma** nos ajustes (Conta do cliente, Ajustes da barbearia, painel da plataforma).
- Traduzido: início, login completo (inclui recuperação e mensagens), cadastro da barbearia, botão de tema, mensagens amigáveis de erro de acesso e de integrações. Demais telas logadas continuam em pt-BR e o cartão avisa isso quando outro idioma está ativo.
- Teste automático garante que todos os idiomas têm as mesmas chaves e as mesmas variáveis (99/99).
- Verificado no navegador 390×844: troca pelo menu e pelo cartão, persistência entre páginas, leitura dos itens com 44px, volta ao pt-BR. Limitação conhecida: no primeiro carregamento aparece pt-BR por um instante antes de aplicar o idioma salvo (o servidor sempre entrega pt-BR).
- **Fase 2 (em andamento):** área Conta do cliente traduzida — navegação inferior e faixa “Você está em”, Perfil, troca de senha, pontos e níveis, Seu ritmo (dias da semana e valores pelo idioma), entrar em outra barbearia, Privacidade, direitos sobre os dados (palavra de confirmação por idioma: EXCLUIR/ELIMINAR/DELETE) e resumo das pesquisas. Conferido no navegador 390×844 em inglês e espanhol.
- **Fase 2 (continuação):** resto do app do cliente traduzido — Início (cartão de membro, próximo atendimento, benefícios de nível), Agendar (datas, serviço, barbeiro, horários por período, resumo, repetição, erros e confirmação), Reservas (filtros, situação, cancelar e parar repetição), Esportes, Avisos e a janela do Clube de Benefícios. Datas, horas e valores seguem o idioma (o calendário também); o valor sempre aparece com “R$”. Conferido em inglês na demonstração: reserva feita, lista de reservas e janela de cancelar (motivos traduzidos, fechada sem cancelar); em espanhol, a tela de agendar.
- **Corrigido (acessibilidade):** as janelas de cancelar reserva e parar repetição abriam sem levar o foco para dentro e, ao fechar, o foco se perdia. Agora o foco vai ao primeiro controle da janela e volta ao botão que a abriu (conferido com Esc e com “Manter”).
- **Fase 3 — sistema completo:** painel da barbearia (agenda, serviços, equipe, horários, ajustes, identidade visual, ícones, integrações WhatsApp/Google/domínio, sócios, permissões, clientes), painel da plataforma, demonstração, portão de reserva, telas de erro/404, pesquisas e painel de números, presença, lista de espera, direitos sobre os dados (parte administrativa), componentes genéricos (seletores de hora/antecedência, janelas, banner de instalação) e textos jurídicos (Termos, Privacidade, Escala do Clube, com aviso “tradução de cortesia” fora do pt-BR). Cerca de 1.650 chaves novas nos cinco idiomas.
- Verificado: eslint, tsc, 101 testes e build sem erros; no navegador 390×844, painel da barbearia percorrido em inglês (nenhum texto de interface em português), pt-BR, espanhol e pt-PT sem nenhuma chave crua aparecendo; Termos em inglês, espanhol e pt-BR.
- De propósito em pt-BR: conteúdo das mensagens enviadas a clientes (modelos de WhatsApp — o editor mostra os rótulos traduzidos, a mensagem sai em pt-BR), dados cadastrados (serviços, bios, recados, nomes das permissões vindos do banco), dados fictícios da demonstração, título/descrição da página no HTML gerado pelo servidor, palavras-chave de busca dos ícones. Motivos rápidos de bloqueio (Feriado, Pausa…) são gravados no idioma de quem cria o bloqueio.
- Não verificado no navegador: painel da plataforma real (exige login de administrador); só pelo código, tipos e testes.
- Próximas fases: resto do app do cliente, painel da barbearia, painel da plataforma, datas/valores com `intlLocale`, textos jurídicos.

## Painel da plataforma (26/09/2026)

Auditoria no celular (390×844) das abas Visão geral, Barbearias, Acessos e Relatórios: nenhum botão sem nome.

- **Corrigido (bloqueio):** o selo “Ativa” era, na verdade, o botão que suspendia a barbearia num toque, sem aviso. Agora o selo só mostra a situação e há o botão **Suspender/Reativar** (44px), que abre uma confirmação dizendo o que acontece: o link e o domínio param de abrir, ninguém agenda, nenhum dado é apagado. Conferido no código que as rotas públicas e a agenda exigem barbearia ativa.
- **Corrigido:** remover gerente de conta pedia só um toque num botão de 36px; agora tem 44px e confirmação com nome da pessoa e da loja. A caixa de marcar do gerente tinha 13px; agora a linha inteira (44px) marca.
- **Corrigido (linguagem):** “admin global”, “admins”, “dashboard” e fuso “America/Sao_Paulo” trocados por “administrador da plataforma”, “administradores”, “painel de números” e “Horário Padrão de Brasília”.
- **Corrigido:** erros do banco apareciam crus (podiam vir em inglês). Agora passam pela mensagem amigável, que também reconhece falta de permissão e registro duplicado e troca texto em inglês desconhecido pela frase padrão (101/101 testes).
- Verificado sem alterar dados reais: a confirmação de suspender foi aberta e fechada com “Voltar”; a barbearia continuou ativa.
- **Corrigido no código:** ao fechar as confirmações de suspender e de remover gerente, o foco do teclado volta ao botão que as abriu. Ainda não conferido no navegador (o painel real exige login de administrador).

## Varredura geral — toque, nomes, largura e foco (26/09/2026)

Checagem automática na demonstração, em todas as abas do painel da barbearia e do app do cliente, em 390×844 e 320×640: áreas de toque abaixo de 44px, botões sem nome, campos sem rótulo e conteúdo saindo pela lateral. Nas duas larguras, nenhuma tela teve rolagem lateral nem conteúdo cortado.

- **Corrigido (componente compartilhado):** toda janela (`Dialog` e `AlertDialog`) agora devolve o foco ao botão que a abriu ao fechar, e as confirmações levam o foco para o primeiro controle ao abrir. Antes isso dependia de cada tela, e 16 janelas não faziam. Conferido no navegador: editar/excluir/adicionar serviço, editar/excluir profissional e cancelar reserva no app do cliente — foco entra na janela e volta ao botão com Esc.
- **Corrigido (toque):** “Ocorrências” da presença (32px → 44px), botão “Tentar de novo” da presença, contador de cancelamentos do dia (38px de largura → 44px), “Prévia/Texto original” do WhatsApp (32px → 44px), ícones do formulário de serviço (40px → 44px), fechar do banner de instalação (36px → 44px), remover logotipo/fonte na identidade visual (36px → 44px) e “sair” da faixa da demonstração (área de toque ampliada sem mudar a faixa).
- **Corrigido (campos):** campos dentro de janelas também passam a ter no mínimo 44px de altura (regra global que valia só fora das janelas).
- **Corrigido (rótulos):** escolha de agenda do Google, nome da nova barbearia na saída do sócio e busca de ícone do serviço agora têm nome lido pelo leitor de tela.
- Conferido e mantido: interruptores (36×20 visíveis) e o marcador da antecedência já têm área de toque invisível de 48px.
- Só pelo código (não aparecem na demonstração): ajustes de identidade, domínio, integrações Google, saída do sócio e painel da plataforma real.

## Link direto do barbeiro e mensagens de erro (27/09/2026)

- **Corrigido (link do barbeiro):** um link para profissional que não existe mais na barbearia (link antigo do WordPress, profissional que saiu) caía num “404” genérico, sem caminho para agendar. Agora mostra “Não encontramos esse profissional”, explica o motivo provável e oferece **Agendar com outro profissional** na mesma barbearia. Enquanto consulta, aparece “Abrindo a agenda…” em vez de tela em branco. Falha de conexão deixou de ser tratada como “não encontrado” e vai para a tela de erro com “Tentar de novo”.
- **Corrigido (linguagem):** 35 pontos do painel da barbearia, da plataforma, da presença e das integrações mostravam o texto cru do erro do servidor (podia vir em inglês ou com jargão do banco). Agora passam pelo tradutor de erros amigáveis, que reconhece permissão, duplicado, conexão e sessão, e mantém as mensagens próprias do sistema.
- **Ajustado:** no idioma inglês, o tradutor só esconde mensagens com vocabulário técnico do banco; mensagens do próprio sistema em inglês continuam aparecendo (teste novo).
- **Corrigido (estado real):** na saída do sócio, se a lista de outras barbearias falhasse ao carregar, ela aparecia vazia como se não houvesse opção; agora avisa o erro.

## Estados de vazio, carregando e erro (27/09/2026)

Conferido pelo código: agenda, serviços, equipe, bloqueios, reservas, início, avisos, extrato de pontos, clientes, plataforma, permissões, decisões da equipe e redirecionamentos já têm mensagem de “carregando” e de “nada aqui ainda” com próximo passo. As consultas ao banco devolvem erro (não travam) quando a conexão cai.

- **Corrigido (recuperação):** erro ao carregar sem saída ganhou **Tentar novamente** em: lista de clientes, perfil do cliente, carteira do sócio, números do profissional e cartão “Próximo atendimento” do início do cliente. Reservas, números da barbearia e presença já tinham como atualizar.
- **Corrigido (estado real):** a lista de clientes mostrava “0” no título quando o carregamento falhava; agora o número só aparece quando a lista carregou.
- Conferido na demonstração (390×844): lista e perfil de clientes abrem normalmente; início do cliente normal. Os avisos de erro só aparecem com falha real de conexão, então não foram vistos no navegador.

## Clube de pontos e página da barbearia (02/10/2026)

- **Corrigido (estado real):** a janela do clube prometia vantagens que o sistema não tem (R$ 1 = 1 ponto, assinatura, lounge); agora mostra só a regra da loja (pontos por atendimento, bônus, níveis e prêmios).
- **Consequência no ponto da decisão:** trocar pontos explica a reserva, o prazo de 30 dias e a devolução antes de confirmar; ajuste manual mostra o saldo resultante e não deixa ficar negativo; mudar a regra avisa que vale só daqui para frente.
- **Uma ação principal:** a página pública tem “Entrar e agendar” no topo e numa barra fixa embaixo; cada horário livre leva ao login já com o profissional escolhido.
- **Menos confusão nos ajustes:** grupos com subtelas; identidade visual em etapas; editor da página com prévia ao vivo e contadores de caracteres.
- Conferido no navegador em 390×844 (ver `CONTINUIDADE.md`). Pendente: `/shop/pontos` com login real e aparelho real.

## Documentação incorporada

- `docs/mb-interface.md` consolidado (26/09/2026).
- `.cursor/rules/mb.mdc` (`alwaysApply: true`).
- `.cursor/skills/mb/` a partir do `mb.zip`.
- `AGENTS.md` e `CONTINUIDADE.md` com ponteiros.
