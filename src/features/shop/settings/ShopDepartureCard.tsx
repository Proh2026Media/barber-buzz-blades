import { useCallback, useEffect, useState } from "react";
import { LogOut, UserMinus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { t as tNow, useI18n } from "@/lib/i18n";
import { friendlyAuthError } from "@/lib/auth/friendly-error";

type DepartureRequest = {
  id: string;
  user_id: string;
  staff_id: string;
  mode: "take" | "forfeit";
  dest_shop_id: string | null;
  status: string;
  created_at: string;
  staff_name: string | null;
  requester_name: string | null;
};

type DestShop = {
  id: string;
  name: string;
  slug: string;
};

type ShopDepartureCardProps = {
  shopId: string;
  /** Se true, mostra pedidos pendentes de liberação de carteira (sócio). */
  canApproveRelease?: boolean;
  /** Se true, mostra o formulário de saída do próprio usuário. */
  canRequestDeparture?: boolean;
};

export function ShopDepartureCard({
  shopId,
  canApproveRelease = false,
  canRequestDeparture = true,
}: ShopDepartureCardProps) {
  const { t, intlLocale } = useI18n();
  const [mode, setMode] = useState<"take" | "forfeit">("forfeit");
  const [destShopId, setDestShopId] = useState("");
  const [newShopName, setNewShopName] = useState("");
  const [destShops, setDestShops] = useState<DestShop[]>([]);
  const [pending, setPending] = useState<DepartureRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    if (canApproveRelease) {
      const { data, error: listError } = await supabase.rpc("list_shop_departure_requests", {
        p_shop_id: shopId,
      });
      if (listError) setError(friendlyAuthError(listError));
      else setPending((data as DepartureRequest[]) ?? []);
    }

    const { data: sessionProfile } = await supabase.auth.getUser();
    const userId = sessionProfile.user?.id;
    if (userId) {
      const { data: actors, error: actorsError } = await supabase
        .from("shop_members")
        .select("barbershop_id")
        .eq("user_id", userId)
        .eq("active", true)
        .neq("barbershop_id", shopId);
      if (actorsError) {
        setError(friendlyAuthError(actorsError, tNow("team.departure.loadShopsFailed")));
        return;
      }
      const ids = (actors ?? []).map((row) => row.barbershop_id).filter(Boolean);
      if (ids.length) {
        const { data: shops, error: shopsError } = await supabase
          .from("barbershops")
          .select("id, name, slug")
          .in("id", ids)
          .eq("status", "active");
        if (shopsError) {
          setError(friendlyAuthError(shopsError, tNow("team.departure.loadShopsFailed")));
          return;
        }
        setDestShops(shops ?? []);
      } else {
        setDestShops([]);
      }
    }
  }, [shopId, canApproveRelease]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createDestinationShop() {
    if (!newShopName.trim()) {
      setError(t("team.departure.nameRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("create_own_barbershop", {
        p_name: newShopName.trim(),
      });
      if (rpcError) throw rpcError;
      const payload = data as { shop_id?: string };
      if (!payload.shop_id) throw new Error(t("team.departure.createError"));
      setDestShopId(payload.shop_id);
      setMessage(t("team.departure.created"));
      await load();
    } catch (err) {
      setError(friendlyAuthError(err, t("team.departure.createFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function requestDeparture() {
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      if (mode === "take" && !destShopId) {
        throw new Error(t("team.departure.destRequired"));
      }
      const { data, error: rpcError } = await supabase.rpc("request_shop_departure", {
        p_shop_id: shopId,
        p_mode: mode,
        p_dest_shop_id: mode === "take" ? destShopId : null,
      });
      if (rpcError) throw rpcError;
      const payload = data as { status?: string };
      if (payload.status === "pending_release") {
        setMessage(t("team.departure.sent"));
      } else {
        setMessage(
          mode === "take" ? t("team.departure.doneTake") : t("team.departure.doneForfeit"),
        );
      }
      await load();
    } catch (err) {
      setError(friendlyAuthError(err, t("team.departure.failed")));
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc(
        approve ? "approve_portfolio_release" : "reject_portfolio_release",
        { p_request_id: id, p_note: null },
      );
      if (rpcError) throw rpcError;
      setMessage(approve ? t("team.departure.released") : t("team.departure.rejected"));
      await load();
    } catch (err) {
      setError(friendlyAuthError(err, t("team.departure.decideFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-3xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="rounded-2xl bg-primary/10 p-2 text-primary">
          <UserMinus size={18} />
        </span>
        <div>
          <h3 className="text-sm font-bold">{t("team.departure.title")}</h3>
          <p className="text-xs text-muted-foreground">{t("team.departure.hint")}</p>
        </div>
      </div>

      {canApproveRelease && pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold">{t("team.departure.pendingTitle")}</p>
          {pending
            .filter((row) => row.status === "pending_release")
            .map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-background px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {row.requester_name || row.staff_name || t("team.departure.partnerFallback")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("team.departure.wantsToTake", {
                      date: new Date(row.created_at).toLocaleString(intlLocale),
                    })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className="action-button"
                    onClick={() => void decide(row.id, true)}
                  >
                    {t("team.departure.release")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="action-button action-danger"
                    onClick={() => void decide(row.id, false)}
                  >
                    {t("team.departure.decline")}
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {canRequestDeparture && (
        <div className="space-y-3 rounded-2xl border border-border bg-background p-3">
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold">{t("team.departure.question")}</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="departure-mode"
                checked={mode === "forfeit"}
                onChange={() => setMode("forfeit")}
              />
              {t("team.departure.forfeit")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="departure-mode"
                checked={mode === "take"}
                onChange={() => setMode("take")}
              />
              {t("team.departure.take")}
            </label>
          </fieldset>

          {mode === "take" && (
            <div className="space-y-2">
              <label htmlFor="dest-shop" className="block text-xs font-semibold">
                {t("team.departure.destination")}
              </label>
              <select
                id="dest-shop"
                value={destShopId}
                onChange={(e) => setDestShopId(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="">{t("team.departure.select")}</option>
                {destShops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name} (/{shop.slug})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{t("team.departure.orCreate")}</p>
              <div className="flex gap-2">
                <input
                  value={newShopName}
                  onChange={(e) => setNewShopName(e.target.value)}
                  placeholder={t("team.departure.newNamePlaceholder")}
                  aria-label={t("team.departure.newNamePlaceholder")}
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={busy}
                  className="action-button"
                  onClick={() => void createDestinationShop()}
                >
                  {t("team.departure.create")}
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            className="action-button action-danger w-full justify-center"
            onClick={() => void requestDeparture()}
          >
            <LogOut size={14} />
            {t("team.departure.confirm")}
          </button>
        </div>
      )}

      {message && <p className="text-sm text-foreground">{message}</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
