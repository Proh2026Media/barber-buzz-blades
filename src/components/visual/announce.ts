/**
 * Anúncio para leitor de tela sem mexer no layout: duas regiões vivas escondidas no fim do
 * `<body>` (educada e urgente), criadas uma vez. O texto entra um instante depois de a região
 * existir, para ser lido também na primeira vez.
 */
type Politeness = "polite" | "assertive";

const regions: Partial<Record<Politeness, HTMLElement>> = {};

function region(politeness: Politeness) {
  const existing = regions[politeness];
  if (existing?.isConnected) return existing;
  const el = document.createElement("div");
  el.setAttribute("aria-live", politeness);
  el.setAttribute("aria-atomic", "true");
  el.setAttribute("data-visual-announcer", politeness);
  el.style.cssText =
    "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0";
  document.body.appendChild(el);
  regions[politeness] = el;
  return el;
}

export function announce(text: string, politeness: Politeness = "polite") {
  if (typeof document === "undefined" || !text) return;
  const el = region(politeness);
  el.textContent = "";
  window.setTimeout(() => {
    el.textContent = text;
  }, 60);
}
