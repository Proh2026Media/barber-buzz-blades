import { useState } from "react";
import { Check, Shuffle, Store, ShieldCheck, Radio, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { suggestDistribution } from "@/lib/whatsapp/distribution-suggestion";
import type { DistributionNumber, DistributionRoute } from "./WhatsAppDistribution";

export function DistributionSuggestion({
  numbers,
  shops,
  routes,
  apply,
}: {
  numbers: DistributionNumber[];
  shops: { id: string; name: string }[];
  routes: DistributionRoute[];
  apply: (
    shop: string,
    ids: { primary: string; backup: string | null; backup2: string | null },
  ) => void;
}) {
  const { t } = useI18n();
  const [shop, setShop] = useState("");
  const [plan, setPlan] = useState<ReturnType<typeof suggestDistribution> | null>(null);
  const [snapshot, setSnapshot] = useState("");
  const [applied, setApplied] = useState(false);
  const stale = Boolean(plan && snapshot !== JSON.stringify(routes));
  return (
    <div className="wa-auto-plan">
      <h3>
        <Shuffle className="size-5" aria-hidden />
        {t("waAuto.title")}
      </h3>
      <p>{t("waAuto.basis")}</p>
      <div className="wa-auto-shops" role="radiogroup" aria-label={t("waAuto.shop")}>
        {shops.map((s) => (
          <button
            type="button"
            key={s.id}
            role="radio"
            aria-checked={shop === s.id}
            onClick={() => {
              setShop(s.id);
              setPlan(null);
              setApplied(false);
            }}
          >
            <Store className="size-4" aria-hidden />
            {s.name}
            <span className="wa-shop-selection" data-selected={shop === s.id} aria-hidden="true">
              <span className="wa-shop-selection-fill" />
              <Check className="size-3.5" />
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="action-button action-confirm"
        disabled={!shop}
        onClick={() => {
          setPlan(suggestDistribution(shop, numbers, routes));
          setSnapshot(JSON.stringify(routes));
          setApplied(false);
        }}
      >
        <Shuffle className="size-4" aria-hidden />
        {t("waAuto.generate")}
      </button>
      {plan && (
        <div className="wa-auto-result" aria-live="polite">
          <div className="wa-auto-proposal">
            {[plan.primary, plan.backup, plan.backup2].map((n, i) => (
              <article key={i}>
                {i === 0 ? (
                  <Radio className="size-4" aria-hidden />
                ) : (
                  <ShieldCheck className="size-4" aria-hidden />
                )}
                <span>
                  {t(i === 0 ? "waDistribution.primary" : "waDistribution.backup")}
                  {i > 0 ? ` ${i}` : ""}
                </span>
                <strong>
                  {n?.display_phone ??
                    t(i === 0 ? "waDistribution.noPrimary" : "waDistribution.noBackup")}
                </strong>
              </article>
            ))}
          </div>
          {plan.available < 3 && (
            <p className="wa-auto-warning">
              <AlertTriangle className="size-4" aria-hidden />
              {t("waAuto.missing", { count: plan.available })}
            </p>
          )}
          <p>{t("waAuto.effect")}</p>
          {stale && <p role="alert">{t("waAuto.stale")}</p>}
          <button
            type="button"
            className="action-button action-confirm"
            disabled={!plan.primary || !plan.backup || stale || applied}
            onClick={() => {
              if (!plan.primary || !plan.backup || snapshot !== JSON.stringify(routes)) return;
              apply(shop, {
                primary: plan.primary.id,
                backup: plan.backup?.id ?? null,
                backup2: plan.backup2?.id ?? null,
              });
              setPlan(null);
              setApplied(true);
            }}
          >
            <Check className="size-4" aria-hidden />
            {t("waAuto.apply")}
          </button>
        </div>
      )}
      {applied && <p role="status">{t("waAuto.applied")}</p>}
    </div>
  );
}
