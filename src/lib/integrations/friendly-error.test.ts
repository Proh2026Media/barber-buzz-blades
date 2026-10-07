import assert from "node:assert/strict";
import { test } from "node:test";
import { friendlyIntegrationError, integrationErrorKind } from "./friendly-error.ts";

const FALLBACK = "fallback";

test("API da Agenda desativada não vira 'agenda indisponível'", () => {
  const msg = friendlyIntegrationError(
    new Error(
      "Google Calendar API has not been used in project 123456 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=123456 then retry.",
    ),
    FALLBACK,
  );
  assert.match(msg, /Google Calendar API/);
  assert.doesNotMatch(msg, /não está disponível nesta conta/);
});

test("permissão da Agenda não concedida pede para reconectar marcando a Agenda", () => {
  const msg = friendlyIntegrationError("Request had insufficient authentication scopes.", FALLBACK);
  assert.match(msg, /marque a permissão da Agenda/);
});

test("token do Google revogado pede para reconectar o Google, não entrar no app", () => {
  for (const raw of [
    "Token has been expired or revoked.",
    "Conexão Google expirada. Conecte novamente.",
  ]) {
    assert.match(friendlyIntegrationError(raw, FALLBACK), /conecte de novo/);
  }
});

test("só a resposta do servidor para agenda fora da conta vira 'agenda indisponível'", () => {
  assert.match(
    friendlyIntegrationError("Essa agenda não está disponível nesta conta Google.", FALLBACK),
    /Escolha outra/,
  );
  assert.doesNotMatch(
    friendlyIntegrationError("Calendar not found for this request", FALLBACK),
    /Escolha outra/,
  );
});

test("mensagem do Google já traduzida não vira a mensagem do WhatsApp", () => {
  const once = friendlyIntegrationError("Token has been expired or revoked.", FALLBACK);
  const twice = friendlyIntegrationError(new Error(once), FALLBACK);
  assert.equal(twice, once);
  assert.doesNotMatch(twice, /WhatsApp/);
  assert.equal(integrationErrorKind(new Error(once)), "errors.integration.googleReconnect");
});
