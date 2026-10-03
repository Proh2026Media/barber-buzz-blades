import { Fragment, useEffect, useState, type ReactNode } from "react";
import { FileCheck2, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { callOptionalRpc } from "@/lib/auth/optional-rpc";
import { useI18n } from "@/lib/i18n";
import { DPA_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "./versions";

/**
 * Aceite único dos Termos e da Política para contas antigas (ou versões novas).
 *
 * Depois do login, se o perfil não tem aceite registrado ou aceitou versões diferentes das
 * vigentes (`versions.ts`), abre uma janela curta. "Concordo" grava pela RPC
 * `record_my_terms_acceptance` (dono/sócio também com o Acordo de Tratamento de Dados).
 * "Agora não" adia até a próxima sessão do navegador (sessionStorage) e não bloqueia nada.
 *
 * Banco antigo (sem as colunas de aceite ou sem a RPC): a janela não aparece.
 * Nunca na demonstração — quem chama passa `disabled`.
 */

const LATER_KEY = "mb_terms_update_later_v1";

function postponed(userId: string) {
  try {
    return window.sessionStorage.getItem(`${LATER_KEY}:${userId}`) === "1";
  } catch {
    return false;
  }
}

function postpone(userId: string) {
  try {
    window.sessionStorage.setItem(`${LATER_KEY}:${userId}`, "1");
  } catch {
    // Armazenamento bloqueado: some só enquanto esta tela estiver aberta.
  }
}

/** Troca {chave} do texto traduzido por elementos (links dentro da frase). */
function withSlots(text: string, slots: Record<string, ReactNode>) {
  return text.split(/(\{\w+\})/g).map((part, index) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return <Fragment key={index}>{name && name in slots ? slots[name] : part}</Fragment>;
  });
}

type Props = {
  /** Demonstração ou tela sem conta real: a janela nunca aparece. */
  disabled?: boolean;
  /** Dono/sócio: inclui o Acordo de Tratamento de Dados no aceite. */
  withDpa?: boolean;
};

export function TermsUpdateGate({ disabled = false, withDpa = false }: Props) {
  const { t, locale } = useI18n();
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (disabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        if (!user || cancelled || postponed(user.id)) return;
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled || profileError || !profile) return;
        const row = profile as unknown as Record<string, unknown>;
        // Banco sem as colunas de aceite: nada a pedir.
        if (!("terms_accepted_at" in row) || !("terms_version" in row)) return;
        const outdated =
          !row.terms_accepted_at ||
          row.terms_version !== TERMS_VERSION ||
          row.privacy_version !== PRIVACY_VERSION ||
          (withDpa && "dpa_version" in row && row.dpa_version !== DPA_VERSION);
        if (!outdated) return;
        setUserId(user.id);
        setOpen(true);
      } catch {
        // Sem rede ou sem perfil: não pergunta agora.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [disabled, withDpa]);

  function later() {
    if (busy) return;
    if (userId) postpone(userId);
    setOpen(false);
  }

  async function agree() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await callOptionalRpc("record_my_terms_acceptance", {
      p_terms_version: TERMS_VERSION,
      p_privacy_version: PRIVACY_VERSION,
      p_dpa_version: withDpa ? DPA_VERSION : null,
      p_age_confirmed: true,
    });
    setBusy(false);
    if (result.ok || result.missing) {
      // Função ainda ausente no servidor: fecha em silêncio e não pergunta de novo nesta
      // sessão (sem isso a janela voltaria a cada troca de tela).
      if (result.missing && userId) postpone(userId);
      setOpen(false);
      return;
    }
    setError(t("dec.termos.error"));
  }

  if (disabled || !open) return null;

  const lang = encodeURIComponent(locale);
  const linkClass =
    "-my-3 inline-flex min-h-11 items-center font-semibold text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const legalLink = (href: string, label: string) => (
    <a
      href={`${href}?lang=${lang}`}
      target="_blank"
      rel="noopener noreferrer"
      className={linkClass}
    >
      {label}
      <span className="sr-only"> {t("cad.cliente.newTab")}</span>
    </a>
  );

  const declaration = withDpa ? (
    withSlots(t("cad.dono.termsText"), {
      terms: legalLink("/termos", t("cad.dono.termsLink")),
      privacy: legalLink("/privacidade", t("cad.dono.privacyLink")),
      dpa: legalLink("/acordo-de-dados", t("cad.dono.dpaLink")),
    })
  ) : (
    <>
      {t("auth.terms.before")} {legalLink("/termos", t("auth.terms.link"))} {t("auth.terms.and")}{" "}
      {legalLink("/privacidade", t("auth.privacy.link"))} {t("cad.cliente.terms.age")}
    </>
  );

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) later();
      }}
    >
      <AlertDialogContent
        className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-md gap-4 overflow-y-auto rounded-[var(--panel-radius)] p-5 sm:p-6"
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--control-radius)] bg-primary/10 text-primary">
            <FileCheck2 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1">
            <AlertDialogTitle className="text-base font-semibold leading-snug text-foreground">
              {t("dec.termos.title")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
              {withDpa ? t("dec.termos.textOwner") : t("dec.termos.text")}
            </AlertDialogDescription>
          </div>
        </div>

        <p className="rounded-[var(--control-radius)] border border-border/70 bg-card p-3 text-sm leading-relaxed text-foreground/85">
          {declaration}
        </p>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={later}
            className="flex min-h-11 items-center justify-center rounded-[var(--button-radius)] border border-border px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {t("dec.termos.later")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void agree()}
            className="flex min-h-11 items-center justify-center gap-2 rounded-[var(--button-radius)] bg-primary px-3 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {t("dec.termos.agree")}
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
