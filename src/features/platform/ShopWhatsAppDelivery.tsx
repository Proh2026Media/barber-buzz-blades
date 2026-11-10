import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { shopWhatsAppNumber } from "@/lib/whatsapp/shop-number";
import { useDemo } from "@/features/demo/context";

/** Um único editor de principal/reserva, visível na central administrativa. */
export function ShopWhatsAppDelivery({ shopId }: { shopId: string }) {
  const { t } = useI18n();
  const demo = useDemo();
  const [numberId, setNumberId] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setNumberId(null);
    if (!demo)
      void shopWhatsAppNumber(shopId).then(({ data }) => {
        if (live) setNumberId(data?.id ?? null);
      });
    return () => {
      live = false;
    };
  }, [shopId, demo]);
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h4 className="flex items-center gap-2 font-bold">
        <ShieldCheck className="size-4" aria-hidden />
        {t("waNumbers.settings")}
      </h4>
      <p className="text-sm text-muted-foreground">{t("waNumbers.intro")}</p>
      {!demo && (
        <a
          className="action-button"
          href={`/platform?aba=whatsapp${numberId ? `&numero=${encodeURIComponent(numberId)}` : ""}`}
        >
          {t("waNumbers.manage")}
          <ArrowRight className="size-4 shrink-0" aria-hidden />
        </a>
      )}
    </section>
  );
}
