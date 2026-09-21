export const cancellationReasons = {
  unexpected: "Imprevisto",
  schedule: "Horário não funcionou",
  plans: "Mudança de planos",
  price: "Preço",
  transport: "Deslocamento",
  service: "Serviço escolhido",
  other: "Outro motivo",
} as const;
export type CancellationReason = keyof typeof cancellationReasons;
export function cancellationReasonLabel(reason: CancellationReason | null) {
  return reason ? cancellationReasons[reason] : "Motivo não informado";
}
