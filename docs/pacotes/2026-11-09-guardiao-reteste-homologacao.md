# Guardião — Reteste da homologação do Barba & Cabelo

Preparado em **09/11/2026**. Responde ao arquivo `bc-homologacao-2026-11-08.md`, recebido do dono. Destinatário: **TI/Guardião**, pelo navegador. Não envolve o Flow, acesso à VPS, novas contas nem redefinição de senhas.

## Resultado recebido

O relatório é **parcial**, de leitura; não aprova integralmente o sistema. Registrou perda da loja escolhida após recarregar (A2), convite de instalação cobrindo conteúdo (P-43) e retorno de Pontos para Agenda (I8). Os logins e a leitura de papéis não comprovam todas as permissões. A composição 70/30 foi apenas reconfirmada; o cenário 50/50 não foi executado.

SHA-256 do relatório recebido: `373732542f28e96c49db45fbb2de8263c935ca9f30c32d51b55b19d4220f0ea3`.

## Correções desta entrega

1. **Loja escolhida:** o painel conserva no endereço o vínculo efetivamente aberto, pelo parâmetro `unidade`. Recarregar mantém a loja e o papel escolhidos. Sem escolha explícita no endereço, continua valendo a entrada pelo domínio. Um vínculo de outra conta não concede acesso.
2. **Pontos e links de Ajustes:** a navegação aguarda a identificação da loja pelo domínio antes de conferir a aba permitida. A ausência temporária de loja não devolve mais a pessoa à Agenda.
3. **Convite de instalação:** agora ocupa espaço no conteúdo e acompanha sua rolagem, nas áreas da loja, cliente, administração e pontos. Não fica fixo por cima de tabelas, agenda ou formulários. Em área estreita, o ícone decorativo cede espaço ao texto; as instruções do iPhone quebram linha. Cores, ações e cantos continuam os existentes. Fechar conserva o adiamento de 30 dias.

Não há migration nesta correção. A instalação das nº 99/100 e a integração Mercado Pago continuam em seus roteiros próprios; este documento não afirma que foram executadas.

## Validação local

394 testes automatizados, tipos, lint, formatação e montagem passaram. Bancada isolada confirmou as trocas de loja/recarga, inclusive sem gravar a preferência local, e Pontos para dono/contratado. Convite conferido em 18 combinações de perfil/largura e em 6 combinações de tema/cantos com texto 200% e instruções iOS simuladas; também na página pública, Pontos no celular e oculto no login. Não equivale a instalação nativa nem homologação em aparelho físico.

## Reteste solicitado

Usar os acessos de teste já entregues, preservando UUID, papéis, senhas e a sociedade 70/30. Não reenviar credenciais em relatório. Esta rodada não precisa criar agendamentos, enviar mensagens ou alterar dados.

1. **A2 — dono A / contratado B:** entrar como dono, abrir Ajustes → Equipe e sociedade pela navegação, trocar para Loja Teste B, conferir nome e papel, recarregar duas vezes. A B deve permanecer aberta como Contratado. Abrir/fechar uma seção de Ajustes e repetir a recarga; voltar para A pelo seletor e conferir Dono 70%. O domínio pode continuar o mesmo; o nome da loja, o papel e a escolha no endereço precisam ser coerentes.
2. **I8 — Pontos:** em computador ou tablet com largura a partir de 768 px, abrir `/shop/pontos` como dono e depois como contratado. É esperado redirecionar para `/shop?secao=pontos` (podendo conter também `unidade`), mostrando Clube de pontos, não Agenda. Conferir a busca e a ordenação quando houver registros, somente com as ações permitidas à conta. No celular, a tela de pontos continua separada. Não conceder/remover pontos para este reteste.
3. **P-43 — convite de instalação:** se o navegador oferecer o convite, conferir dono e cliente com janela ampla, estreita e zoom de 200%. Rolar a área principal: o convite deve sair com o conteúdo, sem permanecer sobre os controles. Conferir Tab, foco e fechar pelo teclado; abrir um formulário sem salvar e confirmar que a janela fica acima do conteúdo. A instalação efetiva não é necessária. Se o convite estiver adiado ou o app já estiver instalado, registrar essa condição; não apagar cookies, sessões ou dados do perfil para fazê-lo reaparecer.

## O que devolver

Um único relatório respondendo a **este arquivo**, com data/hora, endereço/site, conta identificada somente pelo perfil de teste, aparelho/navegador, largura/zoom e resultado **passou / falhou / não executado** por caso. Para falha, incluir passos e captura sem segredos. Não repetir o histórico de preparação do cofre.

## Limites e pendências mantidos

A correção e a bancada não encerram P-40 a P-43. Continuam pendentes os cenários não executados do roteiro de 07/11: trocas de sessão completas, admin e cenários sem contas/vínculos disponíveis, governança 50/50, ciclo de agendamento, integrações reais e aparelhos físicos. P-39 depende da revisão profissional. P-49/P-70 seguem separados. O relatório recebido não permite declarar essas etapas aprovadas.
