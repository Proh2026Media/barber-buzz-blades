import { useEffect, useId, useState } from "react";
import { AlarmClock, CalendarCheck, EyeOff, Globe2, UserCog } from "lucide-react";
import {
  ChoiceChips,
  IconList,
  PreviewPanel,
  SectionHeader,
  SplitLayout,
  Timeline,
  UnsavedBar,
  type ActionState,
  type TimelineRow,
} from "@/components/visual";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n, type MessageKey } from "@/lib/i18n";
import {
  DEFAULT_MIN_LEAD_MINUTES,
  MIN_LEAD_OPTIONS,
  formatShopDate,
  shiftDateKey,
  shopDateKey,
  shopDateTime,
  validMinLeadMinutes,
} from "@/lib/shop/appointments";
import { useDemo } from "@/features/demo/context";
import { clockInTimeZone } from "@/features/register-owner/timezones";
import { liveStatus, toMinutes, weekdayOfKey, type HoursRow } from "@/features/shop/hours/model";
import { BOOKING_CARD_IDS } from "./booking-cards";
import { useMinLeadLabel } from "./min-lead-label";

type SaveResult = Exclude<ActionState, "saving">;
const SAVE_TEXT: Record<SaveResult, MessageKey> = {
  saved: "lead.status.applied",
  pending: "slots.status.pending",
  error: "slots.status.error",
};

/**
 * Primeiro instante com a loja aberta a partir de `from`, pelo expediente da semana no fuso da
 * loja. Sem nenhum dia aberto, fica o próprio `from`.
 */
function firstOpenFrom(from: Date, hours: HoursRow[], timeZone: string) {
  const day = shopDateKey(from, timeZone);
  const status = liveStatus({
    hours,
    todayWeekday: weekdayOfKey(day),
    nowMinutes: toMinutes(clockInTimeZone(timeZone, from)),
    shopBlocks: [],
  });
  if (status.kind !== "closed" || !status.next) return from;
  return shopDateTime(shiftDateKey(day, status.next.inDays), status.next.opensAt, timeZone);
}

/**
 * Antecedência mínima para o cliente reservar. Só aparece quando o banco já tem a coluna
 * `min_lead_minutes` (migration 20261013150000); antes dela não existe regra a mostrar.
 */
export function MinLeadSettings({
  settings,
  timeZone,
  hours,
  onSave,
}: {
  settings: Tables<"barbershop_settings">;
  timeZone: string;
  /** Expediente da semana: a prévia não oferece um horário com a loja fechada. */
  hours?: HoursRow[];
  onSave: (minutes: number) => Promise<"applied" | "pending">;
}) {
  const { t, intlLocale } = useI18n();
  const demo = useDemo();
  const leadLabel = useMinLeadLabel();
  const groupId = useId();
  const saved = validMinLeadMinutes(settings.min_lead_minutes);
  const [lead, setLead] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<SaveResult | null>(null);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    setLead(saved);
  }, [saved]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // Na demonstração vale o relógio dela (o mesmo da Agenda), não o do aparelho.
  const now = demo?.now ?? clock;
  const changed = lead !== saved;
  // O primeiro horário que o cliente vê: depois da antecedência e com a loja aberta (de madrugada,
  // a prévia mostra a abertura, não um horário com a loja fechada).
  const earliest = new Date(now.getTime() + lead * 60_000);
  const week = hours ?? demo?.businessHours;
  const first = week?.length ? firstOpenFrom(earliest, week, timeZone) : earliest;
  const closedFirst = first.getTime() > earliest.getTime();
  const sameDay = shopDateKey(first, timeZone) === shopDateKey(now, timeZone);
  const firstClock = clockInTimeZone(timeZone, first);
  const firstText = sameDay
    ? t("lead.preview.first", { time: firstClock })
    : t("lead.preview.firstDay", {
        day: formatShopDate(first, timeZone, { weekday: "short" }, intlLocale),
        time: firstClock,
      });
  const timeline: TimelineRow[] = [];
  if (lead > 0) {
    timeline.push({
      kind: "closed",
      icon: EyeOff,
      time: clockInTimeZone(timeZone, now),
      label: t("lead.preview.hidden", { lead: leadLabel(lead) }),
      minutes: lead,
    });
  }
  // A antecedência acaba com a loja fechada: o bloco "Fechado" e, depois, a abertura.
  if (closedFirst) {
    // Em outro dia, o dia vai junto ("Fechado · dom."): sem ele, parecia fechado hoje.
    const otherDay = shopDateKey(earliest, timeZone) !== shopDateKey(now, timeZone);
    timeline.push({
      kind: "closed",
      time: clockInTimeZone(timeZone, earliest),
      label: otherDay
        ? `${t("shop.hours.closed")} · ${formatShopDate(earliest, timeZone, { weekday: "short" }, intlLocale)}`
        : t("shop.hours.closed"),
    });
  }
  timeline.push({
    kind: "free",
    time: firstClock,
    label: lead === 0 && !closedFirst ? t("lead.preview.anytime") : firstText,
  });

  async function save() {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await onSave(lead);
      setStatus(result === "applied" ? "saved" : "pending");
      if (result === "pending") setLead(saved);
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id={BOOKING_CARD_IDS.lead}
      tabIndex={-1}
      className="ajustes-item app-action-card scroll-mt-24 space-y-5 p-5 outline-none"
      aria-labelledby={`${groupId}-title`}
    >
      <SectionHeader
        icon={AlarmClock}
        id={`${groupId}-title`}
        title={t("lead.title")}
        description={t("lead.intro")}
      />

      <SplitLayout
        gap="1.25rem"
        asideWidth="20rem"
        aside={
          <PreviewPanel icon={CalendarCheck} title={t("lead.preview.title")} live>
            <Timeline rows={timeline} />
          </PreviewPanel>
        }
      >
        <ChoiceChips
          label={t("lead.title")}
          hideLabel
          options={MIN_LEAD_OPTIONS.map((minutes) => ({
            value: minutes,
            label: leadLabel(minutes),
            note: minutes === DEFAULT_MIN_LEAD_MINUTES ? t("slots.default") : undefined,
          }))}
          value={lead}
          disabled={busy}
          onChange={(value) => {
            setLead(value);
            setStatus(null);
          }}
        />
      </SplitLayout>

      <IconList
        items={[
          { icon: Globe2, text: t("lead.scope") },
          { icon: UserCog, text: t("lead.panel") },
          { icon: CalendarCheck, text: t("lead.existing") },
        ]}
      />

      <UnsavedBar
        dirty={changed}
        saving={busy}
        state={status}
        stateText={status ? t(SAVE_TEXT[status]) : undefined}
        onSave={() => void save()}
        onDiscard={() => {
          setLead(saved);
          setStatus(null);
        }}
        saveLabel={t("slots.save")}
      />
    </section>
  );
}
