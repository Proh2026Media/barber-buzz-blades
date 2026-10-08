import { Search, X } from "lucide-react";
import { ChoiceChips } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { CatalogViewToggle, type CatalogViewMode } from "./CatalogViewToggle";

export type CatalogStatus = "all" | "active" | "paused";
export type { CatalogViewMode };

/**
 * Busca + filtro por estado (com contagem) + grade/lista. A contagem de resultados só aparece
 * quando há busca ou filtro com algum resultado, junto do "Limpar" — sem filtro, as pílulas já
 * dizem os números; sem resultado, quem limpa é o estado vazio da lista.
 */
export function CatalogFilters({
  query,
  onQuery,
  status,
  onStatus,
  total,
  active,
  visible,
  label,
  activeLabel,
  pausedLabel,
  viewMode = "grid",
  onViewMode,
  statusFirst = false,
}: {
  query: string;
  onQuery: (value: string) => void;
  status: CatalogStatus;
  onStatus: (value: CatalogStatus) => void;
  total: number;
  active: number;
  visible: number;
  label: string;
  /** Nome do estado ligado na lista ("Visíveis", "Recebem agendamentos"). */
  activeLabel?: string;
  /** Nome do estado desligado ("Pausados"). */
  pausedLabel?: string;
  viewMode?: CatalogViewMode;
  onViewMode?: (value: CatalogViewMode) => void;
  /** Pílulas de estado antes da busca (listas curtas, em que a busca é o recurso menos usado). */
  statusFirst?: boolean;
}) {
  const { t } = useI18n();
  const filtering = Boolean(query.trim()) || status !== "all";
  const chips =
    total > 0 ? (
      <ChoiceChips
        label={t("brand.catalog.filterAria")}
        hideLabel
        value={status}
        onChange={onStatus}
        options={[
          { value: "all", label: t("brand.catalog.all"), count: total },
          { value: "active", label: activeLabel ?? t("brand.catalog.active"), count: active },
          {
            value: "paused",
            label: pausedLabel ?? t("brand.catalog.paused"),
            count: total - active,
          },
        ]}
      />
    ) : null;
  return (
    <div className="catalog-filters space-y-3">
      {statusFirst && chips}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[10rem] flex-1">
          <span className="sr-only">{label}</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder={label}
            className="min-h-11 w-full rounded-xl border border-border bg-card py-3 pl-10 pr-3 text-ellipsis text-sm"
          />
        </label>
        {onViewMode && <CatalogViewToggle viewMode={viewMode} onViewMode={onViewMode} />}
      </div>
      {!statusFirst && chips}
      {/* Sem resultado, o estado vazio logo abaixo já oferece "Limpar busca" (um botão só). */}
      {filtering && visible > 0 && (
        <p role="status" className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <span>{t("brand.catalog.results", { visible, total })}</span>
          <button
            type="button"
            onClick={() => {
              onQuery("");
              onStatus("all");
            }}
            className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <X className="size-4" aria-hidden /> {t("brand.catalog.clear")}
          </button>
        </p>
      )}
    </div>
  );
}
