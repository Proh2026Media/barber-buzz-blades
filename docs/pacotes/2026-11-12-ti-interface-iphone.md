# Interface no iPhone — entrega local para revisão

## Estado e escopo

Correção do frontend, sem publicação. O Xcode pôde ser inspecionado, mas o Simulator não está exposto nesta sessão. Não foi alterado o projeto nativo provisório aberto no Xcode. O B&C continua sendo uma aplicação web/PWA.

Pacote: `BC-Interface-iPhone-2026-11-12.zip`. Contém o patch incremental, cópias dos arquivos alterados, identificação da base, hashes SHA-256 e resultado dos testes visuais. Não contém `.env`, credenciais, build antigo, migrations ou funções Edge. Não substitui os pacotes de WhatsApp/grupos.

## Correções já implementadas pelo Codex

1. Área visível compartilhada acompanha a abertura/fechamento do teclado e as barras do navegador. Zoom por pinça permanece livre.
2. Cabeçalhos, navegação, acesso e páginas iniciais respeitam recortes superiores, inferiores e laterais. A logo do cabeçalho do cliente deixa de crescer junto com o recuo da câmera e de cobrir o nome da loja.
3. A reserva inferior usa a altura medida do menu. O último conteúdo pode ser rolado acima dele. Durante digitação com teclado aberto, a navegação inferior cede espaço ao formulário e retorna ao fechar.
4. Na composição lateral de tablet/paisagem curta, a navegação pode rolar. Ela não reserva no rodapé a altura da coluna inteira.
5. Janelas e confirmações usam a área visível disponível. Campos por toque usam tamanho legível, sem desabilitar a ampliação do navegador.
6. Cores, tipografia de marca, modos de canto e regras de negócio permanecem nos componentes existentes. Nenhuma alteração na pasta da marca.

## Verificação concluída

- `npm run typecheck`: passou.
- `npm run build`: passou, incluindo cópia do service worker.
- ESLint dos arquivos JS/TS alterados e `git diff --check`: passaram.
- `node scripts/testar-viewport.mjs`: 35 combinações — acesso, início, cliente em demonstração, dono em demonstração e administração; larguras 320, 390, 440, 768, 956, 1024 e 1440. Sem rolagem horizontal e sem erros JavaScript nesses cenários.
- Conferências adicionais: janela em retrato/paisagem; recuo inferior do menu; último conteúdo acima do menu; logo/nome nos três modos de canto; teclado sintético, retorno da navegação e preservação de zoom.
- Dados e rede Supabase simulados; nenhum login real, grupo, notificação ou mensagem enviado.

**Limite da evidência:** Chromium local com dimensões, áreas seguras e eventos de teclado simulados. Não é homologação no iPhone, no WebKit ou no Edge Beta. Não é auditoria de todas as telas e estados do sistema.

## Trabalho restante da TI

Não há tarefa de desenvolvimento transferida para a TI. Não acessar VPS nem reinstalar push/Evolution para esta entrega.

1. Conferir `SHA256SUMS` e `BASE.txt`. Usar uma cópia atualizada e limpa do frontend, em ramo separado, respeitando a vez do projeto. O patch foi produzido sobre a revisão indicada; se houver divergência de fonte, devolver os caminhos divergentes, sem sobrescrever trabalho novo.
2. Executar `git apply --check interface-iphone.patch`. Somente se passar, aplicar com `git apply interface-iphone.patch`. As cópias em `arquivos/` servem para revisão, não para copiar sobre um checkout divergente.
3. Instalar dependências pelo lockfile existente, executar `npm run typecheck` e `npm run build`. Para repetir a matriz, iniciar o frontend local em `localhost:8090` e executar `node scripts/testar-viewport.mjs`; usa a infraestrutura de navegador descrita em `scripts/foto.mjs`.
4. Preparar prévia HTTPS pelo processo habitual. **O pacote não é ordem para enviar à main:** esse envio publica o site. A decisão de publicação deve usar o resultado concreto desta revisão.
5. Na prévia, com o titular, conferir no iPhone 17 Pro Max/Edge Beta e Safari: retrato/paisagem, barras abertas/recolhidas, teclado em e-mail/senha/telefone, voltar após fechar teclado, rolagem até a última ação e janela longa. Conferir também instalação na tela inicial e texto ampliado. Não registrar QR, senha ou código de acesso no relatório.
6. Devolver commit da prévia, navegador/iOS utilizados, resultados por cenário e qualquer recorte observado. Se aprovado para publicação, usar o fluxo normal do frontend. Não fazer Redeploy do backend no Coolify.

## Reversão

Antes de publicar, descartar somente este ramo de revisão se necessário. Depois de uma publicação autorizada, reverter o commit desta entrega pelo fluxo normal, sem `push --force`. Banco, chaves VAPID, timer Web Push e Evolution não fazem parte da reversão.

## Pendências distintas

- O usuário confirmou recebimento do primeiro Web Push. O texto nativo “from” e a identidade de instalação ainda exigem tratamento separado; este pacote não afirma corrigi-los.
- Login/confirmação por WhatsApp continuam sem homologação completa. O último diagnóstico conhecido de Gmail/4593 indicava telefone sem verificação e sem grupo próprio pronto. Não reutilizar o grupo do administrador nem prometer que esta correção visual libera o login.
