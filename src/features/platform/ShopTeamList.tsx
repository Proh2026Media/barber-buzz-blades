import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Hint, LoadingState, Notice, PersonAvatar } from "@/components/visual";
import { useDemo } from "@/features/demo/context";
import {
  DEMO_ASSOCIATE_STAFF_ID,
  DEMO_EMPLOYEE_STAFF_ID,
  DEMO_OWNER_USER_ID,
  demoTeam,
} from "@/features/demo/team";
import { RoleBadge, isOwnerRole } from "@/features/shop/roles";
import {
  GovernanceModeBadge,
  activeOwners,
  governanceModeOf,
  loadTeamMembers,
  type TeamMember,
} from "@/features/shop/team";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { useI18n } from "@/lib/i18n";

const ORDER: Record<string, number> = { owner: 0, partner: 0, associate: 1, employee: 2 };

/**
 * Equipe da barbearia na ficha da plataforma: nome, papel ("Dono · 50%", Parceiro, Contratado)
 * e o modo da sociedade. Lê a lista que o admin da plataforma já pode ler
 * (`list_shop_team_members`); na demonstração, a equipe fictícia.
 */
export function ShopTeamList({
  shopId,
  revision = 0,
  onLoaded,
}: {
  shopId: string;
  /** Muda depois de adicionar alguém: recarrega a lista. */
  revision?: number;
  /** Donos e sócios ativos (a ficha usa para "sem administrador"). */
  onLoaded?: (activeOwnerCount: number) => void;
}) {
  const { t } = useI18n();
  const demo = useDemo();
  const demoOn = Boolean(demo);
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    if (demoOn) {
      setMembers([]);
      return;
    }
    try {
      setMembers(await loadTeamMembers(shopId));
    } catch (err) {
      setMembers(null);
      setError(friendlyAuthError(err, t("plat.team.loadError")));
    }
  }, [shopId, demoOn, t]);

  useEffect(() => {
    setMembers(null);
    void load();
  }, [load, revision]);

  // Na demonstração a ficha mostra a equipe fictícia da loja (dono, parceiro e contratado).
  const demoStaff = demo?.staff;
  const demoMembers = useMemo(() => {
    if (!demoStaff) return null;
    const owner = demoStaff.find(
      (row) => row.id !== DEMO_ASSOCIATE_STAFF_ID && row.id !== DEMO_EMPLOYEE_STAFF_ID,
    );
    if (!owner) return [];
    return demoTeam("owner", {
      viewerId: DEMO_OWNER_USER_ID,
      owner,
      associate: demoStaff.find((row) => row.id === DEMO_ASSOCIATE_STAFF_ID) ?? null,
      employee: demoStaff.find((row) => row.id === DEMO_EMPLOYEE_STAFF_ID) ?? null,
      stamp: new Date(0).toISOString(),
    });
  }, [demoStaff]);
  const list = (demoMembers ?? members)
    ?.filter((member) => member.active)
    .sort((a, b) => (ORDER[a.role] ?? 3) - (ORDER[b.role] ?? 3));
  const owners = list ? activeOwners(list) : [];
  const ownerCount = list ? owners.length : null;

  useEffect(() => {
    if (ownerCount !== null) onLoaded?.(ownerCount);
    // Avisa só quando a contagem muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerCount]);

  if (error) {
    return (
      <Notice
        tone="danger"
        title={error}
        action={{ label: t("visual.retry"), icon: RefreshCw, onClick: () => void load() }}
      />
    );
  }
  if (!list) return <LoadingState variant="list" count={2} label={t("plat.team.loading")} />;
  if (list.length === 0) {
    return (
      <Hint tone="muted" className="text-sm">
        {t("plat.team.empty")}
      </Hint>
    );
  }
  const mode = governanceModeOf(list);
  return (
    <div className="space-y-2">
      {owners.length > 1 && <GovernanceModeBadge mode={mode} leader={owners[0]} size="sm" />}
      <ul
        aria-label={t("plat.team.title")}
        className="divide-y divide-border rounded-2xl border border-border bg-background px-3"
      >
        {list.map((member) => (
          <li key={member.id} className="flex min-h-14 items-center gap-3 py-2">
            <PersonAvatar name={member.display_name} seed={member.staff_id} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{member.display_name}</span>
              <RoleBadge
                role={member.role}
                percent={isOwnerRole(member.role) ? member.ownership_percent : null}
                className="mt-0.5"
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
