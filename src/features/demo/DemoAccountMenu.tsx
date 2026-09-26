import {
  Building2,
  Clock3,
  LogOut,
  Shield,
  User,
  Smartphone,
  Handshake,
  Briefcase,
  Scissors,
  FlaskConical,
  type LucideIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useDemoChrome, type DemoRole } from "./chrome";
import { formatShopDate } from "@/lib/shop/appointments";
import { useI18n, type MessageKey } from "@/lib/i18n";

const demoRoles: {
  id: DemoRole;
  labelKey: MessageKey;
  hintKey: MessageKey;
  icon: LucideIcon;
}[] = [
  {
    id: "platform",
    labelKey: "demo.role.platform",
    hintKey: "demo.role.platformHint",
    icon: Shield,
  },
  { id: "owner", labelKey: "demo.role.owner", hintKey: "demo.role.ownerHint", icon: Building2 },
  {
    id: "partner",
    labelKey: "demo.role.partner",
    hintKey: "demo.role.partnerHint",
    icon: Handshake,
  },
  {
    id: "associate",
    labelKey: "demo.role.associate",
    hintKey: "demo.role.associateHint",
    icon: Briefcase,
  },
  {
    id: "employee",
    labelKey: "demo.role.employee",
    hintKey: "demo.role.employeeHint",
    icon: Scissors,
  },
  {
    id: "customer",
    labelKey: "demo.role.customer",
    hintKey: "demo.role.customerHint",
    icon: Smartphone,
  },
];

export function DemoRoleSelector() {
  const chrome = useDemoChrome();
  const { t } = useI18n();
  if (!chrome) return null;
  const { role, setRole } = chrome;

  return (
    <>
      {/* PC/Tablet: mesma família visual dos ícones do cabeçalho, em linha. */}
      <div
        className="app-demo-slot-desktop app-demo-switcher hidden md:flex"
        role="group"
        aria-label={t("demo.switcher.aria")}
      >
        {demoRoles.map((r) => {
          const Icon = r.icon;
          const active = role === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setRole(r.id)}
              title={t(r.hintKey)}
              aria-pressed={active}
              className="app-demo-switcher-option"
            >
              <Icon className="size-3.5" />
              <span className="app-demo-switcher-label">{t(r.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {/* Celular: um ícone igual aos do cabeçalho que abre a lista de perfis. */}
      <div className="app-demo-slot-mobile md:hidden">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t("demo.switcher.trigger")}
              data-active={role !== "platform" ? "true" : "false"}
              className="app-icon-button app-demo-trigger"
            >
              <FlaskConical size={20} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="z-[70] w-52 rounded-2xl border-border p-2 shadow-xl"
          >
            <div className="space-y-1">
              <p className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t("demo.switcher.title")}
              </p>
              {demoRoles.map((r) => {
                const Icon = r.icon;
                const active = role === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setRole(r.id)}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors ${
                      active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{t(r.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}

/** Menu sutil no ícone de perfil: ver perfil, trocar visão da demo e sair. */
export function DemoAccountMenu({
  onViewProfile,
}: {
  onViewProfile?: () => void;
} = {}) {
  const chrome = useDemoChrome();
  const { t, intlLocale } = useI18n();
  if (!chrome) return null;

  const { role, setRole, exit, state, dispatch } = chrome;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={t("demo.menu.trigger")} className="app-icon-button">
          <User size={20} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={10}
        collisionPadding={12}
        avoidCollisions
        aria-label={t("demo.menu.aria")}
        className="account-menu-popover z-[70] w-72 max-h-none max-w-[calc(100vw-24px)] overflow-visible rounded-2xl border-border p-2 shadow-xl"
      >
        <div className="space-y-1">
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold text-muted-foreground">
            {t("demo.menu.account")}
          </p>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-muted"
            onClick={() => {
              if (onViewProfile) onViewProfile();
              else chrome.requestOpenProfile();
            }}
          >
            <User className="size-4 text-gold" />
            {t("demo.menu.viewProfile")}
          </button>

          {role !== "platform" && (
            <>
              <div className="my-1 border-t border-border" />
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold text-muted-foreground">
                {t("demo.menu.tools")}
              </p>
              <div className="px-3 py-1 text-xs text-muted-foreground">
                {t("demo.menu.clock")}{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {formatShopDate(
                    state.now,
                    state.shop.timezone,
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                    intlLocale,
                  )}
                </span>
              </div>
              <div className="flex gap-1.5 px-2 pb-1">
                {[1, 5, 10].map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-border py-2 text-xs font-semibold hover:bg-muted"
                    onClick={() =>
                      dispatch({ type: "clock.advance", milliseconds: minutes * 60000 })
                    }
                  >
                    <Clock3 className="size-3.5" />+{minutes}
                  </button>
                ))}
              </div>
              {role === "customer" && (
                <label className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="font-semibold">{t("demo.menu.sports")}</span>
                  <Switch
                    checked={state.settings.sports_enabled}
                    onCheckedChange={(enabled) =>
                      dispatch({
                        type: "settings.save",
                        settings: { ...state.settings, sports_enabled: enabled },
                      })
                    }
                  />
                </label>
              )}
            </>
          )}

          <div className="my-1 border-t border-border" />
          <button
            type="button"
            onClick={exit}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-destructive hover:bg-destructive/10"
          >
            <LogOut className="size-4" />
            {t("demo.menu.exit")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
