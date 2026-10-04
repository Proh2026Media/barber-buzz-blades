import { Fragment, useCallback, useEffect, useState, type ReactNode } from "react";
import { Link2, Lock, Trash2 } from "lucide-react";
import { SettingsCardHeader } from "@/features/shop/settings/SettingsCardHeader";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { friendlyAuthError } from "@/lib/auth/friendly-error";

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

function richText(template: string, nodes: Record<string, ReactNode>) {
  return template
    .split(/\{(\w+)\}/g)
    .map((part, i) => (i % 2 === 1 ? <Fragment key={i}>{nodes[part] ?? part}</Fragment> : part));
}

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
  const { t } = useI18n();
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
      setError(friendlyAuthError(shopResult.error));
      return;
    }
    if (staffResult.error) {
      setError(friendlyAuthError(staffResult.error));
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
      setError(friendlyAuthError(err, t("integr.redirects.errRemove")));
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
      setError(friendlyAuthError(err, t("integr.redirects.errRemove")));
    } finally {
      setBusy(false);
    }
  }

  const empty = shopRedirects.length === 0 && staffRedirects.length === 0;

  return (
    <section className="space-y-3 rounded-3xl border border-border bg-card p-4">
      <SettingsCardHeader
        icon={Link2}
        title={t("integr.redirects.title")}
        intro={
          currentShopSlug
            ? richText(t("integr.redirects.introSlug"), {
                slug: <span className="font-semibold text-foreground">/{currentShopSlug}</span>,
              })
            : t("integr.redirects.intro")
        }
      />

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {empty ? (
        <p className="text-xs text-muted-foreground">{t("integr.redirects.empty")}</p>
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
                  {row.locked ? t("integr.redirects.locked") : t("integr.redirects.shopRedirect")} →
                  /{currentShopSlug}
                </p>
              </div>
              {row.locked || !canManageShopRedirects ? (
                <Lock
                  size={16}
                  className="text-muted-foreground"
                  aria-label={t("integr.redirects.locked")}
                />
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  className="action-button action-danger"
                  aria-label={t("integr.redirects.deleteShopAria", { slug: row.from_slug })}
                  onClick={() => void removeShopRedirect(row.id)}
                >
                  <Trash2 size={14} />
                  {t("integr.redirects.delete")}
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
                    ? t("integr.redirects.lockedStaff")
                    : t("integr.redirects.staffRedirect")}
                </p>
              </div>
              {row.locked ? (
                <Lock
                  size={16}
                  className="text-muted-foreground"
                  aria-label={t("integr.redirects.locked")}
                />
              ) : canManageShopRedirects ? (
                <button
                  type="button"
                  disabled={busy}
                  className="action-button action-danger"
                  aria-label={t("integr.redirects.deleteStaffAria", {
                    slug: row.from_booking_slug,
                  })}
                  onClick={() => void removeStaffRedirect(row.id)}
                >
                  <Trash2 size={14} />
                  {t("integr.redirects.delete")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
