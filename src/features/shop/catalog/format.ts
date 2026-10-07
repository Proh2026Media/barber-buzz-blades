/**
 * Regras puras do catálogo (serviços e equipe): leitura do preço digitado, duração escrita de
 * forma humana e o dia de cada profissional. Sem React nem i18n, para os testes rodarem no Node.
 */

/** Durações à vista no formulário de serviço (o "Outro…" cobre o resto, de 5 em 5 min). */
export const DURATION_CHOICES = [15, 20, 30, 45, 60, 90, 120] as const;

/** Limites da duração digitada em "Outro…". */
export const DURATION_MIN = 5;
export const DURATION_MAX = 600;

/** Quebra minutos em horas e minutos ("90" → 1 h e 30 min). */
export function splitDuration(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

/**
 * Lê o preço como a pessoa digita ("45", "45,5", "45,50", "R$ 1.234,56", "45.90") e devolve
 * centavos. Vazio, negativo ou texto devolvem null.
 */
export function parsePriceInput(raw: string): number | null {
  let text = raw.replace(/r\$/gi, "").replace(/\s/g, "");
  if (!text) return null;
  if (!/^[\d.,]+$/.test(text)) return null;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // O último separador é o dos centavos; o outro é de milhar.
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    text = text.split(thousands).join("").replace(decimal, ".");
  } else if (lastComma >= 0) {
    if (text.indexOf(",") !== lastComma) return null;
    text = text.replace(",", ".");
  } else if (lastDot >= 0 && text.indexOf(".") !== lastDot) {
    // "1.234.567": só separador de milhar.
    text = text.split(".").join("");
  }
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Centavos → texto do campo de preço ("4550" → "45,50"; "4500" → "45,00"). */
export function priceInputFromCents(cents: number, decimalSeparator = ",") {
  return (Math.max(0, cents) / 100).toFixed(2).replace(".", decimalSeparator);
}

/** Duração digitada em "Outro…" é válida? */
export function validDuration(minutes: number | null | undefined) {
  return (
    typeof minutes === "number" &&
    Number.isInteger(minutes) &&
    minutes >= DURATION_MIN &&
    minutes <= DURATION_MAX
  );
}

/** Mostra o contador de caracteres só quando o texto passa de 80% do limite. */
export function showCounter(length: number, max: number) {
  return length >= Math.ceil(max * 0.8);
}

type Interval = { starts_at: string; ends_at: string };

/** Uma linha do dia do profissional: atendimentos de hoje, o próximo e os bloqueios. */
export type StaffDay = {
  /** Atendimentos não cancelados do dia. */
  count: number;
  /** Início do próximo atendimento ainda por vir (ISO), se houver. */
  next: string | null;
  /** Bloqueios de hoje que alcançam este profissional (dele ou da loja toda). */
  blocks: Interval[];
  /** Algum bloqueio cobre o dia inteiro da loja. */
  allDayBlocked: boolean;
};

/**
 * Resume o dia de um profissional a partir do que o painel já carregou: atendimentos do dia e
 * bloqueios (`staff_id` nulo vale para a equipe toda). `dayStart`/`dayEnd` delimitam o dia da loja.
 */
export function staffDay(
  staffId: string,
  appointments: Array<Interval & { staff_id: string; status: string }>,
  blocks: Array<Interval & { staff_id: string | null }>,
  dayStart: number,
  dayEnd: number,
  now: number,
): StaffDay {
  const mine = appointments
    .filter((row) => row.staff_id === staffId && row.status !== "cancelled")
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const upcoming = mine.find(
    (row) =>
      new Date(row.starts_at).getTime() > now &&
      (row.status === "pending" || row.status === "confirmed"),
  );
  const todayBlocks = blocks
    .filter(
      (row) =>
        (row.staff_id === null || row.staff_id === staffId) &&
        new Date(row.starts_at).getTime() < dayEnd &&
        new Date(row.ends_at).getTime() > dayStart,
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const allDayBlocked = todayBlocks.some(
    (row) =>
      new Date(row.starts_at).getTime() <= dayStart && new Date(row.ends_at).getTime() >= dayEnd,
  );
  return {
    count: mine.length,
    next: upcoming?.starts_at ?? null,
    blocks: todayBlocks,
    allDayBlocked,
  };
}
