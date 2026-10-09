import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Maximize2, Share, Smartphone, SquarePlus, X, Zap } from "lucide-react";
import { Tag } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { isStandalone } from "@/lib/standalone";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** "Agora não" vale por 30 dias neste aparelho. */
const DISMISS_KEY = "arena:pwa-install-dismissed-until";
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

/** Nunca por cima da entrada e do cadastro: o convite não cobre formulário. */
function hiddenOn(pathname: string) {
  return pathname.startsWith("/auth") || pathname.startsWith("/cadastrar");
}

/** No iPhone o Safari não oferece o botão de instalar: o convite mostra os 2 passos. */
function isIos() {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function dismissedRecently() {
  try {
    return Number(window.localStorage.getItem(DISMISS_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

/**
 * Convite para pôr o app na tela inicial: ícone do app, os ganhos reais em pílulas e uma ação.
 * Android/computador: botão "Adicionar à tela inicial" (quando o navegador permite).
 * iPhone: os 2 passos (Compartilhar → Adicionar à Tela de Início), só no app e no painel.
 */
export function PwaInstallBanner() {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (isStandalone() || dismissedRecently()) return;
    setDismissed(false);
    setIos(isIos());

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const inApp = ["/app", "/shop", "/demo"].some((prefix) => pathname.startsWith(prefix));
  const showIos = ios && !deferred && inApp;
  if (dismissed || hiddenOn(pathname) || (!deferred && !showIos)) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
    } catch {
      // Sem armazenamento: some só enquanto esta tela estiver aberta.
    }
    setDismissed(true);
  }

  return (
    <div className="pwa-install-banner pointer-events-none fixed inset-x-0 bottom-[var(--app-banner-bottom)] z-[80] flex justify-center p-3">
      <section
        aria-label={t("entry.pwa.title")}
        className="entry-result-card pointer-events-auto w-full max-w-md p-3 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <img
            src="/icons/icon-192.png"
            alt=""
            className="size-12 shrink-0 rounded-[var(--control-radius)]"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold tracking-tight">{t("entry.pwa.title")}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Tag icon={Zap}>{t("entry.pwa.oneTap")}</Tag>
              <Tag icon={Maximize2}>{t("entry.pwa.fullScreen")}</Tag>
            </div>
          </div>
          <button
            type="button"
            aria-label={t("ui.pwa.dismiss")}
            className="app-icon-button -me-1 -mt-1 size-11 shrink-0"
            onClick={dismiss}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {showIos ? (
          <ol aria-label={t("entry.pwa.iosLabel")} className="mt-3 grid grid-cols-2 gap-2">
            {(
              [
                [Share, t("entry.pwa.iosShare")],
                [SquarePlus, t("entry.pwa.iosAdd")],
              ] as const
            ).map(([Icon, label], index) => (
              <li
                key={label}
                className="flex min-h-11 items-center gap-2 rounded-[var(--control-radius)] border border-border bg-background/60 px-2.5 py-2 text-xs font-semibold"
              >
                <span
                  aria-hidden="true"
                  className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
                >
                  {index + 1}
                </span>
                <Icon className="size-4 shrink-0 text-gold" aria-hidden="true" />
                <span className="min-w-0">{label}</span>
              </li>
            ))}
          </ol>
        ) : (
          deferred && (
            <button
              type="button"
              className="action-button action-confirm mt-3 w-full"
              onClick={() => {
                void (async () => {
                  await deferred.prompt();
                  await deferred.userChoice;
                  setDeferred(null);
                })();
              }}
            >
              <Smartphone aria-hidden="true" />
              {t("entry.pwa.add")}
            </button>
          )
        )}
      </section>
    </div>
  );
}
