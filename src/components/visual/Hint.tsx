import { ChevronDown, Info, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { TONE_CLASS, TONE_ICON, TONE_TEXT, type Tone } from "./tones";

/** `gold`: dica (padrão). `muted`: neutro discreto. Tons de estado: consequências (✓, ✕, ⚠). */
export type IconListTone = "gold" | "muted" | Tone;

export type IconListItem = {
  /** Sem ícone, usa o ícone padrão do tom (ou um ponto, para `gold`/`muted`). */
  icon?: LucideIcon;
  tone?: IconListTone;
  text: ReactNode;
  /** Complemento depois do texto principal, mais discreto. */
  detail?: ReactNode;
  key?: string;
};

function iconClass(tone: IconListTone) {
  if (tone === "gold") return "text-gold";
  if (tone === "muted") return "text-muted-foreground";
  return cn(TONE_CLASS[tone], TONE_TEXT);
}

function ItemIcon({ icon, tone }: { icon?: LucideIcon; tone: IconListTone }) {
  const Icon = icon ?? (tone === "gold" || tone === "muted" ? Info : TONE_ICON[tone]);
  return <Icon className={cn("size-4 shrink-0", iconClass(tone))} aria-hidden />;
}

/**
 * Lista de frases curtas, cada uma com ícone: dicas ("Depois do almoço os horários
 * recomeçam"), consequências de uma ação ("✕ O horário fica livre"), o que pode e o que não
 * pode, benefícios. Substitui parágrafos explicativos.
 */
export function IconList({
  items,
  size = "sm",
  label,
  className,
}: {
  items: IconListItem[];
  /** `sm`: 12 px, para dicas. `md`: 14 px, para consequências dentro de janelas. */
  size?: "sm" | "md";
  /** Nome da lista para leitor de tela (ex.: "O que acontece"). */
  label?: string;
  className?: string;
}) {
  return (
    <ul
      aria-label={label}
      className={cn(
        "space-y-2",
        size === "sm" ? "text-xs text-muted-foreground" : "text-sm text-foreground",
        className,
      )}
    >
      {items.map((item, index) => (
        <li key={item.key ?? index} className="flex items-center gap-2">
          <ItemIcon icon={item.icon} tone={item.tone ?? "gold"} />
          {item.detail ? (
            <span className="min-w-0">
              <span className="font-semibold">{item.text}</span>{" "}
              <span className="text-muted-foreground">{item.detail}</span>
            </span>
          ) : (
            <span className="min-w-0">{item.text}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Dica de uma linha com ícone dourado (ou do tom pedido). */
export function Hint({
  icon,
  tone = "gold",
  children,
  className,
}: {
  icon?: LucideIcon;
  tone?: IconListTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <ItemIcon icon={icon} tone={tone} />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/**
 * "Como funciona": detalhe secundário recolhido, aberto por toque ou teclado (nunca só ao passar
 * o mouse). Tira regras e notas técnicas da superfície principal.
 */
export function MoreDetails({
  summary,
  icon: Icon = Info,
  defaultOpen,
  children,
  className,
}: {
  /** Texto do botão; padrão "Como funciona". */
  summary?: string;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <details className={cn("group", className)} open={defaultOpen}>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl text-sm font-semibold text-muted-foreground transition hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold [&::-webkit-details-marker]:hidden">
        <Icon className="size-4 shrink-0 text-gold" aria-hidden />
        {summary ?? t("visual.moreDetails")}
        <ChevronDown
          className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden
        />
      </summary>
      <div className="mt-1 space-y-2 pb-1 text-sm text-muted-foreground">{children}</div>
    </details>
  );
}
