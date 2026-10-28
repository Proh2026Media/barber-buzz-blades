import { StatusBadge } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { isOwnerRole, roleMeta, formatPercent } from "./roles-model";

/** Selo do papel: ícone + cor + nome do dicionário. Opcionalmente com a parte do dono. */
export function RoleBadge({
  role,
  percent,
  size = "sm",
  className,
}: {
  role: string;
  percent?: number | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const { t } = useI18n();
  const meta = roleMeta(role);
  const label =
    isOwnerRole(role) && percent != null
      ? t("eq.role.ownerShare", { percent: formatPercent(percent) })
      : t(meta.label);
  return (
    <StatusBadge
      tone={meta.tone}
      icon={meta.icon}
      label={label}
      size={size}
      className={className}
    />
  );
}
