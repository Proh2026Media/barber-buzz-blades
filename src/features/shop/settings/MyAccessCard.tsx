import { Check, ChevronDown, KeyRound, MessageCircle, Minus } from "lucide-react";
import { IconList, SectionHeader, type IconListItem } from "@/components/visual";
import type { ShopCapabilities } from "@/lib/auth/capabilities";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { RoleBadge } from "../roles";
import { isOwnerRole } from "../roles-model";

/** Cada linha lê uma capacidade com nome (a mesma regra que abre ou esconde a tela). */
const ROWS: { key: string; label: MessageKey; allowed: (c: ShopCapabilities) => boolean }[] = [
  { key: "teamAgenda", label: "eq.mine.teamAgenda", allowed: (c) => c.viewFullShop },
  { key: "money", label: "eq.mine.money", allowed: (c) => c.viewMoney },
  { key: "financials", label: "eq.mine.financials", allowed: (c) => c.viewShopFinancials },
  {
    key: "ownServices",
    label: "eq.mine.ownServices",
    allowed: (c) => c.editOwnCatalog || c.manageCatalog,
  },
  {
    key: "ownBlocks",
    label: "eq.mine.ownBlocks",
    allowed: (c) => c.ownBlocks || c.manageOperations,
  },
  { key: "catalog", label: "eq.mine.catalog", allowed: (c) => c.manageCatalog },
  { key: "operations", label: "eq.mine.operations", allowed: (c) => c.manageOperations },
  { key: "team", label: "eq.mine.team", allowed: (c) => c.manageTeam },
];

/** Linhas de "Seu acesso" (✓ pode / — não pode), na ordem do cartão. */
function myAccessRows(role: string, capabilities: ShopCapabilities, hideApply: boolean) {
  const rows = ROWS.map((row) => ({
    key: row.key,
    label: row.label,
    allowed: row.allowed(capabilities),
  }));
  if (isOwnerRole(role) && !hideApply) {
    rows.push({
      key: "apply",
      label: "eq.mine.applyNow",
      allowed: capabilities.canApplyOperations,
    });
  }
  return rows;
}

/** Lista ✓ / — do que o papel pode fazer (cartão em Ajustes e resumo do selo no topo). */
export function MyAccessList({
  role,
  capabilities,
  hideApply = false,
}: {
  role: string;
  capabilities: ShopCapabilities;
  /** Esconde a linha "valem na hora" quando quem chama já mostra isso (resumo do selo). */
  hideApply?: boolean;
}) {
  const { t } = useI18n();
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
  const items = myAccessRows(role, capabilities, hideApply).map((row) =>
    line(row.key, row.allowed, row.label),
  );
  return (
    <>
      <IconList size="md" items={items} label={t("eq.mine.title")} />
      {!isOwnerRole(role) && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <MessageCircle className="size-4 shrink-0 text-gold" aria-hidden />
          {t("eq.mine.askOwner")}
        </p>
      )}
    </>
  );
}

/**
 * "Seu acesso nesta barbearia": o papel de quem está vendo e o que ele pode ou não fazer,
 * com ✓ e —. Mostra por que algumas abas não aparecem, sem precisar perguntar. A lista fica
 * recolhida atrás de um resumo de uma linha (simplificação de 16/10/2026); o selo do papel no
 * topo do painel abre a mesma lista.
 */
export function MyAccessCard({
  role,
  percent,
  capabilities,
}: {
  role: string;
  /** Parte do dono ("Dono · 50%"). */
  percent?: number | null;
  capabilities: ShopCapabilities | null;
}) {
  const { t } = useI18n();
  if (!capabilities) return null;
  const rows = myAccessRows(role, capabilities, false);
  const allowed = rows.filter((row) => row.allowed).length;
  return (
    <section
      id="team-mine"
      className="app-action-card scroll-mt-28 space-y-3 p-4"
      aria-labelledby="my-access-title"
    >
      <SectionHeader
        icon={KeyRound}
        id="my-access-title"
        title={t("eq.mine.title")}
        aside={<RoleBadge role={role} percent={percent} size="md" />}
      />
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            {allowed === rows.length
              ? t("eq.mine.summaryAll")
              : allowed === 0
                ? t("eq.mine.summaryNone")
                : t("eq.mine.summarySome", { allowed, total: rows.length })}
          </span>
          <span className="shrink-0 text-xs font-semibold text-muted-foreground group-open:hidden">
            {t("eq.mine.showList")}
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden
          />
        </summary>
        <div className="mt-2 space-y-3">
          <MyAccessList role={role} capabilities={capabilities} />
        </div>
      </details>
    </section>
  );
}
