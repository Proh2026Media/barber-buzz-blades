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

const demoRoles: {
  id: DemoRole;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  { id: "platform", label: "Global", hint: "Painel da plataforma", icon: Shield },
  { id: "owner", label: "Dono", hint: "Gestão completa da loja", icon: Building2 },
  { id: "partner", label: "Sócio", hint: "Visão gerencial", icon: Handshake },
  { id: "associate", label: "Parceiro", hint: "Operação e valores próprios", icon: Briefcase },
  { id: "employee", label: "Contrat.", hint: "Agenda e score", icon: Scissors },
  { id: "customer", label: "Cliente", hint: "App do cliente", icon: Smartphone },
];

export function DemoRoleSelector() {
  const chrome = useDemoChrome();
  if (!chrome) return null;
  const { role, setRole } = chrome;

  return (
    <>
      {/* PC/Tablet: mesma família visual dos ícones do cabeçalho, em linha. */}
      <div
        className="app-demo-slot-desktop app-demo-switcher hidden md:flex"
        role="group"
        aria-label="Trocar perfil da demonstração"
      >
        {demoRoles.map((r) => {
          const Icon = r.icon;
          const active = role === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setRole(r.id)}
              title={r.hint}
              aria-pressed={active}
              className="app-demo-switcher-option"
            >
              <Icon className="size-3.5" />
              <span className="app-demo-switcher-label">{r.label}</span>
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
              aria-label="Modo demonstração"
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
                Modo demo
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
                    <span>{r.label}</span>
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
  if (!chrome) return null;

  const { role, setRole, exit, state, dispatch } = chrome;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Conta e demonstração" className="app-icon-button">
          <User size={20} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={10}
        collisionPadding={12}
        avoidCollisions
        aria-label="Conta da demonstração"
        className="account-menu-popover z-[70] w-72 max-h-none max-w-[calc(100vw-24px)] overflow-visible rounded-2xl border-border p-2 shadow-xl"
      >
        <div className="space-y-1">
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold text-muted-foreground">Conta</p>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-muted"
            onClick={() => {
              if (onViewProfile) onViewProfile();
              else chrome.requestOpenProfile();
            }}
          >
            <User className="size-4 text-gold" />
            Ver perfil
          </button>

          {role !== "platform" && (
            <>
              <div className="my-1 border-t border-border" />
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold text-muted-foreground">
                Ferramentas
              </p>
              <div className="px-3 py-1 text-xs text-muted-foreground">
                Relógio:{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {formatShopDate(state.now, state.shop.timezone, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
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
                  <span className="font-semibold">Esportes</span>
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
            Sair
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
