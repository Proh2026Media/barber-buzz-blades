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

  /* ---- Capacidades com nome (a tela pergunta por elas, nunca pelo nome do papel) ---- */

  /** Faz parte da sociedade: decisões entre donos, pessoas e %, clientes da loja toda. */
  society: boolean;
  /**
   * Catálogo próprio por cima do da loja ("Meus serviços"): preço, duração e "você atende".
   * Grava só nas próprias linhas (`staff_services`), sem pedir aprovação.
   */
  ownCatalog: boolean;
  /** Sugere preço/duração aos outros parceiros (o banco só aceita do Parceiro). */
  suggestToPeers: boolean;
  /** Cria e remove só os próprios bloqueios (folga, almoço), sem pedir aprovação. */
  ownBlocks: boolean;
  /** Edita o próprio perfil público (nome e "sobre") e vê o próprio link. */
  ownProfile: boolean;
  /** Troca a própria foto (o banco ainda não aceita foto do Contratado sem serviços próprios). */
  ownPhoto: boolean;
  /** Carteira própria: valores dos próprios atendimentos ("Meu link e carteira"). */
  ownWallet: boolean;
  /** Pede para sair da barbearia. */
  leaveShop: boolean;
  /** Ao sair, pode levar os próprios clientes para outra barbearia. */
  takeClientsOnLeave: boolean;
  /** Liga o Google só com a própria agenda. */
  googleOwnAgenda: boolean;
  /** Copia todos os atendimentos da loja para o Google (o banco só aceita de dono ou sócio). */
  googleWholeShop: boolean;
};

export type ProfessionalActor = {
  role: "owner" | "partner" | "associate" | "employee";
};

/** Permissões efetivas vindas do banco, no formato `{ permissao: concedida }`. */
export type ShopPermissionMap = Record<string, boolean>;

/**
 * Permissões de gestão que não têm efeito para o Contratado: o banco só aplica mudanças da
 * loja de dono ou sócio. A matriz trava essas células ("use Parceiro") e a tela também ignora.
 */
export const EMPLOYEE_LOCKED_PERMISSIONS = [
  "manage_services",
  "manage_operations",
  "manage_team",
  "manage_permissions",
] as const;

export function permissionLockedForRole(role: string, permission: string): boolean {
  return (
    role === "employee" && (EMPLOYEE_LOCKED_PERMISSIONS as readonly string[]).includes(permission)
  );
}

export function capabilitiesFor(
  actor: ProfessionalActor | null,
  governanceMode: "single" | "equal" | "majority" | null = null,
  canApplyFromDatabase?: boolean,
  permissions?: ShopPermissionMap | null,
): ShopCapabilities | null {
  if (!actor) return null;
  const role = actor.role;
  const full = role === "owner" || role === "partner";
  const equalSociety = governanceMode === "equal";
  const canApply = canApplyFromDatabase ?? (full && governanceMode !== "equal");

  // Sem a matriz carregada valem os padrões por papel, que reproduzem o
  // comportamento anterior. Com a matriz, ela decide as capacidades abaixo.
  const allowed = (permission: string, fallback: boolean) => {
    if (permissionLockedForRole(role, permission)) return false;
    return permissions && typeof permissions[permission] === "boolean"
      ? permissions[permission]!
      : fallback;
  };

  const viewMoney = allowed("view_money", role !== "employee");
  const editOwnCatalog = allowed("manage_own_services", role === "associate");
  // O banco libera o próprio bloqueio com "serviços próprios" (20260929170000). Se um dia
  // existir uma permissão só de bloqueios (`manage_own_blocks`), ela passa a decidir.
  const ownBlocks = !full && allowed("manage_own_blocks", editOwnCatalog);

  return {
    viewFullShop: allowed("view_agenda_all", full),
    // Valores do dia e o próprio recebimento (dono, sócio e parceiro no padrão).
    viewMoney,
    // Relatórios financeiros completos da loja, que liberam a RPC de indicadores.
    viewShopFinancials: allowed("view_financial_all", full),
    editOwnCatalog,
    manageCatalog: allowed("manage_services", full),
    manageTeam: allowed("manage_team", full),
    manageOperations: allowed("manage_operations", full),
    viewReportsAnonymized: allowed("view_reports_anonymized", role === "associate"),
    // Governança societária continua dependendo do papel e do modo da sociedade,
    // não da matriz: é uma decisão de sociedade, não uma capacidade de trabalho.
    manageSociety: canApply,
    canProposeOperations: full,
    canApplyOperations: canApply,
    requiresApproval: full && equalSociety,
    viewTeamSchedule: true,

    society: full,
    ownCatalog: !full && editOwnCatalog,
    suggestToPeers: role === "associate" && editOwnCatalog,
    ownBlocks,
    ownProfile: true,
    // Envio de foto: dono, sócio e parceiro, ou quem tem serviços próprios (regra do banco).
    ownPhoto: role !== "employee" || editOwnCatalog,
    ownWallet: !full && viewMoney,
    leaveShop: true,
    // O Contratado sai sem levar clientes (decisão do dono, plano de ambientes, decisão 7).
    takeClientsOnLeave: role !== "employee",
    googleOwnAgenda: true,
    googleWholeShop: full,
  };
}
