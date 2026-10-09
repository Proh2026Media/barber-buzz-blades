import {
  CheckCircle2,
  Clock3,
  EyeOff,
  Hourglass,
  Pencil,
  Plus,
  RefreshCw,
  Scissors,
  Sparkles,
  Trash2,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ConfirmDialog,
  EmptyState,
  LoadingState,
  MoreActions,
  Notice,
  PersonAvatar,
  STATE,
  StatusBadge,
  Tag,
} from "@/components/visual";
import { ServiceIcon } from "@/components/ui/service-icon";
import { useI18n } from "@/lib/i18n";
import { CatalogFilters, type CatalogStatus } from "../CatalogFilters";
import {
  readCatalogViewPreference,
  writeCatalogViewPreference,
  type CatalogViewMode,
} from "../CatalogViewToggle";
import { CatalogCard, ItemToggle } from "./CatalogCard";
import { InfoDialog } from "./InfoDialog";
import { useCatalogLabels } from "./labels";
import { ServiceForm } from "./ServiceForm";
import {
  HasBookingsError,
  type AwaitingApproval,
  type SaveOutcome,
  type ServiceDraft,
  type ServiceRow,
  type ServiceSaveResult,
  type ServiceTerm,
  type StaffRow,
} from "./types";

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();

export type ServiceActions = {
  save: (draft: ServiceDraft, editing: ServiceRow | null) => Promise<ServiceSaveResult>;
  /** Liga/desliga "aparece para clientes". */
  toggle: (row: ServiceRow) => Promise<SaveOutcome>;
  remove: (row: ServiceRow) => Promise<SaveOutcome>;
  uploadImage: (file: File) => Promise<string>;
};

/** Aba Serviços do painel: o que o cliente pode escolher, com estado, preço e quem faz. */
export function ServicesTab({
  shopId,
  services,
  staff,
  terms,
  loading,
  loadError,
  catalogLoadFailed = false,
  onRetry,
  canCreate,
  canEdit,
  canChangeGlobal,
  ownCatalog,
  canSuggest = ownCatalog,
  shopTerms,
  prepSupported,
  shopPrep,
  awaiting,
  slotNotice,
  actions,
  onOpenApprovals,
}: {
  shopId: string;
  services: ServiceRow[];
  staff: StaffRow[];
  /** Quem faz cada serviço; null = todos fazem todos (mesma regra do app do cliente). */
  terms: ServiceTerm[] | null;
  loading: boolean;
  loadError: string | null;
  /** A última carga de serviços/equipe falhou: lista vazia não quer dizer "nenhum serviço". */
  catalogLoadFailed?: boolean;
  onRetry: () => void;
  canCreate: boolean;
  canEdit: boolean;
  canChangeGlobal: boolean;
  /**
   * "Meus serviços" (Parceiro, ou quem tem serviços próprios): preço, duração e "você atende"
   * valem só na agenda de quem edita; a loja continua com os dela.
   */
  ownCatalog: boolean;
  /** "Sugerir aos outros parceiros" no formulário. */
  canSuggest?: boolean;
  /** Catálogo próprio: preço e duração da loja por serviço (para comparar com os seus). */
  shopTerms: Record<string, { price_cents: number; duration_minutes: number }>;
  prepSupported: boolean;
  shopPrep: number;
  awaiting: AwaitingApproval;
  slotNotice: ReactNode;
  actions: ServiceActions;
  onOpenApprovals?: () => void;
}) {
  const { t } = useI18n();
  const { duration, money } = useCatalogLabels();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CatalogStatus>("all");
  const [view, setView] = useState<CatalogViewMode>(() =>
    readCatalogViewPreference(shopId, "services", "grid"),
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceRow | null>(null);
  const [blockedTarget, setBlockedTarget] = useState<ServiceRow | null>(null);
  const [flashName, setFlashName] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const visible = services.filter(
    (row) =>
      normalize(row.name).includes(normalize(query)) &&
      (status === "all" || row.active === (status === "active")),
  );
  const activeCount = services.filter((row) => row.active).length;
  // Carga falhou e não há nada para mostrar: avisa a falha em vez do "primeiro serviço".
  const loadFailedEmpty = catalogLoadFailed && !loading && services.length === 0;

  // Depois de criar/salvar, contorna o cartão por 2,5 s e rola até ele.
  useEffect(() => {
    if (!flashName) return;
    const match = [...services].reverse().find((row) => row.name === flashName);
    if (!match) return;
    setFlashId(match.id);
    setFlashName(null);
    window.setTimeout(() => {
      document
        .getElementById(`service-${match.id}`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 50);
  }, [flashName, services]);
  useEffect(() => {
    if (!flashId) return;
    const timer = window.setTimeout(() => setFlashId(null), 2500);
    return () => window.clearTimeout(timer);
  }, [flashId]);

  const doersByService = useMemo(() => {
    const active = staff.filter((member) => member.active);
    const map = new Map<string, { member: StaffRow; ownPrice: boolean }[]>();
    for (const service of services) {
      if (!terms) {
        map.set(
          service.id,
          active.map((member) => ({ member, ownPrice: false })),
        );
        continue;
      }
      map.set(
        service.id,
        active
          .map((member) => {
            const term = terms.find(
              (row) => row.staff_id === member.id && row.service_id === service.id,
            );
            return term
              ? {
                  member,
                  ownPrice:
                    term.price_cents !== service.price_cents ||
                    term.duration_minutes !== service.duration_minutes,
                }
              : null;
          })
          .filter((row): row is { member: StaffRow; ownPrice: boolean } => row !== null),
      );
    }
    return map;
  }, [services, staff, terms]);

  function openForm(row: ServiceRow | null) {
    setEditing(row);
    setFormOpen(true);
  }

  function pendingToast(name: string) {
    toast(t("catalog.toast.pending"), {
      description: name,
      icon: <Hourglass aria-hidden />,
      action: onOpenApprovals
        ? { label: t("catalog.toast.seeRequest"), onClick: onOpenApprovals }
        : undefined,
    });
  }

  async function toggle(row: ServiceRow) {
    try {
      const outcome = await actions.toggle(row);
      if (outcome === "pending") pendingToast(row.name);
      else if (row.active)
        toast.success(
          ownCatalog
            ? t("catalog.own.toastOff", { name: row.name })
            : t("catalog.toast.servicePaused", { name: row.name }),
          {
            description: ownCatalog
              ? t("catalog.own.toastOffHint")
              : t("catalog.toast.servicePausedHint"),
            action: { label: t("catalog.toast.undo"), onClick: () => void undoPause(row) },
          },
        );
      else
        toast.success(
          ownCatalog
            ? t("catalog.own.toastOn", { name: row.name })
            : t("catalog.toast.serviceShown", { name: row.name }),
        );
      return outcome;
    } catch (cause) {
      // O erro aparece junto do controle que falhou (interruptor, janela ou zona de perigo),
      // com "Tentar de novo"; sem aviso flutuante repetido.
      throw cause instanceof Error && cause.message
        ? cause
        : new Error(t("shop.error.toggleService"));
    }
  }

  /** "Desfazer" do aviso de pausa: volta a mostrar pelo mesmo caminho do interruptor. */
  async function undoPause(row: ServiceRow) {
    try {
      await toggle({ ...row, active: false });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : t("shop.error.toggleService"), {
        action: { label: t("visual.retry"), onClick: () => void undoPause(row) },
      });
    }
  }

  function saved(result: ServiceSaveResult, draft: ServiceDraft) {
    const wasEditing = Boolean(editing);
    setFormOpen(false);
    if (result.outcome === "pending") {
      pendingToast(draft.name);
      return;
    }
    const suggestion =
      result.suggestion === "sent"
        ? t("catalog.toast.suggestionSent")
        : result.suggestion === "failed"
          ? t("catalog.toast.suggestionFailed")
          : undefined;
    toast.success(
      wasEditing ? t("catalog.toast.serviceSaved") : t("catalog.toast.serviceCreated"),
      { description: suggestion ? `${draft.name} · ${suggestion}` : draft.name },
    );
    setFlashName(draft.name);
  }

  return (
    <section className="space-y-4">
      <div className="app-section-title">
        <Scissors />
        <h2>{t(ownCatalog ? "shop.nav.myServices" : "shop.nav.services")}</h2>
        {canCreate && services.length > 0 && (
          <button
            type="button"
            className="action-button action-confirm ml-auto"
            onClick={() => openForm(null)}
          >
            <Plus className="size-4" aria-hidden />
            {t("catalog.service.new")}
          </button>
        )}
      </div>

      {loadError && !loadFailedEmpty && (
        <Notice
          tone="danger"
          title={loadError}
          action={{ label: t("visual.retry"), onClick: onRetry, icon: RefreshCw }}
        />
      )}

      {/* Catálogo próprio: deixa claro que nada aqui muda a loja, só a sua agenda. */}
      {ownCatalog && (
        <Notice tone="highlight" icon={UserRound} role="none" title={t("catalog.own.band")} />
      )}

      {slotNotice}

      <CatalogFilters
        query={query}
        onQuery={setQuery}
        status={status}
        onStatus={setStatus}
        total={services.length}
        active={activeCount}
        visible={visible.length}
        label={t("shop.services.search")}
        activeLabel={t(ownCatalog ? "catalog.own.youServe" : "catalog.service.filterVisible")}
        pausedLabel={t(ownCatalog ? "catalog.own.youDont" : "brand.catalog.paused")}
        viewMode={view}
        onViewMode={(next) => {
          setView(next);
          writeCatalogViewPreference(shopId, "services", next);
        }}
      />

      {loading && services.length === 0 ? (
        <LoadingState label={t("catalog.service.loading")} variant="cards" count={3} />
      ) : loadFailedEmpty ? (
        <EmptyState
          status="danger"
          title={t("catalog.service.loadErrorTitle")}
          description={loadError ?? undefined}
          action={
            <button type="button" className="action-button action-edit" onClick={onRetry}>
              <RefreshCw className="size-4" aria-hidden />
              {t("visual.retry")}
            </button>
          }
        />
      ) : services.length === 0 ? (
        <EmptyState
          tone="scissors"
          title={t("catalog.service.emptyTitle")}
          description={t("catalog.service.emptyHint")}
          action={
            canCreate ? (
              <button
                type="button"
                className="action-button action-confirm"
                onClick={() => openForm(null)}
              >
                <Plus className="size-4" aria-hidden />
                {t("catalog.service.addFirst")}
              </button>
            ) : undefined
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          tone="search"
          variant="plain"
          title={t("shop.services.emptyFiltered")}
          action={
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold"
              onClick={() => {
                setQuery("");
                setStatus("all");
              }}
            >
              <X className="size-4" aria-hidden />
              {t("catalog.clearSearch")}
            </button>
          }
        />
      ) : (
        <div className={view === "grid" ? "grid gap-3 sm:grid-cols-2" : "flex flex-col gap-2"}>
          {visible.map((service) => {
            const waiting = awaiting[service.id];
            const own = ownCatalog ? shopTerms[service.id] : undefined;
            const differs =
              own &&
              (own.price_cents !== service.price_cents ||
                own.duration_minutes !== service.duration_minutes);
            const doers = doersByService.get(service.id) ?? [];
            const statusBadge = waiting ? (
              <StatusBadge {...STATE.waiting} size="sm" label={t("catalog.awaiting")} />
            ) : service.active ? (
              <StatusBadge
                {...STATE.active}
                size="sm"
                label={t(ownCatalog ? "catalog.own.youServe" : "catalog.service.visible")}
              />
            ) : (
              <StatusBadge
                {...STATE.paused}
                icon={EyeOff}
                size="sm"
                label={t(ownCatalog ? "catalog.own.youDont" : "catalog.service.hidden")}
              />
            );
            return (
              <CatalogCard
                key={service.id}
                id={`service-${service.id}`}
                view={view}
                paused={!service.active}
                highlight={flashId === service.id}
                onOpen={canEdit ? () => openForm(service) : undefined}
                openLabel={t("shop.editAria", { name: service.name })}
                media={
                  <span
                    className={`grid shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-gold ${view === "grid" ? "size-12" : "size-10"}`}
                  >
                    <ServiceIcon
                      icon={service.icon}
                      className="size-5"
                      imageClassName={`${view === "grid" ? "size-12" : "size-10"} object-cover !rounded-none !p-0`}
                    />
                  </span>
                }
                title={service.name}
                subtitle={view === "grid" ? service.description : undefined}
                facts={
                  <>
                    <Tag icon={Clock3}>{duration(service.duration_minutes)}</Tag>
                    <span className="text-sm font-bold tabular-nums">
                      {money(service.price_cents)}
                    </span>
                    {service.prep_minutes ? (
                      <Tag icon={Sparkles}>
                        {t("catalog.service.prepTag", { minutes: service.prep_minutes })}
                      </Tag>
                    ) : null}
                    {differs && own ? (
                      <span className="text-xs text-muted-foreground">
                        {t("catalog.service.shopPriceShort", { price: money(own.price_cents) })}
                      </span>
                    ) : null}
                  </>
                }
                extra={
                  view === "grid" && !ownCatalog && doers.length > 0 ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex gap-0.5" aria-hidden>
                        {doers.slice(0, 4).map(({ member }) => (
                          <PersonAvatar
                            key={member.id}
                            name={member.display_name}
                            src={member.avatar_url}
                            seed={member.id}
                            size="xs"
                            className="rounded-full"
                          />
                        ))}
                      </span>
                      <span className="min-w-0">
                        {doers.length === staff.filter((member) => member.active).length &&
                        doers.length > 1
                          ? t("catalog.service.doneByAll")
                          : doers.length === 1
                            ? t("catalog.service.doneByOne", {
                                name: doers[0]!.member.display_name,
                              })
                            : t("catalog.service.doneByMany", { count: doers.length })}
                        {doers.some((row) => row.ownPrice)
                          ? ` · ${t("catalog.service.ownPrices")}`
                          : ""}
                      </span>
                    </div>
                  ) : null
                }
                status={statusBadge}
                toggle={
                  <ItemToggle
                    checked={service.active}
                    label={t(ownCatalog ? "catalog.own.youServe" : "catalog.service.toggle")}
                    ariaLabel={t(
                      ownCatalog ? "catalog.own.toggleAria" : "catalog.service.toggleAria",
                      { name: service.name },
                    )}
                    // Catálogo próprio: o estado ("Você atende / não atende") fica só no selo.
                    showLabel={view === "grid" && !ownCatalog}
                    disabled={!canEdit}
                    onChange={() => toggle(service)}
                  />
                }
                menu={
                  canEdit || canChangeGlobal ? (
                    <MoreActions
                      label={t("catalog.moreAria", { name: service.name })}
                      title={service.name}
                      actions={[
                        ...(canEdit
                          ? [
                              {
                                id: "edit",
                                label: t("catalog.service.edit"),
                                icon: Pencil,
                                onSelect: () => openForm(service),
                              },
                            ]
                          : []),
                        ...(canChangeGlobal
                          ? [
                              {
                                id: "delete",
                                label: t("shop.deleteService.confirm"),
                                icon: Trash2,
                                tone: "danger" as const,
                                onSelect: () => setDeleteTarget(service),
                              },
                            ]
                          : []),
                      ]}
                    />
                  ) : undefined
                }
              />
            );
          })}
        </div>
      )}

      <ServiceForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        canChangeGlobal={canChangeGlobal}
        ownCatalog={ownCatalog}
        canSuggest={canSuggest}
        shopTerms={editing && ownCatalog ? shopTerms[editing.id] : null}
        prepSupported={prepSupported}
        shopPrep={shopPrep}
        starters={services.length === 0}
        onSave={(draft) => actions.save(draft, editing)}
        onUploadImage={actions.uploadImage}
        onSaved={saved}
        onDelete={
          editing && canChangeGlobal
            ? () => {
                setFormOpen(false);
                setDeleteTarget(editing);
              }
            : undefined
        }
        onPause={
          editing && canEdit
            ? async () => {
                await toggle(editing);
                setFormOpen(false);
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        tone="danger"
        icon={Trash2}
        title={t("shop.deleteService.title")}
        summary={
          deleteTarget ? (
            <span className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-gold">
                <ServiceIcon
                  icon={deleteTarget.icon}
                  className="size-5"
                  imageClassName="size-10 object-cover !rounded-none !p-0"
                />
              </span>
              <span className="min-w-0 space-y-1">
                <span className="block text-sm font-bold">{deleteTarget.name}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Tag icon={Clock3}>{duration(deleteTarget.duration_minutes)}</Tag>
                  <span className="text-sm font-bold">{money(deleteTarget.price_cents)}</span>
                </span>
              </span>
            </span>
          ) : null
        }
        consequences={[
          { icon: XCircle, tone: "danger", text: t("catalog.service.deleteGone") },
          { icon: EyeOff, tone: "muted", text: t("catalog.service.deleteAlternative") },
        ]}
        confirmLabel={t("shop.deleteService.confirm")}
        busyLabel={t("shop.deleting")}
        confirmIcon={Trash2}
        cancelLabel={t("catalog.service.keep")}
        errorText={t("shop.error.deleteService")}
        onConfirm={async () => {
          const row = deleteTarget;
          if (!row) return;
          try {
            const outcome = await actions.remove(row);
            if (outcome === "pending") pendingToast(row.name);
            else toast.success(t("catalog.toast.serviceDeleted", { name: row.name }));
          } catch (cause) {
            if (cause instanceof HasBookingsError) {
              setBlockedTarget(row);
              return;
            }
            throw cause;
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(blockedTarget?.active)}
        onOpenChange={(open) => {
          if (!open) setBlockedTarget(null);
        }}
        tone="warning"
        title={t("catalog.service.blockedTitle")}
        description={t("catalog.service.blockedHint")}
        consequences={[
          { icon: EyeOff, tone: "muted", text: t("catalog.service.pauseEffect") },
          { icon: CheckCircle2, tone: "success", text: t("catalog.service.pauseKeeps") },
        ]}
        confirmLabel={t("catalog.service.pause")}
        confirmIcon={EyeOff}
        cancelLabel={t("catalog.keepAsIs")}
        errorText={t("shop.error.toggleService")}
        onConfirm={async () => {
          const row = blockedTarget;
          if (!row || !row.active) return;
          await toggle(row);
        }}
      />

      {/* Já pausado: não há o que decidir, então um botão só. */}
      <InfoDialog
        open={Boolean(blockedTarget && !blockedTarget.active)}
        onOpenChange={(open) => {
          if (!open) setBlockedTarget(null);
        }}
        title={t("catalog.service.blockedTitle")}
        description={t("catalog.service.blockedAlreadyPaused")}
        closeLabel={t("catalog.understood")}
      />
    </section>
  );
}
