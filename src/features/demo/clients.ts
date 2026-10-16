import type { Tables } from "@/integrations/supabase/types";
import type { DemoState } from "./model";

/**
 * Dados do cliente de um atendimento da demonstração, no formato da agenda (`DayAppointment`):
 * nome (da conta ou do cliente do balcão), apelido, se tem conta, se foi marcado pela equipe e a
 * recorrência. Espelha o que `get_team_schedule` devolve com a migration 20261016130000.
 */
export function demoClientFields(demo: DemoState, row: Tables<"appointments">) {
  const walkIn =
    !row.customer_id && row.shop_client_id
      ? demo.shopClients.find((client) => client.id === row.shop_client_id)
      : undefined;
  const ficha = row.customer_id
    ? demo.shopClients.find((client) => client.profile_id === row.customer_id)
    : walkIn;
  const series = row.series_id ? demo.series.find((item) => item.id === row.series_id) : undefined;
  const name =
    row.customer_id === demo.customerId
      ? demo.customerName
      : row.customer_id
        ? (demo.customers.find((customer) => customer.id === row.customer_id)?.name ??
          "Cliente demo")
        : (walkIn?.full_name ?? "Cliente demo");
  return {
    customer: { full_name: name },
    customer_nickname: ficha?.nickname ?? null,
    has_account: !!row.customer_id,
    booked_by_team: !!row.booked_by,
    series_kind: series?.kind ?? null,
    series_interval_days: series?.interval_days ?? null,
    customer_recurring:
      !!row.customer_id &&
      demo.series.some((item) => item.customer_id === row.customer_id && item.active),
  };
}
