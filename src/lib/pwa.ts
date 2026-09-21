import { useEffect } from "react";

/** Registra o service worker do PWA apenas no navegador. */
export function registerPwa() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  // Em desenvolvimento local o SW atrapalha o HMR; só ativa em produção.
  if (import.meta.env.DEV) return;

  void import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onRegisteredSW(swUrl, registration) {
          if (!registration) return;
          // Atualiza em intervalos curtos para pegar novas versões do app.
          window.setInterval(
            () => {
              void registration.update();
            },
            60 * 60 * 1000,
          );
          if (import.meta.env.DEV) console.info("[pwa] registered", swUrl);
        },
      });
    })
    .catch(() => {
      // Plugin ausente ou build sem PWA — o app continua normal.
    });
}

export function PwaRegister() {
  useEffect(() => {
    registerPwa();
  }, []);
  return null;
}
