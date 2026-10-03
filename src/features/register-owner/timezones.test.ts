import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SHOP_TIME_ZONE,
  SHOP_TIME_ZONES,
  clockInTimeZone,
  describeTimeZone,
  detectDeviceTimeZone,
  isValidTimeZone,
  normalizeTimeZone,
  timeZoneChoices,
  timeZoneCity,
} from "./timezones.ts";

test("lista de fusos: todos válidos e sem repetição", () => {
  for (const option of SHOP_TIME_ZONES) assert.ok(isValidTimeZone(option.id), option.id);
  assert.equal(new Set(SHOP_TIME_ZONES.map((option) => option.id)).size, SHOP_TIME_ZONES.length);
  assert.equal(new Set(SHOP_TIME_ZONES.map((option) => option.key)).size, SHOP_TIME_ZONES.length);
  assert.equal(SHOP_TIME_ZONES[0]?.id, DEFAULT_SHOP_TIME_ZONE);
});

test("detecção pelo aparelho", () => {
  assert.equal(
    detectDeviceTimeZone(() => "America/Manaus"),
    "America/Manaus",
  );
  assert.equal(
    detectDeviceTimeZone(() => "Europe/Lisbon"),
    "Europe/Lisbon",
  );
  assert.equal(
    detectDeviceTimeZone(() => "America/Fortaleza"),
    "America/Fortaleza",
  );
  // Nome antigo vira o atual; vazio, inválido ou erro caem no horário de Brasília.
  assert.equal(
    detectDeviceTimeZone(() => "Brazil/West"),
    "America/Manaus",
  );
  assert.equal(
    detectDeviceTimeZone(() => undefined),
    DEFAULT_SHOP_TIME_ZONE,
  );
  assert.equal(
    detectDeviceTimeZone(() => "Lua/Base"),
    DEFAULT_SHOP_TIME_ZONE,
  );
  assert.equal(
    detectDeviceTimeZone(() => {
      throw new Error("sem Intl");
    }),
    DEFAULT_SHOP_TIME_ZONE,
  );
  // Nomes técnicos que o servidor recusa caem no horário de Brasília.
  assert.equal(
    detectDeviceTimeZone(() => "Etc/GMT+3"),
    DEFAULT_SHOP_TIME_ZONE,
  );
  assert.equal(
    detectDeviceTimeZone(() => "UTC"),
    "UTC",
  );
  assert.equal(
    detectDeviceTimeZone(() => "Portugal"),
    "Europe/Lisbon",
  );
  assert.equal(normalizeTimeZone("  America/Cuiaba "), "America/Cuiaba");
  assert.equal(normalizeTimeZone(""), null);
});

test("nome amigável do fuso", () => {
  assert.deepEqual(describeTimeZone("America/Sao_Paulo"), { kind: "list", key: "brasilia" });
  assert.deepEqual(describeTimeZone("Atlantic/Azores"), { kind: "list", key: "azores" });
  assert.deepEqual(describeTimeZone("America/Recife"), { kind: "brasilia", city: "Recife" });
  assert.deepEqual(describeTimeZone("Europe/Madrid"), { kind: "other", city: "Madrid" });
  assert.equal(timeZoneCity("America/Porto_Velho"), "Porto Velho");
  assert.equal(timeZoneCity("America/Argentina/Buenos_Aires"), "Buenos Aires");
});

test("opções do seletor mantêm o fuso fora da lista", () => {
  const plain = timeZoneChoices("America/Sao_Paulo");
  assert.equal(plain.other.length, 0);
  assert.ok(plain.br.some((option) => option.id === "America/Noronha"));
  assert.ok(plain.pt.some((option) => option.id === "Atlantic/Azores"));
  const extra = timeZoneChoices("America/Fortaleza", "Europe/Madrid", "America/Fortaleza", "x/y");
  assert.deepEqual(extra.other, ["America/Fortaleza", "Europe/Madrid"]);
});

test("relógio no fuso da loja", () => {
  const instant = new Date("2030-01-15T12:05:00Z");
  assert.equal(clockInTimeZone("America/Sao_Paulo", instant), "09:05");
  assert.equal(clockInTimeZone("America/Rio_Branco", instant), "07:05");
  assert.equal(clockInTimeZone("America/Noronha", instant), "10:05");
  assert.equal(clockInTimeZone("Europe/Lisbon", instant), "12:05");
  assert.equal(clockInTimeZone("Atlantic/Azores", instant), "11:05");
  assert.equal(clockInTimeZone("Lua/Base", instant), "");
});
