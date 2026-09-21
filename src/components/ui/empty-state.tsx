import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyTone = "calendar" | "scissors" | "bell" | "waiting";

const illustrations: Record<EmptyTone, ReactNode> = {
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

export function EmptyState({
  tone = "calendar",
  title,
  description,
  action,
  className,
}: {
  tone?: EmptyTone;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-empty flex flex-col items-center gap-3 rounded-[1.35rem] border border-border/70 bg-card px-5 py-8 text-center",
        className,
      )}
    >
      <div className="mb-empty-art h-20 w-24">{illustrations[tone]}</div>
      <div className="space-y-1.5">
        <p className="text-base font-semibold tracking-tight text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-[18rem] text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1 w-full max-w-xs">{action}</div> : null}
    </div>
  );
}
