import { useCallback, useEffect, useState } from "react";
import { ArrowRight, History, Link2, Lock, RefreshCw, Trash2, XCircle } from "lucide-react";
import {
  ConfirmDialog,
  EmptyState,
  LoadingState,
  Notice,
  STATE,
  SectionHeader,
  StatusBadge,
} from "@/components/visual";
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
  // A lista (ou o "nenhum link antigo") só aparece depois de ler tudo sem erro; na falha
  // fica só o aviso com "Tentar de novo", sem um falso vazio logo abaixo.
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [target, setTarget] = useState<{
    kind: "shop" | "staff";
    id: string;
    label: string;
  } | null>(null);

  /** `quiet`: recarga depois de apagar, sem trocar a lista pelo esqueleto. */
  const load = useCallback(
    async (quiet = false) => {
      setError(null);
      if (!quiet) setLoadState("loading");
      const [shopResult, staffResult] = await Promise.all([
        supabase.rpc("list_shop_slug_redirects", { p_shop_id: shopId }),
        supabase.rpc("list_staff_slug_redirects", { p_shop_id: shopId }),
      ]);
      const failure = shopResult.error ?? staffResult.error;
      if (failure) {
        setError(friendlyAuthError(failure));
        setLoadState("error");
        return;
      }
      setShopRedirects((shopResult.data as ShopRedirect[]) ?? []);
      setStaffRedirects((staffResult.data as StaffRedirect[]) ?? []);
      setLoadState("ready");
    },
    [shopId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  /** Apaga e recarrega; a falha sobe para a janela de confirmação mostrar o motivo. */
  async function removeShopRedirect(id: string) {
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc("delete_shop_slug_redirect", {
        p_redirect_id: id,
      });
      if (rpcError) throw rpcError;
      await load(true);
    } finally {
      setBusy(false);
    }
  }

  async function removeStaffRedirect(id: string) {
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc("delete_staff_slug_redirect", {
        p_redirect_id: id,
      });
      if (rpcError) throw rpcError;
      await load(true);
    } finally {
      setBusy(false);
    }
  }

  const empty = shopRedirects.length === 0 && staffRedirects.length === 0;

  /** Desenho "link antigo → link atual" com o selo do vínculo e, se puder, Apagar. */
  function row(
    key: string,
    from: string,
    to: string,
    who: string | null,
    locked: boolean,
    onDelete: (() => void) | null,
    deleteAria: string,
  ) {
    return (
      <li key={key} className="space-y-2 rounded-2xl border border-border bg-background/60 p-3">
        {who && <p className="text-xs font-semibold text-muted-foreground">{who}</p>}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="min-w-0 break-all rounded-lg border border-border bg-muted/60 px-2 py-1 text-sm font-semibold text-muted-foreground line-through decoration-muted-foreground/40">
            {from}
          </span>
          <ArrowRight className="size-4 shrink-0 text-gold" aria-label={t("redirects.to")} />
          <span className="min-w-0 break-all rounded-lg border border-primary/30 bg-primary/5 px-2 py-1 text-sm font-bold">
            {to}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {locked ? (
            <StatusBadge
              tone="neutral"
              icon={Lock}
              size="sm"
              label={who ? t("redirects.protectedStaff") : t("redirects.protected")}
            />
          ) : (
            <StatusBadge {...STATE.active} size="sm" label={t("redirects.working")} />
          )}
          {onDelete && (
            <button
              type="button"
              disabled={busy}
              aria-label={deleteAria}
              onClick={onDelete}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-60"
            >
              <Trash2 className="size-4" aria-hidden />
              {t("integr.redirects.delete")}
            </button>
          )}
        </div>
      </li>
    );
  }

  return (
    <section className="app-action-card space-y-4 p-4 sm:p-5">
      <SectionHeader
        icon={History}
        title={t("redirects.title")}
        description={t("redirects.intro")}
      />

      {loadState === "loading" ? (
        <LoadingState variant="list" count={2} label={t("redirects.loading")} />
      ) : loadState === "error" ? (
        <Notice
          tone="danger"
          title={error}
          action={{ label: t("visual.retry"), icon: RefreshCw, onClick: () => void load() }}
        />
      ) : empty ? (
        <EmptyState
          variant="plain"
          icon={Link2}
          title={t("redirects.empty")}
          description={t("redirects.emptyHint")}
        />
      ) : (
        <ul className="space-y-2">
          {shopRedirects.map((item) =>
            row(
              item.id,
              `/${item.from_slug}`,
              currentShopSlug ? `/${currentShopSlug}` : t("redirects.currentPage"),
              null,
              item.locked,
              item.locked || !canManageShopRedirects
                ? null
                : () => setTarget({ kind: "shop", id: item.id, label: `/${item.from_slug}` }),
              t("integr.redirects.deleteShopAria", { slug: item.from_slug }),
            ),
          )}
          {staffRedirects.map((item) =>
            row(
              item.id,
              `/${item.from_shop_slug}?barber=${item.from_booking_slug}`,
              // O link leva à página atual do profissional (que, se ele saiu, é em outra
              // barbearia) — nunca à página desta loja.
              t(item.locked ? "redirects.toStaffMoved" : "redirects.toStaff"),
              t("redirects.staffLink", { slug: item.from_booking_slug }),
              item.locked,
              item.locked || !canManageShopRedirects
                ? null
                : () =>
                    setTarget({
                      kind: "staff",
                      id: item.id,
                      label: t("redirects.staffLink", { slug: item.from_booking_slug }),
                    }),
              t("integr.redirects.deleteStaffAria", { slug: item.from_booking_slug }),
            ),
          )}
        </ul>
      )}

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        tone="danger"
        icon={Trash2}
        title={t("redirects.confirm.title", { link: target?.label ?? "" })}
        consequences={[{ icon: XCircle, tone: "danger", text: t("redirects.confirm.stops") }]}
        confirmLabel={t("redirects.confirm.delete")}
        confirmIcon={Trash2}
        cancelLabel={t("redirects.confirm.keep")}
        errorText={t("integr.redirects.errRemove")}
        onConfirm={async () => {
          if (!target) return;
          if (target.kind === "shop") await removeShopRedirect(target.id);
          else await removeStaffRedirect(target.id);
        }}
      />
    </section>
  );
}
