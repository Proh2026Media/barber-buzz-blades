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
) {
  return new Intl.DateTimeFormat("pt-BR", {
    ...options,
    timeZone: validTimeZone(timeZone),
  }).format(new Date(date));
}

export function buildSlotsForWindow(
  day: Date | string,
  durationMinutes: number,
  busy: Array<{ starts_at: string; ends_at: string }>,
  window: BusinessWindow | null,
  now = new Date(),
  timeZone?: string,
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

  const slots: Date[] = [];
  for (
    let cursor = new Date(start);
    cursor.getTime() + durationMinutes * 60_000 <= end.getTime();
    cursor = new Date(cursor.getTime() + durationMinutes * 60_000)
  ) {
    const slotEnd = new Date(cursor.getTime() + durationMinutes * 60_000);
    const overlaps = busy.some((b) => {
      const bStart = new Date(b.starts_at).getTime();
      const bEnd = new Date(b.ends_at).getTime();
      return cursor.getTime() < bEnd && slotEnd.getTime() > bStart;
    });
    if (!overlaps && cursor.getTime() > now.getTime()) slots.push(new Date(cursor));
  }
  return slots;
}

/** Build open slots for a local calendar day, stepping by service duration. */
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

export function formatSlotLabel(d: Date, timeZone?: string) {
  return d.toLocaleTimeString("pt-BR", {
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
