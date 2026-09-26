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
- `tsc` ainda acusa erros antigos fora desta revisão: `features/demo/model.ts`, `features/waiting/demo.ts`, `routes/$barberSlug.tsx`, `routes/index.tsx`, `vite.config.ts`.
- **Não** executado: telas logadas (reserva, cancelamento, aba Conta, editor WhatsApp, popup Google) — `/demo` exige login de administrador; aparelho físico, teclado virtual, leitor de tela, conexão lenta.

## Documentação incorporada

- `docs/mb-interface.md` consolidado (26/09/2026).
- `.cursor/rules/mb.mdc` (`alwaysApply: true`).
- `.cursor/skills/mb/` a partir do `mb.zip`.
- `AGENTS.md` e `CONTINUIDADE.md` com ponteiros.
