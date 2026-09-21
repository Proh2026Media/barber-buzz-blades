import type { DemoState } from "../demo/model";
import { blocksSlot, canHold, type SlotWait, type WaitAction, type WaitingEvent } from "./model.ts";

export type DemoWait = SlotWait & { customer_id: string | null; original_customer_id: string };
function event(state: DemoState, w: DemoWait, kind: string): WaitingEvent[] {
  if (!w.customer_id) return state.waitingEvents;
  const id = `${w.id}:${w.customer_id}:${kind}`;
  if (state.waitingEvents.some((e) => e.id === id)) return state.waitingEvents;
  return [
    ...state.waitingEvents,
    {
      id,
      wait_id: w.id,
      user_id: w.customer_id,
      kind,
      starts_at: w.starts_at,
      created_at: state.now.toISOString(),
      deadline: kind === "exclusive" ? w.claim_until : null,
    },
  ];
}
export function advanceWaits(state: DemoState): DemoState {
  let next = state;
  for (const w of state.waits) {
    if (!["holding", "exclusive"].includes(w.state) || Date.parse(w.hold_until) > +state.now)
      continue;
    const expired =
      !w.customer_id ||
      Date.parse(w.claim_until) <= +state.now ||
      Date.parse(w.starts_at) <= +state.now;
    const status = expired ? "released" : "exclusive";
    if (status === w.state) continue;
    next = {
      ...next,
      waits: next.waits.map((row) => (row.id === w.id ? { ...row, state: status } : row)),
      waitingEvents: event(next, w, expired ? "expired" : "exclusive"),
    };
  }
  return next;
}
export function disableWaits(state: DemoState): DemoState {
  let next = state;
  for (const w of state.waits.filter((row) => ["holding", "exclusive"].includes(row.state))) {
    next = {
      ...next,
      waits: next.waits.map((row) => (row.id === w.id ? { ...row, state: "disabled" } : row)),
      waitingEvents: event(next, w, "disabled"),
    };
  }
  return next;
}
export function withdrawDemo(state: DemoState, id: string): DemoState {
  const a = state.appointments.find((row) => row.id === id);
  if (!a || a.status !== "confirmed") return state;
  const next = {
    ...state,
    appointments: state.appointments.map((row) =>
      row.id === id ? { ...row, status: "reschedule_requested" as const } : row,
    ),
  };
  if (
    !canHold(
      a.starts_at,
      state.now,
      state.settings.waiting_enabled,
      state.settings.waiting_cutoff_minutes,
    )
  )
    return next;
  return {
    ...next,
    waits: [
      ...state.waits,
      {
        id: crypto.randomUUID(),
        appointment_id: id,
        staff_id: a.staff_id,
        starts_at: a.starts_at,
        ends_at: a.ends_at,
        hold_until: new Date(+state.now + 600000).toISOString(),
        claim_until: new Date(+state.now + 900000).toISOString(),
        state: "holding",
        mine: false,
        has_interest: false,
        restorable: true,
        service_id: null,
        customer_id: null,
        original_customer_id: a.customer_id,
      },
    ],
  };
}
export function waitingDemoAction(
  input: DemoState,
  id: string,
  action: WaitAction,
  serviceId?: string,
): DemoState {
  const state = advanceWaits(input);
  const w = state.waits.find((row) => row.id === id);
  if (!w || !blocksSlot(w, state.now) || Date.parse(w.starts_at) <= +state.now)
    throw new Error("A espera já foi encerrada.");
  const change = (changes: Partial<DemoWait>, kind?: string) => ({
    ...state,
    waits: state.waits.map((row) => (row.id === id ? { ...row, ...changes } : row)),
    waitingEvents: kind ? event(state, w, kind) : state.waitingEvents,
  });
  if (action === "join") {
    const s = state.services.find((row) => row.id === serviceId && row.active);
    if (
      w.customer_id ||
      Date.parse(w.hold_until) <= +state.now ||
      w.original_customer_id === state.customerId
    )
      throw new Error("Esta vaga não está disponível para entrar na espera.");
    if (
      !s ||
      s.duration_minutes * 60000 > Date.parse(w.ends_at) - Date.parse(w.starts_at) ||
      !state.staff.some((row) => row.id === w.staff_id && row.active)
    )
      throw new Error("Serviço indisponível para este intervalo.");
    return change({
      customer_id: state.customerId,
      mine: true,
      has_interest: true,
      service_id: s.id,
    });
  }
  if (action === "restore") {
    const a = state.appointments.find((row) => row.id === w.appointment_id);
    if (
      !w.restorable ||
      Date.parse(w.hold_until) <= +state.now ||
      a?.status !== "reschedule_requested" ||
      a.starts_at !== w.starts_at ||
      a.staff_id !== w.staff_id
    )
      throw new Error("A reserva original não pode mais ser restaurada.");
    return {
      ...change({ state: "restored" }, "restored"),
      appointments: state.appointments.map((row) =>
        row.id === w.appointment_id ? { ...row, status: "confirmed" } : row,
      ),
    };
  }
  if (w.customer_id !== state.customerId) throw new Error("Esta espera pertence a outro cliente.");
  if (action === "leave")
    return change(
      Date.parse(w.hold_until) > +state.now
        ? { customer_id: null, service_id: null, mine: false, has_interest: false }
        : { state: "released" },
      "left",
    );
  if (Date.parse(w.hold_until) > +state.now || Date.parse(w.claim_until) <= +state.now)
    throw new Error("A vaga ainda não foi liberada ou o prazo terminou.");
  const s = state.services.find((row) => row.id === w.service_id && row.active);
  if (
    !s ||
    s.duration_minutes * 60000 > Date.parse(w.ends_at) - Date.parse(w.starts_at) ||
    !state.staff.some((row) => row.id === w.staff_id && row.active)
  )
    throw new Error("Serviço ou profissional indisponível.");
  const end = new Date(Date.parse(w.starts_at) + s.duration_minutes * 60000).toISOString();
  const hours = state.businessHours.find((row) => row.weekday === new Date(w.starts_at).getDay());
  const time = (value: string) => new Date(value).toTimeString().slice(0, 5);
  if (
    !hours?.is_open ||
    time(w.starts_at) < hours.opens_at.slice(0, 5) ||
    time(end) > hours.closes_at.slice(0, 5) ||
    state.availabilityBlocks.some(
      (row) =>
        (!row.staff_id || row.staff_id === w.staff_id) &&
        row.starts_at < end &&
        row.ends_at > w.starts_at,
    )
  )
    throw new Error("O horário não está mais disponível.");
  const appointmentId = crypto.randomUUID();
  return {
    ...change({ state: "claimed" }, "claimed"),
    prices: { ...state.prices, [appointmentId]: s.price_cents },
    appointments: [
      ...state.appointments,
      {
        id: appointmentId,
        barbershop_id: state.shop.id,
        customer_id: state.customerId,
        service_id: s.id,
        staff_id: w.staff_id,
        starts_at: w.starts_at,
        ends_at: end,
        status: "confirmed",
        booked_price_cents: s.price_cents,
        created_at: state.now.toISOString(),
        updated_at: state.now.toISOString(),
      },
    ],
  };
}
