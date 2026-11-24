import assert from "node:assert/strict";
import test from "node:test";
import { tipoDeSelo } from "./parceria.ts";

test("só as três lojas aprovadas recebem a assinatura de parceria", () => {
  for (const id of [
    "d44c850f-efc7-4fa0-9c12-9bd5623965c1",
    "16d6da2e-cd2e-4283-9936-2cb6d5e0e834",
    "bc8595cb-72a7-4428-8a9c-97fe12c18222",
  ]) assert.equal(tipoDeSelo(id), "parceria");
  for (const id of ["a5c2b03b-1e30-4446-b013-8cb8a9d8c447", "loja-nova", null]) {
    assert.equal(tipoDeSelo(id), "iniciais");
  }
});
