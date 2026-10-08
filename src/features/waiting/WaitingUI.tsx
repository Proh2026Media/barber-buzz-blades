import {
  Check,
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
  CountBadge,
  Countdown,
  IconList,
  IconTile,
  Notice,
  PersonAvatar,
  Steps,
  TONE_CLASS,
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
  // Qual botão foi tocado: o "carregando" aparece só nele; os outros ficam apenas desabilitados.
  const [pending, setPending] = useState<{ id: string; action: "join" | "claim" | "leave" } | null>(
    null,
  );
  const isPending = (id: string, action: "join" | "claim" | "leave") =>
    busy && pending?.id === id && pending.action === action;
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
    setPending({ id, action });
    void act(id, action, serviceId).then((ok) => {
      setPending(null);
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
  const feedback = (
    <>
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
    </>
  );
  if (mode === "mine") {
    // Reservas: a mesma anatomia do "Precisa da sua atenção" do Início (linha na cor do estado,
    // ícone, quando e com quem, prazo correndo) com as duas saídas à vista: confirmar a vaga
    // liberada e desistir da fila. Na fila = ⏳ "aguardando"; vaga liberada = ⚠ laranja, igual ao
    // Início.
    if (!rows.length) return <div className="space-y-3">{feedback}</div>;
    const anyYours = rows.some((w) => Date.parse(w.hold_until) <= +now);
    // Vaga liberada (prazo correndo) sobe para o topo, como no "Precisa da sua atenção".
    const ordered = [...rows].sort(
      (a, b) =>
        Number(Date.parse(a.hold_until) > +now) - Number(Date.parse(b.hold_until) > +now) ||
        a.starts_at.localeCompare(b.starts_at),
    );
    return (
      <section aria-labelledby="wait-mine-title" className="app-action-card space-y-3 p-4">
        <h3 id="wait-mine-title" className="flex items-center gap-2 text-sm font-bold">
          <Hourglass className="size-4 shrink-0 text-gold" aria-hidden />
          {t("wait.mine.title")}
          <CountBadge count={rows.length} tone={anyYours ? "warning" : "pending"} />
        </h3>
        <ul className="space-y-2">
          {ordered.map((w) => {
            const holding = Date.parse(w.hold_until) > +now;
            const tone = holding ? "pending" : "warning";
            const member = staff.find((s) => s.id === w.staff_id);
            const staffName = member?.display_name ?? t("wait.card.staffFallback");
            const day = `${formatShopDate(w.starts_at, timeZone, { weekday: "short" }, intlLocale).replace(".", "")} ${formatShopDate(w.starts_at, timeZone, { day: "2-digit", month: "2-digit" }, intlLocale)}`;
            const time = formatShopDate(
              w.starts_at,
              timeZone,
              { hour: "2-digit", minute: "2-digit" },
              intlLocale,
            );
            const titleId = `wait-${w.id}-title`;
            return (
              <li
                key={w.id}
                id={`wait-${w.id}`}
                aria-labelledby={titleId}
                tabIndex={-1}
                className={cn(
                  TONE_CLASS[tone],
                  "scroll-mt-24 space-y-3 rounded-xl border border-[color:var(--tone-border)] bg-[color:var(--tone-soft)] p-3",
                )}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <IconTile icon={holding ? Hourglass : Timer} tone={tone} size="sm" />
                  <div className="min-w-0 flex-1 basis-40">
                    <p id={titleId} className="text-sm font-semibold text-foreground">
                      {holding ? t("wait.card.holding") : t("home.attention.offerTitle")}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                      <span className="text-sm font-bold tabular-nums text-foreground">{time}</span>
                      <span className="font-semibold text-foreground">{day}</span>
                      <span aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1.5">
                        <PersonAvatar
                          name={staffName}
                          src={member?.avatar_url}
                          seed={w.staff_id}
                          size="xs"
                        />
                        {staffName}
                      </span>
                    </p>
                  </div>
                  <Countdown
                    endsAt={Date.parse(holding ? w.hold_until : w.claim_until) + offset}
                    totalSeconds={(holding ? HOLD_MINUTES : CLAIM_MINUTES) * 60}
                    label={holding ? t("wait.card.opensIn") : t("home.attention.offerLeft")}
                  />
                </div>
                {holding && (
                  // Na fila: o caminho até a vaga, para quem entrou agora saber o que vem.
                  <Steps
                    label={t("wait.step.aria")}
                    steps={[
                      { key: "queue", label: t("wait.step.queue"), icon: UserPlus },
                      { key: "open", label: t("wait.step.mayOpen"), icon: Hourglass },
                      { key: "confirm", label: t("wait.step.confirm"), icon: CheckCircle2 },
                    ].map((step, index) => ({
                      ...step,
                      status: index < 1 ? "done" : index === 1 ? "current" : "upcoming",
                    }))}
                  />
                )}
                <div className="flex flex-wrap gap-2">
                  {!holding && (
                    <button
                      type="button"
                      disabled={busy}
                      aria-busy={isPending(w.id, "claim") || undefined}
                      className="action-button action-confirm min-h-11 flex-1 basis-44"
                      onClick={() => run(w.id, "claim")}
                    >
                      {isPending(w.id, "claim") ? (
                        <Loader2 className="motion-safe:animate-spin" aria-hidden />
                      ) : (
                        <Check aria-hidden />
                      )}
                      {isPending(w.id, "claim")
                        ? t("home.attention.offerBusy")
                        : t("home.attention.offerAction")}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    aria-busy={isPending(w.id, "leave") || undefined}
                    className="action-button action-danger min-h-11 grow basis-auto"
                    onClick={() => run(w.id, "leave")}
                  >
                    {isPending(w.id, "leave") ? (
                      <Loader2 className="motion-safe:animate-spin" aria-hidden />
                    ) : (
                      <X aria-hidden />
                    )}
                    {t("wait.card.leave")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {feedback}
      </section>
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((w) => {
        const holding = Date.parse(w.hold_until) > +now;
        if (mode !== "shop") {
          // Cliente em Agendar: "Pode vagar" (a fila de Reservas é a lista acima).
          const tone = "pending";
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
          const current = -1;
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
                <IconTile icon={Hourglass} tone={tone} size="sm" />
                <h3 id={titleId} className="min-w-0 flex-1 text-sm font-bold">
                  {t("wait.card.mayOpen")}
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
                  { key: "queue", label: t("wait.step.join"), icon: UserPlus },
                  { key: "open", label: t("wait.step.mayOpen"), icon: Hourglass },
                  { key: "confirm", label: t("wait.step.confirm"), icon: CheckCircle2 },
                ].map((step, index) => ({
                  ...step,
                  status: index < current ? "done" : index === current ? "current" : "upcoming",
                }))}
              />
              <IconList
                items={[
                  { key: "one", icon: Users, text: t("wait.card.oneInterested") },
                  { key: "five", icon: CheckCircle2, text: t("wait.card.oppHint") },
                ]}
              />
              <div className="grid gap-2">
                {mode === "opportunities" && (
                  <button
                    type="button"
                    disabled={busy}
                    aria-busy={isPending(w.id, "join") || undefined}
                    className="action-button action-confirm min-h-11 w-full sm:w-auto"
                    onClick={() => run(w.id, "join", service?.id)}
                  >
                    {isPending(w.id, "join") ? (
                      <Loader2 className="motion-safe:animate-spin" aria-hidden />
                    ) : (
                      <UserPlus aria-hidden />
                    )}
                    {t("wait.card.join")}
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
      {feedback}
    </div>
  );
}
