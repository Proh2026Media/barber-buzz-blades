import { LayoutGrid, List } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { type CatalogViewMode } from "./catalog-view-model";

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
  const { t } = useI18n();
  return (
    <div
      className={`flex shrink-0 gap-1 rounded-xl border border-border bg-card p-1 ${className}`}
      role="group"
      aria-label={t("brand.catalog.viewAria")}
    >
      {(
        [
          { id: "grid" as const, label: t("brand.catalog.grid"), icon: LayoutGrid },
          { id: "list" as const, label: t("brand.catalog.list"), icon: List },
        ] as const
      ).map(({ id, label: name, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={viewMode === id}
          aria-label={name}
          title={name}
          onClick={() => onViewMode(id)}
          className={`flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors ${
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
