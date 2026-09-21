import { useCallback, useEffect, useState } from "react";
import { Shield, Check, Save, RefreshCw, Building2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

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

/** Papéis na ordem exibida. O rótulo é usado nos cabeçalhos e nos nomes acessíveis. */
const ROLE_COLUMNS: { id: string; label: string }[] = [
  { id: "owner", label: "Dono" },
  { id: "partner", label: "Sócio" },
  { id: "associate", label: "Parceiro" },
  { id: "employee", label: "Contratado" },
];

/**
 * O item "Serviços" consolida duas permissões booleanas
 * (`manage_services` = gerenciar tudo, `manage_own_services` = gerenciar os
 * próprios) em uma única linha com nível de acesso por papel:
 *   - `view`: somente visualização (não gerencia)
 *   - `own`: gerencia os próprios serviços
 *   - `all`: gerencia todo o catálogo
 * O banco continua armazenando os dois booleanos, que já dirigem RLS e capacidades.
 */
const SERVICE_ACCESS = {
  permission: "services",
  label: "Serviços",
  description: "Nível de acesso ao catálogo de serviços da unidade",
  manageAll: "manage_services",
  manageOwn: "manage_own_services",
  options: [
    { value: "view", label: "Ver", title: "Somente visualização" },
    { value: "own", label: "Próprios", title: "Gerenciar próprios serviços" },
    { value: "all", label: "Tudo", title: "Gerenciar todo o catálogo" },
  ],
} as const;

type ServiceLevel = (typeof SERVICE_ACCESS.options)[number]["value"];

function serviceLevelFor(matrix: Matrix, role: string): ServiceLevel {
  const row = matrix[role] ?? {};
  if (row[SERVICE_ACCESS.manageAll]) return "all";
  if (row[SERVICE_ACCESS.manageOwn]) return "own";
  return "view";
}

export function PlatformPermissionsEditor({ shops }: { shops: Tables<"barbershops">[] }) {
  const [shopId, setShopId] = useState("");
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
      setError("Não foi possível carregar as permissões desta barbearia.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!shopId && shops.length > 0) setShopId(shops[0]!.id);
  }, [shopId, shops]);

  useEffect(() => {
    void load(shopId);
  }, [load, shopId]);

  const togglePermission = (permission: string, role: string, value: boolean) => {
    setMatrix((current) => ({
      ...current,
      [role]: { ...(current[role] ?? {}), [permission]: value },
    }));
    setSaved(false);
  };

  /** Define o nível de acesso ao serviço de um papel, nos dois booleanos. */
  const setServiceLevel = (role: string, level: ServiceLevel) => {
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
    if (!shopId || busy) return;
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
      setError(
        "Não foi possível salvar. Sociedades igualitárias precisam da aprovação do outro sócio.",
      );
    } finally {
      setBusy(false);
    }
  }

  // As linhas de serviço viram uma única linha de nível; as demais seguem como liga/desliga.
  const toggleRows = catalog.filter(
    (entry) =>
      entry.permission !== SERVICE_ACCESS.manageAll &&
      entry.permission !== SERVICE_ACCESS.manageOwn,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Shield className="size-5 text-primary" />
          Hierarquia e Permissões
        </h2>
        <p className="text-sm text-muted-foreground">
          O <strong>Admin Global</strong> sempre tem acesso total a tudo e a todos e não depende
          desta matriz. Aqui você define o que cada perfil da equipe faz dentro da barbearia
          escolhida; as regras valem na hora, no banco de dados.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <Building2 className="size-4 text-primary" />
        <label htmlFor="permissions-shop" className="text-sm font-semibold">
          Barbearia
        </label>
        <select
          id="permissions-shop"
          value={shopId}
          onChange={(event) => setShopId(event.target.value)}
          disabled={loading || busy || shops.length === 0}
          className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
        >
          {shops.length === 0 && <option value="">Nenhuma barbearia cadastrada</option>}
          {shops.map((shop) => (
            <option key={shop.id} value={shop.id}>
              {shop.name}
              {shop.status === "active" ? "" : " · suspensa"}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void load(shopId)}
          disabled={!shopId || loading}
          className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Recarregar
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando permissões…
        </p>
      ) : catalog.length === 0 ? (
        <p role="status" className="text-sm text-muted-foreground">
          Escolha uma barbearia para configurar os acessos.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[560px] table-fixed text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th scope="col" className="w-[32%] p-4 font-semibold text-foreground">
                  Permissão
                </th>
                {ROLE_COLUMNS.map((role) => (
                  <th
                    key={role.id}
                    scope="col"
                    className="p-3 text-center font-semibold text-foreground"
                  >
                    {role.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Linha única de nível de acesso aos serviços. */}
              <tr className="border-b border-border/50 transition-colors hover:bg-muted/10">
                <td className="p-4">
                  <p className="truncate font-bold" title={SERVICE_ACCESS.label}>
                    {SERVICE_ACCESS.label}
                  </p>
                  <p
                    className="mt-0.5 truncate text-xs text-muted-foreground"
                    title={SERVICE_ACCESS.description}
                  >
                    {SERVICE_ACCESS.description}
                  </p>
                </td>
                {ROLE_COLUMNS.map((role) => (
                  <td key={role.id} className="p-3 text-center">
                    <select
                      aria-label={`${SERVICE_ACCESS.label} para ${role.label}`}
                      title={
                        SERVICE_ACCESS.options.find(
                          (option) => option.value === serviceLevelFor(matrix, role.id),
                        )?.title
                      }
                      value={serviceLevelFor(matrix, role.id)}
                      disabled={busy}
                      onChange={(event) =>
                        setServiceLevel(role.id, event.target.value as ServiceLevel)
                      }
                      className="w-full min-w-0 rounded-lg border border-border bg-background px-1.5 py-1.5 text-xs font-semibold text-foreground"
                    >
                      {SERVICE_ACCESS.options.map((option) => (
                        <option key={option.value} value={option.value} title={option.title}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>

              {toggleRows.map((entry) => (
                <tr
                  key={entry.permission}
                  className="border-b border-border/50 transition-colors hover:bg-muted/10"
                >
                  <td className="p-4">
                    <p className="truncate font-bold" title={entry.label}>
                      {entry.label}
                    </p>
                    <p
                      className="mt-0.5 truncate text-xs text-muted-foreground"
                      title={entry.description}
                    >
                      {entry.description}
                    </p>
                  </td>
                  {ROLE_COLUMNS.map((role) => {
                    const checked = matrix[role.id]?.[entry.permission] ?? false;
                    // O dono mantém a gestão de permissões: sem isso a loja se tranca.
                    const locked = role.id === "owner" && entry.permission === "manage_permissions";
                    return (
                      <td key={role.id} className="p-3 text-center">
                        <div className="flex justify-center">
                          <Switch
                            aria-label={`${entry.label} para ${role.label}`}
                            checked={checked}
                            disabled={busy || locked}
                            onCheckedChange={(value) =>
                              togglePermission(entry.permission, role.id, value)
                            }
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!shopId || busy || loading || catalog.length === 0}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
        >
          {saved ? <Check className="size-4" /> : <Save className="size-4" />}
          {busy ? "Salvando…" : saved ? "Permissões salvas" : "Salvar permissões"}
        </button>
        <p className="text-xs text-muted-foreground">
          Sociedades com participação igual precisam da aprovação do outro sócio para aplicar.
        </p>
      </div>
    </div>
  );
}
