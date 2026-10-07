import { useState } from "react";
import { CheckCircle2, House, Radio, Timer, Trophy } from "lucide-react";
import {
  ChoiceChips,
  EmptyState,
  PersonAvatar,
  StatusBadge,
  type StatusBadgeProps,
} from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type MatchStatus = "live" | "extra" | "final";
type Match = {
  id: number;
  league: string;
  home: string;
  away: string;
  scoreH: number;
  scoreA: number;
  status: MatchStatus;
  /** Minuto do jogo ao vivo ("82'"). */
  minute?: string;
};

/** Placares fictícios da demonstração (fora dela ainda não há fonte de jogos). */
const DEMO_MATCHES: Match[] = [
  {
    id: 1,
    league: "Brasileirão",
    home: "Flamengo",
    away: "Palmeiras",
    scoreH: 2,
    scoreA: 1,
    status: "live",
    minute: "82'",
  },
  {
    id: 2,
    league: "Champions League",
    home: "Real Madrid",
    away: "Man City",
    scoreH: 3,
    scoreA: 3,
    status: "extra",
  },
  {
    id: 3,
    league: "Brasileirão",
    home: "Galo",
    away: "Cruzeiro",
    scoreH: 1,
    scoreA: 0,
    status: "final",
  },
  {
    id: 4,
    league: "NBA",
    home: "Lakers",
    away: "Celtics",
    scoreH: 102,
    scoreA: 108,
    status: "final",
  },
];

type Filter = "all" | "football" | "nba";

function TeamLine({
  name,
  score,
  leads,
  won,
}: {
  name: string;
  score: number;
  /** Na frente (ou empatado): em negrito. */
  leads: boolean;
  /** Venceu o jogo encerrado: troféu ao lado. */
  won: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <PersonAvatar name={name} seed={name} size="xs" />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          leads ? "font-bold text-foreground" : "font-semibold text-muted-foreground",
        )}
      >
        {name}
      </span>
      {won && <Trophy className="size-4 shrink-0 text-gold" aria-hidden />}
      <span
        className={cn(
          "min-w-8 text-right text-lg tabular-nums",
          leads ? "font-extrabold text-foreground" : "font-semibold text-muted-foreground",
        )}
      >
        {score}
      </span>
    </div>
  );
}

/**
 * Aba Esportes do cliente: placares compactos com o estado do jogo em selo (ao vivo com o
 * minuto, prorrogação, encerrado), "Ao vivo agora" primeiro e filtros com contagem. Sem jogos,
 * um vazio ilustrado no lugar de texto técnico.
 */
export function SportsBoard({
  demo,
  onBack,
}: {
  demo: boolean;
  /** Próxima ação do vazio: volta ao Início do cliente. */
  onBack?: () => void;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Filter>("all");
  const matches = demo ? DEMO_MATCHES : [];
  const isNba = (m: Match) => m.league === "NBA";
  const counts: Record<Filter, number> = {
    all: matches.length,
    football: matches.filter((m) => !isNba(m)).length,
    nba: matches.filter(isNba).length,
  };
  const shown = matches.filter((m) =>
    filter === "all" ? true : filter === "nba" ? isNba(m) : !isNba(m),
  );
  const live = shown.filter((m) => m.status !== "final");
  const ended = shown.filter((m) => m.status === "final");

  const badgeFor = (m: Match): StatusBadgeProps =>
    m.status === "live"
      ? {
          tone: "danger",
          icon: Radio,
          live: true,
          label: m.minute ? `${t("sports.live")} · ${m.minute}` : t("sports.live"),
        }
      : m.status === "extra"
        ? { tone: "warning", icon: Timer, label: t("sports.extraTime") }
        : { tone: "neutral", icon: CheckCircle2, label: t("sports.final") };

  const card = (m: Match) => {
    const ended = m.status === "final";
    return (
      <li key={m.id} className="app-action-card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted-foreground">{m.league}</span>
          <StatusBadge size="sm" {...badgeFor(m)} />
        </div>
        <div className="space-y-2">
          <TeamLine
            name={m.home}
            score={m.scoreH}
            leads={m.scoreH >= m.scoreA}
            won={ended && m.scoreH > m.scoreA}
          />
          <TeamLine
            name={m.away}
            score={m.scoreA}
            leads={m.scoreA >= m.scoreH}
            won={ended && m.scoreA > m.scoreH}
          />
        </div>
      </li>
    );
  };

  const group = (title: string, rows: Match[]) =>
    rows.length > 0 && (
      <section className="space-y-2" aria-label={title}>
        <h3 className="text-sm font-bold">{title}</h3>
        <ul className="grid gap-3 lg:grid-cols-2">{rows.map(card)}</ul>
      </section>
    );

  return (
    <div className="space-y-5">
      <div className="app-section-title flex-wrap">
        <Trophy aria-hidden />
        <h2 className="min-w-0 flex-1">{t("conta.sports.title")}</h2>
        {demo && <StatusBadge tone="highlight" size="sm" label={t("common.demo")} />}
      </div>

      {matches.length === 0 ? (
        <EmptyState
          status="neutral"
          icon={Trophy}
          title={t("conta.sports.emptyTitle")}
          description={t("conta.sports.emptyText")}
          action={
            onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold transition hover:border-primary/40"
              >
                <House className="size-4" aria-hidden />
                {t("common.backHome")}
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ChoiceChips
            label={t("conta.sports.filter")}
            hideLabel
            value={filter}
            onChange={(next) => setFilter(next as Filter)}
            options={[
              { value: "all", label: t("sports.all"), count: counts.all },
              { value: "football", label: t("sports.football"), count: counts.football },
              { value: "nba", label: "NBA", count: counts.nba },
            ]}
          />
          {group(t("conta.sports.liveNow"), live)}
          {group(t("conta.sports.ended"), ended)}
        </>
      )}
    </div>
  );
}
