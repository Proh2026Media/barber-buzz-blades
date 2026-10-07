import { Globe2, Headset, Smartphone, type LucideIcon } from "lucide-react";
import type { MessageKey } from "@/lib/i18n";
import { ROLE_META } from "@/features/shop/roles";
import type { DemoRole } from "./chrome";

/**
 * Mapa único dos papéis: o mesmo ícone, o mesmo nome e a mesma ordem no seletor da
 * demonstração, no "Testar como…", no convite de profissional e na tela de acessos.
 * Os papéis da equipe vêm de ROLE_META (selo do papel): mesmo significado, mesmo ícone.
 */
export const ROLE_ICON = {
  platform: Globe2,
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
  {
    id: "owner",
    icon: ROLE_ICON.owner,
    labelKey: "demo.role.owner",
    hintKey: "demo.who.ownerHint",
    group: "team",
  },
  {
    id: "partner",
    icon: ROLE_ICON.partner,
    labelKey: "demo.role.partner",
    hintKey: "demo.role.partnerHint",
    group: "team",
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
