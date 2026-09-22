# Orientações persistentes do projeto

## Retomada de contexto

Ao assumir o projeto em outro chat ou provedor, ler primeiro [docs/CONTINUIDADE.md](docs/CONTINUIDADE.md), com estado das entregas, regras aprovadas, validações e pendências.

## Interface — `/mb`

Neste projeto, `/mb` é o atalho textual para aplicar a skill `mb`, também invocável como `$mb`.
Antes de desenvolver ou revisar interfaces, ler `~/.codex/skills/mb/SKILL.md`. Para outro provedor ou ambiente sem essa skill instalada, usar a cópia portátil [docs/mb-interface.md](docs/mb-interface.md).
Esse atalho é uma convenção do projeto; não é uma rota do aplicativo nem exige um comando nativo na interface do Codex.

A direção atual é uma interface moderna, intuitiva e acessível a diferentes idades, com controles visuais e explicações curtas. O sistema deve se adaptar integralmente aos três modos de canto configuráveis — retos, semi arredondados e arredondados — usando semi arredondados como padrão até o usuário escolher e salvar outro. Aplicar o modo escolhido de forma consistente a botões, campos, cartões, janelas, cabeçalhos e rodapés. Preservar uma identidade visual consolidada entre páginas e estados, sem oscilações arbitrárias de tipografia, cor, espaçamento ou elevação. Manter os cartões off-white, os gradientes de fidelidade e as cores de ação aprovadas.

## Ideias para desenvolvimento futuro

- [Módulo de reembolso e cancelamento](docs/reembolso-futuro.md): registro preliminar solicitado pelo usuário, ainda sem implementação. Consultar antes de desenvolver pagamentos, taxas de cancelamento ou reembolsos. A documentação não autoriza ativar cobranças nem altera os cancelamentos atuais.

## PWA

O app é instalável (manifesto, service worker, ícones). Detalhes em [docs/pwa.md](docs/pwa.md).

## Operação (Coolify, Titan, Google)

Passo a passo de e-mail Titan, SMTP do Auth, login Google, domínio `supabasebeauty` e checklists: [docs/mb-operacao.md](docs/mb-operacao.md).
