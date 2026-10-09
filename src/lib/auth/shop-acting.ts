import { capabilitiesFor, type ProfessionalActor, type ShopCapabilities } from "./capabilities.ts";

/**
 * "Quem age no painel e com qual poder": regra única do /shop (e de /shop/pontos).
 *
 * - `member`: vínculo de equipe (shop_members). Os poderes vêm das capacidades da loja.
 * - `legacy-admin`: vínculo antigo `shop_admin` (quem abriu a barbearia antes da equipe).
 *   Continua com os poderes de dono de hoje, para ninguém perder acesso.
 * - `none`: sem vínculo de equipe nem `shop_admin`. Não há loja nem poder nenhum
 *   (nunca cai numa loja vinda de vínculo de cliente).
 */
export type ShopMemberRole = ProfessionalActor["role"];

type ActorLike<S> = {
  id: string;
  role: ShopMemberRole;
  created_at?: string | null;
  barbershop?: S | null;
};

type MembershipLike<S> = { role: string; barbershop?: S | null };

export type ShopActing<A, S> =
  | { kind: "member"; actor: A; shop: S | null }
  | { kind: "legacy-admin"; actor: null; shop: S }
  | { kind: "none"; actor: null; shop: null; reason: "platform-admin" | "no-shop" };

/** Dono e sócio valem o mesmo ("Dono · %"); depois Parceiro e Contratado. */
const ROLE_RANK: Record<ShopMemberRole, number> = {
  owner: 0,
  partner: 0,
  associate: 1,
  employee: 2,
};

/**
 * Ordem fixa das lojas da pessoa: papel mais alto, depois o vínculo mais antigo e o nome
 * da loja. Assim a primeira loja aberta não depende da ordem do banco.
 */
export function sortShopActors<A extends ActorLike<{ name?: string | null }>>(
  actors: readonly A[],
): A[] {
  return [...actors].sort((a, b) => {
    const rank = (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9);
    if (rank) return rank;
    const since = (a.created_at ?? "").localeCompare(b.created_at ?? "");
    if (since) return since;
    const name = (a.barbershop?.name ?? "").localeCompare(b.barbershop?.name ?? "", "pt-BR");
    if (name) return name;
    return a.id.localeCompare(b.id);
  });
}

export function resolveShopActing<S, A extends ActorLike<S>>(input: {
  actors: readonly A[];
  memberships: readonly MembershipLike<S>[];
  /** Loja escolhida (troca pelo nome no cabeçalho ou guardada no aparelho). */
  selectedActorId?: string | null;
  /** Na demonstração a loja é sempre a fictícia. */
  demoShop?: S | null;
}): ShopActing<A, S> {
  const actor =
    input.actors.find((candidate) => candidate.id === input.selectedActorId) ??
    input.actors[0] ??
    null;
  if (actor) return { kind: "member", actor, shop: input.demoShop ?? actor.barbershop ?? null };
  const legacy = input.memberships.find((m) => m.role === "shop_admin" && m.barbershop);
  if (legacy?.barbershop) return { kind: "legacy-admin", actor: null, shop: legacy.barbershop };
  return {
    kind: "none",
    actor: null,
    shop: null,
    reason: input.memberships.some((m) => m.role === "platform_admin")
      ? "platform-admin"
      : "no-shop",
  };
}

/** A conta tem alguma barbearia para abrir no painel (vínculo de equipe ou shop_admin). */
export function hasShopToOpen<S>(input: {
  actors: readonly ActorLike<S>[];
  memberships: readonly MembershipLike<S>[];
}): boolean {
  return resolveShopActing(input).kind !== "none";
}

export type ShopWriteMode =
  /** Grava direto nas tabelas (só o shop_admin antigo, como sempre foi). */
  | "direct"
  /** Pede a mudança pela governança (aplica ou vai para aprovação dos donos). */
  | "governed"
  /** Não muda a loja (o Parceiro só mexe no próprio catálogo e nos próprios bloqueios). */
  | "none";

export type ShopPowers = {
  /** Poderes já conhecidos. Falso enquanto as permissões da loja aberta carregam. */
  ready: boolean;
  /** Dono, sócio ou shop_admin antigo: guia de configuração, termos de dono, decisões. */
  ownerLike: boolean;
  writeMode: ShopWriteMode;
  editServices: boolean;
  changeGlobalCatalog: boolean;
  createServices: boolean;
  manageTeam: boolean;
  /** Aba Horários (inclui os próprios bloqueios do Parceiro). */
  manageOperations: boolean;
  editBusinessHours: boolean;
  /** Cria e remove só os próprios bloqueios. */
  ownBlocksOnly: boolean;
  manageShopSettings: boolean;
  viewMoney: boolean;
  manageBranding: boolean;
  manageShopChannels: boolean;
  /** Vê a agenda da equipe inteira. */
  seeTeam: boolean;
  /** Dono ou sócio da loja aberta: decisões entre donos, pessoas e %, clientes da loja. */
  society: boolean;
  /** "Meus serviços": personaliza o próprio catálogo por cima do da loja. */
  ownCatalog: boolean;
  /** Sugere preço aos outros parceiros. */
  suggestions: boolean;
  /** Cria e remove os próprios bloqueios sem aprovação. */
  ownBlocks: boolean;
  /** "Meu perfil e link" (precisa de um cartão de profissional). */
  ownProfile: boolean;
  /** Troca a própria foto no perfil. */
  ownPhoto: boolean;
  /** "Meu link e carteira" na Agenda. */
  ownWallet: boolean;
  /** "Sair da barbearia". */
  leaveShop: boolean;
  /** Ao sair, pode levar os próprios clientes. */
  takeClients: boolean;
  /** Google com a própria agenda. */
  googleOwn: boolean;
  /** Google com todos os atendimentos da loja. */
  googleWholeShop: boolean;
};

export const NO_POWERS: ShopPowers = {
  ready: false,
  ownerLike: false,
  writeMode: "none",
  editServices: false,
  changeGlobalCatalog: false,
  createServices: false,
  manageTeam: false,
  manageOperations: false,
  editBusinessHours: false,
  ownBlocksOnly: false,
  manageShopSettings: false,
  viewMoney: false,
  manageBranding: false,
  manageShopChannels: false,
  seeTeam: false,
  society: false,
  ownCatalog: false,
  suggestions: false,
  ownBlocks: false,
  ownProfile: false,
  ownPhoto: false,
  ownWallet: false,
  leaveShop: false,
  takeClients: false,
  googleOwn: false,
  googleWholeShop: false,
};

/**
 * Poderes de quem age. A demonstração usa exatamente a mesma regra: o que muda nela é só a
 * fonte dos dados (fictícios, na memória), nunca o que cada papel pode fazer.
 */
export function shopPowers(
  acting: { kind: ShopActing<unknown, unknown>["kind"]; actor: { role: ShopMemberRole } | null },
  capabilities: ShopCapabilities | null,
): ShopPowers {
  if (acting.kind === "none") return { ...NO_POWERS, ready: true };
  if (acting.kind === "legacy-admin") {
    // shop_admin antigo: mesmos poderes de dono de hoje (grava direto, sem governança).
    return {
      ready: true,
      ownerLike: true,
      writeMode: "direct",
      editServices: true,
      changeGlobalCatalog: true,
      createServices: true,
      manageTeam: true,
      manageOperations: true,
      editBusinessHours: true,
      ownBlocksOnly: false,
      manageShopSettings: true,
      viewMoney: true,
      manageBranding: true,
      manageShopChannels: true,
      seeTeam: false,
      // Sem vínculo de equipe não há cartão de profissional nem sociedade registrada.
      society: false,
      ownCatalog: false,
      suggestions: false,
      ownBlocks: false,
      ownProfile: false,
      ownPhoto: false,
      ownWallet: false,
      leaveShop: false,
      takeClients: false,
      googleOwn: true,
      googleWholeShop: true,
    };
  }
  // Sem papel definido não há poder nenhum; com papel, espera as permissões da loja.
  if (!acting.actor || !capabilities) return NO_POWERS;
  const c = capabilities;
  const ownerLike = c.society;
  return {
    ready: true,
    ownerLike,
    writeMode: c.canProposeOperations ? "governed" : "none",
    editServices: c.manageCatalog || c.editOwnCatalog,
    changeGlobalCatalog: c.manageCatalog,
    // O Parceiro só personaliza serviços existentes; criar é de quem gere o catálogo.
    createServices: c.manageCatalog && c.canProposeOperations,
    manageTeam: c.manageTeam,
    manageOperations: c.manageOperations || c.editOwnCatalog || c.ownBlocks,
    editBusinessHours: c.canProposeOperations,
    ownBlocksOnly: c.ownBlocks && !c.canProposeOperations,
    manageShopSettings: c.manageOperations,
    viewMoney: c.viewMoney,
    manageBranding: c.canApplyOperations || ownerLike,
    manageShopChannels: ownerLike,
    seeTeam: c.viewFullShop,
    society: c.society,
    ownCatalog: c.ownCatalog,
    suggestions: c.suggestToPeers,
    ownBlocks: c.ownBlocks,
    ownProfile: c.ownProfile,
    ownPhoto: c.ownPhoto,
    ownWallet: c.ownWallet,
    leaveShop: c.leaveShop,
    takeClients: c.takeClientsOnLeave,
    googleOwn: c.googleOwnAgenda,
    googleWholeShop: c.googleWholeShop,
  };
}

type GovernanceModeName = "single" | "equal" | "majority";

/** Modo da sociedade mostrado em cada papel da demonstração (sem equipe fictícia). */
export function demoGovernanceMode(role: ShopMemberRole): "single" | "equal" | null {
  return role === "owner" ? "single" : role === "partner" ? "equal" : null;
}

/**
 * Quem aplica mudanças da loja sem pedir, como no banco: dono único ou quem tem a maior parte.
 * Na sociedade em partes iguais e para o sócio com a menor parte, a mudança vira pedido.
 */
export function canApplyAsOwner(
  role: ShopMemberRole,
  mode: GovernanceModeName | null,
  percent: number | null | undefined,
) {
  if (role !== "owner" && role !== "partner") return false;
  if (mode === "equal") return false;
  if (mode === "majority") return Number(percent ?? 0) > 50;
  return true;
}

/**
 * Capacidades de cada papel na demonstração: os padrões do papel, sem atalho. Parceiro e
 * Contratado nunca aplicam mudanças da loja (como no real); dono único e quem tem a maior parte
 * aplicam; sociedade em partes iguais e sócio com a menor parte pedem.
 */
export function demoCapabilities(
  actor: ProfessionalActor & { ownership_percent?: number | null },
  mode: GovernanceModeName | null = demoGovernanceMode(actor.role),
): ShopCapabilities | null {
  return capabilitiesFor(actor, mode, canApplyAsOwner(actor.role, mode, actor.ownership_percent));
}

/* ---------- Loja escolhida, guardada no aparelho por conta ---------- */

/** Chave antiga (sem conta). Só é lida como reserva; a escolha é conferida contra a conta. */
export const ACTIVE_SHOP_KEY = "arena:active-shop-actor";

export function activeShopKey(userId: string) {
  return `${ACTIVE_SHOP_KEY}:${userId}`;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Aba privada ou armazenamento bloqueado.
    return null;
  }
}

export function readSavedShopActor(
  userId: string,
  storage: StorageLike | null = browserStorage(),
): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(activeShopKey(userId)) ?? storage.getItem(ACTIVE_SHOP_KEY);
  } catch {
    return null;
  }
}

export function saveShopActor(
  userId: string,
  actorId: string,
  storage: StorageLike | null = browserStorage(),
) {
  try {
    storage?.setItem(activeShopKey(userId), actorId);
  } catch {
    // Sem armazenamento: a escolha vale só nesta visita.
  }
}

/** A escolha guardada só vale se for uma loja desta conta; senão abre a primeira da ordem. */
export function pickInitialActorId(
  actors: readonly { id: string }[],
  saved: string | null,
): string | null {
  if (saved && actors.some((actor) => actor.id === saved)) return saved;
  return actors[0]?.id ?? null;
}

/* ---------- Qual loja o painel abre ao entrar ---------- */

/**
 * - `ready`: loja definida (`selected`).
 * - `host`: no domínio de uma barbearia; espera saber qual é para abrir a loja do endereço.
 * - `choose`: 2 ou mais lojas e nenhuma escolha salva: pergunta "Em qual barbearia…?".
 */
export type ShopEntry = { step: "ready" | "host" | "choose"; selected: string | null };

type EntryActor = { id: string; barbershop_id?: string | null };

function validChoice(actors: readonly EntryActor[], id: string | null | undefined) {
  return id && actors.some((actor) => actor.id === id) ? id : null;
}

/**
 * Ordem: loja pedida no endereço ("Minhas áreas") → loja do domínio em que a pessoa está →
 * escolha salva no aparelho → pergunta (2 ou mais lojas) → a única loja.
 */
export function initialShopEntry(input: {
  actors: readonly EntryActor[];
  /** `?unidade=` vindo de "Minhas áreas". */
  requested?: string | null;
  saved?: string | null;
  /** Fora do endereço principal: a loja do domínio decide primeiro. */
  onShopHost?: boolean;
  demo?: boolean;
}): ShopEntry {
  const { actors } = input;
  if (input.demo || actors.length === 0) {
    return { step: "ready", selected: actors[0]?.id ?? null };
  }
  const requested = validChoice(actors, input.requested);
  if (requested) return { step: "ready", selected: requested };
  if (input.onShopHost) return { step: "host", selected: null };
  return entryWithoutHost(actors, input.saved);
}

function entryWithoutHost(actors: readonly EntryActor[], saved?: string | null): ShopEntry {
  const choice = validChoice(actors, saved);
  if (choice) return { step: "ready", selected: choice };
  if (actors.length >= 2) return { step: "choose", selected: null };
  return { step: "ready", selected: actors[0]?.id ?? null };
}

/** Depois de saber a loja do domínio: abre a do endereço quando a pessoa trabalha nela. */
export function shopEntryForHost(input: {
  actors: readonly EntryActor[];
  hostShopId: string | null;
  saved?: string | null;
}): ShopEntry {
  const here = input.hostShopId
    ? input.actors.find((actor) => actor.barbershop_id === input.hostShopId)
    : undefined;
  if (here) return { step: "ready", selected: here.id };
  return entryWithoutHost(input.actors, input.saved);
}
