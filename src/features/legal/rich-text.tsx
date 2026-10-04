import { Fragment, type ReactNode } from "react";

/** Monta texto traduzido com trechos em **negrito** e marcadores `{nome}` trocados por nós React. */
export function legalRichText(template: string, nodes: Record<string, ReactNode> = {}) {
  return template.split(/(\*\*[^*]+\*\*|\{\w+\})/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    const marker = /^\{(\w+)\}$/.exec(part);
    if (marker) return <Fragment key={i}>{nodes[marker[1]] ?? part}</Fragment>;
    return part;
  });
}

export const legalLinkClass = "font-semibold text-foreground underline underline-offset-2";
