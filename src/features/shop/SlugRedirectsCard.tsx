import { useCallback, useEffect, useState } from "react";
import { Link2, Lock, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ShopRedirect = {
  id: string;
  from_slug: string;
  locked: boolean;
  created_at: string;
};

type StaffRedirect = {
  id: string;
  from_shop_slug: string;
  from_booking_slug: string;
  locked: boolean;
  owner_user_id: string;
  created_at: string;
};

type SlugRedirectsCardProps = {
  shopId: string;
  currentShopSlug?: string | null;
  canManageShopRedirects?: boolean;
};

export function SlugRedirectsCard({
  shopId,
  currentShopSlug,
  canManageShopRedirects = true,
}: SlugRedirectsCardProps) {
  const [shopRedirects, setShopRedirects] = useState<ShopRedirect[]>([]);
  const [staffRedirects, setStaffRedirects] = useState<StaffRedirect[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [shopResult, staffResult] = await Promise.all([
      supabase.rpc("list_shop_slug_redirects", { p_shop_id: shopId }),
      supabase.rpc("list_staff_slug_redirects", { p_shop_id: shopId }),
    ]);
    if (shopResult.error) {
      setError(shopResult.error.message);
      return;
    }
    if (staffResult.error) {
      setError(staffResult.error.message);
      return;
    }
    setShopRedirects((shopResult.data as ShopRedirect[]) ?? []);
    setStaffRedirects((staffResult.data as StaffRedirect[]) ?? []);
  }, [shopId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function removeShopRedirect(id: string) {
    setBusy(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc("delete_shop_slug_redirect", {
        p_redirect_id: id,
      });
      if (rpcError) throw rpcError;
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao remover redirect.");
    } finally {
      setBusy(false);
    }
  }

  async function removeStaffRedirect(id: string) {
    setBusy(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc("delete_staff_slug_redirect", {
        p_redirect_id: id,
      });
      if (rpcError) throw rpcError;
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao remover redirect.");
    } finally {
      setBusy(false);
    }
  }

  const empty = shopRedirects.length === 0 && staffRedirects.length === 0;

  return (
    <section className="space-y-3 rounded-3xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="rounded-2xl bg-primary/10 p-2 text-primary">
          <Link2 size={18} />
        </span>
        <div>
          <h3 className="text-sm font-bold">Links e redirecionamentos</h3>
          <p className="text-xs text-muted-foreground">
            O endereço atual é gerado pelo nome
            {currentShopSlug ? (
              <>
                {" "}
                (<span className="font-semibold text-foreground">/{currentShopSlug}</span>)
              </>
            ) : null}
            . Links antigos continuam válidos até você apagá-los. Links travados (saída com
            carteira) não podem ser alterados pela loja.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {empty ? (
        <p className="text-xs text-muted-foreground">Nenhum redirecionamento ativo.</p>
      ) : (
        <ul className="space-y-2">
          {shopRedirects.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background px-3 py-2 text-sm"
            >
              <div>
                <p className="font-semibold">/{row.from_slug}</p>
                <p className="text-xs text-muted-foreground">
                  {row.locked ? "Travado" : "Redirect de loja"} → /{currentShopSlug}
                </p>
              </div>
              {row.locked || !canManageShopRedirects ? (
                <Lock size={16} className="text-muted-foreground" aria-label="Travado" />
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  className="action-button action-danger"
                  aria-label={`Apagar redirect /${row.from_slug}`}
                  onClick={() => void removeShopRedirect(row.id)}
                >
                  <Trash2 size={14} />
                  Apagar
                </button>
              )}
            </li>
          ))}
          {staffRedirects.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background px-3 py-2 text-sm"
            >
              <div>
                <p className="font-semibold">
                  /{row.from_shop_slug}?barber={row.from_booking_slug}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.locked
                    ? "Travado (profissional saiu com a carteira)"
                    : "Redirect de profissional"}
                </p>
              </div>
              {row.locked ? (
                <Lock size={16} className="text-muted-foreground" aria-label="Travado" />
              ) : canManageShopRedirects ? (
                <button
                  type="button"
                  disabled={busy}
                  className="action-button action-danger"
                  aria-label={`Apagar redirect do barbeiro ${row.from_booking_slug}`}
                  onClick={() => void removeStaffRedirect(row.id)}
                >
                  <Trash2 size={14} />
                  Apagar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
