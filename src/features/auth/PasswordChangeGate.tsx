import { useRef, type RefObject } from "react";
import type { Session } from "@supabase/supabase-js";
import { KeyRound, LogOut } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChangePasswordCard } from "@/features/auth/ChangePasswordCard";
import { supabase } from "@/integrations/supabase/client";
import { mustChangePassword } from "@/lib/auth/password-change";
import { useAuthSession } from "@/lib/auth/use-auth-session";
import { useI18n } from "@/lib/i18n";

/**
 * Conta criada por convite com senha temporária: antes de usar o app, a pessoa cria uma senha
 * só dela. A janela não fecha sem salvar; a única outra saída é sair da conta.
 * Conta sem a marca (ou função de convite antiga no servidor): a janela nunca aparece.
 * Nunca na demonstração — quem chama passa `disabled`.
 */
export function PasswordChangeGate({
  disabled = false,
  userId,
}: {
  disabled?: boolean;
  userId: string | null;
}) {
  const { session, currentSession } = useAuthSession(disabled);
  const user = session?.user;
  if (disabled) return null;
  if (!user || user.id !== userId || !mustChangePassword(user)) return null;
  // Uma conta nova nunca herda os campos da senha anterior.
  return <PasswordPrompt key={user.id} userId={user.id} currentSession={currentSession} />;
}

function PasswordPrompt({
  userId,
  currentSession,
}: {
  userId: string;
  currentSession: RefObject<Session | null>;
}) {
  const { t } = useI18n();
  const titleRef = useRef<HTMLHeadingElement>(null);

  async function signOut() {
    if (currentSession.current?.user.id !== userId) return;
    await supabase.auth.signOut();
    if (!currentSession.current || currentSession.current.user.id === userId) {
      window.location.assign("/auth");
    }
  }

  return (
    <AlertDialog open>
      <AlertDialogContent
        className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-md gap-4 overflow-y-auto rounded-[var(--panel-radius)] p-5 sm:p-6"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--control-radius)] bg-primary/10 text-primary">
            <KeyRound className="size-5" aria-hidden="true" />
          </span>
          <AlertDialogTitle
            ref={titleRef}
            tabIndex={-1}
            className="min-w-0 self-center text-lg font-bold leading-snug text-foreground outline-none"
          >
            {t("password.gate.title")}
          </AlertDialogTitle>
        </div>
        <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
          {t("password.gate.lead")}
        </AlertDialogDescription>
        <ChangePasswordCard
          heading={false}
          onSaved={() => {
            if (currentSession.current?.user.id === userId) {
              toast.success(t("password.gate.saved"));
            }
          }}
        />
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--button-radius)] px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          <LogOut className="size-4" aria-hidden="true" />
          {t("profile.signOut")}
        </button>
      </AlertDialogContent>
    </AlertDialog>
  );
}
