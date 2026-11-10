import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { connectWithPairingCode, evolutionQr, pairingPhone } from "./whatsapp-pairing.ts";

/** Executa os handlers reais com dependências em memória, sem rede ou credenciais. */
function fixture(
  endpoint: string,
  options: {
    allowed?: boolean;
    channel?: boolean;
    state?: string;
    mode?: "primary" | "backup" | "paused";
    platformAdmin?: boolean;
    instance?: string;
    shared?: boolean;
    sharedError?: boolean;
  } = {},
) {
  const calls: string[] = [];
  const writes: unknown[] = [];
  let channel: Record<string, unknown> | null =
    options.channel === false
      ? null
      : {
          barbershop_id: "loja-ficticia",
          id: "11111111-1111-4111-8111-111111111111",
          instance_name: options.instance ?? "instancia-da-loja",
          status: "disconnected",
          delivery_mode: options.mode ?? "primary",
          backup_instance_name: options.mode === "backup" ? "reserva-da-loja" : null,
        };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "usuario-ficticio" } }, error: null }) },
    rpc: async (name: string, args?: Record<string, unknown>) => {
      calls.push(name);
      if (name === "shop_whatsapp_channel")
        return options.sharedError
          ? { data: null, error: { code: "42501", message: "negado" } }
          : options.shared
            ? {
                data: channel && { ...channel, number_link_id: "vinculo-da-loja", link_version: 7 },
                error: null,
              }
            : { data: null, error: { code: "PGRST202" } };
      if (name === "shop_update_whatsapp_preferences") {
        writes.push(args);
        return { data: { ...channel, enabled: args?.p_enabled }, error: null };
      }
      return {
        data:
          name === "is_platform_admin"
            ? options.platformAdmin !== false && options.allowed !== false
            : options.allowed !== false,
        error: null,
      };
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
        is: () => query,
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

for (const mode of ["backup", "paused"] as const) {
  test(`loja com ${mode}: conectar ou desconectar não altera o principal`, async () => {
    const f = fixture("whatsapp-channel", { mode });
    for (const action of ["connect", "create", "logout", "restart-pairing"]) {
      const result = await f.request({ action, method: "code", phone: "5511999990000" });
      assert.equal(result.status, 409);
    }
    assert.equal(f.writes.length, 0);
    assert.equal(
      f.calls.some((p) => p.startsWith("/")),
      false,
    );
  });
}
test("reserva selecionada: consulta mostra seu estado sem alterar registro do principal", async () => {
  const f = fixture("whatsapp-channel", { mode: "backup", state: "open" });
  const result = await f.request({ action: "status", method: "qr" });
  assert.equal(result.status, 200);
  assert.equal((result.body.channel as { status: string }).status, "open");
  assert.equal(result.body.qrcode, null);
  assert.ok(f.calls.includes("/instance/connectionState/reserva-da-loja"));
  assert.equal(f.writes.length, 0);
  assert.equal(
    f.calls.some((p) => /connect\/|create|delete|logout/.test(p)),
    false,
  );
});

test("dono da loja não conecta números fornecidos pelo B&C, mas pode consultar", async () => {
  const f = fixture("whatsapp-channel", { platformAdmin: false });
  assert.equal(
    (await f.request({ action: "connect", method: "code", phone: "5511999990000" })).status,
    403,
  );
  assert.equal(
    f.calls.some((p) => p.startsWith("/")),
    false,
  );
  assert.equal((await f.request({ action: "logout" })).status, 403);
  assert.equal((await f.request({ action: "status" })).status, 200);
});

test("central: canal cadastrado usa instância do banco e ignora nome enviado", async () => {
  const f = fixture("platform-whatsapp");
  const result = await f.request({
    action: "status",
    channel_id: "11111111-1111-4111-8111-111111111111",
    instance_name: "alvo-arbitrario",
  });
  assert.equal(result.status, 200);
  assert.ok(f.calls.includes("/instance/connectionState/instancia-da-loja"));
  assert.ok(!f.calls.some((c) => c.includes("alvo-arbitrario")));
});
test("central: identificador inválido não cai no canal de autenticação", async () => {
  const f = fixture("platform-whatsapp");
  assert.equal((await f.request({ action: "logout", channel_id: "" })).status, 400);
  assert.ok(!f.calls.some((c) => c.startsWith("/instance/")));
});
test("central: dono de loja não conecta um canal pelo identificador", async () => {
  const f = fixture("platform-whatsapp", { platformAdmin: false });
  assert.equal(
    (await f.request({ action: "connect", channel_id: "11111111-1111-4111-8111-111111111111" }))
      .status,
    403,
  );
  assert.equal(f.writes.length, 0);
});
test("central: instância de autenticação não pode ser usada como canal de loja", async () => {
  const f = fixture("platform-whatsapp", { instance: "instancia-plataforma" });
  assert.equal(
    (await f.request({ action: "connect", channel_id: "11111111-1111-4111-8111-111111111111" }))
      .status,
    409,
  );
  assert.ok(!f.calls.some((c) => c.startsWith("/instance/")));
});
test("central: canal inexistente não aciona Evolution", async () => {
  const f = fixture("platform-whatsapp", { channel: false });
  assert.equal(
    (await f.request({ action: "connect", channel_id: "11111111-1111-4111-8111-111111111111" }))
      .status,
    404,
  );
  assert.ok(!f.calls.some((c) => c.startsWith("/instance/")));
});

test("compartilhamento consulta somente a conexão existente, sem iniciar pareamento", async () => {
  const f = fixture("whatsapp-channel", { shared: true, state: "open" });
  const r = await f.request({ action: "status" });
  assert.equal(r.status, 200);
  assert.equal(r.body.centrally_managed, true);
  assert.equal(r.body.channel.number_link_id, "vinculo-da-loja");
  assert.ok(f.calls.some((c) => c.includes("connectionState/instancia-da-loja")));
  assert.ok(!f.calls.some((c) => c.includes("/connect/") || c.includes("/create")));
});
test("preferências compartilhadas usam vínculo/versionamento e não atualizam o número", async () => {
  const f = fixture("whatsapp-channel", { shared: true, platformAdmin: false });
  const r = await f.request({
    action: "settings",
    enabled: false,
    number_link_id: "vinculo-da-loja",
    link_version: 7,
  });
  assert.equal(r.status, 200);
  assert.equal(f.writes.length, 1);
  assert.deepEqual(Object.keys(f.writes[0] as object).sort(), [
    "p_booking",
    "p_enabled",
    "p_hours",
    "p_link",
    "p_reminder",
    "p_shop",
    "p_version",
  ]);
  assert.equal((f.writes[0] as { p_link: string }).p_link, "vinculo-da-loja");
  assert.equal(f.calls.filter((c) => c.startsWith("/instance")).length, 0);
});
test("conectar ou desconectar compartilhado exige central, inclusive para admin", async () => {
  for (const action of ["connect", "create", "logout"]) {
    const f = fixture("whatsapp-channel", { shared: true });
    const r = await f.request({ action });
    assert.equal(r.status, 409);
    assert.equal(f.writes.length, 0);
    assert.ok(!f.calls.some((c) => c.startsWith("/instance")));
  }
});
test("erro de permissão no vínculo não recorre à consulta antiga", async () => {
  const f = fixture("whatsapp-channel", { sharedError: true });
  const r = await f.request({ action: "status" });
  assert.equal(r.status, 500);
  assert.equal(f.writes.length, 0);
  assert.ok(!f.calls.some((c) => c.startsWith("/instance")));
});
test("loja sem vínculo compartilhado retorna vazia sem cadastrar instância", async () => {
  const f = fixture("whatsapp-channel", { shared: true, channel: false });
  const r = await f.request({ action: "status" });
  assert.equal(r.body.channel, null);
  assert.equal(f.writes.length, 0);
});

test("preferências antigas não sobrescrevem vínculo novo ou outra versão", async () => {
  for (const body of [
    {},
    { number_link_id: "outro", link_version: 7 },
    { number_link_id: "vinculo-da-loja", link_version: 6 },
  ]) {
    const f = fixture("whatsapp-channel", { shared: true });
    const r = await f.request({ action: "settings", enabled: false, ...body });
    assert.equal(r.status, 409);
    assert.equal(f.writes.length, 0);
  }
});
test("salvar preferências da reserva consulta o estado dela sem conectar", async () => {
  const f = fixture("whatsapp-channel", { shared: true, mode: "backup", state: "close" });
  const r = await f.request({
    action: "settings",
    enabled: true,
    number_link_id: "vinculo-da-loja",
    link_version: 7,
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.channel.status, "disconnected");
  assert.ok(f.calls.includes("/instance/connectionState/reserva-da-loja"));
  assert.ok(!f.calls.some((c) => c.includes("/connect/") || c.includes("/create")));
});
