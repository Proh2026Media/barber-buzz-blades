import { Coffee, PartyPopper, UserX, Wrench, type LucideIcon } from "lucide-react";
import type { MessageKey } from "@/lib/i18n";

/** Motivos prontos: o texto gravado é o rótulo traduzido, como antes. */
export const BLOCK_REASONS = [
  { id: "holiday", key: "shop.block.reasonHoliday", icon: PartyPopper },
  { id: "break", key: "shop.block.reasonBreak", icon: Coffee },
  { id: "maintenance", key: "shop.block.reasonMaintenance", icon: Wrench },
  { id: "absence", key: "shop.block.reasonAbsence", icon: UserX },
] as const satisfies readonly { id: string; key: MessageKey; icon: LucideIcon }[];
