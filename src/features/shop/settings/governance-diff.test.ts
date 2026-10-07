import assert from "node:assert/strict";
import { test } from "node:test";
import { describeChange, isTechnicalSummary } from "./governance-diff.ts";

// Tradutor de teste: devolve a chave com as variáveis, para conferir o que foi pedido.
const t = (key: string, vars?: Record<string, string | number>) =>
  vars ? `${key}(${Object.values(vars).join(",")})` : key;
const base = { t: t as never, locale: "pt-BR" };

test("código interno do pedido nunca vira texto", () => {
  assert.equal(isTechnicalSummary("service.update", "service.update"), true);
  assert.equal(isTechnicalSummary("hours.replace"), true);
  assert.equal(isTechnicalSummary(""), true);
  assert.equal(isTechnicalSummary("Novo membro"), false);
  const view = describeChange("service.update", { summary: "service.update" }, base);
  assert.equal(view.note, undefined);
});

test("serviço mostra só o que muda, com o antes", () => {
  const view = describeChange(
    "service.update",
    { id: "s1", name: "Corte", price_cents: 6000, duration_minutes: 30, active: true },
    {
      ...base,
      services: [
        {
          id: "s1",
          barbershop_id: "b",
          name: "Corte",
          price_cents: 5000,
          duration_minutes: 30,
          active: false,
          icon: null,
          prep_minutes: null,
          description: null,
          created_at: "",
          updated_at: "",
        },
      ],
    },
  );
  assert.equal(view.subject, "Corte");
  assert.deepEqual(
    view.rows.map((row) => row.key),
    ["price", "active"],
  );
  assert.ok(view.rows[0]!.previous);
});

test("horários destacam só os dias alterados", () => {
  const hours = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    is_open: weekday > 0,
    opens_at: "09:00:00",
    closes_at: weekday === 6 ? "14:00:00" : "19:00:00",
  }));
  const current = hours.map((row) => ({
    ...row,
    closes_at: "19:00:00",
    id: String(row.weekday),
    barbershop_id: "b",
    created_at: "",
    updated_at: "",
  }));
  const view = describeChange("hours.replace", { hours }, { ...base, businessHours: current });
  assert.deepEqual(
    view.week!.filter((day) => day.changed).map((day) => day.weekday),
    [6],
  );
});

test("ajustes mostram só os campos diferentes do atual", () => {
  const view = describeChange(
    "settings.operational",
    { booking_horizon_days: 60, waiting_enabled: false },
    { ...base, settings: { booking_horizon_days: 30, waiting_enabled: false } },
  );
  assert.deepEqual(
    view.rows.map((row) => row.key),
    ["horizon"],
  );
});
