import { Check, KeyRound, MessageCircle, Minus } from "lucide-react";
import { IconList, SectionHeader, type IconListItem } from "@/components/visual";
import type { ShopCapabilities } from "@/lib/auth/capabilities";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { RoleBadge, isOwnerRole } from "../roles";

const ROWS: { key: keyof ShopCapabilities; label: MessageKey }[] = [
  { key: "viewFullShop", label: "eq.mine.teamAgenda" },
  { key: "viewMoney", label: "eq.mine.money" },
  { key: "viewShopFinancials", label: "eq.mine.financials" },
  { key: "editOwnCatalog", label: "eq.mine.ownServices" },
  { key: "manageCatalog", label: "eq.mine.catalog" },
  { key: "manageOperations", label: "eq.mine.operations" },
  { key: "manageTeam", label: "eq.mine.team" },
];

/**
 * "Seu acesso nesta barbearia": o papel de quem está vendo e o que ele pode ou não fazer,
 * com ✓ e —. Mostra por que algumas abas não aparecem, sem precisar perguntar.
 */
export function MyAccessCard({
  role,
  capabilities,
}: {
  role: string;
  capabilities: ShopCapabilities | null;
}) {
  const { t } = useI18n();
  if (!capabilities) return null;
  const line = (key: string, allowed: boolean, label: MessageKey): IconListItem => ({
    key,
    icon: allowed ? Check : Minus,
    tone: allowed ? "success" : "muted",
    text: (
      <>
        <span className="sr-only">{t(allowed ? "eq.mine.yes" : "eq.mine.no")}: </span>
        <span className={allowed ? undefined : "text-muted-foreground"}>{t(label)}</span>
      </>
    ),
  });
  const items = ROWS.map((row) => line(row.key, !!capabilities[row.key], row.label));
  if (isOwnerRole(role)) {
    items.push(line("apply", capabilities.canApplyOperations, "eq.mine.applyNow"));
  }
  return (
    <section className="app-action-card space-y-3 p-4" aria-labelledby="my-access-title">
      <SectionHeader
        icon={KeyRound}
        id="my-access-title"
        title={t("eq.mine.title")}
        aside={<RoleBadge role={role} size="md" />}
      />
      <IconList size="md" items={items} label={t("eq.mine.title")} />
      {!isOwnerRole(role) && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <MessageCircle className="size-4 shrink-0 text-gold" aria-hidden />
          {t("eq.mine.askOwner")}
        </p>
      )}
    </section>
  );
}
