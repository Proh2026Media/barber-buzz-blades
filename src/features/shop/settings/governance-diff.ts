import {
  CalendarX2,
  Clock3,
  Globe2,
  Scissors,
  SlidersHorizontal,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Json, Tables } from "@/integrations/supabase/types";
import type { MessageKey } from "@/lib/i18n";

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** Uma linha "o que muda": rótulo, valor novo e (se mudou) o valor de antes. */
export type DiffRow = { key: string; label: string; value: string; previous?: string };

/** Um dia da semana no pedido de horários: antes e depois ("" = fechado). */
export type WeekDiffDay = {
  weekday: number;
  before: string | null;
  after: string;
  changed: boolean;
};

export type ChangeView = {
  icon: LucideIcon;
  /** Tipo do pedido em linguagem simples ("Mudar serviço"). */
  title: string;
  /** O item afetado (nome do serviço, da pessoa…), quando houver. */
  subject?: string;
  /** Exclusão: vermelho com lixeira. */
  destructive?: boolean;
  rows: DiffRow[];
  week?: WeekDiffDay[];
  /** Resumo escrito por quem pediu (nunca o código interno do tipo). */
  note?: string;
};

export type DiffContext = {
  t: T;
  locale: string;
  timeZone?: string;
  services?: Tables<"services">[];
  staff?: Tables<"staff">[];
  businessHours?: Tables<"business_hours">[];
  /** Bloqueios que o painel já carregou (para mostrar qual bloqueio um pedido remove). */
  blocks?: Pick<
    Tables<"availability_blocks">,
    "id" | "staff_id" | "starts_at" | "ends_at" | "reason"
  >[];
  settings?: Partial<Tables<"barbershop_settings">> | null;
  /** Nome por id de membro (para pedidos de papel/participação). */
  memberNames?: Map<
    string,
    { name: string; role?: string; percent?: number | null; active?: boolean }
  >;
};

const KIND: Record<string, { icon: LucideIcon; title: MessageKey; destructive?: boolean }> = {
  "service.create": { icon: Scissors, title: "eq.kind.serviceCreate" },
  "service.update": { icon: Scissors, title: "eq.kind.serviceUpdate" },
  "service.toggle": { icon: Scissors, title: "eq.kind.serviceToggle" },
  "service.delete": { icon: Trash2, title: "eq.kind.serviceDelete", destructive: true },
  "staff.create": { icon: UserPlus, title: "eq.kind.staffCreate" },
  "staff.update": { icon: Users, title: "eq.kind.staffUpdate" },
  "staff.toggle": { icon: Users, title: "eq.kind.staffToggle" },
  "staff.delete": { icon: Trash2, title: "eq.kind.staffDelete", destructive: true },
  "shop.timezone": { icon: Globe2, title: "eq.kind.timezone" },
  "hours.replace": { icon: Clock3, title: "eq.kind.hours" },
  "availability.create": { icon: CalendarX2, title: "eq.kind.blockCreate" },
  "availability.delete": { icon: Trash2, title: "eq.kind.blockDelete", destructive: true },
  "settings.operational": { icon: SlidersHorizontal, title: "eq.kind.settings" },
  "member.add": { icon: UserPlus, title: "eq.kind.memberAdd" },
  "member.update": { icon: UserCog, title: "eq.kind.memberUpdate" },
};

/** Código interno ("service.update") nunca vira texto de tela. */
export function isTechnicalSummary(summary: unknown, kind?: string): boolean {
  if (typeof summary !== "string") return true;
  const text = summary.trim();
  if (!text) return true;
  if (kind && text === kind) return true;
  return /^[a-z_]+(\.[a-z_]+)+$/i.test(text);
}

function asRecord(value: Json | unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const num = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))
      ? Number(value)
      : null;

/** Texto comparável (vazio e nulo contam igual). */
const textOf = (value: unknown) => str(value) ?? "";
/** Texto longo encurtado para caber na linha "antes → depois". */
const short = (value: unknown) => {
  const text = str(value);
  return text && text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text;
};

function money(cents: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(cents / 100);
}

const hhmm = (value: unknown) => (typeof value === "string" ? value.slice(0, 5) : "");

function dayText(row: { is_open?: unknown; opens_at?: unknown; closes_at?: unknown } | undefined) {
  if (!row) return null;
  if (row.is_open === false) return "";
  return `${hhmm(row.opens_at)}–${hhmm(row.closes_at)}`;
}

/** Monta o cartão "o que muda" a partir do pedido e dos dados que o painel já tem. */
export function describeChange(
  kind: string,
  payloadJson: Json | undefined,
  ctx: DiffContext,
): ChangeView {
  const { t, locale } = ctx;
  const meta = KIND[kind] ?? { icon: SlidersHorizontal, title: "eq.kind.other" as MessageKey };
  const payload = asRecord(payloadJson);
  const rows: DiffRow[] = [];
  const view: ChangeView = {
    icon: meta.icon,
    title: t(meta.title),
    destructive: meta.destructive,
    rows,
  };
  const summary = payload.summary;
  if (!isTechnicalSummary(summary, kind)) view.note = String(summary).trim();
  const onOff = (value: boolean) => t(value ? "eq.diff.on" : "eq.diff.off");
  const activeText = (value: boolean) => t(value ? "eq.diff.active" : "eq.diff.paused");

  /** Linha que só mostra "antes" quando o valor realmente muda. */
  const push = (key: string, label: string, value: string, previous?: string | null) => {
    rows.push({
      key,
      label,
      value,
      previous: previous != null && previous !== value ? previous : undefined,
    });
  };

  if (kind.startsWith("service.")) {
    const id = str(payload.id);
    const current = ctx.services?.find((row) => row.id === id);
    view.subject = str(payload.name) ?? current?.name ?? undefined;
    if (kind === "service.toggle" && typeof payload.active === "boolean") {
      push(
        "active",
        t("eq.diff.status"),
        activeText(payload.active),
        current ? activeText(current.active) : null,
      );
    } else if (kind !== "service.delete") {
      const name = str(payload.name);
      if (name && current && current.name !== name)
        push("name", t("eq.diff.name"), name, current.name);
      const price = num(payload.price_cents);
      if (price != null) {
        const was = current ? money(current.price_cents, locale) : null;
        if (!current || was !== money(price, locale))
          push("price", t("eq.diff.price"), money(price, locale), was);
      }
      const duration = num(payload.duration_minutes);
      if (duration != null && (!current || current.duration_minutes !== duration)) {
        push(
          "duration",
          t("eq.diff.duration"),
          t("eq.diff.minutes", { n: duration }),
          current ? t("eq.diff.minutes", { n: current.duration_minutes }) : null,
        );
      }
      if (typeof payload.active === "boolean" && (!current || current.active !== payload.active)) {
        push(
          "active",
          t("eq.diff.status"),
          activeText(payload.active),
          current ? activeText(current.active) : null,
        );
      }
      // Detalhes que antes sumiam do "o que muda" (só aparecem quando realmente mudam).
      if (
        current &&
        "description" in payload &&
        textOf(payload.description) !== textOf(current.description)
      )
        push(
          "description",
          t("eq.diff.description"),
          short(payload.description) ?? t("eq.diff.empty"),
          short(current.description) ?? t("eq.diff.empty"),
        );
      if (current && "icon" in payload && textOf(payload.icon) !== textOf(current.icon))
        push("icon", t("eq.diff.icon"), t("eq.diff.newIcon"));
      const prep = num(payload.prep_minutes);
      if (current && prep != null && prep !== (current.prep_minutes ?? 0))
        push(
          "prep",
          t("eq.diff.prep"),
          t("eq.diff.minutes", { n: prep }),
          t("eq.diff.minutes", { n: current.prep_minutes ?? 0 }),
        );
    }
    return view;
  }

  if (kind.startsWith("staff.")) {
    const id = str(payload.id);
    const current = ctx.staff?.find((row) => row.id === id);
    view.subject = str(payload.display_name) ?? current?.display_name ?? undefined;
    const name = str(payload.display_name);
    if (name && current && current.display_name !== name)
      push("name", t("eq.diff.name"), name, current.display_name);
    if (typeof payload.active === "boolean" && (!current || current.active !== payload.active)) {
      push(
        "active",
        t("eq.diff.status"),
        activeText(payload.active),
        current ? activeText(current.active) : null,
      );
    }
    if (current && "bio" in payload && textOf(payload.bio) !== textOf(current.bio))
      push(
        "bio",
        t("eq.diff.bio"),
        short(payload.bio) ?? t("eq.diff.empty"),
        short(current.bio) ?? t("eq.diff.empty"),
      );
    if (
      current &&
      "avatar_url" in payload &&
      textOf(payload.avatar_url) !== textOf(current.avatar_url)
    )
      push(
        "photo",
        t("eq.diff.photo"),
        t(str(payload.avatar_url) ? "eq.diff.newPhoto" : "eq.diff.noPhoto"),
      );
    if (
      current &&
      "booking_slug" in payload &&
      textOf(payload.booking_slug) !== textOf(current.booking_slug)
    )
      push(
        "link",
        t("eq.diff.link"),
        str(payload.booking_slug) ? `/${str(payload.booking_slug)}` : t("eq.diff.empty"),
        str(current.booking_slug) ? `/${str(current.booking_slug)}` : t("eq.diff.empty"),
      );
    return view;
  }

  if (kind === "hours.replace" && Array.isArray(payload.hours)) {
    const next = (payload.hours as unknown[]).map(asRecord);
    view.week = [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
      const after = dayText(next.find((row) => Number(row.weekday) === weekday)) ?? "";
      const before = ctx.businessHours
        ? (dayText(ctx.businessHours.find((row) => row.weekday === weekday)) ?? "")
        : null;
      return { weekday, before, after, changed: before !== null && before !== after };
    });
    return view;
  }

  if (kind === "availability.create" || kind === "availability.delete") {
    // Remover bloqueio: o pedido só traz o id; o "quando" e o "quem" vêm do bloqueio carregado.
    const block =
      kind === "availability.delete"
        ? ctx.blocks?.find((row) => row.id === str(payload.id))
        : undefined;
    if (kind === "availability.delete" && !block) return view;
    const source: Record<string, unknown> = block ? { ...block } : payload;
    const staffId = str(source.staff_id);
    view.subject = staffId
      ? (ctx.staff?.find((row) => row.id === staffId)?.display_name ?? undefined)
      : t("eq.diff.wholeShop");
    const starts = str(source.starts_at);
    const ends = str(source.ends_at);
    if (starts && ends) {
      const fmt = new Intl.DateTimeFormat(locale, {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: ctx.timeZone,
      });
      const time = new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: ctx.timeZone,
      });
      const sameDay = starts.slice(0, 10) === ends.slice(0, 10);
      push(
        "when",
        t("eq.diff.when"),
        `${fmt.format(new Date(starts))} – ${(sameDay ? time : fmt).format(new Date(ends))}`,
      );
    }
    const reason = str(source.reason);
    if (reason) push("reason", t("eq.diff.reason"), reason);
    return view;
  }

  if (kind === "shop.timezone") {
    const zone = str(payload.timezone) ?? str(payload.p_timezone);
    if (zone) push("tz", t("eq.diff.timezone"), zone);
    return view;
  }

  if (kind === "settings.operational") {
    const current = ctx.settings ?? null;
    const was = (field: string) =>
      current ? (current as Record<string, unknown>)[field] : undefined;
    const changed = (field: string) =>
      field in payload && (current == null || was(field) !== payload[field]);
    if (changed("booking_horizon_days") && num(payload.booking_horizon_days) != null) {
      const before = num(was("booking_horizon_days"));
      push(
        "horizon",
        t("eq.diff.horizon"),
        t("eq.diff.days", { n: num(payload.booking_horizon_days)! }),
        before != null ? t("eq.diff.days", { n: before }) : null,
      );
    }
    if (changed("waiting_enabled") && typeof payload.waiting_enabled === "boolean") {
      const before = was("waiting_enabled");
      push(
        "waiting",
        t("eq.diff.waiting"),
        onOff(payload.waiting_enabled),
        typeof before === "boolean" ? onOff(before) : null,
      );
    }
    if (changed("waiting_cutoff_minutes") && num(payload.waiting_cutoff_minutes) != null) {
      const before = num(was("waiting_cutoff_minutes"));
      push(
        "cutoff",
        t("eq.diff.waitingCutoff"),
        t("eq.diff.minutes", { n: num(payload.waiting_cutoff_minutes)! }),
        before != null ? t("eq.diff.minutes", { n: before }) : null,
      );
    }
    if (changed("survey_program_enabled") && typeof payload.survey_program_enabled === "boolean") {
      const before = was("survey_program_enabled");
      push(
        "survey",
        t("eq.diff.survey"),
        onOff(payload.survey_program_enabled),
        typeof before === "boolean" ? onOff(before) : null,
      );
    }
    if (changed("booking_instructions")) {
      const text = str(payload.booking_instructions);
      push("instructions", t("eq.diff.instructions"), text ?? t("eq.diff.empty"));
    }
    const assign = (value: unknown) =>
      value === "client_pick" || value === "favorite_then_pick" || value === "random_available"
        ? t(`eq.diff.assign.${value}` as MessageKey)
        : null;
    if (changed("staff_assignment_mode") && assign(payload.staff_assignment_mode)) {
      push(
        "assign",
        t("eq.diff.assign"),
        assign(payload.staff_assignment_mode)!,
        assign(was("staff_assignment_mode")),
      );
    }
    const slot = (value: unknown) =>
      value === "flexible" || value === "literal" || value === "custom"
        ? t(`eq.diff.slot.${value}` as MessageKey)
        : null;
    if (changed("slot_mode") && slot(payload.slot_mode)) {
      push("slot", t("eq.diff.slotMode"), slot(payload.slot_mode)!, slot(was("slot_mode")));
    }
    if (changed("slot_step_minutes") && num(payload.slot_step_minutes) != null) {
      const before = num(was("slot_step_minutes"));
      push(
        "step",
        t("eq.diff.slotStep"),
        t("eq.diff.minutes", { n: num(payload.slot_step_minutes)! }),
        before != null ? t("eq.diff.minutes", { n: before }) : null,
      );
    }
    if (changed("prep_minutes") && num(payload.prep_minutes) != null) {
      const before = num(was("prep_minutes"));
      push(
        "prep",
        t("eq.diff.prep"),
        t("eq.diff.minutes", { n: num(payload.prep_minutes)! }),
        before != null ? t("eq.diff.minutes", { n: before }) : null,
      );
    }
    return view;
  }

  if (kind === "member.add" || kind === "member.update") {
    const id = str(payload.id);
    const current = id ? ctx.memberNames?.get(id) : undefined;
    view.subject = str(payload.display_name) ?? current?.name ?? undefined;
    const roleLabel = (role: unknown) =>
      role === "owner" || role === "partner"
        ? t("eq.role.owner")
        : role === "associate"
          ? t("eq.role.associate")
          : role === "employee"
            ? t("eq.role.employee")
            : null;
    const nextRole = roleLabel(payload.role);
    if (nextRole) push("role", t("eq.diff.role"), nextRole, roleLabel(current?.role));
    const pct = num(payload.ownership_percent);
    if (pct != null)
      push(
        "pct",
        t("eq.diff.share"),
        `${pct}%`,
        current?.percent != null ? `${current.percent}%` : null,
      );
    if (typeof payload.active === "boolean") {
      push(
        "active",
        t("eq.diff.access"),
        activeText(payload.active),
        typeof current?.active === "boolean" ? activeText(current.active) : null,
      );
    }
    return view;
  }

  return view;
}
