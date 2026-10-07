import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { TONE_CLASS, TONE_ICON, type Tone } from "@/components/visual/tones";
import { cn } from "@/lib/utils";

export type EmptyTone =
  | "calendar"
  | "scissors"
  | "bell"
  | "waiting"
  | "people"
  | "search"
  | "store"
  | "chart"
  | "connection"
  | "gift";

const art = {
  fill: "color-mix(in oklch, var(--gold) 14%, var(--card))",
  softFill: "color-mix(in oklch, var(--gold) 10%, var(--card))",
  stroke: "color-mix(in oklch, var(--gold) 45%, var(--border))",
};

const illustrations: Record<EmptyTone, ReactNode> = {
  people: (
    <svg viewBox="0 0 120 96" fill="none" aria-hidden className="h-full w-full">
      <circle cx="48" cy="36" r="12" fill={art.fill} stroke={art.stroke} strokeWidth="2" />
      <path
        d="M26 80c0-12 10-22 22-22s22 10 22 22"
        fill={art.fill}
        stroke={art.stroke}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="80" cy="40" r="10" stroke="var(--foreground)" strokeWidth="2" opacity="0.5" />
      <path
        d="M64 80c0-10 7-18 16-18s16 8 16 18"
        stroke="var(--foreground)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
      <circle cx="92" cy="20" r="4" fill="var(--gold)" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 120 96" fill="none" aria-hidden className="h-full w-full">
      <circle cx="52" cy="42" r="22" fill={art.softFill} stroke={art.stroke} strokeWidth="2" />
      <path
        d="M68 58l18 18"
        stroke="var(--foreground)"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path d="M42 42h20" stroke="var(--gold)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
  store: (
    <svg viewBox="0 0 120 96" fill="none" aria-hidden className="h-full w-full">
      <rect
        x="26"
        y="42"
        width="68"
        height="42"
        rx="6"
        fill={art.fill}
        stroke={art.stroke}
        strokeWidth="2"
      />
      <path
        d="M22 42l8-24h60l8 24"
        stroke="var(--foreground)"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity="0.6"
      />
      <path
        d="M22 42c0 6 5 9 10 9s10-3 10-9c0 6 5 9 10 9s9-3 9-9c0 6 5 9 10 9s9-3 9-9c0 6 5 9 10 9s10-3 10-9"
        stroke="var(--gold)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <rect x="52" y="62" width="16" height="22" rx="3" fill="var(--gold)" opacity="0.85" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 120 96" fill="none" aria-hidden className="h-full w-full">
      <path
        d="M24 82h76"
        stroke="var(--foreground)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
      <rect x="32" y="56" width="12" height="24" rx="3" fill="var(--foreground)" opacity="0.35" />
      <rect x="54" y="40" width="12" height="40" rx="3" fill="var(--gold)" />
      <rect x="76" y="24" width="12" height="56" rx="3" fill="var(--foreground)" opacity="0.6" />
    </svg>
  ),
  connection: (
    <svg viewBox="0 0 120 96" fill="none" aria-hidden className="h-full w-full">
      <path
        d="M20 48h22"
        stroke="var(--foreground)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.6"
      />
      <rect
        x="40"
        y="34"
        width="18"
        height="28"
        rx="5"
        fill={art.fill}
        stroke={art.stroke}
        strokeWidth="2"
      />
      <path d="M58 41h8M58 55h8" stroke="var(--gold)" strokeWidth="3" strokeLinecap="round" />
      <rect
        x="74"
        y="34"
        width="18"
        height="28"
        rx="5"
        stroke="var(--foreground)"
        strokeWidth="2"
        opacity="0.5"
      />
      <path
        d="M92 48h10"
        stroke="var(--foreground)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  ),
  gift: (
    <svg viewBox="0 0 120 96" fill="none" aria-hidden className="h-full w-full">
      <rect
        x="28"
        y="42"
        width="64"
        height="42"
        rx="6"
        fill={art.fill}
        stroke={art.stroke}
        strokeWidth="2"
      />
      <rect
        x="24"
        y="30"
        width="72"
        height="14"
        rx="4"
        fill="var(--card)"
        stroke="var(--foreground)"
        strokeWidth="2"
        opacity="0.6"
      />
      <path d="M60 30v54" stroke="var(--gold)" strokeWidth="4" />
      <path
        d="M60 30c-6-12-20-12-18-2 1 4 10 4 18 2Zm0 0c6-12 20-12 18-2-1 4-10 4-18 2Z"
        stroke="var(--gold)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 120 96" fill="none" aria-hidden className="h-full w-full">
      <rect
        x="18"
        y="22"
        width="84"
        height="62"
        rx="16"
        fill="color-mix(in oklch, var(--gold) 14%, var(--card))"
        stroke="color-mix(in oklch, var(--gold) 45%, var(--border))"
        strokeWidth="2"
      />
      <path
        d="M18 42h84"
        stroke="color-mix(in oklch, var(--gold) 40%, var(--border))"
        strokeWidth="2"
      />
      <rect x="38" y="14" width="8" height="18" rx="4" fill="var(--gold)" />
      <rect x="74" y="14" width="8" height="18" rx="4" fill="var(--gold)" />
      <circle cx="44" cy="58" r="4" fill="var(--foreground)" opacity="0.7" />
      <circle cx="60" cy="58" r="4" fill="var(--gold)" />
      <circle cx="76" cy="58" r="4" fill="var(--foreground)" opacity="0.35" />
      <circle cx="44" cy="72" r="4" fill="var(--foreground)" opacity="0.35" />
      <circle cx="60" cy="72" r="4" fill="var(--foreground)" opacity="0.55" />
    </svg>
  ),
  scissors: (
    <svg viewBox="0 0 120 96" fill="none" aria-hidden className="h-full w-full">
      <circle
        cx="38"
        cy="34"
        r="14"
        stroke="color-mix(in oklch, var(--gold) 55%, var(--border))"
        strokeWidth="3"
      />
      <circle
        cx="38"
        cy="66"
        r="14"
        stroke="color-mix(in oklch, var(--gold) 55%, var(--border))"
        strokeWidth="3"
      />
      <path
        d="M48 40 L96 22 M48 56 L96 74"
        stroke="var(--foreground)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path d="M70 40c8 4 8 12 0 16" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 120 96" fill="none" aria-hidden className="h-full w-full">
      <path
        d="M60 18c-16 0-28 12-28 28v10c0 8-6 14-10 18h76c-4-4-10-10-10-18V46c0-16-12-28-28-28Z"
        fill="color-mix(in oklch, var(--gold) 12%, var(--card))"
        stroke="color-mix(in oklch, var(--gold) 45%, var(--border))"
        strokeWidth="2"
      />
      <path
        d="M48 78c2 6 8 10 12 10s10-4 12-10"
        stroke="var(--gold)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="60" cy="16" r="4" fill="var(--gold)" />
    </svg>
  ),
  waiting: (
    <svg viewBox="0 0 120 96" fill="none" aria-hidden className="h-full w-full">
      <circle
        cx="60"
        cy="48"
        r="28"
        fill="color-mix(in oklch, var(--gold) 10%, var(--card))"
        stroke="color-mix(in oklch, var(--gold) 45%, var(--border))"
        strokeWidth="2"
      />
      <path
        d="M60 30v20l12 8"
        stroke="var(--foreground)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      />
      <circle cx="60" cy="48" r="3" fill="var(--gold)" />
    </svg>
  ),
};

/**
 * Estado vazio, de resultado ou de erro: ilustração (ou ícone do estado), título curto, uma linha
 * do que vai aparecer ali e a próxima ação. Sempre dentro de cartão; `plain` tira a moldura
 * quando ele já está dentro de um cartão.
 *
 * - `tone`: ilustração (agenda, tesoura, sino, espera, pessoas, busca, loja, gráfico, conexão,
 *   presente).
 * - `status`: no lugar da ilustração, o ícone do estado num círculo colorido (sucesso, erro,
 *   aguardando…) — para "Tudo em dia", "Conta criada", "Não deu para carregar".
 */
export function EmptyState({
  tone = "calendar",
  status,
  icon,
  title,
  description,
  action,
  secondaryAction,
  children,
  variant = "card",
  className,
}: {
  tone?: EmptyTone;
  status?: Tone;
  /** Troca o ícone padrão do `status`. */
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Botão principal com verbo ("Criar serviço", "Limpar busca", "Tentar de novo"). */
  action?: ReactNode;
  secondaryAction?: ReactNode;
  /** Conteúdo extra (progresso, pílulas de início rápido). */
  children?: ReactNode;
  variant?: "card" | "plain";
  className?: string;
}) {
  const StatusIcon = status ? (icon ?? TONE_ICON[status]) : null;
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 text-center",
        variant === "card"
          ? "mb-empty rounded-[var(--panel-radius)] border border-border/70 bg-card px-5 py-8"
          : "px-2 py-6",
        className,
      )}
    >
      {status && StatusIcon ? (
        <span
          aria-hidden
          className={cn(
            TONE_CLASS[status],
            "grid size-16 place-items-center rounded-full bg-[color:var(--tone-bg)] text-[color:var(--tone-ink)]",
          )}
        >
          <StatusIcon
            className={cn("size-8", status === "progress" && "motion-safe:animate-spin")}
          />
        </span>
      ) : (
        <div className="mb-empty-art h-20 w-24">{illustrations[tone]}</div>
      )}
      <div className="space-y-1.5">
        <p className="text-base font-semibold tracking-tight text-foreground">{title}</p>
        {description ? (
          <div className="mx-auto max-w-[18rem] text-sm leading-relaxed text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      {children}
      {action || secondaryAction ? (
        <div className="mt-1 flex w-full max-w-xs flex-col gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
