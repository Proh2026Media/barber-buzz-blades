import type { ReactNode } from "react";

/** A mesma composição externa no login real e na prévia da identidade. */
export function AuthFrame({ children }: { children: ReactNode }) {
  return <div className="auth-entry-frame">{children}</div>;
}
