import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarSearch,
  CalendarX2,
  Clock3,
  Loader2,
  Lock,
  Moon,
  PenLine,
  Store,
  Sun,
  Sunrise,
  Sunset,
  Tag as TagIcon,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogScrollArea,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/schedule-picker";
import {
  ActionResult,
  ApprovalNote,
  ChoiceChips,
  Field,
  IconTile,
  Notice,
  PersonAvatar,
  PreviewPanel,
  Tag,
} from "@/components/visual";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { dateFromLocalKey, shiftDateKey } from "@/lib/shop/appointments";
import type { SaveOutcome } from "../catalog/types";
import { DayTrack, RulerTicks, type TrackSegment } from "./DayTrack";
import { useDayLabels } from "./labels";
import {
  overlaps,
  quickRanges,
  rangeLabel,
  rangeLabelNoBreak,
  rulerRange,
  toMinutes,
  weekdayOfKey,
  type HoursRow,
  type QuickRangeId,
  type TimeSpan,
} from "./model";
import { BLOCK_REASONS } from "./reasons";
import { TimeRangeEditor } from "./TimeRangeEditor";

/** O que a janela envia para o painel gravar (mesmos campos do formulário antigo). */
export type BlockDraft = {
  date: string;
  start: string;
  end: string;
  staffId: string | null;
  reason: string | null;
};

/** Atendimento do dia, só o necessário para avisar quem fica dentro do bloqueio. */
export type DayBooking = {
  span: TimeSpan;
  staffId: string | null;
  who: string;
  time: string;
};

export type StaffOption = { id: string; display_name: string; avatar_url: string | null };

const RANGE_META: Record<QuickRangeId, { key: MessageKey; icon: LucideIcon }> = {
  lunch: { key: "hours.block.lunch", icon: UtensilsCrossed },
  morning: { key: "hours.block.morning", icon: Sunrise },
  afternoon: { key: "hours.block.afternoon", icon: Sunset },
  allDay: { key: "hours.block.allDay", icon: Sun },
};

type ReasonId = (typeof BLOCK_REASONS)[number]["id"] | "other";

/**
 * "Bloquear um horário" em blocos curtos: quando, horário (atalhos do expediente do dia), para
 * quem (fotos da equipe) e motivo (com ícone). O resumo no fim mostra o dia com o trecho
 * bloqueado, avisa atendimentos já marcados e dia fechado, e o botão diz o efeito.
 */
export function BlockDialog({
  todayKey,
  nowMinutes,
  hours,
  staff,
  ownStaff,
  initialDate,
  initialStaffId,
  blockedDays,
  loadBookings,
  onCreate,
  onClose,
}: {
  todayKey: string;
  nowMinutes: number;
  hours: HoursRow[];
  staff: StaffOption[];
  /** Quem só bloqueia a própria agenda (parceiro sem poder de operação). */
  ownStaff: StaffOption | null;
  initialDate?: string | null;
  initialStaffId?: string | null;
  /** Datas que já têm bloqueio (pontinho no calendário). */
  blockedDays: Set<string>;
  loadBookings: (dateKey: string) => Promise<DayBooking[]>;
  onCreate: (draft: BlockDraft) => Promise<SaveOutcome>;
  onClose: (result?: { outcome: SaveOutcome; summary: string }) => void;
}) {
  const { t } = useI18n();
  const labels = useDayLabels();
  const tomorrowKey = shiftDateKey(todayKey, 1);
  const startDate = initialDate && initialDate >= todayKey ? initialDate : todayKey;
  const [date, setDate] = useState(startDate);
  const [when, setWhen] = useState<"today" | "tomorrow" | "pick">(
    startDate === todayKey ? "today" : startDate === tomorrowKey ? "tomorrow" : "pick",
  );
  const day = hours.find((row) => row.weekday === weekdayOfKey(date));
  const ranges = useMemo(() => quickRanges(day), [day]);
  const isToday = date === todayKey;
  const passed = (end: string) => isToday && toMinutes(end) <= nowMinutes;
  const firstRange = ranges.find((range) => !passed(range.end));
  const [rangeId, setRangeId] = useState<QuickRangeId | "custom">(firstRange?.id ?? "custom");
  const [custom, setCustom] = useState({ start: "12:00", end: "13:00" });
  const [staffId, setStaffId] = useState(
    initialStaffId && staff.some((member) => member.id === initialStaffId) ? initialStaffId : "",
  );
  const [reasonId, setReasonId] = useState<ReasonId | null>(null);
  const [otherReason, setOtherReason] = useState("");
  const [bookings, setBookings] = useState<DayBooking[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // Trocou o dia e o atalho não cabe mais no expediente: passa para o primeiro que cabe.
  useEffect(() => {
    if (rangeId === "custom") return;
    const current = ranges.find((range) => range.id === rangeId);
    if (!current || passed(current.end)) {
      const next = ranges.find((range) => !passed(range.end));
      if (!next && current) setCustom({ start: current.start, end: current.end });
      setRangeId(next?.id ?? "custom");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao trocar o dia
  }, [date]);

  useEffect(() => {
    let active = true;
    setBookings(null);
    loadBookings(date)
      .then((rows) => active && setBookings(rows))
      .catch(() => active && setBookings([]));
    return () => {
      active = false;
    };
  }, [date, loadBookings]);

  const range =
    rangeId === "custom" ? custom : (ranges.find((item) => item.id === rangeId) ?? custom);
  const span = { start: toMinutes(range.start), end: toMinutes(range.end) };
  const label = rangeLabel(range.start, range.end);
  const effectiveStaff = ownStaff ? ownStaff.id : staffId || null;
  const who = ownStaff
    ? ownStaff.display_name
    : (staff.find((member) => member.id === staffId)?.display_name ?? t("shop.block.wholeShop"));
  const reasonText =
    reasonId === "other"
      ? otherReason.trim()
      : reasonId
        ? t(BLOCK_REASONS.find((item) => item.id === reasonId)?.key ?? "shop.block.defaultReason")
        : "";
  const problem =
    span.end <= span.start
      ? t("hours.block.endAfterStart")
      : passed(range.end)
        ? t("hours.block.passed")
        : null;
  const clashes = (bookings ?? []).filter(
    (booking) =>
      overlaps(booking.span, span) && (!effectiveStaff || booking.staffId === effectiveStaff),
  );
  const dayLabel = labels.date(date);
  const dayClosed = !day?.is_open;
  const ruler = rulerRange(
    day?.is_open ? [day, { ...day, opens_at: range.start, closes_at: range.end }] : [],
  );
  const segments: TrackSegment[] = [
    ...(day?.is_open
      ? [{ kind: "open" as const, start: toMinutes(day.opens_at), end: toMinutes(day.closes_at) }]
      : []),
    ...(problem ? [] : [{ kind: "blocked" as const, ...span }]),
  ];
  const summary = [reasonText || t("shop.block.defaultReason"), dayLabel, label, who].join(" · ");

  async function submit() {
    if (problem || saving) return;
    setSaving(true);
    setFailure(null);
    try {
      const outcome = await onCreate({
        date,
        start: range.start,
        end: range.end,
        staffId: effectiveStaff,
        reason: reasonText || null,
      });
      onClose({ outcome, summary });
    } catch (error) {
      setFailure(
        error instanceof Error && error.message ? error.message : t("shop.error.createBlock"),
      );
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent
        className="flex max-h-[90dvh] w-[calc(100%-2rem)] flex-col overflow-hidden rounded-3xl p-0 sm:max-w-lg sm:rounded-3xl"
        onEscapeKeyDown={(event) => saving && event.preventDefault()}
        onPointerDownOutside={(event) => saving && event.preventDefault()}
      >
        <div className="flex items-center gap-3 border-b border-border px-5 pb-3 pr-14 pt-5">
          <IconTile icon={CalendarX2} tone="danger" />
          <div className="min-w-0">
            <DialogTitle>
              {ownStaff ? t("hours.block.ownTitle") : t("hours.block.title")}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {t("hours.block.description")}
            </DialogDescription>
          </div>
        </div>
        <DialogScrollArea className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <div className="space-y-2">
            <ChoiceChips<"today" | "tomorrow" | "pick">
              label={t("hours.block.when")}
              icon={CalendarDays}
              value={when}
              onChange={(value) => {
                setWhen(value);
                if (value === "today") setDate(todayKey);
                if (value === "tomorrow") setDate(tomorrowKey);
                if (value === "pick" && date <= tomorrowKey) setDate(shiftDateKey(todayKey, 2));
              }}
              options={[
                { value: "today", label: t("hours.today"), note: labels.date(todayKey) },
                { value: "tomorrow", label: t("hours.tomorrow"), note: labels.date(tomorrowKey) },
                {
                  value: "pick",
                  label: t("hours.block.pickDate"),
                  icon: CalendarSearch,
                  note: when === "pick" ? dayLabel : undefined,
                },
              ]}
            />
            {when === "pick" && (
              <DatePicker
                label={t("shop.block.date")}
                value={date}
                onChange={setDate}
                min={dateFromLocalKey(todayKey)}
                displayValue={dayLabel}
                dayMarks={{
                  mutedLabel: t("hours.block.dayClosed"),
                  // A legenda do pontinho só aparece quando algum dia já tem bloqueio.
                  dottedLabel: blockedDays.size ? t("hours.block.dayHasBlock") : undefined,
                  muted: (value) => !hours.find((row) => row.weekday === value.getDay())?.is_open,
                  dotted: (value) =>
                    blockedDays.has(
                      `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`,
                    ),
                }}
              />
            )}
          </div>

          <div className="space-y-2">
            <ChoiceChips<QuickRangeId | "custom">
              label={t("hours.block.time")}
              icon={Clock3}
              value={rangeId}
              onChange={(value) => {
                if (value === "custom" && rangeId !== "custom") {
                  setCustom({ start: range.start, end: range.end });
                }
                setRangeId(value);
              }}
              options={[
                ...ranges.map((item) => ({
                  value: item.id,
                  label: t(RANGE_META[item.id].key),
                  note: rangeLabel(item.start, item.end),
                  icon: RANGE_META[item.id].icon,
                  disabled: passed(item.end),
                })),
                { value: "custom" as const, label: t("hours.block.otherTime"), icon: PenLine },
              ]}
            />
            {rangeId === "custom" && (
              <TimeRangeEditor
                start={custom.start}
                end={custom.end}
                onChange={setCustom}
                startLabel={t("hours.block.starts")}
                endLabel={t("hours.block.ends")}
                context={dayLabel}
                error={span.end <= span.start ? t("hours.block.endAfterStart") : null}
              />
            )}
          </div>

          {ownStaff ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-bold">
                <Users className="size-4 text-gold" aria-hidden />
                {t("hours.block.who")}
              </p>
              <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-semibold">
                <PersonAvatar
                  name={ownStaff.display_name}
                  src={ownStaff.avatar_url}
                  seed={ownStaff.id}
                  size="xs"
                />
                {t("hours.block.yourAgenda")}
                <Lock className="size-4 text-muted-foreground" aria-hidden />
              </span>
            </div>
          ) : (
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

          <div className="space-y-2">
            <ChoiceChips<ReasonId>
              label={t("hours.block.reason")}
              icon={TagIcon}
              value={reasonId}
              onChange={setReasonId}
              options={[
                ...BLOCK_REASONS.map((item) => ({
                  value: item.id,
                  label: t(item.key),
                  icon: item.icon,
                })),
                { value: "other" as const, label: t("hours.block.otherReason"), icon: PenLine },
              ]}
            />
            {reasonId === "other" && (
              <Field label={t("shop.block.reasonQuestion")} optional>
                {(props) => (
                  <input
                    {...props}
                    value={otherReason}
                    onChange={(event) => setOtherReason(event.target.value)}
                    placeholder={t("shop.block.reasonPlaceholder")}
                    maxLength={80}
                    className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
                  />
                )}
              </Field>
            )}
          </div>

          <PreviewPanel title={t("hours.block.summary")} icon={CalendarX2} live>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-base font-extrabold tabular-nums">{label}</span>
              <Tag icon={CalendarDays}>{dayLabel}</Tag>
              <Tag icon={effectiveStaff ? Users : Store}>{who}</Tag>
            </div>
            <div className="space-y-1" aria-hidden>
              <RulerTicks ruler={ruler} />
              <DayTrack
                ruler={ruler}
                segments={segments}
                closed={dayClosed && !!problem}
                size="md"
              />
            </div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <CalendarDays className="size-3.5 text-gold" aria-hidden />
              {t("hours.block.onlyThisDay")}
            </p>
            {problem && <Notice tone="danger" title={problem} />}
            {dayClosed && (
              <Notice
                tone="neutral"
                icon={Moon}
                role="none"
                title={t("hours.block.closedDay", { day: labels.weekdayShort(weekdayOfKey(date)) })}
              />
            )}
            {clashes.length > 0 && (
              <Notice
                tone="warning"
                title={
                  clashes.length === 1
                    ? t("hours.block.clashOne")
                    : t("hours.block.clashMany", { count: clashes.length })
                }
              >
                <span className="block tabular-nums">
                  {clashes
                    .slice(0, 4)
                    .map((booking) => `${booking.time} ${booking.who}`)
                    .join(" · ")}
                  {clashes.length > 4 ? " …" : ""}
                </span>
                <span className="block font-semibold">{t("hours.block.clashHint")}</span>
              </Notice>
            )}
          </PreviewPanel>
        </DialogScrollArea>
        <div className="space-y-2 border-t border-border bg-card p-4">
          <ActionResult
            state={failure ? "error" : null}
            text={failure ?? undefined}
            onRetry={() => void submit()}
            reveal={false}
          />
          {/* Dono em sociedade: o bloqueio vai para aprovação; avisado antes de salvar. */}
          <ApprovalNote />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => onClose()}
              className="min-h-11 rounded-xl border border-border bg-background px-4 text-sm font-semibold"
            >
              {t("common.back")}
            </button>
            <button
              type="button"
              disabled={!!problem || saving}
              onClick={() => void submit()}
              className="action-button action-confirm min-h-11 flex-1 justify-center disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
              ) : (
                <CalendarX2 className="size-4" aria-hidden />
              )}
              {saving
                ? t("hours.block.saving")
                : t("hours.block.submit", { range: rangeLabelNoBreak(range.start, range.end) })}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
