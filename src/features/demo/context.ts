import { createContext, useContext, type Dispatch } from "react";
import type { DemoAction, DemoState } from "./model";

export const DemoContext = createContext<
  (DemoState & { dispatch: Dispatch<DemoAction>; exit: () => void }) | null
>(null);

export function useDemo() {
  return useContext(DemoContext);
}
