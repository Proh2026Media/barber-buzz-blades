import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRef } from "react";
import { CalendarCheck, Loader2, Plus, Repeat, RotateCcw, Star, UserRound } from "lucide-react";
import { IconList, Notice, PersonAvatar } from "@/components/visual";
import { useI18n } from "@/lib/i18n";

type ShopJoinDialogProps = {
  open: boolean;
  shopName: string;
  busy?: boolean;
  /** Falha ao entrar: aparece dentro da janela, com "Tentar de novo". */
  error?: string | null;
  /** A conta é da equipe desta loja: entrar cria a ficha de cliente dela aqui. */
  ownTeam?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
};

/**
 * Confirmação explícita ao abrir o link de uma barbearia ainda não vinculada: a identidade da
 * loja, o que muda (três itens com ícone) e um botão que diz o resultado ("Entrar na …").
 */
export function ShopJoinDialog({
  open,
  shopName,
  busy = false,
  error = null,
  ownTeam = false,
  onConfirm,
  onDismiss,
}: ShopJoinDialogProps) {
  const { t } = useI18n();
  const confirmRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onDismiss();
      }}
    >
      <AlertDialogContent
        className="max-w-md gap-5 rounded-3xl border-border bg-card"
        onOpenAutoFocus={(event) => {
          // Foco no botão principal (entrar), não em "Agora não", que parecia já escolhido.
          event.preventDefault();
          confirmRef.current?.focus();
        }}
      >
        <AlertDialogHeader className="items-center gap-3 text-center sm:text-center">
          <PersonAvatar name={shopName} seed={shopName} size="lg" />
          <AlertDialogTitle className="text-xl font-bold leading-snug">
            {t("conta.join.title", { shop: shopName })}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm">
            {t("conta.join.subtitle")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <IconList
          size="md"
          label={t("conta.join.whatChanges")}
          className="rounded-2xl border border-border bg-background/60 p-3"
          items={[
            { icon: CalendarCheck, text: t("conta.join.book"), key: "book" },
            { icon: Star, text: t("conta.join.points"), key: "points" },
            { icon: Repeat, text: t("conta.join.others"), key: "others" },
          ]}
        />
        {ownTeam && (
          <Notice tone="info" icon={UserRound} role="none" title={t("conta.join.ownTeam")} />
        )}
        {error && (
          <Notice
            tone="danger"
            title={error}
            action={{ label: t("visual.retry"), icon: RotateCcw, onClick: onConfirm }}
          />
        )}
        <AlertDialogFooter className="grid gap-2 sm:grid-cols-2 sm:space-x-0">
          <button
            type="button"
            disabled={busy}
            onClick={onDismiss}
            className="min-h-11 w-full rounded-xl border border-border bg-card px-4 text-sm font-semibold transition hover:border-primary/40 disabled:opacity-60"
          >
            {t("join.notNow")}
          </button>
          <button
            ref={confirmRef}
            type="button"
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={onConfirm}
            className="action-button action-confirm min-h-11 w-full"
          >
            {busy ? (
              <Loader2 className="motion-safe:animate-spin" aria-hidden />
            ) : (
              <Plus aria-hidden />
            )}
            {busy ? t("join.confirming") : t("conta.join.confirm", { shop: shopName })}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
