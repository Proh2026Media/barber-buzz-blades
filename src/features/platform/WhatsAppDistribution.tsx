import { reorderNumbers, type NumberRole } from "@/lib/whatsapp/distribution-order";
import { NumberActivity as NumberActivityBadge } from "./NumberActivity";
import { type NumberActivity } from "@/lib/whatsapp/number-activity";
import { useId, useRef, useState, type DragEvent } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  GripVertical,
  Loader2,
  Pause,
  Plus,
  Radio,
  Scissors,
  Search,
  ShieldCheck,
  Smartphone,
  SlidersHorizontal,
  Store,
  X,
} from "lucide-react";
import { StatusBadge } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { hasIdentifiedNumber } from "@/lib/whatsapp/directory-model";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export type DistributionNumber = {
  id: string;
  label: string | null;
  display_phone: string | null;
  status: string;
  activity?: NumberActivity;
  historyScope?: "groups";
  historyAccepted?: number;
  historyUncertain?: number;
};
export type DistributionRoute = {
  id: string;
  barbershop_id: string;
  staff_id: string | null;
  channel_id: string;
  backup_channel_id: string | null;
  backup2_channel_id?: string | null;
  delivery_mode: "primary" | "backup" | "paused";
  enabled: boolean;
  version: number;
  return_notice_enabled: boolean;
};
export type DistributionSave = {
  shop: string;
  staff: string | null;
  expectedVersion: number | null;
  primary: string | null;
  backup: string | null;
  backup2?: string | null;
  mode: "primary" | "backup" | "paused";
  enabled: boolean;
  returns: boolean;
  technical: boolean;
};
type Props = {
  numbers: DistributionNumber[];
  shops: { id: string; name: string }[];
  staff: { id: string; shop_id: string; name: string }[];
  routes: DistributionRoute[];
  supported: boolean;
  busy: boolean;
  save: (target: DistributionSave) => Promise<boolean>;
  viewNumber: (id: string) => void;
  secondReserve?: boolean;
};
type Role = "primary" | "backup" | "backup2";
const historical = (status: string) => ["archived", "restricted", "banned"].includes(status);
const ORDER_DRAG_TYPE = "application/x-bc-whatsapp-order";
const DRAG_TYPE = "application/x-bc-whatsapp-number";

/** Só a apresentação muda; o vínculo e o envio conservam o identificador original. */
function phoneLabel(raw: string | null) {
  if (!raw) return "";
  try {
    return (
      parsePhoneNumberFromString(raw.startsWith("+") ? raw : `+${raw}`)?.formatInternational() ??
      raw
    );
  } catch {
    return raw;
  }
}
function samePhone(a: string | null, b: string | null, numbers: DistributionNumber[]) {
  if (!a || !b) return false;
  const first = numbers.find((n) => n.id === a)?.display_phone?.replace(/\D/g, "");
  const second = numbers.find((n) => n.id === b)?.display_phone?.replace(/\D/g, "");
  return a === b || Boolean(first && first === second);
}

function Connection({ status }: { status: string }) {
  const { t } = useI18n();
  const pending = status === "connecting" || status === "qr";
  if (historical(status))
    return (
      <StatusBadge
        size="sm"
        tone={status === "archived" ? "neutral" : "warning"}
        label={t(status === "archived" ? "waHistory.archived" : "waHistory.restricted")}
      />
    );
  return (
    <StatusBadge
      size="sm"
      tone={status === "open" ? "success" : pending ? "progress" : "neutral"}
      label={t(
        status === "open"
          ? "waDistribution.connectionOpen"
          : pending
            ? "waDistribution.connectionPending"
            : status === "disconnected"
              ? "waDistribution.connectionClosed"
              : "waDistribution.connectionUnknown",
      )}
    />
  );
}

/** O papel pertence ao destino: um telefone pode aparecer em vários principais e reservas. */
export function WhatsAppDistribution({
  numbers,
  shops,
  staff,
  routes,
  supported,
  busy,
  save,
  viewNumber,
  secondReserve = false,
}: Props) {
  const { t, locale } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const [numberSearch, setNumberSearch] = useState("");
  const [destinationSearch, setDestinationSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [announcement, setAnnouncement] = useState("");
  const catalogue = numbers.filter(hasIdentifiedNumber);
  const chosen = catalogue.find((n) => n.id === selected);
  const normal = (s: string) => s.toLocaleLowerCase(locale).trim();
  const visibleNumbers = catalogue.filter((n) =>
    normal(`${n.display_phone} ${phoneLabel(n.display_phone)} ${n.label ?? ""}`).includes(
      normal(numberSearch),
    ),
  );
  const visibleShops = shops.filter((shop) => {
    const people = staff.filter((p) => p.shop_id === shop.id);
    const route = routes.find((r) => r.barbershop_id === shop.id && !r.staff_id);
    return (
      normal(`${shop.name} ${people.map((p) => p.name).join(" ")}`).includes(
        normal(destinationSearch),
      ) &&
      (filter === "all" || (filter === "primary" ? !route?.channel_id : !route?.backup_channel_id))
    );
  });
  return (
    <section className="wa-distribution" aria-label={t("waDistribution.title")}>
      <div className="wa-distribution-heading">
        <div>
          <h3>{t("waDistribution.title")}</h3>
          <p>{t("waDistribution.hint")}</p>
        </div>
      </div>
      {chosen && (
        <div className="wa-distribution-selection-bar">
          <button
            type="button"
            className="wa-distribution-selection"
            onClick={() => setSelected(null)}
          >
            <CheckCircle2 className="size-4" aria-hidden />
            <span>
              {t("waDistribution.selected")} · {phoneLabel(chosen.display_phone)}
            </span>
            <X className="size-4" aria-hidden />
            <span className="sr-only">{t("waDistribution.clearSelection")}</span>
          </button>
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {!supported && <p className="wa-distribution-unavailable">{t("waDistribution.readOnly")}</p>}
      <div className="wa-distribution-layout">
        <aside className="wa-distribution-pool bg-card" aria-label={t("waDistribution.numbers")}>
          <header>
            <Smartphone className="size-5" aria-hidden />
            <h4>{t("waDistribution.numbers")}</h4>
            <span className="wa-distribution-count">{catalogue.length}</span>
          </header>
          <p className="wa-distribution-helper">{t("waDistribution.numbersHint")}</p>
          <p className="wa-distribution-helper" title={t("waActivity.rule")}>
            {t("waActivity.internal")}
          </p>
          <label className="wa-distribution-search">
            <Search className="size-4" aria-hidden />
            <span className="sr-only">{t("waDistribution.numberSearch")}</span>
            <input
              type="search"
              value={numberSearch}
              onChange={(e) => setNumberSearch(e.target.value)}
              placeholder={t("waDistribution.numberSearch")}
            />
          </label>
          <div className="wa-distribution-number-list">
            {visibleNumbers.map((number) => {
              const primaryCount = routes.filter((r) => r.channel_id === number.id).length;
              const backupCount = routes.filter(
                (r) => r.backup_channel_id === number.id || r.backup2_channel_id === number.id,
              ).length;
              return (
                <button
                  key={number.id}
                  type="button"
                  className="wa-distribution-number"
                  data-number-id={number.id}
                  data-selected={selected === number.id}
                  aria-pressed={selected === number.id}
                  aria-label={t("waDistribution.selectNumber", { number: number.display_phone! })}
                  disabled={busy || !supported || historical(number.status)}
                  data-historical={historical(number.status)}
                  draggable={!busy && supported && !historical(number.status)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(DRAG_TYPE, number.id);
                    event.dataTransfer.effectAllowed = "copy";
                    setSelected(number.id);
                  }}
                  onClick={() => {
                    setSelected(selected === number.id ? null : number.id);
                    setAnnouncement(
                      t("waDistribution.selectionReady", { number: number.display_phone! }),
                    );
                  }}
                >
                  <div className="wa-distribution-number-top">
                    <span className="wa-distribution-phone-icon">
                      <Smartphone className="size-5" aria-hidden />
                    </span>
                    <span className="wa-distribution-number-name">
                      <strong>{phoneLabel(number.display_phone)}</strong>
                      {number.label && <span>{number.label}</span>}
                    </span>
                    {selected === number.id ? (
                      <Check className="size-4" aria-hidden />
                    ) : (
                      <GripVertical
                        className="wa-distribution-grip size-4"
                        aria-label={t("waDistribution.dragHint")}
                      />
                    )}
                  </div>
                  <Connection status={number.status} />
                  {historical(number.status) && (
                    <span className="wa-distribution-history-note">
                      {t("waHistory.retained")}
                      {number.historyScope === "groups" && number.historyAccepted != null && (
                        <span> · {t("waHistory.accepted", { count: number.historyAccepted })}</span>
                      )}
                    </span>
                  )}
                  <NumberActivityBadge activity={number.activity} />
                  <span className="wa-distribution-role-list">
                    {primaryCount > 0 && (
                      <span className="wa-distribution-role wa-distribution-role-primary">
                        <Radio className="size-3" aria-hidden />
                        {t("waDistribution.primaryCount", { count: primaryCount })}
                      </span>
                    )}
                    {backupCount > 0 && (
                      <span className="wa-distribution-role wa-distribution-role-backup">
                        <ShieldCheck className="size-3" aria-hidden />
                        {t("waDistribution.backupCount", { count: backupCount })}
                      </span>
                    )}
                    {!primaryCount && !backupCount && (
                      <span className="wa-distribution-unused">
                        <Circle className="size-3" aria-hidden />
                        {t("waDistribution.unused")}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
            {!visibleNumbers.length && (
              <p className="wa-distribution-empty">
                {t(catalogue.length ? "waDistribution.emptySearch" : "waDistribution.emptyNumbers")}
              </p>
            )}
          </div>
        </aside>
        <div className="wa-distribution-targets">
          <div className="wa-distribution-tools">
            <label className="wa-distribution-search">
              <Search className="size-4" aria-hidden />
              <span className="sr-only">{t("waDistribution.destinationSearch")}</span>
              <input
                type="search"
                value={destinationSearch}
                onChange={(e) => setDestinationSearch(e.target.value)}
                placeholder={t("waDistribution.destinationSearch")}
              />
            </label>
            <div
              className="wa-distribution-filters"
              role="group"
              aria-label={t("waDistribution.destinations")}
            >
              {(
                [
                  ["all", "waDistribution.allShops"],
                  ["primary", "waDistribution.missingPrimary"],
                  ["backup", "waDistribution.missingBackup"],
                ] as const
              ).map(([id, key]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </div>
          {shops.map((shop) => {
            const general = routes.find((r) => r.barbershop_id === shop.id && !r.staff_id);
            const people = staff.filter((person) => person.shop_id === shop.id);
            const shared = {
              numbers: catalogue,
              selected,
              supported,
              busy,
              save,
              viewNumber,
              secondReserve,
              announce: setAnnouncement,
            };
            return (
              <article
                className="wa-distribution-shop bg-card"
                key={shop.id}
                aria-label={shop.name}
                hidden={!visibleShops.some((visible) => visible.id === shop.id)}
              >
                <header className="wa-distribution-shop-title">
                  <span>
                    <Store className="size-5" aria-hidden />
                  </span>
                  <h4>{shop.name}</h4>
                  {people.length > 0 && (
                    <span className="wa-distribution-count">
                      <Scissors className="size-3.5" aria-hidden />
                      {people.length}
                    </span>
                  )}
                </header>
                <DestinationRoute
                  key={`general:${shop.id}:${general?.version ?? 0}`}
                  {...shared}
                  shop={shop.id}
                  person={null}
                  name={t("waDistribution.wholeShop")}
                  targetLabel={shop.name}
                  route={general}
                />
                {people.map((person) => {
                  const route = routes.find(
                    (r) => r.barbershop_id === shop.id && r.staff_id === person.id,
                  );
                  return (
                    <DestinationRoute
                      key={`${person.id}:${route?.version ?? 0}:${route ? "own" : (general?.version ?? 0)}`}
                      {...shared}
                      shop={shop.id}
                      person={person.id}
                      name={person.name}
                      targetLabel={`${shop.name} · ${person.name}`}
                      route={route}
                      inherited={route ? undefined : general}
                    />
                  );
                })}
              </article>
            );
          })}
          {!visibleShops.length && (
            <p className="wa-distribution-empty">
              {t(shops.length ? "waDistribution.emptySearch" : "waDistribution.emptyShops")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function DestinationRoute({
  shop,
  person,
  name,
  targetLabel,
  route,
  inherited,
  numbers,
  selected,
  supported,
  busy,
  save,
  viewNumber,
  announce,
  secondReserve,
}: {
  shop: string;
  person: string | null;
  name: string;
  targetLabel: string;
  route?: DistributionRoute;
  inherited?: DistributionRoute;
  numbers: DistributionNumber[];
  selected: string | null;
  supported: boolean;
  busy: boolean;
  save: Props["save"];
  viewNumber: Props["viewNumber"];
  announce: (message: string) => void;
  secondReserve?: boolean;
}) {
  const { t } = useI18n();
  const source = route ?? inherited;
  const initial = {
    primary: source?.channel_id ?? null,
    backup: source?.backup_channel_id ?? null,
    backup2: source?.backup2_channel_id ?? null,
    mode: route?.delivery_mode ?? ("primary" as DistributionRoute["delivery_mode"]),
    enabled: route?.enabled ?? false,
    returns: route?.return_notice_enabled ?? false,
  };
  const [draft, setDraft] = useState(initial);
  const [technical, setTechnical] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const pending = useRef(false);
  const locked = busy || saving || !supported;
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial) || editing;
  const needsTechnical =
    draft.mode === "backup" &&
    (route?.delivery_mode !== "backup" ||
      draft.primary !== initial.primary ||
      draft.backup !== initial.backup);
  const effective = dirty
    ? draft
    : route
      ? draft
      : {
          ...draft,
          enabled: source?.enabled ?? false,
          mode: source?.delivery_mode ?? "primary",
        };
  function assign(role: Role, id: string | null) {
    if (locked) return;
    if (id && !numbers.some((n) => n.id === id && !historical(n.status))) {
      setError(t("waDistribution.invalidNumber"));
      return;
    }
    if (id === draft[role]) {
      setError("");
      return;
    }
    if (
      (["primary", "backup", "backup2"] as Role[]).some(
        (r) => r !== role && samePhone(id, draft[r], numbers),
      )
    ) {
      setError(t("waDistribution.sameNumber"));
      return;
    }
    setDraft((current) => ({
      ...current,
      [role]: id,
      ...(role === "backup" && !id ? { mode: "primary" as const } : {}),
      ...(role === "primary" && !id
        ? { backup: null, backup2: null, mode: "paused" as const, enabled: false }
        : {}),
    }));
    setEditing(true);
    setTechnical(false);
    setSaved(false);
    setError("");
    setConfirmRemove(false);
    if (id)
      announce(
        t("waDistribution.draftApplied", {
          number: numbers.find((n) => n.id === id)!.display_phone!,
          role: t(role === "primary" ? "waDistribution.primary" : "waDistribution.backup"),
          name: targetLabel,
        }),
      );
  }
  function reorder(from: NumberRole, to: NumberRole, expectedId?: string) {
    if (locked || (expectedId && draft[from] !== expectedId)) return;
    setDraft((current) => ({ ...current, ...reorderNumbers(current, from, to) }));
    setEditing(true);
    setTechnical(false);
    setSaved(false);
    setError("");
    setConfirmRemove(false);
    announce(t("waDistribution.orderChanged"));
  }
  async function submit() {
    if (locked || pending.current) return;
    if (!draft.primary && !(route && confirmRemove)) {
      setError(t("waDistribution.primaryRequired"));
      return;
    }
    if (
      samePhone(draft.primary, draft.backup, numbers) ||
      samePhone(draft.primary, draft.backup2, numbers) ||
      samePhone(draft.backup, draft.backup2, numbers)
    ) {
      setError(t("waDistribution.sameNumber"));
      return;
    }
    if (needsTechnical && !technical) {
      setError(t("waDistribution.technicalRequired"));
      return;
    }
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      const ok = await save({
        shop,
        staff: person,
        expectedVersion: route?.version ?? null,
        ...draft,
        technical: draft.mode === "backup" && (!needsTechnical || technical),
      });
      if (ok) {
        setEditing(false);
        setSaved(true);
        announce(t("waDistribution.saved"));
      } else setError(t("waDistribution.saveError"));
    } catch {
      setError(t("waDistribution.saveError"));
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  return (
    <section
      className="wa-distribution-destination"
      aria-label={targetLabel}
      data-target-key={`${shop}:${person ?? "general"}`}
      data-shop-id={shop}
      data-staff-id={person ?? ""}
      data-inherited={Boolean(inherited && !dirty)}
    >
      <div className="wa-distribution-destination-title">
        <div>
          {person ? (
            <Scissors className="size-4" aria-hidden />
          ) : (
            <Store className="size-4" aria-hidden />
          )}
          <h5>{name}</h5>
        </div>
        <StatusBadge
          size="sm"
          tone={effective.enabled && effective.mode !== "paused" ? "success" : "neutral"}
          icon={effective.enabled && effective.mode !== "paused" ? CheckCircle2 : Pause}
          label={t(
            effective.enabled && effective.mode !== "paused"
              ? effective.mode === "backup"
                ? "waDistribution.backupActive"
                : "waDistribution.noticesOn"
              : "waDistribution.noticesOff",
          )}
        />
        {inherited && !dirty && (
          <span className="wa-distribution-inherited">
            <Store className="size-3" aria-hidden />
            {t("waDistribution.usesGeneral")}
          </span>
        )}

        {person && route && (
          <span className="wa-distribution-inherited">{t("waDistribution.personalized")}</span>
        )}

        {inherited && !dirty && (
          <button
            type="button"
            className="wa-distribution-customize"
            disabled={locked}
            onClick={() => {
              setEditing(true);
              setSaved(false);
            }}
          >
            <SlidersHorizontal className="size-3.5" aria-hidden /> {t("waDistribution.customize")}
          </button>
        )}
      </div>
      <div className="wa-distribution-slots">
        <NumberSlot
          role="primary"
          excluded={[draft.backup, draft.backup2]}
          id={draft.primary}
          other={draft.backup}
          name={targetLabel}
          numbers={numbers}
          selected={selected}
          locked={locked}
          assign={assign}
          secondReserve={secondReserve}
          reorder={reorder}
          targetKey={`${shop}:${person ?? "general"}`}
          viewNumber={viewNumber}
        />
        <NumberSlot
          role="backup"
          excluded={[draft.primary, draft.backup2]}
          id={draft.backup}
          other={draft.primary}
          name={targetLabel}
          numbers={numbers}
          selected={selected}
          locked={locked}
          assign={assign}
          secondReserve={secondReserve}
          reorder={reorder}
          targetKey={`${shop}:${person ?? "general"}`}
          viewNumber={viewNumber}
        />
        {secondReserve && (
          <NumberSlot
            role="backup2"
            id={draft.backup2}
            other={draft.primary}
            excluded={[draft.primary, draft.backup]}
            name={targetLabel}
            numbers={numbers}
            selected={selected}
            locked={locked}
            assign={assign}
            secondReserve={secondReserve}
            reorder={reorder}
            targetKey={`${shop}:${person ?? "general"}`}
            viewNumber={viewNumber}
          />
        )}
      </div>
      {(route || dirty) && (
        <div className="wa-distribution-controls">
          <div
            className="wa-distribution-mode"
            role="group"
            aria-label={t("waDistribution.sendUsing")}
          >
            <span>{t("waDistribution.sendUsing")}</span>
            {(["primary", "backup"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={draft.mode === mode}
                disabled={locked || !draft.primary || (mode === "backup" && !draft.backup)}
                onClick={() => {
                  setDraft({ ...draft, mode });
                  setTechnical(false);
                  setSaved(false);
                }}
              >
                {mode === "primary" ? (
                  <Radio className="size-3.5" aria-hidden />
                ) : (
                  <ShieldCheck className="size-3.5" aria-hidden />
                )}
                {t(mode === "primary" ? "waDistribution.primary" : "waDistribution.backup")}
                {mode === "backup" && secondReserve ? " 1" : ""}
              </button>
            ))}
          </div>
          <label className="wa-distribution-toggle">
            <button
              type="button"
              role="switch"
              className="wa-toggle-control"
              aria-label={t("waDistribution.notices")}
              aria-checked={draft.enabled && draft.mode !== "paused"}
              disabled={locked || !draft.primary}
              onClick={() => {
                const enabled = !(draft.enabled && draft.mode !== "paused");
                setDraft({
                  ...draft,
                  enabled,
                  mode: enabled && draft.mode === "paused" ? "primary" : draft.mode,
                });
                setSaved(false);
              }}
            >
              <span aria-hidden="true" />
            </button>
            {t("waDistribution.notices")}
          </label>

          <label className="wa-distribution-toggle">
            <button
              type="button"
              role="switch"
              className="wa-toggle-control"
              aria-label={t("waDistribution.returns")}
              aria-checked={draft.returns}
              disabled={locked}
              onClick={() => {
                setDraft({ ...draft, returns: !draft.returns });
                setSaved(false);
              }}
            >
              <span aria-hidden="true" />
            </button>
            {t("waDistribution.returns")}
          </label>
        </div>
      )}
      {needsTechnical && (
        <div className="wa-distribution-technical">
          <label>
            <input
              type="checkbox"
              checked={technical}
              disabled={locked}
              onChange={(event) => setTechnical(event.target.checked)}
            />
            {t("waDistribution.technical")}
          </label>
          <p>{t("waDistribution.technicalHint")}</p>
        </div>
      )}
      {route && !draft.primary && dirty && (
        <div className="wa-distribution-technical">
          <label>
            <input
              type="checkbox"
              checked={confirmRemove}
              disabled={locked}
              onChange={(event) => setConfirmRemove(event.target.checked)}
            />
            {t("waDistribution.confirmRemove")}
          </label>
          <p>{t(person ? "waDistribution.removeOwnHint" : "waDistribution.removeGeneralHint")}</p>
        </div>
      )}
      {error && (
        <p role="alert" className="wa-distribution-error">
          {error}
        </p>
      )}
      {saved && !dirty && (
        <p role="status" className="wa-distribution-success">
          <CheckCircle2 className="size-4" aria-hidden />
          {t("waDistribution.saved")}
        </p>
      )}
      {dirty && (
        <div className="wa-distribution-savebar">
          <span>
            <Circle className="size-3" aria-hidden />
            {t("waDistribution.unsaved")}
          </span>
          <div>
            <button
              type="button"
              className="action-button"
              disabled={locked}
              onClick={() => {
                setDraft(initial);
                setEditing(false);
                setError("");
                setTechnical(false);
                setConfirmRemove(false);
              }}
            >
              {t("waDistribution.cancel")}
            </button>
            <button
              type="button"
              className="action-button action-confirm"
              disabled={
                locked ||
                (!draft.primary && !(route && confirmRemove)) ||
                (draft.mode === "backup" && !draft.backup) ||
                (needsTechnical && !technical)
              }
              onClick={() => void submit()}
            >
              {saving && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />}
              {t(saving ? "waDistribution.saving" : "waDistribution.save")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function NumberSlot({
  role,
  id,
  other,
  excluded = [],
  name,
  numbers,
  selected,
  locked,
  assign,
  reorder,
  targetKey,
  secondReserve,
  viewNumber,
}: {
  role: Role;
  id: string | null;
  other: string | null;
  excluded?: (string | null)[];
  name: string;
  numbers: DistributionNumber[];
  selected: string | null;
  locked: boolean;
  assign: (role: Role, id: string | null) => void;
  reorder: (from: Role, to: Role, expectedId?: string) => void;
  targetKey: string;
  secondReserve?: boolean;
  viewNumber: Props["viewNumber"];
}) {
  const { t } = useI18n();
  const pickerId = useId();
  const [picking, setPicking] = useState(false);
  const [over, setOver] = useState(false);
  const [moving, setMoving] = useState(false);
  const number = numbers.find((n) => n.id === id);
  const chosen = numbers.find((n) => n.id === selected);
  const roleLabel =
    t(role === "primary" ? "waDistribution.primary" : "waDistribution.backup") +
    (role === "primary" ? "" : role === "backup" ? " 1" : " 2");
  const canDrop = (event: DragEvent) =>
    !locked &&
    (event.dataTransfer.types.includes(DRAG_TYPE) ||
      event.dataTransfer.types.includes(ORDER_DRAG_TYPE));
  return (
    <div
      className={`wa-distribution-slot wa-distribution-slot-${role}`}
      data-role={role}
      draggable={Boolean(number && !historical(number.status) && !locked)}
      onDragStart={(event) => {
        if (!number || historical(number.status) || locked) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData(ORDER_DRAG_TYPE, JSON.stringify({ targetKey, role, id }));
        event.dataTransfer.effectAllowed = "move";
      }}
      data-number-id={id ?? ""}
      data-drag-over={over}
      data-selecting={Boolean(chosen)}
      data-correlated={Boolean(chosen && id === chosen.id)}
      onDragOver={(event) => {
        if (canDrop(event)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = event.dataTransfer.types.includes(ORDER_DRAG_TYPE)
            ? "move"
            : "copy";
          setOver(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const order = event.dataTransfer.getData(ORDER_DRAG_TYPE);
        if (order) {
          try {
            const source = JSON.parse(order);
            if (
              source.targetKey === targetKey &&
              ["primary", "backup", "backup2"].includes(source.role)
            )
              reorder(source.role, role, source.id);
          } catch {
            /* Arraste externo inválido não modifica o rascunho. */
          }
          return;
        }
        const id = event.dataTransfer.getData(DRAG_TYPE);
        if (!locked && id) assign(role, id);
      }}
    >
      <div className="wa-distribution-slot-label">
        <button
          type="button"
          className="wa-distribution-reorder"
          disabled={locked || !number || historical(number.status)}
          draggable={Boolean(number && !historical(number.status) && !locked)}
          aria-label={t("waDistribution.reorder", { role: roleLabel })}
          aria-expanded={moving}
          onClick={() => setMoving(!moving)}
          onDragStart={(event) => {
            event.stopPropagation();
            event.dataTransfer.setData(ORDER_DRAG_TYPE, JSON.stringify({ targetKey, role, id }));
            event.dataTransfer.effectAllowed = "move";
          }}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>

        {role === "primary" ? (
          <Radio className="size-4" aria-hidden />
        ) : (
          <ShieldCheck className="size-4" aria-hidden />
        )}
        <span>{roleLabel}</span>
        {chosen && id === chosen.id && (
          <CheckCircle2
            className="wa-distribution-correlated-mark size-3.5"
            aria-label={t("waDistribution.selected")}
          />
        )}
        {id && (
          <button
            type="button"
            className="wa-distribution-icon-action"
            disabled={locked}
            aria-label={`${t("waDistribution.remove")} ${roleLabel}`}
            onClick={() => assign(role, null)}
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      <button
        className="wa-distribution-slot-choice"
        type="button"
        disabled={locked}
        aria-expanded={picking}
        aria-controls={picking ? pickerId : undefined}
        aria-label={
          chosen
            ? t("waDistribution.applySelected", {
                number: chosen.display_phone!,
                role: roleLabel,
                name,
              })
            : t("waDistribution.slotLabel", { role: roleLabel, name })
        }
        onClick={() => {
          if (chosen) {
            assign(role, chosen.id);
            setPicking(false);
          } else setPicking(!picking);
        }}
      >
        <span>
          <strong>
            {phoneLabel(number?.display_phone ?? null) ||
              t(role === "primary" ? "waDistribution.noPrimary" : "waDistribution.noBackup")}
          </strong>
          {number?.label && <small>{number.label}</small>}
        </span>
        {chosen ? (
          <Plus className="size-4" aria-hidden />
        ) : (
          <ChevronDown className="size-4" aria-hidden />
        )}
      </button>
      <div className="wa-distribution-slot-bottom">
        {number ? (
          <>
            <Connection status={number.status} />
            <button
              type="button"
              className="wa-distribution-inspect"
              onClick={() => viewNumber(number.id)}
            >
              <ArrowRight className="size-3.5" aria-hidden />
              <span>{t("waDistribution.inspect")}</span>
            </button>
          </>
        ) : (
          <span>{t("waDistribution.choose")}</span>
        )}
      </div>
      {moving && (
        <div
          className="wa-distribution-reorder-options"
          role="group"
          aria-label={t("waDistribution.order")}
        >
          {(["primary", "backup", "backup2"] as Role[])
            .filter((target) => target !== role && (target !== "backup2" || secondReserve))
            .map((target) => (
              <button
                type="button"
                key={target}
                disabled={locked}
                onClick={() => {
                  reorder(role, target);
                  setMoving(false);
                }}
              >
                <ArrowRight className="size-3.5" aria-hidden />
                {t("waDistribution.moveTo", {
                  role:
                    t(target === "primary" ? "waDistribution.primary" : "waDistribution.backup") +
                    (target === "primary" ? "" : target === "backup" ? " 1" : " 2"),
                })}
              </button>
            ))}
        </div>
      )}
      {picking && (
        <div className="wa-distribution-picker" id={pickerId}>
          <span className="sr-only">
            {t("waDistribution.slotLabel", { role: roleLabel, name })}
          </span>
          <div
            role="radiogroup"
            aria-label={t("waDistribution.slotLabel", { role: roleLabel, name })}
            className="wa-number-options"
          >
            {numbers
              .filter(
                (n) =>
                  !historical(n.status) &&
                  !samePhone(n.id, other, numbers) &&
                  !excluded.some((e) => samePhone(n.id, e, numbers)),
              )
              .map((n) => (
                <button
                  key={n.id}
                  type="button"
                  role="radio"
                  aria-checked={id === n.id}
                  disabled={locked}
                  onClick={() => {
                    assign(role, n.id);
                    setPicking(false);
                  }}
                >
                  <span className="wa-option-circle" aria-hidden>
                    {id === n.id && <Check className="size-3" />}
                  </span>
                  <span>
                    {phoneLabel(n.display_phone)}
                    {n.label && <small>{n.label}</small>}
                  </span>
                  <Connection status={n.status} />
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
