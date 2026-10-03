// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Hostinger monta como servidor Node (preset node-server), não Cloudflare.
  // preset fixo em node-server: sem isto o padrão do Lovable é cloudflare-module,
  // que gera um worker (wrangler.json) que o Node da Hostinger não roda (503).
  // Dentro do Lovable nada muda — lá o preset é forçado para Cloudflare.
  // (O antigo external de "cloudflare:workers" existia só por causa do
  // @lovable.dev/mcp-js; saiu junto com o MCP de exemplo em 03/10/2026.)
  nitro: {
    preset: "node-server",
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: false,
        includeAssets: [
          "icons/icon-180.png",
          "icons/icon-192.png",
          "icons/icon-512.png",
          "icons/icon-192-maskable.png",
          "icons/icon-512-maskable.png",
          "manifest.webmanifest",
        ],
        // Fonte única do manifesto: public/manifest.webmanifest (ligado em __root.tsx).
        // Gerar outro aqui punha "manifest.webmanifest" duas vezes no precache com revisões
        // diferentes, e o Workbox abortava o service worker (sem cache nem modo offline).
        manifest: false,
        workbox: {
          // O client bundle do Nitro fica em .output/public; o plugin gera o SW em dist/.
          // Precache mínimo dos estáticos públicos; fontes são empacotadas localmente.
          globPatterns: ["icons/*", "manifest.webmanifest"],
          // "/" fica fora do precache: navegações seguem só a regra NetworkFirst ("pages"),
          // para não servir HTML de uma versão anterior apontando para bundles que já saíram.
          navigateFallback: null,
          runtimeCaching: [
            {
              urlPattern: ({ request, sameOrigin }) =>
                sameOrigin && request.destination === "document",
              handler: "NetworkFirst",
              options: {
                cacheName: "pages",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              urlPattern: ({ request, sameOrigin }) =>
                sameOrigin && ["style", "script", "worker"].includes(request.destination),
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "assets",
                expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 7 },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    // Permite carregar o app dentro do preview do Open Design (origem diferente de localhost).
    server: { cors: true },
  },
});
