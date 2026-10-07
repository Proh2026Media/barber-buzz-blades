import { useEffect, useId, useState } from "react";
import { FlaskConical, Loader2, Percent, User, UserPlus, Users } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  ActionResult,
  ChoiceCards,
  ChoiceChips,
  CopyField,
  Field,
  Hint,
  Notice,
  SegmentBar,
  StatusBadge,
  type ActionState,
} from "@/components/visual";
import { ROLE_ICON } from "@/features/demo/roles";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { useI18n } from "@/lib/i18n";
import { TempPasswordClose } from "./TempPasswordClose";
import { useTempPasswordClose } from "./use-temp-password-close";

type InviteRole = "owner" | "associate" | "employee";

type InviteResult = {
  ok?: boolean;
  email?: string;
  created?: boolean;
  temporary_password?: string | null;
  error?: string;
  status?: string;
  barbershop?: { name: string; slug: string };
  role?: "owner" | "partner" | "associate" | "employee";
  ownership_percent?: number | null;
};

const QUICK_SHARES = [25, 50, 75];

/**
 * Adicionar pessoa à equipe de uma barbearia: papel em cartões com o efeito, participação do
 * co-dono com atalhos e barra ao vivo, e o resultado (com a senha temporária para copiar)
 * logo acima do botão.
 */
export function InviteMemberDialog({
  open,
  onOpenChange,
  shops,
  initialShopId,
  demoMode = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shops: Tables<"barbershops">[];
  /** Barbearia já escolhida (vem da ficha ou da lista de atenção). */
  initialShopId?: string | null;
  /** Na demonstração nada vai ao servidor: o envio só mostra o que aconteceria. */
  demoMode?: boolean;
}) {
  const { t, intlLocale } = useI18n();
  const emailId = useId();
  const nameId = useId();
  const shopId = useId();
  const activeShops = shops.filter((shop) => shop.status === "active");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [shop, setShop] = useState("");
  const [role, setRole] = useState<InviteRole>("employee");
  const [share, setShare] = useState(50);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoNote, setDemoNote] = useState<string | null>(null);
  const [result, setResult] = useState<{
    state: ActionState;
    text: string;
    password?: string | null;
  } | null>(null);
  const hasPassword = Boolean(result?.password);
  const guard = useTempPasswordClose(hasPassword, () => onOpenChange(false));

  // Começa na barbearia pedida ou na primeira ATIVA (a suspensa não aparece na lista).
  useEffect(() => {
    if (!open) return;
    const wanted = activeShops.find((item) => item.id === initialShopId);
    setShop(wanted?.id ?? activeShops[0]?.id ?? "");
    setError(null);
    setResult(null);
    setDemoNote(null);
    guard.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialShopId]);

  const roleLabel = (value: InviteRole) =>
    value === "owner"
      ? t("plat.invite.roleOwner")
      : value === "associate"
        ? t("plat.invite.roleAssociate")
        : t("plat.invite.roleEmployee");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    // Duplo envio criaria dois convites para o mesmo e-mail.
    if (busy) return;
    setError(null);
    setResult(null);
    if (demoMode) {
      setDemoNote(t("plat.demo.inviteWould", { email: email.trim(), role: roleLabel(role) }));
      return;
    }
    setBusy(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error(t("plat.invite.signInAgain"));

      const { data, error: fnError } = await supabase.functions.invoke<InviteResult>(
        "invite-shop-admin",
        {
          body: {
            email: email.trim(),
            barbershop_id: shop,
            full_name: name.trim() || undefined,
            role,
            ownership_percent: role === "owner" ? share : undefined,
          },
        },
      );
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      const values = {
        email: data?.email ?? email.trim(),
        shop:
          data?.barbershop?.name ??
          activeShops.find((item) => item.id === shop)?.name ??
          t("plat.brand.shopFallback"),
        role: roleLabel(role),
      };
      const pending = data?.status === "pending";
      setResult({
        state: pending ? "pending" : "saved",
        text: data?.created
          ? t(pending ? "plat.invite.addedNewPending" : "plat.invite.addedNew", values)
          : t(pending ? "plat.invite.linkedWaiting" : "plat.invite.linked", values),
        password: data?.created ? data.temporary_password : null,
      });
      setEmail("");
      setName("");
    } catch (err) {
      setError(friendlyAuthError(err, t("plat.invite.failed")));
    } finally {
      setBusy(false);
    }
  }

  // Peso do novo co-dono nas decisões da sociedade (o convite em si vale na hora).
  const decidesAlone = share > 50;
  const rest = Math.round((100 - share) * 100) / 100;
  const pct = (value: number) => value.toLocaleString(intlLocale, { maximumFractionDigits: 2 });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        // Com a senha temporária na tela, o primeiro fechamento só avisa (ela não volta).
        if (next) onOpenChange(true);
        else guard.request(false);
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[92dvh] max-w-lg overflow-y-auto rounded-3xl border-border bg-card p-5"
      >
        <DialogTitle className="flex min-h-11 items-center gap-2 pr-12 text-lg font-bold">
          <UserPlus className="size-5 text-gold" aria-hidden />
          {t("plat.invite.heading")}
        </DialogTitle>
        <form onSubmit={submit} className="space-y-4">
          <Field label={t("plat.common.shop")} id={shopId}>
            {(props) => (
              <select
                {...props}
                required
                value={shop}
                onChange={(event) => setShop(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"
              >
                {activeShops.length === 0 && (
                  <option value="">{t("plat.invite.selectShop")}</option>
                )}
                {activeShops.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <ChoiceCards
            legend={t("plat.invite.roleAria")}
            showLegend
            value={role}
            onChange={setRole}
            columns={3}
            options={[
              {
                value: "employee",
                title: t("plat.invite.cardEmployee"),
                description: t("plat.invite.cardEmployeeHint"),
                icon: ROLE_ICON.employee,
              },
              {
                value: "associate",
                title: t("plat.invite.cardAssociate"),
                description: t("plat.invite.cardAssociateHint"),
                icon: ROLE_ICON.associate,
              },
              {
                value: "owner",
                title: t("plat.invite.cardOwner"),
                description: t("plat.invite.cardOwnerHint"),
                icon: ROLE_ICON.owner,
              },
            ]}
          />

          {role === "owner" && (
            <div className="space-y-3 rounded-2xl border border-border bg-background p-3">
              <ChoiceChips
                label={t("plat.invite.share")}
                icon={Percent}
                value={share}
                onChange={setShare}
                options={QUICK_SHARES.map((value) => ({ value, label: `${value}%` }))}
                other={{ min: 0.01, max: 99.99, step: 0.01, unit: "%" }}
              />
              <SegmentBar
                summary={t("plat.invite.shareSummary", { share: pct(share), rest: pct(rest) })}
                legend={false}
                total={100}
                segments={[
                  {
                    key: "new",
                    label: t("plat.invite.shareNew", { share: pct(share) }),
                    value: share,
                    tone: "highlight",
                  },
                  {
                    key: "rest",
                    label: t("plat.invite.shareRest", { rest: pct(rest) }),
                    value: rest,
                    tone: "neutral",
                  },
                ]}
              />
              <ul className="flex flex-wrap gap-1.5" aria-hidden>
                <li>
                  <StatusBadge
                    tone="highlight"
                    variant="dot"
                    size="sm"
                    label={t("plat.invite.shareNew", { share: pct(share) })}
                  />
                </li>
                <li>
                  <StatusBadge
                    tone="neutral"
                    variant="dot"
                    size="sm"
                    label={t("plat.invite.shareRest", { rest: pct(rest) })}
                  />
                </li>
              </ul>
              {/* Verde = vale na hora (mais da metade); âmbar de espera = precisa do OK do dono. */}
              <StatusBadge
                tone={decidesAlone ? "success" : "pending"}
                icon={decidesAlone ? User : Users}
                label={
                  decidesAlone ? t("plat.invite.decidesAlone") : t("plat.invite.decidesTogether")
                }
              />
              <Hint>{t("plat.invite.shareHint")}</Hint>
            </div>
          )}

          <Field label={t("plat.invite.email")} id={emailId}>
            {(props) => (
              <input
                {...props}
                required
                type="email"
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("plat.invite.emailPlaceholder")}
                className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"
              />
            )}
          </Field>
          <Field label={t("plat.invite.nameLabel")} optional id={nameId}>
            {(props) => (
              <input
                {...props}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"
              />
            )}
          </Field>

          {error && <Notice tone="danger" title={error} />}
          {demoNote && (
            <Notice
              tone="info"
              icon={FlaskConical}
              title={t("plat.demo.notSaved")}
              onDismiss={() => setDemoNote(null)}
            >
              {demoNote}
            </Notice>
          )}
          <ActionResult
            state={result?.state}
            text={result?.text}
            onDismiss={hasPassword ? undefined : () => setResult(null)}
            detail={
              result?.password ? (
                <CopyField
                  value={result.password}
                  label={t("plat.mgr.tempPassword")}
                  secret
                  mono
                  className="mt-2"
                />
              ) : undefined
            }
          />
          {hasPassword ? (
            <TempPasswordClose warned={guard.warned} onClose={guard.closeNow} />
          ) : (
            <button
              type="submit"
              disabled={busy || !shop}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
              ) : (
                <UserPlus className="size-4" aria-hidden />
              )}
              {busy ? t("plat.invite.busy") : t("plat.invite.submit")}
            </button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
