import assert from "node:assert/strict";
import test from "node:test";
import { countByShop, countsFor, uniqueAdmins, type MembershipRow } from "./shopCounts.ts";

const memberships: MembershipRow[] = [
  { barbershop_id: "a", role: "customer", user_id: "c1" },
  { barbershop_id: "a", role: "customer", user_id: "c2" },
  { barbershop_id: "a", role: "shop_admin", user_id: "antigo" },
  { barbershop_id: "b", role: "customer", user_id: "c1" },
];

test("sem a lista do banco, administrador é o papel antigo shop_admin", () => {
  const counts = countByShop(memberships);
  assert.deepEqual(countsFor(counts, "a"), { customers: 2, admins: 1 });
  assert.deepEqual(countsFor(counts, "b"), { customers: 1, admins: 0 });
  assert.equal(uniqueAdmins(memberships), 1);
});

test("com a lista do banco, administrador é dono ou sócio ativo da equipe", () => {
  const owners = [
    { barbershop_id: "b", user_id: "dono1" },
    { barbershop_id: "b", user_id: "socio" },
    { barbershop_id: "c", user_id: "dono1" },
  ];
  const counts = countByShop(memberships, owners);
  assert.deepEqual(countsFor(counts, "a"), { customers: 2, admins: 0 });
  assert.deepEqual(countsFor(counts, "b"), { customers: 1, admins: 2 });
  assert.deepEqual(countsFor(counts, "c"), { customers: 0, admins: 1 });
  assert.equal(uniqueAdmins(memberships, owners), 2);
});

test("lista vazia do banco não volta ao papel antigo", () => {
  const counts = countByShop(memberships, []);
  assert.equal(countsFor(counts, "a").admins, 0);
  assert.equal(uniqueAdmins(memberships, []), 0);
});
