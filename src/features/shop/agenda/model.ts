/**
 * Regras puras da Agenda da barbearia (sem React e sem banco), para a tela mostrar o momento de
 * cada atendimento, os números do dia, os intervalos livres e a faixa da semana sempre a partir
 * da MESMA lista já carregada — no mesmo escopo, dia e fuso.
 */

export type AgendaStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "reschedule_requested"
  | "cancelled";

/**
 * Momento do atendimento em relação ao relógio:
 * `upcoming` ainda vai começar · `inProgress` acontecendo agora · `unresolved` já terminou e
 * ninguém deu baixa (concluir ou registrar falta) · `completed` · `reschedule` aguardando o
 * cliente remarcar · `cancelled`.
 */
export type AgendaMoment =
  | "upcoming"
  | "inProgress"
  | "unresolved"
  | "completed"
  | "reschedule"
  | "cancelled";

/** Grupos mostrados na barra do dia e nos filtros (cada atendimento cai em um só). */
export type AgendaGroup =
  | "completed"
  | "unresolved"
  | "confirmed"
  | "pending"
  | "reschedule_requested"
  | "cancelled";

/** Ordem fixa da barra e dos filtros: o feito, o que pede ação, o que vem, o que saiu. */
export const AGENDA_GROUPS: readonly AgendaGroup[] = [
  "completed",
  "unresolved",
  "confirmed",
  "pending",
  "reschedule_requested",
  "cancelled",
];

export type TimedRow = { starts_at: string; ends_at: string; status: AgendaStatus | string };

const MINUTE = 60_000;

function time(value: string) {
  return Date.parse(value);
}

export function momentOf(row: TimedRow, now: number): AgendaMoment {
  if (row.status === "cancelled") return "cancelled";
  if (row.status === "completed") return "completed";
  if (row.status === "reschedule_requested") return "reschedule";
  if (now >= time(row.ends_at)) return "unresolved";
  if (now >= time(row.starts_at)) return "inProgress";
  return "upcoming";
}

/** Grupo de filtro: confirmado ou a confirmar que já passou do fim vira "sem desfecho". */
export function groupOf(row: TimedRow, now: number): AgendaGroup {
  const moment = momentOf(row, now);
  if (moment === "unresolved") return "unresolved";
  if (moment === "cancelled") return "cancelled";
  if (moment === "completed") return "completed";
  if (moment === "reschedule") return "reschedule_requested";
  return row.status === "pending" ? "pending" : "confirmed";
}

export function countGroups(rows: TimedRow[], now: number): Record<AgendaGroup, number> {
  const counts: Record<AgendaGroup, number> = {
    completed: 0,
    unresolved: 0,
    confirmed: 0,
    pending: 0,
    reschedule_requested: 0,
    cancelled: 0,
  };
  for (const row of rows) counts[groupOf(row, now)] += 1;
  return counts;
}

/** Ativo = ainda conta para o dia (não foi cancelado). */
export function isActive(row: TimedRow) {
  return row.status !== "cancelled";
}

/** Atendimento que pode ser confirmado, concluído ou cancelado pela barbearia. */
export function isOpen(row: TimedRow) {
  return row.status === "pending" || row.status === "confirmed";
}

/** Próximo atendimento que ainda vai começar (a confirmar ou confirmado). */
export function nextUp<T extends TimedRow>(rows: T[], now: number): T | null {
  let best: T | null = null;
  for (const row of rows) {
    if (!isOpen(row) || time(row.starts_at) <= now) continue;
    if (!best || time(row.starts_at) < time(best.starts_at)) best = row;
  }
  return best;
}

/** Atendimentos acontecendo agora. */
export function happeningNow<T extends TimedRow>(rows: T[], now: number): T[] {
  return rows.filter((row) => momentOf(row, now) === "inProgress");
}

/** Minutos inteiros até `target` (arredonda para cima; nunca negativo). */
export function minutesUntil(target: string | number, now: number) {
  const at = typeof target === "string" ? time(target) : target;
  return Math.max(0, Math.ceil((at - now) / MINUTE));
}

/** Diferença em dias de calendário entre duas datas "AAAA-MM-DD" (`day` − `today`). */
export function dayOffset(day: string, today: string) {
  const toUtc = (value: string) => {
    const [year, month, date] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, date);
  };
  return Math.round((toUtc(day) - toUtc(today)) / 86_400_000);
}

function shiftKey(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(
    shifted.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** Dia da semana (0 = domingo) de uma data "AAAA-MM-DD". */
export function weekdayOf(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** As 7 datas da semana que contém `day`, começando no domingo (0) ou na segunda (1). */
export function weekKeys(day: string, firstWeekday: 0 | 1 = 0) {
  const back = (weekdayOf(day) - firstWeekday + 7) % 7;
  const first = shiftKey(day, -back);
  return Array.from({ length: 7 }, (_, index) => shiftKey(first, index));
}

export type Interval = [start: number, end: number];

/** Junta intervalos que se tocam ou se sobrepõem (ordenados pelo início). */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter(([start, end]) => end > start)
    .map(([start, end]) => [start, end] as Interval)
    .sort((a, b) => a[0] - b[0]);
  const merged: Interval[] = [];
  for (const current of sorted) {
    const last = merged[merged.length - 1];
    if (last && current[0] <= last[1]) last[1] = Math.max(last[1], current[1]);
    else merged.push(current);
  }
  return merged;
}

/**
 * Intervalos livres entre a abertura e o fechamento, descontando o que está ocupado
 * (atendimentos ativos e bloqueios). Só devolve folgas de pelo menos `minMinutes`, para não
 * mostrar sobras que não cabem nenhum serviço.
 */
export function freeGaps(
  busy: Interval[],
  open: number,
  close: number,
  minMinutes = 30,
): Interval[] {
  if (!(close > open)) return [];
  const gaps: Interval[] = [];
  let cursor = open;
  for (const [start, end] of mergeIntervals(busy)) {
    if (end <= cursor) continue;
    if (start >= close) break;
    if (start > cursor) gaps.push([cursor, Math.min(start, close)]);
    cursor = Math.max(cursor, end);
    if (cursor >= close) break;
  }
  if (cursor < close) gaps.push([cursor, close]);
  return gaps.filter(([start, end]) => end - start >= minMinutes * MINUTE);
}

export type TimelineEntry<A, B> =
  | { kind: "appointment"; key: string; at: number; end: number; item: A }
  | { kind: "block"; key: string; at: number; end: number; item: B }
  | { kind: "gap"; key: string; at: number; end: number }
  | { kind: "now"; key: "now"; at: number };

/**
 * Linha do tempo do dia: atendimentos, bloqueios e folgas em ordem de horário, com o marcador
 * "Agora" depois de tudo o que já começou (só quando `now` é informado, ou seja, no dia de hoje).
 */
export function buildTimeline<A extends { id: string; starts_at: string; ends_at: string }, B>(
  appointments: A[],
  blocks: Array<{ key: string; at: number; end: number; item: B }>,
  gaps: Interval[],
  now: number | null,
): TimelineEntry<A, B>[] {
  const entries: TimelineEntry<A, B>[] = [
    ...appointments.map((item) => ({
      kind: "appointment" as const,
      key: item.id,
      at: time(item.starts_at),
      end: time(item.ends_at),
      item,
    })),
    ...blocks.map((block) => ({ kind: "block" as const, ...block })),
    ...gaps.map(([at, end]) => ({ kind: "gap" as const, key: `gap-${at}`, at, end })),
  ];
  // Mesmo horário: bloqueios e folgas antes dos atendimentos; entre atendimentos, a ordem chegada.
  const rank = { block: 0, gap: 1, appointment: 2, now: 3 } as const;
  entries.sort((a, b) => a.at - b.at || rank[a.kind] - rank[b.kind]);
  if (now === null || !entries.length) return entries;
  const index = entries.findIndex((entry) => entry.at > now);
  const marker = { kind: "now" as const, key: "now" as const, at: now };
  // Antes do primeiro item ainda não há "agora" útil; depois do último, também não.
  if (index === 0 || index === -1) return entries;
  return [...entries.slice(0, index), marker, ...entries.slice(index)];
}

/** Soma de valores (centavos) por situação, sempre da mesma lista mostrada. */
export function moneyOf<T extends TimedRow>(rows: T[], price: (row: T) => number) {
  let done = 0;
  let expected = 0;
  for (const row of rows) {
    if (row.status === "completed") done += price(row);
    else if (isOpen(row)) expected += price(row);
  }
  return { done, expected };
}

export type Placed<T> = { item: T; at: number; end: number; lane: number; lanes: number };

/** Atendimentos que se sobrepõem no mesmo profissional dividem a largura da coluna. */
export function placeInLanes<T>(items: Array<{ item: T; at: number; end: number }>): Placed<T>[] {
  const sorted = [...items].sort((a, b) => a.at - b.at || b.end - a.end);
  const placed: Placed<T>[] = [];
  let cluster: Placed<T>[] = [];
  let clusterEnd = -Infinity;
  const close = () => {
    const lanes = Math.max(1, ...cluster.map((entry) => entry.lane + 1));
    for (const entry of cluster) entry.lanes = lanes;
    cluster = [];
  };
  for (const current of sorted) {
    if (current.at >= clusterEnd && cluster.length) close();
    const used = new Set(cluster.filter((entry) => entry.end > current.at).map((e) => e.lane));
    let lane = 0;
    while (used.has(lane)) lane += 1;
    const entry = { ...current, lane, lanes: 1 };
    cluster.push(entry);
    placed.push(entry);
    clusterEnd = Math.max(clusterEnd, current.end);
  }
  if (cluster.length) close();
  return placed;
}
