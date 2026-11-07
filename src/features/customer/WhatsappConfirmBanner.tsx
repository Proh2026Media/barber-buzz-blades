import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { Session } from "@supabase/supabase-js";
import { MessageCircle, ShieldCheck } from "lucide-react";
import { IconTile } from "@/components/visual";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/lib/auth/use-auth-session";
import { useI18n } from "@/lib/i18n";
import { WhatsappProfileCard } from "./WhatsappProfileCard";

/**
 * Aviso de WhatsApp gravado e ainda não confirmado por código.
 *
 * Cliente: aparece quando há número, avisos ligados e nenhuma confirmação.
 * Dono/sócio (`variant="owner"`): aparece quando o número do perfil não está confirmado.
 * "Confirmar agora" abre o mesmo fluxo de Meu perfil (WhatsappProfileCard → auth-otp
 * `verify_phone`); nada de lógica de código aqui. "Agora não" esconde até a próxima
 * sessão do navegador (sessionStorage).
 *
 * Banco sem a coluna `whatsapp_verified_at`: o aviso não aparece.
 */

const DISMISS_KEY = "mb_whatsapp_confirm_dismissed_v1";

function dismissedFor(userId: string) {
  try {
    return window.sessionStorage.getItem(`${DISMISS_KEY}:${userId}`) === "1";
  } catch {
    return false;
  }
}

function dismiss(userId: string) {
  try {
    window.sessionStorage.setItem(`${DISMISS_KEY}:${userId}`, "1");
  } catch {
    // Armazenamento bloqueado: some só enquanto esta tela estiver aberta.
  }
}

/** +5511999990000 → (11) 99999-0000; outros países ficam como gravados. */
function displayNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  const br = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digits);
  return br ? `(${br[1]}) ${br[2]}-${br[3]}` : value;
}

/** Faixa lateral na cor do tom (estilo em linha: `.app-action-card` manda na borda). */
const ACCENT_EDGE = {
  borderInlineStartWidth: 4,
  borderInlineStartColor: "var(--tone-line)",
} as const;

type Pending = { userId: string; number: string; optIn: boolean };

type Props = {
  /** Conta à qual pertence o ambiente aberto. */
  userId: string | null;
  /** Demonstração: o aviso nunca aparece. */
  disabled?: boolean;
  variant?: "customer" | "owner";
  /** Esconde o cartão sem perder o estado (ex.: enquanto outra etapa do cadastro está aberta). */
  hidden?: boolean;
  /** Avisa se há confirmação pendente (para o contador de etapas do cadastro). */
  onVisibleChange?: (visible: boolean) => void;
  /** Indicador de etapas, acima do título. */
  header?: ReactNode;
};

export function WhatsappConfirmBanner(props: Props) {
  const { disabled = false, userId, variant = "customer", onVisibleChange } = props;
  const { session, currentSession } = useAuthSession(disabled);
  const eligible = !disabled && !!userId && session?.user.id === userId;

  useEffect(() => {
    if (!eligible) onVisibleChange?.(false);
  }, [eligible, onVisibleChange]);

  if (disabled) return null;
  if (!eligible || !userId) return null;
  return (
    <AccountWhatsappBanner
      key={`${userId}:${variant}`}
      {...props}
      userId={userId}
      currentSession={currentSession}
    />
  );
}

function AccountWhatsappBanner({
  userId,
  variant = "customer",
  hidden = false,
  onVisibleChange,
  header,
  currentSession,
}: Props & { userId: string; currentSession: RefObject<Session | null> }) {
  const { t } = useI18n();
  const [pending, setPending] = useState<Pending | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const active = useRef(false);
  const readVersion = useRef(0);
  const dismissed = useRef(false);

  const check = useCallback(async () => {
    const version = ++readVersion.current;
    let result: Pending | null = null;
    try {
      if (dismissed.current || dismissedFor(userId)) return;
      if (currentSession.current?.user.id !== userId) return;
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error || !profile) return;
      const row = profile as unknown as Record<string, unknown>;
      if (!("whatsapp_verified_at" in row)) return;
      const number = typeof row.whatsapp_e164 === "string" ? row.whatsapp_e164 : "";
      const optIn = Boolean(row.whatsapp_opt_in_at);
      if (!number || row.whatsapp_verified_at) return;
      if (variant === "customer" && !optIn) return;
      result = { userId, number, optIn };
    } catch {
      // Sem perfil/rede, o aviso continua dispensável.
    } finally {
      if (
        active.current &&
        version === readVersion.current &&
        currentSession.current?.user.id === userId &&
        !dismissed.current
      ) {
        setPending(result);
      }
    }
  }, [userId, variant, currentSession]);

  useEffect(() => {
    active.current = true;
    void check();
    return () => {
      active.current = false;
      readVersion.current++;
    };
  }, [check]);

  const visible = Boolean(pending);
  useEffect(() => {
    onVisibleChange?.(visible);
  }, [onVisibleChange, visible]);

  function later() {
    if (currentSession.current?.user.id !== userId) return;
    dismissed.current = true;
    readVersion.current++;
    dismiss(userId);
    setPending(null);
  }

  function onDialogChange(next: boolean) {
    if (currentSession.current?.user.id !== userId) return;
    setDialogOpen(next);
    // Reabrir invalida a conferência anterior; dispensar nunca é desfeito por uma resposta.
    if (next) readVersion.current++;
    else void check();
  }

  if (!pending || hidden) return null;

  const owner = variant === "owner";

  return (
    <>
      <section
        aria-labelledby="whatsapp-confirm-title"
        className="app-action-card tone-warning space-y-3 p-4"
        style={ACCENT_EDGE}
      >
        {header}
        <div className="flex items-start gap-3">
          <IconTile icon={MessageCircle} tone="warning" />
          <div className="min-w-0">
            <h2
              id="whatsapp-confirm-title"
              className="text-base font-semibold leading-snug text-foreground"
            >
              {owner ? t("dec.whats.titleOwner") : t("dec.whats.title")}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t(owner ? "dec.whats.textOwner" : "dec.whats.text", {
                number: displayNumber(pending.number),
              })}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={later}
            className="flex min-h-11 items-center justify-center rounded-[var(--button-radius)] border border-border px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("cad.nome.later")}
          </button>
          <button
            type="button"
            onClick={() => onDialogChange(true)}
            aria-haspopup="dialog"
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--button-radius)] bg-primary px-3 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ShieldCheck className="size-4 shrink-0" aria-hidden />
            {t("dec.whats.confirm")}
          </button>
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={onDialogChange}>
        <DialogContent
          aria-describedby={undefined}
          className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-md gap-3 overflow-y-auto rounded-[var(--panel-radius)] p-4 sm:p-6"
        >
          <DialogTitle className="flex items-center gap-3 pe-10 text-lg font-bold leading-snug">
            <IconTile icon={MessageCircle} tone="warning" />
            {t("dec.whats.dialogTitle")}
          </DialogTitle>
          {!pending.optIn && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("dec.whats.optInNote")}
            </p>
          )}
          {/* O cartão de Meu perfil entra sem a moldura e sem o cabeçalho próprios ("WhatsApp ·
              Não confirmado"): a janela já é o cartão e o título dela já diz isso. As etapas
              Enviar código → Digitar código → Confirmado vêm do próprio cartão. */}
          <WhatsappProfileCard
            userId={userId}
            accountSession={currentSession}
            bare
            demo={false}
            disabled={false}
            initialNumber={pending.number}
            initialOptIn={pending.optIn}
            initialVerified={false}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
