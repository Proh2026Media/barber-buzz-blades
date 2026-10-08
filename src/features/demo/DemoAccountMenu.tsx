import { useId } from "react";
import { Check, Clock3, DoorOpen, FlaskConical, Trophy, User } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Hint } from "@/components/visual";
import { useDemoChrome } from "./chrome";
import { DEMO_ROLES } from "./roles";
import { formatShopDate } from "@/lib/shop/appointments";
import { useI18n } from "@/lib/i18n";

export function DemoRoleSelector() {
  const chrome = useDemoChrome();
  const { t } = useI18n();
  if (!chrome) return null;
  const { role, setRole } = chrome;

  return (
    <>
      {/* PC: mesma família visual dos ícones do cabeçalho, em linha, com rótulos. */}
      <div
        className="app-demo-slot-desktop app-demo-switcher hidden lg:flex"
        role="group"
        aria-label={t("demo.switcher.aria")}
      >
        {DEMO_ROLES.map((r) => {
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

      {/* Celular e tablet: um ícone igual aos do cabeçalho que abre a lista de perfis (alvos de 44px).
          Abaixo de 360 px o ícone sai e o "Ver como" passa para o menu de conta, para o nome da
          barbearia continuar legível no cabeçalho. */}
      <div className="app-demo-slot-mobile max-[359px]:hidden lg:hidden">
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
            collisionPadding={12}
            className="z-[70] w-72 max-w-[calc(100vw-24px)] rounded-2xl border-border p-2 shadow-xl"
          >
            <div className="space-y-1">
              <p className="flex items-center gap-2 px-3 pb-1 pt-1 text-xs font-semibold text-muted-foreground">
                <FlaskConical className="size-3.5 text-gold" aria-hidden />
                {t("demo.switcher.heading")}
              </p>
              {DEMO_ROLES.map((r) => {
                const Icon = r.icon;
                const active = role === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    aria-pressed={active}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                      active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    <Icon className={`size-4 shrink-0 ${active ? "" : "text-gold"}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{t(r.labelKey)}</span>
                      <span
                        className={`block text-xs ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                      >
                        {t(r.hintKey)}
                      </span>
                    </span>
                    {active && <Check className="size-4 shrink-0" aria-hidden />}
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

/** Menu do ícone de perfil: ver perfil do cliente, ferramentas da demonstração e sair dela. */
export function DemoAccountMenu({
  onViewProfile,
}: {
  onViewProfile?: () => void;
} = {}) {
  const chrome = useDemoChrome();
  const { t, intlLocale } = useI18n();
  const sportsId = useId();
  if (!chrome) return null;

  const { role, exit, state, dispatch } = chrome;
  const item =
    "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-muted";

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
        className="account-menu-popover z-[70] w-72 max-h-none max-w-[calc(100vw-24px)] overflow-visible rounded-2xl border-border p-2 shadow-xl max-[359px]:max-h-[var(--radix-popover-content-available-height)]! max-[359px]:overflow-y-auto!"
      >
        <div className="space-y-1">
          {/* Celular estreito (< 360 px): o seletor de papel do cabeçalho mora aqui. */}
          <div className="min-[360px]:hidden">
            <p className="flex items-center gap-2 px-3 pb-1 pt-2 text-xs font-semibold text-muted-foreground">
              <FlaskConical className="size-3.5 text-gold" aria-hidden />
              {t("demo.switcher.heading")}
            </p>
            <div
              role="group"
              aria-label={t("demo.switcher.aria")}
              className="grid grid-cols-2 gap-1.5 px-2 pb-1"
            >
              {DEMO_ROLES.map((r) => {
                const Icon = r.icon;
                const active = role === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => chrome.setRole(r.id)}
                    aria-pressed={active}
                    title={t(r.hintKey)}
                    className={`flex min-h-11 min-w-0 items-center gap-2 rounded-xl border px-2.5 text-left text-xs font-semibold transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <Icon className={`size-4 shrink-0 ${active ? "" : "text-gold"}`} aria-hidden />
                    <span className="min-w-0 flex-1 break-words leading-tight">
                      {t(r.labelKey)}
                    </span>
                    {active && <Check className="size-3.5 shrink-0" aria-hidden />}
                  </button>
                );
              })}
            </div>
            <div className="my-1 border-t border-border" />
          </div>
          {/* No papel Plataforma não há perfil próprio: "Ver perfil" levaria ao app do cliente. */}
          {role !== "platform" && (
            <>
              <p className="px-3 pb-1 pt-2 text-xs font-semibold text-muted-foreground">
                {t("demo.menu.account")}
              </p>
              <button
                type="button"
                className={item}
                onClick={() => {
                  if (onViewProfile) onViewProfile();
                  else chrome.requestOpenProfile();
                }}
              >
                <User className="size-4 text-gold" aria-hidden />
                {role === "customer" ? t("demo.menu.viewProfile") : t("demo.menu.viewCustomer")}
              </button>
            </>
          )}

          {role !== "platform" && (
            <>
              <div className="my-1 border-t border-border" />
              <p className="flex items-center gap-2 px-3 pb-1 pt-2 text-xs font-semibold text-muted-foreground">
                <Clock3 className="size-3.5 text-gold" aria-hidden />
                {t("demo.menu.clockTitle")}
                <span className="ms-auto font-bold tabular-nums text-foreground">
                  {formatShopDate(
                    state.now,
                    state.shop.timezone,
                    { hour: "2-digit", minute: "2-digit" },
                    intlLocale,
                  )}
                </span>
              </p>
              <div className="flex gap-1.5 px-2 pb-1">
                {[1, 5, 10].map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    aria-label={t("demo.menu.advanceAria", { minutes })}
                    className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border text-xs font-semibold tabular-nums hover:bg-muted"
                    onClick={() =>
                      dispatch({ type: "clock.advance", milliseconds: minutes * 60000 })
                    }
                  >
                    {t("demo.menu.advance", { minutes })}
                  </button>
                ))}
              </div>
              <Hint icon={Clock3} className="px-3 pb-1">
                {t("demo.menu.clockHint")}
              </Hint>
              {role === "customer" && (
                <label
                  htmlFor={sportsId}
                  className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm"
                >
                  <Trophy className="size-4 shrink-0 text-gold" aria-hidden />
                  <span className="min-w-0 flex-1 font-semibold">
                    {t("demo.menu.sportsModule")}
                  </span>
                  <Switch
                    id={sportsId}
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

          {role !== "platform" && <div className="my-1 border-t border-border" />}
          <button type="button" onClick={exit} className={item}>
            <DoorOpen className="size-4 text-muted-foreground" aria-hidden />
            {t("demo.menu.leave")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
