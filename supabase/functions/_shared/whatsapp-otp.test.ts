import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { otpVerifier, randomOtp } from "./whatsapp-otp.ts";

const secret = "segredo-apenas-ficticio-para-testar-hmac";
test("verificador usa HMAC com segredo fora do banco e contexto completo", async () => {
  const context = "verify_phone:conta:+5511999999999:012345";
  assert.equal(
    await otpVerifier(context, secret),
    createHmac("sha256", secret).update(`bc-otp-v1:${context}`).digest("hex"),
  );
  for (const other of [
    context.replace("conta", "outra"),
    context.replace("012345", "012346"),
    context.replace("verify_phone", "login"),
  ]) {
    assert.notEqual(await otpVerifier(context, secret), await otpVerifier(other, secret));
  }
  assert.notEqual(await otpVerifier(context, secret), await otpVerifier(context, secret + "outra"));
});
test("chave ausente ou curta não produz verificador fraco", async () => {
  await assert.rejects(otpVerifier("contexto:123456", ""), /WA_OTP_KEY_UNAVAILABLE/);
  await assert.rejects(otpVerifier("contexto:123456", "curta"), /WA_OTP_KEY_UNAVAILABLE/);
});
test("códigos mantêm seis dígitos, inclusive zeros à esquerda", () => {
  for (let i = 0; i < 50; i++) assert.match(randomOtp(), /^\d{6}$/);
});
