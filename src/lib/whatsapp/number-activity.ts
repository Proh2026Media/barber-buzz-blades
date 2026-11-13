/** Medidas observadas, não classificação de qualidade do WhatsApp. */
export type NumberActivity = {
  accepted: number;
  uncertain: number;
  activeDays: number;
  observedDays: number;
  sampledAt: string;
  source: "dispatch" | "simulation";
  paused?: boolean;
};
export type ActivityLevel = "unknown" | "initial" | "regular" | "established" | "review";

/** Critério interno v1, janela de 30 dias; limiares de produto, não recomendação da Meta. */
export function numberActivityLevel(activity?: NumberActivity, now = Date.now()): ActivityLevel {
  if (!activity) return "unknown";
  const { accepted, uncertain, activeDays, observedDays } = activity;
  if (
    [accepted, uncertain, activeDays, observedDays].some((n) => !Number.isInteger(n) || n < 0) ||
    activeDays > 30 ||
    observedDays > 30 ||
    activeDays > observedDays ||
    activeDays > accepted ||
    !Number.isFinite(Date.parse(activity.sampledAt)) ||
    now - Date.parse(activity.sampledAt) > 24 * 60 * 60 * 1000 ||
    Date.parse(activity.sampledAt) - now > 5 * 60 * 1000
  )
    return "unknown";
  if (activity.paused || uncertain > 0) return "review";
  if (!accepted) return "unknown";
  if (accepted >= 100 && activeDays >= 14 && observedDays >= 14) return "established";
  if (accepted >= 20 && activeDays >= 7 && observedDays >= 7) return "regular";
  return "initial";
}

/** Sem evidência ou com atenção pendente não ganha preferência por volume. */
export function activityPreference(activity?: NumberActivity) {
  return { established: 0, regular: 1, initial: 2, unknown: 3, review: 4 }[
    numberActivityLevel(activity)
  ];
}
