import { useId, useState } from "react";
import {
  CalendarCheck,
  CalendarX,
  CheckCircle2,
  FlaskConical,
  Globe2,
  KeyRound,
  LayoutGrid,
  Palette,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  Star,
  Trophy,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  ConfirmDialog,
  CopyField,
  Hint,
  Notice,
  PersonAvatar,
  SectionHeader,
  SettingRow,
  StatTile,
  StatusBadge,
  Tag,
  readableLink,
  type ActionState,
} from "@/components/visual";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";
import { shopPublicOrigin } from "@/lib/shop/host";
import { AccountManagersPanel } from "./AccountManagersPanel";
import { ShopTeamList } from "./ShopTeamList";
import { DEFAULT_TIMEZONE, SHOP_STATUS, friendlyTimeZone, type ShopCounts } from "./shopStats";

export type ShopModule = "sports" | "loyalty";

type ShopDetailProps = {
  shop: Tables<"barbershops">;
  shops: Tables<"barbershops">[];
  counts: ShopCounts;
  sports: boolean;
  loyalty: boolean;
  demoMode?: boolean;
  headingId?: string;
  /** Grava o módulo; rejeita se não salvou (a linha mostra o erro e o "Tentar de novo"). */
  onSetModule: (module: ShopModule, enabled: boolean) => Promise<void>;
  onCustomize: () => void;
  /** Suspende ou reativa; rejeita se não salvou (o erro aparece dentro da janela). */
  onToggleStatus: () => Promise<void>;
  onAddPerson: () => void;
  onPermissions: () => void;
  onTestAs: () => void;
  /** Muda depois de adicionar alguém: recarrega a equipe. */
  teamRevision?: number;
};

const SECONDARY =
  "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition";

/**
 * Ficha da barbearia: tudo o que é dela num lugar só — situação, link, números, módulos,
 * pessoas (administradores e gerentes), atalhos e, separado no fim, suspender/reativar.
 */
export function ShopDetail({
  shop,
  shops,
  counts,
  sports,
  loyalty,
  demoMode = false,
  headingId,
  onSetModule,
  onCustomize,
  onToggleStatus,
  onAddPerson,
  onPermissions,
  onTestAs,
  teamRevision = 0,
}: ShopDetailProps) {
  const { t, intlLocale } = useI18n();
  const sportsId = useId();
  const loyaltyId = useId();
  const [moduleState, setModuleState] = useState<Record<ShopModule, ActionState | null>>({
    sports: null,
    loyalty: null,
  });
  const [desired, setDesired] = useState<Partial<Record<ShopModule, boolean>>>({});
  const [confirmLoyaltyOff, setConfirmLoyaltyOff] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(false);
  // Donos e sócios ativos da equipe (decisão 12: "sem administrador" é não ter nenhum). Até a
  // equipe carregar, vale a contagem antiga.
  const [teamOwners, setTeamOwners] = useState<number | null>(null);
  const admins = teamOwners ?? counts.admins;
  const status = SHOP_STATUS[shop.status];
  const active = shop.status === "active";
  const url = shopPublicOrigin({
    slug: shop.slug,
    customDomain: shop.custom_domain,
    customDomainStatus: shop.custom_domain_status,
  });

  async function runModule(module: ShopModule, enabled: boolean) {
    setDesired((current) => ({ ...current, [module]: enabled }));
    setModuleState((current) => ({ ...current, [module]: "saving" }));
    try {
      await onSetModule(module, enabled);
      setModuleState((current) => ({ ...current, [module]: "saved" }));
      window.setTimeout(
        () =>
          setModuleState((current) =>
            current[module] === "saved" ? { ...current, [module]: null } : current,
          ),
        2000,
      );
    } catch {
      setModuleState((current) => ({ ...current, [module]: "error" }));
    } finally {
      setDesired((current) => ({ ...current, [module]: undefined }));
    }
  }

  function moduleRow(
    module: ShopModule,
    id: string,
    value: boolean,
    icon: typeof Trophy,
    title: string,
  ) {
    const state = moduleState[module];
    const shown = desired[module] ?? value;
    return (
      <SettingRow
        icon={icon}
        title={title}
        controlId={id}
        status={state}
        statusText={
          state === "saved"
            ? t("plat.shop.saved")
            : state === "error"
              ? t("plat.shop.notSaved")
              : undefined
        }
        onRetry={() => void runModule(module, !value)}
        control={
          <Switch
            id={id}
            checked={shown}
            disabled={state === "saving"}
            onCheckedChange={(enabled) => {
              if (module === "loyalty" && !enabled) setConfirmLoyaltyOff(true);
              else void runModule(module, enabled);
            }}
          />
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <PersonAvatar name={shop.name} size="md" seed={shop.id} />
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="break-words text-lg font-bold leading-tight">
            {shop.name}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge
              tone={status.tone}
              icon={status.icon}
              label={active ? t("plat.shops.active") : t("plat.shops.suspended")}
            />
            {shop.timezone && shop.timezone !== DEFAULT_TIMEZONE && (
              <Tag icon={Globe2}>{friendlyTimeZone(shop.timezone, intlLocale)}</Tag>
            )}
          </div>
        </div>
      </div>

      <CopyField value={url} display={readableLink(url)} label={t("plat.shop.link")} href={url} />

      <div className="grid grid-cols-2 gap-2">
        <StatTile icon={Users} label={t("plat.dash.customers")} value={counts.customers} />
        <StatTile
          icon={ShieldCheck}
          tone={admins === 0 ? "warning" : undefined}
          label={t("plat.dash.admins")}
          value={admins}
          hint={admins === 0 ? t("plat.shops.noAdmin") : undefined}
        />
      </div>

      <button
        type="button"
        onClick={onCustomize}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
      >
        <Palette className="size-4" aria-hidden />
        {t("plat.shops.customize")}
      </button>

      <section className="space-y-2">
        <SectionHeader as="h4" icon={LayoutGrid} title={t("plat.shop.modules")} />
        <div className="divide-y divide-border rounded-2xl border border-border bg-background px-3">
          {moduleRow("sports", sportsId, sports, Trophy, t("plat.shop.sports"))}
          {moduleRow("loyalty", loyaltyId, loyalty, Star, t("plat.shops.loyalty"))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader
          as="h4"
          icon={Users}
          title={t("plat.shop.people")}
          aside={
            <button
              type="button"
              onClick={onAddPerson}
              disabled={!active}
              className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-semibold transition hover:border-primary/40 disabled:opacity-50"
            >
              <UserPlus className="size-4 text-gold" aria-hidden />
              {t("plat.shop.addPerson")}
            </button>
          }
        />
        {admins === 0 && active && (
          <Notice tone="warning" role="none" title={t("plat.shop.noAdminNotice")} />
        )}
        {/* Quem é a equipe: nome, papel e a parte de cada dono. */}
        <ShopTeamList shopId={shop.id} revision={teamRevision} onLoaded={setTeamOwners} />
        {!active && (
          <Hint icon={PauseCircle} tone="neutral">
            {t("plat.shop.reactivateToAdd")}
          </Hint>
        )}
        {!demoMode && <AccountManagersPanel shops={shops} shopId={shop.id} disabled={!active} />}
      </section>

      <section className="divide-y divide-border rounded-2xl border border-border bg-background px-1">
        <SettingRow
          icon={KeyRound}
          title={t("plat.shop.permissions")}
          description={t("plat.shop.permissionsHint")}
          onClick={onPermissions}
        />
        <SettingRow
          icon={FlaskConical}
          title={t("plat.shop.testAs")}
          description={t("plat.shop.testAsHint")}
          onClick={onTestAs}
        />
      </section>

      <div className="border-t border-border pt-4">
        <button
          type="button"
          onClick={() => setConfirmStatus(true)}
          className={`${SECONDARY} ${
            active
              ? "border-destructive/40 bg-background text-destructive hover:bg-destructive/5"
              : "border-border bg-background hover:border-primary/40"
          }`}
        >
          {active ? (
            <PauseCircle className="size-4" aria-hidden />
          ) : (
            <PlayCircle className="size-4 text-gold" aria-hidden />
          )}
          {active ? t("plat.status.suspendConfirm") : t("plat.status.reactivateConfirm")}
        </button>
      </div>

      <ConfirmDialog
        open={confirmLoyaltyOff}
        onOpenChange={setConfirmLoyaltyOff}
        tone="warning"
        icon={Star}
        title={t("plat.shop.loyaltyOffTitle", { name: shop.name })}
        consequences={[
          {
            key: "pause",
            icon: PauseCircle,
            tone: "neutral",
            text: t("plat.shop.loyaltyOffPause"),
          },
          { key: "keep", icon: ShieldCheck, tone: "success", text: t("plat.shop.loyaltyOffKeep") },
        ]}
        confirmLabel={t("plat.shop.loyaltyOffConfirm")}
        cancelLabel={t("plat.shop.loyaltyKeep")}
        onConfirm={() => {
          void runModule("loyalty", false);
        }}
      />

      <ConfirmDialog
        open={confirmStatus}
        onOpenChange={setConfirmStatus}
        tone={active ? "danger" : "info"}
        icon={active ? PauseCircle : PlayCircle}
        title={
          active
            ? t("plat.status.suspendTitle", { name: shop.name })
            : t("plat.status.reactivateTitle", { name: shop.name })
        }
        consequences={
          active
            ? [
                { key: "link", icon: XCircle, tone: "danger", text: t("plat.status.lossLink") },
                {
                  key: "booking",
                  icon: CalendarX,
                  tone: "danger",
                  text: t("plat.status.lossBooking"),
                  detail:
                    counts.customers > 0
                      ? t(
                          counts.customers === 1
                            ? "plat.status.affectedOne"
                            : "plat.status.affectedMany",
                          { count: counts.customers.toLocaleString(intlLocale) },
                        )
                      : undefined,
                },
                {
                  key: "data",
                  icon: ShieldCheck,
                  tone: "success",
                  text: t("plat.status.keepData"),
                },
              ]
            : [
                {
                  key: "link",
                  icon: CheckCircle2,
                  tone: "success",
                  text: t("plat.status.backLink"),
                },
                {
                  key: "booking",
                  icon: CalendarCheck,
                  tone: "success",
                  text: t("plat.status.backBooking"),
                },
              ]
        }
        confirmLabel={active ? t("plat.status.suspendConfirm") : t("plat.status.reactivateConfirm")}
        busyLabel={t("plat.common.saving")}
        confirmIcon={active ? PauseCircle : PlayCircle}
        cancelLabel={active ? t("plat.status.keepActive") : t("plat.status.keepSuspended")}
        errorText={active ? t("plat.status.suspendError") : t("plat.status.reactivateError")}
        onConfirm={onToggleStatus}
      />
    </div>
  );
}
