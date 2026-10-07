import { BarChart3, CalendarDays, ChevronRight, Clock3, Info, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import {
  Hint,
  MoreDetails,
  PersonAvatar,
  SectionHeader,
  SegmentBar,
  StatusBadge,
  TONE_CLASS,
} from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AGENDA_GROUPS, type AgendaGroup } from "./model";
import { AGENDA_STATE } from "./types";

export type DayMoment = {
  id: string;
  time: string;
  name: string;
  /** Minutos até começar (só para o próximo). */
  minutes?: number;
};

/**
 * "Seu dia": um cartão com o que importa do dia, saído do mesmo escopo da lista (Minha agenda,
 * Equipe ou um profissional escolhido; a busca por nome não muda o resumo): quantos já foram
 * atendidos com a barra de progresso, o que está acontecendo agora, o próximo, as pílulas por
 * situação (que filtram a lista) e os valores.
 */
export function DaySummary({
  title,
  person,
  counts,
  filter,
  onFilter,
  future,
  today = false,
  current,
  next,
  onJump,
  money,
  formatMoney,
  details,
}: {
  title: string;
  /** Profissional escolhido no filtro: o resumo passa a ser o dia dele, com a foto. */
  person?: { id: string; name: string; photo?: string | null } | null;
  counts: Record<AgendaGroup, number>;
  filter: AgendaGroup | "";
  onFilter: (group: AgendaGroup | "") => void;
  /** Dia que ainda não chegou: o número grande é o total marcado. */
  future: boolean;
  /**
   * O dia é hoje: até o primeiro atendimento começar ou ser concluído, o número grande é o
   * total marcado ("8 atendimentos marcados"), não um "0 de 8 concluídos".
   */
  today?: boolean;
  /** Atendimentos acontecendo agora (a equipe pode ter vários ao mesmo tempo). */
  current: DayMoment[];
  next: DayMoment | null;
  onJump: (id: string) => void;
  /** Valores em centavos; `null` para quem não vê valores. */
  money: { done: number; expected: number } | null;
  formatMoney: (cents: number) => string;
  details?: ReactNode;
}) {
  const { t } = useI18n();
  const total = AGENDA_GROUPS.reduce((sum, group) => sum + counts[group], 0);
  const active = total - counts.cancelled;
  // A barra é o progresso real do número grande: concluídos (verde) sobre o trilho dos ativos.
  // A divisão por situação fica nas pílulas logo abaixo, cada uma com a sua cor e ícone.
  const progress = [
    {
      key: "completed",
      label: t(AGENDA_STATE.completed.labelKey),
      value: counts.completed,
      tone: AGENDA_STATE.completed.tone,
      icon: AGENDA_STATE.completed.icon,
    },
  ];
  const progressSummary = `${counts.completed} ${t("agenda.summary.doneOf", { total: active })}`;
  // Figura principal: o que a pessoa tem hoje. O progresso vira o número grande depois do
  // primeiro concluído (ou do primeiro "Agora"); antes disso fica só na barra logo abaixo.
  const showBooked = future || (today && counts.completed === 0 && current.length === 0);
  // Até dois "Agora" à vista; os demais viram "+N acontecendo agora".
  const nowShown = current.slice(0, 2);
  const nowMore = current.length - nowShown.length;
  const moments = [
    ...nowShown.map((moment) => ({ moment, now: true })),
    ...(next ? [{ moment: next, now: false }] : []),
  ];

  return (
    <section className="app-action-card space-y-4 p-4" aria-label={title}>
      <SectionHeader
        icon={CalendarDays}
        title={title}
        as="h3"
        aside={
          person ? (
            <PersonAvatar name={person.name} src={person.photo} seed={person.id} size="sm" />
          ) : undefined
        }
      />
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <p className="text-4xl font-extrabold leading-none tracking-tight tabular-nums">
          {showBooked ? active : counts.completed}
        </p>
        <p className="pb-0.5 text-sm font-semibold text-muted-foreground">
          {showBooked
            ? t(active === 1 ? "agenda.summary.bookedOne" : "agenda.summary.bookedMany")
            : t("agenda.summary.doneOf", { total: active })}
        </p>
      </div>

      {!future && active > 0 && (
        <SegmentBar segments={progress} total={active} summary={progressSummary} legend={false} />
      )}

      {moments.length > 0 && (
        <div className="grid gap-2">
          {moments.map(({ moment, now }) => (
            <button
              key={`${now ? "now" : "next"}-${moment.id}`}
              type="button"
              onClick={() => onJump(moment.id)}
              className={cn(
                "flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition hover:border-primary/40",
                now ? "border-gold/50 bg-gold/10" : "border-border bg-background/60",
              )}
            >
              {now ? (
                <StatusBadge
                  tone={AGENDA_STATE.inProgress.tone}
                  live
                  label={t(AGENDA_STATE.inProgress.labelKey)}
                  size="sm"
                />
              ) : (
                <Clock3 className="size-4 shrink-0 text-gold" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                {!now && <span className="font-semibold">{t("agenda.summary.next")} </span>}
                <span className="font-bold tabular-nums">{moment.time}</span>
                {" · "}
                <span className="break-words">{moment.name}</span>
              </span>
              {moment.minutes !== undefined && (
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                  {moment.minutes < 60
                    ? t("agenda.inMinutes", { minutes: moment.minutes })
                    : t("agenda.inHours", {
                        hours: Math.floor(moment.minutes / 60),
                        minutes: String(moment.minutes % 60).padStart(2, "0"),
                      })}
                </span>
              )}
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          ))}
          {nowMore > 0 && (
            <StatusBadge
              tone="info"
              variant="dot"
              size="sm"
              label={t("agenda.summary.moreNow", { count: nowMore })}
              className="px-1"
            />
          )}
        </div>
      )}

      <div role="group" aria-label={t("agenda.filter.aria")} className="flex flex-wrap gap-1.5">
        <button
          type="button"
          aria-pressed={filter === ""}
          onClick={() => onFilter("")}
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition",
            filter === ""
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background hover:border-primary/40",
          )}
        >
          {t("agenda.filter.all")}
          <span className="tabular-nums opacity-80">{total}</span>
        </button>
        {AGENDA_GROUPS.filter((group) => counts[group] > 0 || filter === group).map((group) => {
          const meta = AGENDA_STATE[group];
          const Icon = meta.icon;
          const on = filter === group;
          return (
            <button
              key={group}
              type="button"
              aria-pressed={on}
              onClick={() => onFilter(on ? "" : group)}
              className={cn(
                TONE_CLASS[meta.tone],
                "inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition",
                on
                  ? "border-[color:var(--tone-ink)] bg-[color:var(--tone-bg)] text-[color:var(--tone-ink)] ring-2 ring-[color:var(--tone-line)]"
                  : "border-border bg-background hover:border-[color:var(--tone-line)]",
              )}
            >
              <Icon className="size-4 shrink-0 text-[color:var(--tone-ink)]" aria-hidden />
              {t(meta.labelKey)}
              <span className="tabular-nums opacity-80">
                <span className="sr-only">: </span>
                {counts[group]}
              </span>
            </button>
          );
        })}
      </div>

      {money && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-muted/50 px-3 py-2.5 text-sm">
          <Wallet className="size-4 shrink-0 text-gold" aria-hidden />
          <span>
            <strong className="tone-success text-[color:var(--tone-ink)] tabular-nums">
              {formatMoney(money.done)}
            </strong>{" "}
            <span className="text-muted-foreground">{t("agenda.money.done")}</span>
          </span>
          <span>
            <strong className="tabular-nums">{formatMoney(money.expected)}</strong>{" "}
            <span className="text-muted-foreground">{t("agenda.money.expected")}</span>
          </span>
        </div>
      )}

      {(details || money) && (
        <MoreDetails summary={t("agenda.summary.more")} icon={BarChart3}>
          {money && <Hint icon={Info}>{t("shop.money.estimate")}</Hint>}
          {details}
        </MoreDetails>
      )}
    </section>
  );
}
