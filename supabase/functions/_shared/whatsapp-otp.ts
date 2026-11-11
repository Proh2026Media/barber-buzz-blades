/** Códigos curtos exigem segredo fora do banco, além do limite de tentativas. */
export function randomOtp() {
  const value = new Uint32Array(1);
  do {
    crypto.getRandomValues(value);
  } while (value[0] >= 4_294_000_000);
  return String(value[0] % 1_000_000).padStart(6, "0");
}

export async function otpVerifier(context: string, secret: string) {
  if (new TextEncoder().encode(secret).length < 32) throw new Error("WA_OTP_KEY_UNAVAILABLE");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const value = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`bc-otp-v1:${context}`),
  );
  return [...new Uint8Array(value)].map((v) => v.toString(16).padStart(2, "0")).join("");
}
