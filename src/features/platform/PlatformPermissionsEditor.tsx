import { useEffect, useId, useState } from "react";
import {
  ArrowRight,
  KeyRound,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  type LucideIcon,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { SectionHeader, StatusBadge, type Tone } from "@/components/visual";
import { ROLE_ICON } from "@/features/demo/roles";
import { ShopPermissionsMatrix } from "@/features/shop/ShopPermissionsMatrix";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { SHOP_STATUS } from "./shopStats";

type Tier = {
  key: string;
  roles: { icon: LucideIcon; labelKey: MessageKey }[];
  tone: Tone;
  icon: LucideIcon;
  resultKey: MessageKey;
};

/** Quem pode o quê, de cima para baixo: o que vale sozinho e o que se define na tabela. */
const TIERS: Tier[] = [
  {
    key: "platform",
    roles: [
      { icon: ROLE_ICON.platform, labelKey: "plat.perm.you" },
      { icon: ROLE_ICON.manager, labelKey: "plat.perm.managerRole" },
    ],
    tone: "success",
    icon: ShieldCheck,
    resultKey: "plat.perm.full",
  },
  // Mesmos nomes das colunas da tabela logo abaixo: o dono e o co-dono (dono com
  // participação) editam níveis e sociedade; o co-dono legado entra na tabela.
  {
    key: "owners",
    roles: [{ icon: ROLE_ICON.owner, labelKey: "team.perm.role.owner" }],
    tone: "success",
    icon: ShieldCheck,
    resultKey: "plat.perm.fullPlus",
  },
  {
    key: "team",
    roles: [
      { icon: ROLE_ICON.partner, labelKey: "team.perm.role.partner" },
      { icon: ROLE_ICON.associate, labelKey: "team.perm.role.associate" },
      { icon: ROLE_ICON.employee, labelKey: "team.perm.role.employee" },
    ],
    // "Você define" é uma regra, não um estado: neutro (o azul fica para "Confirmado").
    tone: "neutral",
    icon: SlidersHorizontal,
    resultKey: "plat.perm.below",
  },
];

export function PlatformPermissionsEditor({
  shops,
  demoMode = false,
  shopId: controlledShopId,
  onShopChange,
}: {
  shops: Tables<"barbershops">[];
  /** Na demonstração não há servidor: a matriz usa permissões fictícias e não salva. */
  demoMode?: boolean;
  /** Barbearia escolhida (vem da ficha da barbearia); sem ela, começa na primeira. */
  shopId?: string;
  onShopChange?: (shopId: string) => void;
}) {
  const { t } = useI18n();
  const [localShopId, setLocalShopId] = useState("");
  const shopId = controlledShopId || localShopId;
  const shopFieldId = useId();
  const selected = shops.find((shop) => shop.id === shopId);

  useEffect(() => {
    if (!shopId && shops.length > 0) setLocalShopId(shops[0]!.id);
  }, [shopId, shops]);

  function choose(next: string) {
    setLocalShopId(next);
    onShopChange?.(next);
  }

  const status = selected ? SHOP_STATUS[selected.status] : null;

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-3xl border border-border bg-card p-4 sm:p-5">
        <SectionHeader as="h2" icon={KeyRound} title={t("plat.perm.heading")} />
        <ol className="space-y-2" aria-label={t("plat.perm.heading")}>
          {TIERS.map((tier) => (
            <li
              key={tier.key}
              className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-background p-2.5"
            >
              <span className="flex flex-1 flex-wrap items-center gap-1.5">
                {tier.roles.map(({ icon: Icon, labelKey }) => (
                  <span
                    key={labelKey}
                    className="inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-xl bg-muted px-2.5 text-xs font-semibold"
                  >
                    <Icon className="size-3.5 text-gold" aria-hidden />
                    {t(labelKey)}
                  </span>
                ))}
              </span>
              {/* Seta e resultado andam juntos: se faltar espaço, descem de linha os dois. */}
              <span className="flex items-center gap-2">
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <StatusBadge tone={tier.tone} icon={tier.icon} label={t(tier.resultKey)} />
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4">
        <Store className="size-5 shrink-0 text-gold" aria-hidden />
        <label htmlFor={shopFieldId} className="text-sm font-semibold">
          {t("plat.common.shop")}
        </label>
        <select
          id={shopFieldId}
          value={shopId}
          onChange={(event) => choose(event.target.value)}
          disabled={shops.length === 0}
          className="order-last min-h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground sm:order-none sm:w-auto sm:min-w-72"
        >
          {shops.length === 0 && <option value="">{t("plat.perm.noShops")}</option>}
          {shops.map((shop) => (
            <option key={shop.id} value={shop.id}>
              {shop.name}
            </option>
          ))}
        </select>
        {selected && status && (
          <StatusBadge
            tone={status.tone}
            icon={status.icon}
            label={
              selected.status === "active" ? t("plat.shops.active") : t("plat.shops.suspended")
            }
          />
        )}
      </div>

      {shopId ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <ShopPermissionsMatrix shopId={shopId} canEdit demo={demoMode} />
        </section>
      ) : null}
    </div>
  );
}
