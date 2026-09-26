import { test } from "node:test";
import assert from "node:assert/strict";
import { friendlyAuthError } from "./friendly-error.ts";
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
