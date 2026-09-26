import { t, type MessageKey } from "../../lib/i18n/index.ts";

export type PrivacyPreferences = { analytics: boolean; surveys: boolean; marketing: boolean };
export const defaultPrivacy: PrivacyPreferences = {
  analytics: false,
  surveys: false,
  marketing: false,
};
const questionOptions = {
  satisfaction: ["1", "2", "3", "4", "5", "skip"],
  improvement: ["result", "punctuality", "service", "comfort", "booking", "none", "other", "skip"],
  discovery: ["referral", "walk_by", "google", "instagram", "other", "skip"],
  period: ["morning", "afternoon", "evening", "varies", "skip"],
  professional: ["same", "available", "by_service", "no_preference", "skip"],
  // "Sem frequência definida" (none) é uma resposta válida (não ausência de resposta).
  frequency: ["up_to_15", "16_to_30", "31_to_60", "over_60", "none", "skip"],
  conversation: ["talk", "quiet", "decide_on_day", "no_preference", "skip"],
  service_interest: [
    "eyebrow",
    "facial",
    "hydration",
    "coloring",
    "manicure",
    "massage",
    "none",
    "other",
    "skip",
  ],
} as const;
type QuestionKey = keyof typeof questionOptions;
type Question<K extends QuestionKey> = {
  readonly title: string;
  readonly options: { readonly [O in (typeof questionOptions)[K][number]]: string };
};

/** Textos lidos no idioma atual a cada acesso (nunca congelados ao carregar o módulo). */
function localizedQuestion<K extends QuestionKey>(key: K): Question<K> {
  const options = {};
  for (const option of questionOptions[key])
    Object.defineProperty(options, option, {
      enumerable: true,
      get: () => t(`ins.q.${key}.${option}` as MessageKey),
    });
  return {
    get title() {
      return t(`ins.q.${key}.title` as MessageKey);
    },
    options: options as Question<K>["options"],
  };
}

export const questions = Object.fromEntries(
  (Object.keys(questionOptions) as QuestionKey[]).map((key) => [key, localizedQuestion(key)]),
) as { readonly [K in QuestionKey]: Question<K> };
export type Survey = {
  id: string;
  question: keyof typeof questions;
  answer: string | null;
  state: "shown" | "answered" | "dismissed";
  shown_at: string;
  version: number;
  appointment_id?: string | null;
  appointment_starts_at?: string | null;
  source?: "customer_app" | "shop_staff";
};
export function nextQuestion(rows: Survey[], now: Date): keyof typeof questions | null {
  const age = (row: Survey) => (now.getTime() - new Date(row.shown_at).getTime()) / 86400000;
  if (rows.some((row) => age(row) < 30)) return null;
  return (
    (Object.keys(questions) as (keyof typeof questions)[]).find(
      (key) =>
        key !== "satisfaction" &&
        key !== "improvement" &&
        !rows.some((row) => row.question === key && (key === "discovery" || age(row) < 180)),
    ) ?? null
  );
}

type SurveyAppointment = { id: string; status: string; starts_at: string; ends_at: string };
export function nextSurvey(
  rows: Survey[],
  now: Date,
  appointments: SurveyAppointment[],
): Pick<Survey, "question" | "appointment_id" | "appointment_starts_at"> | null {
  const age = (stamp: string) => (now.getTime() - new Date(stamp).getTime()) / 86400000;
  if (!appointments.length || rows.some((row) => age(row.shown_at) < 30)) return null;
  const generic = nextQuestion(rows, now);
  if (generic === "discovery") return { question: generic };
  const recentQuestion = (question: Survey["question"]) =>
    rows.some((row) => row.question === question && age(row.shown_at) < 180);
  const completed = appointments.filter(
    (row) => row.status === "completed" && age(row.ends_at) >= 0,
  );
  if (!recentQuestion("improvement")) {
    const rating = [...rows]
      .filter(
        (row) =>
          row.question === "satisfaction" &&
          row.state === "answered" &&
          ["1", "2", "3", "4", "5"].includes(row.answer ?? "") &&
          age(row.shown_at) < 180 &&
          completed.some((a) => a.id === row.appointment_id) &&
          !rows.some(
            (other) =>
              other.question === "improvement" && other.appointment_id === row.appointment_id,
          ),
      )
      .sort((a, b) => b.shown_at.localeCompare(a.shown_at))[0];
    if (rating)
      return {
        question: "improvement",
        appointment_id: rating.appointment_id,
        appointment_starts_at: rating.appointment_starts_at,
      };
  }
  if (!recentQuestion("satisfaction")) {
    const appointment = completed
      .filter(
        (a) =>
          age(a.ends_at) <= 90 &&
          !rows.some((row) => row.question === "satisfaction" && row.appointment_id === a.id),
      )
      .sort((a, b) => b.ends_at.localeCompare(a.ends_at))[0];
    if (appointment)
      return {
        question: "satisfaction",
        appointment_id: appointment.id,
        appointment_starts_at: appointment.starts_at,
      };
  }
  return generic ? { question: generic } : null;
}
