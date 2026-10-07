import type { LucideIcon } from "lucide-react";
import {
  APPOINTMENT_DERIVED,
  APPOINTMENT_STATUS,
  type AppointmentStatus,
  type Tone,
} from "@/components/visual";
import { formatShopDate } from "@/lib/shop/appointments";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { daysFromToday } from "../when";

/* Formatos compartilhados de Agendar e Reservas (situação, horário curto e grupos da lista). */

type StatusView = { tone: Tone; icon: LucideIcon; label: string };

/** Rótulos da visão do cliente: "Aguardando a barbearia" em vez de "Em revisão". */
const CUSTOMER_LABEL: Partial<Record<AppointmentStatus, MessageKey>> = {
  pending: "home.status.pending",
  reschedule_requested: "home.status.reschedule",
};

/**
 * Situação da reserva para o cliente. Confirmado ou aguardando com início no passado vira
 * "Já passou" (cinza, relógio): só exibição, nenhum dado muda. Com `actionable` (o cartão ainda
 * oferece Remarcar/Cancelar), mantém a situação real para o selo não contradizer as ações.
 */
export function useReservationStatus() {
  const { t } = useI18n();
  return (
    status: AppointmentStatus,
    startsAt: string,
    now: Date,
    actionable = false,
  ): StatusView => {
    const past = new Date(startsAt).getTime() <= now.getTime();
    if (past && !actionable && status !== "completed" && status !== "cancelled") {
      return { ...APPOINTMENT_DERIVED.unresolved, label: t("bookings.status.past") };
    }
    const meta = APPOINTMENT_STATUS[status] ?? APPOINTMENT_STATUS.pending;
    return { tone: meta.tone, icon: meta.icon, label: t(CUSTOMER_LABEL[status] ?? meta.labelKey) };
  };
}

/** "seg 05/10 · 10:00" — o horário em uma linha curta (resumos, pílulas, botões). */
export function useShortSlot() {
  const { intlLocale } = useI18n();
  return (date: Date | string, timeZone: string) => {
    const day = formatShopDate(date, timeZone, { weekday: "short" }, intlLocale).replace(".", "");
    const dm = formatShopDate(date, timeZone, { day: "2-digit", month: "2-digit" }, intlLocale);
    const time = formatShopDate(date, timeZone, { hour: "2-digit", minute: "2-digit" }, intlLocale);
    return { day: `${day} ${dm}`, time };
  };
}

export type ReservationGroup<T> = { key: string; label: string; rows: T[] };

/**
 * Agrupa a lista: próximos em Hoje · Esta semana · Mais tarde; anteriores por mês
 * ("outubro de 2026"), do mais novo para o mais antigo.
 */
export function useGroupReservations() {
  const { t, intlLocale } = useI18n();
  return <T extends { starts_at: string }>(
    rows: T[],
    upcoming: boolean,
    now: Date,
    timeZone: string,
  ): ReservationGroup<T>[] => {
    const groups: ReservationGroup<T>[] = [];
    const push = (key: string, label: string, row: T) => {
      const last = groups[groups.length - 1];
      if (last?.key === key) last.rows.push(row);
      else groups.push({ key, label, rows: [row] });
    };
    const sorted = [...rows].sort((a, b) =>
      upcoming ? a.starts_at.localeCompare(b.starts_at) : b.starts_at.localeCompare(a.starts_at),
    );
    for (const row of sorted) {
      if (upcoming) {
        const days = daysFromToday(row.starts_at, now, timeZone);
        if (days <= 0) push("today", t("bookings.group.today"), row);
        else if (days < 7) push("week", t("bookings.group.week"), row);
        else push("later", t("bookings.group.later"), row);
      } else {
        // "Setembro" no ano corrente; "Dezembro de 2025" quando é de outro ano.
        const sameYear =
          formatShopDate(row.starts_at, timeZone, { year: "numeric" }, intlLocale) ===
          formatShopDate(now, timeZone, { year: "numeric" }, intlLocale);
        const month = formatShopDate(
          row.starts_at,
          timeZone,
          sameYear ? { month: "long" } : { month: "long", year: "numeric" },
          intlLocale,
        );
        push(month, month.charAt(0).toLocaleUpperCase() + month.slice(1), row);
      }
    }
    return groups;
  };
}
