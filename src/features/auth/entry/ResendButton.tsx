import { Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Reenviar código" com a espera à vista: um anel que esvazia e "Reenviar em 42s" enquanto
 * não pode; depois, o ícone de repetir e o rótulo. O texto da espera não é anunciado a cada
 * segundo (o botão desativado já diz que ainda não dá).
 */
export function ResendButton({
  secondsLeft,
  totalSeconds = 60,
  onClick,
  busy,
  label,
  waitLabel,
  busyLabel,
  className,
}: {
  secondsLeft: number;
  totalSeconds?: number;
  onClick: () => void;
  busy?: boolean;
  /** "Reenviar código". */
  label: string;
  /** "Reenviar em 42s" (já com o número). */
  waitLabel: string;
  /** "Enviando código…". */
  busyLabel?: string;
  className?: string;
}) {
  const waiting = secondsLeft > 0;
  const radius = 8;
  const circumference = 2 * Math.PI * radius;
  const fraction = waiting ? Math.min(1, secondsLeft / Math.max(1, totalSeconds)) : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || waiting}
      className={cn(
        "auth-brand-button inline-flex min-h-11 items-center gap-2 px-2 text-sm font-semibold text-foreground underline-offset-4 transition-colors enabled:hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground",
        className,
      )}
    >
      {busy ? (
        <Loader2 className="size-4 shrink-0 motion-safe:animate-spin" aria-hidden />
      ) : waiting ? (
        <svg viewBox="0 0 20 20" className="size-5 shrink-0 -rotate-90" aria-hidden>
          <circle cx="10" cy="10" r={radius} fill="none" strokeWidth="2.5" stroke="var(--border)" />
          <circle
            cx="10"
            cy="10"
            r={radius}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            stroke="var(--muted-foreground)"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - fraction)}
            className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-1000 motion-safe:ease-linear"
          />
        </svg>
      ) : (
        <RotateCcw className="size-4 shrink-0" aria-hidden />
      )}
      <span className="tabular-nums">
        {busy && busyLabel ? busyLabel : waiting ? waitLabel : label}
      </span>
    </button>
  );
}
