import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "arena:pwa-install-dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as { standalone?: boolean }).standalone))
  );
}

/** Banner discreto para instalar o app como PWA (quando o navegador permitir). */
export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // ignore
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible || !deferred) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[var(--app-banner-bottom)] z-[80] flex justify-center p-3">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur-xl">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#20211f] text-[#dfbc85]">
          <Download className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight">Instalar o app</p>
          <p className="text-xs text-muted-foreground">Abra na tela inicial, como um aplicativo.</p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
          onClick={() => {
            void (async () => {
              await deferred.prompt();
              await deferred.userChoice;
              setVisible(false);
              setDeferred(null);
            })();
          }}
        >
          Instalar
        </button>
        <button
          type="button"
          aria-label="Dispensar instalação"
          className="app-icon-button size-9 shrink-0"
          onClick={() => {
            try {
              sessionStorage.setItem(DISMISS_KEY, "1");
            } catch {
              // ignore
            }
            setVisible(false);
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
