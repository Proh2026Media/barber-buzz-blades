import { t, type MessageKey } from "@/lib/i18n";

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
  return reason ? cancellationReasonText(reason) : t("cancel.reason.none");
}
/** Nome do motivo no idioma atual. */
export function cancellationReasonText(reason: CancellationReason) {
  return t(`cancel.reason.${reason}` as MessageKey);
}
