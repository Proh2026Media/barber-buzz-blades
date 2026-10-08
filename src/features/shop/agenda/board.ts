/**
 * Regras e ganchos da Agenda que não desenham nada: modo computador, situação do bloco no quadro,
 * divisão em faixas quando atendimentos se sobrepõem e como mostrar um bloqueio.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { Ban, type LucideIcon } from "lucide-react";
import { BLOCK_REASONS } from "@/features/shop/hours/reasons";
import { useI18n } from "@/lib/i18n";
import { momentOf } from "./model";
import { useShopTime } from "./summary";
import type { AgendaBlock, CardState, DayAppointment } from "./types";

/** Computador (a partir de 1024 px): onde o quadro por profissional cabe. */
export function useDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return desktop;
}

/** Situação do bloco no quadro: a mesma do selo do cartão (sem os fatos de falta). */
export function boardState(row: DayAppointment, now: number): CardState {
  const moment = momentOf(row, now);
  if (row.status === "cancelled") return "cancelled";
  if (moment === "unresolved") return "unresolved";
  if (moment === "inProgress" && row.status === "confirmed") return "inProgress";
  if (row.status === "reschedule_requested") return "reschedule_requested";
  return row.status as CardState;
}

/**
 * Listras da faixa "Bloqueado": as mesmas da barra do dia em Horários (DayTrack), em vermelho.
 * Se a de Horários mudar, mudar aqui também (mesmo estado = mesma cara).
 */
export const BLOCK_HATCH: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, var(--tone-line) 0 3px, color-mix(in oklab, var(--tone-line) 25%, transparent) 3px 6px)",
};

/** Listras claras para áreas grandes (texto por cima continua legível). */
export const BLOCK_HATCH_SOFT: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, color-mix(in oklab, var(--tone-line) 16%, transparent) 0 6px, transparent 6px 12px)",
};

/**
 * Como mostrar um bloqueio: ícone do motivo (o texto gravado é o rótulo traduzido de Horários),
 * título, horário recortado no dia e se ocupa o dia inteiro de funcionamento.
 */
export function useBlockInfo(timeZone: string) {
  const { t } = useI18n();
  const time = useShopTime(timeZone);
  return (
    block: AgendaBlock,
    day: { start: number; end: number },
    open: { start: number; end: number } | null,
  ) => {
    const reason = block.reason?.trim() ?? "";
    const preset = BLOCK_REASONS.find((item) => t(item.key) === reason);
    const icon: LucideIcon = preset?.icon ?? Ban;
    const start = Math.max(Date.parse(block.starts_at), day.start);
    const end = Math.min(Date.parse(block.ends_at), day.end);
    const allDay = open
      ? start <= open.start && end >= open.end
      : start <= day.start && end >= day.end - 60_000;
    return {
      icon,
      reason,
      title: reason || t("agenda.blocked"),
      start,
      end,
      allDay,
      range: allDay ? t("agenda.block.allDay") : `${time(start)}–${time(end)}`,
    };
  };
}
