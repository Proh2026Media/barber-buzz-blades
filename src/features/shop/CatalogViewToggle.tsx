import { LayoutGrid, List } from "lucide-react";

export type CatalogViewMode = "grid" | "list";

/** Toggle grade/lista reutilizável (loja e app do cliente). */
export function CatalogViewToggle({
  viewMode,
  onViewMode,
  className = "",
}: {
  viewMode: CatalogViewMode;
  onViewMode: (value: CatalogViewMode) => void;
  className?: string;
}) {
  return (
    <div
      className={`flex shrink-0 gap-1 rounded-xl border border-border bg-card p-1 ${className}`}
      role="group"
      aria-label="Modo de visualização"
    >
      {(
        [
          { id: "grid" as const, label: "Grade", icon: LayoutGrid },
          { id: "list" as const, label: "Lista", icon: List },
        ] as const
      ).map(({ id, label: name, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={viewMode === id}
          aria-label={name}
          title={name}
          onClick={() => onViewMode(id)}
          className={`flex min-h-9 min-w-9 items-center justify-center rounded-lg transition-colors ${
            viewMode === id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Icon className="size-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export function readCatalogViewPreference(
  shopId: string | null,
  kind: "services" | "staff",
  fallback: CatalogViewMode,
): CatalogViewMode {
  if (!shopId || typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(`catalogView:${kind}:${shopId}`);
    if (raw === "grid" || raw === "list") return raw;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function writeCatalogViewPreference(
  shopId: string | null,
  kind: "services" | "staff",
  value: CatalogViewMode,
) {
  if (!shopId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`catalogView:${kind}:${shopId}`, value);
  } catch {
    /* ignore */
  }
}
