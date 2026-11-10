import { useState } from "react";
import { ChevronDown, Clock, Globe2, History, MessageCircle } from "lucide-react";
import { ChoiceChips, Notice } from "@/components/visual";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";
import { ShopDomainCard } from "@/features/shop/settings/ShopDomainCard";
import { ShopTimezoneCard } from "@/features/shop/settings/ShopTimezoneCard";
import { SlugRedirectsCard } from "@/features/shop/settings/SlugRedirectsCard";

import { WhatsAppChannelCard } from "@/features/shop/settings/WhatsAppChannelCard";
import { ShopWhatsAppDelivery } from "./ShopWhatsAppDelivery";

type Panel = "domain" | "redirects" | "timezone" | "whatsapp";

/** Gestão compartilhada: os mesmos contratos e permissões usados nos Ajustes da loja. */
export function PlatformShopSettings({
  shop,
  demoMode = false,
  onUpdated,
}: {
  shop: Tables<"barbershops">;
  demoMode?: boolean;
  onUpdated?: () => void;
}) {
  const { t } = useI18n();
  const [loaded, setLoaded] = useState(false);
  const [panel, setPanel] = useState<Panel>("domain");
  return (
    <details
      className="plat-shop-operations group min-w-0 rounded-2xl border border-border bg-background px-3 py-2"
      onToggle={(event) => {
        if (event.currentTarget.open) setLoaded(true);
      }}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold [&::-webkit-details-marker]:hidden">
        <Globe2 className="size-4 shrink-0 text-gold" aria-hidden />
        <span className="min-w-0 flex-1">{t("plat.shop.configuration")}</span>
        <ChevronDown
          className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden
        />
      </summary>
      {loaded &&
        (demoMode ? (
          <Notice tone="info" title={t("plat.shop.configurationDemo")} />
        ) : (
          <div className="min-w-0 space-y-3 pt-2">
            <ChoiceChips<Panel>
              label={t("plat.shop.configuration")}
              hideLabel
              value={panel}
              onChange={setPanel}
              options={[
                { value: "domain", label: t("domainCard.title"), icon: Globe2 },
                { value: "redirects", label: t("redirects.title"), icon: History },
                { value: "timezone", label: t("dec.tz.settings.title"), icon: Clock },
                { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
              ]}
            />
            <div hidden={panel !== "whatsapp"} className="space-y-3">
              <WhatsAppChannelCard
                key={`channel-${shop.id}`}
                shopId={shop.id}
                shopTimeZone={shop.timezone}
                canManageConnection
              />
              <ShopWhatsAppDelivery key={shop.id} shopId={shop.id} />
            </div>
            {/* Trocar assunto ou recolher mantém rascunhos; mudar de loja remonta a ficha. */}
            <div hidden={panel !== "domain"}>
              <ShopDomainCard key={shop.id} shopId={shop.id} onUpdated={onUpdated} />
            </div>
            <div hidden={panel !== "redirects"}>
              <SlugRedirectsCard key={shop.id} shopId={shop.id} currentShopSlug={shop.slug} />
            </div>
            <div hidden={panel !== "timezone"}>
              <ShopTimezoneCard
                key={shop.id}
                shopId={shop.id}
                timeZone={shop.timezone}
                canEdit
                onUpdated={onUpdated}
              />
            </div>
          </div>
        ))}
    </details>
  );
}
