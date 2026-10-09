import {
  Ban,
  CalendarDays,
  CalendarPlus,
  CalendarX2,
  Check,
  CheckCircle2,
  ChevronRight,
  Crown,
  EyeOff,
  Hourglass,
  KeyRound,
  Link2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  UserRound,
  Users,
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
  announce,
  type MoreAction,
} from "@/components/visual";
import { ServiceIcon } from "@/components/ui/service-icon";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CatalogFilters, type CatalogStatus } from "../CatalogFilters";
import { ROLE_META } from "../roles";
import {
  readCatalogViewPreference,
  writeCatalogViewPreference,
  type CatalogViewMode,
} from "../CatalogViewToggle";
import { CatalogCard, ItemToggle } from "./CatalogCard";
import { staffDay } from "./format";
import { InfoDialog } from "./InfoDialog";
import { StaffForm } from "./StaffForm";
import {
  HasBookingsError,
  type AwaitingApproval,
  type SaveOutcome,
  type ServiceRow,
  type ServiceTerm,
  type StaffDraft,
  type StaffRow,
  type TeamAccess,
} from "./types";

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();

type Interval = { starts_at: string; ends_at: string };

export type StaffActions = {
  save: (draft: StaffDraft, editing: StaffRow | null) => Promise<SaveOutcome>;
  toggle: (row: StaffRow) => Promise<SaveOutcome>;
  remove: (row: StaffRow) => Promise<SaveOutcome>;
  uploadPhoto: (file: File) => Promise<string>;
};

/** Botão pequeno "Copiar link" que vira "✓ Copiado" por 2 s. */
function CopyLinkButton({ url, name }: { url: string; name: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          announce(t("visual.copied"));
        } catch {
          toast.error(t("catalog.staff.copyFailed"));
        }
      }}
      aria-label={t("catalog.staff.copyLinkAria", { name })}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition",
        copied
          ? "tone-success border-[color:var(--tone-border)] bg-[color:var(--tone-soft)] text-[color:var(--tone-ink)]"
          : "border-border bg-background hover:border-primary/40",
      )}
    >
      {copied ? (
        <Check className="size-4" aria-hidden />
      ) : (
        <Link2 className="size-4 text-gold" aria-hidden />
      )}
      {copied ? t("visual.copied") : t("catalog.staff.copyLink")}
    </button>
  );
}

/**
 * Duas formas de pôr alguém na equipe, lado a lado: só na agenda (cadastro do profissional) ou
 * com acesso ao painel (convite por e-mail). O ícone e a linha curta mostram a diferença.
 */
function AddStaffChoices({ onAgenda, onPanel }: { onAgenda: () => void; onPanel: () => void }) {
  const { t } = useI18n();
  const choices = [
    {
      key: "agenda",
      icon: CalendarPlus,
      title: t("catalog.staff.addAgenda"),
      hint: t("catalog.staff.addAgendaHint"),
      onClick: onAgenda,
      tone: "action-confirm",
    },
    {
      key: "panel",
      icon: KeyRound,
      title: t("catalog.staff.addPanel"),
      hint: t("catalog.staff.addPanelHint"),
      onClick: onPanel,
      tone: "action-edit",
    },
  ];
  return (
    <div
      role="group"
      aria-label={t("catalog.staff.addFirst")}
      className="grid w-full grid-cols-2 gap-2 sm:max-w-xl"
    >
      {choices.map((choice) => (
        <button
          key={choice.key}
          type="button"
          onClick={choice.onClick}
          className={cn(
            "action-button min-h-[4.5rem] flex-col gap-1 px-2 py-2.5 text-center sm:flex-row sm:justify-start sm:gap-3 sm:px-3 sm:text-left",
            choice.tone,
          )}
        >
          <choice.icon className="!size-5" aria-hidden />
          <span className="min-w-0">
            <span className="block text-sm font-bold leading-tight">{choice.title}</span>
            <span className="mt-0.5 block text-xs font-medium leading-tight opacity-85">
              {choice.hint}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** Aba Equipe: quem atende, o dia de cada um, o que faz, o link e quem entra no painel. */
export function TeamTab({
  shopId,
  staff,
  services,
  terms,
  loading,
  loadError,
  catalogLoadFailed = false,
  onRetry,
  awaiting,
  linkOrigin,
  timeZone,
  today,
  access,
  onInvite,
  onOpenAccess,
  actions,
  onOpenAgenda,
  onBlockTime,
  onOpenApprovals,
}: {
  shopId: string;
  staff: StaffRow[];
  services: ServiceRow[];
  terms: ServiceTerm[] | null;
  loading: boolean;
  loadError: string | null;
  /** A última carga de serviços/equipe falhou: lista vazia não quer dizer "ninguém na equipe". */
  catalogLoadFailed?: boolean;
  onRetry: () => void;
  awaiting: AwaitingApproval;
  linkOrigin: string | null;
  timeZone: string;
  /** Agenda de hoje (null enquanto carrega ou se não deu para buscar). */
  today: {
    appointments: Array<Interval & { staff_id: string; status: string }>;
    blocks: Array<Interval & { staff_id: string | null }>;
    dayStart: number;
    dayEnd: number;
    now: number;
  } | null;
  /** Quem entra no painel, por profissional (null: não se aplica, como na demonstração). */
  access: TeamAccess[] | null;
  /**
   * Convidar ao painel (dono/sócio). Os convites, a sociedade e as permissões ficam num lugar só,
   * em Ajustes → Equipe e sociedade; daqui o convite abre lá, já com o nome do profissional.
   */
  onInvite?: (name?: string) => void;
  /** Abre Ajustes → Equipe e sociedade (pessoas, %, convites e permissões). */
  onOpenAccess?: () => void;
  actions: StaffActions;
  onOpenAgenda?: (staffId: string) => void;
  onBlockTime?: (staffId: string) => void;
  onOpenApprovals?: () => void;
}) {
  const { t, intlLocale } = useI18n();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CatalogStatus>("all");
  const [view, setView] = useState<CatalogViewMode>(() =>
    readCatalogViewPreference(shopId, "staff", "grid"),
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffRow | null>(null);
  const [blockedTarget, setBlockedTarget] = useState<StaffRow | null>(null);
  const [flashName, setFlashName] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  // Convites ficam em Ajustes → Equipe e sociedade (com o nome do profissional, se veio do cartão).
  const canInvite = Boolean(onInvite);
  const openInvite = (name?: string) => onInvite?.(name);

  const visible = staff.filter(
    (row) =>
      normalize(row.display_name).includes(normalize(query)) &&
      (status === "all" || row.active === (status === "active")),
  );
  const activeCount = staff.filter((row) => row.active).length;
  // Carga falhou e não há ninguém para mostrar: avisa a falha em vez do "primeiro profissional".
  const loadFailedEmpty = catalogLoadFailed && !loading && staff.length === 0;
  const activeServices = services.filter((service) => service.active);

  useEffect(() => {
    if (!flashName) return;
    const match = [...staff].reverse().find((row) => row.display_name === flashName);
    if (!match) return;
    setFlashId(match.id);
    setFlashName(null);
    window.setTimeout(() => {
      document
        .getElementById(`staff-${match.id}`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 50);
  }, [flashName, staff]);
  useEffect(() => {
    if (!flashId) return;
    const timer = window.setTimeout(() => setFlashId(null), 2500);
    return () => window.clearTimeout(timer);
  }, [flashId]);

  const timeLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(intlLocale, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      }),
    [intlLocale, timeZone],
  );

  const accessByStaff = useMemo(() => {
    const map = new Map<string, TeamAccess>();
    for (const row of access ?? []) if (row.active) map.set(row.staff_id, row);
    return map;
  }, [access]);
  const accessCount = (access ?? []).filter((row) => row.active).length;

  function servicesOf(member: StaffRow) {
    if (!terms) return activeServices.map((service) => ({ service, ownPrice: false }));
    return activeServices
      .map((service) => {
        const term = terms.find(
          (row) => row.staff_id === member.id && row.service_id === service.id,
        );
        return term
          ? {
              service,
              ownPrice:
                term.price_cents !== service.price_cents ||
                term.duration_minutes !== service.duration_minutes,
            }
          : null;
      })
      .filter((row): row is { service: ServiceRow; ownPrice: boolean } => row !== null);
  }

  function roleBadge(member: StaffRow) {
    if (!access) return null;
    const row = accessByStaff.get(member.id);
    if (!row)
      return (
        <StatusBadge tone="neutral" icon={UserRound} size="sm" label={t("catalog.role.none")} />
      );
    if (row.role === "owner" || row.role === "partner")
      return (
        <StatusBadge
          tone="highlight"
          icon={Crown}
          size="sm"
          label={
            row.role === "partner"
              ? row.ownership_percent != null
                ? t("catalog.role.partnerShare", { percent: row.ownership_percent })
                : t("catalog.role.partner")
              : row.ownership_percent != null
                ? t("catalog.role.ownerShare", { percent: row.ownership_percent })
                : t("catalog.role.owner")
          }
        />
      );
    if (row.role === "associate")
      return (
        <StatusBadge
          tone={ROLE_META.associate.tone}
          icon={ROLE_META.associate.icon}
          size="sm"
          label={t("catalog.role.associate")}
        />
      );
    return (
      <StatusBadge
        tone={ROLE_META.employee.tone}
        icon={ROLE_META.employee.icon}
        size="sm"
        label={t("catalog.role.employee")}
      />
    );
  }

  function dayLine(member: StaffRow) {
    if (!today || !member.active) return null;
    const day = staffDay(
      member.id,
      today.appointments,
      today.blocks,
      today.dayStart,
      today.dayEnd,
      today.now,
    );
    if (day.allDayBlocked)
      return <StatusBadge {...STATE.closed} size="sm" label={t("catalog.staff.offToday")} />;
    const first = day.blocks[0];
    return (
      <span className="flex flex-wrap items-center gap-1.5 text-xs">
        <CalendarDays className="size-4 shrink-0 text-gold" aria-hidden />
        <span className="font-semibold">
          {day.count === 0
            ? t("catalog.staff.todayNone")
            : day.count === 1
              ? t("catalog.staff.todayOne")
              : t("catalog.staff.todayMany", { count: day.count })}
        </span>
        {day.next && (
          <span className="text-muted-foreground">
            · {t("catalog.staff.next", { time: timeLabel.format(new Date(day.next)) })}
          </span>
        )}
        {first && (
          <StatusBadge
            tone="danger"
            icon={Ban}
            size="sm"
            label={
              t("catalog.staff.blocked", {
                from: timeLabel.format(new Date(first.starts_at)),
                to: timeLabel.format(new Date(first.ends_at)),
              }) + (day.blocks.length > 1 ? ` +${day.blocks.length - 1}` : "")
            }
          />
        )}
      </span>
    );
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

  async function toggle(row: StaffRow) {
    try {
      const outcome = await actions.toggle(row);
      if (outcome === "pending") pendingToast(row.display_name);
      else if (row.active)
        toast.success(t("catalog.toast.staffPaused", { name: row.display_name }), {
          description: t("catalog.toast.staffPausedHint"),
          action: { label: t("catalog.toast.undo"), onClick: () => void undoPause(row) },
        });
      else toast.success(t("catalog.toast.staffShown", { name: row.display_name }));
      return outcome;
    } catch (cause) {
      // O erro aparece junto do controle que falhou (interruptor, janela ou zona de perigo),
      // com "Tentar de novo"; sem aviso flutuante repetido.
      throw cause instanceof Error && cause.message
        ? cause
        : new Error(t("shop.error.toggleStaff"));
    }
  }

  /** "Desfazer" do aviso de pausa: volta a mostrar pelo mesmo caminho do interruptor. */
  async function undoPause(row: StaffRow) {
    try {
      await toggle({ ...row, active: false });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : t("shop.error.toggleStaff"), {
        action: { label: t("visual.retry"), onClick: () => void undoPause(row) },
      });
    }
  }

  function openForm(row: StaffRow | null) {
    setEditing(row);
    setFormOpen(true);
  }

  return (
    <section className="space-y-4">
      <div className="app-section-title">
        <Users />
        <h2>{t("shop.nav.team")}</h2>
        {staff.length > 0 && !canInvite && (
          <button
            type="button"
            className="action-button action-confirm ml-auto"
            onClick={() => openForm(null)}
          >
            <Plus className="size-4" aria-hidden />
            {t("catalog.staff.new")}
          </button>
        )}
      </div>

      {/* Com convites liberados: "Só na agenda" ou "Com acesso ao painel", à vista. */}
      {staff.length > 0 && canInvite && (
        <AddStaffChoices onAgenda={() => openForm(null)} onPanel={() => openInvite()} />
      )}

      {loadError && !loadFailedEmpty && (
        <Notice
          tone="danger"
          title={loadError}
          action={{ label: t("visual.retry"), onClick: onRetry, icon: RefreshCw }}
        />
      )}

      <CatalogFilters
        query={query}
        onQuery={setQuery}
        status={status}
        onStatus={setStatus}
        total={staff.length}
        active={activeCount}
        visible={visible.length}
        label={t("shop.staff.search")}
        activeLabel={t("catalog.staff.filterActive")}
        pausedLabel={t("brand.catalog.paused")}
        statusFirst
        viewMode={view}
        onViewMode={(next) => {
          setView(next);
          writeCatalogViewPreference(shopId, "staff", next);
        }}
      />

      {loading && staff.length === 0 ? (
        <LoadingState label={t("catalog.staff.loading")} variant="cards" count={2} />
      ) : loadFailedEmpty ? (
        <EmptyState
          status="danger"
          title={t("catalog.staff.loadErrorTitle")}
          description={loadError ?? undefined}
          action={
            <button type="button" className="action-button action-edit" onClick={onRetry}>
              <RefreshCw className="size-4" aria-hidden />
              {t("visual.retry")}
            </button>
          }
        />
      ) : staff.length === 0 ? (
        <EmptyState
          tone="people"
          title={t("catalog.staff.emptyTitle")}
          description={t("catalog.staff.emptyHint")}
          action={
            canInvite ? (
              <AddStaffChoices onAgenda={() => openForm(null)} onPanel={() => openInvite()} />
            ) : (
              <button
                type="button"
                className="action-button action-confirm"
                onClick={() => openForm(null)}
              >
                <Plus className="size-4" aria-hidden />
                {t("catalog.staff.addFirst")}
              </button>
            )
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          tone="search"
          variant="plain"
          title={t("shop.staff.emptyFiltered")}
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
          {visible.map((member) => {
            const waiting = awaiting[member.id];
            const link =
              linkOrigin && member.booking_slug ? `${linkOrigin}/${member.booking_slug}` : null;
            const does = servicesOf(member);
            const hasAccess = !access || accessByStaff.has(member.id);
            const menu: MoreAction[] = [
              {
                id: "edit",
                label: t("catalog.staff.edit"),
                icon: Pencil,
                onSelect: () => openForm(member),
              },
              ...(onOpenAgenda
                ? [
                    {
                      id: "agenda",
                      label: t("catalog.staff.seeAgenda"),
                      icon: CalendarDays,
                      onSelect: () => onOpenAgenda(member.id),
                    },
                  ]
                : []),
              ...(onBlockTime
                ? [
                    {
                      id: "block",
                      label: t("catalog.staff.blockTime"),
                      icon: CalendarX2,
                      onSelect: () => onBlockTime(member.id),
                    },
                  ]
                : []),
              ...(canInvite && !hasAccess
                ? [
                    {
                      id: "invite",
                      label: t("catalog.staff.giveAccess"),
                      icon: UserPlus,
                      onSelect: () => openInvite(member.display_name),
                    },
                  ]
                : []),
              {
                id: "delete",
                label: t("shop.deleteStaff.confirm"),
                icon: Trash2,
                tone: "danger",
                onSelect: () => setDeleteTarget(member),
              },
            ];
            return (
              <CatalogCard
                key={member.id}
                id={`staff-${member.id}`}
                view={view}
                paused={!member.active}
                highlight={flashId === member.id}
                onOpen={() => openForm(member)}
                openLabel={t("shop.editAria", { name: member.display_name })}
                media={
                  <PersonAvatar
                    name={member.display_name}
                    src={member.avatar_url}
                    seed={member.id}
                    size={view === "grid" ? "md" : "sm"}
                  />
                }
                title={member.display_name}
                subtitle={view === "grid" ? member.bio : undefined}
                facts={roleBadge(member)}
                extra={
                  view === "grid" ? (
                    <div className="space-y-2.5">
                      {dayLine(member)}
                      {does.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="sr-only">
                            {t("catalog.staff.doesAria", {
                              list: does.map((row) => row.service.name).join(", "),
                            })}
                          </span>
                          {does.slice(0, 5).map(({ service }) => (
                            <span
                              key={service.id}
                              title={service.name}
                              aria-hidden
                              className="grid size-8 place-items-center overflow-hidden rounded-lg bg-muted text-gold"
                            >
                              <ServiceIcon
                                icon={service.icon}
                                className="size-4"
                                imageClassName="size-8 object-cover !rounded-none !p-0"
                              />
                            </span>
                          ))}
                          <span className="text-xs font-semibold text-muted-foreground" aria-hidden>
                            {does.length > 5 ? `+${does.length - 5} · ` : ""}
                            {does.length === activeServices.length
                              ? t("catalog.staff.doesAll")
                              : t("catalog.staff.doesCount", { count: does.length })}
                          </span>
                          {does.some((row) => row.ownPrice) && (
                            <Tag>{t("catalog.service.ownPrices")}</Tag>
                          )}
                        </div>
                      )}
                      {(link || onOpenAgenda) && (
                        <div className="flex flex-wrap gap-2">
                          {link && <CopyLinkButton url={link} name={member.display_name} />}
                          {onOpenAgenda && member.active && (
                            <button
                              type="button"
                              onClick={() => onOpenAgenda(member.id)}
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-semibold transition hover:border-primary/40"
                            >
                              <CalendarDays className="size-4 text-gold" aria-hidden />
                              {t("catalog.staff.seeAgenda")}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null
                }
                status={
                  waiting ? (
                    <StatusBadge {...STATE.waiting} size="sm" label={t("catalog.awaiting")} />
                  ) : member.active ? (
                    <StatusBadge {...STATE.active} size="sm" label={t("catalog.staff.receiving")} />
                  ) : (
                    <StatusBadge
                      {...STATE.paused}
                      icon={EyeOff}
                      size="sm"
                      label={t("catalog.staff.notReceiving")}
                    />
                  )
                }
                toggle={
                  <ItemToggle
                    checked={member.active}
                    label={t("catalog.staff.toggle")}
                    ariaLabel={t("catalog.staff.toggleAria", { name: member.display_name })}
                    showLabel={view === "grid"}
                    onChange={() => toggle(member)}
                  />
                }
                menu={
                  <MoreActions
                    label={t("catalog.moreAria", { name: member.display_name })}
                    title={member.display_name}
                    actions={menu}
                  />
                }
              />
            );
          })}
        </div>
      )}

      {onOpenAccess && (
        <button
          type="button"
          onClick={onOpenAccess}
          className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition hover:border-primary/40"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{t("catalog.access.title")}</span>
            <span className="block text-xs text-muted-foreground">
              {access
                ? accessCount === 1
                  ? t("catalog.access.countOne")
                  : t("catalog.access.countMany", { count: accessCount })
                : t("catalog.access.hint")}
            </span>
          </span>
          <span className="text-xs font-semibold text-muted-foreground">
            {t("catalog.access.manage")}
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      )}

      <StaffForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        linkOrigin={linkOrigin}
        onSave={(draft) => actions.save(draft, editing)}
        onUploadPhoto={actions.uploadPhoto}
        onSaved={(outcome, draft) => {
          const wasEditing = Boolean(editing);
          setFormOpen(false);
          if (outcome === "pending") return pendingToast(draft.display_name);
          toast.success(
            wasEditing ? t("catalog.toast.staffSaved") : t("catalog.toast.staffCreated"),
            { description: draft.display_name },
          );
          setFlashName(draft.display_name);
        }}
        onDelete={
          editing
            ? () => {
                setFormOpen(false);
                setDeleteTarget(editing);
              }
            : undefined
        }
        onPause={
          editing
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
        title={t("shop.deleteStaff.title")}
        summary={
          deleteTarget ? (
            <span className="flex items-center gap-3">
              <PersonAvatar
                name={deleteTarget.display_name}
                src={deleteTarget.avatar_url}
                seed={deleteTarget.id}
                size="sm"
              />
              <span className="text-sm font-bold">{deleteTarget.display_name}</span>
            </span>
          ) : null
        }
        consequences={[
          { icon: XCircle, tone: "danger", text: t("catalog.staff.deleteGone") },
          { icon: EyeOff, tone: "muted", text: t("catalog.staff.deleteAlternative") },
        ]}
        confirmLabel={t("shop.deleteStaff.confirm")}
        busyLabel={t("shop.deleting")}
        confirmIcon={Trash2}
        cancelLabel={t("catalog.staff.keep")}
        errorText={t("shop.error.deleteStaff")}
        onConfirm={async () => {
          const row = deleteTarget;
          if (!row) return;
          try {
            const outcome = await actions.remove(row);
            if (outcome === "pending") pendingToast(row.display_name);
            else toast.success(t("catalog.toast.staffDeleted", { name: row.display_name }));
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
        title={t("catalog.staff.blockedTitle")}
        description={t("catalog.staff.blockedHint")}
        consequences={[
          { icon: EyeOff, tone: "muted", text: t("catalog.staff.pauseEffect") },
          { icon: CheckCircle2, tone: "success", text: t("catalog.staff.pauseKeeps") },
        ]}
        confirmLabel={t("catalog.staff.pause")}
        confirmIcon={EyeOff}
        cancelLabel={t("catalog.keepAsIs")}
        errorText={t("shop.error.toggleStaff")}
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
        title={t("catalog.staff.blockedTitle")}
        description={t("catalog.staff.blockedAlreadyPaused")}
        closeLabel={t("catalog.understood")}
      />
    </section>
  );
}
