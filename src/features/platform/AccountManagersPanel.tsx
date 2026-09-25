import { useCallback, useEffect, useId, useState } from "react";
import { Briefcase, Link2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Assignment = {
  user_id: string;
  barbershop_id: string;
  can_view_dashboard: boolean;
  created_at: string;
  label?: string | null;
  shop_name?: string | null;
};

export function AccountManagersPanel({ shops }: { shops: Tables<"barbershops">[] }) {
  const emailFieldId = useId();
  const shopFieldId = useId();
  const [email, setEmail] = useState("");
  const [shopId, setShopId] = useState("");
  const [canViewDashboard, setCanViewDashboard] = useState(false);
  const [rows, setRows] = useState<Assignment[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const client = supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          order: (
            column: string,
            opts: { ascending: boolean },
          ) => Promise<{ data: Assignment[] | null; error: { message: string } | null }>;
        };
      };
    };
    const { data, error: loadError } = await client
      .from("account_manager_shops")
      .select("user_id, barbershop_id, can_view_dashboard, created_at")
      .order("created_at", { ascending: false });
    if (loadError) {
      setError(loadError.message);
      setRows([]);
      return;
    }
    const base = data ?? [];
    const enriched = await Promise.all(
      base.map(async (row) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", row.user_id)
          .maybeSingle();
        const shop = shops.find((s) => s.id === row.barbershop_id);
        return {
          ...row,
          label: profile?.full_name || row.user_id.slice(0, 8),
          shop_name: shop?.name ?? row.barbershop_id.slice(0, 8),
        };
      }),
    );
    setRows(enriched);
  }, [shops]);

  useEffect(() => {
    void load();
  }, [load]);

  async function assign(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const normalized = email.trim().toLowerCase();
      if (!normalized || !shopId) throw new Error("Informe e-mail e barbearia.");

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão inválida");

      const base = import.meta.env.VITE_SUPABASE_URL || "";
      const response = await fetch(`${base}/functions/v1/invite-shop-admin`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalized,
          barbershop_id: shopId,
          full_name: normalized.split("@")[0],
          as_account_manager: true,
          can_view_dashboard: canViewDashboard,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        email?: string;
        created?: boolean;
        temporary_password?: string | null;
      };
      if (!response.ok) throw new Error(payload.error || "Falha ao vincular gerente");

      setMessage(
        payload.created && payload.temporary_password
          ? `${payload.email ?? normalized} criado. Senha temporária: ${payload.temporary_password}`
          : `${payload.email ?? normalized} vinculado como gerente de conta.`,
      );
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao vincular gerente");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: Assignment) {
    setBusy(true);
    setError(null);
    const { error: removeError } = await supabase.rpc("unassign_account_manager_shop", {
      p_user_id: row.user_id,
      p_shop_id: row.barbershop_id,
    });
    if (removeError) setError(removeError.message);
    else {
      setMessage("Vínculo removido.");
      await load();
    }
    setBusy(false);
  }

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-primary/10 p-2 text-primary">
          <Briefcase className="size-5" />
        </span>
        <div>
          <h3 className="text-sm font-semibold">Gerentes de conta</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Equipe do admin global. Alterações na loja pedem aprovação do dono (janela de 30 min).
          </p>
        </div>
      </div>

      <form onSubmit={assign} className="space-y-3">
        <div>
          <label htmlFor={emailFieldId} className="block text-xs font-semibold text-muted-foreground">
            E-mail do gerente
          </label>
          <input
            id={emailFieldId}
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            placeholder="gerente@exemplo.com"
          />
        </div>
        <div>
          <label htmlFor={shopFieldId} className="block text-xs font-semibold text-muted-foreground">
            Barbearia
          </label>
          <select
            id={shopFieldId}
            required
            value={shopId}
            onChange={(e) => setShopId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Selecione</option>
            {shops
              .filter((s) => s.status === "active")
              .map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input
            type="checkbox"
            checked={canViewDashboard}
            onChange={(e) => setCanViewDashboard(e.target.checked)}
          />
          Liberar dashboard da loja (somente leitura)
        </label>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Link2 className="size-4" />
          {busy ? "Vinculando…" : "Vincular gerente"}
        </button>
      </form>

      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            Nenhum gerente vinculado ainda.
          </p>
        ) : (
          rows.map((row) => (
            <article
              key={`${row.user_id}-${row.barbershop_id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{row.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.shop_name}
                  {row.can_view_dashboard ? " · dashboard liberado" : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove(row)}
                className="inline-flex size-9 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-destructive"
                aria-label="Remover vínculo"
              >
                <Trash2 className="size-4" />
              </button>
            </article>
          ))
        )}
      </div>

      {message ? <p className="text-xs font-semibold text-primary">{message}</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
