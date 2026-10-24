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
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Clock3, Repeat, Store, Tag as TagIcon, Trash2, Users } from "lucide-react";
import {
  ActionResult,
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
import type { Tables } from "@/integrations/supabase/types";
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

/**
 * "Pausa fixa": almoço ou intervalo que se repete toda semana. Cada pausa vira bloqueios comuns
 * nos próximos meses (o servidor estende sozinho); apagar a pausa libera os dias seguintes.
 * Sem a migration 20261013220000 no banco, o cartão não aparece.
 */
export function WeeklyBreaksCard({
  shopId,
  staff,
  ownStaff,
  canManageShop,
  onChanged,
}: {
  shopId: string;
  staff: StaffOption[];
  /** Quem só cuida da própria agenda: a pausa vale só para ela. */
  ownStaff: StaffOption | null;
  /** Cria pausa da loja toda ou de qualquer profissional. */
  canManageShop: boolean;
  /** Bloqueios gerados mudaram: recarrega a lista de bloqueios. */
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const demo = useDemo();
  const wide = useViewportAtLeast(768);
  const demoMode = !!demo;
  const labels = useDayLabels();
  const [rules, setRules] = useState<WeeklyRule[] | null>(null);
  const [supported, setSupported] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [range, setRange] = useState({ start: "12:00", end: "13:00" });
  const [staffId, setStaffId] = useState("");
  const [reasonId, setReasonId] = useState<ReasonId>("break");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ state: ActionState; text: string } | null>(null);
  const [confirming, setConfirming] = useState<WeeklyRule | null>(null);

  const load = useCallback(async () => {
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
      return;
    }
    const { data, error, status } = await supabase
      .from("availability_block_rules")
      .select("*")
      .eq("barbershop_id", shopId)
      .order("created_at", { ascending: true });
    if (error) {
      if (error.code === "PGRST205" || error.code === "42P01" || isMissingRpcError(error, status)) {
        setSupported(false);
        return;
      }
      setLoadError(friendlyAuthError(error, t("hours.weekly.loadError")));
      return;
    }
    setLoadError(null);
    setRules(data ?? []);
  }, [shopId, t, demoMode]);

  useEffect(() => {
    void load();
  }, [load]);

  const canCreate = canManageShop || !!ownStaff;
  if (!supported || (!canCreate && !rules?.length)) return null;

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
  const timeOf = (rule: WeeklyRule) =>
    rangeLabel(rule.start_time.slice(0, 5), rule.end_time.slice(0, 5));
  const canDelete = (rule: WeeklyRule) =>
    canManageShop || (!!ownStaff && rule.staff_id === ownStaff.id);
  const problem =
    days.length === 0
      ? t("hours.weekly.pickDay")
      : range.end <= range.start
        ? t("hours.block.endAfterStart")
        : null;

  async function create() {
    if (problem || saving) return;
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
    if (demoMode) {
      setRules((current) => [
        ...(current ?? []),
        { ...draft, id: crypto.randomUUID(), created_at: new Date().toISOString() } as WeeklyRule,
      ]);
      setSaving(false);
      setFormOpen(false);
      setResult({ state: "saved", text: t("hours.weekly.demoSaved") });
      return;
    }
    const { error } = await supabase.from("availability_block_rules").insert(draft);
    setSaving(false);
    if (error) {
      setResult({ state: "error", text: friendlyAuthError(error, t("hours.weekly.saveError")) });
      return;
    }
    setFormOpen(false);
    setResult({ state: "saved", text: t("hours.weekly.saved") });
    await load();
    onChanged();
  }

  const formFields = (
    <>
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
            { value: "", label: t("shop.block.wholeShop"), icon: Store },
            ...staff.map((member) => ({
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
    </>
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
        {saving ? t("hours.weekly.saving") : t("hours.weekly.save")}
      </button>
    </div>
  );

  return (
    <section
      aria-labelledby="hours-weekly-title"
      className="space-y-4 rounded-2xl border border-border bg-card p-4"
    >
      <SectionHeader
        id="hours-weekly-title"
        as="h3"
        icon={Repeat}
        tone="danger"
        title={t("hours.weekly.title")}
        description={t("hours.weekly.description")}
      />
      {loadError && <ActionResult state="error" text={loadError} onRetry={() => void load()} />}

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
          { icon: CalendarDays, tone: "success", text: t("hours.weekly.deleteEffect") },
        ]}
        confirmLabel={t("hours.weekly.deleteConfirm")}
        busyLabel={t("hours.blocks.deleting")}
        confirmIcon={Trash2}
        cancelLabel={t("hours.weekly.keep")}
        onConfirm={async () => {
          if (!confirming) return;
          if (demoMode) {
            setRules((current) => (current ?? []).filter((rule) => rule.id !== confirming.id));
            setResult({ state: "saved", text: t("hours.weekly.deleted") });
            return;
          }
          const { error } = await supabase
            .from("availability_block_rules")
            .delete()
            .eq("id", confirming.id);
          if (error) throw new Error(friendlyAuthError(error, t("hours.weekly.deleteError")));
          setResult({ state: "saved", text: t("hours.weekly.deleted") });
          await load();
          onChanged();
        }}
      />
    </section>
  );
}
