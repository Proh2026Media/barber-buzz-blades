import { createContext, useContext, type Dispatch } from "react";
import type { DemoAction, DemoState } from "./model";

export type DemoRole = "platform" | "owner" | "partner" | "associate" | "employee" | "customer";

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
