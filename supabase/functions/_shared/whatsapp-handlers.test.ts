import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { connectWithPairingCode, evolutionQr, pairingPhone } from "./whatsapp-pairing.ts";

/** Executa os handlers reais com dependências em memória, sem rede ou credenciais. */
function fixture(
  endpoint: string,
  options: { allowed?: boolean; channel?: boolean; state?: string } = {},
) {
  const calls: string[] = [];
  const writes: unknown[] = [];
  let channel: Record<string, unknown> | null =
    options.channel === false
      ? null
      : {
          barbershop_id: "loja-ficticia",
          instance_name: "instancia-da-loja",
          status: "disconnected",
        };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "usuario-ficticio" } }, error: null }) },
    rpc: async (name: string) => {
      calls.push(name);
      return { data: options.allowed !== false, error: null };
    },
    from(table: string) {
      let mutation: Record<string, unknown> | undefined;
      const result = () => {
        if (mutation) {
          writes.push(mutation);
          channel = { ...channel, ...mutation };
        }
        return {
          data: table === "barbershops" ? { id: "loja-ficticia", slug: "loja" } : channel,
          error: null,
        };
      };
      const query = {
        select: () => query,
        eq: () => query,
        update: (data: Record<string, unknown>) => {
          mutation = data;
          return query;
        },
        insert: (data: Record<string, unknown>) => {
          mutation = data;
          return query;
        },
        single: async () => result(),
        maybeSingle: async () => result(),
        then: (resolve: (value: unknown) => void) => resolve(result()),
      };
      return query;
    },
  };
  const evolutionFetch = async (path: string) => {
    calls.push(path);
    if (path.includes("connectionState")) {
      if (options.state === "missing") throw new Error("404 not found");
      return { instance: { state: options.state ?? "close" } };
    }
    if (path.includes("connect/")) return { pairingCode: "ABCD1234", base64: "iVBORw0KGgo=" };
    if (path.includes("create")) return { qrcode: { pairingCode: "ABCD1234" } };
    return {};
  };
  const source = readFileSync(new URL(`../${endpoint}/index.ts`, import.meta.url), "utf8").replace(
    /^import .*;\n/gm,
    "",
  );
  const compiled = stripTypeScriptTypes(source);
  let handler!: (request: Request) => Promise<Response>;
  const env: Record<string, string> = {
    SUPABASE_URL: "https://invalid.test",
    SUPABASE_ANON_KEY: "anon-ficticia",
    SUPABASE_SERVICE_ROLE_KEY: "service-ficticia",
    PLATFORM_EVOLUTION_INSTANCE: "instancia-plataforma",
  };
  new Function(
    "createClient",
    "evolutionFetch",
    "connectWithPairingCode",
    "evolutionQr",
    "pairingPhone",
    "corsHeaders",
    "json",
    "instanceNameForShop",
    "Deno",
    compiled,
  )(
    () => client,
    evolutionFetch,
    connectWithPairingCode,
    evolutionQr,
    pairingPhone,
    {},
    (body: unknown, status = 200) => Response.json(body, { status }),
    () => "instancia-derivada",
    {
      env: { get: (name: string) => env[name] },
      serve: (fn: typeof handler) => {
        handler = fn;
      },
    },
  );
  return {
    calls,
    writes,
    request: async (body: Record<string, unknown>, auth = true) => {
      const response = await handler(
        new Request("https://invalid.test", {
          method: "POST",
          headers: auth ? { Authorization: "Bearer ficticio" } : {},
          body: JSON.stringify({ barbershop_id: "loja-ficticia", ...body }),
        }),
      );
      return { status: response.status, body: await response.json() };
    },
  };
}
for (const endpoint of ["platform-whatsapp", "whatsapp-channel"]) {
  test(`${endpoint}: exige sessão antes de acessar Evolution`, async () => {
    const f = fixture(endpoint);
    assert.equal(
      (await f.request({ action: "connect", method: "code", phone: "5511999990000" }, false))
        .status,
      401,
    );
    assert.equal(f.calls.length, 0);
  });
  test(`${endpoint}: papel sem permissão não conecta`, async () => {
    const f = fixture(endpoint, { allowed: false });
    assert.equal(
      (await f.request({ action: "connect", method: "code", phone: "5511999990000" })).status,
      403,
    );
    assert.equal(
      f.calls.some((p) => p.startsWith("/")),
      false,
    );
    assert.equal(f.writes.length, 0);
  });
  test(`${endpoint}: telefone inválido e ação desconhecida falham antes do provedor`, async () => {
    const f = fixture(endpoint);
    assert.equal(
      (await f.request({ action: "connect", method: "code", phone: "123456" })).status,
      400,
    );
    assert.equal((await f.request({ action: "arbitraria" })).status, 400);
    assert.equal(
      f.calls.some((p) => p.startsWith("/")),
      false,
    );
  });
  test(`${endpoint}: conecta só na instância autorizada e não persiste código`, async () => {
    const f = fixture(endpoint);
    const result = await f.request({
      action: "connect",
      method: "code",
      phone: "5511999990000",
      instance_name: "instancia-invasora",
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.pairing_code, "ABCD1234");
    assert.equal(result.body.pairing_supported, true);
    assert.ok(
      f.calls.includes(
        `/instance/connect/${endpoint === "platform-whatsapp" ? "instancia-plataforma" : "instancia-da-loja"}?number=5511999990000`,
      ),
    );
    assert.equal(JSON.stringify(f.writes).includes("ABCD1234"), false);
    assert.equal(JSON.stringify(f.writes).includes("5511999990000"), false);
  });
  test(`${endpoint}: consulta sem instância não inicia conexão`, async () => {
    const f = fixture(endpoint, { state: "missing" });
    assert.equal((await f.request({ action: "status" })).status, 200);
    assert.equal(
      f.calls.some((p) => /\/create|\/connect\//.test(p)),
      false,
    );
  });
  test(`${endpoint}: QR em andamento é atualizado`, async () => {
    const f = fixture(endpoint, { state: "connecting" });
    const result = await f.request({ action: "status", method: "qr" });
    assert.equal(result.status, 200);
    assert.equal(result.body.qrcode, "data:image/png;base64,iVBORw0KGgo=");
  });
  test(`${endpoint}: consulta de QR encerrado não cria nova conexão`, async () => {
    const f = fixture(endpoint);
    await f.request({ action: "status", method: "qr" });
    assert.equal(
      f.calls.some((p) => /\/create|\/connect\//.test(p)),
      false,
    );
  });
  test(`${endpoint}: tentativa em andamento oferece recomeço explícito sem reiniciar`, async () => {
    const f = fixture(endpoint, { state: "connecting" });
    const result = await f.request({ action: "connect", method: "code", phone: "5511999990000" });
    assert.equal(result.status, 200);
    assert.equal(result.body.restart_required, true);
    assert.equal(
      f.calls.some((p) => /\/create|\/connect\//.test(p)),
      false,
    );
  });
  test(`${endpoint}: sessão aberta não sofre logout`, async () => {
    const f = fixture(endpoint, { state: "open" });
    const result = await f.request({ action: "connect", method: "code", phone: "5511999990000" });
    assert.equal(result.status, 200);
    assert.equal(result.body.pairing_code, null);
    assert.equal(
      f.calls.some((p) => /\/create|\/connect\/|logout|delete/.test(p)),
      false,
    );
  });
}
test("loja sem canal: status não cria registro no banco", async () => {
  const f = fixture("whatsapp-channel", { channel: false });
  const result = await f.request({ action: "status" });
  assert.equal(result.body.channel, null);
  assert.equal(f.writes.length, 0);
  assert.equal(
    f.calls.some((p) => p.startsWith("/")),
    false,
  );
});

for (const endpoint of ["platform-whatsapp", "whatsapp-channel"]) {
  test(`${endpoint}: recomeço exige sessão e permissão do mesmo escopo`, async () => {
    const body = { action: "restart-pairing", method: "code", phone: "5511999990000" };
    const noAuth = fixture(endpoint);
    assert.equal((await noAuth.request(body, false)).status, 401);
    assert.equal(noAuth.calls.length, 0);
    const denied = fixture(endpoint, { allowed: false });
    assert.equal((await denied.request(body)).status, 403);
    assert.equal(
      denied.calls.some((p) => p.startsWith("/")),
      false,
    );
  });
  test(`${endpoint}: recomeço de sessão aberta devolve conectado sem alterar Evolution`, async () => {
    const f = fixture(endpoint, { state: "open" });
    const result = await f.request({
      action: "restart-pairing",
      method: "code",
      phone: "5511999990000",
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.pairing_code, null);
    assert.equal(
      f.calls.some((p) => /logout|delete|\/connect\/|\/create/.test(p)),
      false,
    );
  });
}
