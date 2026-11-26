import { useEffect } from "react";

/**
 * Copia só as variáveis `--brand-*` do estabelecimento para `<html>`: janelas, menus e avisos
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
    // O esquema (claro | escuro) liga no <html> o bloco `[data-tema-loja]` de src/styles.css:
    // janelas, menus e o fundo da página passam a usar o tema do estabelecimento.
    const scheme = parsed.find(([name]) => name === "--brand-esquema")?.[1];
    if (scheme) root.setAttribute("data-tema-loja", scheme);
    // Tema sem matiz (Neutro claro e Neutro escuro): gancho só de aparência, para as áreas que
    // pintam blocos grandes trocarem o cinza médio por tinta cheia (ver src/styles/agenda.css).
    const neutral = (parsed.find(([name]) => name === "--brand-tema")?.[1] ?? "").startsWith(
      "neutro",
    );
    if (neutral) root.setAttribute("data-tema-neutro", "");
    else root.removeAttribute("data-tema-neutro");
    return () => {
      for (const [name] of parsed) root.style.removeProperty(name);
      if (scheme) root.removeAttribute("data-tema-loja");
      root.removeAttribute("data-tema-neutro");
    };
  }, [key]);

  return null;
}
