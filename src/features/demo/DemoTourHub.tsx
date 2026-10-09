import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { FlaskConical, LogIn, ShieldCheck, Store, type LucideIcon } from "lucide-react";
import type { DemoRole } from "@/features/demo/chrome";
import { Hint, SectionHeader, StatusBadge } from "@/components/visual";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { DEMO_ROLES, type DemoRoleMeta } from "./roles";

export type DemoSceneId = DemoRole | "login";

type DemoTourHubProps = {
  shopId: string;
  disabled?: boolean;
  onPreviewLogin?: () => void;
  /** Dentro da demonstração: o toque troca a visão ali mesmo, sem sair da página. */
  onSelectRole?: (role: DemoRole) => void;
  /** Papel aberto agora (só dentro da demonstração). */
  activeRole?: DemoRole;
  /** Escolha da barbearia do teste, entre o cabeçalho e os botões. */
  children?: ReactNode;
  /** Aberto da ficha da barbearia: ao sair da demonstração, volta para a ficha. */
  returnToShop?: boolean;
  /** Sem a moldura de cartão (dentro de uma janela, que já tem título). */
  bare?: boolean;
};

const TILE =
  "flex h-full min-h-[4.5rem] w-full min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border px-1.5 py-2 text-center text-xs font-bold leading-tight transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";
const TILE_OFF =
  "border-border bg-background hover:border-primary/40 hover:bg-primary/5 aria-disabled:pointer-events-none aria-disabled:opacity-50 disabled:pointer-events-none disabled:opacity-50";
const TILE_ON = "border-primary bg-primary text-primary-foreground";

function TileIcon({ icon: Icon, on }: { icon: LucideIcon; on?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-9 place-items-center rounded-xl",
        on ? "bg-primary-foreground/15" : "bg-muted text-gold",
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}

function Group({
  labelKey,
  children,
  className,
}: {
  labelKey: MessageKey;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-1.5", className)}
      role="group"
      aria-label={t(labelKey)}
    >
      {/* Rótulo quebra de linha em vez de cortar; os botões ficam alinhados embaixo. */}
      <p className="break-words px-0.5 text-xs font-semibold leading-tight text-muted-foreground">
        {t(labelKey)}
      </p>
      <div className="mt-auto">{children}</div>
    </div>
  );
}

/**
 * "Testar como…": entra em qualquer visão com dados fictícios, sem mexer na operação real.
 * Um botão curto por papel, agrupado por quem é (cliente, equipe, plataforma, antes de entrar).
 * Os papéis vêm do mapa único (`roles.ts`), o mesmo do seletor no cabeçalho.
 */
export function DemoTourHub({
  shopId,
  disabled,
  onPreviewLogin,
  onSelectRole,
  activeRole,
  children,
  returnToShop = false,
  bare = false,
}: DemoTourHubProps) {
  const { t } = useI18n();
  const off = disabled || (!shopId && !onSelectRole);

  function roleTile(role: DemoRoleMeta) {
    const on = activeRole === role.id;
    const body = (
      <>
        <TileIcon icon={role.icon} on={on} />
        {/* "Dono · 100%" não parte no meio: o separador fica preso às palavras. */}
        <span className="break-words">{t(role.labelKey).replace(/ · /g, "\u00a0·\u00a0")}</span>
        {/* Visões de dono: o modo da sociedade como selo curto, como no painel. */}
        {role.modeKey && (
          <span
            className={cn(
              "break-words text-[0.6875rem] font-semibold leading-tight",
              on ? "text-primary-foreground/80" : "text-muted-foreground",
            )}
          >
            {t(role.modeKey)}
          </span>
        )}
      </>
    );
    if (onSelectRole) {
      return (
        <button
          type="button"
          aria-pressed={on}
          title={t(role.hintKey)}
          onClick={() => onSelectRole(role.id)}
          className={cn(TILE, on ? TILE_ON : TILE_OFF)}
        >
          {body}
        </button>
      );
    }
    return (
      <Link
        to="/demo"
        search={{
          shop: shopId || undefined,
          view: role.id,
          ...(returnToShop ? { volta: "ficha" as const } : {}),
        }}
        aria-disabled={off}
        title={t(role.hintKey)}
        onClick={(event) => {
          if (off) event.preventDefault();
        }}
        className={cn(TILE, TILE_OFF)}
      >
        {body}
      </Link>
    );
  }

  const byId = (id: DemoRole) => DEMO_ROLES.find((role) => role.id === id)!;
  const team = DEMO_ROLES.filter((role) => role.group === "team");

  return (
    <section
      className={cn("space-y-4", !bare && "rounded-3xl border border-border bg-card p-4 sm:p-5")}
    >
      {bare ? (
        <StatusBadge tone="success" icon={ShieldCheck} label={t("demo.hub.safe")} />
      ) : (
        <SectionHeader
          icon={FlaskConical}
          title={t("demo.hub.heading")}
          aside={<StatusBadge tone="success" icon={ShieldCheck} label={t("demo.hub.safe")} />}
        />
      )}

      {children}

      {off ? (
        <Hint icon={Store} tone="muted">
          {t("demo.hub.noShop")}
        </Hint>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Group labelKey="demo.hub.groupClient">{roleTile(byId("customer"))}</Group>
            <Group labelKey="demo.hub.groupPlatform">{roleTile(byId("platform"))}</Group>
            <Group labelKey="demo.hub.groupBefore">
              <button
                type="button"
                disabled={!onPreviewLogin}
                onClick={onPreviewLogin}
                title={t("demo.scene.loginHint")}
                className={cn(TILE, TILE_OFF, "relative")}
              >
                <TileIcon icon={LogIn} />
                <span className="break-words">{t("demo.hub.login")}</span>
                <StatusBadge
                  tone="neutral"
                  icon={null}
                  label={t("demo.hub.preview")}
                  size="sm"
                  className="absolute -top-2 end-1"
                />
              </button>
            </Group>
          </div>
          <Group labelKey="demo.hub.groupTeam">
            {/* Na janela ("Testar como…") a largura é a da janela, não a da tela: até 3 colunas. */}
            <div
              className={cn(
                "grid grid-cols-2 gap-2 min-[360px]:grid-cols-3",
                !bare && "sm:grid-cols-5",
              )}
            >
              {team.map((role) => (
                <div key={role.id} className="h-full">
                  {roleTile(role)}
                </div>
              ))}
            </div>
          </Group>
        </div>
      )}
    </section>
  );
}
