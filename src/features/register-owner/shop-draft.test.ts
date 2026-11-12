import { test } from "node:test";
import assert from "node:assert/strict";
import { readShopDraft, saveShopDraft, clearShopDraft } from "./shop-draft.ts";
test("Rascunho preserva a loja e a chave, recusa lixo e vence após um dia", () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
      removeItem: (k: string) => values.delete(k),
    },
  });
  assert.equal(readShopDraft(), null);
  const draft = {
    name: "Teste",
    timezone: "America/Sao_Paulo",
    society: "single" as const,
    request: null,
  };
  saveShopDraft(draft);
  assert.equal(readShopDraft()?.name, "Teste");
  const key = [...values.keys()][0];
  values.set(key, JSON.stringify({ ...draft, savedAt: Date.now() - 86400001 }));
  assert.equal(readShopDraft(), null);
  values.set(key, "{invalido");
  assert.equal(readShopDraft(), null);
  saveShopDraft(draft);
  clearShopDraft();
  assert.equal(readShopDraft(), null);
  delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
  assert.equal(readShopDraft(), null);
  assert.doesNotThrow(() => saveShopDraft(draft));
});
