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

test("pausa da loja mostra dias e horário aprovados, inclusive na remoção", () => {
  for (const kind of ["weekly_break.create", "weekly_break.delete"]) {
    const view = describeChange(
      kind,
      {
        id: "interno",
        weekdays: [6, 1],
        start_time: "12:00:00",
        end_time: "13:00:00",
        reason: "Almoço",
        version: "7",
        operation_id: "op",
      },
      base,
    );
    assert.equal(view.subject, "eq.diff.wholeShop");
    assert.deepEqual(
      view.rows.map((row) => row.key),
      ["days", "when", "reason"],
    );
    assert.equal(view.rows[0]?.value, "shop.weekday.1, shop.weekday.6");
    assert.equal(view.rows[1]?.value, "12:00–13:00");
    assert.equal(view.destructive === true, kind.endsWith("delete"));
    assert.equal(JSON.stringify(view).includes("interno"), false);
  }
});

test("o dono vê o texto, o contato e a visibilidade que mudam na página, inclusive quando um bloco volta ao padrão", () => {
  const view = describeChange("identity.update", {
    previous: { landing: { headline: "Anterior", instagram: "antes", show_hours: false } },
    changes: { landing: { headline: "Novo destaque", instagram: "depois", show_staff: false } },
  }, base);
  assert.equal(view.title, "plat.appearance.requestTitle");
  assert.deepEqual(view.rows.map(({ key, previous, value }) => [key, previous, value]), [
    ["landing.headline", "Anterior", "Novo destaque"],
    ["landing.instagram", "antes", "depois"],
    ["landing.show_staff", "eq.diff.on", "eq.diff.off"],
    ["landing.show_hours", "eq.diff.off", "eq.diff.on"],
  ]);
});

test("a arte proposta e a anterior têm prévias somente no armazenamento da loja e fontes mostram o nome do arquivo", () => {
  const logoBucketUrl = "https://arquivos.example/storage/v1/object/public/barbershop-logos/a/";
  const next = logoBucketUrl + "logo-2?v=2";
  const before = logoBucketUrl + "logo-1?v=1";
  const view = describeChange("identity.update", {
    previous: { logo_url: before, login_image_url: null, custom_font_faces: [], corner_style: "square" },
    changes: { logo_url: next, login_image_url: logoBucketUrl + "../b/capa.webp",
      custom_font_faces: [{ url: "https://arquivos.example/fonte", file_name: "Nova.woff2" }],
      corner_style: "round" },
  }, { ...base, logoBucketUrl });
  const byKey = Object.fromEntries(view.rows.map(row => [row.key, row]));
  assert.equal(byKey.logo_url.image, next);
  assert.equal(byKey.logo_url.previousImage, before);
  assert.equal(byKey.login_image_url.image, undefined);
  assert.equal(byKey.custom_font_faces.value, "Nova.woff2");
  assert.equal(byKey.corner_style.previous, "brand.corner.square");
  assert.equal(byKey.corner_style.value, "brand.corner.round");
  assert.ok(view.rows.every(row => !row.value.includes("https:") && !row.value.includes("[object")));
});
