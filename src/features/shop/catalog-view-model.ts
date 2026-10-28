export type CatalogViewMode = "grid" | "list";

export function readCatalogViewPreference<T extends CatalogViewMode | null>(
  shopId: string | null,
  kind: "services" | "staff",
  fallback: T,
): CatalogViewMode | T {
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
