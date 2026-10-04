import { Fragment, useEffect, useId, useState, type ReactNode } from "react";
import { Shield, Building2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { ShopPermissionsMatrix } from "@/features/shop/ShopPermissionsMatrix";
import { useI18n } from "@/lib/i18n";

function richText(template: string, nodes: Record<string, ReactNode>) {
  return template
    .split(/\{(\w+)\}/g)
    .map((part, i) => (i % 2 === 1 ? <Fragment key={i}>{nodes[part] ?? part}</Fragment> : part));
}

export function PlatformPermissionsEditor({
  shops,
  demoMode = false,
}: {
  shops: Tables<"barbershops">[];
  /** Na demonstração não há servidor: a matriz usa permissões fictícias e não salva. */
  demoMode?: boolean;
}) {
  const { t } = useI18n();
  const [shopId, setShopId] = useState("");
  const shopFieldId = useId();

  useEffect(() => {
    if (!shopId && shops.length > 0) setShopId(shops[0]!.id);
  }, [shopId, shops]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="app-section-title">
          <Shield aria-hidden="true" />
          <h2>{t("plat.perm.title")}</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {richText(t("plat.perm.intro"), {
            admin: <strong>{t("plat.perm.admin")}</strong>,
            manager: <strong>{t("plat.perm.manager")}</strong>,
          })}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <Building2 className="size-4 text-primary" />
        <label htmlFor={shopFieldId} className="text-sm font-semibold">
          {t("plat.common.shop")}
        </label>
        <select
          id={shopFieldId}
          value={shopId}
          onChange={(event) => setShopId(event.target.value)}
          disabled={shops.length === 0}
          className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
        >
          {shops.length === 0 && <option value="">{t("plat.perm.noShops")}</option>}
          {shops.map((shop) => (
            <option key={shop.id} value={shop.id}>
              {shop.name}
              {shop.status === "active" ? "" : t("plat.shops.suspendedSuffix")}
            </option>
          ))}
        </select>
      </div>

      {shopId ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <ShopPermissionsMatrix shopId={shopId} canEdit demo={demoMode} />
        </section>
      ) : null}
    </div>
  );
}
