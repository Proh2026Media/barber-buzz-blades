import { useEffect, useState, type RefObject } from "react";
import type { Session } from "@supabase/supabase-js";
import { checkSignupPhone } from "@/lib/auth/signup-phone";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type MessageKey } from "@/lib/i18n";
export type WhatsappStatus = { number: string; verified: boolean; optIn: boolean };

type Props = {
  /** Conta que forneceu os dados iniciais do cartão. */
  userId: string | null;
  /** Na janela, reutiliza a sessão acompanhada pelo aviso, sem atrasar o foco inicial. */
  accountSession?: RefObject<Session | null>;
  demo: boolean;
  disabled: boolean;
  initialNumber: string;
  initialOptIn: boolean;
  initialVerified: boolean;
  /** Avisa a tela de fora (resumo da Conta) quando número, confirmação ou lembretes mudam. */
  onStatusChange?: (status: WhatsappStatus) => void;
  /** id do cartão, para os atalhos do resumo da Conta. */
  id?: string;
  /** Dentro de uma janela: sem moldura e sem cabeçalho próprio (o título é o da janela). */
  bare?: boolean;
  /** Atalho de acesso pessoal: preserva a preferência de lembretes, sem editá-la aqui. */
  loginOnly?: boolean;
  onOpenGroup?: () => void;
};

export function WhatsappProfileCard({
  userId,
  accountSession,
  demo,
  disabled,
  initialNumber,
  id,
}: Props) {
  const { t, locale } = useI18n();
  const [number, setNumber] = useState(initialNumber);
  const [saved, setSaved] = useState(initialNumber);
  const [feedback, setFeedback] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setNumber(initialNumber);
    setSaved(initialNumber);
    setFeedback(null);
  }, [initialNumber, userId]);
  async function save() {
    if (!userId || busy || disabled || demo) return;
    if (number.trim() && !checkSignupPhone(number, locale).ok) {
      setFeedback("cad.cliente.phoneLengthError");
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (
        !session ||
        session.user.id !== userId ||
        (accountSession && accountSession.current?.user.id !== userId)
      )
        throw Error();
      const { data, error } = await supabase
        .rpc("save_my_whatsapp", { p_raw: number.trim(), p_opt_in: false })
        .setHeader("Authorization", "Bearer " + session.access_token);
      if (error || (number.trim() && !data?.whatsapp_e164)) throw Error();
      setNumber(data?.whatsapp_e164 ?? "");
      setSaved(data?.whatsapp_e164 ?? "");
      setFeedback("plat.shop.saved");
    } catch {
      setFeedback("profile.errorSave");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      id={id}
      className="app-action-card space-y-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label className="grid gap-2">
        {t("integr.google.phone")}
        <input
          type="tel"
          autoComplete="tel"
          value={number}
          disabled={disabled || busy || demo}
          onChange={(e) => {
            setNumber(e.target.value);
            setFeedback(null);
          }}
          className="rounded-xl border p-3"
        />
      </label>
      <button className="action-button" disabled={disabled || busy || demo || number === saved}>
        {t("profile.save")}
      </button>
      {feedback && <p role="status">{t(feedback)}</p>}
    </form>
  );
}
