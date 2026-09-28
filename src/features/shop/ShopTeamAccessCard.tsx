import { useCallback, useEffect, useState } from "react";
import { Crown, Link2, RefreshCw, UserPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ShopPermissionsMatrix } from "@/features/shop/ShopPermissionsMatrix";
import { t as tNow, useI18n, type MessageKey } from "@/lib/i18n";
import { friendlyAuthError } from "@/lib/auth/friendly-error";

type TeamMember = {
  id: string;
  user_id: string;
  staff_id: string;
  role: "owner" | "partner" | "associate" | "employee";
  ownership_percent: number | null;
  active: boolean;
  display_name: string;
  email: string | null;
  is_founder: boolean;
  created_at: string;
};

type InviteRole = "employee" | "associate" | "owner";

const ROLE_LABEL_KEY: Record<string, MessageKey> = {
  owner: "team.perm.role.owner",
  partner: "team.perm.role.partner",
  associate: "team.perm.role.associate",
  employee: "team.perm.role.employee",
};

type ShopTeamAccessCardProps = {
  shopId: string;
  canApplyProtected: boolean;
  canEditSociety: boolean;
  onChanged?: () => void;
};

async function inviteMember(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error(tNow("team.access.sessionExpired"));

  const base = import.meta.env.VITE_SUPABASE_URL || "";
  const response = await fetch(`${base}/functions/v1/invite-shop-admin`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let payload: {
    error?: string;
    status?: string;
    temporary_password?: string | null;
    email?: string;
  } = {};
  try {
    payload = raw ? (JSON.parse(raw) as typeof payload) : {};
  } catch {
    throw new Error(tNow("team.access.inviteFailedStatus", { status: response.status }));
  }
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

export function ShopTeamAccessCard({
  shopId,
  canApplyProtected,
  canEditSociety,
  onChanged,
}: ShopTeamAccessCardProps) {
  const { t } = useI18n();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("employee");
  const [inviteOwnership, setInviteOwnership] = useState("40");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: failure } = await supabase.rpc("list_shop_team_members", {
        p_shop_id: shopId,
      });
      if (failure) throw failure;
      setMembers(Array.isArray(data) ? (data as TeamMember[]) : []);
    } catch (err) {
      setMembers([]);
      setError(friendlyAuthError(err, tNow("team.access.loadError")));
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    if (!canEditSociety || busy) return;
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const payload = await inviteMember({
        email: inviteEmail.trim(),
        barbershop_id: shopId,
        full_name: inviteName.trim() || undefined,
        role: inviteRole,
        ownership_percent: inviteRole === "owner" ? Number(inviteOwnership) : undefined,
      });
      const pending = payload.status === "pending";
      setMessage(
        pending
          ? t("team.access.invitePending", { email: payload.email ?? inviteEmail })
          : t("team.access.inviteLinked", { email: payload.email ?? inviteEmail }) +
              (payload.temporary_password
                ? ` ${t("team.access.tempPassword", { password: payload.temporary_password })}`
                : ""),
      );
      setInviteEmail("");
      setInviteName("");
      setInviteRole("employee");
      await load();
      onChanged?.();
    } catch (err) {
      setError(friendlyAuthError(err, t("team.access.inviteFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function updateMember(
    member: TeamMember,
    patch: { role?: InviteRole | "partner"; ownership_percent?: number; active?: boolean },
  ) {
    if (!canEditSociety || busy) return;
    if (member.is_founder && (patch.active === false || (patch.role && patch.role !== "owner"))) {
      setError(t("team.access.founderLocked"));
      return;
    }
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const { data, error: failure } = await supabase.rpc("shop_update_member", {
        p_shop_id: shopId,
        p_member_id: member.id,
        p_role: patch.role ?? null,
        p_ownership_percent: patch.ownership_percent ?? null,
        p_active: patch.active ?? null,
      });
      if (failure) throw failure;
      const status =
        data && typeof data === "object" && "status" in data
          ? String((data as { status?: string }).status)
          : "applied";
      setMessage(
        status === "pending" ? t("team.access.changeSent") : t("team.access.memberUpdated"),
      );
      await load();
      onChanged?.();
    } catch (err) {
      setError(friendlyAuthError(err, t("team.access.updateFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function transferFounder(member: TeamMember) {
    if (!canEditSociety || busy || !member.active) return;
    if (member.role !== "owner" && member.role !== "partner") {
      setError(t("team.access.founderMustBeOwner"));
      return;
    }
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const { error: failure } = await supabase.rpc("transfer_shop_founder", {
        p_shop_id: shopId,
        p_new_founder_user_id: member.user_id,
      });
      if (failure) throw failure;
      setMessage(t("team.access.founderTransferred", { name: member.display_name }));
      await load();
      onChanged?.();
    } catch (err) {
      setError(friendlyAuthError(err, t("team.access.transferFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="app-action-card space-y-5 p-5" aria-label={t("team.access.aria")}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--control-radius)] bg-muted text-foreground">
          <Users className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{t("team.access.title")}</p>
          <p className="text-xs text-muted-foreground">{t("team.access.hint")}</p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-[var(--button-radius)] border border-border/70 bg-background px-3 text-xs font-semibold disabled:opacity-50"
          disabled={loading || busy}
          onClick={() => void load()}
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          {t("team.access.refresh")}
        </button>
      </div>

      {canEditSociety ? (
        <form
          onSubmit={(event) => void handleInvite(event)}
          className="space-y-3 border-t border-border/50 pt-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("team.access.inviteTitle")}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">{t("team.access.email")}</span>
              <input
                required
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="h-11 w-full rounded-[var(--control-radius)] border border-border/70 bg-background px-3 text-sm"
                disabled={busy}
                placeholder={t("team.access.emailPlaceholder")}
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">{t("team.access.name")}</span>
              <input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="h-11 w-full rounded-[var(--control-radius)] border border-border/70 bg-background px-3 text-sm"
                disabled={busy}
                placeholder={t("team.access.optional")}
              />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">{t("team.access.role")}</span>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as InviteRole)}
                className="h-11 w-full rounded-[var(--control-radius)] border border-border/70 bg-background px-3 text-sm"
                disabled={busy}
              >
                <option value="employee">{t("team.perm.role.employee")}</option>
                <option value="associate">{t("team.perm.role.associate")}</option>
                <option value="owner">{t("team.access.roleOwnerPartnership")}</option>
              </select>
            </label>
            {inviteRole === "owner" ? (
              <label className="block text-xs">
                <span className="mb-1 block text-muted-foreground">
                  {t("team.access.ownership")}
                </span>
                <input
                  required
                  type="number"
                  min={0.01}
                  max={99.99}
                  step={0.01}
                  value={inviteOwnership}
                  onChange={(e) => setInviteOwnership(e.target.value)}
                  className="h-11 w-full rounded-[var(--control-radius)] border border-border/70 bg-background px-3 text-sm"
                  disabled={busy}
                />
              </label>
            ) : null}
          </div>
          {!canApplyProtected ? (
            <p className="text-xs text-muted-foreground">{t("team.access.invitePendingHint")}</p>
          ) : null}
          <button
            type="submit"
            disabled={busy || !inviteEmail.trim()}
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--button-radius)] bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
          >
            <UserPlus className="size-4" />
            {busy ? t("team.access.inviting") : t("team.access.invite")}
          </button>
        </form>
      ) : (
        <p className="border-t border-border/50 pt-4 text-xs text-muted-foreground">
          {t("team.access.readOnlyHint")}
        </p>
      )}

      <div className="space-y-2 border-t border-border/50 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("team.access.members")}
        </p>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("team.access.loading")}</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("team.access.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {members.map((member) => (
              <li
                key={member.id}
                className="rounded-[var(--control-radius)] border border-border/60 bg-background/80 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {member.display_name}
                      {member.is_founder ? (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <Crown className="size-3.5" aria-hidden />
                          {t("team.access.founder")}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.email || t("team.access.noEmail")} ·{" "}
                      {ROLE_LABEL_KEY[member.role] ? t(ROLE_LABEL_KEY[member.role]) : member.role}
                      {member.ownership_percent != null
                        ? ` · ${Number(member.ownership_percent)}%`
                        : ""}
                      {!member.active ? ` · ${t("team.access.inactive")}` : ""}
                    </p>
                  </div>
                  {canEditSociety ? (
                    <div className="flex flex-wrap gap-2">
                      <select
                        aria-label={t("team.access.roleOf", { name: member.display_name })}
                        className="h-10 rounded-[var(--control-radius)] border border-border/70 bg-background px-2 text-xs"
                        value={member.role === "partner" ? "owner" : member.role}
                        disabled={busy || member.is_founder}
                        onChange={(e) => {
                          const role = e.target.value as InviteRole;
                          const ownership =
                            role === "owner"
                              ? Number(member.ownership_percent ?? inviteOwnership)
                              : undefined;
                          void updateMember(member, {
                            role,
                            ownership_percent: ownership,
                          });
                        }}
                      >
                        <option value="employee">{t("team.perm.role.employee")}</option>
                        <option value="associate">{t("team.perm.role.associate")}</option>
                        <option value="owner">{t("team.access.roleOwner")}</option>
                      </select>
                      <button
                        type="button"
                        className="inline-flex h-10 items-center rounded-[var(--button-radius)] border border-border/70 px-3 text-xs font-semibold disabled:opacity-50"
                        disabled={busy || member.is_founder}
                        onClick={() => void updateMember(member, { active: !member.active })}
                      >
                        {member.active ? t("team.access.deactivate") : t("team.access.reactivate")}
                      </button>
                      {!member.is_founder &&
                      member.active &&
                      (member.role === "owner" || member.role === "partner") ? (
                        <button
                          type="button"
                          className="inline-flex h-10 items-center gap-1 rounded-[var(--button-radius)] border border-border/70 px-3 text-xs font-semibold disabled:opacity-50"
                          disabled={busy}
                          onClick={() => void transferFounder(member)}
                          title={t("team.access.transferTitle")}
                        >
                          <Link2 className="size-3.5" />
                          {t("team.access.makeFounder")}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border/50 pt-4">
        <ShopPermissionsMatrix shopId={shopId} canEdit={canApplyProtected || canEditSociety} />
      </div>

      {message ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
