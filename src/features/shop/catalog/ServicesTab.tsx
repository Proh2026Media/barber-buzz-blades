import { WorkspaceHeaderAction, WorkspaceHeading } from "@/components/visual/WorkspaceHeader";
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
  CardGrid,
  ConfirmDialog,
  DataList,
  EmptyState,
  LoadingState,
  MoreActions,
  Notice,
  PersonAvatar,
  STATE,
  StatusBadge,
  Tag,
  type DataListColumn,
} from "@/components/visual";
import { ServiceIcon } from "@/components/ui/service-icon";
import { useViewportAtLeast } from "@/lib/device";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CATALOG_SHORT_LIST, CatalogFilters, type CatalogStatus } from "../CatalogFilters";
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

/**
 * Contêiner dos cartões: grade que se encaixa pela largura (2 colunas no tablet em pé, 3 a
 * 1024 e 1280, 4 a 1536; mínimo de 17.5rem para caberem 3 em 1024; src/styles/catalogo.css mantém 2 colunas entre 640 e 767 px como antes)
 * ou a lista compacta de uma coluna.
 */
export function CatalogItems({ view, children }: { view: CatalogViewMode; children: ReactNode }) {
  return view === "grid" ? (
    <CardGrid min="17.5rem" gap="0.75rem" className="catalog-grid">
      {children}
    </CardGrid>
  ) : (
    <div className="flex flex-col gap-2">{children}</div>
  );
}

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
  // Computador compacto (≥ 1024 px): título, busca, filtros e botão numa linha; "lista" vira tabela.
  const wide = useViewportAtLeast(1024);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CatalogStatus>("all");
  const [savedView, setView] = useState<CatalogViewMode>(() =>
    readCatalogViewPreference(shopId, "services", "grid"),
  );
  // Lista curta não mostra a troca grade/lista: vale o padrão (a escolha salva volta quando a
  // lista crescer). Sem isso, quem salvou "lista" ficava preso nela.
  const view: CatalogViewMode = services.length > CATALOG_SHORT_LIST ? savedView : "grid";
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

  const newButton =
    canCreate && services.length > 0 ? (
      <button
        type="button"
        className={cn("action-button action-confirm", !wide && "ml-auto")}
        onClick={() => openForm(null)}
      >
        <Plus className="size-4" aria-hidden />
        {t("catalog.service.new")}
      </button>
    ) : null;
  const title = (
    <div className="workspace-section-title app-section-title">
      <WorkspaceHeading>
        <Scissors />
        <h2>{t(ownCatalog ? "shop.nav.myServices" : "shop.nav.services")}</h2>
      </WorkspaceHeading>
      {!wide && <WorkspaceHeaderAction>{newButton}</WorkspaceHeaderAction>}
    </div>
  );
  const filters = (
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
  );

  /** Quem faz o serviço: avatares e a frase curta (cartão e tabela). */
  function doersLine(service: ServiceRow) {
    const doers = doersByService.get(service.id) ?? [];
    if (ownCatalog || doers.length === 0) return null;
    return (
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
          {doers.length === staff.filter((member) => member.active).length && doers.length > 1
            ? t("catalog.service.doneByAll")
            : doers.length === 1
              ? t("catalog.service.doneByOne", {
                  name: doers[0]!.member.display_name,
                })
              : t("catalog.service.doneByMany", { count: doers.length })}
          {doers.some((row) => row.ownPrice) ? ` · ${t("catalog.service.ownPrices")}` : ""}
        </span>
      </div>
    );
  }

  function statusBadgeOf(service: ServiceRow, where: CatalogViewMode) {
    const waiting = awaiting[service.id];
    // Ligado, no cartão grande, o próprio interruptor já diz "Aparece para clientes": o
    // selo só aparece quando diz algo a mais (pausado, esperando aprovação, lista).
    if (waiting) return <StatusBadge {...STATE.waiting} size="sm" label={t("catalog.awaiting")} />;
    if (service.active && where === "grid" && !ownCatalog) return null;
    return service.active ? (
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
  }

  function toggleOf(service: ServiceRow, showLabel: boolean) {
    return (
      <ItemToggle
        checked={service.active}
        label={t(ownCatalog ? "catalog.own.youServe" : "catalog.service.toggle")}
        ariaLabel={t(ownCatalog ? "catalog.own.toggleAria" : "catalog.service.toggleAria", {
          name: service.name,
        })}
        // Catálogo próprio: o estado ("Você atende / não atende") fica só no selo.
        showLabel={showLabel && !ownCatalog}
        disabled={!canEdit}
        onChange={() => toggle(service)}
      />
    );
  }

  function menuOf(service: ServiceRow, className?: string) {
    if (!canEdit && !canChangeGlobal) return undefined;
    return (
      <MoreActions
        className={className}
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
    );
  }

  // Tabela (modo "lista" a partir de 1024 px): as mesmas colunas para comparar entre serviços.
  const tableColumns: DataListColumn<ServiceRow>[] = [
    {
      key: "service",
      sortValue: (service) => service.name,
      header: t("booking.service"),
      cell: (service) => {
        const inner = (
          <>
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-gold",
                !service.active && "opacity-55 grayscale",
              )}
            >
              <ServiceIcon
                icon={service.icon}
                className="size-5"
                imageClassName="size-10 object-cover !rounded-none !p-0"
              />
            </span>
            <span className="brand-content-title min-w-0 truncate text-sm font-bold">
              {service.name}
            </span>
          </>
        );
        return canEdit ? (
          <button
            type="button"
            onClick={() => openForm(service)}
            aria-label={t("shop.editAria", { name: service.name })}
            className="catalog-table-item flex min-w-0 items-center gap-3 rounded-xl text-left transition hover:bg-muted/30"
          >
            {inner}
          </button>
        ) : (
          <span className="flex min-w-0 items-center gap-3">{inner}</span>
        );
      },
    },
    {
      key: "duration",
      sortValue: (service) => service.duration_minutes,
      header: t("shop.serviceForm.duration"),
      width: "7rem",
      cell: (service) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums">
          <Clock3 className="size-4 text-gold" aria-hidden />
          {duration(service.duration_minutes)}
          {service.prep_minutes ? (
            <Tag icon={Sparkles}>
              {t("catalog.service.prepTag", { minutes: service.prep_minutes })}
            </Tag>
          ) : null}
        </span>
      ),
    },
    {
      key: "price",
      sortValue: (service) => service.price_cents,
      header: t("catalog.service.price"),
      width: "7rem",
      align: "end",
      cell: (service) => {
        const own = ownCatalog ? shopTerms[service.id] : undefined;
        const differs =
          own &&
          (own.price_cents !== service.price_cents ||
            own.duration_minutes !== service.duration_minutes);
        return (
          <span className="inline-flex flex-col items-end tabular-nums">
            <span className="font-bold">{money(service.price_cents)}</span>
            {differs && own ? (
              <span className="text-xs text-muted-foreground">
                {t("catalog.service.shopPriceShort", { price: money(own.price_cents) })}
              </span>
            ) : null}
          </span>
        );
      },
    },
    ...(ownCatalog
      ? []
      : [
          {
            key: "doers",
            sortValue: (service: ServiceRow) => doersByService.get(service.id)?.length ?? 0,
            header: t("catalog.table.doers"),
            width: "17rem",
            cell: (service: ServiceRow) => doersLine(service),
          },
        ]),
    {
      key: "visible",
      sortValue: (service) => service.active,
      header: t(ownCatalog ? "catalog.own.youServe" : "catalog.service.visible"),
      width: "9rem",
      align: "center",
      cell: (service) => (
        <span className="inline-flex flex-wrap items-center justify-center gap-2">
          {/* Na tabela o interruptor (ligado ou desligado) já diz o estado: o selo só quando
              aguarda aprovação ("Pausado · clientes não veem" quebrava em 3 linhas na coluna). */}
          {awaiting[service.id] ? statusBadgeOf(service, "grid") : null}
          {toggleOf(service, false)}
        </span>
      ),
    },
    {
      key: "menu",
      header: <span className="sr-only">{t("visual.moreActions")}</span>,
      width: "4rem",
      align: "end",
      cell: (service) => menuOf(service),
    },
  ];

  return (
    <section className="space-y-4">
      {wide ? (
        <div className="catalog-toolbar">
          {title}
          {filters}
          <WorkspaceHeaderAction>{newButton}</WorkspaceHeaderAction>
        </div>
      ) : (
        title
      )}

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

      {!wide && filters}

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
      ) : view === "list" && wide ? (
        <DataList
          className="catalog-table"
          columns={tableColumns}
          rows={visible}
          rowKey={(service) => service.id}
        />
      ) : (
        <CatalogItems view={view}>
          {visible.map((service) => {
            const own = ownCatalog ? shopTerms[service.id] : undefined;
            const differs =
              own &&
              (own.price_cents !== service.price_cents ||
                own.duration_minutes !== service.duration_minutes);
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
                extra={view === "grid" ? doersLine(service) : null}
                status={statusBadgeOf(service, view)}
                toggle={toggleOf(service, view === "grid")}
                menu={menuOf(service, "catalog-card-menu")}
              />
            );
          })}
        </CatalogItems>
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
