import { Clock3, Scissors, User, Users } from "lucide-react";
import { DetailList } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { formatShopDate } from "@/lib/shop/appointments";
import type { DayAppointment } from "./types";

/** Hora local da loja ("09:00"). */
export function useShopTime(timeZone: string) {
  const { intlLocale } = useI18n();
  return (value: string | number | Date) =>
    formatShopDate(
      typeof value === "number" ? new Date(value) : value,
      timeZone,
      { hour: "2-digit", minute: "2-digit" },
      intlLocale,
    );
}

/**
 * "De qual atendimento se trata": cliente, serviço, dia e horário (e o profissional, na visão
 * da equipe). Usado no topo de toda janela de decisão da Agenda.
 */
export function AppointmentSummary({
  row,
  timeZone,
  showStaff,
}: {
  row: DayAppointment;
  timeZone: string;
  showStaff?: boolean;
}) {
  const { t, intlLocale } = useI18n();
  const time = useShopTime(timeZone);
  const day = formatShopDate(
    row.starts_at,
    timeZone,
    { weekday: "short", day: "2-digit", month: "2-digit" },
    intlLocale,
  );
  return (
    <DetailList
      items={[
        {
          key: "customer",
          icon: User,
          label: t("shop.customerFallback"),
          value: row.customer?.full_name ?? t("shop.customerFallback"),
        },
        {
          key: "service",
          icon: Scissors,
          label: t("shop.serviceFallback"),
          value: row.service?.name ?? t("shop.serviceFallback"),
        },
        {
          key: "time",
          icon: Clock3,
          label: t("shop.agenda.time"),
          value: `${day} · ${time(row.starts_at)}–${time(row.ends_at)}`,
        },
        ...(showStaff && row.staff?.display_name
          ? [
              {
                key: "staff",
                icon: Users,
                label: t("shop.staffFallback"),
                value: row.staff.display_name,
              },
            ]
          : []),
      ]}
    />
  );
}
