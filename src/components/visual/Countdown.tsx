import { Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { announce } from "./announce";
import { TONE_BADGE, TONE_CLASS, type Tone } from "./tones";

/**
 * Prazo correndo ("Restam 9 min"): anel que esvazia ou pílula. Nunca mostra só "mm:ss" (que se
 * confunde com horário do dia). Âmbar enquanto corre, vermelho no fim, cinza quando acaba.
 * Anuncia ao leitor de tela uma vez por minuto, sem interromper. Sem animação de transição
 * quando a pessoa prefere menos movimento.
 */
export function Countdown({
  endsAt,
  totalSeconds,
  variant = "pill",
  criticalBelow = 60,
  label,
  onExpire,
  className,
}: {
  /** Quando o prazo acaba. */
  endsAt: Date | string | number;
  /** Duração total, para o anel mostrar quanto já passou. */
  totalSeconds?: number;
  variant?: "pill" | "ring";
  /** Abaixo de quantos segundos fica vermelho (padrão 60). */
  criticalBelow?: number;
  /** Contexto curto depois do tempo ("para confirmar a vaga"). */
  label?: string;
  onExpire?: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const end = new Date(endsAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  const expireRef = useRef(onExpire);
  useEffect(() => {
    expireRef.current = onExpire;
  });

  const left = Math.max(0, Math.ceil((end - now) / 1000));
  const expired = left <= 0;

  useEffect(() => {
    if (expired) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [expired]);

  useEffect(() => {
    if (expired) expireRef.current?.();
  }, [expired]);

  // Minutos inteiros que ainda faltam (9 min e 5 s → "Restam 9 min"); abaixo de 1 min, segundos.
  const minutes = Math.floor(left / 60);
  const text = expired
    ? t("visual.countdown.expired")
    : left < 60
      ? left === 1
        ? t("visual.countdown.secondsOne")
        : t("visual.countdown.secondsMany", { seconds: left })
      : minutes === 1
        ? t("visual.countdown.minutesOne")
        : t("visual.countdown.minutesMany", { minutes });

  // Um anúncio por minuto (e no último minuto e no fim), nunca a cada segundo.
  const spokenStep = expired ? "end" : left < 60 ? "last" : String(minutes);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    announce(label ? `${text} ${label}` : text);
    // `text` muda a cada segundo no último minuto; o passo falado, não.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spokenStep]);

  const tone: Tone = expired ? "neutral" : left <= criticalBelow ? "danger" : "pending";

  if (variant === "ring") {
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const fraction = totalSeconds ? Math.min(1, left / totalSeconds) : expired ? 0 : 1;
    return (
      <span
        role="timer"
        className={cn(TONE_CLASS[tone], "inline-flex items-center gap-2.5", className)}
      >
        <span className="relative grid size-11 shrink-0 place-items-center">
          <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle
              cx="22"
              cy="22"
              r={radius}
              fill="none"
              strokeWidth="4"
              style={{ stroke: "var(--muted)" }}
            />
            <circle
              cx="22"
              cy="22"
              r={radius}
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              style={{ stroke: "var(--tone-line)" }}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - fraction)}
              className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-1000 motion-safe:ease-linear"
            />
          </svg>
          <Timer className="relative size-4 text-[color:var(--tone-ink)]" aria-hidden />
        </span>
        <span className="min-w-0 text-sm" suppressHydrationWarning>
          <span className="block font-bold text-[color:var(--tone-ink)] tabular-nums">{text}</span>
          {label && <span className="block text-xs text-muted-foreground">{label}</span>}
        </span>
      </span>
    );
  }

  return (
    <span
      role="timer"
      suppressHydrationWarning
      className={cn(
        TONE_CLASS[tone],
        TONE_BADGE,
        "inline-flex items-center gap-1.5 rounded-[var(--button-radius)] border px-2.5 py-1 text-xs font-bold tabular-nums",
        className,
      )}
    >
      <Timer className="size-3.5 shrink-0" aria-hidden />
      {text}
      {label && <span className="font-semibold">{label}</span>}
    </span>
  );
}
