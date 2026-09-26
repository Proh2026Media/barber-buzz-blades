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
- **Fase 2 (em andamento):** área Conta do cliente traduzida — navegação inferior e faixa “Você está em”, Perfil, troca de senha, pontos e níveis, Seu ritmo (dias da semana e valores pelo idioma), entrar em outra barbearia, Privacidade, direitos sobre os dados (palavra de confirmação por idioma: EXCLUIR/ELIMINAR/DELETE) e resumo das pesquisas. Conferido no navegador 390×844 em inglês e espanhol. Faltam: agendar, reservas, início, esportes, conteúdo das pesquisas e a parte administrativa de dados.
- Próximas fases: resto do app do cliente, painel da barbearia, painel da plataforma, datas/valores com `intlLocale`, textos jurídicos.

## Painel da plataforma (26/09/2026)

Auditoria no celular (390×844) das abas Visão geral, Barbearias, Acessos e Relatórios: nenhum botão sem nome.

- **Corrigido (bloqueio):** o selo “Ativa” era, na verdade, o botão que suspendia a barbearia num toque, sem aviso. Agora o selo só mostra a situação e há o botão **Suspender/Reativar** (44px), que abre uma confirmação dizendo o que acontece: o link e o domínio param de abrir, ninguém agenda, nenhum dado é apagado. Conferido no código que as rotas públicas e a agenda exigem barbearia ativa.
- **Corrigido:** remover gerente de conta pedia só um toque num botão de 36px; agora tem 44px e confirmação com nome da pessoa e da loja. A caixa de marcar do gerente tinha 13px; agora a linha inteira (44px) marca.
- **Corrigido (linguagem):** “admin global”, “admins”, “dashboard” e fuso “America/Sao_Paulo” trocados por “administrador da plataforma”, “administradores”, “painel de números” e “Horário Padrão de Brasília”.
- **Corrigido:** erros do banco apareciam crus (podiam vir em inglês). Agora passam pela mensagem amigável, que também reconhece falta de permissão e registro duplicado e troca texto em inglês desconhecido pela frase padrão (101/101 testes).
- Verificado sem alterar dados reais: a confirmação de suspender foi aberta e fechada com “Voltar”; a barbearia continuou ativa.
- **Corrigido no código:** ao fechar as confirmações de suspender e de remover gerente, o foco do teclado volta ao botão que as abriu. Ainda não conferido no navegador (o painel real exige login de administrador).

## Documentação incorporada

- `docs/mb-interface.md` consolidado (26/09/2026).
- `.cursor/rules/mb.mdc` (`alwaysApply: true`).
- `.cursor/skills/mb/` a partir do `mb.zip`.
- `AGENTS.md` e `CONTINUIDADE.md` com ponteiros.
