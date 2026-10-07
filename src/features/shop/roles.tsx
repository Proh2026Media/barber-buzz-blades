import { BadgeCheck, Crown, Handshake, Headset, Users, type LucideIcon } from "lucide-react";
import { StatusBadge, type Tone } from "@/components/visual";
import { useI18n, type MessageKey } from "@/lib/i18n";

export type ShopRole = "owner" | "partner" | "associate" | "employee";

/**
 * Um só jeito de mostrar cada papel da equipe (mesmo ícone, cor e nome em todo o painel):
 * cabeçalho, pessoas e papéis, convite, permissões e decisões. O papel antigo "partner"
 * aparece igual ao de dono — a diferença é só histórica.
 */
export const ROLE_META: Record<ShopRole, { icon: LucideIcon; tone: Tone; label: MessageKey }> = {
  owner: { icon: Crown, tone: "highlight", label: "eq.role.owner" },
  partner: { icon: Crown, tone: "highlight", label: "eq.role.owner" },
  // Papel não é estado: tom neutro com ícone (o azul fica para "Confirmado/agendado").
  associate: { icon: Handshake, tone: "neutral", label: "eq.role.associate" },
  employee: { icon: Users, tone: "neutral", label: "eq.role.employee" },
};

/** Quem fundou a barbearia: não pode ser pausado nem perder o papel de dono. */
export const FOUNDER_META = {
  icon: BadgeCheck,
  tone: "highlight" as Tone,
  label: "eq.role.founder",
};

/** Gerente de conta da plataforma (pedidos com prazo). */
export const MANAGER_META = { icon: Headset, tone: "neutral" as Tone, label: "eq.role.manager" };

export function isOwnerRole(role: string | null | undefined): role is "owner" | "partner" {
  return role === "owner" || role === "partner";
}

export function roleMeta(role: string | null | undefined) {
  return ROLE_META[(role as ShopRole) in ROLE_META ? (role as ShopRole) : "employee"];
}

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

/** 60 → "60"; 33.33 → "33,33" (na língua da tela). */
export function formatPercent(value: number, locale?: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Number(value));
}
