import { createContext } from "react";

/** Pedido de convite vindo da aba Equipe ("Com acesso ao painel", "Dar acesso ao painel"). */
export type TeamInviteRequest = { nonce: number; name?: string };

/**
 * Liga os botões da aba Equipe ao convite do cartão de acessos (ShopTeamAccessCard): a aba
 * passa o pedido e o cartão abre o convite já com o nome preenchido.
 */
export const TeamInviteContext = createContext<{
  request: TeamInviteRequest | null;
  clear: () => void;
}>({ request: null, clear: () => {} });
