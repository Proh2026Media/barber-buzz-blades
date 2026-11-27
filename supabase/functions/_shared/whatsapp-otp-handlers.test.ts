import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

/** Os endpoints legados só respondem. Qualquer tentativa de usar banco ou transporte falha no ensaio. */
function endpoint(nome: "auth-otp" | "register-shop") {
  let atender!: (req: Request) => Response | Promise<Response>;
  const fonte = readFileSync(new URL(`../${nome}/index.ts`, import.meta.url), "utf8").replace(
    /^import[\s\S]*?;\n/gm,
    "",
  );
  new Function("json", "corsHeaders", "Deno", "fetch", stripTypeScriptTypes(fonte))(
    (corpo: unknown, status = 200) => Response.json(corpo, { status }),
    {},
    {
      serve: (fn: typeof atender) => {
        atender = fn;
      },
    },
    () => assert.fail("O endpoint legado tentou fazer uma chamada externa"),
  );
  return async (corpo: Record<string, unknown>, comSessao = false) =>
    atender(
      new Request("https://teste.invalid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(comSessao ? { Authorization: "Bearer ensaio" } : {}),
        },
        body: JSON.stringify(corpo),
      }),
    );
}

for (const finalidade of ["login", "verify_phone", "recovery"]) {
  test(`WhatsApp desativado para ${finalidade}, com ou sem sessão`, async () => {
    const requisitar = endpoint("auth-otp");
    for (const comSessao of [true, false]) {
      for (const action of ["request", "verify"]) {
        const resposta = await requisitar(
          { channel: "whatsapp", action, purpose: finalidade },
          comSessao,
        );
        assert.equal(resposta.status, 410);
        assert.equal((await resposta.json()).error_code, "whatsapp_unavailable");
      }
    }
  });
}

test("recuperação por e-mail no endereço legado orienta a usar a tela de acesso", async () => {
  const resposta = await endpoint("auth-otp")({
    channel: "email",
    action: "request",
    purpose: "recovery",
  });
  assert.equal(resposta.status, 200);
  assert.deepEqual(await resposta.json(), {
    ok: true,
    channel: "email",
    message: "Use a recuperação por e-mail na tela de acesso.",
  });
});

test("o endereço legado não valida código de e-mail", async () => {
  const resposta = await endpoint("auth-otp")({
    channel: "email",
    action: "verify",
    purpose: "recovery",
  });
  assert.equal(resposta.status, 410);
});

test("cadastro legado orienta a entrar e voltar ao cadastro da barbearia", async () => {
  const resposta = await endpoint("register-shop")({});
  assert.equal(resposta.status, 410);
  const corpo = await resposta.json();
  assert.equal(corpo.error_code, "shop_authenticated_signup_required");
  assert.equal(corpo.next, "/auth?next=%2Fcadastrar");
});
