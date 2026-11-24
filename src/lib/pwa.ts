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
          void registration.update().catch(() => {});
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
    if (!("serviceWorker" in navigator)) return;
    const retry = () => {
      navigator.serviceWorker.controller?.postMessage("retomar-toques-push");
      const fragment = window.location.hash;
      const token = /^#bc-toque=([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.exec(fragment)?.[1];
      if (!token) return;
      void fetch("/avisos/abertura/push?t=" + token, { method: "POST", credentials: "omit", cache: "no-store" })
        .then(response => {
          if (response.ok && window.location.hash === fragment) {
            window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
          }
        }).catch(() => {});
    };
    const visible = () => { if (document.visibilityState === "visible") retry(); };
    retry();
    window.addEventListener("hashchange", retry);
    window.addEventListener("online", retry);
    window.addEventListener("pageshow", retry);
    document.addEventListener("visibilitychange", visible);
    navigator.serviceWorker.addEventListener("controllerchange", retry);
    return () => {
      window.removeEventListener("hashchange", retry);
      window.removeEventListener("online", retry);
      window.removeEventListener("pageshow", retry);
      document.removeEventListener("visibilitychange", visible);
      navigator.serviceWorker.removeEventListener("controllerchange", retry);
    };
  }, []);
  return null;
}
