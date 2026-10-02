import { useCallback, useEffect, useState } from "react";

export const SETTINGS_SECTIONS = [
  "aparencia",
  "agendamento",
  "pontos",
  "avisos",
  "enderecos",
  "equipe",
  "idioma",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

function isSection(value: string | null): value is SettingsSection {
  return !!value && (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

export function readSectionFromUrl(): SettingsSection | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("secao");
  return isSection(value) ? value : null;
}

function writeSectionToUrl(section: SettingsSection | null, mode: "push" | "replace") {
  const url = new URL(window.location.href);
  if (section) url.searchParams.set("secao", section);
  else url.searchParams.delete("secao");
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next === `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    return;
  }
  if (mode === "push") window.history.pushState(window.history.state, "", next);
  else window.history.replaceState(window.history.state, "", next);
}

/** Subtela aberta em Ajustes, guardada em `?secao=` para o botão Voltar do celular funcionar. */
export function useSettingsSection(active: boolean) {
  const [section, setSectionState] = useState<SettingsSection | null>(() => readSectionFromUrl());

  useEffect(() => {
    if (!active) {
      writeSectionToUrl(null, "replace");
      return;
    }
    const onPop = () => setSectionState(readSectionFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [active]);

  const setSection = useCallback((next: SettingsSection | null) => {
    setSectionState(next);
    writeSectionToUrl(next, next ? "push" : "replace");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return [section, setSection] as const;
}
