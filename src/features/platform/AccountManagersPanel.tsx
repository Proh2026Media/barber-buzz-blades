import { useCallback, useEffect, useId, useState } from "react";
import {
  Briefcase,
  Eye,
  Hourglass,
  Link2,
  Loader2,
  ShieldCheck,
  Store,
  Trash2,
  XCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  ActionResult,
  ConfirmDialog,
  CopyField,
  Field,
  Hint,
  IconList,
  LoadingState,
  Notice,
  PersonAvatar,
  SectionHeader,
  StatusBadge,
  Tag,
  type ActionState,
} from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";
import { TempPasswordClose } from "./TempPasswordClose";
import { useTempPasswordClose } from "./use-temp-password-close";

type Assignment = {
  user_id: string;
  barbershop_id: string;
  can_view_dashboard: boolean;
  created_at: string;
  label?: string | null;
  shop_name?: string | null;
};

/**
 * Gerentes de conta: pessoas da plataforma que cuidam de uma barbearia. Com `shopId`, mostra só
 * os gerentes daquela barbearia (dentro da ficha) e o formulário já vem com ela escolhida.
 * A lista vem primeiro; o formulário abre numa janela e o resultado aparece logo abaixo do botão.
 */
export function AccountManagersPanel({
  shops,
  shopId: fixedShopId,
  disabled = false,
  headingAs = "h4",
}: {
  shops: Tables<"barbershops">[];
  shopId?: string;
  /** Barbearia suspensa: não vincula ninguém novo (a ficha diz como liberar). */
  disabled?: boolean;
  /** Nível do título: h4 dentro da ficha, h2 na lista de todos (aba Acessos). */
  headingAs?: "h2" | "h3" | "h4";
}) {
  const { t } = useI18n();
  const emailFieldId = useId();
  const shopFieldId = useId();
  const viewFieldId = useId();
  const [email, setEmail] = useState("");
  const [shopId, setShopId] = useState(fixedShopId ?? "");
  const [canViewDashboard, setCanViewDashboard] = useState(false);
  const [rows, setRows] = useState<Assignment[]>([]);
  /** Todos os vínculos (de todas as barbearias), para o "+2 barbearias" de cada gerente. */
  const [allRows, setAllRows] = useState<Assignment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    state: ActionState;
    text: string;
    password?: string | null;
  } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Assignment | null>(null);
  const fixedShop = fixedShopId ? shops.find((shop) => shop.id === fixedShopId) : undefined;

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
    const { data, error: failure } = await client
      .from("account_manager_shops")
      .select("user_id, barbershop_id, can_view_dashboard, created_at")
      .order("created_at", { ascending: false });
    setLoaded(true);
    if (failure) {
      setLoadError(friendlyAuthError(failure, t("plat.mgr.loadError")));
      setRows([]);
      setAllRows([]);
      return;
    }
    setLoadError(null);
    const all = data ?? [];
    const base = all.filter((row) => !fixedShopId || row.barbershop_id === fixedShopId);
    // Um nome por pessoa (a mesma pessoa pode cuidar de várias barbearias).
    const names = new Map<string, string | null>();
    await Promise.all(
      [...new Set(base.map((row) => row.user_id))].map(async (userId) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", userId)
          .maybeSingle();
        // Nunca mostrar pedaço de ID: sem nome, a pessoa aparece como "Pessoa sem nome".
        names.set(userId, profile?.full_name || null);
      }),
    );
    const shopName = (id: string) => shops.find((s) => s.id === id)?.name ?? null;
    setAllRows(all.map((row) => ({ ...row, shop_name: shopName(row.barbershop_id) })));
    setRows(
      base.map((row) => ({
        ...row,
        label: names.get(row.user_id) ?? null,
        shop_name: shopName(row.barbershop_id),
      })),
    );
  }, [shops, t, fixedShopId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (fixedShopId) setShopId(fixedShopId);
  }, [fixedShopId]);

  async function assign(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError(null);
    setResult(null);
    try {
      const normalized = email.trim().toLowerCase();
      if (!normalized || !shopId) throw new Error(t("plat.mgr.missingFields"));

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error(t("plat.invite.signInAgain"));

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

      const password = payload.created ? (payload.temporary_password ?? null) : null;
      setResult({
        state: "saved",
        text: password
          ? t("plat.mgr.accountCreated", { email: payload.email ?? normalized })
          : t("plat.mgr.linked", { email: payload.email ?? normalized }),
        password,
      });
      setEmail("");
      // Com senha temporária, a janela fica aberta mostrando a senha (ela não aparece de novo).
      if (!password) setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(friendlyAuthError(err, t("plat.mgr.linkError")));
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: Assignment) {
    setResult(null);
    const { error: removeError } = await supabase.rpc("unassign_account_manager_shop", {
      p_user_id: row.user_id,
      p_shop_id: row.barbershop_id,
    });
    // A janela de decisão mostra o erro e deixa tentar de novo.
    if (removeError) throw removeError;
    setResult({
      state: "saved",
      text: t("plat.mgr.removed", {
        name: row.label ?? t("plat.mgr.noName"),
        shop: row.shop_name ?? t("plat.mgr.shopFallback"),
      }),
    });
    await load();
  }

  // A senha temporária não volta: fechar a janela com ela na tela pede confirmação, e
  // "Já copiei a senha" apaga a senha do resultado (o texto de sucesso fica no painel).
  const guard = useTempPasswordClose(Boolean(result?.password), () => {
    setFormOpen(false);
    setResult((current) => (current ? { ...current, password: null } : current));
  });

  const removeName = removeTarget?.label ?? t("plat.mgr.noName");
  const removeShop = removeTarget?.shop_name ?? t("plat.mgr.shopFallback");

  return (
    <section className="space-y-3">
      <SectionHeader
        as={headingAs}
        icon={Briefcase}
        title={t("plat.mgr.title")}
        aside={
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setFormOpen(true);
            }}
            disabled={disabled}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-semibold transition hover:border-primary/40 disabled:opacity-50"
          >
            <Link2 className="size-4 text-gold" aria-hidden />
            {t("plat.mgr.link")}
          </button>
        }
      />
      <IconList
        size="sm"
        items={[
          { key: "care", icon: Briefcase, text: t("plat.mgr.tipCare") },
          { key: "approval", icon: Hourglass, text: t("plat.mgr.tipApproval") },
        ]}
      />

      {/* Com a janela aberta, o resultado (e a senha) aparece dentro dela. */}
      {!formOpen && (
        <ActionResult state={result?.state} text={result?.text} onDismiss={() => setResult(null)} />
      )}
      {loadError && (
        <Notice
          tone="danger"
          title={loadError}
          action={{ label: t("visual.retry"), onClick: () => void load() }}
        />
      )}

      {!loaded ? (
        <LoadingState variant="list" count={2} label={t("plat.mgr.loading")} />
      ) : rows.length === 0 ? (
        !loadError && (
          <Hint icon={Briefcase} tone="muted">
            {fixedShopId ? t("plat.mgr.emptyShop") : t("plat.mgr.empty")}
          </Hint>
        )
      ) : fixedShopId ? (
        <ul className="space-y-2">
          {rows.map((row) => {
            const name = row.label ?? t("plat.mgr.noName");
            // A mesma pessoa em outras barbearias: "+2 barbearias", com os nomes para o leitor.
            const others = allRows
              .filter((item) => item.user_id === row.user_id && item.barbershop_id !== fixedShopId)
              .map((item) => item.shop_name ?? t("plat.mgr.shopFallback"));
            return (
              <li
                key={`${row.user_id}-${row.barbershop_id}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-background px-3 py-2"
              >
                <PersonAvatar name={name} size="sm" seed={row.user_id} />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold">{name}</p>
                  {(row.can_view_dashboard || others.length > 0) && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {row.can_view_dashboard && <SeesNumbers />}
                      {others.length > 0 && (
                        <span
                          title={t("plat.mgr.alsoCares", { names: others.join(", ") })}
                          className="inline-flex"
                        >
                          <Tag icon={Store}>
                            <span aria-hidden>
                              {t(
                                others.length === 1
                                  ? "plat.mgr.otherShopsOne"
                                  : "plat.mgr.otherShopsMany",
                                { count: others.length },
                              )}
                            </span>
                            <span className="sr-only">
                              {t("plat.mgr.alsoCares", { names: others.join(", ") })}
                            </span>
                          </Tag>
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <RemoveButton row={row} name={name} onRemove={setRemoveTarget} />
              </li>
            );
          })}
        </ul>
      ) : (
        // Lista de todos: uma pessoa por cartão, com as barbearias de que cuida logo abaixo.
        <ul className="grid gap-3 lg:grid-cols-2 lg:items-start">
          {groupByPerson(rows).map(({ userId, label, items }) => {
            const name = label ?? t("plat.mgr.noName");
            return (
              <li key={userId} className="rounded-2xl border border-border bg-background p-3">
                <div className="flex items-center gap-3">
                  <PersonAvatar name={name} size="sm" seed={userId} />
                  <p className="min-w-0 flex-1 break-words text-sm font-semibold">{name}</p>
                  <Tag icon={Store}>
                    {t(items.length === 1 ? "plat.mgr.shopCountOne" : "plat.mgr.shopCountMany", {
                      count: items.length,
                    })}
                  </Tag>
                </div>
                <ul className="mt-2 space-y-1.5 border-t border-border pt-2">
                  {items.map((row) => {
                    const shopLabel = row.shop_name ?? t("plat.mgr.shopFallback");
                    return (
                      <li key={row.barbershop_id} className="flex items-center gap-2">
                        <PersonAvatar name={shopLabel} size="xs" seed={row.barbershop_id} />
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-sm">{shopLabel}</span>
                          {row.can_view_dashboard && <SeesNumbers className="mt-0.5" />}
                        </span>
                        <RemoveButton row={row} name={name} onRemove={setRemoveTarget} />
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (busy) return;
          if (open) setFormOpen(true);
          else guard.request(false);
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          className="max-h-[92dvh] max-w-md rounded-3xl border-border bg-card p-5"
        >
          <DialogTitle className="flex min-h-11 items-center gap-2 pr-12 text-lg font-bold">
            <Briefcase className="size-5 text-gold" aria-hidden />
            {fixedShop ? t("plat.mgr.formTitleShop", { shop: fixedShop.name }) : t("plat.mgr.link")}
          </DialogTitle>
          {result?.password ? (
            <div className="space-y-4">
              <ActionResult
                state={result.state}
                text={result.text}
                detail={
                  <CopyField
                    value={result.password}
                    label={t("plat.mgr.tempPassword")}
                    secret
                    mono
                    className="mt-2"
                  />
                }
              />
              <TempPasswordClose warned={guard.warned} onClose={guard.closeNow} />
            </div>
          ) : (
            <form onSubmit={assign} className="space-y-4">
              <Field label={t("plat.mgr.email")} required id={emailFieldId}>
                {(props) => (
                  <input
                    {...props}
                    required
                    type="email"
                    autoComplete="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    placeholder={t("plat.mgr.emailPlaceholder")}
                  />
                )}
              </Field>
              {!fixedShopId && (
                <Field label={t("plat.common.shop")} required id={shopFieldId}>
                  {(props) => (
                    <select
                      {...props}
                      required
                      value={shopId}
                      onChange={(e) => setShopId(e.target.value)}
                      className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
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
                  )}
                </Field>
              )}
              <label
                htmlFor={viewFieldId}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background px-3 py-2"
              >
                <Eye className="size-4 shrink-0 text-gold" aria-hidden />
                <span className="min-w-0 flex-1 text-sm font-semibold">
                  {t("plat.mgr.canSeeNumbers")}
                </span>
                <Switch
                  id={viewFieldId}
                  checked={canViewDashboard}
                  onCheckedChange={setCanViewDashboard}
                />
              </label>
              {formError && <Notice tone="danger" title={formError} />}
              <button
                type="submit"
                disabled={busy}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
                ) : (
                  <Link2 className="size-4" aria-hidden />
                )}
                {busy ? t("plat.mgr.linking") : t("plat.mgr.link")}
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        tone="danger"
        icon={Trash2}
        title={t("plat.mgr.removeTitle")}
        consequences={[
          {
            key: "loses",
            icon: XCircle,
            tone: "danger",
            text: t("plat.mgr.removeLoses", { name: removeName, shop: removeShop }),
          },
          { key: "keeps", icon: ShieldCheck, tone: "success", text: t("plat.mgr.removeKeeps") },
        ]}
        confirmLabel={t("plat.mgr.remove")}
        busyLabel={t("plat.mgr.removing")}
        confirmIcon={Trash2}
        cancelLabel={t("plat.mgr.keep")}
        errorText={t("plat.mgr.removeError")}
        onConfirm={() => (removeTarget ? remove(removeTarget) : undefined)}
      />
    </section>
  );
}

/** Um cartão por pessoa, na ordem em que aparecem (vínculos mais novos primeiro). */
function groupByPerson(rows: Assignment[]) {
  const groups = new Map<string, { userId: string; label: string | null; items: Assignment[] }>();
  for (const row of rows) {
    const group = groups.get(row.user_id) ?? { userId: row.user_id, label: null, items: [] };
    group.label = group.label ?? row.label ?? null;
    group.items.push(row);
    groups.set(row.user_id, group);
  }
  return [...groups.values()];
}

function SeesNumbers({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <StatusBadge
      tone="info"
      icon={Eye}
      label={t("plat.mgr.seesNumbers")}
      size="sm"
      className={className}
    />
  );
}

function RemoveButton({
  row,
  name,
  onRemove,
}: {
  row: Assignment;
  name: string;
  onRemove: (row: Assignment) => void;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => onRemove(row)}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:text-destructive"
      aria-label={t("plat.mgr.removeAria", {
        name,
        shop: row.shop_name ?? t("plat.mgr.shopFallback"),
      })}
    >
      <Trash2 className="size-4" aria-hidden="true" />
    </button>
  );
}
