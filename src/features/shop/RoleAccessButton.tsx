import { ArrowRight, CheckCircle2, ChevronDown, Hourglass, KeyRound } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconList } from "@/components/visual";
import type { ShopCapabilities } from "@/lib/auth/capabilities";
import { useI18n } from "@/lib/i18n";
import { RoleBadge, isOwnerRole } from "./roles";
import { MyAccessList } from "./settings/MyAccessCard";
import { GovernanceModeBadge, type GovernanceMode } from "./team";

/**
 * Selo de papel do topo do painel, tocável: "Dono · 50%" + o modo da sociedade (selo curto) e,
 * ao tocar, "Seu acesso" resumido (o que pode ✓ / não pode —, se as mudanças valem na hora ou
 * esperam o OK de alguém) com um atalho para Ajustes → Equipe e sociedade.
 */
export function RoleAccessButton({
  role,
  percent,
  mode,
  capabilities,
  approvers,
  onOpenTeam,
  className,
}: {
  role: string;
  /** Parte do dono ("Dono · 50%"). */
  percent?: number | null;
  /** Modo da sociedade da loja aberta (só aparece para donos). */
  mode: GovernanceMode | null;
  capabilities: ShopCapabilities | null;
  /** Quem aprova as mudanças de quem está vendo (primeiros nomes). */
  approvers?: string[] | null;
  /** Leva a Ajustes → Equipe e sociedade (o acesso completo, a sociedade e a saída). */
  onOpenTeam?: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const owner = isOwnerRole(role);
  const showMode = owner && mode;
  // No topo, o modo aparece quando há sociedade (dono único já se vê pelo "Dono · 100%").
  const showModeInHeader = showMode && mode !== "single";

  const badges = (
    <>
      <RoleBadge role={role} percent={owner ? percent : null} className="max-w-full" />
      {showModeInHeader && (
        <>
          {/* Celular estreito: só o ícone do modo; o nome completo aparece ao tocar. */}
          <GovernanceModeBadge mode={mode} short size="sm" variant="icon" className="sm:hidden" />
          <GovernanceModeBadge mode={mode} short size="sm" className="max-sm:hidden max-w-full" />
        </>
      )}
    </>
  );

  // Sem permissões ainda (abrindo a loja): só o selo, sem o resumo.
  if (!capabilities) {
    return <span className={`flex flex-wrap items-center gap-1 ${className ?? ""}`}>{badges}</span>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("eq.mine.open")}
          title={t("eq.mine.title")}
          // Área de toque de 44 px sem empurrar o cabeçalho (margem negativa compensa o espaço).
          className={`-mx-1 -my-2.5 flex min-h-11 max-w-full flex-wrap items-center gap-1 rounded-xl px-1 py-2.5 text-left transition hover:bg-muted/60 ${className ?? ""}`}
        >
          {badges}
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="z-[70] w-80 max-w-[calc(100vw-24px)] space-y-3 rounded-2xl border-border p-4 shadow-xl"
      >
        <p className="flex items-center gap-2 text-sm font-extrabold">
          <KeyRound className="size-4 shrink-0 text-gold" aria-hidden />
          {t("eq.mine.title")}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <RoleBadge role={role} percent={owner ? percent : null} size="md" />
          {showMode && (
            <GovernanceModeBadge
              mode={mode}
              youDecideAlone={mode === "single"}
              className="max-w-full"
            />
          )}
        </div>
        {owner && (
          <IconList
            size="md"
            items={[
              capabilities.canApplyOperations
                ? { icon: CheckCircle2, tone: "success", text: t("eq.gov.effectNow") }
                : {
                    icon: Hourglass,
                    tone: "pending",
                    text: approvers?.length
                      ? t("eq.gov.effectWait", { names: approvers.join(", ") })
                      : t("eq.mine.waitOwners"),
                  },
            ]}
          />
        )}
        <div className="border-t border-border/60 pt-3">
          <MyAccessList role={role} capabilities={capabilities} hideApply />
        </div>
        {onOpenTeam && (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenTeam();
            }}
            className="action-button min-h-11 w-full justify-center"
          >
            {t(owner ? "eq.mine.openSociety" : "eq.mine.openMine")}
            <ArrowRight className="size-4" aria-hidden />
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
