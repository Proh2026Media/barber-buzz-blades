import type { ServiceTerms } from "../../lib/shop/appointments.ts";
import type { DemoState } from "./model.ts";

type CatalogoDemo = Pick<DemoState, "shop" | "staff" | "services" | "staffServices">;

/** Mesma regra de shop_uses_staff_services + staff_service_terms, sem acesso ao banco. */
export function demoBookingTerms(state: CatalogoDemo): ServiceTerms[] {
  const rows = state.staffServices.filter((row) => row.barbershop_id === state.shop.id);
  const explicit = rows.length > 0;
  return state.staff
    .filter((row) => row.active && row.barbershop_id === state.shop.id)
    .flatMap((member) =>
      state.services
        .filter((row) => row.active && row.barbershop_id === state.shop.id)
        .flatMap((service) => {
          const own = rows.find(
            (row) => row.staff_id === member.id && row.service_id === service.id && row.active,
          );
          if (explicit && !own) return [];
          return [
            {
              staff_id: member.id,
              service_id: service.id,
              duration_minutes: own?.duration_minutes ?? service.duration_minutes,
              price_cents: own?.price_cents ?? service.price_cents,
            },
          ];
        }),
    );
}

export function demoServiceTerms(state: CatalogoDemo, staffId: string, serviceId: string | null) {
  return (
    demoBookingTerms(state).find(
      (row) => row.staff_id === staffId && row.service_id === serviceId,
    ) ?? null
  );
}
