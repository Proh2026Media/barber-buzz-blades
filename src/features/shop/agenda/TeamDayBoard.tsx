import type { CSSProperties } from "react";
import { Lock, Moon, Timer } from "lucide-react";
import { ServiceIcon } from "@/components/ui/service-icon";
import { PersonAvatar, STATE, StatusBadge, TONE_CLASS, personColor } from "@/components/visual";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { BLOCK_HATCH, BLOCK_HATCH_SOFT, boardState, useBlockInfo } from "./board";
import { placeInLanes } from "./model";
import { useShopTime } from "./summary";
import { AGENDA_STATE, type AgendaBlock, type DayAppointment } from "./types";

const MINUTE = 60_000;
/** Altura de uma hora no quadro (px). Meia hora = 48 px: cabe horário, nome e serviço. */
const HOUR_PX = 96;
const PX = HOUR_PX / 60;
const MIN_BLOCK_PX = 24;
/** Altura de uma linha da etiqueta do bloqueio (px). */
const LABEL_LINE_PX = 22;

/**
 * Agenda da equipe no computador: uma coluna por profissional (foto, nome e cor dele no topo),
 * atendimentos como blocos na altura do horário e na cor da situação, bloqueios em vermelho
 * listrado, horário fechado em cinza e a linha dourada do "agora". Tocar num atendimento abre o
 * cartão completo, com as mesmas ações da lista.
 */
export function TeamDayBoard({
  dayStart,
  dayEnd,
  timeZone,
  rows,
  staff,
  blocks,
  open,
  now,
  nextId,
  waitIds,
  serviceIconFor,
  onOpen,
}: {
  /** Meia-noite do dia na loja (ms). */
  dayStart: number;
  dayEnd: number;
  timeZone: string;
  /** Atendimentos já filtrados, sem os cancelados. */
  rows: DayAppointment[];
  staff: Tables<"staff">[];
  blocks: AgendaBlock[];
  /** Funcionamento do dia (ms); `null` = barbearia fechada. */
  open: { start: number; end: number } | null;
  /** Só no dia de hoje. */
  now: number | null;
  nextId: string | null;
  waitIds: Set<string>;
  serviceIconFor: (row: DayAppointment) => string | null;
  onOpen: (row: DayAppointment) => void;
}) {
  const { t, intlLocale } = useI18n();
  const time = useShopTime(timeZone);
  const blockInfo = useBlockInfo(timeZone);
  const clock = now ?? Date.now();
  const minuteOf = (value: number) => (value - dayStart) / MINUTE;
  // Idiomas de 12 h ("01:00 PM") pedem uma régua mais larga.
  const hour12 = !!new Intl.DateTimeFormat(intlLocale, {
    hour: "numeric",
    timeZone,
  }).resolvedOptions().hour12;

  const staffIds = new Set(staff.map((member) => member.id));
  const dayBlocks = blocks
    .filter((block) => !block.staff_id || staffIds.has(block.staff_id))
    .map((block) => ({
      block,
      info: blockInfo(
        block,
        { start: dayStart, end: dayEnd },
        open ? { start: open.start, end: open.end } : null,
      ),
    }))
    .filter(({ info }) => info.end > info.start);

  // Régua: do funcionamento, dos atendimentos e dos bloqueios parciais. Bloqueios de dia inteiro
  // ou colados à meia-noite (ex.: madrugada inteira) não esticam o quadro.
  const marks = [
    ...(open ? [minuteOf(open.start), minuteOf(open.end)] : []),
    ...rows.flatMap((row) => [
      minuteOf(Date.parse(row.starts_at)),
      minuteOf(Date.parse(row.ends_at)),
    ]),
    ...dayBlocks
      .filter(({ info }) => !info.allDay && info.start > dayStart && info.end < dayEnd - MINUTE)
      .flatMap(({ info }) => [minuteOf(info.start), minuteOf(info.end)]),
  ];
  let first = marks.length ? Math.floor(Math.min(...marks) / 60) * 60 : 8 * 60;
  let last = marks.length ? Math.ceil(Math.max(...marks) / 60) * 60 : 20 * 60;
  first = Math.max(0, first);
  last = Math.min(24 * 60, Math.max(last, first + 4 * 60));
  const height = (last - first) * PX;
  const y = (minute: number) => (Math.min(last, Math.max(first, minute)) - first) * PX;
  const hours = Array.from({ length: (last - first) / 60 + 1 }, (_, index) => first + index * 60);
  const nowMinute = now !== null ? minuteOf(now) : null;
  const showNow = nowMinute !== null && nowMinute >= first && nowMinute <= last;

  const closedSpans: Array<[number, number]> = open
    ? (
        [
          [first, minuteOf(open.start)],
          [minuteOf(open.end), last],
        ] as Array<[number, number]>
      ).filter(([from, to]) => to > from)
    : [[first, last]];

  const columns = staff.map((member) => {
    const own = rows.filter((row) => row.staff_id === member.id);
    return {
      member,
      count: own.filter((row) => row.visibility !== "busy").length,
      placed: placeInLanes(
        own.map((row) => ({
          item: row,
          at: minuteOf(Date.parse(row.starts_at)),
          end: minuteOf(Date.parse(row.ends_at)),
        })),
      ),
      blocks: dayBlocks.filter(
        ({ block, info }) =>
          (!block.staff_id || block.staff_id === member.id) &&
          // Fora da régua (ex.: madrugada): nada a desenhar, não prende na borda.
          minuteOf(info.end) > first &&
          minuteOf(info.start) < last,
      ),
    };
  });

  const bodyStyle: CSSProperties = {
    height,
    backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px ${HOUR_PX}px)`,
  };

  return (
    <div className="space-y-2">
      <ul
        aria-hidden
        className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-muted-foreground"
      >
        <li className="flex items-center gap-1.5">
          <span className="size-3.5 rounded-sm border border-border bg-card" />
          {t("agenda.gap")}
        </li>
        <li className="tone-danger flex items-center gap-1.5">
          <span
            className="size-3.5 rounded-sm border border-[color:var(--tone-line)]"
            style={BLOCK_HATCH}
          />
          {t("agenda.blocked")}
        </li>
        <li className="tone-neutral flex items-center gap-1.5">
          <span className="size-3.5 rounded-sm border border-dashed border-[color:var(--tone-line)] bg-[color:var(--tone-bg)]" />
          {t("agenda.closed")}
        </li>
        {showNow && (
          <li className="flex items-center gap-1.5 text-gold">
            <span className="h-0.5 w-4 rounded-full bg-gold" />
            {t("agenda.state.inProgress")}
          </li>
        )}
      </ul>

      <div
        role="group"
        aria-label={t("agenda.board.aria")}
        className="app-action-card overflow-x-auto p-0"
      >
        <div
          className="grid min-w-full"
          style={{
            gridTemplateColumns: `${hour12 ? "4.5rem" : "3.25rem"} repeat(${columns.length}, minmax(10rem, 1fr))`,
          }}
        >
          {/* Régua das horas */}
          <div aria-hidden className="border-e border-border">
            <div className="h-[4.5rem] border-b border-border" />
            <div className="relative my-3" style={{ height }}>
              {hours.map((minute) => (
                <span
                  key={minute}
                  className="absolute end-1.5 -translate-y-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums text-muted-foreground"
                  style={{ top: y(minute) }}
                >
                  {time(dayStart + minute * MINUTE)}
                </span>
              ))}
              {showNow && nowMinute !== null && (
                <span
                  className="absolute end-1 z-10 -translate-y-1/2 rounded-md bg-gold px-1 text-[11px] font-extrabold tabular-nums text-primary-foreground"
                  style={{ top: y(nowMinute) }}
                >
                  {time(now!)}
                </span>
              )}
            </div>
          </div>

          {columns.map(({ member, count, placed, blocks: ownBlocks }) => {
            const color = personColor(member.id);
            return (
              <section
                key={member.id}
                aria-label={member.display_name}
                className="min-w-0 border-e border-border last:border-e-0"
              >
                <header
                  className="flex h-[4.5rem] items-center gap-2 border-b border-border px-2.5"
                  style={{ borderTop: `4px solid ${color.fg}` }}
                >
                  <PersonAvatar
                    name={member.display_name}
                    src={member.avatar_url}
                    seed={member.id}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="line-clamp-2 break-words text-sm font-bold leading-tight">
                      {member.display_name}
                    </p>
                    <p className="text-xs font-semibold text-muted-foreground">
                      {t(count === 1 ? "agenda.board.countOne" : "agenda.board.countMany", {
                        count,
                      })}
                    </p>
                  </div>
                </header>

                <div className="relative mx-1 my-3" style={bodyStyle}>
                  {closedSpans.map(([from, to]) => (
                    <div
                      key={`closed-${from}`}
                      aria-hidden
                      className="tone-neutral absolute inset-x-0 rounded-lg border border-dashed border-[color:var(--tone-line)] bg-[color:var(--tone-soft)]"
                      style={{ top: y(from), height: y(to) - y(from) }}
                    >
                      {y(to) - y(from) >= 24 && (
                        <span className="m-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--tone-ink)]">
                          <Moon className="size-3" aria-hidden />
                          {t("agenda.closed")}
                        </span>
                      )}
                    </div>
                  ))}

                  {ownBlocks.map(({ block, info }) => {
                    const from = minuteOf(info.start);
                    const to = minuteOf(info.end);
                    const top = y(from);
                    const size = Math.max(MIN_BLOCK_PX, y(to) - top);
                    const Icon = info.icon;
                    const blockedLabel = t("agenda.blocked");
                    const fullLabel = [blockedLabel, info.reason, info.range]
                      .filter(Boolean)
                      .join(" · ");
                    // A etiqueta vai onde nenhum atendimento cobre o bloqueio: no topo, senão no
                    // pé. Coberto inteiro, vira só o selo no canto, acima do atendimento, para o
                    // conflito continuar visível sem tapar o texto.
                    const free = (a: number, b: number) =>
                      !placed.some(({ at, end }) => at < b && end > a);
                    const lineMin = LABEL_LINE_PX / PX;
                    const where: "top" | "bottom" | "corner" =
                      size < LABEL_LINE_PX
                        ? "corner"
                        : free(from, from + lineMin)
                          ? "top"
                          : free(to - lineMin, to)
                            ? "bottom"
                            : "corner";
                    const conflict = where === "corner";
                    // Linhas que cabem sem tapar atendimento: 1 = selo + motivo · horário;
                    // 2 = "Bloqueado" / motivo · horário; 3 = "Bloqueado" / horário / motivo.
                    const fits = (n: number) =>
                      size >= n * LABEL_LINE_PX && free(from, from + n * lineMin);
                    const lines = where !== "top" ? 1 : fits(3) ? 3 : fits(2) ? 2 : 1;
                    const reasonLine = info.reason ? (
                      <>
                        <Icon className="size-3 shrink-0" />
                        <span className="truncate">{info.reason}</span>
                      </>
                    ) : null;
                    const chip =
                      "inline-flex max-w-full items-center gap-1 rounded-md bg-card px-1 py-0.5 text-[11px] text-[color:var(--tone-ink)]";
                    return (
                      <div key={`block-${block.id}`} className="contents">
                        <div
                          aria-hidden
                          className="tone-danger absolute inset-x-0 z-[1] overflow-hidden rounded-lg border border-[color:var(--tone-line)]"
                          style={{ top, height: size, ...BLOCK_HATCH_SOFT }}
                        >
                          <span className="absolute inset-y-0 start-0 w-1.5" style={BLOCK_HATCH} />
                        </div>
                        {conflict ? (
                          <span
                            className="pointer-events-none absolute end-1 z-[3] rounded-full bg-card"
                            style={{ top: top + 2 }}
                          >
                            <StatusBadge
                              {...STATE.blocked}
                              label={fullLabel}
                              variant="icon"
                              size="sm"
                              className="size-5 [&>svg]:size-3"
                            />
                          </span>
                        ) : (
                          <span
                            role="note"
                            aria-label={fullLabel}
                            className={cn(
                              "tone-danger pointer-events-none absolute end-1 start-2.5 z-[3] flex min-w-0 flex-col items-start",
                              where === "bottom" && "-translate-y-full",
                            )}
                            style={{ top: where === "bottom" ? top + size - 2 : top + 2 }}
                          >
                            <span aria-hidden className={cn(chip, "font-bold")}>
                              <StatusBadge
                                {...STATE.blocked}
                                label={blockedLabel}
                                variant="icon"
                                size="sm"
                                className="size-4 [&>svg]:size-2.5"
                              />
                              <span className="truncate">
                                {lines > 1 ? blockedLabel : info.reason || blockedLabel}
                              </span>
                              {lines === 1 && (
                                <span className="shrink-0 whitespace-nowrap tabular-nums">
                                  · {info.range}
                                </span>
                              )}
                            </span>
                            {lines > 1 && (
                              <span
                                aria-hidden
                                className={cn(chip, "mt-0.5 font-bold tabular-nums")}
                              >
                                {lines === 2 && reasonLine}
                                <span
                                  className={
                                    lines === 2 && info.reason
                                      ? "shrink-0 whitespace-nowrap"
                                      : "truncate"
                                  }
                                >
                                  {lines === 2 && info.reason ? `· ${info.range}` : info.range}
                                </span>
                              </span>
                            )}
                            {lines === 3 && reasonLine && (
                              <span aria-hidden className={cn(chip, "mt-0.5 font-semibold")}>
                                {reasonLine}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  <ol aria-label={member.display_name} className="contents">
                    {placed.map(({ item: row, at, end, lane, lanes }) => {
                      const top = y(at);
                      const size = Math.max(MIN_BLOCK_PX, y(end) - top - 2);
                      const position: CSSProperties = {
                        top,
                        height: size,
                        left: `calc(${(lane / lanes) * 100}% + 1px)`,
                        width: `calc(${100 / lanes}% - 2px)`,
                      };
                      const start = time(row.starts_at);
                      if (row.visibility === "busy") {
                        return (
                          <li
                            key={row.id}
                            className="absolute z-[2] flex items-start gap-1 overflow-hidden rounded-lg border border-dashed border-border bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground"
                            style={position}
                          >
                            <Lock className="mt-px size-3 shrink-0" aria-hidden />
                            <span className="truncate">
                              {start} · {t("agenda.busy.title")}
                            </span>
                          </li>
                        );
                      }
                      const state = boardState(row, clock);
                      const meta = AGENDA_STATE[state];
                      const label = t(meta.labelKey);
                      const customer = row.customer?.full_name ?? t("shop.customerFallback");
                      const service = row.service?.name ?? t("shop.serviceFallback");
                      const isNext = nextId === row.id;
                      return (
                        <li key={row.id} className="absolute z-[2]" style={position}>
                          <button
                            type="button"
                            id={`agenda-row-${row.id}`}
                            onClick={() => onOpen(row)}
                            aria-label={`${start}–${time(row.ends_at)} · ${customer} · ${service} · ${label}${
                              isNext ? ` · ${t("agenda.summary.next")}` : ""
                            }`}
                            className={cn(
                              TONE_CLASS[meta.tone],
                              "flex size-full scroll-mt-28 flex-col items-stretch overflow-hidden rounded-lg border border-[color:var(--tone-border)] border-s-4 border-s-[color:var(--tone-line)] bg-[color:var(--tone-soft)] px-1.5 py-1 text-start transition hover:brightness-[0.97] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold",
                              row.status === "completed" && "opacity-80",
                              isNext && "outline-2 -outline-offset-2 outline-gold",
                              state === "unresolved" &&
                                "outline-2 -outline-offset-2 outline-dashed outline-[color:var(--tone-line)]",
                            )}
                          >
                            <span className="flex min-w-0 items-center gap-1">
                              <StatusBadge
                                tone={meta.tone}
                                icon={meta.icon}
                                label={label}
                                variant="icon"
                                size="sm"
                                className="size-4 [&>svg]:size-2.5"
                              />
                              <span className="shrink-0 text-xs font-extrabold tabular-nums text-[color:var(--tone-ink)]">
                                {start}
                              </span>
                              <span className="min-w-0 truncate text-xs font-bold text-foreground">
                                {customer}
                              </span>
                              {waitIds.has(row.id) && (
                                <Timer
                                  className="tone-pending size-3.5 shrink-0 text-[color:var(--tone-ink)]"
                                  aria-hidden
                                />
                              )}
                            </span>
                            {size >= 40 && (
                              <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
                                <ServiceIcon
                                  icon={serviceIconFor(row)}
                                  className="size-3 shrink-0 text-gold"
                                  imageClassName="size-3.5 shrink-0 rounded"
                                />
                                <span className="truncate">{service}</span>
                              </span>
                            )}
                            {size >= 66 && (
                              <span className="mt-auto truncate text-[11px] font-bold text-[color:var(--tone-ink)]">
                                {isNext ? t("agenda.summary.next") : label}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ol>

                  {showNow && nowMinute !== null && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -inset-x-1 z-[3] h-0.5 bg-gold"
                      style={{ top: y(nowMinute) }}
                    />
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
