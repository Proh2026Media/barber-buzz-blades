import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/auth/guards";
import { DemoWorkspace } from "@/features/demo/DemoWorkspace";
import type { DemoRole } from "@/features/demo/chrome";
import type { SessionProfile } from "@/lib/auth/session";

/** Conta conferida ao entrar na demonstração (admin da plataforma). */
let enteredProfile: SessionProfile | null = null;

const DEMO_VIEWS = new Set<DemoRole>([
  "platform",
  "owner",
  "equal",
  "minority",
  "associate",
  "employee",
  "customer",
]);

/** Visão pedida no endereço; o antigo "partner" (dono sócio) abre a sociedade em partes iguais. */
function demoView(value: unknown): DemoRole | undefined {
  if (value === "partner") return "equal";
  return typeof value === "string" && DEMO_VIEWS.has(value as DemoRole)
    ? (value as DemoRole)
    : undefined;
}

export const Route = createFileRoute("/demo")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    shop: typeof search.shop === "string" && search.shop ? search.shop : undefined,
    view: demoView(search.view),
    // "Testar como…" aberto da ficha da barbearia: ao sair, volta para a ficha.
    ...(search.volta === "ficha" ? { volta: "ficha" as const } : {}),
  }),
  beforeLoad: async ({ cause }) => {
    // Dentro da demonstração (troca de papel, âncora de um atalho) a sessão não muda e o banco
    // fica travado (lib/demo-guard): reaproveita a conta conferida na entrada.
    if (cause === "stay" && enteredProfile) return { profile: enteredProfile };
    const profile = await requireRole("/demo", ["platform_admin"]);
    enteredProfile = profile;
    return { profile };
  },
  component: DemoRoute,
});

function DemoRoute() {
  const { profile } = Route.useRouteContext();
  const { shop, view, volta } = Route.useSearch();
  return (
    <DemoWorkspace
      profile={profile}
      shopId={shop}
      initialRole={view}
      returnToShop={volta === "ficha" ? shop : undefined}
    />
  );
}
