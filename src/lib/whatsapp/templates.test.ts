import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_WHATSAPP_BODIES,
  SAMPLE_WHATSAPP_VARS,
  renderWhatsAppTemplate,
  validateWhatsAppTemplate,
  whatsappCodePointLength,
  wrapWhatsAppSelection,
} from "./templates.ts";

test("default templates are valid and fit the 1000 code point limit", () => {
  for (const [key, body] of Object.entries(DEFAULT_WHATSAPP_BODIES)) {
    assert.deepEqual(validateWhatsAppTemplate(body), [], key);
    assert.ok(whatsappCodePointLength(body) <= 1000, key);
  }
});

test("length counts code points, including emoji variation selectors, and CRLF as one", () => {
  assert.equal(whatsappCodePointLength("✂️"), 2);
  assert.equal(whatsappCodePointLength("😀"), 1);
  assert.equal(whatsappCodePointLength("a\r\nb"), 3);
});

test("validation rejects empty, oversized and unknown placeholders", () => {
  assert.match(validateWhatsAppTemplate("   ").join(" "), /vazia/);
  assert.match(validateWhatsAppTemplate("x".repeat(1001)).join(" "), /1001 de 1\.000/);
  assert.deepEqual(validateWhatsAppTemplate("x".repeat(1000)), []);
  assert.match(validateWhatsAppTemplate("Oi {{nome}}").join(" "), /desconhecida: \{\{nome\}\}/);
  assert.match(validateWhatsAppTemplate("Oi {{ }}").join(" "), /incompletas/);
});

test("validation flags Markdown that WhatsApp does not render", () => {
  assert.match(validateWhatsAppTemplate("**forte**").join(" "), /negrito/);
  assert.match(validateWhatsAppTemplate("~~risco~~").join(" "), /tachado/);
  assert.match(validateWhatsAppTemplate("[site](https://a.com)").join(" "), /links Markdown/);
  assert.match(validateWhatsAppTemplate("<b>oi</b>").join(" "), /HTML/);
  assert.match(validateWhatsAppTemplate("# Título").join(" "), /títulos/);
});

test("underscores inside URLs and placeholders are not treated as formatting", () => {
  assert.deepEqual(validateWhatsAppTemplate("Veja https://a.com/__x__ e {{link_reserva}}"), []);
});

test("render substitutes once and does not reprocess values", () => {
  const out = renderWhatsAppTemplate("Oi {{cliente}}, {{serviço}}", {
    cliente: "{{loja}}",
    serviço: "Corte",
  });
  assert.equal(out, "Oi {{loja}}, Corte");
});

test("render keeps unknown or missing placeholders visible", () => {
  assert.equal(renderWhatsAppTemplate("{{nome}} {{loja}}", {}), "{{nome}} {{loja}}");
});

test("rendered defaults contain no leftover placeholders", () => {
  for (const body of Object.values(DEFAULT_WHATSAPP_BODIES)) {
    assert.doesNotMatch(renderWhatsAppTemplate(body, SAMPLE_WHATSAPP_VARS), /\{\{/);
  }
});

test("wrap selection surrounds the selected text or inserts a placeholder word", () => {
  assert.deepEqual(wrapWhatsAppSelection("oi mundo", 3, 8, "*"), {
    next: "oi *mundo*",
    cursor: 10,
  });
  assert.deepEqual(wrapWhatsAppSelection("oi ", 3, 3, "_"), { next: "oi _texto_", cursor: 10 });
});
