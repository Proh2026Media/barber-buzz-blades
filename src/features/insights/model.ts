export type PrivacyPreferences = { analytics: boolean; surveys: boolean; marketing: boolean };
export const defaultPrivacy: PrivacyPreferences = {
  analytics: false,
  surveys: false,
  marketing: false,
};
export const questions = {
  satisfaction: {
    title: "Como você avalia este atendimento?",
    options: {
      "1": "1 · Muito insatisfeito",
      "2": "2 · Insatisfeito",
      "3": "3 · Nem satisfeito nem insatisfeito",
      "4": "4 · Satisfeito",
      "5": "5 · Muito satisfeito",
      skip: "Prefiro não responder",
    },
  },
  improvement: {
    title: "Qual ponto mais precisa melhorar neste atendimento?",
    options: {
      result: "Resultado do serviço",
      punctuality: "Pontualidade",
      service: "Atendimento",
      comfort: "Conforto",
      booking: "Facilidade de agendar",
      none: "Nenhum",
      other: "Outro",
      skip: "Prefiro não responder",
    },
  },
  discovery: {
    title: "Como você conheceu esta barbearia?",
    options: {
      referral: "Indicação",
      walk_by: "Passando pelo local",
      google: "Google",
      instagram: "Instagram",
      other: "Outro",
      skip: "Prefiro não responder",
    },
  },
  period: {
    title: "Qual período costuma ser melhor para você?",
    options: {
      morning: "Manhã",
      afternoon: "Tarde",
      evening: "Noite",
      varies: "Varia",
      skip: "Prefiro não responder",
    },
  },
  professional: {
    title: "Como você prefere escolher o profissional?",
    options: {
      same: "Sempre o mesmo",
      available: "Primeiro disponível",
      by_service: "Depende do serviço",
      no_preference: "Sem preferência",
      skip: "Prefiro não responder",
    },
  },
  frequency: {
    title: "Com que frequência você gostaria de visitar a barbearia?",
    options: {
      up_to_15: "Até 15 dias",
      "16_to_30": "De 16 a 30 dias",
      "31_to_60": "De 31 a 60 dias",
      over_60: "Mais de 60 dias",
      // "Sem frequência definida" é uma resposta válida (não ausência de resposta).
      none: "Sem frequência definida",
      skip: "Prefiro não responder",
    },
  },
  conversation: {
    title: "Durante o atendimento, você prefere…",
    options: {
      talk: "Conversar",
      quiet: "Mais silêncio",
      decide_on_day: "Decidir no dia",
      no_preference: "Sem preferência",
      skip: "Prefiro não responder",
    },
  },
  service_interest: {
    title: "Qual serviço você gostaria de encontrar na barbearia?",
    options: {
      eyebrow: "Design de sobrancelha",
      facial: "Limpeza de pele",
      hydration: "Hidratação capilar",
      coloring: "Coloração",
      manicure: "Manicure",
      massage: "Massagem",
      none: "Nenhum destes",
      other: "Outro",
      skip: "Prefiro não responder",
    },
  },
} as const;
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
