import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEMO_ASSOCIATE_STAFF_ID,
  DEMO_EMPLOYEE_STAFF_ID,
  DEMO_PEER_OWNER,
  demoTeam,
  demoViewer,
} from "./team.ts";
import { createDemoState, DEMO_REWARDS, demoLifetimePoints, demoReducer } from "./model.ts";

test("demo starts during business hours even when opened late at night", () => {
  const state = createDemoState(new Date(2030, 0, 15, 23, 45));
  assert.equal(state.now.getHours(), 9);
  assert.equal(state.now.getDate(), 15);
  assert.equal(
    state.points,
    250 +
      state.appointments.filter(
        (row) => row.customer_id === state.customerId && row.status === "completed",
      ).length *
        50,
  );
});

test("completing a demo booking twice awards points only once", () => {
  const initial = createDemoState();
  const completed = demoReducer(initial, {
    type: "status",
    id: "demo-booking-1",
    status: "completed",
  });
  const reopened = demoReducer(completed, {
    type: "status",
    id: "demo-booking-1",
    status: "confirmed",
  });
  const repeated = demoReducer(reopened, {
    type: "status",
    id: "demo-booking-1",
    status: "completed",
  });
  assert.equal(repeated.points, initial.points + 50);
  assert.equal(repeated.awarded.length, initial.awarded.length + 1);
  assert.ok(initial.points >= 250);
  assert.equal(initial.appointments[0].status, "confirmed");
});

test("another customer's completion does not change the preview customer's balance", () => {
  const initial = createDemoState();
  const result = demoReducer(initial, {
    type: "status",
    id: "demo-booking-2",
    status: "completed",
  });
  assert.equal(result.points, initial.points);
});

test("rescheduling keeps the same appointment and automatically confirms it", () => {
  const initial = demoReducer(createDemoState(), {
    type: "status",
    id: "demo-booking-1",
    status: "confirmed",
  });
  const result = demoReducer(initial, {
    type: "reschedule",
    id: "demo-booking-1",
    service_id: "demo-combo",
    staff_id: "demo-bruno",
    starts_at: "2030-01-16T15:00:00.000Z",
    ends_at: "2030-01-16T16:00:00.000Z",
  });
  assert.equal(result.appointments.length, initial.appointments.length);
  assert.deepEqual(
    result.appointments.find((row) => row.id === "demo-booking-1"),
    expectAppointment({
      ...initial.appointments.find((row) => row.id === "demo-booking-1")!,
      service_id: "demo-combo",
      staff_id: "demo-bruno",
      starts_at: "2030-01-16T15:00:00.000Z",
      ends_at: "2030-01-16T16:00:00.000Z",
      status: "confirmed",
    }),
  );
});

test("demo saves hours and manages availability blocks", () => {
  const initial = createDemoState();
  const sunday = { ...initial.businessHours[0], is_open: true };
  const withHours = demoReducer(initial, {
    type: "hours.save",
    hours: [sunday, ...initial.businessHours.slice(1)],
  });
  const block = {
    id: "demo-block",
    barbershop_id: initial.shop.id,
    staff_id: null,
    starts_at: "2030-01-20T15:00:00.000Z",
    ends_at: "2030-01-20T16:00:00.000Z",
    reason: "Feriado",
    created_at: initial.now.toISOString(),
  };
  const withBlock = demoReducer(withHours, { type: "block.add", block });
  const removed = demoReducer(withBlock, { type: "block.delete", id: block.id });
  assert.equal(withHours.businessHours[0].is_open, true);
  assert.equal(withBlock.availabilityBlocks.length, 1);
  assert.equal(removed.availabilityBlocks.length, 0);
});

function expectAppointment<T>(value: T) {
  return value;
}

test("demo generates 200 unique customers with bookings inside business hours and no staff overlaps", () => {
  const state = createDemoState(new Date(2030, 0, 15));
  assert.equal(state.customers.length, 200);
  assert.equal(new Set(state.customers.map((row) => row.id)).size, 200);
  assert.equal(new Set(state.customers.map((row) => row.name)).size, 200);
  for (const customer of state.customers) {
    assert.ok(state.appointments.some((row) => row.customer_id === customer.id));
  }
  const generated = state.appointments.filter((row) => row.id.startsWith("demo-generated-"));
  for (const row of generated) {
    const start = new Date(row.starts_at);
    const end = new Date(row.ends_at);
    assert.notEqual(start.getDay(), 0);
    assert.ok(start.getHours() >= 9 && end.getHours() <= 19);
    assert.ok(end > start);
    assert.ok(
      !state.appointments.some(
        (other) =>
          other.id !== row.id &&
          other.staff_id === row.staff_id &&
          new Date(other.starts_at) < end &&
          new Date(other.ends_at) > start,
      ),
    );
  }
});

test("new demo scenarios vary and remain isolated", () => {
  const first = createDemoState(new Date(2030, 0, 15));
  const second = createDemoState(new Date(2030, 0, 15));
  assert.notDeepEqual(first.appointments, second.appointments);
  first.customers[0].name = "Changed";
  assert.notEqual(second.customers[0].name, "Changed");
});

test("Sunday demo bookings respect the closed day", () => {
  const state = createDemoState(new Date(2030, 0, 20));
  assert.equal(state.now.getDay(), 0);
  assert.ok(state.appointments.every((row) => new Date(row.starts_at).getDay() !== 0));
});

test("seeded completed appointments cannot award points twice", () => {
  const state = createDemoState(new Date(2030, 0, 15));
  const completed = state.appointments.find((row) => row.status === "completed")!;
  assert.ok(completed);
  const result = demoReducer(state, { type: "status", id: completed.id, status: "completed" });
  assert.equal(result.points, state.points);
  assert.deepEqual(result.awarded, state.awarded);
});

test("profile changes also update the demo customer directory", () => {
  const state = demoReducer(createDemoState(), { type: "profile.save", name: "Nome atualizado" });
  assert.equal(state.customerName, "Nome atualizado");
  assert.equal(
    state.customers.find((row) => row.id === state.customerId)?.name,
    state.customerName,
  );
});

test("shop settings persist inside the demo workspace", () => {
  const initial = createDemoState();
  const settings = {
    ...initial.settings,
    display_name: "Barbearia do Bairro",
    logo_url: "data:image/svg+xml;base64,PHN2Zy8+",
    font_family: "manrope",
    custom_font_url: "data:font/woff2;base64,AA==",
    custom_font_name: "Arena Display",
    custom_font_faces: [
      {
        url: "data:font/woff2;base64,AA==",
        file_name: "ArenaDisplay-Regular.woff2",
        weight: 400,
        style: "normal",
      },
      {
        url: "data:font/woff2;base64,BB==",
        file_name: "ArenaDisplay-Bold.woff2",
        weight: 700,
        style: "normal",
      },
    ],
    font_scope: "titles",
    corner_style: "round",
    floating_chrome: true,
    primary_color: "#123456",
    accent_color: "#D4A017",
    tagline: "Seu estilo, seu momento",
    booking_horizon_days: 30,
    survey_program_enabled: false,
  };
  const state = demoReducer(initial, { type: "settings.save", settings });
  assert.equal(state.settings.tagline, "Seu estilo, seu momento");
  assert.equal(state.settings.display_name, "Barbearia do Bairro");
  assert.equal(state.settings.logo_url, "data:image/svg+xml;base64,PHN2Zy8+");
  assert.equal(state.settings.font_family, "manrope");
  assert.equal(state.settings.custom_font_url, "data:font/woff2;base64,AA==");
  assert.equal(state.settings.custom_font_name, "Arena Display");
  assert.equal(Array.isArray(state.settings.custom_font_faces), true);
  assert.equal(state.settings.font_scope, "titles");
  assert.equal(state.settings.corner_style, "round");
  assert.equal(state.settings.floating_chrome, true);
  assert.equal(state.settings.primary_color, "#123456");
  assert.equal(state.settings.accent_color, "#D4A017");
  assert.equal(state.settings.booking_horizon_days, 30);
  assert.equal(state.settings.survey_program_enabled, false);
  assert.equal(initial.settings.booking_horizon_days, 14);
  assert.equal(initial.settings.floating_chrome, false);
});

test("withdrawal keeps reservation editable and a reschedule confirms it again", () => {
  const initial = createDemoState();
  const row = initial.appointments[0];
  const withdrawn = demoReducer(initial, {
    type: "status",
    id: row.id,
    status: "reschedule_requested",
  });
  assert.equal(withdrawn.appointments[0].status, "reschedule_requested");
  assert.equal(withdrawn.points, initial.points);
  const result = demoReducer(withdrawn, {
    type: "reschedule",
    id: row.id,
    service_id: row.service_id,
    staff_id: row.staff_id,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
  });
  assert.equal(result.appointments[0].status, "confirmed");
  const cancelled = demoReducer(withdrawn, {
    type: "cancel",
    id: row.id,
    reason: null,
    source: "customer",
  });
  assert.equal(cancelled.appointments[0].status, "cancelled");
});

test("platform admin can suspend and rename the demo shop without touching real data", () => {
  const initial = createDemoState(new Date("2026-09-16T12:00:00"));
  const suspended = demoReducer(initial, { type: "shop.update", shop: { status: "suspended" } });
  assert.equal(suspended.shop.status, "suspended");
  assert.equal(suspended.shop.id, initial.shop.id);
  const renamed = demoReducer(suspended, { type: "shop.update", shop: { name: "Nova Arena" } });
  assert.equal(renamed.shop.name, "Nova Arena");
  assert.equal(renamed.shop.status, "suspended");
});

test("demo can copy one selected shop while keeping fictional customers and appointments", () => {
  const base = createDemoState(new Date("2026-09-16T12:00:00"));
  const selectedShopId = "selected-shop";
  const state = createDemoState(new Date("2026-09-16T12:00:00"), {
    shop: { ...base.shop, id: selectedShopId, name: "Barbearia Escolhida", slug: "escolhida" },
    settings: {
      ...base.settings,
      barbershop_id: selectedShopId,
      display_name: "Marca Escolhida",
      primary_color: "#123456",
    },
    services: base.services.slice(0, 2).map((row, index) => ({
      ...row,
      id: `selected-service-${index}`,
      barbershop_id: selectedShopId,
    })),
    staff: base.staff.slice(0, 1).map((row) => ({
      ...row,
      id: "selected-staff",
      barbershop_id: selectedShopId,
    })),
    businessHours: base.businessHours.map((row) => ({
      ...row,
      barbershop_id: selectedShopId,
    })),
  });

  // Aparência e catálogo vêm da loja escolhida; os ids são todos fictícios (decisão 11).
  assert.equal(state.shop.id, "demo-shop");
  assert.equal(state.shop.name, "Barbearia Escolhida · Demo");
  assert.equal(state.settings.display_name, "Marca Escolhida");
  assert.equal(state.settings.barbershop_id, "demo-shop");
  assert.equal(state.services.length, 2);
  // A equipe copiada mais os personagens próprios do Parceiro e do Contratado.
  assert.deepEqual(
    state.staff.map((row) => row.id),
    ["demo-staff-1", DEMO_ASSOCIATE_STAFF_ID, DEMO_EMPLOYEE_STAFF_ID],
  );
  assert.equal(state.customers.length, 200);
  assert.ok(state.customers.every((customer) => customer.id.startsWith("demo-")));
  assert.ok(state.appointments.every((appointment) => appointment.barbershop_id === "demo-shop"));
});

test("demo copied from a real shop never carries real ids", () => {
  const base = createDemoState(new Date("2026-09-16T12:00:00"));
  const realShop = "3f1c2b9a-0000-4000-8000-00000000abcd";
  const state = createDemoState(new Date("2026-09-16T12:00:00"), {
    shop: {
      ...base.shop,
      id: realShop,
      slug: "loja-real",
      custom_domain: "loja.com.br",
      custom_domain_status: "active",
    },
    settings: { ...base.settings, barbershop_id: realShop },
    services: [{ ...base.services[0]!, id: "real-service-uuid", barbershop_id: realShop }],
    staff: [
      { ...base.staff[0]!, id: "real-staff-uuid", barbershop_id: realShop, user_id: "real-user" },
    ],
    businessHours: base.businessHours.map((row) => ({
      ...row,
      id: `real-hours-${row.weekday}`,
      barbershop_id: realShop,
    })),
  });
  const text = JSON.stringify({
    shop: state.shop,
    settings: state.settings,
    services: state.services,
    staff: state.staff,
    hours: state.businessHours,
    appointments: state.appointments,
  });
  for (const real of [
    realShop,
    "real-service-uuid",
    "real-staff-uuid",
    "real-user",
    "real-hours-",
  ]) {
    assert.equal(text.includes(real), false, real);
  }
  assert.equal(state.shop.custom_domain, null);
  assert.notEqual(state.shop.slug, "loja-real");
});

test("demo partner keeps an own catalog and decides suggestions locally", () => {
  const initial = createDemoState(new Date("2026-09-16T12:00:00"));
  const service = initial.services[0]!;
  const staffId = initial.staff[0]!.id;
  const row = {
    id: "demo-own-1",
    barbershop_id: initial.shop.id,
    staff_id: staffId,
    service_id: service.id,
    display_name: null,
    duration_minutes: 40,
    price_cents: 5500,
    active: true,
    icon: null,
    created_at: initial.now.toISOString(),
    updated_at: initial.now.toISOString(),
  };
  let state = demoReducer(initial, { type: "staffService.save", row });
  state = demoReducer(state, { type: "staffService.save", row: { ...row, price_cents: 6000 } });
  assert.equal(state.staffServices.length, 1);
  assert.equal(state.staffServices[0]!.price_cents, 6000);
  // O catálogo da loja não muda quando o Parceiro personaliza o dele.
  assert.equal(state.services[0]!.price_cents, service.price_cents);
  state = demoReducer(state, { type: "suggestion.decide", id: "demo-suggestion-1" });
  state = demoReducer(state, { type: "suggestion.decide", id: "demo-suggestion-1" });
  assert.deepEqual(state.decidedSuggestions, ["demo-suggestion-1"]);
});

test("demo redemption reserves points and cancelling gives them back", () => {
  const start = createDemoState(new Date("2026-06-03T12:00:00"));
  const before = start.points;
  const redeemed = demoReducer(start, { type: "loyalty.redeem", rewardId: DEMO_REWARDS[0].id });
  assert.equal(redeemed.points, before - DEMO_REWARDS[0].cost_points);
  assert.equal(demoLifetimePoints(redeemed), before);
  const cancelled = demoReducer(redeemed, {
    type: "loyalty.cancel",
    id: redeemed.redemptions[0].id,
  });
  assert.equal(cancelled.points, before);
  assert.equal(cancelled.redemptions[0].status, "cancelled");
  const again = demoReducer(cancelled, { type: "loyalty.cancel", id: redeemed.redemptions[0].id });
  assert.equal(again.points, before);
});

test("demo redemption refuses rewards the customer cannot afford", () => {
  const start = { ...createDemoState(new Date("2026-06-03T12:00:00")), points: 10 };
  const next = demoReducer(start, { type: "loyalty.redeem", rewardId: DEMO_REWARDS[0].id });
  assert.equal(next.points, 10);
  assert.equal(next.redemptions.length, 0);
});

test("cada papel da equipe tem o próprio personagem e a sociedade de cada visão", () => {
  const state = createDemoState(new Date("2026-09-16T12:00:00"));
  const owner = state.staff[0]!;
  const associate = state.staff.find((row) => row.id === DEMO_ASSOCIATE_STAFF_ID)!;
  const employee = state.staff.find((row) => row.id === DEMO_EMPLOYEE_STAFF_ID)!;
  assert.notEqual(owner.id, associate.id);
  assert.notEqual(associate.id, employee.id);
  // Os personagens também atendem (têm horários na agenda fictícia).
  assert.ok(state.appointments.some((row) => row.staff_id === associate.id));
  const team = (view: Parameters<typeof demoTeam>[0]) =>
    demoTeam(view, { viewerId: "me", owner, associate, employee, stamp: state.now.toISOString() });
  const owners = (view: Parameters<typeof demoTeam>[0]) =>
    team(view)
      .filter((member) => member.role === "owner")
      .map((member) => [member.user_id, member.ownership_percent]);
  assert.deepEqual(owners("owner"), [["me", 100]]);
  assert.deepEqual(owners("equal"), [
    ["me", 50],
    [DEMO_PEER_OWNER.userId, 50],
  ]);
  assert.deepEqual(owners("minority"), [
    [DEMO_PEER_OWNER.userId, 70],
    ["me", 30],
  ]);
  // Parceiro e Contratado veem a si mesmos na equipe (e o dono fictício).
  assert.equal(team("associate").find((m) => m.user_id === "me")?.role, "associate");
  assert.equal(team("employee").find((m) => m.user_id === "me")?.role, "employee");
  assert.deepEqual(demoViewer("minority"), { role: "owner", percent: 30, staff: "owner" });
  assert.ok(team("equal").every((member) => member.id.startsWith("demo-")));
});
