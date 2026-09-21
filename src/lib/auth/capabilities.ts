export type ShopCapabilities = {
  viewFullShop: boolean;
  viewMoney: boolean;
  /** Relatórios financeiros completos da loja (permissão `view_financial_all`). */
  viewShopFinancials: boolean;
  editOwnCatalog: boolean;
  /** Editar o catálogo geral da unidade (permissão `manage_services`). */
  manageCatalog: boolean;
  /** Gerenciar equipe (permissão `manage_team`). */
  manageTeam: boolean;
  /** Gerenciar funcionamento e ajustes (permissão `manage_operations`). */
  manageOperations: boolean;
  /** Receber indicadores gerais da loja sem identificação (permissão `view_reports_anonymized`). */
  viewReportsAnonymized: boolean;
  manageSociety: boolean;
  canProposeOperations: boolean;
  canApplyOperations: boolean;
  requiresApproval: boolean;
  viewTeamSchedule: boolean;
};

export type ProfessionalActor = {
  role: "owner" | "partner" | "associate" | "employee";
};

/** Permissões efetivas vindas do banco, no formato `{ permissao: concedida }`. */
export type ShopPermissionMap = Record<string, boolean>;

export function capabilitiesFor(
  actor: ProfessionalActor | null,
  governanceMode: "single" | "equal" | "majority" | null = null,
  canApplyFromDatabase?: boolean,
  permissions?: ShopPermissionMap | null,
): ShopCapabilities | null {
  if (!actor) return null;
  const full = actor.role === "owner" || actor.role === "partner";
  const equalSociety = governanceMode === "equal";
  const canApply = canApplyFromDatabase ?? (full && governanceMode !== "equal");

  // Sem a matriz carregada valem os padrões por papel, que reproduzem o
  // comportamento anterior. Com a matriz, ela decide as capacidades abaixo.
  const allowed = (permission: string, fallback: boolean) =>
    permissions && typeof permissions[permission] === "boolean"
      ? permissions[permission]!
      : fallback;

  return {
    viewFullShop: allowed("view_agenda_all", full),
    // Valores do dia e o próprio recebimento (dono, sócio e parceiro no padrão).
    viewMoney: allowed("view_money", actor.role !== "employee"),
    // Relatórios financeiros completos da loja, que liberam a RPC de indicadores.
    viewShopFinancials: allowed("view_financial_all", full),
    editOwnCatalog: allowed("manage_own_services", actor.role === "associate"),
    manageCatalog: allowed("manage_services", full),
    manageTeam: allowed("manage_team", full),
    manageOperations: allowed("manage_operations", full),
    viewReportsAnonymized: allowed("view_reports_anonymized", actor.role === "associate"),
    // Governança societária continua dependendo do papel e do modo da sociedade,
    // não da matriz: é uma decisão de sociedade, não uma capacidade de trabalho.
    manageSociety: canApply,
    canProposeOperations: full,
    canApplyOperations: canApply,
    requiresApproval: full && equalSociety,
    viewTeamSchedule: true,
  };
}
