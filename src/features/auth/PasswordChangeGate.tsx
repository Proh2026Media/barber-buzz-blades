import { useEffect, useRef, useState } from "react";
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
import { useI18n } from "@/lib/i18n";

/**
 * Conta criada por convite com senha temporária: antes de usar o app, a pessoa cria uma senha
 * só dela. A janela não fecha sem salvar; a única outra saída é sair da conta.
 * Conta sem a marca (ou função de convite antiga no servidor): a janela nunca aparece.
 * Nunca na demonstração — quem chama passa `disabled`.
 */
export function PasswordChangeGate({ disabled = false }: { disabled?: boolean }) {
  const { t } = useI18n();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (disabled) return;
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && mustChangePassword(data.session?.user)) setOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, [disabled]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.assign("/auth");
  }

  if (disabled || !open) return null;

  return (
    <AlertDialog open={open}>
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
            setOpen(false);
            toast.success(t("password.gate.saved"));
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
