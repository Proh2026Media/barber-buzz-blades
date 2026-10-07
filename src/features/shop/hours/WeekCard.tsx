import { useMemo, useRef, useState } from "react";
import { CalendarDays, Check, Copy, Hourglass, Lock, Moon, Pencil, Store } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogScrollArea,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChoiceChips,
  FieldMessage,
  Hint,
  IconTile,
  LoadingState,
  Notice,
  SectionHeader,
  STATE,
  StatusBadge,
  UnsavedBar,
  focusFirstInvalid,
  type ActionState,
} from "@/components/visual";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { SaveOutcome } from "../catalog/types";
import { DayTrack, RulerTicks, type TrackSegment } from "./DayTrack";
import { useDayLabels } from "./labels";
import { useHoursMemory } from "./memory";
import {
  WEEK_ORDER,
  changedWeekdays,
  dayInvalid,
  groupWeek,
  hhmm,
  rangeLabel,
  rangeLabelNoBreak,
  rulerRange,
  toMinutes,
  type HoursRow,
} from "./model";
import { TimeRangeEditor } from "./TimeRangeEditor";

const WEEKDAY_KEYS = [
  "shop.weekday.0",
  "shop.weekday.1",
  "shop.weekday.2",
  "shop.weekday.3",
  "shop.weekday.4",
  "shop.weekday.5",
  "shop.weekday.6",
] as const satisfies readonly MessageKey[];

/**
 * "Sua semana": uma linha por dia com a faixa aberta numa régua comum, o resumo que junta dias
 * iguais ("Seg–Sáb 09:00–19:00 · Dom fechado") e a barra de mudanças não salvas. Tocar no dia
 * abre a faixa (abre/fecha) com "usar também em"; a gravação continua pelo mesmo salvar.
 */
export function WeekCard<Row extends HoursRow>({
  saved,
  draft,
  onDraftChange,
  todayWeekday,
  canEdit,
  loading,
  loadError,
  onRetry,
  onSave,
  onOpenApprovals,
}: {
  saved: Row[];
  draft: Row[];
  onDraftChange: (rows: Row[]) => void;
  todayWeekday: number;
  canEdit: boolean;
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  onSave: (rows: Row[]) => Promise<SaveOutcome>;
  onOpenApprovals?: () => void;
}) {
  const { t } = useI18n();
  const labels = useDayLabels();
  const cardRef = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ state: ActionState; text: string } | null>(null);
  // Pedido enviado aos sócios: a semana mostra o horário atual e o pedido tracejado. Fica na
  // memória da aba (não some ao ir a outra aba e voltar).
  const [requested, setRequested] = useHoursMemory<Row[] | null>("week.requested", null);

  const changed = useMemo(() => changedWeekdays(draft, saved), [draft, saved]);
  const changedSet = new Set(changed);
  const requestedByDay = new Map(
    requested
      ? changedWeekdays(requested, saved).map((weekday) => [
          weekday,
          requested.find((row) => row.weekday === weekday),
        ])
      : [],
  );
  const ruler = rulerRange([...draft, ...(requested ?? [])]);
  const byDay = new Map(draft.map((row) => [row.weekday, row]));
  const dirty = canEdit && changed.length > 0;
  const dayName = (weekday: number) => t(WEEKDAY_KEYS[weekday]);
  const groupName = (weekdays: number[]) =>
    weekdays.length === 1
      ? labels.weekdayShort(weekdays[0])
      : `${labels.weekdayShort(weekdays[0])}–${labels.weekdayShort(weekdays.at(-1) ?? 0)}`;

  function update(weekday: number, change: Partial<HoursRow>) {
    setResult(null);
    onDraftChange(draft.map((row) => (row.weekday === weekday ? { ...row, ...change } : row)));
  }

  async function save() {
    const invalid = draft.filter((row) => dayInvalid(row));
    if (invalid.length) {
      setResult({
        state: "error",
        text:
          invalid.length === 1
            ? t("hours.week.fixOne", { day: dayName(invalid[0].weekday) })
            : t("hours.week.fixMany", { count: invalid.length }),
      });
      focusFirstInvalid(cardRef.current);
      return;
    }
    setSaving(true);
    setResult({ state: "saving", text: t("hours.week.saving") });
    try {
      const outcome = await onSave(draft);
      if (outcome === "pending") {
        setRequested(draft);
        onDraftChange(saved);
        setResult(null);
      } else {
        setRequested(null);
        setResult({ state: "saved", text: t("hours.week.saved") });
      }
    } catch (error) {
      setResult({
        state: "error",
        text: error instanceof Error && error.message ? error.message : t("shop.error.saveHours"),
      });
    } finally {
      setSaving(false);
    }
  }

  const editingRow = editing === null ? undefined : byDay.get(editing);

  return (
    <section
      ref={cardRef}
      aria-labelledby="hours-week-title"
      className="space-y-4 rounded-2xl border border-border bg-card p-4"
    >
      <SectionHeader
        id="hours-week-title"
        as="h3"
        icon={CalendarDays}
        title={t("hours.week.title")}
        description={t("hours.week.description")}
        aside={
          !canEdit ? (
            <StatusBadge tone="neutral" icon={Lock} label={t("hours.week.ownerOnly")} />
          ) : requested ? (
            <StatusBadge {...STATE.waiting} label={t("hours.week.awaiting")} />
          ) : dirty ? (
            <StatusBadge tone="pending" variant="dot" label={t("visual.unsaved.badge")} />
          ) : null
        }
      />

      {loadError && (
        <Notice
          tone="danger"
          title={t("hours.loadError")}
          action={{ label: t("hours.retry"), onClick: onRetry }}
        >
          {loadError}
        </Notice>
      )}

      {loading && draft.length === 0 ? (
        <LoadingState variant="list" count={7} label={t("hours.loading")} />
      ) : (
        <>
          {/* Resumo: dias iguais juntos, para entender a semana em um relance. */}
          <ul className="flex flex-wrap gap-1.5" aria-label={t("hours.week.summaryAria")}>
            {groupWeek(draft).map((group) => (
              <li key={group.weekdays.join("-")}>
                {group.is_open && toMinutes(group.closes) > toMinutes(group.opens) ? (
                  <StatusBadge
                    tone="success"
                    icon={Store}
                    label={`${groupName(group.weekdays)} · ${rangeLabel(group.opens, group.closes)}`}
                  />
                ) : group.is_open ? (
                  <StatusBadge
                    {...STATE.attention}
                    label={`${groupName(group.weekdays)} · ${t("hours.week.check")}`}
                  />
                ) : (
                  <StatusBadge
                    {...STATE.closed}
                    label={`${groupName(group.weekdays)} · ${t("shop.hours.closed")}`}
                  />
                )}
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-[3rem_minmax(0,1fr)_auto] gap-x-2">
            <span />
            <RulerTicks ruler={ruler} className="mx-3" />
            {canEdit && <span className="w-11" />}
          </div>

          <ol className="-mt-2 space-y-1.5">
            {WEEK_ORDER.map((weekday) => {
              const row = byDay.get(weekday);
              if (!row) return null;
              const invalid = dayInvalid(row);
              const isToday = weekday === todayWeekday;
              const wanted = requestedByDay.get(weekday);
              const segments: TrackSegment[] = [];
              if (row.is_open && !invalid) {
                segments.push({
                  kind: "open",
                  start: toMinutes(row.opens_at),
                  end: toMinutes(row.closes_at),
                });
              }
              if (wanted?.is_open) {
                segments.push({
                  kind: "pending",
                  start: toMinutes(wanted.opens_at),
                  end: toMinutes(wanted.closes_at),
                });
              }
              const range = rangeLabel(row.opens_at, row.closes_at);
              const body = (
                <>
                  <span className="flex min-h-6 items-center gap-2">
                    {row.is_open ? (
                      <span className="whitespace-nowrap text-[15px] font-bold tabular-nums">
                        {range}
                      </span>
                    ) : (
                      <span className="tone-neutral inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--tone-ink)]">
                        <Moon className="size-4" aria-hidden />
                        {t("shop.hours.closed")}
                      </span>
                    )}
                    {changedSet.has(weekday) && canEdit && (
                      <StatusBadge
                        tone="pending"
                        variant="dot"
                        size="sm"
                        label={t("hours.week.changed")}
                      />
                    )}
                    {canEdit && (
                      <Pencil
                        className="ml-auto size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    )}
                  </span>
                  <DayTrack
                    ruler={ruler}
                    closed={!row.is_open && !wanted?.is_open}
                    segments={segments}
                    className="mt-1.5"
                  />
                  {wanted && (
                    <span className="tone-pending mt-1 flex items-center gap-1 text-xs font-semibold text-[color:var(--tone-ink)]">
                      <Hourglass className="size-3.5" aria-hidden />
                      {wanted.is_open
                        ? t("hours.week.requested", {
                            range: rangeLabel(wanted.opens_at, wanted.closes_at),
                          })
                        : t("hours.week.requestedClosed")}
                    </span>
                  )}
                </>
              );
              const ariaState = row.is_open
                ? t("hours.week.dayOpenAria", { day: dayName(weekday), range })
                : t("hours.week.dayClosedAria", { day: dayName(weekday) });
              return (
                <li
                  key={weekday}
                  className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-x-2"
                >
                  <span
                    className={cn(
                      "flex min-h-12 flex-col items-center justify-center rounded-xl text-sm font-bold leading-tight",
                      isToday &&
                        "tone-highlight bg-[color:var(--tone-bg)] ring-2 ring-[color:var(--tone-line)]",
                    )}
                  >
                    {labels.weekdayShort(weekday)}
                    {isToday && (
                      <span className="text-xs font-semibold text-[color:var(--tone-ink)]">
                        {t("hours.today")}
                      </span>
                    )}
                  </span>
                  <div className="min-w-0">
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => setEditing(weekday)}
                        aria-invalid={invalid || undefined}
                        aria-label={[
                          ariaState,
                          changedSet.has(weekday) ? t("hours.week.changed") : null,
                          t("hours.week.editAria"),
                        ]
                          .filter(Boolean)
                          .join(". ")}
                        className={cn(
                          "block w-full rounded-xl border bg-background px-3 py-2 text-left transition-colors hover:border-primary/50",
                          invalid
                            ? "tone-danger border-[color:var(--tone-line)]"
                            : changedSet.has(weekday)
                              ? "tone-pending border-dashed border-[color:var(--tone-line)]"
                              : "border-border",
                        )}
                      >
                        {body}
                      </button>
                    ) : (
                      <div className="rounded-xl px-3 py-2" aria-label={ariaState} role="group">
                        {body}
                      </div>
                    )}
                    {invalid && (
                      <FieldMessage tone="error" className="mt-1">
                        {t("hours.week.closeBeforeOpen")}
                      </FieldMessage>
                    )}
                  </div>
                  {canEdit && (
                    <Switch
                      checked={row.is_open}
                      aria-label={t("shop.hours.openAria", { day: dayName(weekday) })}
                      disabled={saving}
                      onCheckedChange={(checked) => update(weekday, { is_open: checked })}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}

      {requested && (
        <Notice
          tone="pending"
          role="none"
          title={t("hours.week.awaitingTitle")}
          action={
            onOpenApprovals
              ? { label: t("hours.seeRequests"), onClick: onOpenApprovals }
              : undefined
          }
        >
          {t("hours.week.awaitingDetail")}
        </Notice>
      )}

      {!canEdit && <Hint icon={Lock}>{t("shop.error.roleHours")}</Hint>}

      {canEdit && (
        <UnsavedBar
          dirty={dirty}
          count={changed.length}
          saving={saving}
          state={result?.state ?? null}
          stateText={result?.text}
          onSave={() => void save()}
          onDiscard={() => {
            setResult(null);
            onDraftChange(saved);
          }}
          saveLabel={
            changed.length === 1
              ? t("hours.week.saveOne")
              : t("hours.week.saveMany", { count: changed.length })
          }
        />
      )}

      {editingRow && (
        <DayHoursDialog
          key={editingRow.weekday}
          row={editingRow}
          draft={draft}
          dayName={dayName}
          shortName={labels.weekdayShort}
          onClose={() => setEditing(null)}
          onApply={({ start, end, copyTo }) => {
            setResult(null);
            const targets = new Set([editingRow.weekday, ...copyTo]);
            onDraftChange(
              draft.map((row) =>
                targets.has(row.weekday)
                  ? { ...row, is_open: true, opens_at: start, closes_at: end }
                  : row,
              ),
            );
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

function DayHoursDialog({
  row,
  draft,
  dayName,
  shortName,
  onClose,
  onApply,
}: {
  row: HoursRow;
  draft: HoursRow[];
  dayName: (weekday: number) => string;
  shortName: (weekday: number) => string;
  onClose: () => void;
  onApply: (value: { start: string; end: string; copyTo: number[] }) => void;
}) {
  const { t } = useI18n();
  const [range, setRange] = useState({ start: hhmm(row.opens_at), end: hhmm(row.closes_at) });
  const [copyTo, setCopyTo] = useState<number[]>([]);
  const invalid = toMinutes(range.end) <= toMinutes(range.start);
  const others = WEEK_ORDER.filter((weekday) => weekday !== row.weekday);
  const openOthers = others.filter((weekday) => draft.find((r) => r.weekday === weekday)?.is_open);
  const preview = [
    ...draft.filter((r) => r.weekday !== row.weekday),
    { ...row, is_open: true, opens_at: range.start, closes_at: range.end },
  ];
  const ruler = rulerRange(preview);
  const label = rangeLabelNoBreak(range.start, range.end);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[88dvh] w-[calc(100%-2rem)] flex-col overflow-hidden rounded-3xl p-0 sm:max-w-md sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-border px-5 pb-3 pr-14 pt-5">
          <IconTile icon={CalendarDays} />
          <div className="min-w-0">
            <DialogTitle>{t("hours.dialog.title", { day: dayName(row.weekday) })}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {t("hours.dialog.description")}
            </DialogDescription>
          </div>
        </div>
        <DialogScrollArea className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <TimeRangeEditor
            start={range.start}
            end={range.end}
            onChange={setRange}
            startLabel={t("hours.opens")}
            endLabel={t("hours.closes")}
            context={dayName(row.weekday)}
            error={invalid ? t("hours.week.closeBeforeOpen") : null}
          />
          <div className="space-y-1.5" aria-hidden>
            <RulerTicks ruler={ruler} />
            <DayTrack
              ruler={ruler}
              size="md"
              segments={
                invalid
                  ? []
                  : [{ kind: "open", start: toMinutes(range.start), end: toMinutes(range.end) }]
              }
            />
          </div>
          <div className="space-y-2">
            <ChoiceChips<number>
              multiple
              label={t("hours.dialog.copyTo")}
              icon={Copy}
              value={copyTo}
              onChange={setCopyTo}
              options={others.map((weekday) => {
                const open = draft.find((r) => r.weekday === weekday)?.is_open;
                return {
                  value: weekday,
                  label: shortName(weekday),
                  icon: open ? undefined : Moon,
                  ariaLabel: open
                    ? dayName(weekday)
                    : t("hours.dialog.copyClosedAria", { day: dayName(weekday) }),
                };
              })}
            />
            {openOthers.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setCopyTo((current) =>
                    openOthers.every((weekday) => current.includes(weekday)) ? [] : openOthers,
                  )
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-border px-3 text-sm font-semibold hover:border-primary/50"
              >
                <Copy className="size-4 text-gold" aria-hidden />
                {openOthers.every((weekday) => copyTo.includes(weekday))
                  ? t("hours.dialog.copyNone")
                  : t("hours.dialog.copyAllOpen")}
              </button>
            )}
          </div>
        </DialogScrollArea>
        <div className="flex gap-2 border-t border-border bg-card p-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-border bg-background px-4 text-sm font-semibold"
          >
            {t("common.back")}
          </button>
          <button
            type="button"
            disabled={invalid}
            onClick={() => onApply({ start: range.start, end: range.end, copyTo })}
            className="action-button action-confirm min-h-11 flex-1 justify-center"
          >
            <Check className="size-4" aria-hidden />
            {copyTo.length
              ? t("hours.dialog.applyMany", { range: label, count: copyTo.length + 1 })
              : t("hours.dialog.apply", { range: label })}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
