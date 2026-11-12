# P-120 — primeiro acesso e código protegido no grupo

Entrega somente local de 11/11/2026, em continuação à [base anterior](2026-11-11-p120-login-grupo-local.md). O dono autorizou implementar; publicação, alteração na VPS e mensagens/grupos reais continuam fora do escopo.

## Implementado

1. Cliente novo entra por e-mail/senha ou Google, informa o telefone e aceita o grupo em sessão autenticada. A nº 109 cria adesão provisória de uma hora, sem confirmar silenciosamente o telefone.
2. Convite apresentado apenas ao titular. Após entrada aprovada e conferência de composição, **Receber código no grupo → Confirmar código** prova a posse do telefone para aquela conta. Adesão vencida pode ser retomada no mesmo grupo; criação incerta exige revisão e não é repetida.
3. Login posterior usa exclusivamente o grupo elegível resolvido pelo servidor. Cliente + números autorizados do B&C, sem profissionais. Desafio e tentativa ficam ligados a pessoa, telefone, grupo, versão e instância; consumo único e limites existentes preservados.
4. Confirmação inicial e login usam a nova rota protegida da [Evolution v2](../../integrations/evolution/grupos-v2/README.md). Chave adicional, metadados ao vivo, diário, serialização e remoção de códigos do histórico/webhook da aplicação. Nenhum fallback privado.
5. Mais de um número autorizado pode ser incluído no mesmo grupo, com conferência após cada inclusão. Cliente não é adicionado à força. Números compartilhados P-119 preservados.
6. Cadastro do cliente deixa de disparar código privado automaticamente. Recuperação de senha permanece pelo e-mail; retirado o caminho de recuperação privada do `auth-otp`. Administrador/profissional sem grupo usa e-mail/Google. Código por e-mail não foi implementado.
7. Telefone de uma conta funciona em várias lojas. [Correção P-121](2026-11-11-p121-cliente-varias-barbearias.md) esclarece reutilização de conta e preserva o destino do link. Até cinco adesões novas por pessoa/hora; uma por pessoa/loja. A retomada não cria outro grupo.

## Verificações

- B&C: tipos, **570 testes**, lint e montagem aprovados. Prettier dos arquivos desta entrega aprovado; roteiro geral acusa somente `.vscode/extensions.json` preexistente, preservado. Dois avisos de lint preexistentes nos alterados e avisos de dependências/tamanho na montagem.
- PostgreSQL local: **1.538 PASS**, zero FAIL/ERROR. Inclui adesão provisória/expiração, titular, privilégios, consumo único e mesmo telefone em duas lojas com pontos separados.
- Ensaio integrado: **27 PASS**, banco real descartável e provedor inteiramente fictício; primeiro acesso, confirmação, login, concorrência, saída, revogação, recuperação e reversões nº 108/109. Não equivale a sessão WhatsApp real.
- Interface: **300 verificações em 30 telas** do primeiro acesso, 320–1440 px, claro/escuro, três cantos; convite, espera, clique duplo, erro/correção do código, confirmação e ausência de rolagem horizontal. Grupos: 128 verificações em 36 telas. P-121: teste da tela real de entrada em cinco larguras.
- Evolution: **33 testes**, sendo quatro PostgreSQL, tipos, lint dos fontes alterados, montagem e imagem local Linux/AMD64. Patch aplica na revisão limpa exata; hash no pacote.
- Deno: `auth-otp` e `whatsapp-groups` conferidos. Segredos, `.env` e `.vscode/` preservados.

Capturas e logs de bancada estão em `/tmp/bc-p120-*` e `/tmp/bc-p121-*`; podem ser removidos pelo sistema. Capturas representativas inspecionadas. Sem dispositivo físico, usuário real ou rede de produção.

## O que ainda impede declarar tudo disponível

O fluxo **cliente → adesão → confirmação → login** está implementado e ensaiado localmente. Flags permanecem desligadas; nº 105–109 e as migrations da Evolution não foram instaladas. Não publicar este ramo como implantação global pronta.

- A TI precisa revisar o pacote, comprovar isolamento de números/credenciais/aparelhos e preparar ambiente/janela de teste. [Roteiro único](2026-11-11-ti-p120-revisao-piloto-grupos.md).
- Cadastro público de uma **nova barbearia** (`/cadastrar`, `register-shop`) ainda depende do fluxo legado de comprovação. A nº 108 bloqueia seu emissor privado. Não faz parte do cadastro de cliente validado aqui e **precisa de alternativa autenticada antes da publicação geral**. Não afrouxar a prova de identidade nem remover unicidade do telefone para contornar isso.
- Avisos de negócio/marketing e recibos de cliente no módulo de grupos permanecem no escopo maior de grupos; esta entrega valida códigos de autenticação, não libera toda a comunicação.
- Isolamento externo, criação/admissão PN/LID e entrega real só podem ser homologados na infraestrutura autorizada. A extensão não garante atomicidade entre banco e WhatsApp, nem impede restrições da Meta.

## Reversão

[Reversão nº 109](../../supabase/rollback/20261111220000_grupos_primeiro_acesso.sql) desliga adesão/login, vence adesões provisórias, invalida controles/convites e bloqueia operações, preservando provas. Não restaura OTP privado nem profissionais. Também desligar as flags de piloto. Rollback de imagem/banco Evolution exige plano da TI conforme o provedor real, sem remover diário/travas cegamente.
