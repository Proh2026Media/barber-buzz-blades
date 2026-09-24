import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, MessageCircle, Scissors, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_LOGIN_IMAGE } from "@/lib/shop/branding";

type Step = "dados" | "otp" | "conta";

export const Route = createFileRoute("/cadastrar")({
  ssr: false,
  component: CadastrarPage,
});

async function callRegisterShop(body: Record<string, unknown>) {
  const base = import.meta.env.VITE_SUPABASE_URL || "";
  const response = await fetch(`${base}/functions/v1/register-shop`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as {
    ok?: boolean;
    error?: string;
    message?: string;
    destination?: string;
    verification_token?: string;
    email?: string;
    shop_slug?: string;
  };
  if (!response.ok) throw new Error(payload.error || "Falha no cadastro");
  return payload;
}

const STEPS: { id: Step; label: string }[] = [
  { id: "dados", label: "Dados" },
  { id: "otp", label: "WhatsApp" },
  { id: "conta", label: "Pronto" },
];

function CadastrarPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("dados");
  const [shopName, setShopName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const stepIndex = STEPS.findIndex((row) => row.id === step);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (!shopName.trim() || !fullName.trim() || !email.trim() || password.length < 6) {
        throw new Error("Preencha barbearia, nome, e-mail e senha (mín. 6).");
      }
      if (!whatsapp.trim()) throw new Error("Informe o WhatsApp com DDD.");
      const payload = await callRegisterShop({
        action: "request",
        destination: whatsapp.trim(),
      });
      setDestination(payload.destination || whatsapp.trim());
      setInfo(payload.message || "Código enviado no WhatsApp.");
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o código.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const payload = await callRegisterShop({
        action: "verify",
        destination: destination || whatsapp.trim(),
        code: otpCode.trim(),
      });
      if (!payload.verification_token) throw new Error("Verificação incompleta.");
      setInfo("WhatsApp confirmado. Finalizando o cadastro…");
      setStep("conta");
      await finishRegister(payload.verification_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido.");
      setBusy(false);
    }
  }

  async function finishRegister(token: string) {
    setBusy(true);
    setError(null);
    try {
      const payload = await callRegisterShop({
        action: "register",
        verification_token: token,
        shop_name: shopName.trim(),
        full_name: fullName.trim(),
        email: email.trim(),
        password,
      });
      const { error: signError } = await supabase.auth.signInWithPassword({
        email: payload.email || email.trim(),
        password,
      });
      if (signError) {
        setInfo("Barbearia criada. Entre com o e-mail e a senha.");
        await navigate({ to: "/auth", search: { next: "/shop" } });
        return;
      }
      await navigate({ to: "/shop" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar a barbearia.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="platform-register mb-page min-h-dvh text-foreground">
      <div className="platform-register-photo" aria-hidden="true">
        <img src={DEFAULT_LOGIN_IMAGE} alt="" />
        <span />
      </div>

      <div className="platform-register-stage">
        <Link to="/" className="platform-register-back">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </Link>

        <div className="platform-register-panel">
          <div className="platform-register-brand">
            <span className="platform-landing-mark" aria-hidden="true">
              <Scissors className="size-5" />
            </span>
            <div>
              <p className="platform-register-brand-name">Barba &amp; Cabelo</p>
              <p className="text-xs text-muted-foreground">Abrir minha barbearia</p>
            </div>
          </div>

          <ol className="platform-register-steps" aria-label="Etapas do cadastro">
            {STEPS.map((row, index) => {
              const state =
                index < stepIndex ? "done" : index === stepIndex ? "current" : "todo";
              return (
                <li key={row.id} data-state={state}>
                  <span aria-hidden="true">{index + 1}</span>
                  {row.label}
                </li>
              );
            })}
          </ol>

          <h1 className="platform-register-title">
            {step === "dados" && "Dados da sua loja"}
            {step === "otp" && "Confirme o WhatsApp"}
            {step === "conta" && "Quase lá"}
          </h1>
          <p className="platform-register-lead">
            {step === "dados" &&
              "Preencha os dados. Em seguida enviamos um código no WhatsApp para confirmar."}
            {step === "otp" && "Digite o código de 6 dígitos que enviamos agora."}
            {step === "conta" && "Criando sua conta e a barbearia…"}
          </p>

          {step === "dados" && (
            <form onSubmit={sendCode} className="platform-register-form">
              <label className="platform-register-label">
                Nome da barbearia
                <input
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="platform-register-input"
                  placeholder="Ex.: Externa Barbearia"
                />
              </label>
              <label className="platform-register-label">
                Seu nome
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="platform-register-input"
                  placeholder="Como os clientes vão te chamar"
                />
              </label>
              <div className="platform-register-grid">
                <label className="platform-register-label">
                  E-mail
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="platform-register-input"
                  />
                </label>
                <label className="platform-register-label">
                  Senha
                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="platform-register-input"
                  />
                </label>
              </div>
              <label className="platform-register-label">
                WhatsApp (com DDD)
                <input
                  required
                  inputMode="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="platform-register-input"
                  placeholder="11 99999-9999"
                />
              </label>
              <p className="platform-register-note">
                <MessageCircle className="size-3.5 shrink-0" aria-hidden="true" />
                Usamos este número só para confirmar o cadastro e avisos importantes da conta.
              </p>
              <button type="submit" disabled={busy} className="platform-register-submit">
                {busy ? "Enviando…" : "Enviar código no WhatsApp"}
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={verifyCode} className="platform-register-form">
              <p className="platform-register-otp-dest">
                Código enviado para{" "}
                <span className="font-semibold text-foreground">{destination}</span>
              </p>
              <label className="platform-register-label">
                Código de 6 dígitos
                <input
                  required
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="platform-register-input platform-register-otp"
                  autoComplete="one-time-code"
                />
              </label>
              <button
                type="submit"
                disabled={busy || otpCode.length !== 6}
                className="platform-register-submit"
              >
                {busy ? "Confirmando…" : "Confirmar e criar barbearia"}
              </button>
              <button
                type="button"
                disabled={busy}
                className="platform-register-linkish"
                onClick={() => {
                  setStep("dados");
                  setOtpCode("");
                }}
              >
                Voltar e corrigir dados
              </button>
            </form>
          )}

          {step === "conta" && (
            <div className="platform-register-finishing" role="status">
              <ShieldCheck className="size-8 text-gold" aria-hidden="true" />
              <p>{busy ? "Criando conta e barbearia…" : info}</p>
            </div>
          )}

          {info && step !== "conta" && (
            <p className="platform-register-info" role="status">
              {info}
            </p>
          )}
          {error && (
            <p className="platform-register-error" role="alert">
              {error}
            </p>
          )}

          <p className="platform-register-footer">
            Já tem conta?{" "}
            <Link to="/auth" search={{ next: "/shop" }}>
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
