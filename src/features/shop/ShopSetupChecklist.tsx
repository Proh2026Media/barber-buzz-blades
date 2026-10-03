import { useEffect, useState, type ComponentType } from "react";
import { Check, ChevronRight, Clock3, Copy, MapPin, Palette, Scissors, X } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { parseLandingConfig } from "@/features/marketing/shop-landing";
import { DEFAULT_ACCENT_COLOR, DEFAULT_PRIMARY_COLOR } from "@/lib/shop/branding";

/** Para onde cada passo leva: abas do painel ou janelas de Ajustes > Aparência. */
export type SetupTarget = "horarios" | "servicos" | "landing" | "brand";

type StoredState = { hoursOk?: boolean; linkCopied?: boolean; hidden?: boolean };

const storageKey = (shopId: string) => `shopSetup:${shopId}`;

function readStored(shopId: string): StoredState {
  try {
    const raw = window.localStorage.getItem(storageKey(shopId));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as StoredState) : {};
  } catch {
    return {};
  }
}

function writeStored(shopId: string, next: StoredState) {
  try {
    window.localStorage.setItem(storageKey(shopId), JSON.stringify(next));
  } catch {
    // Navegação privada ou armazenamento bloqueado: o guia segue funcionando nesta visita.
  }
}

/** Avisa o guia já montado (se houver) que o estado salvo mudou. */
const SHOW_EVENT = "shop-setup:show";

/** O dono/sócio escolheu "Esconder guia" para esta loja neste aparelho? */
export function isShopSetupGuideHidden(shopId: string): boolean {
  if (typeof window === "undefined") return false;
  return !!readStored(shopId).hidden;
}

/**
 * Desfaz o "Esconder guia" desta loja (usado em Ajustes > "Mostrar guia de configuração").
 * Mantém os passos já marcados à mão (horários conferidos, link copiado).
 */
export function showShopSetupGuide(shopId: string) {
  if (typeof window === "undefined") return;
  const { hidden: _hidden, ...rest } = readStored(shopId);
  writeStored(shopId, rest);
  window.dispatchEvent(new CustomEvent(SHOW_EVENT, { detail: shopId }));
}

/**
 * A loja nasce aberta de segunda a sábado, das 9h às 19h. Qualquer diferença disso
 * (ou uma linha alterada depois de criada) indica que o dono já mexeu nos horários.
 */
function hoursWereEdited(hours: Tables<"business_hours">[]) {
  return hours.some((row) => {
    const defaultOpen = row.weekday >= 1 && row.weekday <= 6;
    if (row.is_open !== defaultOpen) return true;
    if (row.is_open && (!row.opens_at.startsWith("09:00") || !row.closes_at.startsWith("19:00"))) {
      return true;
    }
    const created = Date.parse(row.created_at);
    const updated = Date.parse(row.updated_at);
    return Number.isFinite(created) && Number.isFinite(updated) && updated - created > 1000;
  });
}

function sameColor(value: string | null | undefined, fallback: string) {
  return (value ?? fallback).trim().toUpperCase() === fallback.toUpperCase();
}

type Step = {
  id: "hours" | "service" | "contact" | "brand" | "link";
  done: boolean;
  icon: ComponentType<{ className?: string }>;
  title: MessageKey;
  hint: MessageKey;
  action: MessageKey;
  onAction: () => void;
};

/**
 * Guia "Deixe sua barbearia pronta": aparece no topo da Agenda para dono e sócio,
 * marca cada passo sozinho a partir dos dados já carregados pelo painel e some
 * quando tudo estiver feito ou quando a pessoa escolher esconder.
 */
export function ShopSetupChecklist({
  shopId,
  publicUrl,
  services,
  businessHours,
  settings,
  onOpen,
}: {
  shopId: string;
  publicUrl: string;
  services: Tables<"services">[];
  businessHours: Tables<"business_hours">[];
  settings: Tables<"barbershop_settings">;
  onOpen: (target: SetupTarget) => void;
}) {
  const { t } = useI18n();
  const [stored, setStored] = useState<StoredState>({});
  const [loaded, setLoaded] = useState(false);

  // Lê depois de montar para não divergir da renderização no servidor.
  useEffect(() => {
    setStored(readStored(shopId));
    setLoaded(true);
    const onShow = (event: Event) => {
      if ((event as CustomEvent<string>).detail === shopId) setStored(readStored(shopId));
    };
    window.addEventListener(SHOW_EVENT, onShow);
    return () => window.removeEventListener(SHOW_EVENT, onShow);
  }, [shopId]);

  function remember(patch: StoredState) {
    setStored((current) => {
      const next = { ...current, ...patch };
      writeStored(shopId, next);
      return next;
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      remember({ linkCopied: true });
      toast.success(t("cad.guia.linkCopied"));
    } catch {
      toast.error(t("cad.guia.linkCopyError"));
    }
  }

  const landing = parseLandingConfig(settings.landing);
  const steps: Step[] = [
    {
      id: "hours",
      done: !!stored.hoursOk || hoursWereEdited(businessHours),
      icon: Clock3,
      title: "cad.guia.hoursTitle",
      hint: "cad.guia.hoursHint",
      action: "cad.guia.hoursAction",
      onAction: () => onOpen("horarios"),
    },
    {
      id: "service",
      done: services.some((service) => service.active),
      icon: Scissors,
      title: "cad.guia.serviceTitle",
      hint: "cad.guia.serviceHint",
      action: "cad.guia.serviceAction",
      onAction: () => onOpen("servicos"),
    },
    {
      id: "contact",
      done: landing.address.trim() !== "" && landing.whatsapp.trim() !== "",
      icon: MapPin,
      title: "cad.guia.contactTitle",
      hint: "cad.guia.contactHint",
      action: "cad.guia.contactAction",
      onAction: () => onOpen("landing"),
    },
    {
      id: "brand",
      done:
        !!settings.logo_url ||
        !sameColor(settings.primary_color, DEFAULT_PRIMARY_COLOR) ||
        !sameColor(settings.accent_color, DEFAULT_ACCENT_COLOR),
      icon: Palette,
      title: "cad.guia.brandTitle",
      hint: "cad.guia.brandHint",
      action: "cad.guia.brandAction",
      onAction: () => onOpen("brand"),
    },
    {
      id: "link",
      done: !!stored.linkCopied,
      icon: Copy,
      title: "cad.guia.linkTitle",
      hint: "cad.guia.linkHint",
      action: "cad.guia.linkAction",
      onAction: () => void copyLink(),
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  if (!loaded || stored.hidden || doneCount === steps.length) return null;
  const percent = Math.round((doneCount / steps.length) * 100);
  const nextId = steps.find((step) => !step.done)?.id;

  return (
    <section
      aria-labelledby="shop-setup-title"
      className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 id="shop-setup-title" className="text-base font-extrabold tracking-tight">
            {t("cad.guia.title")}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("cad.guia.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => remember({ hidden: true })}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
          {t("cad.guia.hide")}
        </button>
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-xs font-semibold text-muted-foreground" aria-hidden>
          {t("cad.guia.progress", { done: doneCount, total: steps.length })}
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={doneCount}
          aria-valuetext={t("cad.guia.progress", { done: doneCount, total: steps.length })}
          aria-label={t("cad.guia.title")}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <ol className="mt-4 space-y-2">
        {steps.map((step) => {
          const Icon = step.icon;
          const isNext = step.id === nextId;
          return (
            <li
              key={step.id}
              className={`rounded-xl border p-3 ${
                step.done ? "border-transparent bg-muted/50" : "border-border bg-background"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={`mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full ${
                    step.done
                      ? "bg-emerald-600 text-white dark:bg-emerald-500"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {step.done ? <Check className="size-4" /> : <Icon className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-bold ${
                      step.done ? "text-muted-foreground line-through decoration-1" : ""
                    }`}
                  >
                    {t(step.title)}
                    <span className="sr-only">
                      {" "}
                      ({step.done ? t("cad.guia.statusDone") : t("cad.guia.statusPending")})
                    </span>
                  </p>
                  {!step.done && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t(step.hint)}
                      {step.id === "link" && (
                        <span className="mt-1 block break-all font-semibold text-foreground">
                          {publicUrl}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              {!step.done && (
                <div className="mt-3 flex flex-wrap gap-2 pl-11">
                  <button
                    type="button"
                    onClick={step.onAction}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-bold transition ${
                      isNext
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "border border-border bg-card text-foreground hover:border-primary/40"
                    }`}
                  >
                    {t(step.action)}
                    {step.id === "link" ? (
                      <Copy className="size-4" aria-hidden />
                    ) : (
                      <ChevronRight className="size-4" aria-hidden />
                    )}
                  </button>
                  {step.id === "hours" && (
                    <button
                      type="button"
                      onClick={() => remember({ hoursOk: true })}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground transition hover:border-primary/40"
                    >
                      <Check className="size-4" aria-hidden />
                      {t("cad.guia.hoursOk")}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
