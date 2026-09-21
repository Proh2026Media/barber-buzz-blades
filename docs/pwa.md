# PWA (app instalável)

O Barba & Cabelo pode ser instalado na tela inicial (Android/Chrome e iOS Safari).

## O que já está no projeto

- Manifesto: `public/manifest.webmanifest`
- Ícones: `public/icons/` (180, 192, 512 + maskable)
- Service worker: `vite-plugin-pwa` (build gera `sw.js`)
- Banner “Instalar o app” quando o navegador oferecer
- Metas Apple/Android no `__root.tsx`
- Safe area em modo `standalone`

## Como testar

1. Build de produção: `bun run build` (copia o SW para `.output/public`)
2. Servir em HTTPS ou `localhost` / IP local
3. No celular (mesma rede): abrir o app → menu do navegador → **Adicionar à tela de início** / **Instalar app**

No Chrome desktop, o ícone de instalação aparece na barra de endereço quando os critérios forem atendidos.

## Observações

- Em `npm run dev` o service worker fica desligado de propósito (não atrapalha o HMR).
- Instalação real exige origem segura (HTTPS) fora de localhost.
- Confirme no Supabase Auth as Redirect URLs do domínio/IP usados no celular.
