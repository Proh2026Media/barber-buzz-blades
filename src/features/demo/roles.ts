import { Headset, Smartphone, type LucideIcon } from "lucide-react";
import type { MessageKey } from "@/lib/i18n";
import { PLATFORM_META, ROLE_META } from "@/features/shop/roles";
import type { DemoRole } from "./chrome";

/**
 * Mapa único dos papéis: o mesmo ícone, o mesmo nome e a mesma ordem no seletor da
 * demonstração, no "Testar como…", no convite de profissional e na tela de acessos.
 * Os papéis da equipe vêm de ROLE_META (selo do papel): mesmo significado, mesmo ícone.
 */
export const ROLE_ICON = {
  platform: PLATFORM_META.icon,
  manager: Headset,
  owner: ROLE_META.owner.icon,
  partner: ROLE_META.partner.icon,
  associate: ROLE_META.associate.icon,
  employee: ROLE_META.employee.icon,
  customer: Smartphone,
} as const satisfies Record<string, LucideIcon>;

export type DemoRoleGroup = "outside" | "team";

export type DemoRoleMeta = {
  id: DemoRole;
  icon: LucideIcon;
  labelKey: MessageKey;
  hintKey: MessageKey;
  group: DemoRoleGroup;
  /** Selo curto do modo da sociedade, nas visões de dono. */
  modeKey?: MessageKey;
};

/** Ordem: quem é atendido, quem atende e quem cuida de todas as barbearias. */
export const DEMO_ROLES: readonly DemoRoleMeta[] = [
  {
    id: "customer",
    icon: ROLE_ICON.customer,
    labelKey: "demo.role.customer",
    hintKey: "demo.role.customerHint",
    group: "outside",
  },
  // Donos com o mesmo nome do produto ("Dono · %"); o modo da sociedade vem como selo.
  {
    id: "owner",
    icon: ROLE_ICON.owner,
    labelKey: "demo.role.ownerSolo",
    hintKey: "demo.who.ownerHint",
    group: "team",
    modeKey: "eq.mode.short.single",
  },
  {
    id: "equal",
    icon: ROLE_ICON.owner,
    labelKey: "demo.role.ownerEqual",
    hintKey: "demo.role.equalHint",
    group: "team",
    modeKey: "eq.mode.short.equal",
  },
  {
    id: "minority",
    icon: ROLE_ICON.owner,
    labelKey: "demo.role.ownerMinority",
    hintKey: "demo.role.minorityHint",
    group: "team",
    modeKey: "eq.mode.short.majority",
  },
  {
    id: "associate",
    icon: ROLE_ICON.associate,
    labelKey: "demo.role.associate",
    hintKey: "demo.role.associateHint",
    group: "team",
  },
  {
    id: "employee",
    icon: ROLE_ICON.employee,
    labelKey: "demo.who.employee",
    hintKey: "demo.role.employeeHint",
    group: "team",
  },
  {
    id: "platform",
    icon: ROLE_ICON.platform,
    labelKey: "demo.who.platform",
    hintKey: "demo.role.platformHint",
    group: "outside",
  },
];
