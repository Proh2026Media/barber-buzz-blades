# PWA (app instalável)

A Aurset e os aplicativos dos estabelecimentos podem ser instalados na tela inicial do Android e do iPhone. O domínio aberto determina o nome e a marca da instalação.

## O que já está no projeto

- O domínio da plataforma usa `public/manifest.webmanifest` e os arquivos de `public/icons/`.
- Nos domínios dos estabelecimentos, `/identidade/manifesto` indica os ícones PNG de 192 e 512 px. A aba usa 32 px e o iPhone usa 180 px em `/apple-touch-icon.png`. A logo fica centralizada e mantém a proporção original. A versão `maskable` reserva espaço para a máscara do dispositivo. Uma loja sem logo usa o selo com suas iniciais e cores.
- Service worker: `vite-plugin-pwa` (build gera `sw.js`)
- Convite “Instalar o app” quando o navegador oferecer: desde 09/11/2026, ocupa espaço no conteúdo rolável da loja, cliente, administração e pontos; nas páginas públicas, acompanha o fluxo da página. Não sobrepõe os controles. O evento é capturado uma vez na raiz, inclusive durante a entrada nas áreas autenticadas. Fechar adia por 30 dias neste aparelho.
- Metas Apple/Android no `__root.tsx`
- Safe area em modo `standalone`

## Como testar

### Recuos e teclado — correção local de 12/11/2026

`VisibleViewport` acompanha a área visível sem bloquear zoom; `styles/viewport.css` reúne os recuos do aparelho. `WorkspaceFrame` mede a navegação inferior para reservar espaço real na rolagem. Os diálogos usam a mesma informação de teclado, sem observadores separados por janela. A logo do cliente não inclui a área da câmera no cálculo de sua altura.

Com o servidor em `localhost:8090`, `node scripts/testar-viewport.mjs` valida 35 combinações com dados fictícios e teclado/recortes simulados. Não substitui a validação física no iPhone. [Entrega e roteiro de homologação](pacotes/2026-11-12-ti-interface-iphone.md). Ainda não publicado.

### Instalação

1. Build de produção: `bun run build` (copia o SW para `.output/public`)
2. Servir em HTTPS ou `localhost` / IP local
3. No celular (mesma rede): abrir o app → menu do navegador → **Adicionar à tela de início** / **Instalar app**

No Chrome desktop, o ícone de instalação aparece na barra de endereço quando os critérios forem atendidos.

## Observações

- Em `npm run dev` o service worker fica desligado de propósito (não atrapalha o HMR).
- Instalação real exige origem segura (HTTPS) fora de localhost.
- Confirme no Supabase Auth as Redirect URLs do domínio/IP usados no celular.
- **Login com Google no app instalado (16/10/2026):** no iPhone a janela do Google não tem o armazenamento do app. O app começa o login e recebe o código de volta pelo banco (rota `/auth/retorno`, migration `20261016120000_retorno_google_app_instalado`); a janela pede para ser fechada (OK/X no canto). Detalhes em [guia/arquitetura.md](guia/arquitetura.md), seção 9.
- O manifesto não trava mais a tela em pé (`orientation: any`): no tablet instalado o app gira.
