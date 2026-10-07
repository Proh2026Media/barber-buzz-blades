import type { Tables } from "@/integrations/supabase/types";

/** "applied": já valeu. "pending": foi para a aprovação dos sócios. */
export type SaveOutcome = "applied" | "pending";

/** O que o formulário de serviço envia para o painel gravar. */
export type ServiceDraft = {
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
  /** null = usa a folga da barbearia. */
  prep_minutes: number | null;
  icon: string;
  /** Só parceiro: sugerir o mesmo preço/duração aos outros parceiros. */
  suggestToPartners?: boolean;
};

export type ServiceSaveResult = {
  outcome: SaveOutcome;
  /** Parceiro que pediu a sugestão: "sent" ou "failed". */
  suggestion?: "sent" | "failed";
};

/** O que o formulário do profissional envia para o painel gravar. */
export type StaffDraft = {
  display_name: string;
  booking_slug: string;
  bio: string | null;
  avatar_url: string | null;
};

/** Mudanças à espera dos sócios, por id do serviço/profissional. */
export type AwaitingApproval = Record<string, string>;

/** Termos de quem faz cada serviço (mesma leitura do app do cliente). */
export type ServiceTerm = {
  staff_id: string;
  service_id: string;
  duration_minutes: number;
  price_cents: number;
};

/** Papel de quem entra no painel, ligado ao profissional pelo staff_id. */
export type TeamAccess = {
  staff_id: string;
  role: "owner" | "partner" | "associate" | "employee";
  ownership_percent: number | null;
  active: boolean;
};

export type ServiceRow = Tables<"services">;
export type StaffRow = Tables<"staff">;

/** Exclusão recusada porque o item tem agendamentos no histórico. */
export class HasBookingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HasBookingsError";
  }
}
