import { ChevronRight, ExternalLink, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { InlineStatus } from "./Notice";
import { IconTile, type IconTileTone } from "./SectionHeader";
import type { ActionState } from "./status";

/**
 * Linha de ajuste ou de atalho: ícone em quadrado, título, uma linha de resumo e, à direita, o
 * controle (interruptor, selo) ou a seta de "abrir". A linha inteira é tocável (44 px ou mais).
 *
 * - Com `onClick`: vira atalho de navegação, com seta (ou ícone de "abre fora" em `external`).
 * - Com `control` + `controlId`: tocar no texto aciona o controle (rótulo ligado ao `id`).
 * - `status`: estado de quem grava na hora (Salvando… → ✓ Salvo → Não salvou · Tentar de novo).
 * - `summary`: resumo vivo em pílulas/selos embaixo do título.
 */
export function SettingRow({
  icon,
  tone,
  title,
  description,
  summary,
  control,
  controlId,
  status,
  statusText,
  onRetry,
  attention,
  onClick,
  external,
  className,
}: {
  icon?: LucideIcon;
  tone?: IconTileTone;
  title: ReactNode;
  description?: ReactNode;
  summary?: ReactNode;
  control?: ReactNode;
  /** id do controle, para tocar no texto e acionar o interruptor. */
  controlId?: string;
  status?: ActionState | null;
  statusText?: string;
  onRetry?: () => void;
  /** Bolha ou ponto de atenção antes da seta (ex.: `<CountBadge …/>`). */
  attention?: ReactNode;
  onClick?: () => void;
  external?: boolean;
  className?: string;
}) {
  const text = (
    <span className="min-w-0 flex-1 text-left">
      <span className="block text-sm font-semibold">{title}</span>
      {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      {summary && <span className="mt-1.5 flex flex-wrap items-center gap-1.5">{summary}</span>}
    </span>
  );
  const iconTile = icon ? <IconTile icon={icon} tone={tone} size="sm" /> : null;
  const statusLine = status ? (
    <InlineStatus state={status} text={statusText} onRetry={onRetry} className="mt-1" />
  ) : null;

  if (onClick) {
    const Arrow = external ? ExternalLink : ChevronRight;
    // O invólucro reto recebe divisórias (divide-y) sem curvar a linha nos cantos do botão.
    return (
      <div className={cn("py-1", className)}>
        <button
          type="button"
          onClick={onClick}
          className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left transition hover:bg-muted/50"
        >
          {iconTile}
          {text}
          {attention}
          <Arrow className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("py-2.5", className)}>
      <div className="flex min-h-11 items-center gap-3">
        {controlId ? (
          <label
            htmlFor={controlId}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
          >
            {iconTile}
            {text}
          </label>
        ) : (
          <>
            {iconTile}
            {text}
          </>
        )}
        {attention}
        {control && <span className="shrink-0">{control}</span>}
      </div>
      {statusLine && <div className={cn(icon && "ps-12")}>{statusLine}</div>}
    </div>
  );
}
