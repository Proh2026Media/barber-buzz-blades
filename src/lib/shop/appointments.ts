import type { Tables } from "@/integrations/supabase/types";

export type ServiceRow = Tables<"services">;
export type StaffRow = Tables<"staff">;
export type AppointmentRow = Tables<"appointments">;

export type ReservationFilter = "upcoming" | "history" | "completed" | "cancelled";

export function filterReservations<T extends Pick<AppointmentRow, "starts_at" | "status">>(
  rows: T[],
  filter: ReservationFilter,
  now: number,
): T[] {
  return rows
    .filter((row) => {
      const upcoming =
        row.status === "reschedule_requested" ||
        ((row.status === "pending" || row.status === "confirmed") &&
          new Date(row.starts_at).getTime() > now);
      return filter === "upcoming"
        ? upcoming
        : filter === "history"
          ? !upcoming
          : row.status === filter;
    })
    .sort((a, b) =>
      filter === "upcoming"
        ? a.starts_at.localeCompare(b.starts_at)
        : b.starts_at.localeCompare(a.starts_at),
    );
}

const DAY_START_HOUR = 9;
const DAY_END_HOUR = 19;

export type BusinessWindow = {
  is_open: boolean;
  opens_at: string;
  closes_at: string;
};

function timeParts(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return Number.isInteger(hour) && Number.isInteger(minute) ? { hour, minute } : null;
}

export const DEFAULT_SHOP_TIMEZONE = "America/Sao_Paulo";

export function validTimeZone(timeZone?: string | null) {
  const candidate = timeZone?.trim() || DEFAULT_SHOP_TIMEZONE;
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: candidate }).format();
    return candidate;
  } catch {
    return DEFAULT_SHOP_TIMEZONE;
  }
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: validTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

/** Convert wall-clock fields in a shop timezone to the matching UTC instant. */
export function shopDateTime(value: string, time: string, timeZone: string) {
  const [year, month, day] = value.split("-").map(Number);
  const [hour, minute, second = 0] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  let instant = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedParts(new Date(instant), timeZone);
    const represented = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const correction = target - represented;
    instant += correction;
    if (correction === 0) break;
  }
  return new Date(instant);
}

export function shopDayRange(value: string, timeZone: string) {
  return {
    start: shopDateTime(value, "00:00:00", timeZone),
    end: new Date(shopDateTime(shiftDateKey(value, 1), "00:00:00", timeZone).getTime() - 1),
  };
}

export function shopDateKey(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function shopHour(date: Date, timeZone: string) {
  return Number(zonedParts(date, timeZone).hour);
}

export function weekdayForDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function shiftDateKey(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

export function buildBookingDateKeys(start: Date, count: number, timeZone: string) {
  const first = shopDateKey(start, timeZone);
  return Array.from({ length: count }, (_, index) => shiftDateKey(first, index));
}

export function formatShopDate(
  date: Date | string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
  locale = "pt-BR",
) {
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: validTimeZone(timeZone),
  }).format(new Date(date));
}

/** Passo do modo flexível (padrão), o mesmo de `shop_slot_step` no banco. */
export const SLOT_STEP_MINUTES = 15;

/** Forma de oferecer os horários (`barbershop_settings.slot_mode`). */
export type SlotMode = "flexible" | "literal" | "custom";
export const SLOT_MODES: readonly SlotMode[] = ["flexible", "literal", "custom"];
/** Intervalos aceitos no modo ajustável (`slot_step_minutes`). */
export const SLOT_STEP_OPTIONS = [10, 15, 20, 30, 45, 60] as const;
/** Tempo de preparo depois de cada atendimento (`prep_minutes` da loja e do serviço). */
export const PREP_OPTIONS = [0, 5, 10, 15, 20, 30] as const;

export function validPrepMinutes(value: number | null | undefined) {
  return (PREP_OPTIONS as readonly number[]).includes(value ?? -1) ? value! : 0;
}

export type SlotRule = {
  mode: SlotMode;
  stepMinutes: number;
  /** Preparo depois do atendimento que está sendo marcado (o do serviço, senão o da loja). */
  prepMinutes?: number;
  /** Bloqueios (almoço, folga): a contagem recomeça no fim de cada um. */
  blocks?: Array<{ starts_at: string; ends_at: string }>;
};

export function slotRuleFromSettings(
  settings:
    | { slot_mode?: string | null; slot_step_minutes?: number | null; prep_minutes?: number | null }
    | null
    | undefined,
): SlotRule {
  const mode = SLOT_MODES.includes(settings?.slot_mode as SlotMode)
    ? (settings!.slot_mode as SlotMode)
    : "flexible";
  const step = (SLOT_STEP_OPTIONS as readonly number[]).includes(settings?.slot_step_minutes ?? 0)
    ? settings!.slot_step_minutes!
    : SLOT_STEP_MINUTES;
  return { mode, stepMinutes: step, prepMinutes: validPrepMinutes(settings?.prep_minutes) };
}

/**
 * Passo da grade para um serviço: 15 (flexível), a duração mais o preparo (literal) ou o
 * escolhido (ajustável).
 */
export function slotStepFor(
  rule: Pick<SlotRule, "mode" | "stepMinutes" | "prepMinutes"> | undefined,
  duration: number,
) {
  if (rule?.mode === "literal") return Math.max(1, duration + (rule.prepMinutes ?? 0));
  if (rule?.mode === "custom") return rule.stepMinutes;
  return SLOT_STEP_MINUTES;
}

export type ServiceTerms = {
  staff_id: string;
  service_id: string;
  duration_minutes: number;
  price_cents: number;
};

/**
 * Duração e preço do profissional no serviço (`get_booking_terms`); `null` quando ele não faz
 * o serviço. Sem lista (demonstração), todos fazem tudo com os valores do catálogo.
 */
export function termsFor(
  terms: ServiceTerms[] | null,
  staffId: string,
  service: Pick<ServiceRow, "id" | "duration_minutes" | "price_cents">,
) {
  if (!terms)
    return { duration_minutes: service.duration_minutes, price_cents: service.price_cents };
  const row = terms.find((item) => item.staff_id === staffId && item.service_id === service.id);
  return row ? { duration_minutes: row.duration_minutes, price_cents: row.price_cents } : null;
}

/**
 * Mesma regra de `slot_candidate_starts` + `available_slots_internal` no banco: a grade da loja
 * (15 em 15, tamanho do serviço ou intervalo escolhido) contada a partir da abertura e de novo no
 * fim de cada bloqueio; só os inícios em que o serviço inteiro cabe antes de ocupado ou fechamento.
 * Atendimento em `busy` com `prep_minutes` ocupa também o preparo dele, e o novo precisa deixar o
 * próprio preparo (`rule.prepMinutes`) livre antes dele. Bloqueios e esperas não pedem preparo.
 */
export function buildSlotsForWindow(
  day: Date | string,
  durationMinutes: number,
  busy: Array<{ starts_at: string; ends_at: string; prep_minutes?: number }>,
  window: BusinessWindow | null,
  now = new Date(),
  timeZone?: string,
  rule?: SlotRule,
): Date[] {
  if (!window?.is_open || !Number.isInteger(durationMinutes) || durationMinutes <= 0) return [];
  const opening = timeParts(window.opens_at);
  const closing = timeParts(window.closes_at);
  if (!opening || !closing) return [];

  const dateKey = typeof day === "string" ? day : localDateKey(day);
  const start = timeZone
    ? shopDateTime(dateKey, `${opening.hour}:${opening.minute}:00`, timeZone)
    : new Date(day);
  if (!timeZone) start.setHours(opening.hour, opening.minute, 0, 0);
  const end = timeZone
    ? shopDateTime(dateKey, `${closing.hour}:${closing.minute}:00`, timeZone)
    : new Date(day);
  if (!timeZone) end.setHours(closing.hour, closing.minute, 0, 0);
  if (end <= start) return [];

  const durationMs = durationMinutes * 60_000;
  const stepMs = slotStepFor(rule, durationMinutes) * 60_000;
  const windows: Array<[number, number]> = [];
  let cursor = start.getTime();
  const blocks = (rule?.blocks ?? [])
    .map((b) => [new Date(b.starts_at).getTime(), new Date(b.ends_at).getTime()] as const)
    .filter(([bStart, bEnd]) => bStart < end.getTime() && bEnd > start.getTime())
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const [bStart, bEnd] of blocks) {
    if (bStart > cursor) windows.push([cursor, bStart]);
    cursor = Math.max(cursor, bEnd);
  }
  if (cursor < end.getTime()) windows.push([cursor, end.getTime()]);

  const prepMs = (rule?.prepMinutes ?? 0) * 60_000;
  const taken = [
    ...busy.map((b) => {
      const isAppointment = b.prep_minutes !== undefined;
      return [
        new Date(b.starts_at).getTime(),
        new Date(b.ends_at).getTime() + (b.prep_minutes ?? 0) * 60_000,
        isAppointment,
      ] as const;
    }),
    ...(rule?.blocks ?? []).map(
      (b) => [new Date(b.starts_at).getTime(), new Date(b.ends_at).getTime(), false] as const,
    ),
  ];
  const slots: Date[] = [];
  for (const [from, to] of windows) {
    for (let at = from; at + durationMs <= to; at += stepMs) {
      const overlaps = taken.some(
        ([bStart, bEnd, isAppointment]) =>
          at < bEnd && at + durationMs + (isAppointment ? prepMs : 0) > bStart,
      );
      if (!overlaps && at > now.getTime()) slots.push(new Date(at));
    }
  }
  return slots;
}

/**
 * Exemplo para a tela de Ajustes, em minutos do dia: inícios de um serviço numa janela
 * (ex.: 9:00–19:00) com atendimentos opcionais, sem relógio nem fuso. Os atendimentos e o
 * novo usam o mesmo preparo (`rule.prepMinutes`).
 */
export function previewSlotMinutes(
  opensAt: string,
  closesAt: string,
  durationMinutes: number,
  rule: Pick<SlotRule, "mode" | "stepMinutes" | "prepMinutes">,
  busy: Array<[number, number]> = [],
): number[] {
  const opening = timeParts(opensAt);
  const closing = timeParts(closesAt);
  if (!opening || !closing || !Number.isInteger(durationMinutes) || durationMinutes <= 0) return [];
  const from = opening.hour * 60 + opening.minute;
  const to = closing.hour * 60 + closing.minute;
  const step = slotStepFor(rule, durationMinutes);
  const prep = rule.prepMinutes ?? 0;
  const result: number[] = [];
  for (let at = from; at + durationMinutes <= to; at += step) {
    if (!busy.some(([bStart, bEnd]) => at < bEnd + prep && at + durationMinutes + prep > bStart))
      result.push(at);
  }
  return result;
}

export function minutesLabel(minutes: number) {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Build open slots for a local calendar day (09:00–19:00), on the 15-minute grid. */
export function buildDaySlots(
  day: Date,
  durationMinutes: number,
  busy: Array<{ starts_at: string; ends_at: string }>,
  now = new Date(),
): Date[] {
  return buildSlotsForWindow(
    day,
    durationMinutes,
    busy,
    {
      is_open: true,
      opens_at: `${String(DAY_START_HOUR).padStart(2, "0")}:00`,
      closes_at: `${String(DAY_END_HOUR).padStart(2, "0")}:00`,
    },
    now,
  );
}

export function formatSlotLabel(d: Date, timeZone?: string, locale = "pt-BR") {
  return d.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    ...(timeZone ? { timeZone: validTimeZone(timeZone) } : {}),
  });
}

export function startOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function localDateKey(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateFromLocalKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function buildBookingDays(start = new Date(), count = 14, timeZone?: string) {
  const first = timeZone ? dateFromLocalKey(shopDateKey(start, timeZone)) : startOfLocalDay(start);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return date;
  });
}
