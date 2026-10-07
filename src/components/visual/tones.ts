import {
  AlertTriangle,
  CheckCircle2,
  CircleMinus,
  Hourglass,
  Info,
  Loader2,
  Sparkles,
  XCircle,
  type LucideIcon,
} from "lucide-react";

/**
 * Tons de estado do sistema. Mesmo significado = mesma cor e mesmo ícone em todas as telas.
 *
 * - `success`: deu certo, concluído, livre, aberto, conectado, salvo.
 * - `info`: confirmado, agendado, informação.
 * - `warning`: precisa de uma ação da pessoa (atenção).
 * - `pending`: aguardando alguém (aprovação, cliente, prazo).
 * - `danger`: erro, cancelado, recusado, bloqueado.
 * - `neutral`: desligado, pausado, fechado, vencido, sem dado.
 * - `progress`: em andamento (salvando, conectando, enviando).
 * - `highlight`: destaque ou atributo da marca (padrão, fundador, repete).
 *
 * As cores moram em `src/styles.css` (bloco "Tons de estado"): a classe `tone-*` liga
 * `--tone-ink`, `--tone-bg`, `--tone-soft`, `--tone-line` e `--tone-border`, com contraste AA
 * no tema claro, no escuro e dentro dos cartões off-white.
 */
export type Tone =
  | "success"
  | "info"
  | "warning"
  | "pending"
  | "danger"
  | "neutral"
  | "progress"
  | "highlight";

export const TONES: readonly Tone[] = [
  "success",
  "info",
  "warning",
  "pending",
  "danger",
  "neutral",
  "progress",
  "highlight",
];

/** Classe que liga as variáveis do tom (ver styles.css). */
export const TONE_CLASS: Record<Tone, string> = {
  success: "tone-success",
  info: "tone-info",
  warning: "tone-warning",
  pending: "tone-pending",
  danger: "tone-danger",
  neutral: "tone-neutral",
  progress: "tone-progress",
  highlight: "tone-highlight",
};

/** Ícone padrão de cada tom. Um estado específico pode trocar o ícone, nunca a cor. */
export const TONE_ICON: Record<Tone, LucideIcon> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  pending: Hourglass,
  danger: XCircle,
  neutral: CircleMinus,
  progress: Loader2,
  highlight: Sparkles,
};

/** Ordem de urgência: o que exige ação aparece primeiro. */
export const TONE_URGENCY: Record<Tone, number> = {
  danger: 0,
  warning: 1,
  pending: 2,
  info: 3,
  progress: 4,
  highlight: 5,
  success: 6,
  neutral: 7,
};

/** Texto e ícone na cor do tom. */
export const TONE_TEXT = "text-[color:var(--tone-ink)]";
/** Selo: fundo do tom, borda suave e texto forte. */
export const TONE_BADGE =
  "border-[color:var(--tone-border)] bg-[color:var(--tone-bg)] text-[color:var(--tone-ink)]";
/** Aviso: fundo bem claro do tom, borda suave e texto forte. */
export const TONE_SOFT =
  "border-[color:var(--tone-border)] bg-[color:var(--tone-soft)] text-[color:var(--tone-ink)]";
/** Preenchimento sólido (barras, pontos, anéis). */
export const TONE_FILL = "bg-[color:var(--tone-line)]";

/** O ícone de "em andamento" gira, só quando a pessoa aceita movimento. */
export function toneIconMotion(icon: LucideIcon) {
  return icon === Loader2 ? "motion-safe:animate-spin" : "";
}
