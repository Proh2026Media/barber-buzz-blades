import { Pencil } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { InlineStatus, type ActionState } from "@/components/visual";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { CatalogViewMode } from "../CatalogViewToggle";
import type { SaveOutcome } from "./types";

/**
 * Cartão de item do catálogo (serviço ou profissional). O conteúdo é o foco: tocar nele abre a
 * edição; o estado (selo) e o interruptor com rótulo ficam juntos no pé; ações raras no "⋯".
 * Em "lista" vira uma linha compacta com os mesmos elementos.
 */
export function CatalogCard({
  view,
  paused,
  highlight,
  media,
  title,
  subtitle,
  facts,
  extra,
  status,
  toggle,
  menu,
  onOpen,
  openLabel,
  id,
}: {
  view: CatalogViewMode;
  /** Esmaece mídia e dados (não as ações) quando o item está pausado. */
  paused?: boolean;
  /** Contorno de destaque logo depois de criar/salvar. */
  highlight?: boolean;
  media: ReactNode;
  title: string;
  subtitle?: ReactNode;
  facts?: ReactNode;
  /** Linha extra de contexto (o dia do profissional, quem faz o serviço…). */
  extra?: ReactNode;
  status: ReactNode;
  toggle?: ReactNode;
  menu?: ReactNode;
  onOpen?: () => void;
  openLabel?: string;
  id?: string;
}) {
  // O botão diz a ação ("Editar Corte"); duração, preço e demais dados entram como descrição,
  // senão o aria-label esconderia do leitor de tela o que está dentro dele.
  const baseId = useId();
  const subtitleId = `${baseId}-sub`;
  const factsId = `${baseId}-facts`;
  const statusId = `${baseId}-status`;
  const describedBy =
    [subtitle ? subtitleId : null, facts ? factsId : null, view === "list" ? statusId : null]
      .filter(Boolean)
      .join(" ") || undefined;
  const body = (
    <>
      <span className={cn("shrink-0 transition", paused && "opacity-55 grayscale")}>{media}</span>
      <span className="min-w-0 flex-1 space-y-1.5">
        <span className="brand-content-title line-clamp-2 block break-words text-sm font-bold hyphens-auto">
          {title}
        </span>
        {subtitle ? (
          <span id={subtitleId} className="line-clamp-1 block text-xs text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
        {facts ? (
          <span
            id={factsId}
            className={cn("flex flex-wrap items-center gap-1.5", paused && "opacity-60")}
          >
            {facts}
          </span>
        ) : null}
        {view === "list" ? (
          <span id={statusId} className="block">
            {status}
          </span>
        ) : null}
      </span>
      {onOpen && view === "grid" ? (
        <Pencil className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : null}
    </>
  );
  const main = onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      aria-label={openLabel}
      aria-describedby={openLabel ? describedBy : undefined}
      className="flex min-h-11 min-w-0 flex-1 items-start gap-3 rounded-xl text-left transition hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      {body}
    </button>
  ) : (
    <div className="flex min-w-0 flex-1 items-start gap-3">{body}</div>
  );

  if (view === "list") {
    return (
      <article
        id={id}
        className={cn(
          "flex scroll-mt-28 items-center gap-2 rounded-2xl border bg-card p-2 pl-3 transition-shadow",
          highlight ? "border-primary ring-2 ring-primary/30" : "border-border",
        )}
      >
        {main}
        {toggle}
        {menu}
      </article>
    );
  }

  return (
    <article
      id={id}
      className={cn(
        "flex scroll-mt-28 flex-col gap-3 rounded-2xl border bg-card p-3 transition-shadow",
        highlight ? "border-primary ring-2 ring-primary/30" : "border-border",
      )}
    >
      <div className="flex items-start gap-1">
        {main}
        {menu}
      </div>
      {extra}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-2">
        {status}
        {toggle}
      </div>
    </article>
  );
}

/**
 * Interruptor com rótulo visível colado a ele ("Aparece para clientes"). Muda na hora, mostra
 * "Salvando…" e volta ao estado anterior se falhar (com "Tentar de novo").
 */
export function ItemToggle({
  checked,
  label,
  ariaLabel,
  showLabel = true,
  disabled,
  onChange,
}: {
  checked: boolean;
  label: string;
  ariaLabel: string;
  showLabel?: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => Promise<SaveOutcome>;
}) {
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [state, setState] = useState<ActionState | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const shown = optimistic ?? checked;

  async function change(next: boolean) {
    setOptimistic(next);
    setState("saving");
    setErrorText(null);
    try {
      await onChange(next);
      setState(null);
    } catch (cause) {
      setErrorText(cause instanceof Error && cause.message ? cause.message : null);
      setState("error");
    } finally {
      setOptimistic(null);
    }
  }

  return (
    <span className="ml-auto inline-flex min-h-11 flex-wrap items-center justify-end gap-x-2 gap-y-1">
      {state && (
        <InlineStatus
          state={state}
          text={state === "error" ? (errorText ?? undefined) : undefined}
          onRetry={state === "error" ? () => void change(!checked) : undefined}
        />
      )}
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-xs font-semibold">
        {showLabel && <span>{label}</span>}
        <Switch
          checked={shown}
          disabled={disabled || state === "saving"}
          onCheckedChange={(next) => void change(next)}
          aria-label={ariaLabel}
        />
      </label>
    </span>
  );
}
