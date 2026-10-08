import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Check,
  Clock3,
  EyeOff,
  KeyRound,
  Landmark,
  Lock,
  Minus,
  RefreshCw,
  Scissors,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  ChoiceChips,
  EmptyState,
  Hint,
  LoadingState,
  MoreDetails,
  SectionHeader,
  StatusBadge,
  UnsavedBar,
  type ActionState,
} from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import { t as tNow, useI18n, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ROLE_META } from "./roles";

type PermissionMeta = {
  permission: string;
  label: string;
  description: string;
  sort_order: number;
};

type Matrix = Record<string, Record<string, boolean>>;

type PermissionsPayload = {
  catalog: PermissionMeta[];
  roles: string[];
  matrix: Matrix;
};

type RoleId = "owner" | "partner" | "associate" | "employee";

// Ícones do mapa único de papéis (ROLE_META): o mesmo do selo do cabeçalho e da equipe.
const ROLES: { id: RoleId; label: MessageKey; icon: LucideIcon }[] = [
  { id: "associate", label: "eq.role.associate", icon: ROLE_META.associate.icon },
  { id: "employee", label: "eq.role.employee", icon: ROLE_META.employee.icon },
  { id: "owner", label: "eq.role.owner", icon: ROLE_META.owner.icon },
  { id: "partner", label: "eq.perm.legacyOwner", icon: ROLE_META.partner.icon },
];

const SERVICES = { manageAll: "manage_services", manageOwn: "manage_own_services" } as const;
type ServiceLevel = "view" | "own" | "all";

/** Texto curto e ícone de cada permissão; o texto do banco fica como alternativa. */
const PERMISSION: Record<string, { label: MessageKey; hint: MessageKey; icon: LucideIcon }> = {
  view_agenda_all: {
    label: "eq.perm.view_agenda_all",
    hint: "eq.perm.view_agenda_allHint",
    icon: CalendarDays,
  },
  view_money: { label: "eq.perm.view_money", hint: "eq.perm.view_moneyHint", icon: Wallet },
  view_financial_all: {
    label: "eq.perm.view_financial_all",
    hint: "eq.perm.view_financial_allHint",
    icon: Landmark,
  },
  view_reports_global: {
    label: "eq.perm.view_reports_global",
    hint: "eq.perm.view_reports_globalHint",
    icon: BarChart3,
  },
  view_reports_anonymized: {
    label: "eq.perm.view_reports_anonymized",
    hint: "eq.perm.view_reports_anonymizedHint",
    icon: EyeOff,
  },
  view_own_score: {
    label: "eq.perm.view_own_score",
    hint: "eq.perm.view_own_scoreHint",
    icon: TrendingUp,
  },
  manage_services: {
    label: "eq.perm.services",
    hint: "eq.perm.servicesHint",
    icon: Scissors,
  },
  manage_own_services: {
    label: "eq.perm.services",
    hint: "eq.perm.servicesHint",
    icon: Scissors,
  },
  manage_operations: {
    label: "eq.perm.manage_operations",
    hint: "eq.perm.manage_operationsHint",
    icon: Clock3,
  },
  manage_team: { label: "eq.perm.manage_team", hint: "eq.perm.manage_teamHint", icon: Users },
  manage_permissions: {
    label: "eq.perm.manage_permissions",
    hint: "eq.perm.manage_permissionsHint",
    icon: KeyRound,
  },
};

/** Grupos: agenda, dinheiro e relatórios, gestão. "services" é a linha de 3 níveis. */
const GROUPS: { id: string; title: MessageKey; icon: LucideIcon; rows: string[] }[] = [
  { id: "agenda", title: "eq.perm.group.agenda", icon: CalendarDays, rows: ["view_agenda_all"] },
  {
    id: "money",
    title: "eq.perm.group.money",
    icon: Wallet,
    rows: [
      "view_money",
      "view_financial_all",
      "view_reports_global",
      "view_reports_anonymized",
      "view_own_score",
    ],
  },
  {
    id: "manage",
    title: "eq.perm.group.manage",
    icon: Settings2,
    rows: ["services", "manage_operations", "manage_team", "manage_permissions"],
  },
];

/** O dono sempre pode mudar as permissões (senão ninguém mais poderia). */
const isLocked = (role: string, permission: string) =>
  role === "owner" && permission === "manage_permissions";

/**
 * Permissões fictícias da demonstração (sem servidor): catálogo a partir dos textos
 * traduzidos e uma matriz padrão coerente com a hierarquia.
 */
function demoPermissions(): PermissionsPayload {
  const keys = Object.keys(PERMISSION);
  const catalog = keys.map((permission, index) => ({
    permission,
    label: tNow(PERMISSION[permission]!.label),
    description: tNow(PERMISSION[permission]!.hint),
    sort_order: index,
  }));
  const only = (allowed: string[]) =>
    Object.fromEntries(keys.map((key) => [key, allowed.includes(key)]));
  return {
    catalog,
    roles: ROLES.map((role) => role.id),
    matrix: {
      owner: only(keys),
      partner: only(keys.filter((key) => key !== "manage_permissions")),
      associate: only(["view_own_score", "manage_own_services"]),
      employee: only(["view_own_score"]),
    },
  };
}

function serviceLevelFor(matrix: Matrix, role: string): ServiceLevel {
  const row = matrix[role] ?? {};
  if (row[SERVICES.manageAll]) return "all";
  if (row[SERVICES.manageOwn]) return "own";
  return "view";
}

/**
 * Quantas escolhas mudaram entre o salvo e o rascunho (para "2 mudanças não salvas"). As duas
 * chaves de serviços são um único controle (Só ver / Os seus / Todos): contam como uma mudança.
 */
function countChanges(saved: Matrix, draft: Matrix) {
  let count = 0;
  const serviceKeys = new Set<string>([SERVICES.manageAll, SERVICES.manageOwn]);
  for (const role of Object.keys(draft)) {
    for (const key of Object.keys(draft[role] ?? {})) {
      if (serviceKeys.has(key)) continue;
      if ((saved[role]?.[key] ?? false) !== (draft[role]?.[key] ?? false)) count += 1;
    }
    if (serviceLevelFor(saved, role) !== serviceLevelFor(draft, role)) count += 1;
  }
  return count;
}

type ShopPermissionsMatrixProps = {
  shopId: string;
  /** Se false, só leitura. */
  canEdit?: boolean;
  title?: string;
  description?: string;
  /** Demonstração: usa permissões fictícias e não chama o servidor. */
  demo?: boolean;
  /** Mostra o papel antigo de dono ("partner") quando alguém ainda o tem. */
  showLegacy?: boolean;
};

export function ShopPermissionsMatrix({
  shopId,
  canEdit = true,
  title: titleProp,
  description: descriptionProp,
  demo = false,
  showLegacy = false,
}: ShopPermissionsMatrixProps) {
  const { t } = useI18n();
  const title = titleProp ?? t("eq.perm.title");
  const description =
    descriptionProp ?? (canEdit ? t("eq.perm.description") : t("eq.perm.descriptionReadOnly"));
  const [catalog, setCatalog] = useState<PermissionMeta[]>([]);
  const [saved, setSaved] = useState<Matrix>({});
  const [matrix, setMatrix] = useState<Matrix>({});
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<ActionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<RoleId>("associate");

  const load = useCallback(
    async (target: string) => {
      if (!target) return;
      if (demo) {
        const payload = demoPermissions();
        setError(null);
        setCatalog(payload.catalog);
        setMatrix(payload.matrix);
        setSaved(payload.matrix);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data, error: failure } = await supabase.rpc("get_shop_permissions", {
          p_shop_id: target,
        });
        if (failure) throw failure;
        const payload = data as unknown as PermissionsPayload | null;
        if (!payload || typeof payload !== "object" || !payload.matrix) {
          throw new Error("invalid");
        }
        setCatalog(Array.isArray(payload.catalog) ? payload.catalog : []);
        setMatrix(payload.matrix);
        setSaved(payload.matrix);
      } catch {
        setCatalog([]);
        setMatrix({});
        setSaved({});
        setError(tNow("team.perm.loadError"));
      } finally {
        setLoading(false);
      }
    },
    [demo],
  );

  useEffect(() => {
    void load(shopId);
  }, [load, shopId]);

  const known = useMemo(() => new Set(catalog.map((entry) => entry.permission)), [catalog]);
  const hasServices = known.has(SERVICES.manageAll) || known.has(SERVICES.manageOwn);
  // Permissões novas do banco, ainda sem grupo: entram em "Outras" com o texto do banco.
  const extras = catalog.filter(
    (entry) =>
      !GROUPS.some((group) => group.rows.includes(entry.permission)) &&
      entry.permission !== SERVICES.manageAll &&
      entry.permission !== SERVICES.manageOwn,
  );
  const roles = ROLES.filter((item) => item.id !== "partner" || showLegacy);
  const changes = countChanges(saved, matrix);

  const togglePermission = (permission: string, value: boolean) => {
    if (!canEdit) return;
    setMatrix((current) => ({
      ...current,
      [role]: { ...(current[role] ?? {}), [permission]: value },
    }));
    setState(null);
  };

  const setServiceLevel = (level: ServiceLevel) => {
    if (!canEdit) return;
    setMatrix((current) => ({
      ...current,
      [role]: {
        ...(current[role] ?? {}),
        [SERVICES.manageAll]: level === "all",
        [SERVICES.manageOwn]: level === "own" || level === "all",
      },
    }));
    setState(null);
  };

  async function handleSave() {
    if (!shopId || state === "saving" || !canEdit) return;
    if (demo) {
      setSaved(matrix);
      setState("saved");
      return;
    }
    setState("saving");
    try {
      const { data, error: failure } = await supabase.rpc("save_shop_permissions", {
        p_shop_id: shopId,
        p_matrix: matrix,
      });
      if (failure) throw failure;
      const payload = data as unknown as PermissionsPayload | null;
      if (payload?.matrix) {
        setCatalog(Array.isArray(payload.catalog) ? payload.catalog : []);
        setMatrix(payload.matrix);
        setSaved(payload.matrix);
      } else setSaved(matrix);
      setState("saved");
    } catch {
      setState("error");
    }
  }

  const roleLabel = (id: string) =>
    t(ROLES.find((item) => item.id === id)?.label ?? "eq.role.employee");
  const textOf = (permission: string) => {
    const meta = PERMISSION[permission];
    const entry = catalog.find((row) => row.permission === permission);
    return {
      label: meta ? t(meta.label) : (entry?.label ?? permission),
      hint: meta ? t(meta.hint) : (entry?.description ?? ""),
      icon: meta?.icon ?? SlidersHorizontal,
    };
  };

  const YesNo = ({ on, label }: { on: boolean; label: string }) =>
    on ? (
      <StatusBadge tone="success" icon={Check} variant="icon" label={label} />
    ) : (
      <StatusBadge tone="neutral" icon={Minus} variant="icon" label={label} />
    );

  const levelLabel = (level: ServiceLevel) => t(`eq.perm.level.${level}` as MessageKey);

  const renderRow = (permission: string) => {
    if (permission === "services") {
      if (!hasServices) return null;
      const level = serviceLevelFor(matrix, role);
      const text = textOf(SERVICES.manageAll);
      return (
        <li key="services" className="space-y-2 py-3">
          <div className="flex items-start gap-3">
            <text.icon className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{text.label}</p>
              <p className="text-xs text-muted-foreground">{text.hint}</p>
            </div>
            {!canEdit && (
              <StatusBadge
                tone={level === "view" ? "neutral" : "success"}
                icon={level === "view" ? Minus : Check}
                size="sm"
                label={levelLabel(level)}
              />
            )}
          </div>
          {canEdit && (
            <ChoiceChips
              label={t("eq.perm.servicesFor", { role: roleLabel(role) })}
              hideLabel
              value={level}
              onChange={setServiceLevel}
              disabled={state === "saving"}
              options={(["view", "own", "all"] as const).map((value) => ({
                value,
                label: levelLabel(value),
              }))}
              className="ps-8"
            />
          )}
        </li>
      );
    }
    if (!known.has(permission)) return null;
    const text = textOf(permission);
    const on = matrix[role]?.[permission] ?? false;
    const locked = isLocked(role, permission);
    const id = `perm-${role}-${permission}`;
    return (
      <li key={permission} className="flex items-center gap-3 py-3">
        <text.icon className="size-5 shrink-0 self-start text-gold" aria-hidden />
        <label htmlFor={canEdit && !locked ? id : undefined} className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{text.label}</span>
          {text.hint && <span className="block text-xs text-muted-foreground">{text.hint}</span>}
          {locked && (
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <Lock className="size-3.5" aria-hidden />
              {t("eq.perm.alwaysOwner")}
            </span>
          )}
        </label>
        {canEdit && !locked ? (
          <Switch
            id={id}
            checked={on}
            disabled={state === "saving"}
            onCheckedChange={(value) => togglePermission(permission, value)}
          />
        ) : (
          <YesNo
            on={on}
            label={t(on ? "eq.perm.can" : "eq.perm.cannot", { permission: text.label })}
          />
        )}
      </li>
    );
  };

  const compareRows = [
    ...(hasServices ? ["services"] : []),
    ...GROUPS.flatMap((group) => group.rows).filter((row) => row !== "services" && known.has(row)),
    ...extras.map((entry) => entry.permission),
  ];

  return (
    <div className="space-y-4">
      <SectionHeader as="h3" icon={ShieldCheck} title={title} description={description} />
      {!canEdit && (
        <Hint icon={Lock} tone="muted">
          {t("eq.perm.readOnly")}
        </Hint>
      )}

      {loading ? (
        <LoadingState variant="lines" count={4} label={t("eq.perm.loading")} />
      ) : error ? (
        <EmptyState
          variant="plain"
          status="danger"
          title={t("eq.common.loadFailed")}
          description={error}
          action={
            <button
              type="button"
              onClick={() => void load(shopId)}
              className="action-button min-h-11"
            >
              <RefreshCw className="size-4" aria-hidden />
              {t("eq.common.retry")}
            </button>
          }
        />
      ) : catalog.length === 0 ? (
        <EmptyState variant="plain" tone="people" title={t("team.perm.empty")} />
      ) : (
        <>
          <ChoiceChips
            label={t("eq.perm.chooseRole")}
            options={roles.map((item) => ({
              value: item.id,
              label: t(item.label),
              icon: item.icon,
            }))}
            value={role}
            onChange={setRole}
          />

          <div className="space-y-4">
            {GROUPS.map((group) => {
              const rows = group.rows.map(renderRow).filter(Boolean);
              if (!rows.length) return null;
              return (
                <section
                  key={group.id}
                  aria-labelledby={`perm-group-${group.id}`}
                  className="rounded-2xl border border-border bg-background/70 px-3"
                >
                  <h4
                    id={`perm-group-${group.id}`}
                    className="flex items-center gap-2 border-b border-border/60 py-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground"
                  >
                    <group.icon className="size-4" aria-hidden />
                    {t(group.title)}
                  </h4>
                  <ul className="divide-y divide-border/60">{rows}</ul>
                </section>
              );
            })}
            {extras.length > 0 && (
              <section className="rounded-2xl border border-border bg-background/70 px-3">
                <h4 className="flex items-center gap-2 border-b border-border/60 py-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <SlidersHorizontal className="size-4" aria-hidden />
                  {t("eq.perm.group.other")}
                </h4>
                <ul className="divide-y divide-border/60">
                  {extras.map((entry) => renderRow(entry.permission))}
                </ul>
              </section>
            )}
          </div>

          {/* Comparar papéis: no celular, um bloco por papel com cada permissão em pílula ✓ / —;
              do tablet para cima, a tabela lado a lado. */}
          <MoreDetails summary={t("eq.perm.compare")}>
            <ul className="space-y-3 sm:hidden">
              {roles.map((item) => {
                const allows = (permission: string) =>
                  permission === "services"
                    ? serviceLevelFor(matrix, item.id) !== "view"
                    : (matrix[item.id]?.[permission] ?? false);
                const allowed = compareRows.filter(allows).length;
                // O que o papel pode fazer vem primeiro; o que não pode, depois.
                const ordered = [
                  ...compareRows.filter(allows),
                  ...compareRows.filter((permission) => !allows(permission)),
                ];
                return (
                  <li
                    key={item.id}
                    className="space-y-2.5 rounded-2xl border border-border bg-background/70 p-3"
                  >
                    <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <item.icon className="size-5 shrink-0 text-gold" aria-hidden />
                      <span className="min-w-0 flex-1">{t(item.label)}</span>
                      <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                        {t("eq.perm.compareCount", { count: allowed, total: compareRows.length })}
                      </span>
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {ordered.map((permission) => {
                        if (permission === "services") {
                          const level = serviceLevelFor(matrix, item.id);
                          const text = textOf(SERVICES.manageAll);
                          return (
                            <li key={permission} className="max-w-full">
                              <StatusBadge
                                tone={level === "view" ? "neutral" : "success"}
                                icon={level === "view" ? Minus : Check}
                                size="sm"
                                label={`${text.label}: ${levelLabel(level)}`}
                              />
                            </li>
                          );
                        }
                        const on = matrix[item.id]?.[permission] ?? false;
                        const text = textOf(permission);
                        return (
                          <li key={permission} className="max-w-full">
                            <span aria-hidden>
                              <StatusBadge
                                tone={on ? "success" : "neutral"}
                                icon={on ? Check : Minus}
                                size="sm"
                                label={text.label}
                              />
                            </span>
                            <span className="sr-only">
                              {t(on ? "eq.perm.can" : "eq.perm.cannot", { permission: text.label })}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
            <table className="hidden w-full table-fixed text-left text-xs text-foreground sm:table">
              <thead>
                <tr className="border-b border-border/60">
                  <th scope="col" className="py-2 pe-2 font-semibold">
                    <span className="sr-only">{t("team.perm.permission")}</span>
                  </th>
                  {roles.map((item) => (
                    <th key={item.id} scope="col" className="w-12 py-2 text-center sm:w-24">
                      <item.icon className="mx-auto size-4 text-gold" aria-hidden />
                      <span className="mt-0.5 block truncate text-[10px] font-bold sm:text-xs">
                        {t(item.label)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareRows.map((permission) => {
                  const text =
                    permission === "services" ? textOf(SERVICES.manageAll) : textOf(permission);
                  return (
                    <tr key={permission} className="border-b border-border/40 last:border-0">
                      <th scope="row" className="py-2 pe-2 font-semibold">
                        {text.label}
                      </th>
                      {roles.map((item) => {
                        if (permission === "services") {
                          const level = serviceLevelFor(matrix, item.id);
                          return (
                            <td key={item.id} className="py-2 text-center text-[11px] font-bold">
                              {levelLabel(level)}
                            </td>
                          );
                        }
                        const on = matrix[item.id]?.[permission] ?? false;
                        return (
                          <td key={item.id} className="py-2 text-center">
                            <span className="inline-flex justify-center">
                              <YesNo
                                on={on}
                                label={t(on ? "eq.perm.canRole" : "eq.perm.cannotRole", {
                                  role: t(item.label),
                                })}
                              />
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </MoreDetails>

          {canEdit && (
            <UnsavedBar
              dirty={changes > 0}
              count={changes}
              saving={state === "saving"}
              state={state}
              stateText={
                state === "error"
                  ? t("team.perm.saveError")
                  : state === "saved"
                    ? t("team.perm.saved")
                    : undefined
              }
              onSave={() => void handleSave()}
              onDiscard={() => {
                setMatrix(saved);
                setState(null);
              }}
              saveLabel={t("eq.perm.save")}
            />
          )}
        </>
      )}
      <p className={cn("sr-only")} aria-live="polite">
        {t("eq.perm.showing", { role: roleLabel(role) })}
      </p>
    </div>
  );
}
