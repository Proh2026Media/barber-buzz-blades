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
- **Não** executado: aparelho físico, teclado virtual real, leitor de tela real, conexão lenta; OAuth do Google até o fim (exige conta Google e altera dados reais).

## Documentação incorporada

- `docs/mb-interface.md` consolidado (26/09/2026).
- `.cursor/rules/mb.mdc` (`alwaysApply: true`).
- `.cursor/skills/mb/` a partir do `mb.zip`.
- `AGENTS.md` e `CONTINUIDADE.md` com ponteiros.
