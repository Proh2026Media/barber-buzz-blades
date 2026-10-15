export type MatchStatus = "live" | "extra" | "final";
export type Match = {
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
export const DEMO_MATCHES: Match[] = [
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

/** Jogos que a aba mostra: os da demonstração; fora dela ainda não há cadastro de jogos. */
export function sportsMatches(demo: boolean): Match[] {
  return demo ? DEMO_MATCHES : [];
}

/**
 * Decisão do dono (15/10/2026, P-33): a aba Esportes aparece só com o módulo ligado pela
 * plataforma e com pelo menos um jogo acontecendo ou por acontecer (encerrados não contam).
 */
export function showSportsTab(moduleEnabled: boolean, matches: Match[]) {
  return moduleEnabled && matches.some((m) => m.status !== "final");
}
