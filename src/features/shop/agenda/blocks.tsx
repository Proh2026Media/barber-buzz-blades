import { Moon, Store } from "lucide-react";
import { PersonAvatar, STATE, StatusBadge } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { BLOCK_HATCH, useBlockInfo } from "./board";
import type { AgendaBlock } from "./types";

/**
 * Bloqueio na linha do tempo do celular: listra vermelha à esquerda (a mesma de Horários), selo
 * "Bloqueado", motivo com ícone, de quem é (profissional ou a barbearia toda) e o horário.
 */
export function BlockRow({
  block,
  timeZone,
  day,
  open,
  showWho,
  photo,
}: {
  block: AgendaBlock;
  timeZone: string;
  day: { start: number; end: number };
  open: { start: number; end: number } | null;
  /** Visão da equipe: diz de quem é o bloqueio. */
  showWho: boolean;
  photo?: string | null;
}) {
  const { t } = useI18n();
  const info = useBlockInfo(timeZone)(block, day, open);
  const Icon = info.icon;
  return (
    // Fundo do cartão por baixo: no tema escuro a faixa segue off-white, como os cartões.
    <div className="rounded-2xl bg-card">
      <div className="tone-danger flex overflow-hidden rounded-2xl border border-[color:var(--tone-border)] bg-[color:var(--tone-soft)]">
        <span aria-hidden className="w-2.5 shrink-0" style={BLOCK_HATCH} />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
          <StatusBadge {...STATE.blocked} label={t("agenda.blocked")} size="sm" />
          {info.reason && (
            <span className="inline-flex min-w-0 items-center gap-1 text-sm font-semibold text-[color:var(--tone-ink)]">
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 break-words">{info.reason}</span>
            </span>
          )}
          <span className="ms-auto shrink-0 text-sm font-bold tabular-nums text-[color:var(--tone-ink)]">
            {info.range}
          </span>
          {showWho && (
            <span className="flex basis-full items-center gap-1.5 text-xs font-semibold text-foreground">
              {block.staff_id && block.staff?.display_name ? (
                <>
                  <PersonAvatar
                    name={block.staff.display_name}
                    src={photo}
                    seed={block.staff_id}
                    size="xs"
                  />
                  <span className="min-w-0 break-words">{block.staff.display_name}</span>
                </>
              ) : (
                <>
                  <Store className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  {t("shop.block.wholeShop")}
                </>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Barbearia fechada no dia, mas com atendimentos marcados: faixa cinza no topo da lista. */
export function ClosedRow({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <div className={cn("rounded-2xl bg-card", className)}>
      <div className="tone-neutral flex items-center gap-2 rounded-2xl border border-dashed border-[color:var(--tone-line)] bg-[color:var(--tone-soft)] px-3 py-2 text-sm font-semibold text-[color:var(--tone-ink)]">
        <Moon className="size-4 shrink-0" aria-hidden />
        {t("agenda.empty.closed")}
      </div>
    </div>
  );
}
