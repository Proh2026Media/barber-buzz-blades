import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { platformAuthOrigin } from "@/lib/auth/return-origin";

export const Route = createFileRoute("/auth_/google-apps")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === "string" ? s.code : "",
    state: typeof s.state === "string" ? s.state : "",
    error: typeof s.error === "string" ? s.error : "",
    error_description: typeof s.error_description === "string" ? s.error_description : "",
  }),
  // Sem requireSession: o cookie de login fica no domínio da loja; o redirect
  // do Google cai no apex. O complete valida o state HMAC sem precisar da sessão.
  component: GoogleAppsCallback,
});

function GoogleAppsCallback() {
  const { code, state, error: oauthError, error_description } = Route.useSearch();
  const [message, setMessage] = useState("Conectando Google Agenda e Contatos…");

  useEffect(() => {
    let cancelled = false;

    function goBack(path: string, origin: string, params: Record<string, string>) {
      const query = new URLSearchParams(params);
      const [pathname, existing = ""] = path.split("?");
      const merged = new URLSearchParams(existing);
      for (const [key, value] of query.entries()) merged.set(key, value);
      const target = `${origin.replace(/\/$/, "")}${pathname}?${merged.toString()}`;
      window.location.assign(target);
    }

    async function finish() {
      const fallbackOrigin = platformAuthOrigin();

      if (oauthError) {
        const denied =
          oauthError === "access_denied"
            ? "Conexão cancelada no Google. Se apareceu “app não verificado”, use Avançado → continuar."
            : `Google recusou: ${error_description || oauthError}`;
        setMessage(denied);
        window.setTimeout(() => {
          goBack("/shop", fallbackOrigin, { google: "error", reason: denied });
        }, 2200);
        return;
      }
      if (!code || !state) {
        setMessage("Resposta do Google incompleta.");
        window.setTimeout(() => {
          goBack("/shop", fallbackOrigin, {});
        }, 1600);
        return;
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const base = import.meta.env.VITE_SUPABASE_URL || "";
        const headers: Record<string, string> = {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
          "Content-Type": "application/json",
        };
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await fetch(`${base}/functions/v1/google-connect`, {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "complete", code, state }),
        });
        const payload = (await response.json()) as {
          error?: string;
          return_path?: string;
          return_origin?: string;
        };
        if (!response.ok) throw new Error(payload.error || "Falha ao concluir OAuth Google");

        if (cancelled) return;
        setMessage("Google conectado. Voltando à barbearia…");
        const path = payload.return_path || "/shop";
        const origin = payload.return_origin || fallbackOrigin;
        window.setTimeout(() => {
          goBack(path, origin, { google: "connected" });
        }, 500);
      } catch (err) {
        if (cancelled) return;
        const detail = err instanceof Error ? err.message : "Falha na conexão Google";
        setMessage(detail);
        window.setTimeout(() => {
          goBack("/shop", fallbackOrigin, { google: "error", reason: detail });
        }, 2200);
      }
    }

    void finish();
    return () => {
      cancelled = true;
    };
  }, [code, state, oauthError, error_description]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
