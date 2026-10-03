import { useCallback, useEffect, useState } from "react";
import { Check, Save, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { t as tNow, useI18n, type MessageKey } from "@/lib/i18n";

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

const ROLE_COLUMNS: { id: string; labelKey: MessageKey }[] = [
  { id: "owner", labelKey: "team.perm.role.owner" },
  { id: "partner", labelKey: "team.perm.role.partner" },
  { id: "associate", labelKey: "team.perm.role.associate" },
  { id: "employee", labelKey: "team.perm.role.employee" },
];

const SERVICE_ACCESS = {
  permission: "services",
  labelKey: "team.perm.services",
  descriptionKey: "team.perm.servicesHint",
  manageAll: "manage_services",
  manageOwn: "manage_own_services",
  options: [
    { value: "view", labelKey: "team.perm.level.view", titleKey: "team.perm.level.viewTitle" },
    { value: "own", labelKey: "team.perm.level.own", titleKey: "team.perm.level.ownTitle" },
    { value: "all", labelKey: "team.perm.level.all", titleKey: "team.perm.level.allTitle" },
  ],
} as const;

// Textos traduzidos das permissões; o texto do banco (pt-BR) fica como alternativa.
const PERMISSION_TEXT: Record<string, { label: MessageKey; hint: MessageKey }> = {
  view_agenda_all: {
    label: "fix.componentes-loja.perm.view_agenda_all",
    hint: "fix.componentes-loja.perm.view_agenda_allHint",
  },
  view_money: {
    label: "fix.componentes-loja.perm.view_money",
    hint: "fix.componentes-loja.perm.view_moneyHint",
  },
  view_financial_all: {
    label: "fix.componentes-loja.perm.view_financial_all",
    hint: "fix.componentes-loja.perm.view_financial_allHint",
  },
  view_reports_global: {
    label: "fix.componentes-loja.perm.view_reports_global",
    hint: "fix.componentes-loja.perm.view_reports_globalHint",
  },
  view_reports_anonymized: {
    label: "fix.componentes-loja.perm.view_reports_anonymized",
    hint: "fix.componentes-loja.perm.view_reports_anonymizedHint",
  },
  view_own_score: {
    label: "fix.componentes-loja.perm.view_own_score",
    hint: "fix.componentes-loja.perm.view_own_scoreHint",
  },
  manage_services: {
    label: "fix.componentes-loja.perm.manage_services",
    hint: "fix.componentes-loja.perm.manage_servicesHint",
  },
  manage_own_services: {
    label: "fix.componentes-loja.perm.manage_own_services",
    hint: "fix.componentes-loja.perm.manage_own_servicesHint",
  },
  manage_operations: {
    label: "fix.componentes-loja.perm.manage_operations",
    hint: "fix.componentes-loja.perm.manage_operationsHint",
  },
  manage_team: {
    label: "fix.componentes-loja.perm.manage_team",
    hint: "fix.componentes-loja.perm.manage_teamHint",
  },
  manage_permissions: {
    label: "fix.componentes-loja.perm.manage_permissions",
    hint: "fix.componentes-loja.perm.manage_permissionsHint",
  },
};

type ServiceLevel = (typeof SERVICE_ACCESS.options)[number]["value"];

function serviceLevelFor(matrix: Matrix, role: string): ServiceLevel {
  const row = matrix[role] ?? {};
  if (row[SERVICE_ACCESS.manageAll]) return "all";
  if (row[SERVICE_ACCESS.manageOwn]) return "own";
  return "view";
}

type ShopPermissionsMatrixProps = {
  shopId: string;
  /** Se false, só leitura. */
  canEdit?: boolean;
  title?: string;
  description?: string;
};

export function ShopPermissionsMatrix({
  shopId,
  canEdit = true,
  title: titleProp,
  description: descriptionProp,
}: ShopPermissionsMatrixProps) {
  const { t } = useI18n();
  const title = titleProp ?? t("team.perm.title");
  const description = descriptionProp ?? t("team.perm.description");
  const [catalog, setCatalog] = useState<PermissionMeta[]>([]);
  const [matrix, setMatrix] = useState<Matrix>({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (target: string) => {
    if (!target) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: failure } = await supabase.rpc("get_shop_permissions", {
        p_shop_id: target,
      });
      if (failure) throw failure;
      const payload = data as unknown as PermissionsPayload | null;
      if (!payload || typeof payload !== "object" || !payload.matrix) {
        throw new Error("Resposta inválida");
      }
      setCatalog(Array.isArray(payload.catalog) ? payload.catalog : []);
      setMatrix(payload.matrix);
    } catch {
      setCatalog([]);
      setMatrix({});
      setError(tNow("team.perm.loadError"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(shopId);
  }, [load, shopId]);

  const togglePermission = (permission: string, role: string, value: boolean) => {
    if (!canEdit) return;
    setMatrix((current) => ({
      ...current,
      [role]: { ...(current[role] ?? {}), [permission]: value },
    }));
    setSaved(false);
  };

  const setServiceLevel = (role: string, level: ServiceLevel) => {
    if (!canEdit) return;
    setMatrix((current) => ({
      ...current,
      [role]: {
        ...(current[role] ?? {}),
        [SERVICE_ACCESS.manageAll]: level === "all",
        [SERVICE_ACCESS.manageOwn]: level === "own" || level === "all",
      },
    }));
    setSaved(false);
  };

  async function handleSave() {
    if (!shopId || busy || !canEdit) return;
    setBusy(true);
    setError(null);
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
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError(t("team.perm.saveError"));
    } finally {
      setBusy(false);
    }
  }

  const toggleRows = catalog.filter(
    (entry) =>
      entry.permission !== SERVICE_ACCESS.manageAll &&
      entry.permission !== SERVICE_ACCESS.manageOwn,
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        {!canEdit ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("fix.componentes-loja.perm.readOnlyHint")}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void load(shopId)}
          disabled={!shopId || loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-[var(--button-radius)] border border-border/70 bg-background px-3 text-xs font-semibold disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          {t("team.perm.reload")}
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("team.perm.loading")}
        </p>
      ) : catalog.length === 0 ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("team.perm.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--control-radius)] border border-border/60 bg-background/80">
          <table className="w-full min-w-[560px] table-fixed text-left text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th scope="col" className="w-[32%] p-3 font-semibold">
                  {t("team.perm.permission")}
                </th>
                {ROLE_COLUMNS.map((role) => (
                  <th key={role.id} scope="col" className="p-2 text-center font-semibold">
                    {t(role.labelKey)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/40">
                <td className="p-3">
                  <p className="font-bold">{t(SERVICE_ACCESS.labelKey)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t(SERVICE_ACCESS.descriptionKey)}
                  </p>
                </td>
                {ROLE_COLUMNS.map((role) => (
                  <td key={role.id} className="p-2 text-center">
                    <select
                      aria-label={t("team.perm.forRole", {
                        permission: t(SERVICE_ACCESS.labelKey),
                        role: t(role.labelKey),
                      })}
                      value={serviceLevelFor(matrix, role.id)}
                      disabled={busy || !canEdit}
                      onChange={(event) =>
                        setServiceLevel(role.id, event.target.value as ServiceLevel)
                      }
                      className="w-full rounded-[var(--control-radius)] border border-border/70 bg-background px-1.5 py-1.5 text-xs font-semibold"
                    >
                      {SERVICE_ACCESS.options.map((option) => (
                        <option key={option.value} value={option.value} title={t(option.titleKey)}>
                          {t(option.labelKey)}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>

              {toggleRows.map((entry) => {
                const text = PERMISSION_TEXT[entry.permission];
                const label = text ? t(text.label) : entry.label;
                const description = text ? t(text.hint) : entry.description;
                return (
                  <tr key={entry.permission} className="border-b border-border/40">
                    <td className="p-3">
                      <p className="font-bold">{label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                    </td>
                    {ROLE_COLUMNS.map((role) => {
                      const checked = matrix[role.id]?.[entry.permission] ?? false;
                      const locked =
                        role.id === "owner" && entry.permission === "manage_permissions";
                      return (
                        <td key={role.id} className="p-2 text-center">
                          <div className="flex justify-center">
                            <Switch
                              aria-label={t("team.perm.forRole", {
                                permission: label,
                                role: t(role.labelKey),
                              })}
                              checked={checked}
                              disabled={busy || !canEdit || locked}
                              onCheckedChange={(value) =>
                                togglePermission(entry.permission, role.id, value)
                              }
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canEdit ? (
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!shopId || busy || loading || catalog.length === 0}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--button-radius)] bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
          >
            {saved ? <Check className="size-4" /> : <Save className="size-4" />}
            {busy ? t("team.perm.saving") : saved ? t("team.perm.saved") : t("team.perm.save")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
