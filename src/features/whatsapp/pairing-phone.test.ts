import test from "node:test";
import assert from "node:assert/strict";
import { detectPairingCountry, normalizePairingPhone, pairingCountries } from "./pairing-phone.ts";

test("escolha anterior da pessoa prevalece sobre a detecção", () => {
  assert.equal(
    detectPairingCountry({ saved: "PT", shopTimeZone: "America/Sao_Paulo", languages: ["en-US"] }),
    "PT",
  );
});
test("fuso da loja prevalece sobre aparelho em outro país", () => {
  assert.equal(
    detectPairingCountry({ shopTimeZone: "Europe/Lisbon", deviceTimeZone: "America/Sao_Paulo" }),
    "PT",
  );
});
test("Brasil é identificado pelo fuso mesmo com navegador em inglês", () => {
  for (const zone of [
    "America/Sao_Paulo",
    "America/Fortaleza",
    "America/Rio_Branco",
    "Brazil/East",
  ])
    assert.equal(detectPairingCountry({ deviceTimeZone: zone, languages: ["en-US"] }), "BR");
});
test("idioma regional identifica país fora da lista curta de fusos", () => {
  assert.equal(
    detectPairingCountry({ deviceTimeZone: "UTC", languages: ["fr-FR", "en-US"] }),
    "FR",
  );
  assert.equal(detectPairingCountry({ languages: ["es-AR"] }), "AR");
});
test("configurações inválidas usam fallback do app sem lançar erro", () => {
  assert.equal(
    detectPairingCountry({
      saved: "ZZ",
      deviceTimeZone: "errado",
      languages: ["??"],
      locale: "pt-PT",
    }),
    "PT",
  );
  assert.equal(detectPairingCountry({}), "BR");
});
test("número brasileiro dispensa DDI, inclusive quando DDD é 55", () => {
  assert.equal(normalizePairingPhone("(11) 99999-0000", "BR")?.digits, "5511999990000");
  assert.equal(normalizePairingPhone("55 99999-0000", "BR")?.digits, "5555999990000");
});
test("DDI explícito ou preenchimento automático não é duplicado", () => {
  for (const raw of ["+55 11 99999-0000", "0055 11 99999-0000", "5511999990000"])
    assert.equal(normalizePairingPhone(raw, "BR")?.digits, "5511999990000");
});
test("internacional colado identifica país independentemente do selecionado", () => {
  const phone = normalizePairingPhone("+351 912 345 678", "BR");
  assert.equal(phone?.country, "PT");
  assert.equal(phone?.digits, "351912345678");
  assert.equal(phone?.national, "912345678");
});
test("Portugal, Reino Unido, França e EUA normalizam número nacional", () => {
  assert.equal(normalizePairingPhone("912345678", "PT")?.digits, "351912345678");
  assert.equal(normalizePairingPhone("07700 900123", "GB")?.digits, "447700900123");
  assert.equal(normalizePairingPhone("06 12 34 56 78", "FR")?.digits, "33612345678");
  assert.equal(normalizePairingPhone("2025550123", "US")?.digits, "12025550123");
});
test("entrada inválida ou incompleta não envia telefone errado", () => {
  for (const raw of ["", "123456", "+", "11abc999990000", "5511999990000&x=1", "1".repeat(30)])
    assert.equal(normalizePairingPhone(raw, "BR"), null);
});
test("seletor inclui países com nome traduzido e DDI", () => {
  const countries = pairingCountries("pt-BR");
  assert.ok(countries.length > 200);
  assert.deepEqual(
    countries.find((x) => x.country === "BR"),
    { country: "BR", name: "Brasil", code: "55" },
  );
  assert.equal(countries.find((x) => x.country === "PT")?.code, "351");
});
