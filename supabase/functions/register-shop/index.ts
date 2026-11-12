/** Cadastro legado desativado: a loja agora nasce na conta autenticada pela RPC nº 110. */
import { corsHeaders, json } from "../_shared/evolution.ts";
type ErrorCode = "shop_authenticated_signup_required";
const errorCode: ErrorCode = "shop_authenticated_signup_required";
Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  return json(
    {
      ok: false,
      error_code: errorCode,
      error: "Entre ou crie sua conta por e-mail ou Google e volte a Cadastrar barbearia.",
      next: "/auth?next=%2Fcadastrar",
    },
    410,
  );
});
