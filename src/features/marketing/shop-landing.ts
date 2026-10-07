import type { Json } from "@/integrations/supabase/types";

export type LandingConfig = {
  enabled: boolean;
  headline: string;
  about: string;
  address: string;
  instagram: string;
  whatsapp: string;
  show_staff: boolean;
  show_services: boolean;
  show_today: boolean;
  show_hours: boolean;
};

export const DEFAULT_LANDING: LandingConfig = {
  enabled: true,
  headline: "",
  about: "",
  address: "",
  instagram: "",
  whatsapp: "",
  show_staff: true,
  show_services: true,
  show_today: true,
  show_hours: true,
};

export const LANDING_LIMITS = { headline: 80, about: 600, address: 160 } as const;

export type LandingShop = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  display_name: string | null;
  tagline: string | null;
  logo_url: string | null;
  logo_background_color: string | null;
  font_family: string | null;
  custom_font_url: string | null;
  header_font_weight: number | null;
  header_font_style: string | null;
  corner_style: string | null;
  primary_color: string | null;
  accent_color: string | null;
  hero_image_url: string | null;
};

export type LandingStaff = {
  name: string;
  bio: string;
  avatar_url: string | null;
  booking_slug: string | null;
  free_today: string[];
  /** Falso quando o profissional não faz nenhum serviço agendável: sem horários na página. */
  offers_services: boolean;
  /** Duração do serviço mais curto dele; os horários livres valem para esse serviço. */
  min_duration_minutes: number | null;
};

export type LandingService = {
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  /** Nome do ícone do catálogo ou endereço da foto do serviço. */
  icon: string | null;
};

export type LandingHours = {
  weekday: number;
  is_open: boolean;
  opens_at: string;
  closes_at: string;
};

export type LandingData = {
  shop: LandingShop;
  landing: LandingConfig;
  hours: LandingHours[];
  today: {
    date: string;
    weekday: number;
    is_open: boolean;
    opens_at: string | null;
    closes_at: string | null;
  };
  staff: LandingStaff[];
  services: LandingService[];
};

type Row = Record<string, unknown>;

const str = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const strOrNull = (value: unknown) => (typeof value === "string" && value ? value : null);
const num = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const rows = (value: unknown): Row[] =>
  Array.isArray(value)
    ? value.filter((item): item is Row => !!item && typeof item === "object")
    : [];

export function parseLandingConfig(raw: unknown): LandingConfig {
  const data = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Row) : {};
  const bool = (key: keyof LandingConfig) =>
    typeof data[key] === "boolean" ? (data[key] as boolean) : (DEFAULT_LANDING[key] as boolean);
  return {
    enabled: bool("enabled"),
    headline: str(data.headline),
    about: str(data.about),
    address: str(data.address),
    instagram: str(data.instagram),
    whatsapp: str(data.whatsapp),
    show_staff: bool("show_staff"),
    show_services: bool("show_services"),
    show_today: bool("show_today"),
    show_hours: bool("show_hours"),
  };
}

export function parseLandingData(raw: Json | null | undefined): LandingData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as Row;
  const shop = (data.shop ?? null) as Row | null;
  if (!shop || typeof shop.id !== "string") return null;
  const today = (data.today ?? {}) as Row;
  return {
    shop: {
      id: shop.id,
      name: str(shop.name),
      slug: str(shop.slug),
      timezone: str(shop.timezone, "America/Sao_Paulo"),
      display_name: strOrNull(shop.display_name),
      tagline: strOrNull(shop.tagline),
      logo_url: strOrNull(shop.logo_url),
      logo_background_color: strOrNull(shop.logo_background_color),
      font_family: strOrNull(shop.font_family),
      custom_font_url: strOrNull(shop.custom_font_url),
      header_font_weight:
        typeof shop.header_font_weight === "number" ? shop.header_font_weight : null,
      header_font_style: strOrNull(shop.header_font_style),
      corner_style: strOrNull(shop.corner_style),
      primary_color: strOrNull(shop.primary_color),
      accent_color: strOrNull(shop.accent_color),
      hero_image_url: strOrNull(shop.hero_image_url),
    },
    landing: parseLandingConfig(data.landing),
    hours: rows(data.hours).map((row) => ({
      weekday: num(row.weekday),
      is_open: row.is_open === true,
      opens_at: str(row.opens_at),
      closes_at: str(row.closes_at),
    })),
    today: {
      date: str(today.date),
      weekday: num(today.weekday),
      is_open: today.is_open === true,
      opens_at: strOrNull(today.opens_at),
      closes_at: strOrNull(today.closes_at),
    },
    staff: rows(data.staff).map((row) => ({
      name: str(row.name),
      bio: str(row.bio),
      avatar_url: strOrNull(row.avatar_url),
      booking_slug: strOrNull(row.booking_slug),
      free_today: Array.isArray(row.free_today)
        ? row.free_today.filter((item): item is string => typeof item === "string")
        : [],
      offers_services: row.offers_services !== false,
      min_duration_minutes:
        typeof row.min_duration_minutes === "number" && row.min_duration_minutes > 0
          ? row.min_duration_minutes
          : null,
    })),
    services: rows(data.services).map((row) => ({
      name: str(row.name),
      description: str(row.description),
      duration_minutes: num(row.duration_minutes),
      price_cents: num(row.price_cents),
      icon: strOrNull(row.icon),
    })),
  };
}

export type LandingProblem = "instagram" | "whatsapp" | "length";

/** Mesmas regras do banco (landing_config_valid), para avisar antes de salvar. */
export function validateLandingConfig(config: LandingConfig): LandingProblem | null {
  if (
    config.headline.length > LANDING_LIMITS.headline ||
    config.about.length > LANDING_LIMITS.about ||
    config.address.length > LANDING_LIMITS.address
  )
    return "length";
  if (config.instagram && !/^@?[A-Za-z0-9._]{1,30}$/.test(config.instagram)) return "instagram";
  if (config.whatsapp && !/^\+?[0-9 ()-]{8,20}$/.test(config.whatsapp)) return "whatsapp";
  return null;
}

/** Limpa espaços antes de salvar; o banco recusa qualquer chave fora desta lista. */
export function cleanLandingConfig(config: LandingConfig): LandingConfig {
  return {
    ...config,
    headline: config.headline.trim(),
    about: config.about.trim(),
    address: config.address.trim(),
    instagram: config.instagram.trim(),
    whatsapp: config.whatsapp.trim(),
  };
}

export type OpenState =
  | { kind: "open"; until: string }
  | { kind: "later"; opens: string }
  | { kind: "closed" };

/** Situação de agora no fuso da loja, a partir do expediente de hoje. */
export function openStateAt(today: LandingData["today"], nowHHMM: string): OpenState {
  if (!today.is_open || !today.opens_at || !today.closes_at) return { kind: "closed" };
  if (nowHHMM < today.opens_at) return { kind: "later", opens: today.opens_at };
  if (nowHHMM < today.closes_at) return { kind: "open", until: today.closes_at };
  return { kind: "closed" };
}

export type NextOpening = { inDays: number; weekday: number; opens: string };

/**
 * Próxima abertura depois de hoje (amanhã = `inDays: 1`), pela tabela da semana. Serve para o
 * selo "Fechado agora · abre amanhã às 09:00". Sem nenhum dia aberto, devolve `null`.
 */
export function nextOpeningAfterToday(
  hours: LandingHours[],
  todayWeekday: number,
): NextOpening | null {
  for (let inDays = 1; inDays <= 7; inDays += 1) {
    const weekday = (todayWeekday + inDays) % 7;
    const row = hours.find((item) => item.weekday === weekday);
    if (row?.is_open && row.opens_at && row.closes_at) {
      return { inDays, weekday, opens: row.opens_at };
    }
  }
  return null;
}

/** O expediente de hoje já terminou (houve atendimento, mas acabou). */
export function endedToday(today: LandingData["today"], nowHHMM: string) {
  return !!(today.is_open && today.closes_at && nowHHMM >= today.closes_at);
}

export type HoursGroup = {
  /** Dias seguidos (ordem seg → dom) com o mesmo horário. */
  days: number[];
  is_open: boolean;
  opens_at: string;
  closes_at: string;
};

/** Semana começando na segunda, como a pessoa lê. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * Junta dias seguidos com o mesmo horário: "Seg a Sex 09:00–19:00 · Sáb 08:00–14:00 · Dom
 * Fechado" em 3 linhas em vez de 7. Dia sem linha na tabela conta como fechado.
 */
export function groupHours(hours: LandingHours[]): HoursGroup[] {
  const groups: HoursGroup[] = [];
  for (const weekday of WEEK_ORDER) {
    const row = hours.find((item) => item.weekday === weekday);
    const is_open = !!row?.is_open;
    const opens_at = is_open ? (row?.opens_at ?? "") : "";
    const closes_at = is_open ? (row?.closes_at ?? "") : "";
    const last = groups[groups.length - 1];
    if (
      last &&
      last.is_open === is_open &&
      last.opens_at === opens_at &&
      last.closes_at === closes_at
    ) {
      last.days.push(weekday);
    } else {
      groups.push({ days: [weekday], is_open, opens_at, closes_at });
    }
  }
  return groups;
}

/**
 * Hoje fechado por exceção num dia de expediente: tira hoje do grupo ("Seg a Sex") e o mostra
 * numa linha própria fechada, para a semana não contradizer o selo "Fechado agora". Os dias
 * antes e depois de hoje continuam juntos, cada lado no seu grupo.
 */
export function splitClosedToday(
  groups: HoursGroup[],
  todayWeekday: number,
  todayOpen: boolean,
): HoursGroup[] {
  if (todayOpen) return groups;
  return groups.flatMap((group) => {
    const index = group.days.indexOf(todayWeekday);
    if (index < 0 || !group.is_open) return [group];
    const before = group.days.slice(0, index);
    const after = group.days.slice(index + 1);
    return [
      ...(before.length ? [{ ...group, days: before }] : []),
      { days: [todayWeekday], is_open: false, opens_at: "", closes_at: "" },
      ...(after.length ? [{ ...group, days: after }] : []),
    ];
  });
}

/**
 * Ordem dos cartões da equipe: quem tem horário hoje primeiro (pelo mais cedo), depois quem
 * está sem vaga e, por último, quem não tem agenda online. Mantém a ordem da loja no empate.
 */
export function sortStaffByAvailability(staff: LandingStaff[]): LandingStaff[] {
  const rank = (member: LandingStaff) =>
    !member.offers_services ? 2 : member.free_today.length > 0 ? 0 : 1;
  return staff
    .map((member, index) => ({ member, index }))
    .sort((a, b) => {
      const byRank = rank(a.member) - rank(b.member);
      if (byRank) return byRank;
      if (rank(a.member) === 0) {
        const byTime = (a.member.free_today[0] ?? "").localeCompare(b.member.free_today[0] ?? "");
        if (byTime) return byTime;
      }
      return a.index - b.index;
    })
    .map(({ member }) => member);
}

export function instagramUrl(handle: string) {
  const clean = handle.trim().replace(/^@/, "");
  return clean ? `https://instagram.com/${encodeURIComponent(clean)}` : null;
}

export function whatsappUrl(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (!phone.trim().startsWith("+") && digits.length <= 11) digits = `55${digits}`;
  return `https://wa.me/${digits}`;
}

export function mapsUrl(address: string) {
  const clean = address.trim();
  return clean
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clean)}`
    : null;
}

/** Mostra um "HH:MM" da loja no formato de hora do idioma (ex.: 02:30 PM em en-US). */
export function formatClock(value: string | null | undefined, locale: string) {
  if (!value) return value ?? "";
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return value;
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2024, 0, 1, Number(match[1]), Number(match[2]))));
  } catch {
    return value;
  }
}
