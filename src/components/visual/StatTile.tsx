import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { IconTile } from "./SectionHeader";
import { StatusBadge } from "./StatusBadge";
import type { Tone } from "./tones";

export type StatDelta = {
  /** Texto curto da variação ("+12%", "2 a mais"). */
  label: string;
  direction?: "up" | "down" | "flat";
  /** Tom da variação (subir nem sempre é bom: cancelamentos subindo é `danger`). */
  tone?: Tone;
};

/**
 * Cartão de número: ícone, valor grande, rótulo curto e, se quiser, dica, tom, variação e
 * período. Sem dado mostra "—" (nunca 0 inventado) com o motivo para leitor de tela.
 * Carregando, mostra um esqueleto do mesmo tamanho. Com `onClick` vira botão (com `pressed`,
 * funciona como filtro ligado/desligado).
 */
export function StatTile({
  icon,
  label,
  value,
  hint,
  tone,
  delta,
  emptyLabel,
  loading,
  onClick,
  pressed,
  className,
}: {
  icon: LucideIcon;
  label: string;
  /** `null`/`undefined` = sem dado ("—"). Zero real deve vir como 0. */
  value?: ReactNode;
  /** Uma linha de contexto ("hoje", "desde o início", "3 a confirmar"). */
  hint?: string;
  /** Sem tom, o ícone fica dourado; com tom, vai num quadrado da cor do estado. */
  tone?: Tone;
  delta?: StatDelta;
  /** Motivo de não haver dado (lido pelo leitor de tela e mostrado como dica). */
  emptyLabel?: string;
  loading?: boolean;
  onClick?: () => void;
  /** Filtro: `true` ligado, `false` desligado. Sem `pressed`, o botão mostra uma seta. */
  pressed?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const Icon = icon;
  const empty = value === null || value === undefined || value === "";
  const DeltaIcon =
    delta?.direction === "up"
      ? ArrowUpRight
      : delta?.direction === "down"
        ? ArrowDownRight
        : delta?.direction === "flat"
          ? ArrowRight
          : null;

  const content = (
    <>
      <span className="mb-2 flex items-center gap-2">
        {tone ? (
          <IconTile icon={Icon} tone={tone} size="sm" />
        ) : (
          <Icon className="size-4 shrink-0 text-gold" aria-hidden />
        )}
        {delta && (
          <StatusBadge
            tone={delta.tone ?? "neutral"}
            icon={DeltaIcon}
            label={delta.label}
            size="sm"
            className="ms-auto"
          />
        )}
        {onClick && pressed === undefined && (
          <ChevronRight className="ms-auto size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </span>
      {loading ? (
        <span aria-hidden className="block space-y-2 py-1">
          <span className="block h-6 w-16 rounded-md bg-muted motion-safe:animate-pulse" />
          <span className="block h-3 w-24 rounded-md bg-muted motion-safe:animate-pulse" />
        </span>
      ) : (
        <>
          <span className="block break-words text-xl font-bold tracking-tight tabular-nums hyphens-auto sm:text-2xl">
            {empty ? (
              <>
                <span aria-hidden>—</span>
                <span className="sr-only">{emptyLabel ?? t("visual.noData")}</span>
              </>
            ) : (
              value
            )}
          </span>
          <span className="block text-xs font-semibold text-muted-foreground">{label}</span>
        </>
      )}
      {loading && <span className="sr-only">{`${label}: ${t("visual.loading")}`}</span>}
      {!loading && (hint || (empty && emptyLabel)) && (
        <span className="mt-1 block text-[11px] text-muted-foreground">{hint ?? emptyLabel}</span>
      )}
    </>
  );

  // `.app-action-card` (fora das camadas do Tailwind) manda na borda, no fundo e na sombra:
  // o filtro ligado aparece com contorno de 2 px na cor principal.
  const surface = "app-action-card block min-w-0 p-4 text-left";
  if (!onClick) return <div className={cn(surface, className)}>{content}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cn(
        surface,
        "w-full rounded-2xl",
        pressed && "outline-2 -outline-offset-2 outline-primary",
        className,
      )}
    >
      {content}
    </button>
  );
}
