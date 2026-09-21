import { DataRights } from "./DataRights";
import { SurveyCatalog } from "./SurveyCatalog";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import { defaultPrivacy, questions, type PrivacyPreferences, type Survey } from "./model";

export function PrivacyCenter() {
  const demo = useDemo();
  const [preferences, setPreferences] = useState<PrivacyPreferences>(defaultPrivacy);
  const [responses, setResponses] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);
  const [confirmErase, setConfirmErase] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (demo) {
      setPreferences(demo.privacy);
      setResponses(demo.surveys);
      setLoading(false);
      return;
    }
    setLoading(true);
    void supabase.rpc("get_my_privacy").then(({ data, error: failure }) => {
      if (cancelled) return;
      if (failure) setError("Não foi possível carregar suas escolhas. Tente novamente.");
      else {
        const value = data as unknown as { preferences: PrivacyPreferences; responses: Survey[] };
        setPreferences(value.preferences);
        setResponses(value.responses);
        setError("");
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [demo, version]);

  async function save(erase = false) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (demo)
        demo.dispatch(erase ? { type: "privacy.erase" } : { type: "privacy.save", preferences });
      else {
        const result = erase
          ? await supabase.rpc("erase_my_optional_data")
          : await supabase.rpc("save_my_privacy", {
              p_analytics: preferences.analytics,
              p_surveys: preferences.surveys,
              p_marketing: preferences.marketing,
            });
        if (result.error) throw result.error;
      }
      if (erase) {
        setPreferences(defaultPrivacy);
        setResponses([]);
        setConfirmErase(false);
      }
      setMessage(
        erase
          ? "Respostas e registros opcionais excluídos. As opções foram desligadas."
          : "Suas escolhas foram salvas.",
      );
    } catch {
      setError("Não foi possível salvar. Suas escolhas anteriores continuam valendo.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Meus dados e privacidade"
      className="space-y-4 rounded-2xl border border-primary/20 bg-card p-4"
    >
      <h3 className="flex items-center gap-2 font-bold">
        <ShieldCheck className="size-5 text-primary" />
        Meus dados e privacidade
      </h3>
      <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
        <p>
          <strong>1. Essenciais:</strong> conta, reservas e histórico de atendimento permitem
          prestar o serviço.
        </p>
        <p>
          <strong>2. Uso opcional:</strong> com sua escolha, registramos tentativas de confirmar
          reservas, sucessos e falhas para melhorar o app. Não registramos o que você digita.
        </p>
        <p>
          <strong>3. Pesquisas opcionais:</strong> uma pergunta por vez, no máximo a cada 30 dias.
          Você pode pular.
        </p>
      </div>
      {loading ? (
        <p role="status" className="text-sm">
          Carregando escolhas…
        </p>
      ) : (
        <>
          {(
            [
              [
                "analytics",
                "Ajudar a melhorar o app",
                "Permitir registros opcionais de uso. Ao desligar e salvar, os registros detalhados anteriores são apagados.",
              ],
              [
                "surveys",
                "Participar de pesquisas",
                "Receber perguntas discretas sobre preferências, sem interromper suas reservas.",
              ],
              [
                "marketing",
                "Receber ofertas",
                "Permitir comunicações promocionais. Avisos de reservas são separados.",
              ],
            ] as const
          ).map(([key, label, description]) => (
            <label
              key={key}
              className="flex items-start justify-between gap-4 rounded-xl border border-border bg-background/60 p-3"
            >
              <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
              </span>
              <Switch
                aria-label={label}
                checked={preferences[key]}
                disabled={busy || !!error}
                onCheckedChange={(checked) => {
                  setPreferences((current) => ({ ...current, [key]: checked }));
                  setMessage("");
                }}
              />
            </label>
          ))}
          <button
            type="button"
            disabled={busy || !!error}
            onClick={() => void save()}
            className="w-full rounded-xl bg-primary p-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Salvando…" : "Salvar escolhas"}
          </button>
          <SurveyCatalog compact />
          <section
            aria-label="Minhas respostas"
            className="rounded-xl border border-border bg-background/60 p-4 text-sm"
          >
            <h4 className="font-semibold">Minhas respostas</h4>
            {!responses.some((row) => row.state === "answered") && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Você ainda não tem respostas salvas. Para receber perguntas opcionais, ative
                “Participar de pesquisas” e toque em “Salvar escolhas”. Elas aparecem no Início
                quando você estiver elegível, respeitando o intervalo mínimo de 30 dias.
                {demo &&
                  " No demo, as respostas ficam apenas nesta sessão e são reiniciadas ao entrar novamente."}
              </p>
            )}
            <div className="mt-3 space-y-3">
              {responses
                .filter((row) => row.state === "answered")
                .map((row) => (
                  <div key={row.id}>
                    <p>{questions[row.question]?.title}</p>
                    {row.source === "shop_staff" && (
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                        Informado por você à equipe
                      </p>
                    )}
                    {row.appointment_starts_at && (
                      <p className="text-xs text-muted-foreground">
                        Atendimento de{" "}
                        {new Date(row.appointment_starts_at).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {(questions[row.question]?.options as Record<string, string>)?.[
                        row.answer ?? ""
                      ] ?? "Não informado"}
                    </p>
                  </div>
                ))}
            </div>
          </section>
          <DataRights />
          <button
            type="button"
            onClick={() => setConfirmErase(true)}
            disabled={busy}
            className="text-xs text-destructive underline"
          >
            Apagar respostas e dados opcionais
          </button>
          {confirmErase && (
            <div className="space-y-3 rounded-xl border border-destructive/30 p-3 text-xs">
              <p>
                Apagar respostas e registros opcionais? As reservas, sua conta e o histórico das
                escolhas de privacidade serão preservados.
              </p>
              <div className="flex gap-4">
                <button
                  disabled={busy}
                  onClick={() => void save(true)}
                  className="font-bold text-destructive"
                >
                  Confirmar exclusão
                </button>
                <button disabled={busy} onClick={() => setConfirmErase(false)}>
                  Voltar
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {error && (
        <div role="alert" className="text-xs text-destructive">
          {error}{" "}
          <button
            onClick={() => {
              setError("");
              setVersion((v) => v + 1);
            }}
            className="underline"
          >
            Tentar novamente
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
    </section>
  );
}
