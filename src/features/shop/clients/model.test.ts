import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanNickname,
  clientDisplay,
  demoFindClient,
  parseFoundClient,
  recurringBadge,
  signupLink,
  whatsappLink,
  type DemoClientSource,
} from "./model.ts";

test("found client is read defensively from the database answer", () => {
  assert.deepEqual(
    parseFoundClient({
      kind: "account",
      customer_id: "c1",
      shop_client_id: null,
      name: " João Silva ",
      nickname: "Alemão",
      whatsapp: "+5511999990000",
      recurring: true,
      limited: true,
    }),
    {
      kind: "account",
      customerId: "c1",
      shopClientId: null,
      name: "João Silva",
      nickname: "Alemão",
      whatsapp: "+5511999990000",
      notifyWhatsapp: null,
      recurring: true,
      limited: true,
    },
  );
  assert.equal(parseFoundClient({ kind: "manual", limited: "sim" }).limited, false);
  assert.equal(parseFoundClient(null).kind, "none");
  assert.equal(parseFoundClient({ kind: "hacker", customer_id: "x" }).customerId, null);
  // Cliente do balcão nunca traz conta, mesmo que o pacote venha estranho.
  assert.equal(parseFoundClient({ kind: "manual", customer_id: "x" }).customerId, null);
});

test("nickname is cleaned like the database does", () => {
  assert.equal(cleanNickname("  Alemão   do   Corte "), "Alemão do Corte");
  assert.equal(cleanNickname("   "), null);
  assert.equal(cleanNickname(null), null);
  assert.equal(cleanNickname("x".repeat(60))?.length, 40);
});

test("team sees the nickname first and the registered name beside it", () => {
  assert.deepEqual(clientDisplay("João Silva", "Alemão"), {
    primary: "Alemão",
    secondary: "João Silva",
  });
  assert.deepEqual(clientDisplay("João Silva", null), { primary: "João Silva", secondary: null });
  assert.deepEqual(clientDisplay("João", "joão"), { primary: "João", secondary: null });
  assert.deepEqual(clientDisplay(null, "Zé"), { primary: "Zé", secondary: null });
});

test("recurring badge says the rhythm of the series or that the client is recurring", () => {
  assert.deepEqual(recurringBadge(true, { kind: "weekday", intervalDays: null }, false), {
    key: "agenda.recurring.weekly",
  });
  assert.deepEqual(recurringBadge(true, { kind: "interval_days", intervalDays: 15 }, false), {
    key: "agenda.recurring.everyDays",
    days: 15,
  });
  assert.deepEqual(recurringBadge(true, { kind: "interval_days", intervalDays: 7 }, false), {
    key: "agenda.recurring.weekly",
  });
  // Banco antigo: sabe só que é série, sem o ritmo.
  assert.deepEqual(recurringBadge(true, { kind: undefined, intervalDays: undefined }, undefined), {
    key: "agenda.recurring.series",
  });
  assert.deepEqual(recurringBadge(false, { kind: null, intervalDays: null }, true), {
    key: "agenda.recurring.client",
  });
  assert.equal(recurringBadge(false, { kind: null, intervalDays: null }, false), null);
});

test("WhatsApp and signup links carry only digits and the encoded message", () => {
  assert.equal(
    whatsappLink("+55 (11) 99999-0000", "Olá, tudo bem?"),
    "https://wa.me/5511999990000?text=Ol%C3%A1%2C%20tudo%20bem%3F",
  );
  assert.equal(
    signupLink("https://arena.beauty.contheiner.digital/", "+5511999990000"),
    "https://arena.beauty.contheiner.digital/auth?cadastro=1&whatsapp=5511999990000",
  );
  assert.equal(signupLink("https://x.test", null), "https://x.test/auth?cadastro=1");
});

test("demo lookup mirrors the database: account first, then walk-in, then nobody", () => {
  const source: DemoClientSource = {
    customers: [{ id: "c1", name: "João Silva", whatsapp: "+5511955500001" }],
    shopClients: [
      {
        id: "s1",
        profile_id: "c1",
        full_name: null,
        whatsapp_e164: null,
        nickname: "Alemão",
        notify_whatsapp: true,
      },
      {
        id: "s2",
        profile_id: null,
        full_name: "Zé da Padaria",
        whatsapp_e164: "+5511955599999",
        nickname: null,
        notify_whatsapp: false,
      },
    ],
    series: [{ customer_id: "c1", active: true }],
    appointments: [
      { staff_id: "dono", customer_id: "c1", shop_client_id: null },
      { staff_id: "dono", customer_id: null, shop_client_id: "s2" },
      { staff_id: "leo", customer_id: "c1", shop_client_id: null },
    ],
  };
  const account = demoFindClient(source, "+5511955500001");
  assert.equal(account.kind, "account");
  assert.equal(account.nickname, "Alemão");
  assert.equal(account.recurring, true);
  const manual = demoFindClient(source, "+5511955599999");
  assert.equal(manual.kind, "manual");
  assert.equal(manual.notifyWhatsapp, false);
  assert.equal(manual.recurring, false);
  assert.equal(demoFindClient(source, "+5511900000000").kind, "none");
});

test("demo lookup hides another professional's client like the database (limited)", () => {
  const source: DemoClientSource = {
    customers: [{ id: "c1", name: "João Silva", whatsapp: "+5511955500001" }],
    shopClients: [
      {
        id: "s1",
        profile_id: "c1",
        full_name: null,
        whatsapp_e164: null,
        nickname: "Alemão",
        notify_whatsapp: true,
      },
      {
        id: "s2",
        profile_id: null,
        full_name: "Zé da Padaria",
        whatsapp_e164: "+5511955599999",
        nickname: "Zé",
        notify_whatsapp: false,
      },
    ],
    series: [{ customer_id: "c1", active: true }],
    appointments: [
      { staff_id: "dono", customer_id: null, shop_client_id: "s2" },
      { staff_id: "leo", customer_id: "c1", shop_client_id: null },
    ],
  };
  // Léo atende o João: vê apelido e recorrência. O Zé é só do dono: Léo vê o nome, sem o apelido.
  const own = demoFindClient(source, "+5511955500001", { staffId: "leo", full: false });
  assert.deepEqual([own.limited, own.nickname, own.recurring], [false, "Alemão", true]);
  const other = demoFindClient(source, "+5511955599999", { staffId: "leo", full: false });
  assert.deepEqual([other.limited, other.nickname, other.name], [true, null, "Zé da Padaria"]);
  // Quem vê a loja inteira vê tudo.
  const owner = demoFindClient(source, "+5511955599999", { staffId: "leo", full: true });
  assert.deepEqual([owner.limited, owner.nickname], [false, "Zé"]);
});
