import assert from "node:assert/strict";
import { test } from "node:test";
import { createDemoState, demoReducer } from "./model.ts";

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

  assert.equal(state.shop.id, selectedShopId);
  assert.equal(state.shop.name, "Barbearia Escolhida · Demo");
  assert.equal(state.settings.display_name, "Marca Escolhida");
  assert.equal(state.services.length, 2);
  assert.equal(state.staff.length, 1);
  assert.equal(state.customers.length, 200);
  assert.ok(state.customers.every((customer) => customer.id.startsWith("demo-")));
  assert.ok(
    state.appointments.every((appointment) => appointment.barbershop_id === selectedShopId),
  );
});
