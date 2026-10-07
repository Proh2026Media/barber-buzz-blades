import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Hint, Notice } from "@/components/visual";
import { useI18n } from "@/lib/i18n";

/**
 * Aviso + botão principal logo abaixo da senha temporária (ela não aparece de novo).
 * Usado com `useTempPasswordClose`, que segura o primeiro fechamento da janela.
 */
export function TempPasswordClose({ warned, onClose }: { warned: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      {warned ? (
        <Notice
          tone="warning"
          role="alert"
          title={t("plat.invite.pwOnce")}
          action={{ label: t("plat.invite.pwCloseAnyway"), onClick: onClose }}
        >
          {t("plat.invite.pwOnceHint")}
        </Notice>
      ) : (
        <Hint icon={AlertTriangle} tone="warning">
          {t("plat.invite.pwOnce")}
        </Hint>
      )}
      <button
        type="button"
        onClick={onClose}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
      >
        <CheckCircle2 className="size-4" aria-hidden />
        {t("plat.invite.pwDone")}
      </button>
    </div>
  );
}
