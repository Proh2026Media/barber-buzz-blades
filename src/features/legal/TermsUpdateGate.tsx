import { Fragment, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { Session } from "@supabase/supabase-js";
import { CalendarDays, Check, FileCheck2, Loader2 } from "lucide-react";
import { Notice, Tag } from "@/components/visual";
import { LegalDocLinks } from "@/features/auth/entry";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { callOptionalRpc } from "@/lib/auth/optional-rpc";
import { mustChangePassword } from "@/lib/auth/password-change";
import { useAuthSession } from "@/lib/auth/use-auth-session";
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
  /** Conta à qual pertence o ambiente aberto; não exibe dados sobre a tela de outra conta. */
  userId: string | null;
  /** Demonstração ou tela sem conta real: a janela nunca aparece. */
  disabled?: boolean;
  /** Dono/sócio: inclui o Acordo de Tratamento de Dados no aceite. */
  withDpa?: boolean;
  /** Enquanto consulta ou pergunta, as boas-vindas da loja esperam, sem sobrepor janelas. */
  onPendingChange?: (state: TermsUpdateGateState) => void;
};

export type TermsUpdateGateState = {
  userId: string | null;
  withDpa: boolean;
  pending: boolean;
};

export function TermsUpdateGate({
  userId,
  disabled = false,
  withDpa = false,
  onPendingChange,
}: Props) {
  const { session, currentSession } = useAuthSession(disabled);
  const user = session?.user;
  const eligible = !disabled && !!user && user.id === userId && !mustChangePassword(user);

  useEffect(() => {
    if (!eligible) onPendingChange?.({ userId: null, withDpa, pending: true });
  }, [eligible, withDpa, onPendingChange]);

  if (disabled) return null;
  if (!eligible || !userId) return null;
  return (
    <TermsForAccount
      key={`${userId}:${withDpa}`}
      userId={userId}
      withDpa={withDpa}
      currentSession={currentSession}
      onPendingChange={onPendingChange}
    />
  );
}

function TermsForAccount({
  userId,
  withDpa,
  currentSession,
  onPendingChange,
}: {
  userId: string;
  withDpa: boolean;
  currentSession: RefObject<Session | null>;
  onPendingChange?: Props["onPendingChange"];
}) {
  const { t, intlLocale } = useI18n();
  const laterRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const active = useRef(false);
  const submitting = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    active.current = true;
    onPendingChange?.({ userId, withDpa, pending: true });
    void (async () => {
      let outdated = false;
      try {
        if (postponed(userId)) return;
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        if (cancelled || profileError || !profile) return;
        const row = profile as unknown as Record<string, unknown>;
        // Banco sem as colunas de aceite: nada a pedir.
        if (!("terms_accepted_at" in row) || !("terms_version" in row)) return;
        outdated = Boolean(
          !row.terms_accepted_at ||
          row.terms_version !== TERMS_VERSION ||
          row.privacy_version !== PRIVACY_VERSION ||
          (withDpa && "dpa_version" in row && row.dpa_version !== DPA_VERSION),
        );
      } catch {
        // Sem rede ou sem perfil: não pergunta agora.
      } finally {
        const currentUser = currentSession.current?.user;
        if (!cancelled && currentUser?.id === userId && !mustChangePassword(currentUser)) {
          setOpen(outdated);
          onPendingChange?.({ userId, withDpa, pending: outdated });
        }
      }
    })();
    return () => {
      cancelled = true;
      active.current = false;
    };
  }, [userId, withDpa, currentSession, onPendingChange]);

  function stillCurrent() {
    const user = currentSession.current?.user;
    return active.current && user?.id === userId && !mustChangePassword(user);
  }

  function later() {
    if (submitting.current || !stillCurrent()) return;
    postpone(userId);
    setOpen(false);
    onPendingChange?.({ userId, withDpa, pending: false });
  }

  async function agree() {
    if (submitting.current || !stillCurrent()) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    const result = await callOptionalRpc("record_my_terms_acceptance", {
      p_terms_version: TERMS_VERSION,
      p_privacy_version: PRIVACY_VERSION,
      p_dpa_version: withDpa ? DPA_VERSION : null,
      p_age_confirmed: true,
    });
    // Uma resposta de outra conta/versão da janela não fecha nem adia a pergunta atual.
    if (!stillCurrent()) return;
    submitting.current = false;
    setBusy(false);
    if (result.ok || result.missing) {
      // Função ainda ausente no servidor: fecha em silêncio e não pergunta de novo nesta
      // sessão (sem isso a janela voltaria a cada troca de tela).
      if (result.missing) postpone(userId);
      setOpen(false);
      onPendingChange?.({ userId, withDpa, pending: false });
      return;
    }
    setError(t("dec.termos.error"));
  }

  if (!open) return null;

  // A frase jurídica fica igual; os nomes ficam em texto e os links, nas linhas acima.
  const name = (label: string) => <strong className="font-semibold">{label}</strong>;
  const declaration = withDpa ? (
    withSlots(t("cad.dono.termsText"), {
      terms: name(t("cad.dono.termsLink")),
      privacy: name(t("cad.dono.privacyLink")),
      dpa: name(t("cad.dono.dpaLink")),
    })
  ) : (
    <>
      {t("auth.terms.before")} {name(t("auth.terms.link"))} {t("auth.terms.and")}{" "}
      {name(t("auth.privacy.link"))} {t("cad.cliente.terms.age")}
    </>
  );

  // Data da versão vigente (versions.ts), no formato do idioma da tela.
  let versionDate = TERMS_VERSION;
  try {
    versionDate = new Intl.DateTimeFormat(intlLocale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${TERMS_VERSION}T00:00:00Z`));
  } catch {
    // Data fora do formato: mostra a versão como está.
  }

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
        // Foco inicial no título (diz o que é a janela), nunca num link: o anel não cobre o texto.
        // O próximo Tab leva aos documentos e depois a "Agora não" e "Concordo".
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (titleRef.current ?? laterRef.current)?.focus();
        }}
      >
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--control-radius)] bg-primary/10 text-primary">
            <FileCheck2 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1.5">
            <AlertDialogTitle
              ref={titleRef}
              tabIndex={-1}
              className="text-lg font-bold leading-snug text-foreground outline-none"
            >
              {t("entry.terms.title")}
            </AlertDialogTitle>
            <Tag icon={CalendarDays}>{t("entry.terms.version", { date: versionDate })}</Tag>
          </div>
        </div>

        <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
          {t("entry.terms.lead")}
        </AlertDialogDescription>

        <LegalDocLinks withDpa={withDpa} variant="rows" />

        <p className="text-xs leading-relaxed text-muted-foreground">{declaration}</p>

        {error && <Notice tone="danger" title={error} />}

        <div className="grid gap-2 sm:grid-cols-2 sm:items-start">
          <div className="grid gap-1">
            <button
              ref={laterRef}
              type="button"
              disabled={busy}
              onClick={later}
              aria-describedby="terms-later-note"
              className="flex min-h-11 items-center justify-center rounded-[var(--button-radius)] border border-border px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-50"
            >
              {t("dec.termos.later")}
            </button>
            <p id="terms-later-note" className="text-center text-xs text-muted-foreground">
              {t("entry.terms.laterNote")}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void agree()}
            className="action-button action-confirm min-h-11 w-full text-sm"
          >
            {busy ? (
              <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
            ) : (
              <Check aria-hidden="true" />
            )}
            {t("dec.termos.agree")}
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
