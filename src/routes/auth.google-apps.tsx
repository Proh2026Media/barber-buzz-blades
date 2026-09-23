import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { requireSession } from "@/lib/auth/guards";

export const Route = createFileRoute("/auth/google-apps")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === "string" ? s.code : "",
    state: typeof s.state === "string" ? s.state : "",
    error: typeof s.error === "string" ? s.error : "",
  }),
  beforeLoad: async ({ location }) => {
    const search =
      typeof location.searchStr === "string" && location.searchStr ? location.searchStr : "";
    await requireSession(`/auth/google-apps${search}`);
  },
  component: GoogleAppsCallback,
});

function GoogleAppsCallback() {
  const { code, state, error: oauthError } = Route.useSearch();
  const [message, setMessage] = useState("Conectando Google Agenda e Contatos…");

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      if (oauthError) {
        setMessage(`Google recusou: ${oauthError}`);
        window.setTimeout(() => {
          window.location.assign("/shop?google=error");
        }, 1600);
        return;
      }
      if (!code || !state) {
        setMessage("Resposta do Google incompleta.");
        window.setTimeout(() => {
          window.location.assign("/shop");
        }, 1600);
        return;
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Sessão expirada. Entre novamente e reconecte o Google.");

        const base = import.meta.env.VITE_SUPABASE_URL || "";
        const response = await fetch(`${base}/functions/v1/google-connect`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "complete", code, state }),
        });
        const payload = (await response.json()) as {
          error?: string;
          return_path?: string;
        };
        if (!response.ok) throw new Error(payload.error || "Falha ao concluir OAuth Google");

        if (cancelled) return;
        setMessage("Google conectado.");
        const path = payload.return_path || "/shop";
        const [pathname, query = ""] = path.split("?");
        const params = new URLSearchParams(query);
        params.set("google", "connected");
        window.setTimeout(() => {
          window.location.assign(`${pathname}?${params.toString()}`);
        }, 600);
      } catch (err) {
        if (cancelled) return;
        setMessage(err instanceof Error ? err.message : "Falha na conexão Google");
        window.setTimeout(() => {
          window.location.assign("/shop?google=error");
        }, 2000);
      }
    }

    void finish();
    return () => {
      cancelled = true;
    };
  }, [code, state, oauthError]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
