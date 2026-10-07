import { CheckCircle2, Circle, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Mínimo de caracteres da senha (o mesmo do Auth e do cadastro da barbearia). */
export const PASSWORD_MIN = 6;

/**
 * Regras da senha à vista enquanto a pessoa digita: cada pílula começa como círculo vazio e
 * vira ✓ verde quando a regra é cumprida ("6+ caracteres", "As duas senhas são iguais").
 * Ligue ao campo com `aria-describedby={id}`: o leitor de tela lê as regras e o estado.
 * Com `showErrors` (depois de tentar enviar), a regra não cumprida fica vermelha com ✕.
 */
export function PasswordRules({
  id,
  password,
  confirm,
  showErrors,
  className,
}: {
  id: string;
  password: string;
  /** Com a confirmação, mostra também "As duas senhas são iguais". */
  confirm?: string;
  /** Pinta de vermelho as regras não cumpridas (depois do envio com erro). */
  showErrors?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const rules = [
    { key: "min", ok: password.length >= PASSWORD_MIN, label: t("entry.password.min") },
  ];
  if (confirm !== undefined) {
    rules.push({
      key: "match",
      ok: confirm.length > 0 && confirm === password,
      label: t("entry.password.match"),
    });
  }
  return (
    <ul
      id={id}
      aria-label={t("entry.password.rules")}
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {rules.map((rule) => (
        <li key={rule.key}>
          <StatusBadge
            size="sm"
            tone={rule.ok ? "success" : showErrors ? "danger" : "neutral"}
            icon={rule.ok ? CheckCircle2 : showErrors ? XCircle : Circle}
            label={rule.label}
          />
          <span className="sr-only">
            {" "}
            ({rule.ok ? t("entry.rule.ok") : t("entry.rule.missing")})
          </span>
        </li>
      ))}
    </ul>
  );
}
