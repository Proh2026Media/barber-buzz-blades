import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  Hourglass,
  Info,
  Loader2,
  RefreshCw,
  Scale,
  TimerOff,
  X,
  XCircle,
} from "lucide-react";
import {
  ActionResult,
  announce,
  Countdown,
  DetailList,
  EmptyState,
  Hint,
  IconList,
  IconTile,
  LoadingState,
  MoreDetails,
  Notice,
  PersonAvatar,
  SectionHeader,
  StatusBadge,
  Steps,
  TONE_CLASS,
  type Tone,
} from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { SessionProfile } from "@/lib/auth/session";
import { useDemo } from "@/features/demo/context";
import { useI18n } from "@/lib/i18n";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { cn } from "@/lib/utils";
import { MANAGER_META } from "../roles";
import {
  GovernanceModeBadge,
  approversOf,
  OwnershipBar,
  activeOwners,
  firstName,
  loadTeamMembers,
  type TeamMember,
} from "../team";
import {
  describeChange,
  type ChangeView,
  type DiffContext,
  type WeekDiffDay,
} from "./governance-diff";
import { awaitingMe, fetchDecisionQueue, type ChangeRequest } from "./decision-queue";

type Settled = { request: ChangeRequest; tone: Tone; text: string };
type DecisionAction = "approve" | "decline" | "cancel";

/**
 * Resultado de uma decisão no lugar do pedido. O cartão encolhe ao virar resultado: se a frase
 * ficar fora da vista (acima do botão que a pessoa tocou), rola até ela.
 */
function SettledResult({ done, detail }: { done: Settled; detail: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nav = document.querySelector(".app-mobile-nav");
    const bottomLimit = nav ? nav.getBoundingClientRect().top : window.innerHeight;
    if (rect.top >= 0 && rect.bottom <= bottomLimit) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, []);
  const icon =
    done.tone === "success"
      ? CheckCircle2
      : done.tone === "danger"
        ? XCircle
        : done.tone === "pending"
          ? Hourglass
          : TimerOff;
  return (
    <Notice ref={ref} tone={done.tone} icon={icon} title={done.text} className="rounded-2xl p-3">
      {detail}
    </Notice>
  );
}

/** Quanto tempo o resultado de uma decisão fica no lugar do pedido antes de sair da lista. */
const SETTLE_MS = 5000;

function relativeTime(iso: string, locale: string, now: number) {
  const diff = (new Date(iso).getTime() - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

/** Faixa da semana: os 7 dias em pílulas, destacando os que mudam, e a lista antes → depois. */
function WeekDiff({ week }: { week: WeekDiffDay[] }) {
  const { t, intlLocale } = useI18n();
  const dayName = (weekday: number, style: "short" | "long") =>
    new Intl.DateTimeFormat(intlLocale, { weekday: style, timeZone: "UTC" }).format(
      new Date(Date.UTC(2023, 0, 1 + weekday)),
    );
  const closed = t("eq.diff.closed");
  const changed = week.filter((day) => day.changed);
  const rows = (changed.length ? changed : week).map((day) => ({
    key: String(day.weekday),
    label: dayName(day.weekday, "long"),
    value: day.after || closed,
    previous: day.changed ? day.before || closed : undefined,
  }));
  return (
    <div className="space-y-2">
      <ol className="grid grid-cols-7 gap-1" aria-hidden>
        {week.map((day) => (
          <li
            key={day.weekday}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center rounded-xl border text-[11px] font-bold leading-tight",
              day.changed
                ? "tone-pending border-[color:var(--tone-line)] bg-[color:var(--tone-bg)] text-[color:var(--tone-ink)]"
                : day.after
                  ? "border-border bg-background"
                  : "border-dashed border-border text-muted-foreground",
            )}
          >
            <span className="capitalize">{dayName(day.weekday, "short").replace(".", "")}</span>
            {day.changed && <span className="mt-0.5 size-1.5 rounded-full bg-current" />}
          </li>
        ))}
      </ol>
      <DetailList items={rows} />
    </div>
  );
}

/** "O que muda": ícone do tipo, item afetado e as linhas antes → depois. */
function ChangeSummary({ view }: { view: ChangeView }) {
  const { t } = useI18n();
  const empty = !view.rows.length && !view.week && !view.note;
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <IconTile icon={view.icon} size="sm" tone={view.destructive ? "danger" : "primary"} />
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-bold", view.destructive && "text-destructive")}>
            {view.title}
          </p>
          {view.subject && <p className="text-sm font-semibold break-words">{view.subject}</p>}
        </div>
      </div>
      {view.rows.length > 0 && (
        <DetailList items={view.rows} className="rounded-xl bg-background/70 px-3 py-2" />
      )}
      {view.week && (
        <div className="rounded-xl bg-background/70 px-3 py-2">
          <WeekDiff week={view.week} />
        </div>
      )}
      {view.note && <Hint icon={Info}>{view.note}</Hint>}
      {/* Sem linhas "antes → depois": diz que o resto não dá para mostrar (exclusão já se explica). */}
      {empty && !view.destructive && (
        <Hint icon={Info} tone="muted">
          {view.subject ? t("eq.gov.otherDetails") : t("eq.gov.noDetails")}
        </Hint>
      )}
      {empty && view.destructive && !view.subject && (
        <Hint icon={Info} tone="muted">
          {t("eq.gov.noDetails")}
        </Hint>
      )}
    </div>
  );
}

export function TeamGovernance({
  shopId,
  profile,
  onChanged,
  services,
  staff,
  businessHours,
  blocks,
  settings,
  timeZone,
  revision = 0,
}: {
  shopId: string;
  profile: SessionProfile;
  onChanged?: () => void;
  /** Dados que o painel já tem, para mostrar o "antes" de cada pedido. */
  services?: Tables<"services">[];
  staff?: Tables<"staff">[];
  businessHours?: Tables<"business_hours">[];
  blocks?: DiffContext["blocks"];
  settings?: Tables<"barbershop_settings"> | null;
  timeZone?: string;
  /** Muda quando algo foi pedido em outra tela: recarrega sem apagar a lista. */
  revision?: number;
}) {
  const { t, intlLocale } = useI18n();
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [approvals, setApprovals] = useState<Map<string, Set<string>>>(() => new Map());
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ id: string; action: DecisionAction } | null>(null);
  // Erro de cada pedido, com a ação que falhou (para "Tentar de novo" junto dos botões).
  const [errors, setErrors] = useState<Record<string, { text: string; action: DecisionAction }>>(
    {},
  );
  const [settled, setSettled] = useState<Record<string, Settled>>({});
  const [now, setNow] = useState(() => Date.now());
  const timers = useRef<number[]>([]);
  const actor = profile.activeShopActor;
  const canReview = actor?.role === "owner" || actor?.role === "partner";
  const me = profile.user.id;

  // Demonstração: a sociedade fictícia da visão (quem tem quanto e o modo), sem pedidos reais.
  const demoTeam = useDemo()?.team ?? null;
  const load = useCallback(async () => {
    if (!canReview) return;
    setLoadError(null);
    if (demoTeam) {
      setMembers(demoTeam);
      setRequests([]);
      setApprovals(new Map());
      setLoaded(true);
      return;
    }
    const [queue, team] = await Promise.all([
      fetchDecisionQueue(shopId, me),
      loadTeamMembers(shopId).catch(() => null),
    ]);
    if (team) setMembers(team);
    if ("error" in queue) setLoadError(friendlyAuthError(queue.error));
    else {
      setRequests(queue.requests);
      setApprovals(queue.approvals);
    }
    setNow(Date.now());
    setLoaded(true);
  }, [canReview, shopId, me, demoTeam]);

  useEffect(() => {
    void load();
  }, [load, revision]);

  useEffect(() => {
    const list = timers.current;
    // "há 2 h" acompanha o relógio sem recarregar.
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      window.clearInterval(tick);
      list.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const memberByUser = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);
  // Foto de quem pediu (a mesma do cartão do profissional), quando houver.
  const photoOf = useMemo(() => {
    const map = new Map((staff ?? []).map((row) => [row.id, row.avatar_url ?? null]));
    return (staffId: string) => map.get(staffId) ?? null;
  }, [staff]);
  const memberNames = useMemo(
    () =>
      new Map(
        members.map((m) => [
          m.id,
          { name: m.display_name, role: m.role, percent: m.ownership_percent, active: m.active },
        ]),
      ),
    [members],
  );
  const owners = useMemo(() => activeOwners(members), [members]);
  const mode = profile.governanceMode ?? (owners.length > 1 ? "equal" : "single");
  const leader = owners[0] ?? null;
  const canApply = !!profile.capabilities?.canApplyOperations;
  // Quem decide os pedidos de quem está vendo: a maior parte (maioria) ou os outros donos.
  const deciders = approversOf(members, mode, me);
  const decidersText = deciders.length ? deciders.join(", ") : t("eq.gov.otherOwners");

  const pending = useMemo(
    () => requests.filter((request) => request.status === "pending"),
    [requests],
  );
  // Resultado de uma decisão fica no lugar do pedido por alguns segundos.
  const visible = useMemo(() => {
    const ids = new Set(pending.map((r) => r.id));
    const extra = Object.values(settled)
      .filter((row) => !ids.has(row.request.id))
      .map((row) => row.request);
    return [...pending, ...extra].sort((a, b) => {
      const am =
        (a.source === "account_manager" ? 0 : 1) - (b.source === "account_manager" ? 0 : 1);
      return am || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [pending, settled]);
  const approvedByMe = (request: ChangeRequest) =>
    !settled[request.id] && !!approvals.get(request.id)?.has(me);
  const toDecide = visible.filter((r) => r.requested_by !== me && !approvedByMe(r));
  const alreadyApproved = visible.filter((r) => r.requested_by !== me && approvedByMe(r));
  const mine = visible.filter((r) => r.requested_by === me);
  const waitingCount = awaitingMe(
    pending,
    me,
    new Set(pending.filter((r) => approvals.get(r.id)?.has(me)).map((r) => r.id)),
  ).length;
  /** Donos que ainda faltam aprovar um pedido (decisão em conjunto). */
  const missingNames = (request: ChangeRequest) => {
    const ok = approvals.get(request.id);
    const names = owners
      .filter((o) => o.user_id !== request.requested_by && !ok?.has(o.user_id))
      .map((o) => firstName(o.display_name));
    return names.length ? names.join(", ") : t("eq.gov.otherOwners");
  };

  function settle(request: ChangeRequest, tone: Tone, text: string) {
    setSettled((current) => ({ ...current, [request.id]: { request, tone, text } }));
    const id = window.setTimeout(() => {
      setSettled((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
    }, SETTLE_MS);
    timers.current.push(id);
  }

  // O erro fica na tela (com o foco no "Tentar de novo") até a nova resposta chegar: some só no
  // sucesso. Se a nova tentativa falhar com a mesma frase, o aviso é lido de novo.
  function fail(request: ChangeRequest, text: string, action: DecisionAction) {
    if (errors[request.id]?.text === text) announce(text, "assertive");
    setErrors((current) => ({ ...current, [request.id]: { text, action } }));
  }

  function clearError(request: ChangeRequest) {
    setErrors(({ [request.id]: _drop, ...rest }) => rest);
  }

  async function decide(request: ChangeRequest, approve: boolean) {
    if (busy?.id === request.id) return;
    setBusy({ id: request.id, action: approve ? "approve" : "decline" });
    const { data, error } = await supabase.rpc("decide_shop_change", {
      p_request_id: request.id,
      p_approve: approve,
      p_note: null,
    });
    setBusy(null);
    if (error) {
      fail(request, friendlyAuthError(error), approve ? "approve" : "decline");
      return;
    }
    clearError(request);
    const result = data as { status?: string; remaining_approvals?: number } | null;
    if (result?.status === "expired") settle(request, "neutral", t("eq.gov.result.expired"));
    else if (result?.status === "pending") {
      const left = result.remaining_approvals ?? 1;
      settle(
        request,
        "pending",
        left === 1 ? t("eq.gov.result.okOne") : t("eq.gov.result.okMany", { count: left }),
      );
    } else if (approve) settle(request, "success", t("eq.gov.result.approved"));
    else settle(request, "danger", t("eq.gov.result.declined"));
    await load();
    onChanged?.();
  }

  async function cancel(request: ChangeRequest) {
    if (busy?.id === request.id) return;
    setBusy({ id: request.id, action: "cancel" });
    const { error } = await supabase.rpc("cancel_shop_change", { p_request_id: request.id });
    setBusy(null);
    if (error) {
      fail(request, friendlyAuthError(error), "cancel");
      return;
    }
    clearError(request);
    settle(request, "neutral", t("eq.gov.result.cancelled"));
    await load();
  }

  if (!canReview) return null;

  const renderRequest = (request: ChangeRequest) => {
    const own = request.requested_by === me;
    const manager = request.source === "account_manager";
    const done = settled[request.id];
    const view = describeChange(request.kind, request.payload, {
      t,
      locale: intlLocale,
      timeZone,
      services,
      staff,
      businessHours,
      blocks,
      settings,
      memberNames,
    });
    const requester = memberByUser.get(request.requested_by);
    const busyHere = busy?.id === request.id;
    const failed = errors[request.id];
    // Já aprovado por quem vê: espera os outros donos, sem botões de decisão.
    const approvedMine = !own && approvedByMe(request);
    const tone: Tone = own || approvedMine ? "neutral" : "pending";
    const when = new Date(request.created_at);
    const waitingNames = mode === "equal" ? missingNames(request) : decidersText;

    if (done) {
      return (
        <li key={request.id}>
          <SettledResult
            done={done}
            detail={view.subject ? `${view.title} · ${view.subject}` : view.title}
          />
        </li>
      );
    }

    return (
      <li
        key={request.id}
        className={cn(
          TONE_CLASS[tone],
          "space-y-3 rounded-2xl border border-border border-l-4 border-l-[color:var(--tone-line)] bg-card p-3 sm:p-4",
        )}
      >
        {/* Quem pediu, quando e em que pé está. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          {manager ? (
            <StatusBadge
              tone={MANAGER_META.tone}
              icon={MANAGER_META.icon}
              size="sm"
              label={t("eq.role.manager")}
            />
          ) : (
            <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold">
              <PersonAvatar
                name={requester?.display_name ?? "?"}
                src={requester ? photoOf(requester.staff_id) : null}
                seed={requester?.user_id}
                size="xs"
              />
              {own
                ? t("eq.gov.byYou")
                : t("eq.gov.byName", {
                    name: requester ? firstName(requester.display_name) : t("eq.gov.someone"),
                  })}
            </span>
          )}
          <time
            dateTime={request.created_at}
            title={when.toLocaleString(intlLocale, { dateStyle: "short", timeStyle: "short" })}
            className="text-xs text-muted-foreground"
          >
            · {relativeTime(request.created_at, intlLocale, now)}
          </time>
          <StatusBadge
            tone="pending"
            icon={Hourglass}
            size="sm"
            className="ms-auto"
            label={
              own
                ? t("eq.gov.waitingFor", { names: waitingNames })
                : approvedMine
                  ? t("eq.gov.youApproved", { names: waitingNames })
                  : t("eq.gov.waitingYou")
            }
          />
        </div>

        {request.expires_at && (
          <div className="flex flex-wrap items-center gap-2">
            <Countdown
              endsAt={request.expires_at}
              criticalBelow={300}
              label={t("eq.gov.toDecide")}
              onExpire={() => void load()}
            />
            <span className="text-xs text-muted-foreground">{t("eq.gov.expiresEffect")}</span>
          </div>
        )}

        <ChangeSummary view={view} />

        <Steps
          label={t("eq.gov.stepsLabel")}
          steps={[
            { key: "asked", label: t("eq.gov.step.asked"), status: "done" },
            ...(approvedMine
              ? [
                  { key: "mine", label: t("eq.gov.step.yourDecision"), status: "done" as const },
                  {
                    key: "others",
                    label: t("eq.gov.step.decisionOf", { names: waitingNames }),
                    status: "current" as const,
                  },
                ]
              : [
                  {
                    key: "decision",
                    label: own
                      ? t("eq.gov.step.decisionOf", { names: waitingNames })
                      : t("eq.gov.step.yourDecision"),
                    status: "current" as const,
                  },
                ]),
            { key: "applied", label: t("eq.gov.step.applied"), status: "upcoming" },
          ]}
        />

        <div className="flex flex-wrap justify-end gap-2 empty:hidden">
          {own ? (
            <button
              type="button"
              disabled={busyHere}
              onClick={() => void cancel(request)}
              className="action-button action-danger min-h-11"
            >
              {busyHere ? (
                <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
              ) : (
                <X className="size-4" aria-hidden />
              )}
              {busyHere ? t("eq.gov.cancelling") : t("eq.gov.cancelRequest")}
            </button>
          ) : approvedMine ? null : (
            <>
              <button
                type="button"
                disabled={busyHere}
                onClick={() => void decide(request, false)}
                className="action-button action-danger min-h-11 flex-1 justify-center sm:flex-none"
              >
                {busyHere && busy?.action === "decline" ? (
                  <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
                ) : (
                  <X className="size-4" aria-hidden />
                )}
                {busyHere && busy?.action === "decline"
                  ? t("eq.gov.declining")
                  : t("eq.gov.decline")}
              </button>
              <button
                type="button"
                disabled={busyHere}
                onClick={() => void decide(request, true)}
                className="action-button action-confirm min-h-11 flex-1 justify-center sm:flex-none"
              >
                {busyHere && busy?.action === "approve" ? (
                  <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
                ) : (
                  <Check className="size-4" aria-hidden />
                )}
                {busyHere && busy?.action === "approve"
                  ? t("eq.gov.approving")
                  : t("eq.gov.approve")}
              </button>
            </>
          )}
        </div>

        {/* Não deu certo: logo abaixo dos botões, com "Tentar de novo" a mesma ação. */}
        {failed && (
          <ActionResult
            state="error"
            text={failed.text}
            onRetry={() =>
              void (failed.action === "cancel"
                ? cancel(request)
                : decide(request, failed.action === "approve"))
            }
            onDismiss={() => clearError(request)}
          />
        )}
      </li>
    );
  };

  const group = (id: string, title: string, rows: ChangeRequest[], hint?: string) =>
    rows.length > 0 && (
      <section aria-labelledby={`gov-${id}`} className="space-y-2">
        <h4 id={`gov-${id}`} className="flex items-center gap-2 text-sm font-extrabold">
          {title}
          <span className="inline-grid min-w-6 place-items-center rounded-full bg-muted px-1.5 text-xs font-bold tabular-nums">
            {rows.length}
          </span>
        </h4>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        <ul className="space-y-3">{rows.map(renderRequest)}</ul>
      </section>
    );

  const shares = owners.map((owner) => ({
    key: owner.user_id,
    name: owner.display_name,
    percent: Number(owner.ownership_percent ?? 0),
  }));

  return (
    <section
      id="team-decisions"
      className="app-action-card scroll-mt-28 space-y-4 p-4"
      aria-labelledby="governance-title"
    >
      <SectionHeader
        icon={Scale}
        id="governance-title"
        title={t("eq.gov.title")}
        aside={
          waitingCount > 0 ? (
            <StatusBadge
              tone="pending"
              icon={Hourglass}
              label={
                waitingCount === 1
                  ? t("eq.gov.waitingOne")
                  : t("eq.gov.waitingMany", { count: waitingCount })
              }
            />
          ) : undefined
        }
      />

      {/* Como as decisões funcionam aqui: quem tem quanto e o efeito para quem está vendo. */}
      <div className="space-y-3 rounded-2xl bg-background/70 p-3">
        <GovernanceModeBadge
          mode={mode}
          leader={leader}
          youDecideAlone={mode === "single" && (!leader || leader.user_id === me)}
        />
        {shares.length > 1 && <OwnershipBar owners={shares} />}
        <IconList
          size="md"
          items={[
            canApply
              ? { icon: CheckCircle2, tone: "success", text: t("eq.gov.effectNow") }
              : {
                  icon: Hourglass,
                  tone: "pending",
                  text: t("eq.gov.effectWait", { names: decidersText }),
                },
          ]}
        />
        {mode !== "single" && (
          <MoreDetails>
            <IconList
              items={[
                { icon: Check, text: t("eq.gov.rule.approve") },
                { icon: X, tone: "muted", text: t("eq.gov.rule.decline") },
                { icon: TimerOff, tone: "muted", text: t("eq.gov.rule.manager") },
              ]}
            />
          </MoreDetails>
        )}
      </div>

      {!loaded && !loadError ? (
        <LoadingState variant="list" count={2} label={t("eq.gov.loading")} />
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
      ) : visible.length === 0 ? (
        <Hint icon={CheckCircle2} tone="success" className="text-sm font-semibold text-foreground">
          {t("eq.gov.allClear")}
        </Hint>
      ) : (
        <div className="space-y-5">
          {group("decide", t("eq.gov.groupDecide"), toDecide)}
          {group("approved", t("eq.gov.groupApproved"), alreadyApproved)}
          {group("mine", t("eq.gov.groupMine"), mine)}
        </div>
      )}
    </section>
  );
}
