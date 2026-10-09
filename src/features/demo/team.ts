import type { TeamMember } from "@/features/shop/team";

/**
 * Equipe fictícia de cada visão da demonstração (plano de ambientes, onda 5). Cada papel tem o
 * próprio personagem, e as visões de sócio mostram a sociedade de verdade: dono único,
 * sociedade em partes iguais e sócio com a menor parte. Tudo com ids fictícios.
 */
export type DemoTeamView = "owner" | "equal" | "minority" | "associate" | "employee";

/** Personagens próprios do Parceiro e do Contratado (cartões de profissional da loja demo). */
export const DEMO_ASSOCIATE_STAFF_ID = "demo-associate";
export const DEMO_EMPLOYEE_STAFF_ID = "demo-employee";
/** Sócia fictícia das visões de sociedade (não atende: só divide a loja). */
export const DEMO_PEER_OWNER = { userId: "demo-owner-ana", name: "Ana Ribeiro" } as const;
/** Dono fictício quando quem está vendo é o Parceiro ou o Contratado. */
export const DEMO_OWNER_USER_ID = "demo-owner-1";

export function isDemoTeamView(view: string): view is DemoTeamView {
  return (
    view === "owner" ||
    view === "equal" ||
    view === "minority" ||
    view === "associate" ||
    view === "employee"
  );
}

/** Papel, parte e cartão de quem está vendo em cada visão da equipe. */
export function demoViewer(view: DemoTeamView): {
  role: "owner" | "associate" | "employee";
  percent: number | null;
  staff: "owner" | "associate" | "employee";
} {
  if (view === "associate") return { role: "associate", percent: null, staff: "associate" };
  if (view === "employee") return { role: "employee", percent: null, staff: "employee" };
  return {
    role: "owner",
    percent: view === "equal" ? 50 : view === "minority" ? 30 : 100,
    staff: "owner",
  };
}

type StaffLike = { id: string; display_name: string };

/** Pessoas e papéis da loja demo, vistos por quem está na visão (`viewerId`). */
export function demoTeam(
  view: DemoTeamView,
  input: {
    viewerId: string;
    owner: StaffLike;
    associate?: StaffLike | null;
    employee?: StaffLike | null;
    stamp: string;
  },
): TeamMember[] {
  const member = (
    id: string,
    userId: string,
    staffId: string,
    name: string,
    role: TeamMember["role"],
    percent: number | null,
    founder = false,
  ): TeamMember => ({
    id,
    user_id: userId,
    staff_id: staffId,
    role,
    ownership_percent: percent,
    active: true,
    display_name: name,
    email: null,
    is_founder: founder,
    created_at: input.stamp,
  });
  const viewer = demoViewer(view);
  const ownerUser = viewer.role === "owner" ? input.viewerId : DEMO_OWNER_USER_ID;
  const owners: TeamMember[] = [];
  const mainOwner = (percent: number) =>
    member(
      "demo-member-owner",
      ownerUser,
      input.owner.id,
      input.owner.display_name,
      "owner",
      percent,
      true,
    );
  const peer = (percent: number) =>
    member(
      "demo-member-peer",
      DEMO_PEER_OWNER.userId,
      "demo-staff-peer",
      DEMO_PEER_OWNER.name,
      "owner",
      percent,
    );
  if (view === "equal") owners.push(mainOwner(50), peer(50));
  else if (view === "minority") owners.push(peer(70), mainOwner(30));
  else owners.push(mainOwner(100));
  const team = [...owners];
  if (input.associate) {
    team.push(
      member(
        "demo-member-associate",
        view === "associate" ? input.viewerId : "demo-user-associate",
        input.associate.id,
        input.associate.display_name,
        "associate",
        null,
      ),
    );
  }
  if (input.employee) {
    team.push(
      member(
        "demo-member-employee",
        view === "employee" ? input.viewerId : "demo-user-employee",
        input.employee.id,
        input.employee.display_name,
        "employee",
        null,
      ),
    );
  }
  return team;
}
