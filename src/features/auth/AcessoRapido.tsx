import { useEffect, useRef, useState, type FormEvent } from "react";
import { Fingerprint, Mail, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { suportaChave } from "@/lib/auth/agendamento-rapido";

export function AcessoRapido({
  aoEntrar,
  usarSenha,
}: {
  aoEntrar: () => Promise<void>;
  usarSenha: () => void;
}) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [destino, setDestino] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const trava = useRef(false);
  const [erro, setErro] = useState("");
  const campoCodigo = useRef<HTMLInputElement>(null);
  const [espera, setEspera] = useState(0);
  useEffect(() => {
    if (destino) campoCodigo.current?.focus();
  }, [destino]);
  useEffect(() => {
    if (!espera) return;
    const timer = setTimeout(() => setEspera((v) => Math.max(v - 1, 0)), 1000);
    return () => clearTimeout(timer);
  }, [espera]);

  async function executar(tarefa: () => Promise<void>, mensagem: string) {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    setErro("");
    try {
      await tarefa();
    } catch {
      setErro(mensagem);
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }

  async function enviar() {
    const alvo = email.trim();
    const { error } = await supabase.auth.signInWithOtp({
      email: alvo,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: window.location.origin + "/auth",
      },
    });
    if (error && !["user_not_found", "signup_disabled", "otp_disabled"].includes(error.code ?? ""))
      throw error;
    setDestino(alvo);
    setCodigo("");
    setEspera(60);
  }

  function confirmar(e: FormEvent) {
    e.preventDefault();
    if (!destino) {
      void executar(enviar, t("auth.error.sendCode"));
      return;
    }
    void executar(async () => {
      const { data, error } = await supabase.auth.verifyOtp({
        email: destino,
        token: codigo.trim(),
        type: "email",
      });
      if (error || !data.session) throw error ?? new Error();
      await aoEntrar();
    }, t("auth.error.invalidCode"));
  }
  return (
    <div className="grid gap-3">
      {suportaChave() && (
        <button
          type="button"
          className="acesso-google"
          disabled={ocupado}
          onClick={() =>
            void executar(async () => {
              const { data, error } = await supabase.auth.signInWithPasskey();
              if (error || !data.session) throw error ?? new Error();
              await aoEntrar();
            }, t("rapido.chaveAlternativa"))
          }
        >
          <Fingerprint aria-hidden="true" />
          {t("rapido.chaveEntrar")}
        </button>
      )}
      <form className="acesso-form" onSubmit={confirmar}>
        {!destino ? (
          <label className="grid gap-1">
            {t("auth.field.email")}
            <input
              className="min-h-12 w-full rounded-[var(--button-radius)] border border-border bg-background px-3 text-base text-foreground"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        ) : (
          <>
            <p role="status">{t("rapido.enviado", { email: destino })}</p>
            <label className="grid gap-1">
              {t("rapido.codigo")}
              <input
                ref={campoCodigo}
                className="min-h-12 w-full rounded-[var(--button-radius)] border border-border bg-background px-3 text-base text-foreground"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                pattern="[0-9]{6,10}"
                maxLength={10}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              />
            </label>
          </>
        )}
        <button className="acesso-botao" disabled={ocupado}>
          {destino ? <KeyRound aria-hidden="true" /> : <Mail aria-hidden="true" />}
          {t(destino ? "rapido.continuar" : "rapido.emailEntrar")}
        </button>
      </form>
      {destino && (
        <div className="flex flex-wrap gap-2">
          <button
            className="action-button"
            type="button"
            disabled={ocupado || espera > 0}
            onClick={() => void executar(enviar, t("auth.error.sendCode"))}
          >
            {t("rapido.reenviar")}
            {espera > 0 && ` (${espera}s)`}
          </button>
          <button
            className="action-button"
            type="button"
            disabled={ocupado}
            onClick={() => {
              setDestino("");
              setCodigo("");
              setErro("");
            }}
          >
            {t("rapido.trocar")}
          </button>
        </div>
      )}
      {erro && <p role="alert">{erro}</p>}
      <button className="action-button" type="button" disabled={ocupado} onClick={usarSenha}>
        {t("rapido.senha")}
      </button>
    </div>
  );
}

export function AtivarChave() {
  const { t } = useI18n();
  const [exibir, setExibir] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<"sucesso" | "erro" | null>(null);
  useEffect(() => {
    let atual = true;
    if (suportaChave())
      void supabase.auth.passkey
        .list()
        .then(({ data, error }) => {
          if (atual && !error && data?.length === 0) setExibir(true);
        })
        .catch(() => {});
    return () => {
      atual = false;
    };
  }, []);
  if (!exibir) return null;
  if (resultado === "sucesso") return <p role="status">{t("rapido.chaveAtiva")}</p>;
  return (
    <div className="mt-4 grid gap-2">
      <button
        type="button"
        className="action-button action-confirm"
        disabled={ocupado}
        onClick={async () => {
          setOcupado(true);
          try {
            const { error } = await supabase.auth.registerPasskey();
            setResultado(error ? "erro" : "sucesso");
          } catch {
            setResultado("erro");
          } finally {
            setOcupado(false);
          }
        }}
      >
        <Fingerprint aria-hidden="true" />
        {t("rapido.chaveAtivar")}
      </button>
      {resultado === "erro" && <p role="status">{t("rapido.chaveAdiada")}</p>}
    </div>
  );
}
