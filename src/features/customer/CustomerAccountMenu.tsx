import { useState } from "react";
import { User } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PersonAvatar, StatusBadge } from "@/components/visual";
import { MyAreasSection } from "@/features/account/MyAreas";
import { useAreaSwitch } from "@/features/account/useAreas";
import { CUSTOMER_META } from "@/features/shop/roles";
import type { AreaItem } from "@/lib/auth/areas";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const ITEM =
  "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition hover:bg-muted";

/**
 * Menu da conta no app do cliente para quem tem outro ambiente (painel ou plataforma): quem está
 * conectado, o selo "Cliente", "Minhas áreas" e "Minha conta". Conta só de cliente não usa este
 * menu (o ícone continua abrindo a Conta direto).
 */
export function CustomerAccountMenu({
  name,
  email,
  areas,
  current,
  onOpenAccount,
}: {
  name: string;
  email?: string | null;
  areas: AreaItem[];
  /** A aba Conta está aberta (marca o botão como página atual). */
  current?: boolean;
  onOpenAccount: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const areaSwitch = useAreaSwitch();
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("nav.myAccount")}
            aria-current={current ? "page" : undefined}
            className={cn("app-icon-button p-0!", current && "app-nav-current")}
          >
            <PersonAvatar name={name} size="sm" seed={email ?? name} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={10}
          collisionPadding={12}
          className="z-[70] max-h-[calc(100dvh-6rem)] w-80 max-w-[calc(100vw-24px)] overflow-y-auto rounded-2xl border-border p-2 shadow-xl"
        >
          <div className="flex items-center gap-3 px-2 pb-2 pt-1">
            <PersonAvatar name={name} size="md" seed={email ?? name} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{name}</p>
              {email && email !== name && (
                <p className="truncate text-xs text-muted-foreground">{email}</p>
              )}
              <StatusBadge
                size="sm"
                tone={CUSTOMER_META.tone}
                icon={CUSTOMER_META.icon}
                label={t(CUSTOMER_META.label)}
                className="mt-1"
              />
            </div>
          </div>
          <MyAreasSection
            areas={areas}
            current={{ kind: "customer" }}
            onPick={(area) => {
              setOpen(false);
              if (area.kind !== "customer") areaSwitch.open(area);
            }}
          />
          <div className="space-y-0.5 border-t border-border pt-1">
            <button
              type="button"
              className={ITEM}
              onClick={() => {
                setOpen(false);
                onOpenAccount();
              }}
            >
              <User className="size-4 shrink-0 text-gold" aria-hidden />
              {t("nav.myAccount")}
            </button>
          </div>
        </PopoverContent>
      </Popover>
      {areaSwitch.overlay}
    </>
  );
}
