import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogActions,
} from "@/components/ui/dialog";
import { useViewportAtLeast } from "@/lib/device";
import { useDemo } from "@/features/demo/context";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  CalendarDays,
  Clock3,
  Hourglass,
  Repeat,
  Store,
  Tag as TagIcon,
  Trash2,
  Users,
} from "lucide-react";
import {
  ActionResult,
  ApprovalNote,
  Notice,
  LoadingState,
  ChoiceChips,
  ConfirmDialog,
  DetailList,
  Hint,
  IconTile,
  PersonAvatar,
  SectionHeader,
  Tag,
  type ActionState,
} from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { isMissingRpcError } from "@/lib/auth/optional-rpc";
import { useI18n } from "@/lib/i18n";
import type { StaffOption } from "./BlockDialog";
import { useDayLabels } from "./labels";
import { rangeLabel } from "./model";
import { BLOCK_REASONS } from "./reasons";
import { TimeRangeEditor } from "./TimeRangeEditor";

type WeeklyRule = Tables<"availability_block_rules">;

/** Segunda primeiro, domingo por último (0 = domingo no banco). */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const REASONS = BLOCK_REASONS.filter((item) => item.id !== "holiday");
type ReasonId = (typeof REASONS)[number]["id"];

type PendingBreak = {
  id: string;
  kind: "weekly_break.create" | "weekly_break.delete";
  payload: {
    id: string;
    weekdays: number[];
    start_time: string;
    end_time: string;
    reason?: string;
  };
};
type WeeklyBreaksProps = {
  shopId: string;
  staff: StaffOption[];
  ownStaff: StaffOption | null;
  /** Pode solicitar pausa da loja; o servidor decide se depende dos demais donos. */
  canManageShop: boolean;
  /** Pode aplicar diretamente pausas de profissionais, conforme a capacidade vigente. */
  canManageStaff?: boolean;
  onChanged: () => void;
  onOpenApprovals?: () => void;
};

export function WeeklyBreaksCard(props: WeeklyBreaksProps) {
  return <WeeklyBreaksEditor key={props.shopId} {...props} />;
}

function WeeklyBreaksEditor({
  shopId,
  staff,
  ownStaff,
  canManageShop,
  canManageStaff = canManageShop,
  onChanged,
  onOpenApprovals,
}: WeeklyBreaksProps) {
  const { t } = useI18n();
  const demo = useDemo();
  const wide = useViewportAtLeast(768);
  const demoMode = !!demo;
  const labels = useDayLabels();
  const titleId = useId();
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const readVersion = useRef(0);
  const operation = useRef<{ signature: string; id: string } | null>(null);
  const [rules, setRules] = useState<WeeklyRule[] | null>(null);
  const [supported, setSupported] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [governance, setGovernance] = useState<{
    version: string;
    requiresApproval: boolean;
  } | null>(null);
  const [governanceMissing, setGovernanceMissing] = useState(false);
  const [governanceError, setGovernanceError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingBreak[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [range, setRange] = useState({ start: "12:00", end: "13:00" });
  const [staffId, setStaffId] = useState("");
  const [reasonId, setReasonId] = useState<ReasonId>("break");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ state: ActionState; text: string } | null>(null);
  const [confirming, setConfirming] = useState<WeeklyRule | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!mounted.current) return;
    const request = ++readVersion.current;
    if (demoMode) {
      setRules(
        (current) =>
          current ?? [
            {
              id: "demo-weekly-break",
              barbershop_id: shopId,
              staff_id: null,
              weekdays: [1, 2, 3, 4, 5, 6],
              start_time: "12:00",
              end_time: "13:00",
              reason: t("shop.block.reasonBreak"),
              created_at: new Date().toISOString(),
            } as WeeklyRule,
          ],
      );
      setGovernance({ version: "demo", requiresApproval: false });
      return;
    }
    const fresh = () => mounted.current && request === readVersion.current;
    await Promise.all([
      (async () => {
        try {
          const { data, error, status } = await supabase
            .from("availability_block_rules")
            .select("*")
            .eq("barbershop_id", shopId)
            .order("created_at", { ascending: true });
          if (!fresh()) return;
          if (error) {
            if (
              error.code === "PGRST205" ||
              error.code === "42P01" ||
              isMissingRpcError(error, status)
            ) {
              setSupported(false);
              return;
            }
            throw error;
          }
          setLoadError(null);
          setRules(data ?? []);
        } catch (error) {
          if (fresh()) setLoadError(friendlyAuthError(error, t("hours.weekly.loadError")));
        }
      })(),
      canManageShop
        ? (async () => {
            try {
              const { data, error, status } = await supabase.rpc("get_weekly_break_governance", {
                p_shop_id: shopId,
              });
              if (!fresh()) return;
              if (error && isMissingRpcError(error, status)) {
                setGovernance(null);
                setGovernanceMissing(true);
                setGovernanceError(null);
                return;
              }
              if (error) throw error;
              const state = data as {
                version?: string;
                requires_approval?: boolean;
                pending?: PendingBreak[];
              } | null;
              if (
                typeof state?.version !== "string" ||
                typeof state.requires_approval !== "boolean"
              )
                throw new Error(t("p70.governanceLoadError"));
              setGovernance({ version: state.version, requiresApproval: state.requires_approval });
              setPending(Array.isArray(state.pending) ? state.pending : []);
              setGovernanceMissing(false);
              setGovernanceError(null);
            } catch (error) {
              if (fresh()) {
                setGovernance(null);
                setGovernanceError(friendlyAuthError(error, t("p70.governanceLoadError")));
              }
            }
          })()
        : Promise.resolve(),
    ]);
  }, [shopId, t, demoMode, canManageShop]);
  useEffect(() => {
    void load();
  }, [load]);

  const canWholeShop = canManageShop && !!governance;
  const canCreate = !!rules && !loadError && (canWholeShop || canManageStaff || !!ownStaff);
  if (!supported || (!canCreate && !rules?.length && !canManageShop && !ownStaff)) return null;
  const wholeShop = !ownStaff && !staffId;
  const approval = wholeShop && governance?.requiresApproval;
  const nameOf = (id: string | null) =>
    id
      ? (staff.find((member) => member.id === id)?.display_name ??
        (ownStaff?.id === id ? ownStaff.display_name : t("hours.blocks.colleague")))
      : t("shop.block.wholeShop");
  const daysLabel = (weekdays: number[]) =>
    weekdays.length === 7
      ? t("hours.weekly.everyDay")
      : WEEK_ORDER.filter((day) => weekdays.includes(day))
          .map((day) => labels.weekdayShort(day))
          .join(", ");
  const timeOf = (rule: Pick<WeeklyRule, "start_time" | "end_time">) =>
    rangeLabel(rule.start_time.slice(0, 5), rule.end_time.slice(0, 5));
  const canDelete = (rule: WeeklyRule) =>
    rule.staff_id
      ? canManageStaff || (!!ownStaff && rule.staff_id === ownStaff.id)
      : canWholeShop &&
        !pending.some((item) => item.kind === "weekly_break.delete" && item.payload.id === rule.id);
  const problem =
    days.length === 0
      ? t("hours.weekly.pickDay")
      : range.end <= range.start
        ? t("hours.block.endAfterStart")
        : wholeShop && !canWholeShop
          ? t(governanceMissing ? "p70.unavailable" : "p70.choosePerson")
          : null;
  const operationId = (action: string, payload: unknown) => {
    const signature = JSON.stringify({ action, payload });
    if (operation.current?.signature !== signature)
      operation.current = { signature, id: crypto.randomUUID() };
    return operation.current.id;
  };
  async function requestShop(
    action: "create" | "delete",
    payload: Record<string, Json | undefined>,
  ) {
    if (!canWholeShop || !governance) throw new Error(t("p70.unavailable"));
    const { data, error, status } = await supabase.rpc("request_weekly_break_change", {
      p_shop_id: shopId,
      p_action: action,
      p_payload: {
        ...payload,
        version: governance.version,
        operation_id: operationId(action, payload),
      },
    });
    if (error) {
      if (isMissingRpcError(error, status)) {
        if (mounted.current) {
          setGovernance(null);
          setGovernanceMissing(true);
        }
        throw new Error(t("p70.unavailable"));
      }
      throw error;
    }
    const outcome = data && typeof data === "object" && !Array.isArray(data) ? data.status : null;
    if (!["pending", "applied", "unchanged"].includes(String(outcome))) {
      if (["rejected", "cancelled", "expired"].includes(String(outcome))) {
        operation.current = null;
        throw new Error(t("p70.closed"));
      }
      throw new Error(
        t(action === "delete" ? "hours.weekly.deleteError" : "hours.weekly.saveError"),
      );
    }
    operation.current = null;
    return outcome as "pending" | "applied" | "unchanged";
  }
  async function create() {
    if (!mounted.current || problem || !canCreate || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setResult(null);
    const reasonKey = REASONS.find((item) => item.id === reasonId)?.key ?? "shop.block.reasonBreak";
    const draft = {
      barbershop_id: shopId,
      staff_id: ownStaff ? ownStaff.id : staffId || null,
      weekdays: [...days].sort((a, b) => a - b),
      start_time: range.start,
      end_time: range.end,
      reason: t(reasonKey),
    };
    try {
      let outcome: "pending" | "applied" | "unchanged" = "applied";
      if (demoMode) {
        setRules((current) => [
          ...(current ?? []),
          { ...draft, id: crypto.randomUUID(), created_at: new Date().toISOString() } as WeeklyRule,
        ]);
      } else if (!draft.staff_id) {
        outcome = await requestShop("create", draft);
      } else {
        if (!canManageStaff && draft.staff_id !== ownStaff?.id) return;
        const { error } = await supabase.from("availability_block_rules").insert(draft);
        if (error) throw error;
      }
      if (!mounted.current) return;
      setFormOpen(false);
      setResult({
        state: outcome === "pending" ? "pending" : "saved",
        text: t(
          demoMode
            ? "hours.weekly.demoSaved"
            : outcome === "pending"
              ? "p70.pendingHint"
              : outcome === "unchanged"
                ? "p70.alreadyExists"
                : "hours.weekly.saved",
        ),
      });
      if (!demoMode) {
        await load();
        if (mounted.current) onChanged();
      }
    } catch (error) {
      if (!mounted.current) return;
      setResult({ state: "error", text: friendlyAuthError(error, t("hours.weekly.saveError")) });
      if ((error as { code?: string })?.code === "40001") {
        operation.current = null;
        await load();
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  async function remove() {
    if (!confirming || !canDelete(confirming) || !mounted.current || inFlight.current) return;
    inFlight.current = true;
    try {
      let outcome: "pending" | "applied" | "unchanged" = "applied";
      if (demoMode)
        setRules((current) => (current ?? []).filter((rule) => rule.id !== confirming.id));
      else if (!confirming.staff_id) outcome = await requestShop("delete", { id: confirming.id });
      else {
        const { error } = await supabase
          .from("availability_block_rules")
          .delete()
          .eq("id", confirming.id);
        if (error) throw error;
      }
      if (!mounted.current) return;
      setResult({
        state: outcome === "pending" ? "pending" : "saved",
        text: t(outcome === "pending" ? "p70.pendingHint" : "hours.weekly.deleted"),
      });
      if (!demoMode) {
        await load();
        if (mounted.current) onChanged();
      }
    } catch (error) {
      if ((error as { code?: string })?.code === "40001") {
        operation.current = null;
        await load();
      }
      throw new Error(friendlyAuthError(error, t("hours.weekly.deleteError")));
    } finally {
      inFlight.current = false;
    }
  }

  const formFields = (
    <fieldset disabled={saving} className="min-w-0 space-y-4">
      <ChoiceChips<number>
        multiple
        label={t("hours.weekly.days")}
        icon={CalendarDays}
        value={days}
        onChange={setDays}
        options={WEEK_ORDER.map((day) => ({
          value: day,
          label: labels.weekdayShort(day),
        }))}
      />
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-bold">
          <Clock3 className="size-4 text-gold" aria-hidden />
          {t("hours.block.time")}
        </p>
        <TimeRangeEditor
          start={range.start}
          end={range.end}
          onChange={setRange}
          startLabel={t("hours.block.starts")}
          endLabel={t("hours.block.ends")}
          context={t("hours.weekly.title")}
          error={range.end <= range.start ? t("hours.block.endAfterStart") : null}
        />
      </div>
      {!ownStaff && (
        <ChoiceChips<string>
          label={t("hours.block.who")}
          icon={Users}
          value={staffId}
          onChange={setStaffId}
          options={[
            ...(canWholeShop ? [{ value: "", label: t("shop.block.wholeShop"), icon: Store }] : []),
            ...(canManageStaff ? staff : []).map((member) => ({
              value: member.id,
              label: member.display_name,
              media: (
                <PersonAvatar
                  name={member.display_name}
                  src={member.avatar_url}
                  seed={member.id}
                  size="xs"
                />
              ),
            })),
          ]}
        />
      )}
      <ChoiceChips<ReasonId>
        label={t("hours.block.reason")}
        icon={TagIcon}
        value={reasonId}
        onChange={setReasonId}
        options={REASONS.map((item) => ({
          value: item.id,
          label: t(item.key),
          icon: item.icon,
        }))}
      />
      <Hint icon={Repeat} tone="info">
        {days.length
          ? t("hours.weekly.preview", {
              days: daysLabel(days),
              time: rangeLabel(range.start, range.end),
            })
          : t("hours.weekly.pickDay")}
      </Hint>
      {wholeShop && <ApprovalNote />}
      {approval && (
        <Hint icon={Hourglass} tone="pending">
          {t("p70.approvalHint")}
        </Hint>
      )}
    </fieldset>
  );
  const formActions = (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={saving}
        onClick={() => setFormOpen(false)}
        className="min-h-11 rounded-xl border border-border bg-background px-4 text-sm font-semibold"
      >
        {t("common.back")}
      </button>
      <button
        type="button"
        disabled={!!problem || saving}
        onClick={() => void create()}
        className="action-button action-confirm flex-1"
      >
        <Repeat aria-hidden />
        {saving
          ? t("hours.weekly.saving")
          : t(approval ? "p70.requestCreate" : "hours.weekly.save")}
      </button>
    </div>
  );

  return (
    <section
      aria-labelledby={titleId}
      className="space-y-4 rounded-2xl border border-border bg-card p-4"
    >
      <SectionHeader
        id={titleId}
        as="h3"
        icon={Repeat}
        tone="danger"
        title={t("hours.weekly.title")}
        description={t("hours.weekly.description")}
      />
      {rules === null && !loadError && (
        <LoadingState variant="list" count={1} label={t("common.wait")} />
      )}
      {loadError && <ActionResult state="error" text={loadError} onRetry={() => void load()} />}
      {governanceError && (
        <ActionResult state="error" text={governanceError} onRetry={() => void load()} />
      )}
      {governanceMissing && <Notice tone="info" title={t("p70.unavailable")} />}
      {pending.length > 0 && (
        <div className="space-y-2">
          {pending.map((item) => (
            <Notice
              key={item.id}
              tone="pending"
              title={t(
                item.kind === "weekly_break.delete" ? "p70.pendingDelete" : "p70.pendingCreate",
              )}
              children={`${daysLabel(item.payload.weekdays)} · ${timeOf(item.payload)} · ${item.payload.reason || t("shop.block.defaultReason")}`}
              action={
                onOpenApprovals
                  ? { label: t("p70.viewApprovals"), onClick: onOpenApprovals }
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {rules && rules.length > 0 && (
        <ul className="space-y-1.5">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="tone-danger flex items-center gap-2.5 rounded-xl border border-[color:var(--tone-border)] bg-background p-2"
            >
              <IconTile icon={Repeat} tone="danger" size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {rule.reason || t("shop.block.defaultReason")}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Tag icon={Clock3}>{timeOf(rule)}</Tag>
                  <Tag icon={CalendarDays}>{daysLabel(rule.weekdays)}</Tag>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    {rule.staff_id ? (
                      <PersonAvatar
                        name={nameOf(rule.staff_id)}
                        src={staff.find((member) => member.id === rule.staff_id)?.avatar_url}
                        seed={rule.staff_id}
                        size="xs"
                      />
                    ) : (
                      <Store className="size-4" aria-hidden />
                    )}
                    {nameOf(rule.staff_id)}
                  </span>
                </div>
              </div>
              {canDelete(rule) && (
                <button
                  type="button"
                  onClick={() => setConfirming(rule)}
                  aria-label={t("hours.weekly.deleteAria", {
                    rule: `${rule.reason || t("shop.block.defaultReason")}, ${daysLabel(rule.weekdays)}, ${timeOf(rule)}`,
                  })}
                  className="action-button action-danger shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canCreate && (!formOpen || wide) && (
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setFormOpen(true);
          }}
          className="action-button action-confirm w-full sm:w-auto"
        >
          <Repeat aria-hidden />
          {t("hours.weekly.add")}
        </button>
      )}

      {formOpen && !wide && (
        <div className="weekly-break-form space-y-4 rounded-xl border border-border bg-background p-3">
          {formFields}
          {formActions}
        </div>
      )}

      {wide && (
        <Dialog open={formOpen} onOpenChange={(open) => !saving && setFormOpen(open)}>
          <DialogContent
            size="xl"
            className="weekly-break-dialog bg-card"
            onEscapeKeyDown={(event) => saving && event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
          >
            <DialogHeader className="pr-10 text-left">
              <DialogTitle>{t("hours.weekly.add")}</DialogTitle>
              <DialogDescription>{t("hours.weekly.description")}</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="weekly-break-form space-y-4">{formFields}</div>
              {result?.state === "error" && <ActionResult state="error" text={result.text} />}
            </DialogBody>
            <DialogActions>{formActions}</DialogActions>
          </DialogContent>
        </Dialog>
      )}

      <ActionResult
        state={result?.state ?? null}
        text={result?.text}
        autoHideMs={result?.state === "saved" ? 6000 : undefined}
        onDismiss={() => setResult(null)}
      />

      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(open) => !open && setConfirming(null)}
        tone="danger"
        icon={Repeat}
        title={t("hours.weekly.deleteTitle")}
        summary={
          confirming ? (
            <DetailList
              items={[
                {
                  label: t("hours.block.reason"),
                  value: confirming.reason || t("shop.block.defaultReason"),
                },
                {
                  label: t("hours.weekly.days"),
                  value: `${daysLabel(confirming.weekdays)} · ${timeOf(confirming)}`,
                },
                { label: t("hours.block.who"), value: nameOf(confirming.staff_id) },
              ]}
            />
          ) : null
        }
        consequences={[
          {
            icon: CalendarDays,
            tone:
              confirming?.staff_id == null && governance?.requiresApproval ? "pending" : "success",
            text: t(
              confirming?.staff_id == null && governance?.requiresApproval
                ? "p70.approvalHint"
                : "hours.weekly.deleteEffect",
            ),
          },
        ]}
        confirmLabel={t(
          confirming?.staff_id == null && governance?.requiresApproval
            ? "p70.requestDelete"
            : "hours.weekly.deleteConfirm",
        )}
        busyLabel={t("hours.blocks.deleting")}
        confirmIcon={Trash2}
        cancelLabel={t("hours.weekly.keep")}
        onConfirm={remove}
      />
    </section>
  );
}
