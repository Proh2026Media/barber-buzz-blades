import { useEffect, useState } from "react";
import { Clock3, MapPin, Palette, Scissors, Share2, Users, type LucideIcon } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { type MessageKey } from "@/lib/i18n";
import { parseLandingConfig } from "@/features/marketing/shop-landing";
import { DEFAULT_ACCENT_COLOR, DEFAULT_PRIMARY_COLOR } from "@/lib/shop/branding";
import {
  cleanSetupGuide,
  fetchSetupGuide,
  saveSetupGuide,
  type SetupGuideState,
} from "@/lib/shop/setup-guide";

/** Para onde cada passo leva: abas do painel ou janelas de Ajustes > Aparência. */
export type SetupTarget = "horarios" | "servicos" | "landing" | "brand" | "equipe";

export type StoredState = SetupGuideState;

export const storageKey = (shopId: string) => `shopSetup:${shopId}`;

export function readStored(shopId: string): StoredState {
  try {
    const raw = window.localStorage.getItem(storageKey(shopId));
    return cleanSetupGuide(raw ? JSON.parse(raw) : null);
  } catch {
    return {};
  }
}

export function writeStored(shopId: string, next: StoredState) {
  try {
    window.localStorage.setItem(storageKey(shopId), JSON.stringify(next));
  } catch {
    // Navegação privada ou armazenamento bloqueado: o guia segue funcionando nesta visita.
  }
}

/**
 * O guia fica no banco (vale em qualquer aparelho) e numa cópia no aparelho, que abre na hora e
 * cobre o banco sem a migration 20261013230000. `latest` é o estado mais novo desta visita.
 */
export const CHANGE_EVENT = "shop-setup:change";

export const latest = new Map<string, StoredState>();

export const synced = new Set<string>();

export function currentState(shopId: string): StoredState {
  return latest.get(shopId) ?? readStored(shopId);
}

/** Guarda no aparelho e avisa os guias montados (Agenda e Ajustes). */
export function publish(shopId: string, state: StoredState) {
  latest.set(shopId, state);
  writeStored(shopId, state);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { shopId, state } }));
}

/** Marca algo no guia: aparelho na hora, banco em segundo plano. */
export function updateGuide(shopId: string, patch: StoredState, notify = true) {
  const next = { ...currentState(shopId), ...patch };
  if (notify) publish(shopId, next);
  else {
    latest.set(shopId, next);
    writeStored(shopId, next);
  }
  void saveSetupGuide(shopId, patch);
}

/**
 * Lê o guia do banco uma vez por visita e junta com o do aparelho (o banco vence). O que só
 * existia no aparelho sobe para o banco, para não se perder o que já foi marcado antes.
 */
export async function syncFromServer(shopId: string) {
  if (synced.has(shopId)) return;
  synced.add(shopId);
  const remote = await fetchSetupGuide(shopId);
  if (!remote) return;
  const local = currentState(shopId);
  const onlyLocal = Object.fromEntries(
    Object.entries(local).filter(([key]) => !(key in remote)),
  ) as StoredState;
  if (Object.keys(onlyLocal).length) void saveSetupGuide(shopId, onlyLocal);
  publish(shopId, { ...local, ...remote });
}

/** Estado do guia desta loja (`null` até ler o aparelho), acompanhando as mudanças. */
export function useGuideState(shopId: string | null): StoredState | null {
  const [stored, setStored] = useState<StoredState | null>(null);
  useEffect(() => {
    if (!shopId) return;
    setStored(currentState(shopId));
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ shopId: string; state: StoredState }>).detail;
      if (detail.shopId === shopId) setStored(detail.state);
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    void syncFromServer(shopId);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, [shopId]);
  return stored;
}

/** O dono/sócio escolheu "Esconder guia" para esta loja? */
export function isShopSetupGuideHidden(shopId: string): boolean {
  if (typeof window === "undefined") return false;
  return !!currentState(shopId).hidden;
}

/**
 * Desfaz o "Esconder guia" desta loja (usado em Ajustes > "Mostrar guia de configuração").
 * Mantém os passos já marcados à mão (horários conferidos, link copiado).
 */
export function showShopSetupGuide(shopId: string) {
  if (typeof window === "undefined") return;
  updateGuide(shopId, { hidden: false });
}

/**
 * A loja nasce aberta de segunda a sábado, das 9h às 19h. Qualquer diferença disso
 * (ou uma linha alterada depois de criada) indica que o dono já mexeu nos horários.
 */
export function hoursWereEdited(hours: Tables<"business_hours">[]) {
  return hours.some((row) => {
    const defaultOpen = row.weekday >= 1 && row.weekday <= 6;
    if (row.is_open !== defaultOpen) return true;
    if (row.is_open && (!row.opens_at.startsWith("09:00") || !row.closes_at.startsWith("19:00"))) {
      return true;
    }
    const created = Date.parse(row.created_at);
    const updated = Date.parse(row.updated_at);
    return Number.isFinite(created) && Number.isFinite(updated) && updated - created > 1000;
  });
}

export function sameColor(value: string | null | undefined, fallback: string) {
  return (value ?? fallback).trim().toUpperCase() === fallback.toUpperCase();
}

export type SetupStepId = "hours" | "service" | "team" | "contact" | "brand" | "link";

export type StepMeta = {
  id: SetupStepId;
  icon: LucideIcon;
  /** Nome curto na faixa de etapas. */
  short: MessageKey;
  title: MessageKey;
  hint: MessageKey;
  /** Botão com verbo completo ("Adicionar endereço e WhatsApp"). */
  action: MessageKey;
  /** Para onde o passo leva (o "link" compartilha ali mesmo, no guia). */
  target: SetupTarget | null;
};

export type Step = StepMeta & { done: boolean; onAction: () => void };

/** Os seis passos do guia, na ordem em que aparecem. */
export const STEP_META: StepMeta[] = [
  {
    id: "hours",
    icon: Clock3,
    short: "eq.guide.step.hours",
    title: "cad.guia.hoursTitle",
    hint: "cad.guia.hoursHint",
    action: "eq.guide.action.hours",
    target: "horarios",
  },
  {
    id: "service",
    icon: Scissors,
    short: "eq.guide.step.service",
    title: "cad.guia.serviceTitle",
    hint: "cad.guia.serviceHint",
    action: "cad.guia.serviceAction",
    target: "servicos",
  },
  {
    id: "team",
    icon: Users,
    short: "eq.guide.step.team",
    title: "cad.guia.teamTitle",
    hint: "cad.guia.teamHint",
    action: "eq.guide.action.team",
    target: "equipe",
  },
  {
    id: "contact",
    icon: MapPin,
    short: "eq.guide.step.contact",
    title: "cad.guia.contactTitle",
    hint: "cad.guia.contactHint",
    action: "eq.guide.action.contact",
    target: "landing",
  },
  {
    id: "brand",
    icon: Palette,
    short: "eq.guide.step.brand",
    title: "cad.guia.brandTitle",
    hint: "cad.guia.brandHint",
    action: "eq.guide.action.brand",
    target: "brand",
  },
  {
    id: "link",
    icon: Share2,
    short: "eq.guide.step.link",
    title: "eq.guide.linkTitle",
    hint: "eq.guide.linkHint",
    action: "eq.guide.action.link",
    target: null,
  },
];

export type SetupData = {
  services: Tables<"services">[];
  businessHours: Tables<"business_hours">[];
  settings: Tables<"barbershop_settings">;
  /** Profissionais ativos na agenda (mais de um = já tem equipe). */
  staffCount: number;
};

/** Quais passos já estão feitos, a partir dos dados do painel e do que ficou no aparelho. */
export function stepsDone(
  { services, businessHours, settings, staffCount }: SetupData,
  stored: StoredState,
): Record<SetupStepId, boolean> {
  const landing = parseLandingConfig(settings.landing);
  return {
    hours: !!stored.hoursOk || hoursWereEdited(businessHours),
    service: services.some((service) => service.active),
    team: !!stored.teamOk || staffCount > 1,
    contact: landing.address.trim() !== "" && landing.whatsapp.trim() !== "",
    brand:
      !!settings.logo_url ||
      !sameColor(settings.primary_color, DEFAULT_PRIMARY_COLOR) ||
      !sameColor(settings.accent_color, DEFAULT_ACCENT_COLOR),
    link: !!stored.linkCopied,
  };
}

export type ShopSetupProgress = {
  done: number;
  total: number;
  /** Próximo passo em aberto (`null` = tudo pronto). */
  next: Omit<StepMeta, "title" | "hint"> | null;
  /** O guia foi escondido nesta loja. */
  hidden: boolean;
};

/**
 * Progresso do guia "Deixe sua barbearia pronta" para mostrar fora da Agenda (menu de Ajustes):
 * os mesmos passos e a mesma conta do guia. `null` até ler o aparelho ou sem dados da loja.
 */
export function useShopSetupProgress(
  input: (SetupData & { shopId: string }) | null,
): ShopSetupProgress | null {
  const stored = useGuideState(input?.shopId ?? null);
  if (!input || !stored) return null;
  const done = stepsDone(input, stored);
  const next = STEP_META.find((step) => !done[step.id]) ?? null;
  return {
    done: STEP_META.filter((step) => done[step.id]).length,
    total: STEP_META.length,
    next,
    hidden: !!stored.hidden,
  };
}
