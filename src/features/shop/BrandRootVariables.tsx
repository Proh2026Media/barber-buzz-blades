import { useEffect } from "react";

/**
 * Copia só as variáveis `--brand-*` da barbearia para `<html>`: janelas, menus e avisos
 * são renderizados em portal no `<body>`, fora do `.arena-workspace` que recebe a marca.
 * `--primary`, `--gold` e os raios não sobem, para não sobrepor o tema escuro nem os cantos
 * fora do workspace (estes já seguem a loja por `body:has(.arena-workspace.brand-corners-*)`).
 */
export function BrandRootVariables({ vars }: { vars: Record<string, string> | null | undefined }) {
  const entries = vars ? Object.entries(vars).filter(([key]) => key.startsWith("--brand-")) : [];
  const key = JSON.stringify(entries);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const parsed = JSON.parse(key) as Array<[string, string]>;
    if (!parsed.length) return;
    const root = document.documentElement;
    for (const [name, value] of parsed) root.style.setProperty(name, value);
    return () => {
      for (const [name] of parsed) root.style.removeProperty(name);
    };
  }, [key]);

  return null;
}
