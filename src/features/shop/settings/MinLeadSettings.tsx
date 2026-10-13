import { useEffect, useId, useState } from "react";
import { AlarmClock, CalendarCheck, EyeOff, Globe2, UserCog } from "lucide-react";
import {
  ChoiceChips,
  IconList,
  PreviewPanel,
  SectionHeader,
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
  minLeadParts,
  shopDateKey,
  validMinLeadMinutes,
} from "@/lib/shop/appointments";
import { clockInTimeZone } from "@/features/register-owner/timezones";
import { BOOKING_CARD_IDS } from "./booking-cards";

type SaveResult = Exclude<ActionState, "saving">;
const SAVE_TEXT: Record<SaveResult, MessageKey> = {
  saved: "lead.status.applied",
  pending: "slots.status.pending",
  error: "slots.status.error",
};

/** "Sem mínimo", "30 min" ou "2 h". */
export function useMinLeadLabel() {
  const { t } = useI18n();
  return (minutes: number) => {
    if (minutes === 0) return t("lead.none");
    const parts = minLeadParts(minutes);
    return "hours" in parts
      ? t("lead.chip.hours", { hours: parts.hours })
      : t("lead.chip.minutes", { minutes: parts.minutes });
  };
}

/**
 * Antecedência mínima para o cliente reservar. Só aparece quando o banco já tem a coluna
 * `min_lead_minutes` (migration 20261013150000); antes dela não existe regra a mostrar.
 */
export function MinLeadSettings({
  settings,
  timeZone,
  onSave,
}: {
  settings: Tables<"barbershop_settings">;
  timeZone: string;
  onSave: (minutes: number) => Promise<"applied" | "pending">;
}) {
  const { t, intlLocale } = useI18n();
  const leadLabel = useMinLeadLabel();
  const groupId = useId();
  const saved = validMinLeadMinutes(settings.min_lead_minutes);
  const [lead, setLead] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<SaveResult | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setLead(saved);
  }, [saved]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const changed = lead !== saved;
  const first = new Date(now.getTime() + lead * 60_000);
  const sameDay = shopDateKey(first, timeZone) === shopDateKey(now, timeZone);
  const firstClock = clockInTimeZone(timeZone, first);
  const firstText = sameDay
    ? t("lead.preview.first", { time: firstClock })
    : t("lead.preview.firstDay", {
        day: formatShopDate(first, timeZone, { weekday: "short" }, intlLocale),
        time: firstClock,
      });
  const timeline: TimelineRow[] =
    lead === 0
      ? [{ kind: "free", time: clockInTimeZone(timeZone, now), label: t("lead.preview.anytime") }]
      : [
          {
            kind: "closed",
            icon: EyeOff,
            time: clockInTimeZone(timeZone, now),
            label: t("lead.preview.hidden", { lead: leadLabel(lead) }),
            minutes: lead,
          },
          { kind: "free", time: firstClock, label: firstText },
        ];

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
      className="app-action-card scroll-mt-24 space-y-5 p-5 outline-none"
      aria-labelledby={`${groupId}-title`}
    >
      <SectionHeader
        icon={AlarmClock}
        id={`${groupId}-title`}
        title={t("lead.title")}
        description={t("lead.intro")}
      />

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

      <PreviewPanel icon={CalendarCheck} title={t("lead.preview.title")} live>
        <Timeline rows={timeline} />
      </PreviewPanel>

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
