import { createContext, useContext, type Dispatch } from "react";
import type { DemoAction, DemoState } from "./model";

/**
 * Visões da demonstração. Os donos aparecem em três visões de sociedade (mesmo papel "Dono · %"
 * do produto): dono único, partes iguais e sócio com a menor parte.
 */
export type DemoRole =
  | "platform"
  | "owner"
  | "equal"
  | "minority"
  | "associate"
  | "employee"
  | "customer";

export type DemoChromeValue = {
  role: DemoRole;
  setRole: (role: DemoRole) => void;
  exit: () => void;
  state: DemoState;
  dispatch: Dispatch<DemoAction>;
  openProfileRequest: boolean;
  requestOpenProfile: () => void;
  clearOpenProfileRequest: () => void;
};

export const DemoChromeContext = createContext<DemoChromeValue | null>(null);

export function useDemoChrome() {
  return useContext(DemoChromeContext);
}
