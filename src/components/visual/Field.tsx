import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { useId, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { TONE_CLASS, TONE_TEXT } from "./tones";

type MessageTone = "hint" | "error" | "success" | "warning";

const MESSAGE = {
  hint: { icon: Info, className: "text-muted-foreground" },
  error: { icon: XCircle, className: cn(TONE_CLASS.danger, TONE_TEXT) },
  success: { icon: CheckCircle2, className: cn(TONE_CLASS.success, TONE_TEXT) },
  warning: { icon: AlertTriangle, className: cn(TONE_CLASS.warning, TONE_TEXT) },
} as const;

/** Linha de estado embaixo de um campo: dica, erro (como corrigir), certo ou atenção. */
export function FieldMessage({
  tone = "hint",
  id,
  children,
  className,
}: {
  tone?: MessageTone;
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  const { icon: Icon, className: toneClass } = MESSAGE[tone];
  return (
    <p
      id={id}
      className={cn("flex items-start gap-1.5 text-xs font-semibold", toneClass, className)}
    >
      <Icon className="mt-px size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
};

/**
 * Campo com rótulo visível, dica e erro junto dele. Liga `aria-describedby`, `aria-invalid` e
 * `aria-required` ao controle (a borda vermelha vem do `aria-invalid`, em styles.css). Marca só
 * o que é opcional. Para rolar e focar o primeiro erro ao enviar, use `focusFirstInvalid`.
 *
 * ```tsx
 * <Field label="Nome" error={erro}>{(p) => <input {...p} value={nome} onChange={…} />}</Field>
 * ```
 */
export function Field({
  label,
  hint,
  error,
  success,
  required,
  optional,
  id: idProp,
  children,
  className,
}: {
  label: ReactNode;
  /** Instrução curta antes do erro (formato, para que serve). */
  hint?: ReactNode;
  /** Diz como corrigir ("Informe o celular com DDD."). */
  error?: ReactNode;
  success?: ReactNode;
  required?: boolean;
  /** Mostra "opcional" ao lado do rótulo. */
  optional?: boolean;
  id?: string;
  children: (props: FieldControlProps) => ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = `${id}-hint`;
  const messageId = `${id}-message`;
  const describedBy =
    [hint ? hintId : null, error || success ? messageId : null].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
        {label}
        {optional && (
          <span className="text-xs font-normal text-muted-foreground">{t("visual.optional")}</span>
        )}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-required": required ? true : undefined,
      })}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error ? (
        <FieldMessage id={messageId} tone="error">
          {error}
        </FieldMessage>
      ) : success ? (
        <FieldMessage id={messageId} tone="success">
          {success}
        </FieldMessage>
      ) : null}
    </div>
  );
}
