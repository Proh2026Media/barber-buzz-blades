import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { APPOINTMENT_STATUS, type AppointmentStatus } from "./status";
import { TONE_BADGE, TONE_CLASS, TONE_ICON, TONE_TEXT, toneIconMotion, type Tone } from "./tones";

type BadgeSize = "sm" | "md" | "lg";

const SIZE: Record<BadgeSize, { box: string; icon: string; round: string }> = {
  sm: { box: "gap-1 px-2 py-0.5 text-[11px]", icon: "size-3", round: "size-5" },
  md: { box: "gap-1.5 px-2.5 py-1 text-xs", icon: "size-3.5", round: "size-6" },
  lg: { box: "gap-1.5 px-3 py-1.5 text-sm", icon: "size-4", round: "size-8" },
};

export type StatusBadgeProps = {
  tone: Tone;
  /** Texto curto do estado (1 a 3 palavras). Sempre presente: o estado nunca depende só da cor. */
  label: string;
  /** Troca o ícone padrão do tom; `null` esconde o ícone. */
  icon?: LucideIcon | null;
  size?: BadgeSize;
  /**
   * `pill` (padrão): pílula com ícone e texto. `dot`: ponto colorido + texto, para legendas e
   * listas densas. `icon`: só o ícone num círculo (linha do tempo); o texto vira nome acessível.
   */
  variant?: "pill" | "dot" | "icon";
  /** Número ao lado do texto (ex.: filtros com contagem). */
  count?: number;
  /** Ponto pulsante de "ao vivo" no lugar do ícone (para quando a pessoa aceita movimento). */
  live?: boolean;
  className?: string;
};

/**
 * Selo de estado com ícone, cor e texto. As cores vêm dos tons do sistema: o mesmo estado tem a
 * mesma cara em todas as telas. Os cantos seguem o modo escolhido (retos, semi, arredondados).
 */
export function StatusBadge({
  tone,
  label,
  icon,
  size = "md",
  variant = "pill",
  count,
  live,
  className,
}: StatusBadgeProps) {
  const Icon = icon === null ? null : (icon ?? TONE_ICON[tone]);
  const motion = Icon ? toneIconMotion(Icon) : "";

  if (variant === "icon") {
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        className={cn(
          TONE_CLASS[tone],
          TONE_BADGE,
          "inline-grid shrink-0 place-items-center rounded-full border",
          SIZE[size].round,
          className,
        )}
      >
        {Icon && <Icon className={cn(SIZE[size].icon, motion)} aria-hidden />}
      </span>
    );
  }

  if (variant === "dot") {
    return (
      <span
        className={cn(
          TONE_CLASS[tone],
          TONE_TEXT,
          "inline-flex items-center gap-1.5 font-semibold",
          size === "sm" ? "text-[11px]" : size === "lg" ? "text-sm" : "text-xs",
          className,
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-2 shrink-0 rounded-full bg-[color:var(--tone-line)]",
            live && "mb-live-dot",
          )}
        />
        {label}
        {count !== undefined && (
          <span className="tabular-nums">
            <span className="sr-only">: </span>
            {count}
          </span>
        )}
      </span>
    );
  }

  return (
    <span
      className={cn(
        TONE_CLASS[tone],
        TONE_BADGE,
        "inline-flex max-w-full items-center rounded-[var(--button-radius)] border font-semibold leading-tight",
        SIZE[size].box,
        className,
      )}
    >
      {live ? (
        <span aria-hidden className="mb-live-dot shrink-0" />
      ) : (
        Icon && <Icon className={cn("shrink-0", SIZE[size].icon, motion)} aria-hidden />
      )}
      <span className="min-w-0">{label}</span>
      {count !== undefined && (
        <span className="rounded-[var(--control-radius)] bg-card/70 px-1.5 tabular-nums">
          <span className="sr-only">: </span>
          {count}
        </span>
      )}
    </span>
  );
}

/** Situação do atendimento com o rótulo do dicionário (`status.*`). */
export function AppointmentStatusBadge({
  status,
  size,
  variant,
  className,
}: {
  status: AppointmentStatus;
  size?: BadgeSize;
  variant?: StatusBadgeProps["variant"];
  className?: string;
}) {
  const { t } = useI18n();
  const meta = APPOINTMENT_STATUS[status] ?? APPOINTMENT_STATUS.pending;
  return (
    <StatusBadge
      tone={meta.tone}
      icon={meta.icon}
      label={t(meta.labelKey)}
      size={size}
      variant={variant}
      className={className}
    />
  );
}

/**
 * Pílula de dado (não é estado): duração, preço, folga, intervalo. Fundo neutro e ícone dourado
 * opcional, como em "A cada 15 min" e "+10 min de folga".
 */
export function Tag({
  icon: Icon,
  children,
  className,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--button-radius)] bg-muted px-2.5 py-1 text-[11px] font-semibold",
        className,
      )}
    >
      {Icon && <Icon className="size-3 shrink-0 text-gold" aria-hidden />}
      {children}
    </span>
  );
}

/**
 * Bolha numérica de pendências (abas, itens do menu, cartões). Some quando é zero.
 * `label` é o texto lido pelo leitor de tela (ex.: "2 resgates esperando").
 */
export function CountBadge({
  count,
  label,
  tone = "warning",
  max = 99,
  className,
}: {
  count: number;
  label?: string;
  tone?: Tone;
  max?: number;
  className?: string;
}) {
  if (!count || count <= 0) return null;
  return (
    <span
      className={cn(
        TONE_CLASS[tone],
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--tone-ink)] px-1.5 text-[11px] font-bold leading-none tabular-nums text-[color:var(--tone-on-ink)]",
        className,
      )}
    >
      <span aria-hidden={label ? true : undefined}>{count > max ? `${max}+` : count}</span>
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
