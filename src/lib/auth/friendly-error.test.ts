import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { friendlyAuthError, isKnownErrorCode, ServerError, serverError } from "./friendly-error.ts";
import { LOCALE_STORAGE_KEY } from "../i18n/locale.ts";
import {
  friendlyChannelLastError,
  friendlyIntegrationError,
} from "../integrations/friendly-error.ts";

test("common Supabase auth errors become everyday Portuguese", () => {
  assert.match(
    friendlyAuthError(new Error("Invalid login credentials")),
    /E-mail ou senha incorretos/,
  );
  assert.match(friendlyAuthError({ message: "Email not confirmed" }), /Confirme seu e-mail/);
  assert.match(friendlyAuthError("User already registered"), /já tem conta/);
  assert.match(friendlyAuthError("Token has expired or is invalid"), /Código inválido/);
  assert.match(friendlyAuthError("Email rate limit exceeded"), /Muitas tentativas/);
  assert.match(friendlyAuthError(new TypeError("Failed to fetch")), /Sem conexão/);
});

test("password rule errors are translated", () => {
  assert.match(
    friendlyAuthError("New password should be different from the old password."),
    /diferente da atual/,
  );
  assert.match(
    friendlyAuthError("Password should be at least 6 characters."),
    /pelo menos 6 caracteres/,
  );
});

test("messages already written in Portuguese pass through unchanged", () => {
  assert.equal(
    friendlyAuthError(new Error("As senhas não coincidem.")),
    "As senhas não coincidem.",
  );
});

test("technical jargon, long text and empty input fall back", () => {
  assert.equal(friendlyAuthError("supabase rpc failed", "Tente de novo."), "Tente de novo.");
  assert.equal(friendlyAuthError("x".repeat(200), "Tente de novo."), "Tente de novo.");
  assert.equal(friendlyAuthError(null, "Tente de novo."), "Tente de novo.");
});

test("integration errors guide the next step", () => {
  assert.match(friendlyIntegrationError("Invalid session", "x"), /sessão expirou/);
  assert.match(friendlyIntegrationError("BOOT_ERROR", "x"), /temporariamente indisponível/);
  assert.match(
    friendlyIntegrationError("Escolha qual agenda sincronizar.", "x"),
    /Escolha qual agenda/,
  );
  assert.match(friendlyIntegrationError("instance logout", "x"), /QR/);
  assert.equal(friendlyIntegrationError("postgres error 42P01", "Falhou."), "Falhou.");
});

test("channel last error is hidden when empty and translated otherwise", () => {
  assert.equal(friendlyChannelLastError(null), null);
  assert.equal(friendlyChannelLastError("  "), null);
  assert.match(friendlyChannelLastError("fetch failed") ?? "", /Sem conexão/);
});

test("permission and duplicate database errors become everyday Portuguese", () => {
  assert.match(
    friendlyAuthError('new row violates row-level security policy for table "barbershops"'),
    /não tem permissão/,
  );
  assert.match(friendlyAuthError("permission denied for table profiles"), /não tem permissão/);
  assert.match(
    friendlyAuthError('duplicate key value violates unique constraint "barbershops_slug_key"'),
    /já está cadastrado/,
  );
});

test("in English, screen messages pass through and only database jargon falls back", () => {
  const store = new Map([[LOCALE_STORAGE_KEY, "en-US"]]);
  const g = globalThis as { window?: unknown };
  g.window = { localStorage: { getItem: (key: string) => store.get(key) ?? null } };
  try {
    assert.equal(
      friendlyAuthError("This time is no longer available.", "Try again."),
      "This time is no longer available.",
    );
    assert.equal(
      friendlyAuthError('null value in column "name" violates not-null constraint', "Try again."),
      "Try again.",
    );
  } finally {
    delete g.window;
  }
});

test("unrecognized English errors fall back instead of showing foreign text", () => {
  assert.equal(
    friendlyAuthError("Could not find the column in the schema cache", "Tente de novo."),
    "Tente de novo.",
  );
  assert.equal(
    friendlyAuthError("Barbearia sem horário disponível"),
    "Barbearia sem horário disponível",
  );
});

/** Lê os códigos do tipo `ErrorCode` declarado numa função do servidor. */
function serverErrorCodes(path: string): string[] {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const union = /type ErrorCode =([\s\S]*?);/.exec(source)?.[1] ?? "";
  return [...union.matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);
}

test("every error_code returned by auth-otp and register-shop is known to the app", () => {
  for (const path of [
    "../../../supabase/functions/auth-otp/index.ts",
    "../../../supabase/functions/register-shop/index.ts",
  ]) {
    const codes = serverErrorCodes(path);
    assert.ok(codes.length > 10, `nenhum ErrorCode lido em ${path}`);
    for (const code of codes) {
      assert.ok(isKnownErrorCode(code), `${code} (${path}) sem tradução em friendly-error.ts`);
    }
  }
});

test("serverError keeps error_code and payload so the code wins over the text", () => {
  const err = serverError(
    { error: "Código incorreto ou expirado", error_code: "otp_invalid", attempts_left: 2 },
    "Falhou.",
  );
  assert.ok(err instanceof ServerError);
  assert.equal(err.errorCode, "otp_invalid");
  assert.equal(err.payload.attempts_left, 2);
  assert.equal(err.message, "Código incorreto ou expirado");
  assert.match(friendlyAuthError(err), /Código inválido/);

  const empty = serverError(null, "Falhou.");
  assert.equal(empty.message, "Falhou.");
  assert.equal(empty.errorCode, null);
});

test("edge error codes map to everyday messages instead of the raw server text", () => {
  const cases: Array<[string, RegExp]> = [
    ["otp_expired", /venceu/],
    ["otp_too_many_attempts", /muitas vezes/],
    ["rate_limited", /Muitas tentativas/],
    ["phone_in_use", /já está em uma conta/],
    ["invalid_whatsapp", /WhatsApp/],
    ["shop_not_found", /Barbearia não encontrada/],
    ["missing_fields", /Preencha/],
  ];
  for (const [code, expected] of cases) {
    assert.match(
      friendlyAuthError(serverError({ error: "texto cru", error_code: code }, "x")),
      expected,
    );
  }
  for (const code of [
    "shop_required",
    "shop_whatsapp_unavailable",
    "account_not_found",
    "account_without_email",
    "whatsapp_unavailable",
  ]) {
    assert.notEqual(
      friendlyAuthError(serverError({ error: "texto cru", error_code: code }, "x")),
      "texto cru",
    );
  }
  // Código conhecido sem frase própria: usa o fallback de quem chamou.
  assert.equal(
    friendlyAuthError(
      serverError({ error: "boom", error_code: "internal_error" }, "x"),
      "Tente de novo.",
    ),
    "Tente de novo.",
  );
  // Código desconhecido: cai na leitura do texto.
  assert.equal(
    friendlyAuthError(
      serverError({ error: "Barbearia fechada hoje", error_code: "novo_codigo" }, "x"),
    ),
    "Barbearia fechada hoje",
  );
});
