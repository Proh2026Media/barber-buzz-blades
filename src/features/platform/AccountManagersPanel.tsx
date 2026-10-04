import { Fragment, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Briefcase, Link2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";

function richText(template: string, nodes: Record<string, ReactNode>) {
  return template
    .split(/\{(\w+)\}/g)
    .map((part, i) => (i % 2 === 1 ? <Fragment key={i}>{nodes[part] ?? part}</Fragment> : part));
}

type Assignment = {
  user_id: string;
  barbershop_id: string;
  can_view_dashboard: boolean;
  created_at: string;
  label?: string | null;
  shop_name?: string | null;
};

export function AccountManagersPanel({ shops }: { shops: Tables<"barbershops">[] }) {
  const { t } = useI18n();
  const emailFieldId = useId();
  const shopFieldId = useId();
  const [email, setEmail] = useState("");
  const [shopId, setShopId] = useState("");
  const [canViewDashboard, setCanViewDashboard] = useState(false);
  const [rows, setRows] = useState<Assignment[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Assignment | null>(null);
  const removeTriggerRef = useRef<HTMLButtonElement | null>(null);

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
      setError(friendlyAuthError(loadError, t("plat.mgr.loadError")));
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
  }, [shops, t]);

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
      if (!normalized || !shopId) throw new Error(t("plat.mgr.missingFields"));

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("session expired");

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
      if (!response.ok) throw new Error(payload.error || t("plat.mgr.linkError"));

      setMessage(
        payload.created && payload.temporary_password
          ? t("plat.mgr.created", {
              email: payload.email ?? normalized,
              password: payload.temporary_password,
            })
          : t("plat.mgr.linked", { email: payload.email ?? normalized }),
      );
      setEmail("");
      await load();
    } catch (err) {
      setError(friendlyAuthError(err, t("plat.mgr.linkError")));
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: Assignment) {
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error: removeError } = await supabase.rpc("unassign_account_manager_shop", {
      p_user_id: row.user_id,
      p_shop_id: row.barbershop_id,
    });
    if (removeError) {
      setError(friendlyAuthError(removeError, t("plat.mgr.removeError")));
    } else {
      setMessage(
        t("plat.mgr.removed", {
          name: row.label ?? t("plat.mgr.managerFallback"),
          shop: row.shop_name ?? t("plat.mgr.shopFallback"),
        }),
      );
      await load();
    }
    setBusy(false);
    setRemoveTarget(null);
  }

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-primary/10 p-2 text-primary">
          <Briefcase className="size-5" />
        </span>
        <div>
          <h3 className="text-sm font-semibold">{t("plat.mgr.title")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t("plat.mgr.intro")}</p>
        </div>
      </div>

      <form onSubmit={assign} className="space-y-3">
        <div>
          <label
            htmlFor={emailFieldId}
            className="block text-xs font-semibold text-muted-foreground"
          >
            {t("plat.mgr.email")}
          </label>
          <input
            id={emailFieldId}
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            placeholder={t("plat.mgr.emailPlaceholder")}
          />
        </div>
        <div>
          <label
            htmlFor={shopFieldId}
            className="block text-xs font-semibold text-muted-foreground"
          >
            {t("plat.common.shop")}
          </label>
          <select
            id={shopFieldId}
            required
            value={shopId}
            onChange={(e) => setShopId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">{t("plat.mgr.select")}</option>
            {shops
              .filter((s) => s.status === "active")
              .map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              ))}
          </select>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={canViewDashboard}
            onChange={(e) => setCanViewDashboard(e.target.checked)}
            className="size-5 shrink-0 accent-[var(--primary)]"
          />
          {t("plat.mgr.canView")}
        </label>
        <button
          type="submit"
          disabled={busy}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Link2 className="size-4" />
          {busy ? t("plat.mgr.linking") : t("plat.mgr.link")}
        </button>
      </form>

      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            {t("plat.mgr.empty")}
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
                  {row.can_view_dashboard ? t("plat.mgr.seesDashboard") : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={(event) => {
                  removeTriggerRef.current = event.currentTarget;
                  setRemoveTarget(row);
                }}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-destructive"
                aria-label={t("plat.mgr.removeAria", {
                  name: row.label ?? t("plat.mgr.managerFallbackLower"),
                  shop: row.shop_name ?? t("plat.mgr.shopFallback"),
                })}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </article>
          ))
        )}
      </div>

      {message ? (
        <p role="status" className="text-xs font-semibold text-primary">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent
          className="max-w-md rounded-[var(--panel-radius)]"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (removeTriggerRef.current?.isConnected) removeTriggerRef.current.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{t("plat.mgr.removeTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm leading-relaxed">
              {richText(t("plat.mgr.removeBody"), {
                name: <span className="font-semibold text-foreground">{removeTarget?.label}</span>,
                shop: (
                  <span className="font-semibold text-foreground">{removeTarget?.shop_name}</span>
                ),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setRemoveTarget(null)}
              className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50"
            >
              {t("plat.mgr.keep")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => removeTarget && void remove(removeTarget)}
              className="action-button action-danger min-h-11 disabled:opacity-50"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {busy ? t("plat.mgr.removing") : t("plat.mgr.remove")}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
