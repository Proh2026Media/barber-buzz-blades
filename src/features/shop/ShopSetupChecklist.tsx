import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  MapPin,
  Palette,
  Scissors,
  Share2,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { IconTile, Steps, readableLink } from "@/components/visual";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { parseLandingConfig } from "@/features/marketing/shop-landing";
import { DEFAULT_ACCENT_COLOR, DEFAULT_PRIMARY_COLOR } from "@/lib/shop/branding";

/** Para onde cada passo leva: abas do painel ou janelas de Ajustes > Aparência. */
export type SetupTarget = "horarios" | "servicos" | "landing" | "brand";

type StoredState = {
  hoursOk?: boolean;
  linkCopied?: boolean;
  hidden?: boolean;
  /** "Tudo pronto!" já foi mostrado uma vez nesta loja (neste aparelho). */
  celebrated?: boolean;
};

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
  icon: LucideIcon;
  /** Nome curto na faixa de etapas. */
  short: MessageKey;
  title: MessageKey;
  hint: MessageKey;
  /** Botão com verbo completo ("Adicionar endereço e WhatsApp"). */
  action: MessageKey;
  onAction: () => void;
};

/** Anel de progresso "2/5" (sem percentual inventado). */
function ProgressRing({ done, total, label }: { done: number; total: number; label: string }) {
  const radius = 20;
  const length = 2 * Math.PI * radius;
  return (
    <span
      role="img"
      aria-label={label}
      className="relative grid size-14 shrink-0 place-items-center"
    >
      <svg viewBox="0 0 48 48" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={radius} fill="none" strokeWidth="5" className="stroke-muted" />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - done / total)}
        />
      </svg>
      <span className="text-sm font-extrabold tabular-nums" aria-hidden>
        {done}/{total}
      </span>
    </span>
  );
}

/**
 * Guia "Deixe sua barbearia pronta": aparece no topo da Agenda para dono e sócio, marca cada
 * passo sozinho a partir dos dados já carregados pelo painel e mostra só o próximo passo aberto.
 * Ao completar, comemora uma vez; "Esconder" pode ser desfeito na hora ou em Ajustes.
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
  const [canShare, setCanShare] = useState(false);

  // Lê depois de montar para não divergir da renderização no servidor.
  useEffect(() => {
    setStored(readStored(shopId));
    setLoaded(true);
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
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

  /** No celular abre o compartilhamento (WhatsApp etc.); senão, copia. */
  async function shareLink() {
    if (!canShare) return copyLink();
    try {
      await navigator.share({ title: t("eq.guide.shareTitle"), url: publicUrl });
      remember({ linkCopied: true });
    } catch {
      // Fechou o compartilhamento sem enviar: nada muda.
    }
  }

  function hide() {
    remember({ hidden: true });
    toast.info(t("eq.guide.hidden"), {
      description: t("eq.guide.hiddenHint"),
      action: { label: t("eq.guide.undo"), onClick: () => remember({ hidden: false }) },
    });
  }

  const landing = parseLandingConfig(settings.landing);
  const steps: Step[] = [
    {
      id: "hours",
      done: !!stored.hoursOk || hoursWereEdited(businessHours),
      icon: Clock3,
      short: "eq.guide.step.hours",
      title: "cad.guia.hoursTitle",
      hint: "cad.guia.hoursHint",
      action: "eq.guide.action.hours",
      onAction: () => onOpen("horarios"),
    },
    {
      id: "service",
      done: services.some((service) => service.active),
      icon: Scissors,
      short: "eq.guide.step.service",
      title: "cad.guia.serviceTitle",
      hint: "cad.guia.serviceHint",
      action: "cad.guia.serviceAction",
      onAction: () => onOpen("servicos"),
    },
    {
      id: "contact",
      done: landing.address.trim() !== "" && landing.whatsapp.trim() !== "",
      icon: MapPin,
      short: "eq.guide.step.contact",
      title: "cad.guia.contactTitle",
      hint: "cad.guia.contactHint",
      action: "eq.guide.action.contact",
      onAction: () => onOpen("landing"),
    },
    {
      id: "brand",
      done:
        !!settings.logo_url ||
        !sameColor(settings.primary_color, DEFAULT_PRIMARY_COLOR) ||
        !sameColor(settings.accent_color, DEFAULT_ACCENT_COLOR),
      icon: Palette,
      short: "eq.guide.step.brand",
      title: "cad.guia.brandTitle",
      hint: "cad.guia.brandHint",
      action: "eq.guide.action.brand",
      onAction: () => onOpen("brand"),
    },
    {
      id: "link",
      done: !!stored.linkCopied,
      icon: Share2,
      short: "eq.guide.step.link",
      title: "eq.guide.linkTitle",
      hint: "eq.guide.linkHint",
      action: "eq.guide.action.link",
      onAction: () => void shareLink(),
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  const complete = doneCount === steps.length;

  // A comemoração aparece numa visita só: fica gravada para a próxima.
  useEffect(() => {
    if (!loaded || !complete || stored.celebrated || stored.hidden) return;
    writeStored(shopId, { ...readStored(shopId), celebrated: true });
  }, [loaded, complete, stored.celebrated, stored.hidden, shopId]);

  if (!loaded || stored.hidden) return null;
  if (complete) {
    if (stored.celebrated) return null;
    return (
      <section
        aria-labelledby="shop-setup-title"
        className="tone-success flex flex-wrap items-center gap-3 rounded-2xl border-2 border-[color:var(--tone-line)] bg-card p-4"
      >
        <IconTile icon={CheckCircle2} tone="success" size="lg" />
        <div className="min-w-0 flex-1 basis-48">
          <h3 id="shop-setup-title" className="text-base font-extrabold tracking-tight">
            {t("eq.guide.doneTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("eq.guide.doneHint")}</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="action-button action-confirm min-h-11 flex-1 justify-center sm:flex-none"
          >
            <ExternalLink className="size-4" aria-hidden />
            {t("eq.guide.seePage")}
          </a>
          <button
            type="button"
            onClick={() => remember({ celebrated: true })}
            className="action-button min-h-11"
          >
            {t("eq.common.close")}
          </button>
        </div>
      </section>
    );
  }

  const next = steps.find((step) => !step.done)!;
  const others = steps.filter((step) => !step.done && step.id !== next.id);
  const NextIcon = next.icon;
  const progress = t("cad.guia.progress", { done: doneCount, total: steps.length });

  return (
    <section
      aria-labelledby="shop-setup-title"
      className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-center gap-3">
        <ProgressRing done={doneCount} total={steps.length} label={progress} />
        <div className="min-w-0 flex-1">
          <h3
            id="shop-setup-title"
            className="text-base font-extrabold leading-tight tracking-tight"
          >
            {/* O título acompanha o progresso; o anel já mostra "2/5", então a linha de baixo
                diz o próximo passo em vez de repetir a conta. */}
            {doneCount === 0
              ? t("eq.guide.titleStart")
              : doneCount >= 3
                ? t("eq.guide.title")
                : t("eq.guide.titleMid")}
          </h3>
          <p className="text-xs font-semibold text-muted-foreground">
            {t("eq.guide.nextShort", { step: t(next.short) })}
          </p>
        </div>
        <button
          type="button"
          onClick={hide}
          aria-label={t("cad.guia.hide")}
          title={t("cad.guia.hide")}
          className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-start">
        <Steps
          label={t("cad.guia.title")}
          steps={steps.map((step) => ({
            key: step.id,
            label: t(step.short),
            icon: step.icon,
            status: step.done ? "done" : step.id === next.id ? "current" : "upcoming",
          }))}
          className="md:pt-2"
        />

        {/* Próximo passo: o único aberto, com um botão que diz o que vai acontecer. */}
        <div className="space-y-3 rounded-2xl border border-primary/40 bg-background p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gold">
            {t("eq.guide.next")}
          </p>
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <NextIcon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{t(next.title)}</p>
              <p className="text-xs text-muted-foreground">{t(next.hint)}</p>
              {next.id === "link" && (
                <p className="mt-1 break-all text-xs font-semibold">{readableLink(publicUrl)}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={next.onAction}
              className="action-button action-confirm min-h-11 flex-1 justify-center sm:flex-none"
            >
              {next.id === "link" ? (
                <Share2 className="size-4" aria-hidden />
              ) : (
                <ArrowRight className="size-4" aria-hidden />
              )}
              {t(next.action)}
            </button>
            {next.id === "hours" && (
              <button
                type="button"
                onClick={() => remember({ hoursOk: true })}
                className="action-button min-h-11 flex-1 justify-center sm:flex-none"
              >
                <Check className="size-4" aria-hidden />
                {t("cad.guia.hoursOk")}
              </button>
            )}
            {next.id === "link" && canShare && (
              <button
                type="button"
                onClick={() => void copyLink()}
                className="action-button min-h-11 flex-1 justify-center sm:flex-none"
              >
                <Copy className="size-4" aria-hidden />
                {t("cad.guia.linkAction")}
              </button>
            )}
          </div>
        </div>
      </div>

      {others.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {t("eq.guide.alsoMissing")}
          </span>
          {others.map((step) => {
            const Icon = step.icon;
            return (
              <button
                key={step.id}
                type="button"
                onClick={step.onAction}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-bold transition hover:border-primary/40"
              >
                <Icon className="size-4 text-gold" aria-hidden />
                {t(step.short)}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
