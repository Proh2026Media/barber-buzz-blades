import { BellDot, ChevronRight, type LucideIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Notice } from "./Notice";
import { IconTile } from "./SectionHeader";
import { CountBadge } from "./StatusBadge";
import { TONE_CLASS, TONE_ICON, TONE_URGENCY, type Tone } from "./tones";

export type AttentionItem = {
  id: string;
  tone: Tone;
  icon?: LucideIcon;
  /** Uma frase com o que precisa ser feito ("2 horários para confirmar"). */
  title: string;
  description?: ReactNode;
  /** Prazo ou contexto à direita do texto (ex.: `<Countdown …/>`). */
  aside?: ReactNode;
  /** A única ação do item, com verbo ("Confirmar", "Revisar agora"). Leva direto ao ponto. */
  action: { label: string; onClick: () => void; icon?: LucideIcon };
};

/**
 * "Precisa da sua atenção": lista curta, ordenada por urgência, com ícone e cor do estado, uma
 * frase e UM botão por item. Só aparece quando há algo a fazer (ou, com `allClear`, mostra
 * "Tudo em ordem" em verde). Acima de `max` itens, recolhe o resto em "Ver todos".
 */
export function AttentionList({
  items,
  title,
  allClear,
  max = 3,
  headingLevel = "h2",
  className,
}: {
  items: AttentionItem[];
  /** Padrão: "Precisa da sua atenção". */
  title?: string;
  /** `true` (frase padrão) ou um texto: mostra a faixa verde quando não há pendências. */
  allClear?: boolean | string;
  max?: number;
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  const { t } = useI18n();
  const headingId = useId();
  const [expanded, setExpanded] = useState(false);

  if (!items.length) {
    if (!allClear) return null;
    return (
      <Notice
        tone="success"
        role="none"
        title={typeof allClear === "string" ? allClear : t("visual.attention.allClear")}
        className={cn("rounded-2xl py-3", className)}
      />
    );
  }

  const sorted = [...items].sort((a, b) => TONE_URGENCY[a.tone] - TONE_URGENCY[b.tone]);
  const visible = expanded ? sorted : sorted.slice(0, max);
  const Heading = headingLevel;

  return (
    <section aria-labelledby={headingId} className={cn("app-action-card space-y-3 p-4", className)}>
      <Heading id={headingId} className="flex items-center gap-2 text-sm font-bold">
        <BellDot className="size-4 shrink-0 text-gold" aria-hidden />
        {title ?? t("visual.attention.title")}
        <CountBadge count={items.length} tone={sorted[0]?.tone ?? "warning"} />
      </Heading>
      <ul className="space-y-2">
        {visible.map((item) => {
          const ActionIcon = item.action.icon;
          return (
            <li
              key={item.id}
              className={cn(
                TONE_CLASS[item.tone],
                "flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--tone-border)] bg-[color:var(--tone-soft)] p-3",
              )}
            >
              <IconTile icon={item.icon ?? TONE_ICON[item.tone]} tone={item.tone} size="sm" />
              <div className="min-w-0 flex-1 basis-40">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                {item.description && (
                  <div className="text-xs text-muted-foreground">{item.description}</div>
                )}
              </div>
              {item.aside}
              <button
                type="button"
                onClick={item.action.onClick}
                className="ms-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-semibold transition hover:border-primary/40"
              >
                {ActionIcon && <ActionIcon className="size-4" aria-hidden />}
                {item.action.label}
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      {sorted.length > max && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex min-h-11 items-center px-1 text-sm font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {expanded
            ? t("visual.attention.showLess")
            : t("visual.attention.showAll", { count: sorted.length })}
        </button>
      )}
    </section>
  );
}
