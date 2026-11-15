import type { MessageKey } from "@/lib/i18n";
export const careStates: Record<string, MessageKey> = {
  requested: "care.requested",
  creating: "care.creating",
  waiting_customer: "care.waiting",
  active: "care.active",
  paused_divergence: "care.divergence",
  paused_unavailable: "care.unavailable",
  customer_left: "care.left",
  closed: "care.closed",
  creation_unknown: "care.unknown",
};
