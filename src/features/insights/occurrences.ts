import { t } from "../../lib/i18n/index.ts";

export type Occurrence = {
  arrived_at?: string | null;
  started_at?: string | null;
  no_show_at?: string | null;
  customer_delay_minutes?: number | null;
  shop_delay_minutes?: number | null;
  occurrence_updated_at?: string;
  occurrence_recorded_by?: string;
};

export function parseDelay(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 1440)
    throw new Error(t("ins.occ.delayRange"));
  return number;
}

export function validateOccurrence(
  appointment: { starts_at: string; ends_at: string; status: string },
  current: Occurrence,
  customer: number | null,
  shop: number | null,
  noShow: boolean,
  now: Date,
) {
  if (
    now < new Date(appointment.starts_at) ||
    !["pending", "confirmed", "completed"].includes(appointment.status) ||
    current.no_show_at
  )
    throw new Error(t("ins.occ.unavailable"));
  for (const value of [customer, shop]) if (value !== null) parseDelay(String(value));
  if (
    noShow &&
    (now < new Date(appointment.ends_at) ||
      appointment.status === "completed" ||
      customer !== null ||
      shop !== null ||
      current.customer_delay_minutes != null ||
      current.shop_delay_minutes != null ||
      current.arrived_at ||
      current.started_at)
  )
    throw new Error(t("ins.occ.noShowConflict"));
}
