import assert from "node:assert/strict";
import test from "node:test";
import {
  LAST_CUSTOMER_SHOP_KEY,
  customerShopHref,
  lastCustomerShopKey,
  otherShopBookings,
  pickCustomerShop,
  readLastCustomerShop,
  saveLastCustomerShop,
  upcomingByShop,
} from "./shop-choice.ts";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

test("última loja do cliente fica guardada por conta", () => {
  const storage = memoryStorage();
  saveLastCustomerShop("u1", "shop-b", storage);
  assert.equal(readLastCustomerShop("u1", storage), "shop-b");
  assert.equal(readLastCustomerShop("u2", storage), null);
  assert.equal(lastCustomerShopKey("u1"), `${LAST_CUSTOMER_SHOP_KEY}:u1`);
});

test("armazenamento bloqueado não derruba o app", () => {
  const broken = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  assert.equal(readLastCustomerShop("u1", broken), null);
  assert.doesNotThrow(() => saveLastCustomerShop("u1", "shop-a", broken));
  assert.equal(readLastCustomerShop("u1", null), null);
});

test("loja sem link: a lembrada (se ainda é cliente dela) e depois a primeira", () => {
  assert.equal(pickCustomerShop(["a", "b"], "b"), "b");
  assert.equal(pickCustomerShop(["a", "b"], "removida"), "a");
  assert.equal(pickCustomerShop(["a", "b"], null), "a");
  assert.equal(pickCustomerShop([], "a"), null);
});

const now = Date.parse("2026-10-09T12:00:00Z");
const row = (id: string, shop: string, startsAt: string, status = "confirmed") => ({
  id,
  barbershop_id: shop,
  starts_at: startsAt,
  status: status as "confirmed" | "pending" | "cancelled" | "completed" | "reschedule_requested",
  barbershop: { name: shop === "b" ? "Loja B" : shop === "c" ? "Loja C" : "Loja A" },
});

test("reservas futuras em outra loja, agrupadas e na ordem da mais próxima", () => {
  const rows = [
    row("1", "a", "2026-10-10T12:00:00Z"),
    row("2", "b", "2026-10-12T12:00:00Z"),
    row("3", "b", "2026-10-11T12:00:00Z"),
    row("4", "c", "2026-10-10T15:00:00Z"),
    row("5", "c", "2026-10-01T12:00:00Z"), // passada
    row("6", "b", "2026-10-15T12:00:00Z", "cancelled"),
  ];
  const groups = otherShopBookings(rows, "a", now, [{ id: "b", name: "Barbearia B", slug: "bb" }]);
  assert.deepEqual(
    groups.map((group) => [group.shopId, group.name, group.slug, group.count]),
    [
      ["c", "Loja C", null, 1],
      ["b", "Barbearia B", "bb", 2],
    ],
  );
  // Sem loja aberta, todas as reservas futuras são "de outra loja".
  assert.equal(otherShopBookings(rows, null, now, []).length, 3);
  assert.deepEqual(otherShopBookings(rows.slice(0, 1), "a", now, []), []);
});

test("contador de reservas futuras por loja", () => {
  const counts = upcomingByShop(
    [
      row("1", "a", "2026-10-10T12:00:00Z"),
      row("2", "a", "2026-10-11T12:00:00Z"),
      row("3", "b", "2026-10-01T12:00:00Z"),
    ],
    now,
  );
  assert.equal(counts.get("a"), 2);
  assert.equal(counts.get("b"), undefined);
});

test("endereço da loja no app do cliente", () => {
  assert.equal(customerShopHref("bb"), "/app?shop=bb");
  assert.equal(
    customerShopHref("bb", { tab: "reservas", reserva: "tok en" }),
    "/app?shop=bb&tab=reservas&reserva=tok+en",
  );
});
