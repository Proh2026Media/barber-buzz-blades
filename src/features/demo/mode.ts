import { useSyncExternalStore } from "react";

const eventName = "arena-demo-mode";
const memory = new Map<string, boolean>();
const keyFor = (userId: string) => `arena:demo:${userId}`;

// A personal preview preference for this browser tab, never a global production flag.
export function isDemoEnabled(userId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(keyFor(userId)) === "on";
  } catch {
    return memory.get(userId) ?? false;
  }
}

export function setDemoEnabled(userId: string, enabled: boolean) {
  memory.set(userId, enabled);
  try {
    if (enabled) sessionStorage.setItem(keyFor(userId), "on");
    else sessionStorage.removeItem(keyFor(userId));
  } catch {
    // Still allow the preview when browser storage is unavailable.
  }
  window.dispatchEvent(new Event(eventName));
}

function subscribe(callback: () => void) {
  window.addEventListener(eventName, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(eventName, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useDemoMode(userId: string) {
  return useSyncExternalStore(
    subscribe,
    () => isDemoEnabled(userId),
    () => false,
  );
}
