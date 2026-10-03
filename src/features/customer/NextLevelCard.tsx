import { Trophy } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export type NextLevelSummary = {
  name: string;
  pointsRemaining: number;
  progress: number;
  benefit: string;
};

/**
 * Resumo compartilhado da evolução no programa de fidelidade.
 * O Início preserva o comportamento original de ocultar o card no nível máximo;
 * o Extrato pode manter uma confirmação explícita da conquista.
 */
export function NextLevelCard({
  nextLevel,
  showMaxState = false,
}: {
  nextLevel: NextLevelSummary | null;
  showMaxState?: boolean;
}) {
  const { t } = useI18n();
  if (!nextLevel && !showMaxState) return null;

  return (
    <section className="app-action-card space-y-4 p-5" aria-label={t("level.region")}>
      {nextLevel ? (
        <>
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Trophy className="size-3.5 shrink-0 text-gold" aria-hidden="true" />
                {t("level.next", { name: nextLevel.name })}
              </p>
              <p className="mt-1 text-sm font-bold">
                {t(nextLevel.pointsRemaining === 1 ? "level.remainingOne" : "level.remainingMany", {
                  points: nextLevel.pointsRemaining,
                })}
              </p>
            </div>
            <p className="shrink-0 text-sm font-bold tabular-nums">
              {nextLevel.progress.toFixed(0)}%
            </p>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full border border-border/50 bg-muted"
            role="progressbar"
            aria-label={t("level.progress", { name: nextLevel.name })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(nextLevel.progress)}
          >
            <div
              className="h-full bg-foreground transition-all duration-1000 ease-out"
              style={{ width: `${nextLevel.progress}%` }}
            />
          </div>
          <div className="pt-1">
            <p className="mb-1 text-xs font-semibold text-muted-foreground">
              {t("level.benefits")}
            </p>
            <p className="text-xs font-medium leading-relaxed">{nextLevel.benefit}</p>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
            <Trophy className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold">{t("level.maxTitle")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {t("level.maxText")}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
