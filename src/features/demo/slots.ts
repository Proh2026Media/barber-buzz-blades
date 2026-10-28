import {
  buildSlotsForWindow,
  slotRuleFromSettings,
  validPrepMinutes,
  weekdayForDateKey,
} from "../../lib/shop/appointments.ts";
import { blocksSlot } from "../waiting/model.ts";
import { demoServiceTerms } from "./catalog.ts";
import type { DemoState } from "./model";

/**
 * Horários livres de um profissional na demonstração, pela mesma regra do banco: expediente,
 * bloqueios, atendimentos (com o preparo depois de cada serviço) e vagas seguradas pela espera.
 * Usado pelo agendamento do cliente e pelo "Agendar cliente" do painel (`team`: sem a
 * antecedência mínima, que é regra do cliente, como `get_team_slots`).
 */
export function demoStaffSlots(
  demo: DemoState,
  staffId: string,
  day: string,
  serviceId: string,
  timeZone: string,
  options: { team?: boolean } = {},
) {
  const terms = demoServiceTerms(demo, staffId, serviceId);
  if (!terms) return [];
  const occupied = demo.appointments.filter(
    (row) =>
      row.staff_id === staffId &&
      row.status !== "cancelled" &&
      row.status !== "reschedule_requested",
  );
  const blocks = demo.availabilityBlocks.filter(
    (row) => row.staff_id === null || row.staff_id === staffId,
  );
  // O dia da semana vem da data escolhida, não do fuso do aparelho.
  const weekday = weekdayForDateKey(day);
  const hours = demo.businessHours.find((row) => row.weekday === weekday) ?? null;
  // Preparo depois de cada serviço: o do serviço, senão o da barbearia.
  const prepFor = (id: string | null) =>
    validPrepMinutes(
      demo.services.find((row) => row.id === id)?.prep_minutes ?? demo.settings.prep_minutes,
    );
  return buildSlotsForWindow(
    day,
    terms.duration_minutes,
    [
      ...occupied.map((row) => ({ ...row, prep_minutes: prepFor(row.service_id) })),
      ...demo.waits.filter((w) => blocksSlot(w, demo.now) && w.staff_id === staffId),
    ],
    hours,
    demo.now,
    timeZone,
    {
      ...slotRuleFromSettings(demo.settings),
      ...(options.team ? { leadMinutes: 0 } : {}),
      prepMinutes: prepFor(serviceId),
      blocks,
    },
  );
}
