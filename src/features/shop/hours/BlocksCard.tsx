import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  CalendarCheck,
  CalendarPlus,
  CalendarX2,
  Clock3,
  Moon,
  Store,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  ActionResult,
  ConfirmDialog,
  DetailList,
  Hint,
  IconTile,
  PersonAvatar,
  SectionHeader,
  STATE,
  StatusBadge,
  Tag,
  type ActionState,
} from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { SaveOutcome } from "../catalog/types";
import { BlockDialog, type BlockDraft, type DayBooking, type StaffOption } from "./BlockDialog";
import { BLOCK_REASONS } from "./reasons";
import { DayTrack, RulerTicks, type TrackSegment } from "./DayTrack";
import { useDayLabels } from "./labels";
import { useHoursMemory } from "./memory";
import {
  blockSpanOn,
  rangeLabel,
  fromMinutes,
  rulerRange,
  toMinutes,
  weekdayOfKey,
  type HoursRow,
  type PlacedBlock,
} from "./model";
import { shiftDateKey } from "@/lib/shop/appointments";

const DAYS_AHEAD = 7;

/**
 * "Bloqueios": sem bloqueios, a resposta verde vem primeiro. Os próximos 7 dias aparecem em blocos
 * de data (aberto · fechado · com bloqueio) que já abrem a janela com o dia escolhido; o desenho
 * do expediente com os trechos bloqueados só aparece nos dias que têm bloqueio, com a lista logo
 * abaixo. Os mais distantes ficam agrupados por data.
 */
export function BlocksCard({
  blocks,
  staff,
  hours,
  todayKey,
  nowMinutes,
  ownStaff,
  canDelete,
  loadBookings,
  onCreate,
  onDelete,
  request,
  onRequestHandled,
  onOpenApprovals,
}: {
  blocks: PlacedBlock[];
  staff: StaffOption[];
  hours: HoursRow[];
  todayKey: string;
  nowMinutes: number;
  ownStaff: StaffOption | null;
  canDelete: (block: PlacedBlock) => boolean;
  loadBookings: (dateKey: string) => Promise<DayBooking[]>;
  onCreate: (draft: BlockDraft) => Promise<SaveOutcome>;
  onDelete: (id: string) => Promise<SaveOutcome>;
  /** Pedido vindo de Equipe ("Bloquear horário" de um profissional). */
  request: { staffId: string | null } | null;
  onRequestHandled: () => void;
  onOpenApprovals?: () => void;
}) {
  const { t } = useI18n();
  const labels = useDayLabels();
  const [dialog, setDialog] = useState<{ date: string | null; staffId: string | null } | null>(
    null,
  );
  const [result, setResult] = useState<{ state: ActionState; text: string } | null>(null);
  // Pedidos enviados aos sócios: ficam na memória da aba (não somem ao ir a outra aba e voltar).
  const [requested, setRequested] = useHoursMemory<PlacedBlock[]>("blocks.requested", []);
  const [deleteRequested, setDeleteRequested] = useHoursMemory<string[]>(
    "blocks.deleteRequested",
    [],
  );
  const [confirming, setConfirming] = useState<PlacedBlock | null>(null);

  // Equipe → "Bloquear horário": abre a janela já com o profissional escolhido.
  useEffect(() => {
    if (!request) return;
    setDialog({ date: null, staffId: request.staffId });
    onRequestHandled();
  }, [request, onRequestHandled]);

  const all = useMemo(() => [...blocks, ...requested], [blocks, requested]);
  const days = Array.from({ length: DAYS_AHEAD }, (_, index) => shiftDateKey(todayKey, index));
  const lastKey = days.at(-1) ?? todayKey;
  const later = all
    .filter((block) => block.startKey > lastKey)
    .sort((a, b) =>
      (a.startKey + fromMinutes(a.startMinute)).localeCompare(
        b.startKey + fromMinutes(b.startMinute),
      ),
    );
  const laterDays = [...new Set(later.map((block) => block.startKey))];
  const byDay = new Map(hours.map((row) => [row.weekday, row]));
  const ruler = rulerRange(hours);
  const blockedDays = useMemo(() => {
    const set = new Set<string>();
    for (const block of all) {
      for (let key = block.startKey; key <= block.endKey; key = shiftDateKey(key, 1)) set.add(key);
    }
    return set;
  }, [all]);

  const blocksOn = (dayKey: string) =>
    all.filter((block) => blockSpanOn(block, dayKey)).sort((a, b) => a.startMinute - b.startMinute);
  const busyDays = days.filter((dayKey) => blocksOn(dayKey).length > 0);
  const countLabel = (count: number) =>
    count === 1 ? t("hours.blocks.countOne") : t("hours.blocks.countMany", { count });
  const reasonOf = (block: PlacedBlock) => block.reason || t("shop.block.defaultReason");
  const iconOf = (block: PlacedBlock): LucideIcon =>
    BLOCK_REASONS.find((item) => t(item.key) === block.reason)?.icon ?? Ban;
  const timeOf = (block: PlacedBlock) =>
    block.startKey === block.endKey
      ? rangeLabel(fromMinutes(block.startMinute), fromMinutes(block.endMinute))
      : `${labels.date(block.startKey)} ${fromMinutes(block.startMinute)} → ${labels.date(block.endKey)} ${fromMinutes(block.endMinute)}`;
  const describe = (block: PlacedBlock) =>
    [
      reasonOf(block),
      labels.date(block.startKey),
      timeOf(block),
      block.staffName ?? t("shop.block.wholeShop"),
    ].join(", ");

  function blockItem(block: PlacedBlock) {
    const Icon = iconOf(block);
    const pendingDelete = deleteRequested.includes(block.id);
    const member = block.staffId ? staff.find((row) => row.id === block.staffId) : null;
    return (
      <li
        key={block.id}
        className={cn(
          "flex items-center gap-2.5 rounded-xl border bg-background p-2",
          block.requested
            ? "tone-pending border-dashed border-[color:var(--tone-line)]"
            : "tone-danger border-[color:var(--tone-border)]",
        )}
      >
        <IconTile icon={Icon} tone={block.requested ? "pending" : "danger"} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{reasonOf(block)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Tag icon={Clock3}>{timeOf(block)}</Tag>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              {block.staffId ? (
                <PersonAvatar
                  name={block.staffName ?? ""}
                  src={member?.avatar_url}
                  seed={block.staffId}
                  size="xs"
                />
              ) : (
                <Store className="size-4" aria-hidden />
              )}
              {block.staffName ?? t("shop.block.wholeShop")}
            </span>
            {block.requested && (
              <StatusBadge {...STATE.waiting} size="sm" label={t("hours.blocks.requested")} />
            )}
            {pendingDelete && (
              <StatusBadge {...STATE.waiting} size="sm" label={t("hours.blocks.deleteRequested")} />
            )}
          </div>
        </div>
        {!block.requested && !pendingDelete && canDelete(block) && (
          <button
            type="button"
            onClick={() => setConfirming(block)}
            aria-label={t("hours.blocks.deleteAria", { block: describe(block) })}
            className="action-button action-danger shrink-0"
          >
            <Trash2 size={16} />
          </button>
        )}
      </li>
    );
  }

  return (
    <section
      aria-labelledby="hours-blocks-title"
      className="space-y-4 rounded-2xl border border-border bg-card p-4"
    >
      <SectionHeader
        id="hours-blocks-title"
        as="h3"
        icon={CalendarX2}
        tone="danger"
        title={ownStaff ? t("hours.blocks.ownTitle") : t("hours.blocks.title")}
        description={t("hours.blocks.description")}
      />
      {/* Sem bloqueios: a resposta vem primeiro, em verde. */}
      {all.length === 0 && (
        <Hint icon={CalendarCheck} tone="success">
          {t("hours.blocks.empty")}
        </Hint>
      )}
      <button
        type="button"
        onClick={() => {
          setResult(null);
          setDialog({ date: null, staffId: null });
        }}
        className="action-button action-confirm w-full sm:w-auto"
      >
        <CalendarX2 aria-hidden />
        {ownStaff ? t("hours.blocks.addOwn") : t("hours.blocks.add")}
      </button>
      <ActionResult
        state={result?.state ?? null}
        text={result?.text}
        autoHideMs={6000}
        onDismiss={() => setResult(null)}
      />

      {/* Próximos dias em blocos de data: o desenho do dia só aparece onde há bloqueio. */}
      <div className="space-y-2">
        <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
          <span className="font-bold text-muted-foreground">{t("hours.blocks.next")}</span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <CalendarPlus className="size-3.5 text-gold" aria-hidden />
            {t("hours.blocks.tapDay")}
          </span>
        </p>
        <ol className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {days.map((dayKey) => {
            const hoursRow = byDay.get(weekdayOfKey(dayKey));
            const open = !!hoursRow?.is_open;
            const count = blocksOn(dayKey).length;
            const isToday = dayKey === todayKey;
            const aria = [
              t("hours.blocks.addOnAria", { date: labels.date(dayKey) }),
              open && hoursRow
                ? rangeLabel(hoursRow.opens_at, hoursRow.closes_at)
                : t("shop.hours.closed"),
              count ? countLabel(count) : null,
            ]
              .filter(Boolean)
              .join(". ");
            return (
              <li key={dayKey}>
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setDialog({ date: dayKey, staffId: null });
                  }}
                  aria-label={aria}
                  className={cn(
                    "flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-xl border px-1 py-1.5 text-xs font-bold leading-none transition-colors hover:border-primary/50",
                    isToday
                      ? "tone-highlight border-[color:var(--tone-line)] bg-[color:var(--tone-bg)] ring-1 ring-[color:var(--tone-line)]"
                      : "border-border bg-background",
                  )}
                >
                  <span className={cn(isToday && "text-[color:var(--tone-ink)]")}>
                    {isToday ? t("hours.today") : labels.weekdayShort(weekdayOfKey(dayKey))}
                  </span>
                  <span className="text-base font-extrabold tabular-nums">
                    {labels.dayNumber(dayKey)}
                  </span>
                  {count > 0 ? (
                    <span className="tone-danger inline-flex h-4 items-center gap-0.5 rounded-full bg-[color:var(--tone-bg)] px-1.5 text-[11px] text-[color:var(--tone-ink)]">
                      <Ban className="size-3" aria-hidden />
                      {count}
                    </span>
                  ) : open ? (
                    <span className="tone-success flex h-4 items-center" aria-hidden>
                      <span className="block h-1.5 w-7 rounded-full bg-[color:var(--tone-line)]" />
                    </span>
                  ) : (
                    <Moon
                      className="tone-neutral size-4 text-[color:var(--tone-ink)]"
                      aria-hidden
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {busyDays.length > 0 && (
        <ol className="space-y-3">
          {busyDays.map((dayKey) => {
            const hoursRow = byDay.get(weekdayOfKey(dayKey));
            const open = !!hoursRow?.is_open;
            const dayBlocks = blocksOn(dayKey);
            const segments: TrackSegment[] = [];
            if (open && hoursRow) {
              segments.push({
                kind: "open",
                start: toMinutes(hoursRow.opens_at),
                end: toMinutes(hoursRow.closes_at),
              });
            }
            for (const block of dayBlocks) {
              const span = blockSpanOn(block, dayKey);
              if (span) {
                segments.push({
                  kind: block.requested ? "pending" : "blocked",
                  partial: !!block.staffId,
                  ...span,
                });
              }
            }
            const isToday = dayKey === todayKey;
            const relative = labels.relative(dayKey, todayKey);
            const near = isToday || dayKey === shiftDateKey(todayKey, 1);
            return (
              <li key={dayKey} className="space-y-1.5">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-bold">
                    {near ? `${relative} · ${labels.date(dayKey)}` : labels.date(dayKey)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {open && hoursRow
                      ? rangeLabel(hoursRow.opens_at, hoursRow.closes_at)
                      : t("shop.hours.closed")}
                    {` · ${countLabel(dayBlocks.length)}`}
                  </span>
                </p>
                <div className="space-y-1">
                  <RulerTicks ruler={ruler} />
                  <DayTrack
                    ruler={ruler}
                    segments={segments}
                    closed={!open && dayBlocks.length === 0}
                    nowMinute={isToday ? nowMinutes : null}
                    size="md"
                  />
                </div>
                <ul className="space-y-1.5">{dayBlocks.map(blockItem)}</ul>
              </li>
            );
          })}
        </ol>
      )}

      {laterDays.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-bold text-muted-foreground">{t("hours.blocks.later")}</p>
          {laterDays.map((dayKey) => (
            <div key={dayKey} className="space-y-1.5">
              <p className="text-sm font-semibold">{labels.date(dayKey)}</p>
              <ul className="space-y-1.5">
                {later.filter((block) => block.startKey === dayKey).map(blockItem)}
              </ul>
            </div>
          ))}
        </div>
      )}

      {requested.length > 0 && onOpenApprovals && (
        <button
          type="button"
          onClick={onOpenApprovals}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold hover:border-primary/50"
        >
          {t("hours.seeRequests")}
        </button>
      )}

      {dialog && (
        <BlockDialog
          todayKey={todayKey}
          nowMinutes={nowMinutes}
          hours={hours}
          staff={staff}
          ownStaff={ownStaff}
          initialDate={dialog.date}
          initialStaffId={dialog.staffId}
          blockedDays={blockedDays}
          loadBookings={loadBookings}
          onCreate={async (draft) => {
            const outcome = await onCreate(draft);
            if (outcome === "pending") {
              const member = staff.find((row) => row.id === draft.staffId);
              setRequested((current) => [
                ...current,
                {
                  id: `requested-${Date.now()}`,
                  staffId: draft.staffId,
                  staffName:
                    member?.display_name ??
                    (draft.staffId ? (ownStaff?.display_name ?? null) : null),
                  reason: draft.reason,
                  startKey: draft.date,
                  endKey: draft.date,
                  startMinute: toMinutes(draft.start),
                  endMinute: toMinutes(draft.end),
                  requested: true,
                },
              ]);
            }
            return outcome;
          }}
          onClose={(done) => {
            setDialog(null);
            if (!done) return;
            setResult(
              done.outcome === "pending"
                ? { state: "pending", text: t("hours.blocks.createdPending") }
                : { state: "saved", text: t("hours.blocks.created", { summary: done.summary }) },
            );
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(open) => !open && setConfirming(null)}
        tone="danger"
        icon={CalendarX2}
        title={t("hours.blocks.deleteTitle")}
        summary={
          confirming ? (
            <DetailList
              items={[
                { label: t("hours.block.reason"), value: reasonOf(confirming) },
                {
                  label: t("hours.blocks.whenLabel"),
                  value: `${labels.date(confirming.startKey)} · ${timeOf(confirming)}`,
                },
                {
                  label: t("hours.block.who"),
                  value: confirming.staffName ?? t("shop.block.wholeShop"),
                },
              ]}
            />
          ) : null
        }
        consequences={[
          { icon: CalendarCheck, tone: "success", text: t("hours.blocks.deleteEffect") },
        ]}
        confirmLabel={t("hours.blocks.deleteConfirm")}
        busyLabel={t("hours.blocks.deleting")}
        confirmIcon={Trash2}
        cancelLabel={t("hours.blocks.keep")}
        onConfirm={async () => {
          if (!confirming) return;
          const outcome = await onDelete(confirming.id);
          if (outcome === "pending") {
            const id = confirming.id;
            setDeleteRequested((current) => (current.includes(id) ? current : [...current, id]));
            setResult({ state: "pending", text: t("hours.blocks.deletePending") });
          } else {
            setResult({ state: "saved", text: t("hours.blocks.deleted") });
          }
        }}
      />
    </section>
  );
}
