import type { PrivacyRequest } from "../insights/DataRights";
import { validateOccurrence, type Occurrence } from "../insights/occurrences.ts";
import { defaultPrivacy, type PrivacyPreferences, type Survey } from "../insights/model.ts";
import type { Tables } from "@/integrations/supabase/types";
import {
  advanceWaits,
  disableWaits,
  withdrawDemo,
  waitingDemoAction,
  type DemoWait,
} from "../waiting/demo.ts";
import { blocksSlot, type WaitAction, type WaitingEvent } from "../waiting/model.ts";

export const DEMO_CUSTOMER_ID = "demo-customer";

export type DemoState = {
  waits: DemoWait[];
  waitingEvents: WaitingEvent[];
  settings: Tables<"barbershop_settings">;
  cancellationReasons: Record<string, { reason: string | null; source: "customer" | "shop" }>;
  attendance: Record<string, Occurrence>;
  prices: Record<string, number>;
  privacy: PrivacyPreferences;
  surveys: Survey[];
  lastSurveyAt: string | null;
  privacyRequests: PrivacyRequest[];
  now: Date;
  customers: { id: string; name: string }[];
  customerId: string;
  shop: Tables<"barbershops">;
  services: Tables<"services">[];
  staff: Tables<"staff">[];
  appointments: Tables<"appointments">[];
  businessHours: Tables<"business_hours">[];
  availabilityBlocks: Tables<"availability_blocks">[];
  customerName: string;
  points: number;
  awarded: string[];
};

export type DemoShopPreset = {
  shop: Tables<"barbershops">;
  settings: Tables<"barbershop_settings">;
  services: Tables<"services">[];
  staff: Tables<"staff">[];
  businessHours: Tables<"business_hours">[];
};

export function createDemoState(date = new Date(), preset?: DemoShopPreset): DemoState {
  const now = new Date(date);
  now.setHours(9, 0, 0, 0);
  const stamp = now.toISOString();
  const shopId = "demo-shop";
  const common = { barbershop_id: shopId, active: true, created_at: stamp, updated_at: stamp };
  const time = (hour: number, minute = 0) => {
    const value = new Date(now);
    if (value.getDay() === 0) value.setDate(value.getDate() + 1);
    value.setHours(hour, minute, 0, 0);
    return value.toISOString();
  };
  const firstNames = [
    "Rafael",
    "Lucas",
    "Pedro",
    "Miguel",
    "Arthur",
    "Gabriel",
    "João",
    "Matheus",
    "Bruno",
    "Diego",
    "André",
    "Felipe",
    "Daniel",
    "Caio",
    "Thiago",
    "Vitor",
    "Enzo",
    "Davi",
    "Gustavo",
    "Henrique",
  ];
  const surnames = [
    "Lima",
    "Santos",
    "Oliveira",
    "Costa",
    "Souza",
    "Almeida",
    "Ribeiro",
    "Martins",
    "Rocha",
    "Barbosa",
  ];
  const offset = Math.floor(Math.random() * 200);
  const customers = Array.from({ length: 200 }, (_, index) => {
    const variant = (index + offset) % 200;
    return {
      id:
        index === 0
          ? DEMO_CUSTOMER_ID
          : index === 1
            ? "demo-other-customer"
            : `demo-customer-${index}`,
      name: `${firstNames[variant % 20]} ${surnames[Math.floor(variant / 20)]} (demo)`,
    };
  });
  const state: DemoState = {
    waits: [],
    waitingEvents: [],
    settings: {
      barbershop_id: shopId,
      display_name: "Arena Barber",
      logo_url: null,
      logo_background_color: null,
      login_image_url: null,
      login_layout: "split",
      font_family: "inter",
      custom_font_url: null,
      custom_font_name: null,
      custom_font_faces: [],
      font_scope: "header",
      header_font_weight: 700,
      header_font_style: "normal",
      corner_style: "soft",
      floating_chrome: false,
      primary_color: "#292925",
      accent_color: "#8A602F",
      tagline: "Club & Lounge",
      booking_instructions: "Chegue 5 minutos antes para aproveitar seu atendimento com calma.",
      booking_horizon_days: 14,
      survey_program_enabled: true,
      sports_enabled: true,
      waiting_enabled: false,
      waiting_cutoff_minutes: 30,
      created_at: stamp,
      updated_at: stamp,
    },
    cancellationReasons: {},
    attendance: {},
    prices: {},
    privacy: { ...defaultPrivacy },
    surveys: [],
    lastSurveyAt: null,
    privacyRequests: [],
    now,
    customers,
    customerId: DEMO_CUSTOMER_ID,
    shop: {
      id: shopId,
      name: "Arena Barber · Demo",
      slug: "arena-demo",
      status: "active",
      timezone: "America/Sao_Paulo",
      created_at: stamp,
      updated_at: stamp,
    },
    services: [
      {
        ...common,
        id: "demo-cut",
        name: "Corte Tradicional",
        duration_minutes: 30,
        price_cents: 4500,
        icon: "Scissors",
      },
      {
        ...common,
        id: "demo-beard",
        name: "Barboterapia",
        duration_minutes: 45,
        price_cents: 6000,
        icon: "Droplet",
      },
      {
        ...common,
        id: "demo-combo",
        name: "Combo Premium",
        duration_minutes: 60,
        price_cents: 9000,
        icon: "Crown",
      },
    ],
    staff: [
      {
        ...common,
        id: "demo-carlos",
        display_name: "Mestre Carlão",
        user_id: null,
        booking_slug: "carlao",
        bio: "Especialista em cortes clássicos e degradê. Mais de 15 anos de barbearia.",
        avatar_url: null,
      },
      {
        ...common,
        id: "demo-bruno",
        display_name: "Bruno Oliveira",
        user_id: null,
        booking_slug: "bruno",
        bio: "Focado em barboterapia e acabamento. Atendimento de precisão.",
        avatar_url: null,
      },
    ],
    appointments: [
      {
        id: "demo-booking-1",
        barbershop_id: shopId,
        customer_id: DEMO_CUSTOMER_ID,
        service_id: "demo-cut",
        staff_id: "demo-carlos",
        starts_at: time(10),
        ends_at: time(10, 30),
        status: "confirmed",
        booked_price_cents: 5000,
        public_token: "demo-token-1",
        series_id: null,
        created_at: stamp,
        updated_at: stamp,
      },
      {
        id: "demo-booking-2",
        barbershop_id: shopId,
        customer_id: "demo-other-customer",
        service_id: "demo-combo",
        staff_id: "demo-bruno",
        starts_at: time(11),
        ends_at: time(12),
        status: "confirmed",
        booked_price_cents: 9000,
        public_token: "demo-token-2",
        series_id: null,
        created_at: stamp,
        updated_at: stamp,
      },
    ],
    businessHours: Array.from({ length: 7 }, (_, weekday) => ({
      id: `demo-hours-${weekday}`,
      barbershop_id: shopId,
      weekday,
      is_open: weekday !== 0,
      opens_at: "09:00:00",
      closes_at: "19:00:00",
      created_at: stamp,
      updated_at: stamp,
    })),
    availabilityBlocks: [],
    customerName: customers[0].name,
    points: 250,
    awarded: [],
  };
  if (preset) {
    state.shop = { ...preset.shop, name: `${preset.shop.name} · Demo`, status: "active" };
    state.settings = { ...preset.settings, sports_enabled: true };
    if (preset.services.length) state.services = preset.services.map((row) => ({ ...row }));
    if (preset.staff.length) state.staff = preset.staff.map((row) => ({ ...row }));
    if (preset.businessHours.length) {
      state.businessHours = preset.businessHours.map((row) => ({ ...row }));
    }
    const firstService = state.services[0]!;
    const firstStaff = state.staff[0]!;
    state.appointments = state.appointments.map((row, index) => ({
      ...row,
      barbershop_id: preset.shop.id,
      service_id: state.services[index % state.services.length]?.id ?? firstService.id,
      staff_id: state.staff[index % state.staff.length]?.id ?? firstStaff.id,
    }));
  }
  // One-hour slots keep every service inside opening hours and avoid overlaps.
  // A janela de 120 dias para trás garante visitas recorrentes suficientes para
  // o "ritmo" (frequência de retorno) ter dados na demonstração.
  const slots: { start: Date; staffId: string }[] = [];
  for (let day = -120; day <= 13; day++) {
    const start = new Date(now);
    start.setDate(start.getDate() + day);
    if (start.getDay() === 0) continue;
    for (let hour = 9; hour < 19; hour++) {
      start.setHours(hour, 0, 0, 0);
      for (const member of state.staff) {
        if (
          state.appointments.some(
            (row) =>
              row.staff_id === member.id &&
              new Date(row.starts_at).getTime() < start.getTime() + 3600000 &&
              new Date(row.ends_at) > start,
          )
        )
          continue;
        slots.push({ start: new Date(start), staffId: member.id });
      }
    }
  }

  // Agrupa os horários livres do PASSADO por dia para montar históricos com
  // intervalos realistas. Os horários futuros ficam em um pool separado, para
  // nunca haver sobreposição entre uma visita passada e uma reserva futura.
  const pastSlots = slots.filter((slot) => slot.start < now);
  const futureSlots = slots.filter((slot) => slot.start >= now);
  const slotsByDay = new Map<string, { start: Date; staffId: string }[]>();
  for (const slot of pastSlots) {
    const key = slot.start.toISOString().slice(0, 10);
    const list = slotsByDay.get(key);
    if (list) list.push(slot);
    else slotsByDay.set(key, [slot]);
  }
  const dayKeys = [...slotsByDay.keys()].sort();

  const claimSlotOn = (target: Date): { start: Date; staffId: string } | null => {
    const targetKey = target.toISOString().slice(0, 10);
    const direct = slotsByDay.get(targetKey);
    if (direct && direct.length) return direct.shift()!;
    const targetIndex = dayKeys.indexOf(targetKey);
    for (let distance = 1; distance < dayKeys.length; distance++) {
      for (const sign of [-1, 1]) {
        const key = dayKeys[targetIndex + sign * distance];
        const list = key ? slotsByDay.get(key) : undefined;
        if (list && list.length) return list.shift()!;
      }
    }
    return null;
  };

  // Cada cliente recebe um histórico de 4 a 6 visitas concluídas, com cadência
  // de retorno própria (10 a 25 dias), e uma reserva futura confirmada.
  let futureCursor = 0;
  customers.forEach((customer, index) => {
    const visitCount = 4 + (index % 3); // 4–6 visitas
    const intervalDays = 10 + (index % 16); // 10–25 dias entre visitas
    for (let visit = 0; visit < visitCount; visit++) {
      const date = new Date(now);
      date.setDate(date.getDate() - intervalDays * (visitCount - 1 - visit));
      if (date.getDay() === 0) date.setDate(date.getDate() + 1);
      const slot = claimSlotOn(date);
      if (!slot) continue;
      const service = state.services[Math.floor(Math.random() * state.services.length)];
      state.appointments.push({
        id: `demo-generated-${index}-${visit}`,
        barbershop_id: state.shop.id,
        customer_id: customer.id,
        service_id: service.id,
        staff_id: slot.staffId,
        starts_at: slot.start.toISOString(),
        ends_at: new Date(slot.start.getTime() + service.duration_minutes * 60000).toISOString(),
        status: "completed",
        booked_price_cents: service.price_cents,
        created_at: stamp,
        updated_at: stamp,
      });
    }
    const future = futureSlots[futureCursor++ % futureSlots.length];
    if (future) {
      const service = state.services[Math.floor(Math.random() * state.services.length)];
      state.appointments.push({
        id: `demo-generated-${index}-upcoming`,
        barbershop_id: state.shop.id,
        customer_id: customer.id,
        service_id: service.id,
        staff_id: future.staffId,
        starts_at: future.start.toISOString(),
        ends_at: new Date(future.start.getTime() + service.duration_minutes * 60000).toISOString(),
        status: "confirmed",
        booked_price_cents: service.price_cents,
        created_at: stamp,
        updated_at: stamp,
      });
    }
  });
  state.prices = Object.fromEntries(
    state.appointments.map((row) => [
      row.id,
      state.services.find((service) => service.id === row.service_id)!.price_cents,
    ]),
  );
  state.awarded = state.appointments
    .filter((row) => row.status === "completed")
    .map((row) => row.id);
  state.points +=
    state.appointments.filter(
      (row) => row.status === "completed" && row.customer_id === DEMO_CUSTOMER_ID,
    ).length * 50;
  return state;
}

export type DemoAction =
  | { type: "survey.record"; survey: Survey }
  | { type: "cancel"; id: string; reason: string | null; source: "customer" | "shop" }
  | { type: "privacy.request"; status: PrivacyRequest["status"]; id?: string }
  | { type: "attendance"; id: string; stage: "arrived_at" | "started_at" | "no_show_at" }
  | {
      type: "occurrence";
      id: string;
      customer: number | null;
      shop: number | null;
      noShow: boolean;
    }
  | { type: "privacy.save"; preferences: PrivacyPreferences }
  | { type: "privacy.erase" }
  | { type: "survey.show"; survey: Survey }
  | { type: "survey.answer"; id: string; answer: string | null }
  | { type: "staff.delete"; id: string }
  | { type: "service.delete"; id: string }
  | { type: "service.edit"; service: Tables<"services"> }
  | { type: "staff.edit"; staff: Tables<"staff"> }
  | { type: "profile.save"; name: string }
  | { type: "book"; appointment: Tables<"appointments"> }
  | {
      type: "reschedule";
      id: string;
      starts_at: string;
      ends_at: string;
      service_id: string;
      staff_id: string;
    }
  | { type: "status"; id: string; status: Tables<"appointments">["status"] }
  | { type: "service.add"; service: Tables<"services"> }
  | { type: "service.toggle"; id: string }
  | { type: "staff.add"; staff: Tables<"staff"> }
  | { type: "staff.toggle"; id: string }
  | { type: "hours.save"; hours: Tables<"business_hours">[] }
  | { type: "block.add"; block: Tables<"availability_blocks"> }
  | { type: "block.delete"; id: string }
  | { type: "settings.save"; settings: Tables<"barbershop_settings"> }
  | { type: "shop.update"; shop: Partial<Pick<Tables<"barbershops">, "name" | "status">> }
  | { type: "clock.advance"; milliseconds: number }
  | { type: "waiting.action"; id: string; action: WaitAction; serviceId?: string };

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  state = advanceWaits(state);
  switch (action.type) {
    case "clock.advance":
      return advanceWaits({ ...state, now: new Date(+state.now + action.milliseconds) });
    case "waiting.action":
      return waitingDemoAction(state, action.id, action.action, action.serviceId);
    case "survey.record":
      return state.privacy.surveys
        ? {
            ...state,
            lastSurveyAt: action.survey.shown_at,
            surveys: [...state.surveys, action.survey],
          }
        : state;
    case "cancel":
      return {
        ...state,
        waits: state.waits.map((w) =>
          w.appointment_id === action.id ? { ...w, restorable: false } : w,
        ),
        cancellationReasons: {
          ...state.cancellationReasons,
          [action.id]: { reason: action.reason, source: action.source },
        },
        appointments: state.appointments.map((row) =>
          row.id === action.id &&
          (row.status === "pending" ||
            row.status === "confirmed" ||
            row.status === "reschedule_requested")
            ? { ...row, status: "cancelled" }
            : row,
        ),
      };
    case "privacy.request": {
      if (action.status === "requested") {
        if (state.privacyRequests.some((row) => row.status !== "cancelled")) return state;
        const stamp = state.now.toISOString();
        return {
          ...state,
          privacyRequests: [
            ...state.privacyRequests,
            {
              id: crypto.randomUUID(),
              user_id: state.customerId,
              status: "requested",
              created_at: stamp,
              updated_at: stamp,
            },
          ],
        };
      }
      return {
        ...state,
        privacyRequests: state.privacyRequests.map((row) =>
          row.id === action.id && row.status !== "cancelled"
            ? { ...row, status: action.status, updated_at: state.now.toISOString() }
            : row,
        ),
      };
    }
    case "occurrence": {
      const row = state.appointments.find((item) => item.id === action.id);
      if (!row) return state;
      validateOccurrence(
        row,
        state.attendance[action.id] ?? {},
        action.customer,
        action.shop,
        action.noShow,
        state.now,
      );
      return {
        ...state,
        attendance: {
          ...state.attendance,
          [action.id]: {
            ...state.attendance[action.id],
            customer_delay_minutes: action.customer,
            shop_delay_minutes: action.shop,
            no_show_at: action.noShow ? state.now.toISOString() : null,
            occurrence_updated_at: state.now.toISOString(),
            occurrence_recorded_by: "demo-admin",
          },
        },
        appointments: action.noShow
          ? state.appointments.map((item) =>
              item.id === action.id ? { ...item, status: "cancelled" as const } : item,
            )
          : state.appointments,
      };
    }
    case "attendance":
      return {
        ...state,
        attendance: {
          ...state.attendance,
          [action.id]: { ...state.attendance[action.id], [action.stage]: state.now.toISOString() },
        },
        appointments:
          action.stage === "no_show_at"
            ? state.appointments.map((row) =>
                row.id === action.id ? { ...row, status: "cancelled" } : row,
              )
            : state.appointments,
      };
    case "privacy.save":
      return { ...state, privacy: { ...action.preferences } };
    case "privacy.erase":
      return { ...state, privacy: { ...defaultPrivacy }, surveys: [] };
    case "survey.show":
      return state.privacy.surveys
        ? {
            ...state,
            lastSurveyAt: action.survey.shown_at,
            surveys: [...state.surveys, action.survey],
          }
        : state;
    case "survey.answer":
      return state.privacy.surveys
        ? {
            ...state,
            surveys: state.surveys.map((row) =>
              row.id === action.id
                ? {
                    ...row,
                    answer: action.answer,
                    state: action.answer === null ? "dismissed" : "answered",
                  }
                : row,
            ),
          }
        : state;

    case "staff.delete":
      return state.appointments.some((row) => row.staff_id === action.id)
        ? state
        : {
            ...state,
            staff: state.staff.filter((row) => row.id !== action.id),
            availabilityBlocks: state.availabilityBlocks.filter(
              (row) => row.staff_id !== action.id,
            ),
          };
    case "service.delete":
      return state.appointments.some((row) => row.service_id === action.id)
        ? state
        : { ...state, services: state.services.filter((row) => row.id !== action.id) };
    case "service.edit":
      return {
        ...state,
        services: state.services.map((row) =>
          row.id === action.service.id ? action.service : row,
        ),
      };
    case "staff.edit":
      return {
        ...state,
        staff: state.staff.map((row) => (row.id === action.staff.id ? action.staff : row)),
      };
    case "profile.save":
      return {
        ...state,
        customerName: action.name,
        customers: state.customers.map((customer) =>
          customer.id === state.customerId ? { ...customer, name: action.name } : customer,
        ),
      };
    case "book":
      if (
        state.waits.some(
          (w) =>
            blocksSlot(w, state.now) &&
            w.staff_id === action.appointment.staff_id &&
            w.starts_at < action.appointment.ends_at &&
            w.ends_at > action.appointment.starts_at,
        )
      )
        return state;
      return {
        ...state,
        prices: {
          ...state.prices,
          [action.appointment.id]:
            state.services.find((row) => row.id === action.appointment.service_id)?.price_cents ??
            0,
        },
        appointments: [...state.appointments, { ...action.appointment, status: "confirmed" }],
      };
    case "reschedule":
      if (
        state.waits.some(
          (w) =>
            blocksSlot(w, state.now) &&
            w.staff_id === action.staff_id &&
            w.starts_at < action.ends_at &&
            w.ends_at > action.starts_at,
        )
      )
        return state;
      return {
        ...state,
        waits: state.waits.map((w) =>
          w.appointment_id === action.id ? { ...w, restorable: false } : w,
        ),
        appointments: state.appointments.map((row) =>
          row.id === action.id
            ? {
                ...row,
                starts_at: action.starts_at,
                ends_at: action.ends_at,
                service_id: action.service_id,
                staff_id: action.staff_id,
                status: "confirmed",
              }
            : row,
        ),
      };
    case "status": {
      const appointment = state.appointments.find((row) => row.id === action.id);
      if (!appointment) return state;
      if (action.status === "reschedule_requested") return withdrawDemo(state, action.id);
      if (
        ["pending", "confirmed", "completed"].includes(action.status) &&
        state.waits.some(
          (w) =>
            blocksSlot(w, state.now) &&
            w.staff_id === appointment.staff_id &&
            w.starts_at < appointment.ends_at &&
            w.ends_at > appointment.starts_at,
        )
      )
        return state;
      if (action.status === "completed" && state.attendance[action.id]?.no_show_at) return state;
      const award = action.status === "completed" && !state.awarded.includes(action.id);
      return {
        ...state,
        appointments: state.appointments.map((row) =>
          row.id === action.id ? { ...row, status: action.status } : row,
        ),
        points: state.points + (award && appointment.customer_id === DEMO_CUSTOMER_ID ? 50 : 0),
        awarded: award ? [...state.awarded, action.id] : state.awarded,
      };
    }
    case "service.add":
      return { ...state, services: [...state.services, action.service] };
    case "service.toggle":
      return {
        ...state,
        services: state.services.map((row) =>
          row.id === action.id ? { ...row, active: !row.active } : row,
        ),
      };
    case "staff.add":
      return { ...state, staff: [...state.staff, action.staff] };
    case "staff.toggle":
      return {
        ...state,
        staff: state.staff.map((row) =>
          row.id === action.id ? { ...row, active: !row.active } : row,
        ),
      };
    case "hours.save":
      return { ...state, businessHours: action.hours };
    case "shop.update":
      return {
        ...state,
        shop: { ...state.shop, ...action.shop, updated_at: state.now.toISOString() },
      };
    case "settings.save":
      if (
        !Number.isInteger(action.settings.waiting_cutoff_minutes) ||
        action.settings.waiting_cutoff_minutes < 0 ||
        action.settings.waiting_cutoff_minutes > 1440
      )
        return state;
      return {
        ...(state.settings.waiting_enabled && !action.settings.waiting_enabled
          ? disableWaits(state)
          : state),
        settings: action.settings,
      };
    case "block.add":
      return { ...state, availabilityBlocks: [...state.availabilityBlocks, action.block] };
    case "block.delete":
      return {
        ...state,
        availabilityBlocks: state.availabilityBlocks.filter((row) => row.id !== action.id),
      };
  }
}
