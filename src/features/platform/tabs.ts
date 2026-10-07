/** Áreas do painel da plataforma (barra inferior) e o filtro da lista de barbearias. */
export type PlatformTab = "overview" | "shops" | "permissions" | "insights";

export type ShopFilter = "all" | "active" | "suspended" | "noAdmin";

/** Nome da aba no endereço (`/platform?aba=barbearias`). A Visão geral é o padrão. */
const TAB_SLUGS: Record<PlatformTab, string> = {
  overview: "visao-geral",
  shops: "barbearias",
  permissions: "acessos",
  insights: "relatorios",
};

export function platformTabSlug(tab: PlatformTab) {
  return TAB_SLUGS[tab];
}

export function platformTabFromSlug(slug: unknown): PlatformTab | undefined {
  if (typeof slug !== "string") return undefined;
  return (Object.keys(TAB_SLUGS) as PlatformTab[]).find((tab) => TAB_SLUGS[tab] === slug);
}
