import { useState, type ReactNode } from "react";
import { CalendarClock, Check, ChevronDown, Store } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Notice, PersonAvatar, StatusBadge } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { CustomerShop, OtherShopBookings } from "./shop-choice";

const ITEM =
  "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition hover:bg-muted";

/**
 * Nome da barbearia no topo do app do cliente. Com 2 ou mais lojas vira seletor (seta para
 * baixo): cada loja com o contador de reservas futuras; a aberta vem marcada.
 */
export function CustomerShopSwitcher({
  title,
  shops,
  currentId,
  upcoming,
  onPick,
}: {
  /** O nome como aparece hoje no cabeçalho (mesma fonte e corte de linhas). */
  title: ReactNode;
  shops: CustomerShop[];
  currentId: string | null;
  /** Reservas futuras por loja. */
  upcoming: Map<string, number>;
  onPick: (shop: CustomerShop) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (shops.length < 2) return <>{title}</>;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="-mx-1 -my-1.5 flex min-h-11 min-w-0 max-w-full items-center gap-1 rounded-xl px-1 py-1.5 text-left transition hover:bg-current/10"
        >
          {/* O nome continua sendo o nome acessível do título ("onde estou"); a ação vem depois. */}
          <span className="min-w-0 flex-1">
            {title}
            <span className="sr-only"> · {t("cust.shops.switch")}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="z-[70] max-h-[calc(100dvh-6rem)] w-80 max-w-[calc(100vw-24px)] overflow-y-auto rounded-2xl border-border p-2 shadow-xl"
      >
        <p className="px-3 pb-1 pt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {t("cust.shops.switch")}
        </p>
        <ul className="space-y-0.5">
          {shops.map((shop) => {
            const here = shop.id === currentId;
            const count = upcoming.get(shop.id) ?? 0;
            return (
              <li key={shop.id}>
                <button
                  type="button"
                  aria-current={here ? "true" : undefined}
                  onClick={() => {
                    setOpen(false);
                    if (!here) onPick(shop);
                  }}
                  className={cn(ITEM, here && "bg-primary/5")}
                >
                  <PersonAvatar name={shop.name} seed={shop.id} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{shop.name}</span>
                    {count > 0 && (
                      <StatusBadge
                        size="sm"
                        tone="info"
                        icon={CalendarClock}
                        label={t(
                          count === 1 ? "cust.shops.upcomingOne" : "cust.shops.upcomingMany",
                          { count },
                        )}
                        className="mt-0.5"
                      />
                    )}
                  </span>
                  {here && (
                    <>
                      <Check className="size-4 shrink-0 text-primary" aria-hidden />
                      <span className="sr-only">{t("conta.shops.here")}</span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/**
 * "1 reserva na Loja B · Abrir": as reservas de outra loja não somem em silêncio. Usa as
 * reservas que o app já carregou; "Abrir" troca para a loja certa (com "Abrindo …").
 */
export function OtherShopNotices({
  groups,
  onOpen,
  className,
}: {
  groups: OtherShopBookings[];
  onOpen: (group: OtherShopBookings) => void;
  className?: string;
}) {
  const { t } = useI18n();
  if (groups.length === 0) return null;
  return (
    <div className={cn("space-y-2", className)}>
      {groups.slice(0, 3).map((group) => {
        const name = group.name || t("cust.thisShop");
        return (
          <Notice
            key={group.shopId}
            tone="info"
            icon={Store}
            role="none"
            title={t(group.count === 1 ? "cust.otherShop.one" : "cust.otherShop.many", {
              count: group.count,
              shop: name,
            })}
            action={
              group.slug
                ? { label: t("cust.otherShop.open"), icon: Store, onClick: () => onOpen(group) }
                : undefined
            }
          />
        );
      })}
    </div>
  );
}
