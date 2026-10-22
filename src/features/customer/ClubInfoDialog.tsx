import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Gift, Info, Scissors, Sparkles, Trophy, X } from "lucide-react";
import { Hint } from "@/components/visual";
import {
  Dialog,
  DialogActions,
  DialogAside,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LevelProgress,
  TierBadge,
  TierLadder,
  useTierPosition,
} from "@/features/loyalty/TierBadge";
import type { LoyaltyProgram } from "@/features/loyalty/program";
import { useDevice } from "@/lib/device";
import { useI18n } from "@/lib/i18n";

type ClubProps = {
  program: LoyaltyProgram;
  lifetimePoints: number;
  shopId: string | null;
  onClose: () => void;
  onOpenRewards: () => void;
};

/** Onde a pessoa está (selo do nível + barra até o próximo) e como ganhar pontos. */
function ClubNowAndEarn({
  program,
  lifetimePoints,
}: Pick<ClubProps, "program" | "lifetimePoints">) {
  const { t } = useI18n();
  const position = useTierPosition(program, lifetimePoints);
  const short = t("points.short");
  const earnRows = [
    {
      key: "visit",
      icon: Scissors,
      text: t("club.perVisit"),
      value: program.points_per_visit,
    },
    ...(program.welcome_bonus > 0
      ? [{ key: "welcome", icon: Sparkles, text: t("club.welcome"), value: program.welcome_bonus }]
      : []),
  ];
  return (
    <>
      <section aria-labelledby="club-now-title" className="space-y-3">
        <h4 id="club-now-title" className="sr-only">
          {t("club.youAreHere")}
        </h4>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <TierBadge tier={position.style} name={position.tier.name} size="lg" />
          <p className="text-sm font-semibold text-muted-foreground">
            {t("member.earnedTotal", { points: lifetimePoints, unit: short })}
          </p>
        </div>
        <LevelProgress program={program} lifetimePoints={lifetimePoints} />
      </section>

      <section aria-labelledby="club-earn-title" className="space-y-2">
        <h4 id="club-earn-title" className="text-sm font-bold text-foreground">
          {t("club.howToEarn")}
        </h4>
        <ul className="space-y-2">
          {earnRows.map((row) => (
            <li
              key={row.key}
              className="flex items-center gap-3 rounded-2xl border border-border/70 p-3"
            >
              <row.icon className="size-5 shrink-0 text-gold" aria-hidden />
              <span className="min-w-0 flex-1 text-sm font-medium">{row.text}</span>
              <span className="tone-success shrink-0 rounded-[var(--button-radius)] bg-[color:var(--tone-bg)] px-2.5 py-1 text-sm font-bold tabular-nums text-[color:var(--tone-ink)]">
                +{row.value} {short}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/** Escada de níveis com "Você está aqui". */
function ClubLevels({ program, lifetimePoints }: Pick<ClubProps, "program" | "lifetimePoints">) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="club-levels-title" className="space-y-3">
      <h4 id="club-levels-title" className="text-sm font-bold text-foreground">
        {t("club.levels")}
      </h4>
      <Hint icon={Info}>{t("club.levelsHint")}</Hint>
      <TierLadder program={program} lifetimePoints={lifetimePoints} />
    </section>
  );
}

/** Rodapé: "Ver prêmios" (quando há), política completa e "Entendi". */
function ClubFooter({
  program,
  shopId,
  onClose,
  onOpenRewards,
  row = false,
}: Pick<ClubProps, "program" | "shopId" | "onClose" | "onOpenRewards"> & { row?: boolean }) {
  const { t } = useI18n();
  const hasRewards = program.rewards.some((reward) => reward.active);
  return (
    <>
      {hasRewards && (
        <button
          type="button"
          onClick={onOpenRewards}
          className={
            row
              ? "flex min-h-11 items-center justify-center gap-2 rounded-[var(--button-radius)] bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              : "flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--button-radius)] bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          }
        >
          <Gift className="size-4" aria-hidden />
          {t("club.seeRewards")}
        </button>
      )}
      <div className={row ? "contents" : "flex flex-wrap gap-2"}>
        <Link
          to="/politica"
          search={shopId ? { shop: shopId } : {}}
          onClick={onClose}
          className={
            row
              ? "flex min-h-11 items-center justify-center gap-1 whitespace-nowrap rounded-[var(--button-radius)] border border-border px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              : "flex min-h-11 flex-1 basis-40 items-center whitespace-nowrap justify-center gap-1 rounded-[var(--button-radius)] border border-border px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          }
        >
          {t("club.fullPolicy")}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={onClose}
          className={
            row
              ? "flex min-h-11 items-center justify-center rounded-[var(--button-radius)] border border-border px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              : "flex min-h-11 flex-1 basis-32 items-center justify-center rounded-[var(--button-radius)] border border-border px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          }
        >
          {t("club.gotIt")}
        </button>
      </div>
    </>
  );
}

/**
 * Folha do celular (abaixo de 768 px), como sempre foi: sobe do pé da tela, rola por dentro e
 * fica dentro do app (sem portal) para herdar os gradientes dos níveis.
 */
function ClubSheet(props: ClubProps) {
  const { onClose } = props;
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  // onClose chega como função nova a cada render do pai; a ref evita rodar o efeito
  // de novo (e devolver o foco ao botão Fechar) enquanto a janela está aberta.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      // Mantém o Tab dentro do diálogo: sem isso o foco vaza para o conteúdo
      // que está atrás do overlay.
      if (event.key !== "Tab") return;
      const focusable = dialog.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-background/80 p-3 backdrop-blur-md animate-in fade-in duration-200 sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vip-benefits-title"
        className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div className="flex min-w-0 items-center gap-2">
            <Trophy className="size-5 shrink-0 text-gold" aria-hidden />
            <h3 id="vip-benefits-title" className="truncate font-bold text-foreground">
              {t("club.title")}
            </h3>
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            aria-label={t("club.close")}
            className="flex size-11 shrink-0 items-center justify-center rounded-[var(--button-radius)] bg-muted text-muted-foreground transition-colors hover:text-foreground"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="dialog-scroll-area flex-1 space-y-6 overflow-y-auto p-5">
          <ClubNowAndEarn program={props.program} lifetimePoints={props.lifetimePoints} />
          <ClubLevels program={props.program} lifetimePoints={props.lifetimePoints} />
        </div>

        <div className="grid gap-2 border-t border-border p-4">
          <ClubFooter {...props} />
        </div>
      </div>
    </div>
  );
}

/**
 * Janela "Como funciona o clube": onde o cliente está (selo do nível + barra até o próximo),
 * como ganhar pontos (linhas com ícone e o valor em pílula, pela regra real da barbearia) e a
 * escada de níveis com "Você está aqui". No celular é a folha de sempre; no tablet e no
 * computador é a janela larga padrão (`DialogContent size="lg"`), com o nível e as regras à
 * esquerda e a escada de níveis fixa à direita, sem rolagem interna quando cabe.
 */
export function ClubInfoDialog({
  isOpen,
  ...props
}: ClubProps & {
  isOpen: boolean;
}) {
  const { t } = useI18n();
  const device = useDevice();
  if (device === "celular") return isOpen ? <ClubSheet {...props} /> : null;
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent size="lg" className="club-info-dialog bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="size-5 shrink-0 text-gold" aria-hidden />
            {t("club.title")}
          </DialogTitle>
        </DialogHeader>
        <DialogBody layout="split">
          <div className="space-y-6">
            <ClubNowAndEarn program={props.program} lifetimePoints={props.lifetimePoints} />
          </div>
          <DialogAside>
            <ClubLevels program={props.program} lifetimePoints={props.lifetimePoints} />
          </DialogAside>
        </DialogBody>
        <DialogActions>
          <ClubFooter {...props} row />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
