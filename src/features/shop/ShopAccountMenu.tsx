import { useState } from "react";
import {
  Check,
  ChevronDown,
  KeyRound,
  Languages,
  LogOut,
  Store,
  type LucideIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PersonAvatar } from "@/components/visual";
import { ChangePasswordCard } from "@/features/auth/ChangePasswordCard";
import { LanguageSettingsCard } from "@/components/LanguageSettingsCard";
import { ThemeSettingsCard } from "@/features/shop/settings/ThemeSettingsCard";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { MyAreasSection } from "@/features/account/MyAreas";
import { useAreaSwitch } from "@/features/account/useAreas";
import type { AreaItem } from "@/lib/auth/areas";
import { RoleBadge } from "./roles";

const ITEM =
  "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition hover:bg-muted";

function MenuIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="size-4 shrink-0 text-gold" aria-hidden />;
}

/** Barbearia da pessoa com o papel ali (e a parte, para o selo "Dono · 50%"). */
export type ShopChoice = { id: string; name: string; role: string; percent?: number | null };

/** Lista de barbearias com o papel de cada uma; a atual vem marcada. */
export function ShopList({
  shops,
  currentId,
  onPick,
}: {
  shops: ShopChoice[];
  currentId: string;
  onPick: (id: string) => void;
}) {
  return (
    <ul className="space-y-0.5">
      {shops.map((shop) => {
        const current = shop.id === currentId;
        return (
          <li key={shop.id}>
            <button
              type="button"
              aria-current={current ? "true" : undefined}
              onClick={() => onPick(shop.id)}
              className={cn(ITEM, current && "bg-primary/5")}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted">
                <Store className="size-4 text-gold" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{shop.name}</span>
                <RoleBadge role={shop.role} percent={shop.percent} className="mt-0.5" />
              </span>
              {current && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Nome da barbearia no cabeçalho. Com mais de uma loja vira botão (seta para baixo) que abre a
 * lista "Trocar de barbearia" com o papel em cada uma.
 */
export function ShopSwitcher({
  name,
  shops,
  currentId,
  onSwitch,
}: {
  name: string;
  shops: ShopChoice[];
  currentId: string;
  onSwitch: (id: string) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const title = (
    <span className="line-clamp-2 break-words text-lg leading-tight font-extrabold tracking-tight max-[379px]:text-base">
      {name}
    </span>
  );
  if (shops.length < 2) return <h1>{title}</h1>;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <h1>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("eq.account.switchShop")}
            className="-mx-1 flex min-h-11 max-w-full items-center gap-1 rounded-xl px-1 text-left transition hover:bg-muted/60"
          >
            {title}
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </PopoverTrigger>
      </h1>
      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="z-[70] w-80 max-w-[calc(100vw-24px)] rounded-2xl border-border p-2 shadow-xl"
      >
        <p className="px-3 pb-1 pt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {t("eq.account.switchShop")}
        </p>
        <ShopList
          shops={shops}
          currentId={currentId}
          onPick={(id) => {
            setOpen(false);
            onSwitch(id);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Menu da conta do painel da barbearia (mesmo desenho do da plataforma): quem está conectado e
 * com que papel, "Minhas áreas" (cada barbearia, cliente e plataforma), senha, idioma e sair.
 */
export function ShopAccountMenu({
  name,
  email,
  role,
  percent,
  shopName,
  shops,
  currentShopId,
  onSwitchShop,
  areas,
  currentBarbershopId,
  onSignOut,
}: {
  name: string;
  email?: string | null;
  role?: string | null;
  /** Parte do dono na loja aberta ("Dono · 50%"). */
  percent?: number | null;
  shopName?: string | null;
  shops: ShopChoice[];
  currentShopId: string;
  onSwitchShop: (id: string) => void;
  /** Áreas da conta (vazio quando só há uma). */
  areas: AreaItem[];
  /** Barbearia aberta no painel (marca a área atual). */
  currentBarbershopId: string | null;
  onSignOut: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const areaSwitch = useAreaSwitch();
  // Outra barbearia do próprio painel troca aqui mesmo ("Abrindo …" do painel); cliente e
  // plataforma abrem o outro ambiente.
  function pickArea(area: AreaItem) {
    setOpen(false);
    if (area.kind === "shop") {
      if (area.shopId === currentBarbershopId) return;
      if (area.actorId && shops.some((shop) => shop.id === area.actorId)) {
        onSwitchShop(area.actorId);
        return;
      }
    }
    areaSwitch.open(area);
  }
  const [panel, setPanel] = useState<"password" | "language" | null>(null);

  function openPanel(next: "password" | "language") {
    setOpen(false);
    window.setTimeout(() => setPanel(next), 0);
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("eq.account.open")}
            title={t("eq.account.open")}
            className="app-icon-button p-0!"
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
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {role && <RoleBadge role={role} percent={percent} />}
                {shopName && (
                  <span className="truncate text-xs font-semibold text-muted-foreground">
                    {shopName}
                  </span>
                )}
              </div>
            </div>
          </div>
          {areas.length > 0 ? (
            <MyAreasSection
              areas={areas}
              current={{ kind: "shop", shopId: currentBarbershopId }}
              onPick={pickArea}
            />
          ) : (
            shops.length > 1 && (
              <div className="border-t border-border pt-1">
                <p className="px-3 pb-1 pt-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {t("eq.account.switchShop")}
                </p>
                <ShopList
                  shops={shops}
                  currentId={currentShopId}
                  onPick={(id) => {
                    setOpen(false);
                    onSwitchShop(id);
                  }}
                />
              </div>
            )
          )}
          <div className="space-y-0.5 border-t border-border pt-1">
            <button type="button" className={ITEM} onClick={() => openPanel("password")}>
              <MenuIcon icon={KeyRound} />
              {t("eq.account.password")}
            </button>
            <button type="button" className={ITEM} onClick={() => openPanel("language")}>
              <MenuIcon icon={Languages} />
              {t("eq.account.language")}
            </button>
          </div>
          <div className="mt-1 border-t border-border pt-1">
            <button type="button" className={cn(ITEM, "text-destructive")} onClick={onSignOut}>
              <LogOut className="size-4 shrink-0" aria-hidden />
              {t("eq.account.signOut")}
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {areaSwitch.overlay}

      <Dialog open={panel !== null} onOpenChange={(next) => !next && setPanel(null)}>
        <DialogContent
          aria-describedby={undefined}
          className="max-h-[92dvh] max-w-md rounded-3xl border-border bg-card p-5"
        >
          <DialogTitle className="flex min-h-11 items-center gap-2 pr-12 text-lg font-bold">
            {panel === "language" ? (
              <Languages className="size-5 text-gold" aria-hidden />
            ) : (
              <KeyRound className="size-5 text-gold" aria-hidden />
            )}
            {panel === "language" ? t("eq.account.language") : t("eq.account.password")}
          </DialogTitle>
          {panel === "password" && <ChangePasswordCard />}
          {panel === "language" && (
            <div className="space-y-4">
              <LanguageSettingsCard hideHeading />
              <ThemeSettingsCard />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
