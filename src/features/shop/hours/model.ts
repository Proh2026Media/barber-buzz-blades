/**
 * Regras puras da aba Horários: semana num relance, régua comum das barras, estado de agora
 * (aberta, fechada ou em pausa), atalhos de bloqueio e comparação com o que está gravado.
 * Sem React e sem banco, para ser testado com `node --test`.
 */

export type HoursRow = {
  weekday: number;
  is_open: boolean;
  opens_at: string;
  closes_at: string;
};

/** Ordem de leitura da semana: segunda a domingo. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const pad = (value: number) => String(value).padStart(2, "0");

/** "09:30" ou "09:30:00" → minutos desde a meia-noite. */
export function toMinutes(time: string) {
  const [hour, minute] = time.slice(0, 5).split(":").map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

/** Minutos desde a meia-noite → "HH:MM" (24 h; 1440 vira "24:00"). */
export function fromMinutes(minutes: number) {
  const safe = Math.max(0, Math.min(1440, Math.round(minutes)));
  return `${pad(Math.floor(safe / 60))}:${pad(safe % 60)}`;
}

export const hhmm = (time: string) => time.slice(0, 5);

/** "09:00–19:00". */
export function rangeLabel(start: string, end: string) {
  return `${hhmm(start)}–${hhmm(end)}`;
}

/** Faixa que não quebra no traço (botões estreitos: "Bloquear" / "12:00–13:00", nunca "12:00–" / "13:00"). */
export function rangeLabelNoBreak(start: string, end: string) {
  return `${hhmm(start)}\u2060–\u2060${hhmm(end)}`;
}

/** Dia aberto com fechamento antes (ou igual) da abertura. */
export function dayInvalid(row: HoursRow) {
  return row.is_open && toMinutes(row.closes_at) <= toMinutes(row.opens_at);
}

function sameDay(a: HoursRow | undefined, b: HoursRow | undefined) {
  if (!a || !b) return a === b;
  if (a.is_open !== b.is_open) return false;
  // Dia fechado: os horários guardados não mudam nada para o cliente.
  if (!a.is_open) return true;
  return hhmm(a.opens_at) === hhmm(b.opens_at) && hhmm(a.closes_at) === hhmm(b.closes_at);
}

/** Dias da semana em que o rascunho difere do que está gravado. */
export function changedWeekdays(draft: HoursRow[], saved: HoursRow[]) {
  const byDay = new Map(saved.map((row) => [row.weekday, row]));
  return draft.filter((row) => !sameDay(row, byDay.get(row.weekday))).map((row) => row.weekday);
}

export function sameWeek(a: HoursRow[], b: HoursRow[]) {
  return a.length === b.length && changedWeekdays(a, b).length === 0;
}

/**
 * Régua comum das barras: da hora cheia antes da menor abertura até a hora cheia depois do
 * maior fechamento (no mínimo 6 h, para um dia curto não ocupar a barra toda).
 */
export function rulerRange(rows: HoursRow[]) {
  const open = rows.filter((row) => row.is_open && !dayInvalid(row));
  if (!open.length) return { start: 8 * 60, end: 20 * 60 };
  let start = Math.floor(Math.min(...open.map((row) => toMinutes(row.opens_at))) / 60) * 60;
  let end = Math.ceil(Math.max(...open.map((row) => toMinutes(row.closes_at))) / 60) * 60;
  if (end - start < 6 * 60) {
    const missing = 6 * 60 - (end - start);
    start = Math.max(0, start - Math.floor(missing / 120) * 60);
    end = Math.min(1440, start + 6 * 60);
  }
  return { start, end };
}

/** Marcas da régua a cada 3 h (ou 2 h numa régua curta). */
export function rulerTicks(ruler: { start: number; end: number }) {
  const span = ruler.end - ruler.start;
  const step = span <= 8 * 60 ? 120 : 180;
  const ticks: number[] = [];
  for (let minute = Math.ceil(ruler.start / step) * step; minute <= ruler.end; minute += step) {
    ticks.push(minute);
  }
  return ticks;
}

/** Posição (0–100) de um minuto na régua. */
export function rulerPercent(minute: number, ruler: { start: number; end: number }) {
  const span = Math.max(1, ruler.end - ruler.start);
  return Math.max(0, Math.min(100, ((minute - ruler.start) / span) * 100));
}

export type WeekGroup = {
  weekdays: number[];
  is_open: boolean;
  opens: string;
  closes: string;
};

/**
 * Junta dias seguidos (segunda a domingo) com o mesmo horário: "Seg–Sáb 09:00–19:00",
 * "Dom fechado". Dias iguais mas separados viram grupos diferentes, para a leitura seguir a semana.
 */
export function groupWeek(rows: HoursRow[]): WeekGroup[] {
  const byDay = new Map(rows.map((row) => [row.weekday, row]));
  const groups: WeekGroup[] = [];
  for (const weekday of WEEK_ORDER) {
    const row = byDay.get(weekday);
    if (!row) continue;
    const last = groups.at(-1);
    const lastRow = last ? byDay.get(last.weekdays.at(-1) ?? -1) : undefined;
    if (last && lastRow && sameDay(lastRow, row)) {
      last.weekdays.push(weekday);
      continue;
    }
    groups.push({
      weekdays: [weekday],
      is_open: row.is_open,
      opens: hhmm(row.opens_at),
      closes: hhmm(row.closes_at),
    });
  }
  return groups;
}

/** Dia da semana (0 = domingo) de uma data "AAAA-MM-DD", sem depender do fuso do aparelho. */
export function weekdayOfKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export type TimeSpan = { start: number; end: number };

/** Interseção de um bloqueio (instantes) com um dia, em minutos da loja. */
export function clampSpan(span: TimeSpan, day: TimeSpan): TimeSpan | null {
  const start = Math.max(span.start, day.start);
  const end = Math.min(span.end, day.end);
  return end > start ? { start, end } : null;
}

export function overlaps(a: TimeSpan, b: TimeSpan) {
  return a.start < b.end && b.start < a.end;
}

export type LiveStatus =
  | { kind: "open"; closesAt: string }
  | { kind: "paused"; until: string; closesAt: string | null }
  | { kind: "closed"; next: { inDays: number; opensAt: string } | null };

/**
 * Estado da loja agora, pela hora da parede da loja.
 * `shopBlocks`: bloqueios da loja inteira de hoje, em minutos (já recortados ao dia).
 */
export function liveStatus({
  hours,
  todayWeekday,
  nowMinutes,
  shopBlocks,
}: {
  hours: HoursRow[];
  todayWeekday: number;
  nowMinutes: number;
  shopBlocks: TimeSpan[];
}): LiveStatus {
  const byDay = new Map(hours.map((row) => [row.weekday, row]));
  const today = byDay.get(todayWeekday);
  const valid = (row: HoursRow | undefined): row is HoursRow =>
    !!row && row.is_open && !dayInvalid(row);
  if (valid(today)) {
    const opens = toMinutes(today.opens_at);
    const closes = toMinutes(today.closes_at);
    if (nowMinutes >= opens && nowMinutes < closes) {
      // Bloqueios encadeados (12:00–13:00 e 13:00–13:30) contam como uma pausa só.
      let pauseEnd: number | null = null;
      let cursor = nowMinutes;
      for (const block of [...shopBlocks].sort((a, b) => a.start - b.start)) {
        if (block.start <= cursor && block.end > cursor) {
          pauseEnd = block.end;
          cursor = block.end;
        }
      }
      if (pauseEnd !== null) {
        return pauseEnd >= closes
          ? { kind: "closed", next: nextOpening(byDay, todayWeekday) }
          : { kind: "paused", until: fromMinutes(pauseEnd), closesAt: hhmm(today.closes_at) };
      }
      return { kind: "open", closesAt: hhmm(today.closes_at) };
    }
    if (nowMinutes < opens) {
      return { kind: "closed", next: { inDays: 0, opensAt: hhmm(today.opens_at) } };
    }
  }
  return { kind: "closed", next: nextOpening(byDay, todayWeekday) };
}

function nextOpening(byDay: Map<number, HoursRow>, todayWeekday: number) {
  for (let offset = 1; offset <= 7; offset += 1) {
    const row = byDay.get((todayWeekday + offset) % 7);
    if (row && row.is_open && !dayInvalid(row)) {
      return { inDays: offset, opensAt: hhmm(row.opens_at) };
    }
  }
  return null;
}

export type QuickRangeId = "lunch" | "morning" | "afternoon" | "allDay";
export type QuickRange = { id: QuickRangeId; start: string; end: string };

/**
 * Atalhos do bloqueio a partir do expediente do dia: almoço (12–13), manhã (abre–12),
 * tarde (13–fecha) e dia inteiro. Só entram os que cabem no expediente.
 */
export function quickRanges(day: HoursRow | undefined): QuickRange[] {
  if (!day || !day.is_open || dayInvalid(day)) return [];
  const opens = toMinutes(day.opens_at);
  const closes = toMinutes(day.closes_at);
  const ranges: QuickRange[] = [];
  const add = (id: QuickRangeId, start: number, end: number) => {
    if (end > start && start >= opens && end <= closes) {
      ranges.push({ id, start: fromMinutes(start), end: fromMinutes(end) });
    }
  };
  add("lunch", 12 * 60, 13 * 60);
  add("morning", opens, 12 * 60);
  add("afternoon", 13 * 60, closes);
  add("allDay", opens, closes);
  return ranges;
}

/** Bloqueio já posicionado no relógio da loja (data e minutos do início e do fim). */
export type PlacedBlock = {
  id: string;
  staffId: string | null;
  staffName: string | null;
  reason: string | null;
  startKey: string;
  endKey: string;
  startMinute: number;
  endMinute: number;
  /** Pedido enviado aos sócios, ainda sem valer. */
  requested?: boolean;
  /** Bloqueio de um colega visto por quem só cuida da própria agenda: sem nome nem motivo. */
  colleague?: boolean;
};

/**
 * Quem só cuida da própria agenda vê o bloqueio de um colega como "Colega indisponível", sem o
 * nome nem o motivo (decisão do dono). Bloqueio da loja inteira e os próprios ficam como estão.
 * Obs.: o banco ainda envia nome e motivo; aqui só não aparecem.
 */
export function maskColleagueBlock(block: PlacedBlock, ownStaffId: string | null): PlacedBlock {
  if (!ownStaffId || !block.staffId || block.staffId === ownStaffId) return block;
  return { ...block, staffName: null, reason: null, colleague: true };
}

/** Parte do bloqueio que cai num dia, em minutos (bloqueio de vários dias é recortado). */
export function blockSpanOn(block: PlacedBlock, dayKey: string): TimeSpan | null {
  if (block.startKey > dayKey || block.endKey < dayKey) return null;
  const start = block.startKey === dayKey ? block.startMinute : 0;
  const end = block.endKey === dayKey ? block.endMinute : 1440;
  return clampSpan({ start, end }, { start: 0, end: 1440 });
}

/** Bloqueio pedido aos sócios, como foi enviado (instantes em ISO). */
export type RequestedBlock = {
  requestId: string;
  staffId: string | null;
  startsAt: string;
  endsAt: string;
  reason: string | null;
};

/** O que está "Aguardando aprovação" na aba Horários, lido dos pedidos pendentes da loja. */
export type PendingHours = {
  /** Semana pedida mais recente (`null` = nenhum pedido de funcionamento). */
  week: HoursRow[] | null;
  /** A semana pedida foi enviada por outra pessoa (quem vê decide, não esperou o próprio pedido). */
  weekByOther: boolean;
  creates: RequestedBlock[];
  /** Bloqueios cuja remoção foi pedida. */
  deletes: string[];
};

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);

/**
 * Lê a lista de `list_pending_shop_changes` (mais recente primeiro) e separa o que é da aba
 * Horários: `hours.replace`, `availability.create` e `availability.delete`. Ignora o resto e
 * qualquer linha malformada. Com `userId`, marca se a semana pedida é de outra pessoa
 * (`requested_by`), para a aba não dizer "Pedido enviado" a quem só vai decidir.
 */
export function pendingHoursRequests(rows: unknown, userId?: string | null): PendingHours {
  const result: PendingHours = { week: null, weekByOther: false, creates: [], deletes: [] };
  if (!Array.isArray(rows)) return result;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const { id, kind, payload, status, requested_by } = row as Record<string, unknown>;
    if (status && status !== "pending") continue;
    if (!payload || typeof payload !== "object") continue;
    const data = payload as Record<string, unknown>;
    if (kind === "hours.replace" && !result.week && Array.isArray(data.hours)) {
      const week = data.hours.flatMap((item): HoursRow[] => {
        if (!item || typeof item !== "object") return [];
        const day = item as Record<string, unknown>;
        const weekday = Number(day.weekday);
        const opens = text(day.opens_at);
        const closes = text(day.closes_at);
        if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !opens || !closes) {
          return [];
        }
        return [{ weekday, is_open: day.is_open === true, opens_at: opens, closes_at: closes }];
      });
      if (week.length) {
        result.week = week;
        result.weekByOther = !!userId && !!text(requested_by) && requested_by !== userId;
      }
    } else if (kind === "availability.create") {
      const startsAt = text(data.starts_at);
      const endsAt = text(data.ends_at);
      if (!startsAt || !endsAt) continue;
      result.creates.push({
        requestId: String(id ?? `${startsAt}-${endsAt}`),
        staffId: text(data.staff_id),
        startsAt,
        endsAt,
        reason: text(data.reason),
      });
    } else if (kind === "availability.delete") {
      const blockId = text(data.id);
      if (blockId && !result.deletes.includes(blockId)) result.deletes.push(blockId);
    }
  }
  return result;
}

/**
 * Semana pedida sobre a gravada: o pedido pode trazer só alguns dias. `null` quando o pedido já
 * é igual ao gravado (nada a mostrar tracejado).
 */
export function requestedWeek<Row extends HoursRow>(requested: HoursRow[], saved: Row[]) {
  const byDay = new Map(requested.map((row) => [row.weekday, row]));
  const merged = saved.map((row) => {
    const wanted = byDay.get(row.weekday);
    return wanted
      ? {
          ...row,
          is_open: wanted.is_open,
          opens_at: wanted.opens_at,
          closes_at: wanted.closes_at,
        }
      : row;
  });
  return sameWeek(merged, saved) ? null : merged;
}
