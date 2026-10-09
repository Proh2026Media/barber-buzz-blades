import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  DoorOpen,
  Gift,
  Hourglass,
  Link2,
  Loader2,
  Lock,
  Plus,
  Send,
  Store,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  ActionResult,
  ChoiceCards,
  Field,
  IconList,
  IconTile,
  Notice,
  PersonAvatar,
  SectionHeader,
  StatusBadge,
  Steps,
  type ActionState,
  type IconListItem,
} from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import { t as tNow, useI18n } from "@/lib/i18n";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { isOwnerRole, type ShopRole } from "../roles";
import { activeOwners, firstName, loadTeamMembers, type TeamMember } from "../team";

type DepartureRequest = {
  id: string;
  user_id: string;
  staff_id: string;
  mode: "take" | "forfeit";
  dest_shop_id: string | null;
  status: string;
  created_at: string;
  staff_name: string | null;
  requester_name: string | null;
};

type DestShop = {
  id: string;
  name: string;
  slug: string;
};

type Mode = "take" | "forfeit";

type ShopDepartureCardProps = {
  shopId: string;
  /** Se true, mostra pedidos de saída de outros donos para liberar (dono/sócio). */
  canApproveRelease?: boolean;
  /** Se true, mostra "Sair da barbearia" para o próprio usuário. */
  canRequestDeparture?: boolean;
  /** Se false, sai sem levar clientes (só a opção "Sair e deixar os clientes"). */
  canTakeClients?: boolean;
  /** Papel de quem está vendo (pré-condições de dono). */
  role?: ShopRole | null;
  /** Atalho para "Pessoas e papéis" (mudar o próprio papel antes de sair). */
  onOpenPeople?: () => void;
  /** Conta de quem está vendo (na demonstração, sem perguntar ao servidor). */
  viewerId?: string;
};

/** Id da barbearia de destino de exemplo na demonstração. */
const DEMO_DEST_SHOP = "demo-dest-shop";

function relative(iso: string, locale: string) {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (hours < 1) return rtf.format(-Math.max(1, Math.round(hours * 60)), "minute");
  if (hours < 24) return rtf.format(-Math.round(hours), "hour");
  return rtf.format(-Math.round(hours / 24), "day");
}

export function ShopDepartureCard({
  shopId,
  canApproveRelease = false,
  canRequestDeparture = true,
  canTakeClients = true,
  role = null,
  onOpenPeople,
  viewerId,
}: ShopDepartureCardProps) {
  const { t, intlLocale } = useI18n();
  // Demonstração: equipe fictícia, uma barbearia de destino de exemplo e a saída só simulada.
  const demo = useDemo();
  const demoOn = Boolean(demo);
  const demoTeam = demo?.team ?? null;
  const [userId, setUserId] = useState<string | null>(null);
  const [requests, setRequests] = useState<DepartureRequest[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [destShops, setDestShops] = useState<DestShop[]>([]);
  const [destNames, setDestNames] = useState<Map<string, string>>(() => new Map());
  const [listError, setListError] = useState<string | null>(null);
  const [decision, setDecision] = useState<{
    id: string;
    state: ActionState;
    text: string;
    /** Qual escolha foi feita (para "Tentar de novo" repetir a mesma). */
    approve?: boolean;
  } | null>(null);
  const [deciding, setDeciding] = useState<{ id: string; approve: boolean } | null>(null);

  // Folha "Sair da barbearia".
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode | null>(null);
  const [destShopId, setDestShopId] = useState<string | null>(null);
  const [newShopName, setNewShopName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ state: ActionState; text: string } | null>(null);

  const ownerViewer = isOwnerRole(role);

  const load = useCallback(async () => {
    setListError(null);
    if (demoOn) {
      setUserId(viewerId ?? null);
      setRequests([]);
      setMembers(demoTeam ?? []);
      setDestShops((current) =>
        current.some((shop) => shop.id === DEMO_DEST_SHOP)
          ? current
          : [{ id: DEMO_DEST_SHOP, name: tNow("demo.leave.destShop"), slug: "demo-destino" }],
      );
      return;
    }
    const { data: sessionProfile } = await supabase.auth.getUser();
    const uid = sessionProfile.user?.id ?? null;
    setUserId(uid);
    if (canApproveRelease || canRequestDeparture) {
      const { data, error: listFailure } = await supabase.rpc("list_shop_departure_requests", {
        p_shop_id: shopId,
      });
      if (listFailure) setListError(friendlyAuthError(listFailure));
      else {
        const rows = Array.isArray(data) ? (data as unknown as DepartureRequest[]) : [];
        setRequests(rows);
        // Nome da barbearia de destino, quando quem decide consegue ler (só leitura; sem acesso
        // o pedido mostra "outra barbearia").
        const destIds = [
          ...new Set(rows.map((row) => row.dest_shop_id).filter((id): id is string => !!id)),
        ];
        if (destIds.length) {
          const { data: shops } = await supabase
            .from("barbershops")
            .select("id, name")
            .in("id", destIds);
          setDestNames(new Map((shops ?? []).map((shop) => [shop.id, shop.name])));
        }
      }
    }
    if (ownerViewer) setMembers(await loadTeamMembers(shopId).catch(() => []));
    if (uid && canRequestDeparture) {
      const { data: actors, error: actorsError } = await supabase
        .from("shop_members")
        .select("barbershop_id")
        .eq("user_id", uid)
        .eq("active", true)
        .neq("barbershop_id", shopId);
      if (actorsError) {
        setCreateError(friendlyAuthError(actorsError, tNow("team.departure.loadShopsFailed")));
        return;
      }
      const ids = (actors ?? []).map((row) => row.barbershop_id).filter(Boolean);
      if (ids.length) {
        const { data: shops, error: shopsError } = await supabase
          .from("barbershops")
          .select("id, name, slug")
          .in("id", ids)
          .eq("status", "active");
        if (shopsError) {
          setCreateError(friendlyAuthError(shopsError, tNow("team.departure.loadShopsFailed")));
          return;
        }
        setDestShops(shops ?? []);
      } else setDestShops([]);
    }
  }, [shopId, canApproveRelease, canRequestDeparture, ownerViewer, demoOn, demoTeam, viewerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = requests.filter((row) => row.status === "pending_release");
  const mine = pending.find((row) => row.user_id === userId) ?? null;
  const others = canApproveRelease ? pending.filter((row) => row.user_id !== userId) : [];
  const owners = useMemo(() => activeOwners(members), [members]);
  const otherOwners = owners.filter((owner) => owner.user_id !== userId);
  const othersText = otherOwners.length
    ? otherOwners.map((owner) => firstName(owner.display_name)).join(", ")
    : t("eq.gov.otherOwners");
  // Dono que leva os clientes precisa da liberação dos outros donos.
  const needsRelease = ownerViewer && mode === "take";
  const steps = mode === "take" ? ["clients", "dest", "review"] : ["clients", "review"];
  const current = steps[Math.min(step, steps.length - 1)]!;

  function startDeparture() {
    setStep(0);
    // Quem não leva clientes já começa com a única escolha possível.
    setMode(canTakeClients ? null : "forfeit");
    setDestShopId(null);
    setResult(null);
    setCreateError(null);
    setOpen(true);
  }

  async function createDestinationShop() {
    if (!newShopName.trim()) {
      setCreateError(t("team.departure.nameRequired"));
      return;
    }
    if (demoOn) {
      // Demonstração: a barbearia nova existe só nesta tela.
      const id = `demo-new-shop-${destShops.length + 1}`;
      setDestShops((current) => [...current, { id, name: newShopName.trim(), slug: id }]);
      setDestShopId(id);
      setNewShopName("");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("create_own_barbershop", {
        p_name: newShopName.trim(),
      });
      if (rpcError) throw rpcError;
      const payload = data as { shop_id?: string };
      if (!payload.shop_id) throw new Error(t("team.departure.createError"));
      await load();
      setDestShopId(payload.shop_id);
      setNewShopName("");
    } catch (err) {
      setCreateError(friendlyAuthError(err, t("team.departure.createFailed")));
    } finally {
      setCreating(false);
    }
  }

  async function requestDeparture() {
    if (!mode || (mode === "take" && !destShopId)) return;
    if (demoOn) {
      // Demonstração: mostra o fim do caminho sem tirar ninguém da loja.
      setResult({ state: "saved", text: t("demo.leave.simulated") });
      return;
    }
    setSending(true);
    setResult({ state: "saving", text: t("eq.leave.sending") });
    try {
      const { data, error: rpcError } = await supabase.rpc("request_shop_departure", {
        p_shop_id: shopId,
        p_mode: mode,
        p_dest_shop_id: mode === "take" ? destShopId : null,
      });
      if (rpcError) throw rpcError;
      const payload = data as { status?: string };
      setResult(
        payload.status === "pending_release"
          ? { state: "pending", text: t("eq.leave.sentFor", { names: othersText }) }
          : {
              state: "saved",
              text: mode === "take" ? t("eq.leave.doneTake") : t("eq.leave.doneForfeit"),
            },
      );
      await load();
    } catch (err) {
      setResult({ state: "error", text: friendlyAuthError(err, t("team.departure.failed")) });
    } finally {
      setSending(false);
    }
  }

  async function decide(id: string, approve: boolean) {
    setDeciding({ id, approve });
    setDecision(null);
    try {
      const { error: rpcError } = await supabase.rpc(
        approve ? "approve_portfolio_release" : "reject_portfolio_release",
        { p_request_id: id, p_note: null },
      );
      if (rpcError) throw rpcError;
      setDecision({
        id,
        state: "saved",
        text: approve ? t("eq.leave.released") : t("eq.leave.rejected"),
      });
      await load();
    } catch (err) {
      setDecision({
        id,
        state: "error",
        text: friendlyAuthError(err, t("team.departure.decideFailed")),
        approve,
      });
    } finally {
      setDeciding(null);
    }
  }

  const takeEffects: IconListItem[] = [
    { icon: Users, tone: "gold", text: t("eq.leave.effectClients") },
    { icon: Gift, tone: "gold", text: t("eq.leave.effectPoints") },
    { icon: Link2, tone: "gold", text: t("eq.leave.effectLink") },
  ];
  const destName = destShops.find((shop) => shop.id === destShopId)?.name ?? "";
  const review: IconListItem[] = [
    { icon: DoorOpen, tone: "danger", text: t("eq.leave.effectAccess") },
    ...(mode === "take"
      ? [
          {
            icon: Users,
            tone: "warning" as const,
            text: t("eq.leave.effectGo", { shop: destName }),
          },
          { icon: Link2, tone: "warning" as const, text: t("eq.leave.effectLink") },
        ]
      : [{ icon: Store, tone: "success" as const, text: t("eq.leave.effectStay") }]),
  ];
  const canContinue =
    (current === "clients" && !!mode) ||
    (current === "dest" && !!destShopId) ||
    current === "review";

  const decisionFor = (id: string) =>
    decision && decision.id === id ? (
      <ActionResult
        state={decision.state}
        text={decision.text}
        onRetry={
          decision.state === "error" && decision.approve !== undefined
            ? () => void decide(id, decision.approve === true)
            : undefined
        }
        onDismiss={() => setDecision(null)}
      />
    ) : null;

  if (!canRequestDeparture && others.length === 0 && !decision) return null;

  return (
    <section className="app-action-card space-y-4 p-4" aria-labelledby="departure-title">
      <SectionHeader
        icon={UserMinus}
        id="departure-title"
        title={t("eq.leave.cardTitle")}
        aside={
          others.length > 0 ? (
            <StatusBadge
              tone="pending"
              icon={Hourglass}
              label={t("eq.leave.waitingCount", { count: others.length })}
            />
          ) : undefined
        }
      />

      {listError && <ActionResult state="error" text={listError} onRetry={() => void load()} />}

      {/* Pedidos de outros donos esperando a sua liberação (mesmo padrão das decisões). */}
      {others.length > 0 && (
        <ul className="space-y-3" aria-label={t("eq.leave.toDecide")}>
          {others.map((row) => {
            const name = row.requester_name || row.staff_name || t("eq.gov.someone");
            const busy = deciding?.id === row.id;
            return (
              <li
                key={row.id}
                className="tone-pending space-y-3 rounded-2xl border border-border border-l-4 border-l-[color:var(--tone-line)] bg-card p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <PersonAvatar name={name} seed={row.user_id} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("eq.leave.wantsTake")} · {relative(row.created_at, intlLocale)}
                    </p>
                  </div>
                  <StatusBadge
                    tone="pending"
                    icon={Hourglass}
                    size="sm"
                    label={t("eq.gov.waitingYou")}
                  />
                </div>
                <IconList
                  items={takeEffects.map((item, index) => {
                    const dest = row.dest_shop_id ? destNames.get(row.dest_shop_id) : undefined;
                    // Com o nome do destino, a primeira linha diz para onde os clientes vão.
                    return index === 0 && dest
                      ? { ...item, text: t("eq.leave.goTo", { shop: dest }) }
                      : item;
                  })}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!!deciding}
                    className="action-button action-danger min-h-11 flex-1 justify-center sm:flex-none"
                    onClick={() => void decide(row.id, false)}
                  >
                    {busy && !deciding?.approve ? (
                      <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
                    ) : (
                      <X className="size-4" aria-hidden />
                    )}
                    {t("eq.gov.decline")}
                  </button>
                  <button
                    type="button"
                    disabled={!!deciding}
                    className="action-button action-confirm min-h-11 flex-1 justify-center sm:flex-none"
                    onClick={() => void decide(row.id, true)}
                  >
                    {busy && deciding?.approve ? (
                      <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
                    ) : (
                      <Check className="size-4" aria-hidden />
                    )}
                    {t("eq.leave.release")}
                  </button>
                </div>
                {/* Resultado logo abaixo dos botões que decidiram. */}
                {decisionFor(row.id)}
              </li>
            );
          })}
        </ul>
      )}
      {decision && !others.some((row) => row.id === decision.id) && (
        <ActionResult
          state={decision.state}
          text={decision.text}
          onDismiss={() => setDecision(null)}
        />
      )}

      {/* O próprio pedido: andamento, sem botões de decisão. */}
      {mine && (
        <div className="tone-pending space-y-3 rounded-2xl border border-border border-l-4 border-l-[color:var(--tone-line)] bg-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex-1 text-sm font-bold">{t("eq.leave.yourRequest")}</p>
            <StatusBadge
              tone="pending"
              icon={Hourglass}
              size="sm"
              label={t("eq.leave.waitingRelease")}
            />
          </div>
          <Steps
            label={t("eq.leave.yourRequest")}
            steps={[
              { key: "sent", label: t("eq.leave.step.sent"), status: "done" },
              { key: "release", label: t("eq.leave.step.release"), status: "current" },
              { key: "done", label: t("eq.leave.step.done"), status: "upcoming" },
            ]}
          />
        </div>
      )}

      {/* Zona de risco: uma linha recolhida que abre a folha em etapas. */}
      {canRequestDeparture && !mine && (
        <button
          type="button"
          onClick={startDeparture}
          className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-dashed border-border px-3 py-2 text-left transition hover:border-destructive/50"
        >
          <IconTile icon={DoorOpen} tone="danger" size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-destructive">{t("eq.leave.title")}</span>
            <span className="block text-xs text-muted-foreground">
              {ownerViewer ? t("eq.leave.lockedHint") : t("eq.leave.rowHint")}
            </span>
          </span>
          {ownerViewer ? (
            <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
        </button>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!sending) setOpen(next);
        }}
      >
        <DialogContent className="max-w-lg rounded-3xl border-border bg-card p-5">
          <div className="pe-10">
            <DialogTitle className="flex items-center gap-2 text-base font-extrabold">
              <DoorOpen className="size-5 text-destructive" aria-hidden />
              {t("eq.leave.title")}
            </DialogTitle>
            <DialogDescription className="sr-only">{t("eq.leave.rowHint")}</DialogDescription>
          </div>

          {result && result.state !== "saving" && result.state !== "error" ? (
            <div className="space-y-4">
              <ActionResult state={result.state} text={result.text} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="action-button action-confirm min-h-11 w-full justify-center"
              >
                {t("eq.common.done")}
              </button>
            </div>
          ) : ownerViewer ? (
            // Dono ainda não pode sair: só a condição e o caminho para resolver (sem etapas que
            // terminariam num erro do servidor).
            <div className="space-y-4">
              <Notice
                tone="warning"
                icon={Lock}
                role="none"
                title={otherOwners.length ? t("eq.leave.ownerFirst") : t("eq.leave.soleOwner")}
              >
                {otherOwners.length
                  ? t("eq.leave.ownerFirstHint", {
                      name: firstName(otherOwners[0]!.display_name),
                    })
                  : t("eq.leave.soleOwnerHint")}
              </Notice>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="action-button min-h-11 justify-center"
                >
                  {t("eq.leave.stay")}
                </button>
                {onOpenPeople && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onOpenPeople();
                    }}
                    className="action-button action-confirm min-h-11 justify-center"
                  >
                    <Users className="size-4" aria-hidden />
                    {t("eq.leave.openPeople")}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Steps
                label={t("eq.leave.title")}
                steps={steps.map((id, index) => ({
                  key: id,
                  label: t(`eq.leave.step.${id}` as "eq.leave.step.clients"),
                  status: index < step ? "done" : index === step ? "current" : "upcoming",
                }))}
                onStepClick={(index) => setStep(index)}
              />

              {current === "clients" && (
                <ChoiceCards
                  legend={t("eq.leave.clientsQuestion")}
                  showLegend
                  value={mode}
                  onChange={(value) => {
                    setMode(value);
                    if (value === "forfeit") setDestShopId(null);
                  }}
                  options={[
                    {
                      value: "forfeit",
                      icon: Store,
                      title: t("eq.leave.forfeit"),
                      description: t("eq.leave.forfeitHint"),
                    },
                    ...(canTakeClients
                      ? [
                          {
                            value: "take" as const,
                            icon: Users,
                            title: t("eq.leave.take"),
                            description: t("eq.leave.takeHint"),
                            content: <IconList items={takeEffects} />,
                          },
                        ]
                      : []),
                  ]}
                />
              )}

              {current === "dest" && (
                <div className="space-y-3">
                  {destShops.length > 0 ? (
                    <ChoiceCards
                      legend={t("eq.leave.destQuestion")}
                      showLegend
                      value={destShopId}
                      onChange={setDestShopId}
                      options={destShops.map((shop) => ({
                        value: shop.id,
                        icon: Store,
                        title: shop.name,
                      }))}
                    />
                  ) : (
                    <p className="text-sm font-bold">{t("eq.leave.destQuestion")}</p>
                  )}
                  <div className="space-y-2 rounded-2xl border border-dashed border-border p-3">
                    <p className="flex items-center gap-2 text-sm font-bold">
                      <Plus className="size-4 text-gold" aria-hidden />
                      {t("eq.leave.createTitle")}
                    </p>
                    <Field
                      label={t("team.departure.newNamePlaceholder")}
                      error={createError ?? undefined}
                    >
                      {(props) => (
                        <input
                          {...props}
                          value={newShopName}
                          onChange={(e) => setNewShopName(e.target.value)}
                          className="min-h-11 w-full rounded-[var(--control-radius)] border border-border bg-background px-3 text-sm"
                        />
                      )}
                    </Field>
                    <button
                      type="button"
                      disabled={creating || !newShopName.trim()}
                      className="action-button action-confirm min-h-11 w-full justify-center"
                      onClick={() => void createDestinationShop()}
                    >
                      {creating ? (
                        <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
                      ) : (
                        <Plus className="size-4" aria-hidden />
                      )}
                      {t("eq.leave.create")}
                    </button>
                  </div>
                </div>
              )}

              {current === "review" && mode && (
                <div className="space-y-3">
                  <IconList size="md" items={review} label={t("eq.leave.reviewLabel")} />
                  {needsRelease && (
                    <StatusBadge
                      tone="pending"
                      icon={Hourglass}
                      label={t("eq.leave.needsRelease", { names: othersText })}
                    />
                  )}
                </div>
              )}

              {/* No celular o botão principal fica no alto da pilha: o erro fica colado nele. */}
              {result?.state === "error" && (
                <ActionResult
                  state="error"
                  text={result.text}
                  reveal={false}
                  onRetry={current === "review" ? () => void requestDeparture() : undefined}
                />
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {step === 0 ? (
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="action-button min-h-11 justify-center"
                  >
                    {t("eq.leave.stay")}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => setStep((value) => value - 1)}
                    className="action-button min-h-11 justify-center"
                  >
                    <ArrowLeft className="size-4" aria-hidden />
                    {t("eq.common.back")}
                  </button>
                )}
                {current === "review" ? (
                  <button
                    type="button"
                    disabled={sending || !mode}
                    onClick={() => void requestDeparture()}
                    className="action-button action-danger min-h-11 justify-center"
                  >
                    {sending ? (
                      <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
                    ) : needsRelease ? (
                      <Send className="size-4" aria-hidden />
                    ) : (
                      <DoorOpen className="size-4" aria-hidden />
                    )}
                    {needsRelease ? t("eq.leave.sendRequest") : t("eq.leave.confirm")}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!canContinue}
                    onClick={() => setStep((value) => value + 1)}
                    className="action-button action-confirm min-h-11 justify-center"
                  >
                    {t("eq.common.continue")}
                    <ArrowRight className="size-4" aria-hidden />
                  </button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
