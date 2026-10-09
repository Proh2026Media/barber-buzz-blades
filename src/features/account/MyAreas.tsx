import { useEffect, useState } from "react";
import { Check, Store } from "lucide-react";
import { StatusBadge } from "@/components/visual";
import { CUSTOMER_META, PLATFORM_META, RoleBadge } from "@/features/shop/roles";
import { isCurrentArea, type AreaItem, type CurrentArea } from "@/lib/auth/areas";
import { isPlatformApexHost } from "@/lib/shop/host";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const ITEM =
  "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition hover:bg-muted";

function AreaIcon({ area }: { area: AreaItem }) {
  const Icon =
    area.kind === "platform"
      ? PLATFORM_META.icon
      : area.kind === "customer"
        ? CUSTOMER_META.icon
        : Store;
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted">
      <Icon className="size-4 text-gold" aria-hidden />
    </span>
  );
}

/**
 * "Minhas áreas" no menu da conta dos três ambientes: plataforma, cada barbearia com o papel
 * ali e o app do cliente. A atual vem marcada; tocar em outra abre "Abrindo …".
 */
export function MyAreasSection({
  areas,
  current,
  onPick,
  className,
}: {
  areas: AreaItem[];
  current: CurrentArea | null;
  onPick: (area: AreaItem) => void;
  className?: string;
}) {
  const { t } = useI18n();
  // Sessões são por endereço: a plataforma no domínio de uma barbearia pode pedir nova entrada.
  const [otherAddress, setOtherAddress] = useState(false);
  useEffect(() => setOtherAddress(!isPlatformApexHost()), []);
  if (areas.length === 0) return null;
  return (
    <div className={cn("border-t border-border pt-1", className)}>
      <p className="px-3 pb-1 pt-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {t("area.title")}
      </p>
      <ul className="space-y-0.5">
        {areas.map((area) => {
          const here = isCurrentArea(area, current);
          return (
            <li key={area.key}>
              <button
                type="button"
                aria-current={here ? "true" : undefined}
                onClick={() => onPick(area)}
                className={cn(ITEM, here && "bg-primary/5")}
              >
                <AreaIcon area={area} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {area.kind === "shop"
                      ? area.name
                      : area.kind === "platform"
                        ? t("area.platformTitle")
                        : t("area.customerTitle")}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {area.kind === "shop" ? (
                      <RoleBadge role={area.role} percent={area.percent} />
                    ) : (
                      <StatusBadge
                        size="sm"
                        tone={area.kind === "platform" ? PLATFORM_META.tone : CUSTOMER_META.tone}
                        icon={area.kind === "platform" ? PLATFORM_META.icon : CUSTOMER_META.icon}
                        label={t(
                          area.kind === "platform" ? PLATFORM_META.label : CUSTOMER_META.label,
                        )}
                      />
                    )}
                    {area.kind === "platform" && otherAddress && !here && (
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {t("area.otherAddress")}
                      </span>
                    )}
                  </span>
                </span>
                {here && (
                  <>
                    <Check className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="sr-only">{t("area.current")}</span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
