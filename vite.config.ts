// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Hostinger monta como servidor Node (preset node-server), não Cloudflare.
  // O @lovable.dev/mcp-js importa "cloudflare:workers" de forma OPCIONAL
  // (import dinâmico dentro de try/catch, com process.env como reserva), mas o
  // Rollup tenta resolver o módulo na montagem e falha. Declarar como externo
  // mantém o import dinâmico: na Cloudflare funciona, no Node cai no catch.
  // preset fixo em node-server: sem isto o padrão do Lovable é cloudflare-module,
  // que gera um worker (wrangler.json) que o Node da Hostinger não roda (503).
  // Dentro do Lovable nada muda — lá o preset é forçado para Cloudflare.
  nitro: {
    preset: "node-server",
    rollupConfig: { external: ["cloudflare:workers"] },
  },
  vite: {
    plugins: [
      mcpPlugin(),
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
        manifest: {
          name: "Barba & Cabelo",
          short_name: "Barba&Cabelo",
          description: "Agendamento, fidelidade e gestão para barbearias.",
          lang: "pt-BR",
          dir: "ltr",
          start_url: "/",
          scope: "/",
          display: "standalone",
          orientation: "portrait-primary",
          background_color: "#e9e5de",
          theme_color: "#20211f",
          categories: ["lifestyle", "business"],
          icons: [
            {
              src: "/icons/icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/icons/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/icons/icon-192-maskable.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable",
            },
            {
              src: "/icons/icon-512-maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          // O client bundle do Nitro fica em .output/public; o plugin gera o SW em dist/.
          // Precache mínimo dos estáticos públicos; fontes são empacotadas localmente.
          globPatterns: ["icons/*", "manifest.webmanifest"],
          additionalManifestEntries: [{ url: "/", revision: `${Date.now()}` }],
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
