import assert from "node:assert/strict";
import test from "node:test";
import { deviceBootstrapScript, systemFor, SYSTEM_OVERRIDE_KEY, type SystemHints } from "./device.ts";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";

const CASES: Array<[string, SystemHints, "apple" | "android" | "outro"]> = [
  ["iPhone", { userAgent: IPHONE, platform: "iPhone", maxTouchPoints: 5 }, "apple"],
  ["Android", { userAgent: ANDROID, platform: "Linux armv8l", maxTouchPoints: 5 }, "android"],
  ["Android pelo dado do navegador", { userAgent: "", uaDataPlatform: "Android" }, "android"],
  ["Windows", { userAgent: WINDOWS, platform: "Win32", maxTouchPoints: 0 }, "outro"],
  ["iPad que se apresenta como Mac", { userAgent: MAC, platform: "MacIntel", maxTouchPoints: 5 }, "apple"],
  ["Mac", { userAgent: MAC, platform: "MacIntel", maxTouchPoints: 0 }, "apple"],
  ["Mac identificado somente pela plataforma", { platform: "MacIntel" }, "apple"],
  ["sem identificação", {}, "outro"],
];

test("sistema do aparelho: Apple, Android ou outro", () => {
  for (const [name, hints, expected] of CASES) {
    assert.equal(systemFor(hints), expected, name);
  }
});

/** Roda o script de antes da pintura num navegador de mentira e devolve os atributos gravados. */
function runBootstrap(hints: SystemHints, extra: Record<string, unknown> = {}, stored: string | null = null) {
  const attributes: Record<string, string> = {};
  const fakeWindow = { innerWidth: 390, matchMedia: () => ({ matches: false }) };
  const fakeDocument = {
    documentElement: {
      setAttribute: (name: string, value: string) => {
        attributes[name] = value;
      },
    },
  };
  const fakeNavigator = {
    userAgent: hints.userAgent ?? "",
    platform: hints.platform,
    maxTouchPoints: hints.maxTouchPoints ?? 0,
    userAgentData: hints.uaDataPlatform ? { platform: hints.uaDataPlatform } : undefined,
    ...extra,
  };
  const fakeStorage = { getItem: (key: string) => (key === SYSTEM_OVERRIDE_KEY ? stored : null) };
  new Function("window", "document", "navigator", "localStorage", deviceBootstrapScript)(
    fakeWindow,
    fakeDocument,
    fakeNavigator,
    fakeStorage,
  );
  return attributes;
}

test("o script de antes da pintura grava o mesmo sistema que systemFor", () => {
  for (const [name, hints, expected] of CASES) {
    const attributes = runBootstrap(hints);
    assert.equal(attributes["data-sistema"], expected, name);
    assert.equal(attributes["data-dispositivo"], "celular", name);
    assert.equal(attributes["data-instalado"], undefined, name);
    assert.equal(attributes["data-desempenho"], undefined, name);
  }
});

test("aberto pelo ícone, pouca memória e sistema forçado para teste", () => {
  assert.equal(runBootstrap({ userAgent: IPHONE }, { standalone: true })["data-instalado"], "sim");
  assert.equal(runBootstrap({ userAgent: ANDROID }, { deviceMemory: 2 })["data-desempenho"], "baixo");
  assert.equal(runBootstrap({ userAgent: ANDROID }, { deviceMemory: 8 })["data-desempenho"], undefined);
  assert.equal(runBootstrap({ userAgent: IPHONE }, {}, "android")["data-sistema"], "android");
  assert.equal(runBootstrap({ userAgent: IPHONE }, {}, "qualquer")["data-sistema"], "apple");
});
