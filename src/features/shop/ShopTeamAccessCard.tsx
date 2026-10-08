import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Crown,
  Handshake,
  Hourglass,
  Lock,
  Mail,
  PauseCircle,
  PieChart,
  RefreshCw,
  Save,
  Settings2,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  ActionResult,
  ChoiceCards,
  ChoiceChips,
  ConfirmDialog,
  CopyField,
  EmptyState,
  Field,
  FieldMessage,
  Hint,
  LoadingState,
  Notice,
  PersonAvatar,
  STATE,
  SectionHeader,
  StatusBadge,
  Steps,
  type ActionState,
} from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { ShopPermissionsMatrix } from "@/features/shop/ShopPermissionsMatrix";
import { t as tNow, useI18n } from "@/lib/i18n";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { cn } from "@/lib/utils";
import { FOUNDER_META, RoleBadge, formatPercent, isOwnerRole } from "./roles";
import { TeamInviteContext } from "./team-invite";
import {
  GovernanceModeBadge,
  OwnershipBar,
  activeOwners,
  firstName,
  governanceModeOf,
  loadTeamMembers,
  type TeamMember,
} from "./team";

type EditableRole = "employee" | "associate" | "owner";

type ShopTeamAccessCardProps = {
  shopId: string;
  canApplyProtected: boolean;
  canEditSociety: boolean;
  onChanged?: () => void;
  /** Profissionais já carregados pelo painel: dão a foto de cada pessoa. */
  staff?: Tables<"staff">[];
  /** Quem está vendo (marca "Você" na lista). */
  currentUserId?: string;
  /** "Ver pedido": leva às decisões entre donos. */
  onOpenDecisions?: () => void;
};

type Outcome = { memberId: string | null; state: ActionState; text: string };
const SHARE_OPTIONS = [10, 25, 40, 50];

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
    throw new Error(tNow("eq.invite.failed"));
  }
  if (!response.ok) throw new Error(payload.error || tNow("eq.invite.failed"));
  return payload;
}

/** O que cada papel faz, em uma linha (o detalhe fica em "O que cada papel pode fazer"). */
function useRoleOptions() {
  const { t } = useI18n();
  return [
    {
      value: "employee" as const,
      icon: Users,
      title: t("eq.role.employee"),
      description: t("eq.role.employeeDoes"),
    },
    {
      value: "associate" as const,
      icon: Handshake,
      title: t("eq.role.associate"),
      description: t("eq.role.associateDoes"),
    },
    {
      value: "owner" as const,
      icon: Crown,
      title: t("eq.role.owner"),
      description: t("eq.role.ownerDoes"),
    },
  ];
}

/**
 * Divisão das partes depois de uma mudança, pela regra do servidor
 * (`apply_update_shop_member` / `apply_add_shop_member`): a diferença sai ou volta para o dono
 * com a maior parte (fora a própria pessoa). Devolve null se a maior parte não comporta.
 */
function previewShares(
  members: TeamMember[],
  target: { id: string | null; name: string; key: string; wasOwner: boolean; was: number },
  next: { owner: boolean; percent: number },
) {
  const owners = activeOwners(members).map((owner) => ({
    key: owner.user_id,
    id: owner.id,
    name: owner.display_name,
    percent: Number(owner.ownership_percent ?? 0),
    isNew: false,
  }));
  const others = owners.filter((owner) => owner.id !== target.id);
  const donor = others[0];
  if (!next.owner) {
    if (!target.wasOwner) return { owners, ok: true };
    if (!donor) return { owners, ok: false };
    donor.percent += target.was;
    return { owners: others, ok: true };
  }
  const delta = next.percent - (target.wasOwner ? target.was : 0);
  if (!donor) return { owners, ok: delta === 0 };
  if (delta > 0 && donor.percent <= delta) return { owners, ok: false };
  donor.percent -= delta;
  const self = {
    key: target.key,
    id: target.id ?? "new",
    name: target.name,
    percent: next.percent,
    isNew: !target.wasOwner,
  };
  return { owners: [...others, self].sort((a, b) => b.percent - a.percent), ok: true };
}

function modeOfShares(shares: { percent: number }[]) {
  if (shares.length <= 1) return "single" as const;
  const values = shares.map((s) => s.percent);
  return Math.min(...values) === Math.max(...values) ? ("equal" as const) : ("majority" as const);
}

/** Parte do dono: botões rápidos + "Outro…", com a divisão antes/depois e o modo resultante. */
function ShareChooser({
  value,
  onChange,
  members,
  target,
}: {
  value: number;
  onChange: (value: number) => void;
  members: TeamMember[];
  target: { id: string | null; name: string; key: string; wasOwner: boolean; was: number };
}) {
  const { t, intlLocale } = useI18n();
  const preview = previewShares(members, target, { owner: true, percent: value });
  const mode = modeOfShares(preview.owners);
  const before = activeOwners(members);
  return (
    <div className="space-y-3">
      <ChoiceChips
        label={t("eq.share.label")}
        icon={PieChart}
        options={SHARE_OPTIONS.map((n) => ({ value: n, label: `${n}%` }))}
        value={value}
        onChange={onChange}
        other={{ min: 1, max: 99, step: 1, unit: "%", label: t("eq.share.other") }}
      />
      {preview.ok ? (
        <div className="space-y-2 rounded-xl bg-background/70 p-3">
          <p className="text-xs font-bold text-muted-foreground">{t("eq.share.after")}</p>
          <OwnershipBar owners={preview.owners} />
          <GovernanceModeBadge
            mode={mode}
            leader={
              mode === "majority"
                ? ({
                    display_name: preview.owners[0]!.name,
                    ownership_percent: preview.owners[0]!.percent,
                  } as TeamMember)
                : null
            }
          />
        </div>
      ) : (
        <FieldMessage tone="error">
          {t("eq.share.tooBig", {
            name: before[0] ? firstName(before[0].display_name) : t("eq.gov.otherOwners"),
            percent: formatPercent(Number(before[0]?.ownership_percent ?? 0), intlLocale),
          })}
        </FieldMessage>
      )}
    </div>
  );
}

export function ShopTeamAccessCard({
  shopId,
  canApplyProtected,
  canEditSociety,
  onChanged,
  staff,
  currentUserId,
  onOpenDecisions,
}: ShopTeamAccessCardProps) {
  const { t } = useI18n();
  const roleOptions = useRoleOptions();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // Gerenciar uma pessoa (folha com papel, parte, acesso e responsável principal).
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [draftRole, setDraftRole] = useState<EditableRole>("employee");
  const [draftShare, setDraftShare] = useState(25);
  const [draftActive, setDraftActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogResult, setDialogResult] = useState<Outcome | null>(null);
  const [founderAsk, setFounderAsk] = useState(false);

  // Convite.
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<EditableRole | null>(null);
  const [inviteShare, setInviteShare] = useState(25);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteTouched, setInviteTouched] = useState(false);
  const [inviteDone, setInviteDone] = useState<{
    pending: boolean;
    email: string;
    password: string | null;
  } | null>(null);
  // Convite aberto pelo cartão de um profissional: hoje o servidor cria um cartão novo.
  const [inviteFromCard, setInviteFromCard] = useState(false);

  // Um só ponto zera o convite (aba Equipe e "Convidar outra" usam o mesmo).
  const resetInvite = useCallback(() => {
    setInviteEmail("");
    setInviteName("");
    setInviteRole(null);
    setInviteShare(25);
    setInviteError(null);
    setInviteTouched(false);
    setInviteDone(null);
    setInviteFromCard(false);
  }, []);

  const photoOf = useMemo(() => {
    const map = new Map((staff ?? []).map((row) => [row.id, row.avatar_url ?? null]));
    return (member: TeamMember) => map.get(member.staff_id) ?? null;
  }, [staff]);

  const owners = useMemo(() => activeOwners(members), [members]);
  const mode = governanceModeOf(members);
  const deciders = (mode === "majority" ? owners.slice(0, 1) : owners).filter(
    (owner) => owner.user_id !== currentUserId,
  );
  const decidersText = deciders.length
    ? deciders.map((owner) => firstName(owner.display_name)).join(", ")
    : t("eq.gov.otherOwners");
  const showLegacy = members.some((member) => member.role === "partner");

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setMembers(await loadTeamMembers(shopId));
    } catch (err) {
      setLoadError(friendlyAuthError(err, tNow("team.access.loadError")));
    } finally {
      setLoaded(true);
    }
  }, [shopId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Pedido da aba Equipe: abre o convite (com o nome do profissional, quando veio do cartão dele).
  const inviteRequest = useContext(TeamInviteContext);
  const pendingInvite = inviteRequest.request;
  const clearInviteRequest = inviteRequest.clear;
  useEffect(() => {
    if (!pendingInvite) return;
    clearInviteRequest();
    if (!canEditSociety) return;
    resetInvite();
    setInviteName(pendingInvite.name ?? "");
    setInviteFromCard(Boolean(pendingInvite.name));
    setInviteOpen(true);
  }, [pendingInvite, clearInviteRequest, canEditSociety, resetInvite]);

  function openManage(member: TeamMember) {
    setEditing(member);
    setDraftRole(isOwnerRole(member.role) ? "owner" : (member.role as EditableRole));
    setDraftShare(Number(member.ownership_percent ?? 25));
    setDraftActive(member.active);
    setDialogResult(null);
  }

  const editingTarget = editing
    ? {
        id: editing.id,
        name: editing.display_name,
        key: editing.user_id,
        wasOwner: isOwnerRole(editing.role) && editing.active,
        was: Number(editing.ownership_percent ?? 0),
      }
    : null;
  const editingRole: EditableRole | null = editing
    ? isOwnerRole(editing.role)
      ? "owner"
      : (editing.role as EditableRole)
    : null;
  const dirty =
    !!editing &&
    (draftRole !== editingRole ||
      draftActive !== editing.active ||
      (draftRole === "owner" && draftShare !== Number(editing.ownership_percent ?? 0)));
  const shareOk =
    !editing ||
    !editingTarget ||
    previewShares(members, editingTarget, {
      owner: draftRole === "owner",
      percent: draftShare,
    }).ok;

  async function saveMember() {
    if (!editing || !canEditSociety || saving || !dirty) return;
    setSaving(true);
    setDialogResult({ memberId: editing.id, state: "saving", text: t("eq.member.saving") });
    try {
      const { data, error: failure } = await supabase.rpc("shop_update_member", {
        p_shop_id: shopId,
        p_member_id: editing.id,
        p_role: draftRole !== editingRole ? draftRole : null,
        p_ownership_percent:
          draftRole === "owner" &&
          (draftRole !== editingRole || draftShare !== Number(editing.ownership_percent ?? 0))
            ? draftShare
            : null,
        p_active: draftActive !== editing.active ? draftActive : null,
      });
      if (failure) throw failure;
      const status =
        data && typeof data === "object" && "status" in data
          ? String((data as { status?: string }).status)
          : "applied";
      const result: Outcome =
        status === "pending"
          ? {
              memberId: editing.id,
              state: "pending",
              text: t("eq.member.sentFor", { names: decidersText }),
            }
          : {
              memberId: editing.id,
              state: "saved",
              text: t("eq.member.saved", { name: firstName(editing.display_name) }),
            };
      setDialogResult(result);
      setOutcome(result);
      await load();
      onChanged?.();
    } catch (err) {
      setDialogResult({
        memberId: editing.id,
        state: "error",
        text: friendlyAuthError(err, t("team.access.updateFailed")),
      });
    } finally {
      setSaving(false);
    }
  }

  async function transferFounder() {
    if (!editing) return;
    const { error: failure } = await supabase.rpc("transfer_shop_founder", {
      p_shop_id: shopId,
      p_new_founder_user_id: editing.user_id,
    });
    if (failure) throw new Error(friendlyAuthError(failure, t("team.access.transferFailed")));
    const result: Outcome = {
      memberId: editing.id,
      state: "saved",
      text: t("eq.founder.done", { name: firstName(editing.display_name) }),
    };
    setOutcome(result);
    setDialogResult(result);
    await load();
    onChanged?.();
    setEditing((current) => (current ? { ...current, is_founder: true } : current));
  }

  const emailOk = /^\S+@\S+\.\S+$/.test(inviteEmail.trim());
  const inviteShareOk =
    inviteRole !== "owner" ||
    previewShares(
      members,
      { id: null, name: inviteName || inviteEmail || "?", key: "new", wasOwner: false, was: 0 },
      { owner: true, percent: inviteShare },
    ).ok;

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    setInviteTouched(true);
    if (!canEditSociety || inviting || !emailOk || !inviteRole || !inviteShareOk) return;
    setInviting(true);
    setInviteError(null);
    try {
      const payload = await inviteMember({
        email: inviteEmail.trim(),
        barbershop_id: shopId,
        full_name: inviteName.trim() || undefined,
        role: inviteRole,
        ownership_percent: inviteRole === "owner" ? inviteShare : undefined,
      });
      const pending = payload.status === "pending";
      setInviteDone({
        pending,
        email: payload.email ?? inviteEmail.trim(),
        password: payload.temporary_password ?? null,
      });
      setOutcome({
        memberId: null,
        state: pending ? "pending" : "saved",
        text: pending
          ? t("eq.invite.pendingFor", { email: payload.email ?? inviteEmail, names: decidersText })
          : t("eq.invite.joined", { email: payload.email ?? inviteEmail }),
      });
      await load();
      onChanged?.();
    } catch (err) {
      setInviteError(friendlyAuthError(err, t("eq.invite.failed")));
    } finally {
      setInviting(false);
    }
  }

  const resultFor = (memberId: string | null) =>
    outcome && outcome.memberId === memberId ? (
      <ActionResult
        state={outcome.state}
        text={outcome.text}
        autoHideMs={outcome.state === "saved" ? 5000 : undefined}
        onDismiss={() => setOutcome(null)}
        detail={
          outcome.state === "pending" && onOpenDecisions ? (
            <button
              type="button"
              onClick={onOpenDecisions}
              className="min-h-11 text-xs font-bold underline underline-offset-2"
            >
              {t("eq.common.seeRequest")}
            </button>
          ) : undefined
        }
      />
    ) : null;

  const stepIndex = !emailOk ? 0 : !inviteRole ? 1 : 2;

  return (
    <section className="app-action-card space-y-4 p-4" aria-labelledby="team-access-title">
      <SectionHeader
        icon={Users}
        id="team-access-title"
        title={t("eq.people.title")}
        description={t("eq.people.hint")}
      />

      {canEditSociety ? (
        <button
          type="button"
          onClick={() => {
            resetInvite();
            setInviteOpen(true);
          }}
          className="action-button action-confirm min-h-11 w-full justify-center sm:w-auto"
        >
          <UserPlus className="size-4" aria-hidden />
          {t("eq.invite.open")}
        </button>
      ) : (
        <Hint icon={Lock} tone="muted">
          {t("team.access.readOnlyHint")}
        </Hint>
      )}
      {resultFor(null)}

      {owners.length > 1 && (
        <div className="space-y-2 rounded-2xl bg-background/70 p-3">
          <GovernanceModeBadge mode={mode} leader={owners[0]} />
          <OwnershipBar
            owners={owners.map((owner) => ({
              key: owner.user_id,
              name: owner.display_name,
              percent: Number(owner.ownership_percent ?? 0),
            }))}
          />
        </div>
      )}

      {!loaded ? (
        <LoadingState variant="list" count={3} label={t("eq.people.loading")} />
      ) : loadError ? (
        <EmptyState
          variant="plain"
          status="danger"
          title={t("eq.common.loadFailed")}
          description={loadError}
          action={
            <button type="button" onClick={() => void load()} className="action-button min-h-11">
              <RefreshCw className="size-4" aria-hidden />
              {t("eq.common.retry")}
            </button>
          }
        />
      ) : members.length === 0 ? (
        <EmptyState variant="plain" tone="people" title={t("team.access.empty")} />
      ) : (
        <ul className="space-y-2" aria-label={t("eq.people.title")}>
          {members.map((member) => {
            const you = member.user_id === currentUserId;
            return (
              <li key={member.id} className="space-y-2">
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border border-border bg-background/80 p-3",
                    !member.active && "border-dashed bg-muted/40",
                  )}
                >
                  <PersonAvatar
                    name={member.display_name}
                    src={photoOf(member)}
                    seed={member.user_id}
                    size="md"
                    className={cn(!member.active && "opacity-60 grayscale")}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 text-sm font-bold">
                      <span className="break-words">{member.display_name}</span>
                      {you && (
                        <span className="rounded-full bg-muted px-2 text-[11px] font-bold text-muted-foreground">
                          {t("eq.people.you")}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.email || t("team.access.noEmail")}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <RoleBadge role={member.role} percent={member.ownership_percent} />
                      {member.is_founder && (
                        <StatusBadge
                          tone={FOUNDER_META.tone}
                          icon={FOUNDER_META.icon}
                          size="sm"
                          label={t("eq.role.founder")}
                        />
                      )}
                      {member.active ? (
                        <StatusBadge
                          {...STATE.active}
                          variant="dot"
                          label={t("eq.people.active")}
                        />
                      ) : (
                        <StatusBadge {...STATE.paused} size="sm" label={t("eq.people.paused")} />
                      )}
                    </div>
                    {/* Celular: "Gerenciar" com texto numa linha própria, abaixo dos selos. */}
                    {canEditSociety && (
                      <div className="mt-2 sm:hidden">
                        <button
                          type="button"
                          onClick={() => openManage(member)}
                          aria-label={t("eq.member.manageOf", { name: member.display_name })}
                          className="action-button min-h-11 w-full justify-center"
                        >
                          <Settings2 className="size-4" aria-hidden />
                          {t("eq.member.manage")}
                        </button>
                      </div>
                    )}
                  </div>
                  {canEditSociety && (
                    <div className="hidden shrink-0 sm:block">
                      <button
                        type="button"
                        onClick={() => openManage(member)}
                        aria-label={t("eq.member.manageOf", { name: member.display_name })}
                        title={t("eq.member.manageOf", { name: member.display_name })}
                        className="action-button min-h-11 justify-center px-4"
                      >
                        <Settings2 className="size-4" aria-hidden />
                        {t("eq.member.manage")}
                      </button>
                    </div>
                  )}
                </div>
                {resultFor(member.id)}
              </li>
            );
          })}
        </ul>
      )}

      {/* O que cada papel pode fazer: logo abaixo das pessoas que têm esses papéis. */}
      <div className="border-t border-border/60 pt-4">
        <ShopPermissionsMatrix
          shopId={shopId}
          canEdit={canApplyProtected}
          showLegacy={showLegacy}
        />
      </div>

      {/* Gerenciar uma pessoa: nada muda sem "Salvar mudanças". */}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open && !saving) setEditing(null);
        }}
      >
        <DialogContent className="max-w-lg space-y-1 rounded-3xl border-border bg-card p-5">
          {editing && (
            <>
              <div className="flex items-center gap-3 pe-10">
                <PersonAvatar
                  name={editing.display_name}
                  src={photoOf(editing)}
                  seed={editing.user_id}
                  size="md"
                />
                <div className="min-w-0">
                  <DialogTitle className="text-base font-extrabold break-words">
                    {editing.display_name}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    {editing.email || t("team.access.noEmail")}
                  </DialogDescription>
                </div>
              </div>

              {editing.is_founder ? (
                <Notice tone="highlight" icon={BadgeCheck} role="none" title={t("eq.role.founder")}>
                  {t("eq.founder.locked")}
                </Notice>
              ) : null}

              <ChoiceCards
                legend={t("eq.member.role")}
                showLegend
                value={draftRole}
                onChange={setDraftRole}
                disabled={editing.is_founder || saving}
                options={roleOptions}
              />

              {draftRole === "owner" && editingTarget && (
                <ShareChooser
                  value={draftShare}
                  onChange={setDraftShare}
                  members={members}
                  target={editingTarget}
                />
              )}

              <ChoiceChips
                label={t("eq.member.access")}
                icon={editing.is_founder ? Lock : PauseCircle}
                value={draftActive ? "on" : "off"}
                onChange={(value) => setDraftActive(value === "on")}
                disabled={editing.is_founder || saving}
                options={[
                  { value: "on", label: t("eq.people.active"), icon: CheckCircle2 },
                  { value: "off", label: t("eq.member.pause"), icon: PauseCircle },
                ]}
                hint={!draftActive ? t("eq.member.pauseEffect") : undefined}
              />

              {!editing.is_founder && editing.active && isOwnerRole(editing.role) && (
                <button
                  type="button"
                  onClick={() => setFounderAsk(true)}
                  disabled={saving}
                  className="action-button min-h-11 w-full justify-center"
                >
                  <BadgeCheck className="size-4" aria-hidden />
                  {t("eq.founder.make")}
                </button>
              )}

              {dialogResult && (
                <ActionResult
                  state={dialogResult.state}
                  text={dialogResult.text}
                  onRetry={dialogResult.state === "error" ? () => void saveMember() : undefined}
                  detail={
                    dialogResult.state === "pending" && onOpenDecisions ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(null);
                          onOpenDecisions();
                        }}
                        className="min-h-11 text-xs font-bold underline underline-offset-2"
                      >
                        {t("eq.common.seeRequest")}
                      </button>
                    ) : undefined
                  }
                />
              )}

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  disabled={saving}
                  className="action-button min-h-11 justify-center"
                >
                  {dirty ? t("eq.common.cancel") : t("eq.common.close")}
                </button>
                <button
                  type="button"
                  onClick={() => void saveMember()}
                  disabled={!dirty || saving || !shareOk}
                  className="action-button action-confirm min-h-11 justify-center"
                >
                  <Save className="size-4" aria-hidden />
                  {saving
                    ? t("eq.member.saving")
                    : t("eq.member.save", { name: firstName(editing.display_name) })}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={founderAsk}
        onOpenChange={setFounderAsk}
        tone="warning"
        icon={BadgeCheck}
        title={t("eq.founder.askTitle", { name: editing ? firstName(editing.display_name) : "" })}
        consequences={[
          {
            icon: BadgeCheck,
            tone: "success",
            text: t("eq.founder.c1", { name: editing ? firstName(editing.display_name) : "" }),
          },
          { icon: Lock, tone: "muted", text: t("eq.founder.c2") },
          { icon: XCircle, tone: "warning", text: t("eq.founder.c3") },
        ]}
        confirmLabel={t("eq.founder.confirm")}
        busyLabel={t("eq.member.saving")}
        confirmIcon={BadgeCheck}
        cancelLabel={t("eq.common.cancel")}
        onConfirm={transferFounder}
      />

      {/* Convidar pessoa: e-mail, papel e (para dono) a parte, com a prévia da divisão. */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          if (!inviting) setInviteOpen(open);
        }}
      >
        <DialogContent className="max-w-lg rounded-3xl border-border bg-card p-5">
          <div className="pe-10">
            <DialogTitle className="flex items-center gap-2 text-base font-extrabold">
              <UserPlus className="size-5 text-gold" aria-hidden />
              {t("eq.invite.title")}
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs text-muted-foreground">
              {t("eq.invite.hint")}
            </DialogDescription>
          </div>
          {inviteDone ? (
            <div className="space-y-4">
              <EmptyState
                variant="plain"
                status={inviteDone.pending ? "pending" : "success"}
                icon={inviteDone.pending ? Hourglass : CheckCircle2}
                title={
                  inviteDone.pending
                    ? t("eq.invite.pendingTitle")
                    : t("eq.invite.joinedTitle", { email: inviteDone.email })
                }
                description={
                  inviteDone.pending
                    ? t("eq.invite.pendingFor", { email: inviteDone.email, names: decidersText })
                    : undefined
                }
              />
              {inviteDone.password && (
                <div className="space-y-2">
                  <CopyField
                    label={t("eq.invite.password")}
                    value={inviteDone.password}
                    secret
                    mono
                    shareTitle={t("eq.invite.password")}
                  />
                  <Hint icon={Lock} tone="warning">
                    {t("eq.invite.passwordOnce")}
                  </Hint>
                </div>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={resetInvite}
                  className="action-button min-h-11 justify-center"
                >
                  <UserPlus className="size-4" aria-hidden />
                  {t("eq.invite.another")}
                </button>
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  className="action-button action-confirm min-h-11 justify-center"
                >
                  {t("eq.common.done")}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={(event) => void handleInvite(event)} className="space-y-4" noValidate>
              <Steps
                label={t("eq.invite.title")}
                steps={[
                  { key: "email", label: t("eq.invite.stepEmail"), icon: Mail },
                  { key: "role", label: t("eq.invite.stepRole"), icon: Users },
                  { key: "send", label: t("eq.invite.stepSend"), icon: UserPlus },
                ].map((step, index) => ({
                  ...step,
                  status: index < stepIndex ? "done" : index === stepIndex ? "current" : "upcoming",
                }))}
              />
              <Field
                label={t("team.access.email")}
                required
                error={inviteTouched && !emailOk ? t("eq.invite.emailError") : undefined}
              >
                {(props) => (
                  <input
                    {...props}
                    type="email"
                    autoComplete="off"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="h-11 w-full rounded-[var(--control-radius)] border border-border/70 bg-background px-3 text-sm"
                    disabled={inviting}
                    placeholder={t("team.access.emailPlaceholder")}
                  />
                )}
              </Field>
              <Field label={t("team.access.name")} optional>
                {(props) => (
                  <input
                    {...props}
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="h-11 w-full rounded-[var(--control-radius)] border border-border/70 bg-background px-3 text-sm"
                    disabled={inviting}
                  />
                )}
              </Field>
              {inviteFromCard && (
                <Notice tone="warning" icon={UserPlus} role="none" title={t("eq.invite.newCard")}>
                  {t("eq.invite.newCardHint")}
                </Notice>
              )}
              <ChoiceCards
                legend={t("eq.invite.roleQuestion")}
                showLegend
                value={inviteRole}
                onChange={setInviteRole}
                disabled={inviting}
                options={roleOptions}
              />
              {inviteTouched && !inviteRole && (
                <FieldMessage tone="error">{t("eq.invite.roleError")}</FieldMessage>
              )}
              {inviteRole === "owner" && (
                <ShareChooser
                  value={inviteShare}
                  onChange={setInviteShare}
                  members={members}
                  target={{
                    id: null,
                    name:
                      inviteName.trim() || inviteEmail.split("@")[0] || t("eq.invite.newPerson"),
                    key: "new",
                    wasOwner: false,
                    was: 0,
                  }}
                />
              )}
              {!canApplyProtected && (
                <Hint icon={Hourglass} tone="pending">
                  {t("eq.invite.needsOk", { names: decidersText })}
                </Hint>
              )}
              {inviteError && <ActionResult state="error" text={inviteError} reveal={false} />}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  disabled={inviting}
                  className="action-button min-h-11 justify-center"
                >
                  {t("eq.common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={inviting || !inviteShareOk}
                  className="action-button action-confirm min-h-11 justify-center"
                >
                  <UserPlus className="size-4" aria-hidden />
                  {inviting ? t("team.access.inviting") : t("eq.invite.send")}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
