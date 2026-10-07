import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock3, Globe2, Store } from "lucide-react";
import { STATE, StatusBadge, Tag } from "@/components/visual";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";
import { formatSlotLabel, shopDateKey } from "@/lib/shop/appointments";
import { SlotModeNotice } from "@/features/shop/settings/SlotModeSettings";
import type { SaveOutcome } from "../catalog/types";
import type { BlockDraft, DayBooking, StaffOption } from "./BlockDialog";
import { BlocksCard } from "./BlocksCard";
import { HoursMemoryScope, useHoursMemory } from "./memory";
import { useDayLabels } from "./labels";
import {
  blockSpanOn,
  liveStatus,
  sameWeek,
  toMinutes,
  weekdayOfKey,
  type PlacedBlock,
  type TimeSpan,
} from "./model";
import { WeekCard } from "./WeekCard";

type HoursRowFull = Tables<"business_hours">;

export type HoursBlock = Pick<
  Tables<"availability_blocks">,
  "id" | "staff_id" | "starts_at" | "ends_at" | "reason"
> & { staff: { display_name: string } | null };

export type HoursAppointment = {
  starts_at: string;
  ends_at: string;
  status: string;
  staff_id: string | null;
  customer?: { full_name: string | null } | null;
  staff?: { display_name: string } | null;
};

/** Hora da parede da loja ("HH:MM", 24 h), sem depender do idioma. */
const wallClock = (value: Date | string, timeZone: string) =>
  formatSlotLabel(new Date(value), timeZone, "en-GB").slice(0, 5);

/**
 * Aba Horários: o estado de agora (aberta, fechada, em pausa), a semana em barras e os
 * bloqueios dos próximos dias, juntos e na mesma régua. As mudanças da semana ficam num rascunho
 * por barbearia até "Salvar" — recarregar, trocar de dia ou ir a outra aba e voltar não apaga o
 * que não foi salvo.
 */
export function HoursTab(props: Parameters<typeof HoursTabContent>[0] & { shopId: string }) {
  const { shopId, ...rest } = props;
  return (
    <HoursMemoryScope.Provider value={shopId}>
      <HoursTabContent {...rest} />
    </HoursMemoryScope.Provider>
  );
}

function HoursTabContent({
  timeZone,
  demoNow,
  hours,
  blocks,
  staff,
  loading,
  loadError,
  onRetry,
  canEditHours,
  ownStaffId,
  slotNotice,
  onSaveHours,
  onCreateBlock,
  onDeleteBlock,
  loadDayAppointments,
  blockRequest,
  onBlockRequestHandled,
  onOpenApprovals,
}: {
  timeZone: string;
  /** Relógio fixo da demonstração. */
  demoNow?: Date;
  hours: HoursRowFull[];
  blocks: HoursBlock[];
  staff: Tables<"staff">[];
  loading: boolean;
  /** Só falhas do funcionamento ou dos bloqueios (não os erros gerais do painel). */
  loadError: string | null;
  onRetry: () => void;
  canEditHours: boolean;
  /** Só bloqueia a própria agenda (parceiro sem poder de operação). */
  ownStaffId: string | null;
  slotNotice: Omit<Parameters<typeof SlotModeNotice>[0], "hours" | "preview">;
  onSaveHours: (rows: HoursRowFull[]) => Promise<SaveOutcome>;
  onCreateBlock: (draft: BlockDraft) => Promise<SaveOutcome>;
  onDeleteBlock: (id: string) => Promise<SaveOutcome>;
  loadDayAppointments: (dateKey: string) => Promise<HoursAppointment[]>;
  blockRequest: { staffId: string | null } | null;
  onBlockRequestHandled: () => void;
  onOpenApprovals?: () => void;
}) {
  const { t } = useI18n();
  const labels = useDayLabels();

  // Rascunho da semana (null = igual ao gravado). Fica na memória da aba, então sobrevive à troca
  // de aba; quando o gravado alcança o rascunho (salvou), volta a acompanhar o gravado.
  const [storedDraft, setStoredDraft] = useHoursMemory<HoursRowFull[] | null>("week.draft", null);
  const draft = canEditHours && storedDraft ? storedDraft : hours;
  const setDraft = useCallback(
    (rows: HoursRowFull[]) => setStoredDraft(sameWeek(rows, hours) ? null : rows),
    [hours, setStoredDraft],
  );
  useEffect(() => {
    if (storedDraft && sameWeek(storedDraft, hours)) setStoredDraft(null);
  }, [hours, storedDraft, setStoredDraft]);

  // O selo "aberta agora" acompanha o relógio (a cada minuto).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (demoNow) return;
    const id = window.setInterval(() => setTick((value) => value + 1), 60_000);
    return () => window.clearInterval(id);
  }, [demoNow]);
  const now = useMemo(() => demoNow ?? new Date(), [demoNow, tick]); // eslint-disable-line react-hooks/exhaustive-deps -- tick renova o relógio
  const todayKey = shopDateKey(now, timeZone);
  const nowMinutes = toMinutes(wallClock(now, timeZone));
  const todayWeekday = weekdayOfKey(todayKey);

  const placed: PlacedBlock[] = useMemo(
    () =>
      blocks.map((block) => ({
        id: block.id,
        staffId: block.staff_id,
        staffName: block.staff?.display_name ?? null,
        reason: block.reason,
        startKey: shopDateKey(new Date(block.starts_at), timeZone),
        endKey: shopDateKey(new Date(block.ends_at), timeZone),
        startMinute: toMinutes(wallClock(block.starts_at, timeZone)),
        endMinute: toMinutes(wallClock(block.ends_at, timeZone)),
      })),
    [blocks, timeZone],
  );

  const shopBlocksToday = placed
    .filter((block) => !block.staffId)
    .map((block) => blockSpanOn(block, todayKey))
    .filter((span): span is TimeSpan => !!span);
  const live = liveStatus({ hours, todayWeekday, nowMinutes, shopBlocks: shopBlocksToday });
  const deviceZone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return timeZone;
    }
  })();
  const zoneCity = timeZone.split("/").at(-1)?.replaceAll("_", " ") ?? timeZone;

  const staffOptions: StaffOption[] = staff.map((member) => ({
    id: member.id,
    display_name: member.display_name,
    avatar_url: member.avatar_url ?? null,
  }));
  const ownStaff = ownStaffId
    ? (staffOptions.find((member) => member.id === ownStaffId) ?? {
        id: ownStaffId,
        display_name: t("hours.block.yourAgenda"),
        avatar_url: null,
      })
    : null;

  // A função do painel muda a cada render; a janela só busca de novo ao trocar o dia.
  const loadDayRef = useRef(loadDayAppointments);
  loadDayRef.current = loadDayAppointments;
  const loadBookings = useCallback(
    async (dateKey: string): Promise<DayBooking[]> => {
      const rows = await loadDayRef.current(dateKey);
      return rows
        .filter((row) => row.status !== "cancelled")
        .map((row) => {
          const startKey = shopDateKey(new Date(row.starts_at), timeZone);
          const endKey = shopDateKey(new Date(row.ends_at), timeZone);
          const start = startKey < dateKey ? 0 : toMinutes(wallClock(row.starts_at, timeZone));
          const end = endKey > dateKey ? 1440 : toMinutes(wallClock(row.ends_at, timeZone));
          const name = row.customer?.full_name?.trim().split(/\s+/)[0];
          return {
            span: { start, end },
            staffId: row.staff_id,
            who: name || row.staff?.display_name || "",
            time: wallClock(row.starts_at, timeZone),
          };
        });
    },
    [timeZone],
  );

  const liveBadge =
    live.kind === "open" ? (
      <StatusBadge
        {...STATE.active}
        icon={Store}
        size="lg"
        label={t("hours.live.open", { time: live.closesAt })}
      />
    ) : live.kind === "paused" ? (
      <StatusBadge
        {...STATE.blocked}
        size="lg"
        label={t("hours.live.paused", { time: live.until })}
      />
    ) : (
      <StatusBadge
        {...STATE.closed}
        size="lg"
        label={
          !live.next
            ? t("hours.live.closed")
            : live.next.inDays === 0
              ? t("hours.live.closedToday", { time: live.next.opensAt })
              : live.next.inDays === 1
                ? t("hours.live.closedTomorrow", { time: live.next.opensAt })
                : t("hours.live.closedDay", {
                    day: labels.weekdayShort((todayWeekday + live.next.inDays) % 7),
                    time: live.next.opensAt,
                  })
        }
      />
    );

  const week = (
    <div className="space-y-6">
      <WeekCard
        saved={hours}
        draft={draft}
        onDraftChange={setDraft}
        todayWeekday={todayWeekday}
        canEdit={canEditHours}
        loading={loading}
        loadError={loadError}
        onRetry={onRetry}
        onSave={onSaveHours}
        onOpenApprovals={onOpenApprovals}
      />
      {/* Logo abaixo da semana: o efeito do funcionamento nos horários que o cliente vê. */}
      <SlotModeNotice {...slotNotice} hours={draft} preview={!sameWeek(draft, hours)} />
    </div>
  );
  const blocksCard = (
    <BlocksCard
      blocks={placed}
      staff={staffOptions}
      hours={hours}
      todayKey={todayKey}
      nowMinutes={nowMinutes}
      ownStaff={ownStaff}
      canDelete={(block) => !ownStaffId || block.staffId === ownStaffId}
      loadBookings={loadBookings}
      onCreate={onCreateBlock}
      onDelete={onDeleteBlock}
      request={blockRequest}
      onRequestHandled={onBlockRequestHandled}
      onOpenApprovals={onOpenApprovals}
    />
  );

  return (
    <section className="space-y-5">
      <div className="space-y-3">
        <div className="app-section-title">
          <Clock3 />
          <h2>{t("shop.nav.hours")}</h2>
        </div>
        {hours.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {liveBadge}
            {deviceZone !== timeZone && (
              <Tag icon={Globe2}>{t("hours.live.shopZone", { zone: zoneCity })}</Tag>
            )}
          </div>
        )}
      </div>
      {/* Quem só bloqueia a própria agenda vê os bloqueios primeiro (a única ação dele). */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {ownStaffId ? (
          <>
            {blocksCard}
            {week}
          </>
        ) : (
          <>
            {week}
            {blocksCard}
          </>
        )}
      </div>
    </section>
  );
}
