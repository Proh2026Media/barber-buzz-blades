import { RotateCcw, X, type LucideIcon } from "lucide-react";
import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { announce } from "./announce";
import { ACTION_STATE, type ActionState } from "./status";
import { TONE_CLASS, TONE_ICON, TONE_SOFT, TONE_TEXT, toneIconMotion, type Tone } from "./tones";

export type NoticeAction = { label: string; onClick: () => void; icon?: LucideIcon };

export type NoticeProps = {
  tone: Tone;
  /** Frase principal: o que aconteceu ou o que fazer. */
  title: ReactNode;
  /** Detalhe opcional (uma linha). */
  children?: ReactNode;
  /** Troca o ícone padrão do tom; `null` esconde. */
  icon?: LucideIcon | null;
  /** Uma ação que resolve (ex.: "Tentar de novo", "Ver pedido"). */
  action?: NoticeAction;
  /** Mostra o X para fechar. */
  onDismiss?: () => void;
  /**
   * Papel para leitor de tela. Padrão: `alert` no erro e `status` nos demais. Use `none` em avisos
   * fixos da tela (que não surgem depois de uma ação).
   */
  role?: "status" | "alert" | "none";
  className?: string;
  id?: string;
};

/**
 * Aviso curto com ícone e cor do tom: resultado de uma ação, alerta junto de um campo ou de uma
 * linha, dica importante. Fica perto do que o gerou — nunca no topo da página.
 */
export const Notice = forwardRef<HTMLDivElement, NoticeProps>(function Notice(
  { tone, title, children, icon, action, onDismiss, role, className, id },
  ref,
) {
  const { t } = useI18n();
  const Icon = icon === null ? null : (icon ?? TONE_ICON[tone]);
  const ActionIcon = action?.icon;
  const resolvedRole = role ?? (tone === "danger" ? "alert" : "status");
  return (
    <div
      ref={ref}
      id={id}
      role={resolvedRole === "none" ? undefined : resolvedRole}
      className={cn(
        TONE_CLASS[tone],
        TONE_SOFT,
        "flex flex-wrap items-start gap-x-2 gap-y-1 rounded-xl border px-3 py-2 text-sm",
        className,
      )}
    >
      {Icon && <Icon className={cn("mt-0.5 size-4 shrink-0", toneIconMotion(Icon))} aria-hidden />}
      <div className="min-w-0 flex-1 basis-40">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-0.5 text-[13px] leading-snug">{children}</div>}
      </div>
      {(action || onDismiss) && (
        <div className="-my-1 ms-auto flex shrink-0 items-center gap-1">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className={cn(
                TONE_TEXT,
                "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[color:var(--tone-border)] bg-card/70 px-3 text-sm font-semibold transition hover:bg-card",
              )}
            >
              {ActionIcon && <ActionIcon className="size-4" aria-hidden />}
              {action.label}
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label={t("visual.dismiss")}
              className="-me-2 grid size-11 place-items-center rounded-xl opacity-80 transition hover:opacity-100"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
      )}
    </div>
  );
});

/**
 * Resultado de uma ação que grava algo, logo abaixo do botão que a disparou:
 * salvando (gira), salvo (verde), pedido aguardando aprovação (âmbar) ou erro (vermelho, com
 * "Tentar de novo"). Anuncia a mudança ao leitor de tela e, se estiver fora da vista, rola até
 * ela. `saved` pode sumir sozinho com `autoHideMs`.
 */
export function ActionResult({
  state,
  text,
  detail,
  onRetry,
  onDismiss,
  autoHideMs,
  reveal = true,
  className,
}: {
  state: ActionState | null | undefined;
  /** Frase própria da tela; sem ela, usa a frase padrão do estado. */
  text?: string;
  detail?: ReactNode;
  onRetry?: () => void;
  onDismiss?: () => void;
  autoHideMs?: number;
  /** Rola até o resultado quando ele aparece fora da vista. */
  reveal?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);
  const message = state ? (text ?? t(ACTION_STATE[state].textKey)) : "";

  useEffect(() => {
    setHidden(false);
    if (!state || !message) return;
    announce(message, state === "error" ? "assertive" : "polite");
    if (autoHideMs && state === "saved") {
      const id = window.setTimeout(() => setHidden(true), autoHideMs);
      return () => window.clearTimeout(id);
    }
  }, [state, message, autoHideMs]);

  const visible = Boolean(state) && !hidden;
  useEffect(() => {
    if (!visible || !reveal) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // A barra de navegação flutuante cobre o pé da tela: o que fica atrás dela não está à vista.
    const nav = document.querySelector(".app-mobile-nav");
    const bottomLimit = nav ? nav.getBoundingClientRect().top : window.innerHeight;
    if (rect.top >= 0 && rect.bottom <= bottomLimit) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [visible, reveal, message]);

  if (!state || !visible) return null;
  const meta = ACTION_STATE[state];
  return (
    <Notice
      ref={ref}
      tone={meta.tone}
      icon={meta.icon}
      title={message}
      role="none"
      action={
        state === "error" && onRetry
          ? { label: t("visual.retry"), onClick: onRetry, icon: RotateCcw }
          : undefined
      }
      onDismiss={onDismiss}
      className={className}
    >
      {detail}
    </Notice>
  );
}

/**
 * Estado curto em linha, ao lado de um controle que grava na hora (interruptor, escolha):
 * "Salvando…" → "✓ Salvo" → "Não salvou · Tentar de novo".
 */
export function InlineStatus({
  state,
  text,
  onRetry,
  className,
}: {
  state: ActionState | null | undefined;
  text?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const message = state ? (text ?? t(ACTION_STATE[state].textKey)) : "";
  useEffect(() => {
    if (state && message) announce(message, state === "error" ? "assertive" : "polite");
  }, [state, message]);
  if (!state) return null;
  const meta = ACTION_STATE[state];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        TONE_CLASS[meta.tone],
        TONE_TEXT,
        "inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-semibold",
        className,
      )}
    >
      <Icon className={cn("size-3.5 shrink-0", toneIconMotion(Icon))} aria-hidden />
      {message}
      {state === "error" && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 items-center gap-1 px-1 underline underline-offset-2"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          {t("visual.retry")}
        </button>
      )}
    </span>
  );
}
