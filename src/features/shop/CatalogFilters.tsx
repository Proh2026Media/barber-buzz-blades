import { Search, X } from "lucide-react";
import { CatalogViewToggle, type CatalogViewMode } from "./CatalogViewToggle";

export type CatalogStatus = "all" | "active" | "paused";
export type { CatalogViewMode };

export function CatalogFilters({
  query,
  onQuery,
  status,
  onStatus,
  total,
  active,
  visible,
  label,
  viewMode = "grid",
  onViewMode,
}: {
  query: string;
  onQuery: (value: string) => void;
  status: CatalogStatus;
  onStatus: (value: CatalogStatus) => void;
  total: number;
  active: number;
  visible: number;
  label: string;
  viewMode?: CatalogViewMode;
  onViewMode?: (value: CatalogViewMode) => void;
}) {
  return (
    <div className="catalog-filters space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[12rem] flex-1">
          <span className="sr-only">{label}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder={label}
            className="min-h-11 w-full rounded-xl border border-border bg-card py-3 pl-10 pr-12 text-sm"
          />
        </label>
        {onViewMode && <CatalogViewToggle viewMode={viewMode} onViewMode={onViewMode} />}
      </div>
      <div className="flex flex-wrap items-center gap-2" aria-label="Filtrar disponibilidade">
        {(
          [
            { id: "all", name: "Todos", count: total },
            { id: "active", name: "Ativos", count: active },
            { id: "paused", name: "Pausados", count: total - active },
          ] as const
        ).map(({ id, name, count }) => (
          <button
            key={id}
            type="button"
            aria-pressed={status === id}
            onClick={() => onStatus(id)}
            className="flex min-h-11 items-center gap-2 rounded-full border border-border px-3 text-xs font-semibold text-muted-foreground aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            {name}
            <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-xs">{count}</span>
          </button>
        ))}
        {(query || status !== "all") && (
          <button
            type="button"
            onClick={() => {
              onQuery("");
              onStatus("all");
            }}
            className="flex min-h-11 items-center gap-1 px-2 text-xs font-semibold text-muted-foreground"
          >
            <X className="size-3.5" /> Limpar
          </button>
        )}
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {visible} de {total} resultados
      </p>
    </div>
  );
}
