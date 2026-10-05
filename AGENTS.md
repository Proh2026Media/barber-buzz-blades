# Orientações persistentes do projeto

## Idioma (regra obrigatória)

Toda comunicação com o usuário e todo tratamento no projeto — respostas, resumos, perguntas, commits, documentação e textos do sistema — em **português do Brasil (pt-BR)**. O sistema tem troca de idioma (pt-BR padrão, pt-PT, en-US, en-GB, es); texto novo de interface entra pelo dicionário em `src/lib/i18n/`. Regra Cursor: [.cursor/rules/idioma.mdc](.cursor/rules/idioma.mdc).

## Retomada de contexto

Ao assumir o projeto em outro chat ou provedor, ler primeiro [docs/CONTINUIDADE.md](docs/CONTINUIDADE.md), com estado das entregas, regras aprovadas, validações e pendências.

## Interface — `/mb` e diretrizes MB

Neste projeto, `/mb` é o atalho textual para aplicar a skill `mb`, também invocável como `$mb`.

**Fonte completa (ler antes de mudanças de UI/fluxos):** [docs/mb-interface.md](docs/mb-interface.md)  
**Regra Cursor (sempre ativa):** [.cursor/rules/mb.mdc](.cursor/rules/mb.mdc)  
**Skill empacotada:** [.cursor/skills/mb/](.cursor/skills/mb/)  
Cópia legada no ambiente Codex: `~/.codex/skills/mb/SKILL.md` (preferir a versão do repositório quando divergir).

A direção atual é uma interface moderna, intuitiva e acessível a diferentes idades e níveis de familiaridade com tecnologia — uso principal no celular —, com controles visuais e explicações curtas. O sistema deve se adaptar integralmente aos três modos de canto configuráveis — retos, semi arredondados e arredondados — usando semi arredondados como padrão até o usuário escolher e salvar outro. Aplicar o modo escolhido de forma consistente a botões, campos, cartões, janelas, cabeçalhos e rodapés. Preservar uma identidade visual consolidada entre páginas e estados, sem oscilações arbitrárias de tipografia, cor, espaçamento ou elevação. Manter os cartões off-white, os gradientes de fidelidade e as cores de ação aprovadas. **Mostrar em vez de explicar:** priorizar ícones, cartões, status, cores e exemplos visuais em vez de textos técnicos; se uma funcionalidade precisa de muita explicação, a experiência ainda precisa melhorar (detalhes em `docs/mb-interface.md`, seção 4).

Registro da revisão MB em andamento: [docs/mb-revisao.md](docs/mb-revisao.md).

## Ideias para desenvolvimento futuro

- [Módulo de reembolso e cancelamento](docs/reembolso-futuro.md): registro preliminar solicitado pelo usuário, ainda sem implementação. Consultar antes de desenvolver pagamentos, taxas de cancelamento ou reembolsos. A documentação não autoriza ativar cobranças nem altera os cancelamentos atuais.

## PWA

O app é instalável (manifesto, service worker, ícones). Detalhes em [docs/pwa.md](docs/pwa.md).

## Operação (Coolify, Titan, Google)

Passo a passo de e-mail Titan, SMTP do Auth, login Google, domínio `supabasebeauty` e checklists: [docs/mb-operacao.md](docs/mb-operacao.md).

## 9. Vez entre ferramentas (regra obrigatória)

Só uma ferramenta (Cursor, Codex, Claude Code etc.) edita o projeto por vez. A vez fica no GitHub (`origin`, ramo `vez`), então vale entre máquinas diferentes.

1. **Ao começar:** `git pull --ff-only origin main`. Se falhar, **não editar** até a conexão voltar — editar sobre uma cópia desatualizada foi o que já apagou entregas publicadas.
2. **Pegar a vez:** `scripts/vez.sh pedir <ferramenta> "o que vai fazer"`. Se responder "vez: com outra", esperar; não editar.
3. **Antes de cada edição:** `scripts/vez.sh checar <ferramenta>` (renova a vez; sai com erro se ela for de outra ferramenta).
4. **Ao terminar:** `scripts/autossave.sh <ferramenta>` — salva, envia ao `origin` e devolve a vez. Não inclui `.env` nem `._*`.
5. **Enviar ao `origin` publica o site:** a cada envio, o fluxo `.github/workflows/sync-instantanea-hub.yml` avisa o `PROH-Media/hub-control`, que espelha o `origin` no `hostinger` (`PROH-Media/barber-buzz-blades`), e o Hostinger compila. Só enviar trabalho verificado (checagem de tipos e montagem).
6. **Nunca** enviar só ao `hostinger`: o espelho copia o `origin` por cima e desfaz a publicação (foi o que tirou o site do ar em 29/09). O `origin` é a fonte da verdade.
7. **Nunca** usar `git push --force` na `main` de nenhum remoto.

A vez vence sozinha após 30 minutos sem renovação (`VEZ_PRAZO_MIN`), para uma ferramenta travada não bloquear as outras. Ver quem está com ela: `scripts/vez.sh status`. Soltar à mão (só quando a outra ferramenta com certeza parou): `scripts/vez.sh liberar <dono-atual>`.

No Cursor isso é automático por `.cursor/hooks.json`: puxa e pede a vez ao abrir a sessão, bloqueia ferramentas sem a vez e roda o autossave ao fim de cada resposta. Se o Cursor travar com "BLOQUEADO pela vez", rodar `scripts/vez.sh status` no terminal; em último caso, apagar ou renomear `.cursor/hooks.json`.
