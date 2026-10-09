import { createContext, useContext, type Dispatch } from "react";
import type { TeamMember } from "@/features/shop/team";
import type { DemoAction, DemoState } from "./model";

export type DemoValue = DemoState & {
  dispatch: Dispatch<DemoAction>;
  exit: () => void;
  /** Pessoas e papéis fictícios da visão da equipe aberta (sociedade, aprovações, saída). */
  team?: TeamMember[];
};

export const DemoContext = createContext<DemoValue | null>(null);

export function useDemo() {
  return useContext(DemoContext);
}
