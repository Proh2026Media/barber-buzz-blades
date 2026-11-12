import test from "node:test";
import assert from "node:assert/strict";
import { customerAuthReturn } from "./customer-return.ts";
test("link de outra barbearia substitui loja lembrada sem carregar horário anterior", () => {
  const url = new URL(
    customerAuthReturn("/app?shop=antiga&barber=antigo&at=10&service=a", "nova"),
    "https://bc.example.invalid",
  );
  assert.equal(url.searchParams.get("shop"), "nova");
  assert.equal(url.searchParams.get("join"), "1");
  assert.equal(url.searchParams.has("barber"), false);
  assert.equal(url.searchParams.has("at"), false);
});
test("mesma loja conserva escolha de agendamento e sem loja conserva destino", () => {
  assert.equal(
    customerAuthReturn("/app?shop=nova&barber=bruno&at=10", "nova"),
    "/app?shop=nova&barber=bruno&at=10&join=1",
  );
  assert.equal(customerAuthReturn("/app?shop=antiga"), "/app?shop=antiga");
  assert.equal(customerAuthReturn("/platform", "nova"), "/platform");
  assert.equal(customerAuthReturn("/application", "nova"), "/application");
});
