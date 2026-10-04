import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EMPTY_ADDRESS_PARTS,
  buildAddressText,
  cepDigits,
  findCepInText,
  isCompleteCep,
  lookupCep,
  maskCep,
  parseViaCep,
} from "./postal-code.ts";

const SE = {
  cep: "01001-000",
  logradouro: "Praça da Sé",
  complemento: "lado ímpar",
  bairro: "Sé",
  localidade: "São Paulo",
  uf: "SP",
};

function fakeFetch(handler: (url: string, init?: RequestInit) => Promise<Response>) {
  const calls: string[] = [];
  const impl = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    return handler(url, init);
  }) as typeof fetch;
  return { impl, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("máscara e dígitos do CEP", () => {
  assert.equal(cepDigits("01.001-000"), "01001000");
  assert.equal(cepDigits("010010001234"), "01001000");
  assert.equal(maskCep("0100"), "0100");
  assert.equal(maskCep("01001"), "01001");
  assert.equal(maskCep("010010"), "01001-0");
  assert.equal(maskCep("01001000"), "01001-000");
  assert.equal(maskCep("abc"), "");
  // Colar em qualquer formato vira a mesma máscara.
  assert.equal(maskCep("01310-100"), "01310-100");
  assert.equal(maskCep("01310100"), "01310-100");
  assert.equal(maskCep(" 01310 100 "), "01310-100");
  assert.equal(maskCep("CEP 01.310-100"), "01310-100");
  assert.ok(isCompleteCep("01001-000"));
  assert.ok(!isCompleteCep("01001-00"));
});

test("acha o CEP já escrito no endereço", () => {
  assert.equal(findCepInText("Rua A, 10 - Centro, São Paulo - SP, CEP 01001-000"), "01001-000");
  assert.equal(findCepInText("Rua A, 10, cep: 01001000"), "01001-000");
  assert.equal(findCepInText("Rua A, 10, 01.001-000 São Paulo"), "01001-000");
  assert.equal(findCepInText("Rua A, 10, 01001-000"), "01001-000");
  // Oito números soltos sem "CEP" podem ser outra coisa.
  assert.equal(findCepInText("Rua A, 10 - tel 11999990000"), null);
  assert.equal(findCepInText(""), null);
});

test("lê a resposta do ViaCEP", () => {
  assert.deepEqual(parseViaCep(SE), {
    street: "Praça da Sé",
    district: "Sé",
    city: "São Paulo",
    state: "SP",
    cep: "01001-000",
  });
  // Cidade de CEP único: sem rua nem bairro.
  assert.deepEqual(
    parseViaCep({
      cep: "45990-000",
      logradouro: "",
      bairro: "",
      localidade: "Teixeira de Freitas",
      uf: "ba",
    }),
    { street: "", district: "", city: "Teixeira de Freitas", state: "BA", cep: "45990-000" },
  );
  assert.equal(parseViaCep({ erro: true }), null);
  assert.equal(parseViaCep({ erro: "true" }), null);
  assert.equal(parseViaCep(null), null);
  assert.equal(parseViaCep([]), null);
  assert.equal(parseViaCep({ cep: "01001-000", localidade: "", uf: "SP" }), null);
});

test("busca: encontrado", async () => {
  let sent: RequestInit | undefined;
  const { impl, calls } = fakeFetch(async (_url, init) => {
    sent = init;
    return json(SE);
  });
  const result = await lookupCep("01001-000", { fetchImpl: impl });
  assert.deepEqual(calls, ["https://viacep.com.br/ws/01001000/json/"]);
  // Só o CEP sai do aparelho: sem cookies nem a página de origem.
  assert.equal(sent?.credentials, "omit");
  assert.equal(sent?.referrerPolicy, "no-referrer");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.address.city, "São Paulo");
});

test("busca: CEP incompleto ou zerado não consulta a rede", async () => {
  const { impl, calls } = fakeFetch(async () => json(SE));
  assert.deepEqual(await lookupCep("0100", { fetchImpl: impl }), { ok: false, reason: "invalid" });
  assert.deepEqual(await lookupCep("00000-000", { fetchImpl: impl }), {
    ok: false,
    reason: "invalid",
  });
  assert.equal(calls.length, 0);
});

test("busca: não encontrado", async () => {
  const { impl } = fakeFetch(async () => json({ erro: true }));
  assert.deepEqual(await lookupCep("99999-999", { fetchImpl: impl }), {
    ok: false,
    reason: "notFound",
  });
  const bad = fakeFetch(async () => json({}, 400));
  assert.deepEqual(await lookupCep("99999-999", { fetchImpl: bad.impl }), {
    ok: false,
    reason: "notFound",
  });
});

test("busca: sem conexão, erro do serviço ou resposta que não é JSON", async () => {
  const down = fakeFetch(async () => {
    throw new TypeError("Failed to fetch");
  });
  assert.deepEqual(await lookupCep("01001000", { fetchImpl: down.impl }), {
    ok: false,
    reason: "offline",
  });
  const fail = fakeFetch(async () => json({}, 503));
  assert.deepEqual(await lookupCep("01001000", { fetchImpl: fail.impl }), {
    ok: false,
    reason: "offline",
  });
  const html = fakeFetch(async () => new Response("<html>", { status: 200 }));
  assert.deepEqual(await lookupCep("01001000", { fetchImpl: html.impl }), {
    ok: false,
    reason: "offline",
  });
});

/** Responde só quando a busca é cancelada (simula rede lenta). */
const hanging = fakeFetch(
  (_url, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError")),
      );
    }),
);

test("busca: tempo esgotado vira sem conexão", async () => {
  const result = await lookupCep("01001000", { fetchImpl: hanging.impl, timeoutMs: 10 });
  assert.deepEqual(result, { ok: false, reason: "offline" });
});

test("busca: cancelada por quem chamou", async () => {
  const controller = new AbortController();
  const pending = lookupCep("01001000", {
    fetchImpl: hanging.impl,
    signal: controller.signal,
    timeoutMs: 5000,
  });
  controller.abort();
  assert.deepEqual(await pending, { ok: false, reason: "aborted" });
});

test("monta o texto do endereço sem partes vazias", () => {
  const parts = {
    street: "Praça da Sé",
    number: "123",
    complement: "Sala 2",
    district: "Sé",
    city: "São Paulo",
    state: "SP",
    cep: "01001000",
  };
  assert.equal(
    buildAddressText(parts),
    "Praça da Sé, 123 - Sala 2 - Sé, São Paulo - SP, CEP 01001-000",
  );
  assert.equal(
    buildAddressText({ ...parts, complement: "  " }),
    "Praça da Sé, 123 - Sé, São Paulo - SP, CEP 01001-000",
  );
  assert.equal(
    buildAddressText({ ...parts, street: "", number: "", complement: "", district: "" }),
    "São Paulo - SP, CEP 01001-000",
  );
  assert.equal(
    buildAddressText({ ...parts, cep: "0100" }),
    "Praça da Sé, 123 - Sala 2 - Sé, São Paulo - SP",
  );
  assert.equal(buildAddressText(EMPTY_ADDRESS_PARTS), "");
});

test("endereço longo: tira complemento, depois bairro, depois corta", () => {
  const parts = {
    street: "Avenida Presidente Juscelino Kubitschek de Oliveira",
    number: "1500",
    complement: "Galeria Central, loja 12, ao lado da farmácia, entrada pela lateral",
    district: "Jardim Paulistano",
    city: "São Paulo",
    state: "SP",
    cep: "01451000",
  };
  const full = buildAddressText(parts, 160);
  assert.ok(full.length <= 160);
  assert.ok(!full.includes("Galeria"));
  assert.ok(full.includes("Jardim Paulistano"));
  assert.ok(full.endsWith("CEP 01451-000"));

  const noDistrict = buildAddressText(parts, 90);
  assert.equal(
    noDistrict,
    "Avenida Presidente Juscelino Kubitschek de Oliveira, 1500, São Paulo - SP, CEP 01451-000",
  );

  const cut = buildAddressText(parts, 40);
  assert.equal(cut.length <= 40, true);
  assert.ok(cut.startsWith("Avenida Presidente"));
});
