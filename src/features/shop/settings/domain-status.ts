import { AlertTriangle, CheckCircle2, Hourglass, Link2, type LucideIcon } from "lucide-react";
import type { Tone } from "@/components/visual";
import type { MessageKey } from "@/lib/i18n";

export type DomainStatus = "none" | "pending_dns" | "active" | "error";

/**
 * Situação do domínio próprio: o mesmo selo (tom, ícone e nome) no menu de Ajustes e no cartão
 * do domínio, para a mesma situação nunca aparecer com nomes ou cores diferentes.
 */
export const DOMAIN_BADGE: Record<
  DomainStatus,
  { tone: Tone; icon: LucideIcon; label: MessageKey }
> = {
  none: { tone: "neutral", icon: Link2, label: "settingsHub.domain.none" },
  pending_dns: { tone: "pending", icon: Hourglass, label: "settingsHub.domain.pending" },
  error: { tone: "warning", icon: AlertTriangle, label: "settingsHub.domain.error" },
  active: { tone: "success", icon: CheckCircle2, label: "settingsHub.domain.active" },
};
