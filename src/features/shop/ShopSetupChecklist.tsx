import { useEffect, useState } from "react";
import { ArrowRight, Check, CheckCircle2, Copy, ExternalLink, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { IconTile, Steps, readableLink } from "@/components/visual";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";
import {
  type SetupTarget,
  type StoredState,
  updateGuide,
  useGuideState,
  type Step,
  STEP_META,
  stepsDone,
} from "./setup-model";

/** Anel de progresso "2/5" (sem percentual inventado). */
export function ProgressRing({
  done,
  total,
  label,
  size = "md",
}: {
  done: number;
  total: number;
  label: string;
  /** `sm` = 44 px, para listas (menu de Ajustes). */
  size?: "sm" | "md";
}) {
  const radius = 20;
  const length = 2 * Math.PI * radius;
  return (
    <span
      role="img"
      aria-label={label}
      className={`relative grid shrink-0 place-items-center ${size === "sm" ? "size-11" : "size-14"}`}
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
      <span
        className={`font-extrabold tabular-nums ${size === "sm" ? "text-xs" : "text-sm"}`}
        aria-hidden
      >
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
  staffCount,
  onOpen,
}: {
  shopId: string;
  publicUrl: string;
  services: Tables<"services">[];
  businessHours: Tables<"business_hours">[];
  settings: Tables<"barbershop_settings">;
  staffCount: number;
  onOpen: (target: SetupTarget) => void;
}) {
  const { t } = useI18n();
  // Lê depois de montar para não divergir da renderização no servidor.
  const guide = useGuideState(shopId);
  const loaded = guide !== null;
  const stored = guide ?? {};
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  function remember(patch: StoredState) {
    updateGuide(shopId, patch);
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

  const done = stepsDone({ services, businessHours, settings, staffCount }, stored);
  const steps: Step[] = STEP_META.map((meta) => ({
    ...meta,
    done: done[meta.id],
    onAction: () => (meta.target ? onOpen(meta.target) : void shareLink()),
  }));

  const doneCount = steps.filter((step) => step.done).length;
  const complete = doneCount === steps.length;

  // A comemoração aparece numa visita só: fica gravada para a próxima (sem sumir agora).
  useEffect(() => {
    if (!loaded || !complete || stored.celebrated || stored.hidden) return;
    updateGuide(shopId, { celebrated: true }, false);
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
            {t("shopLink.openPublic")}
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
            {next.id === "team" && (
              <button
                type="button"
                onClick={() => remember({ teamOk: true })}
                className="action-button min-h-11 flex-1 justify-center sm:flex-none"
              >
                <Check className="size-4" aria-hidden />
                {t("cad.guia.teamSolo")}
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
