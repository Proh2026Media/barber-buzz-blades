import {
  CalendarCheck,
  CheckCircle2,
  Hourglass,
  Loader2,
  RotateCcw,
  Timer,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import {
  ActionResult,
  Countdown,
  IconList,
  IconTile,
  Notice,
  PersonAvatar,
  Steps,
} from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CLAIM_MINUTES, HOLD_MINUTES } from "./model";
import type { WaitingController } from "./useWaiting";
import { DEFAULT_SHOP_TIMEZONE, formatShopDate, shopDateKey } from "@/lib/shop/appointments";

/** O cartão de Ajustes mora em `WaitingSettings.tsx`; reexportado para quem já importava daqui. */
export { WaitingSettings } from "./WaitingSettings";

export function WaitingCards({
  controller,
  mode,
  staff,
  service,
  day,
  appointmentId,
  onChanged,
  timeZone = DEFAULT_SHOP_TIMEZONE,
}: {
  controller: WaitingController;
  mode: "opportunities" | "mine" | "shop";
  staff: Tables<"staff">[];
  service?: Tables<"services">;
  day?: string;
  appointmentId?: string;
  onChanged?: () => void;
  /** Fuso da barbearia: datas e horários seguem a parede da loja, não o aparelho. */
  timeZone?: string;
}) {
  const { t, intlLocale } = useI18n();
  const { waits, now, busy, error, actionError, act } = controller;
  // Resultado da última ação feita NESTE bloco (o controle é compartilhado entre as telas).
  const [result, setResult] = useState<{
    state: "saved" | "error";
    text?: string;
    id: string;
    action: "join" | "claim" | "leave";
    serviceId?: string;
  } | null>(null);
  const rows = waits.filter((w) => {
    const key = shopDateKey(new Date(w.starts_at), timeZone);
    if (mode === "shop")
      return (!appointmentId || w.appointment_id === appointmentId) && (!day || key === day);
    if (mode === "mine") return w.mine;
    return (
      !w.has_interest &&
      service &&
      service.duration_minutes * 60000 <= Date.parse(w.ends_at) - Date.parse(w.starts_at) &&
      key === day &&
      Date.parse(w.hold_until) > +now
    );
  });
  // O erro de consulta só interessa com espera ou vaga na tela; o de uma ação feita aqui fica
  // à vista mesmo que a vaga tenha saído da lista (ex.: confirmar depois do prazo).
  const queryError = error && error !== actionError ? error : null;
  if (!rows.length && !result) return null;
  // O Countdown usa o relógio do aparelho; os prazos seguem o da loja (ou da demonstração).
  const offset = Date.now() - +now;
  const run = (id: string, action: "join" | "claim" | "leave", serviceId?: string) => {
    setResult(null);
    void act(id, action, serviceId).then((ok) => {
      if (!ok) {
        setResult({ state: "error", id, action, serviceId });
        return;
      }
      const text =
        action === "claim"
          ? t("home.attention.offerDone")
          : action === "leave"
            ? t("wait.event.left")
            : t("wait.card.joined");
      // "Tenho interesse" leva a Reservas: o aviso precisa sobreviver à troca de aba.
      if (mode === "opportunities") toast.success(text);
      else setResult({ state: "saved", text, id, action });
      onChanged?.();
    });
  };
  const retryable =
    result?.state === "error" && rows.some((row) => row.id === result.id) ? result : null;
  return (
    <div className="space-y-3">
      {rows.map((w) => {
        const holding = Date.parse(w.hold_until) > +now;
        if (mode !== "shop") {
          // Cliente: "Pode vagar" (Agendar), "Você está na fila" e "A vaga é sua" (Reservas).
          // Vaga liberada: mesmo tom, ícone e título do "Precisa de você" do Início. O verde com ✓
          // fica para depois de confirmar (aí ela vira reserva).
          const yours = mode === "mine" && !holding;
          const tone = yours ? "warning" : "pending";
          const member = staff.find((s) => s.id === w.staff_id);
          const staffName = member?.display_name ?? t("wait.card.staffFallback");
          // "ter 06/10": dia da semana e data, sem a vírgula do formato do navegador.
          const day = `${formatShopDate(w.starts_at, timeZone, { weekday: "short" }, intlLocale).replace(".", "")} ${formatShopDate(w.starts_at, timeZone, { day: "2-digit", month: "2-digit" }, intlLocale)}`;
          const time = formatShopDate(
            w.starts_at,
            timeZone,
            { hour: "2-digit", minute: "2-digit" },
            intlLocale,
          );
          // "Pode vagar": a pessoa ainda não entrou na fila, então nenhuma etapa está em andamento.
          const current = mode === "opportunities" ? -1 : holding ? 1 : 2;
          const titleId = `wait-${w.id}-title`;
          return (
            <section
              key={w.id}
              id={`wait-${w.id}`}
              aria-labelledby={titleId}
              tabIndex={-1}
              className={cn(
                `tone-${tone}`,
                "app-action-card scroll-mt-24 space-y-3 border-l-4 border-l-[color:var(--tone-line)] p-4",
              )}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <IconTile icon={yours ? Timer : Hourglass} tone={tone} size="sm" />
                <h3 id={titleId} className="min-w-0 flex-1 text-sm font-bold">
                  {mode === "opportunities"
                    ? t("wait.card.mayOpen")
                    : holding
                      ? t("wait.card.holding")
                      : t("home.attention.offerTitle")}
                </h3>
              </div>
              <Countdown
                endsAt={Date.parse(holding ? w.hold_until : w.claim_until) + offset}
                totalSeconds={(holding ? HOLD_MINUTES : CLAIM_MINUTES) * 60}
                label={holding ? t("wait.card.opensIn") : t("wait.card.confirmIn")}
              />
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="text-xl font-bold tabular-nums">{time}</span>
                <span className="font-semibold">{day}</span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <PersonAvatar
                    name={staffName}
                    src={member?.avatar_url}
                    seed={w.staff_id}
                    size="xs"
                  />
                  {staffName}
                </span>
              </p>
              <Steps
                label={t("wait.step.aria")}
                steps={[
                  {
                    key: "queue",
                    label: mode === "opportunities" ? t("wait.step.join") : t("wait.step.queue"),
                    icon: UserPlus,
                  },
                  { key: "open", label: t("wait.step.mayOpen"), icon: Hourglass },
                  { key: "confirm", label: t("wait.step.confirm"), icon: CheckCircle2 },
                ].map((step, index) => ({
                  ...step,
                  status: index < current ? "done" : index === current ? "current" : "upcoming",
                }))}
              />
              <IconList
                items={
                  mode === "opportunities"
                    ? [
                        { key: "one", icon: Users, text: t("wait.card.oneInterested") },
                        { key: "five", icon: CheckCircle2, text: t("wait.card.oppHint") },
                      ]
                    : [
                        {
                          key: "state",
                          icon: yours ? Timer : Hourglass,
                          text: holding ? t("wait.card.mineHolding") : t("wait.card.mineClaim"),
                        },
                      ]
                }
              />
              <div className={cn("grid gap-2", yours && "sm:grid-cols-[1fr_auto]")}>
                {mode === "opportunities" && (
                  <button
                    type="button"
                    disabled={busy}
                    aria-busy={busy || undefined}
                    className="action-button action-confirm min-h-11 w-full sm:w-auto"
                    onClick={() => run(w.id, "join", service?.id)}
                  >
                    {busy ? (
                      <Loader2 className="motion-safe:animate-spin" aria-hidden />
                    ) : (
                      <UserPlus aria-hidden />
                    )}
                    {t("wait.card.join")}
                  </button>
                )}
                {yours && (
                  <button
                    type="button"
                    disabled={busy}
                    aria-busy={busy || undefined}
                    className="action-button action-confirm min-h-12 w-full"
                    onClick={() => run(w.id, "claim")}
                  >
                    {busy ? (
                      <Loader2 className="motion-safe:animate-spin" aria-hidden />
                    ) : (
                      <CalendarCheck aria-hidden />
                    )}
                    {t("wait.card.claimAt", { day, time })}
                  </button>
                )}
                {mode === "mine" && (
                  <button
                    type="button"
                    disabled={busy}
                    className={
                      yours
                        ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50"
                        : "action-button action-danger min-h-11 w-full sm:w-auto"
                    }
                    onClick={() => run(w.id, "leave")}
                  >
                    <X className="size-4" aria-hidden />
                    {t("wait.card.leave")}
                  </button>
                )}
              </div>
            </section>
          );
        }
        // Equipe (agenda da loja): situação da vaga e "Restaurar confirmação".
        return (
          <section key={w.id} className="app-action-card space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <IconTile icon={Hourglass} tone="pending" size="sm" />
              <h3 className="min-w-0 flex-1 text-sm font-semibold">
                {holding ? t("wait.card.holding") : t("wait.card.exclusive")}
              </h3>
              <Countdown endsAt={Date.parse(holding ? w.hold_until : w.claim_until) + offset} />
            </div>
            <p className="text-sm">
              {formatShopDate(w.starts_at, timeZone, { dateStyle: "short" }, intlLocale)} ·{" "}
              {formatShopDate(
                w.starts_at,
                timeZone,
                { hour: "2-digit", minute: "2-digit" },
                intlLocale,
              )}{" "}
              ·{" "}
              {staff.find((s) => s.id === w.staff_id)?.display_name ?? t("wait.card.staffFallback")}
            </p>
            <p className="text-xs text-muted-foreground">
              {w.has_interest ? t("wait.card.shopWaiting") : t("wait.card.shopNone")}
            </p>
            <div className="flex flex-wrap gap-2">
              {holding && w.restorable && (
                <button
                  disabled={busy}
                  className="action-button action-confirm"
                  onClick={() =>
                    void act(w.id, "restore").then((ok) => {
                      if (ok) onChanged?.();
                    })
                  }
                >
                  <RotateCcw className="size-4" />
                  {t("wait.card.restore")}
                </button>
              )}
            </div>
          </section>
        );
      })}
      {result && (
        <ActionResult
          state={result.state}
          text={result.state === "error" ? (actionError ?? t("wait.err.update")) : result.text}
          autoHideMs={6000}
          onRetry={
            retryable ? () => run(retryable.id, retryable.action, retryable.serviceId) : undefined
          }
          onDismiss={() => setResult(null)}
        />
      )}
      {queryError && rows.length > 0 && (
        <Notice
          tone="danger"
          title={queryError}
          action={{
            label: t("visual.retry"),
            icon: RotateCcw,
            onClick: () => void controller.refresh(),
          }}
        />
      )}
    </div>
  );
}
