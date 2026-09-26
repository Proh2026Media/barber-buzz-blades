import type { ReactNode } from "react";

const URL_RE = /https?:\/\/[^\s<]+[^<>.,;:!?)\]\s]/gi;

type Mark = "bold" | "italic" | "strike" | "code" | "mono";

type Token =
  | { type: "text"; value: string }
  | { type: "url"; value: string }
  | { type: Mark; children: Token[] };

function findEarliest(
  text: string,
  from: number,
): { index: number; length: number; mark: Mark; inner: string } | null {
  const slice = text.slice(from);
  const candidates: Array<{ index: number; length: number; mark: Mark; inner: string }> = [];

  const mono = /^```([\s\S]+?)```/.exec(slice);
  if (mono) {
    candidates.push({ index: from, length: mono[0].length, mark: "mono", inner: mono[1] });
  }

  const patterns: Array<{ re: RegExp; mark: Mark }> = [
    { re: /`([^`\n]+?)`/g, mark: "code" },
    { re: /\*([^*\n]+?)\*/g, mark: "bold" },
    { re: /_([^_\n]+?)_/g, mark: "italic" },
    { re: /~([^~\n]+?)~/g, mark: "strike" },
  ];

  for (const { re, mark } of patterns) {
    re.lastIndex = 0;
    const match = re.exec(slice);
    if (!match || match.index == null) continue;
    candidates.push({
      index: from + match.index,
      length: match[0].length,
      mark,
      inner: match[1],
    });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.index - b.index || b.length - a.length);
  return candidates[0] ?? null;
}

function tokenizeSegment(text: string): Token[] {
  if (!text) return [];
  const tokens: Token[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const next = findEarliest(text, cursor);
    if (!next) {
      tokens.push({ type: "text", value: text.slice(cursor) });
      break;
    }
    if (next.index > cursor) {
      tokens.push({ type: "text", value: text.slice(cursor, next.index) });
    }
    tokens.push({
      type: next.mark,
      children: tokenizeSegment(next.inner),
    });
    cursor = next.index + next.length;
  }

  return tokens;
}

/** Extrai URLs para não formatar `_` dentro delas; depois recompõe. */
function tokenizeWithUrls(text: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  const re = new RegExp(URL_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      tokens.push(...tokenizeSegment(text.slice(last, match.index)));
    }
    tokens.push({ type: "url", value: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    tokens.push(...tokenizeSegment(text.slice(last)));
  }
  return tokens;
}

function renderTokens(tokens: Token[], keyPrefix: string): ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    if (token.type === "text") return <span key={key}>{token.value}</span>;
    if (token.type === "url") {
      return (
        <a
          key={key}
          href={token.value}
          target="_blank"
          rel="noreferrer"
          className="break-all text-sky-700 underline underline-offset-2 dark:text-sky-400"
        >
          {token.value}
        </a>
      );
    }
    const children = renderTokens(token.children, key);
    if (token.type === "bold") {
      return (
        <strong key={key} className="font-bold">
          {children}
        </strong>
      );
    }
    if (token.type === "italic") {
      return (
        <em key={key} className="italic">
          {children}
        </em>
      );
    }
    if (token.type === "strike") {
      return (
        <s key={key} className="line-through">
          {children}
        </s>
      );
    }
    if (token.type === "code") {
      return (
        <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {children}
        </code>
      );
    }
    return (
      <span
        key={key}
        className="my-1 block whitespace-pre-wrap rounded-md bg-muted px-2 py-1 font-mono text-[0.85em]"
      >
        {children}
      </span>
    );
  });
}

type WhatsAppFormattedPreviewProps = {
  text: string;
  className?: string;
};

/** Prévia visual no estilo WhatsApp (*negrito*, _itálico_, ~tachado~, links). */
export function WhatsAppFormattedPreview({ text, className }: WhatsAppFormattedPreviewProps) {
  if (!text.trim()) {
    return <p className={className}>—</p>;
  }

  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  return (
    <div className={className}>
      {lines.map((line, lineIndex) => {
        if (line.length === 0) {
          return <div key={`empty-${lineIndex}`} className="h-3" aria-hidden />;
        }
        return (
          <p key={`line-${lineIndex}`} className="whitespace-pre-wrap break-words leading-relaxed">
            {renderTokens(tokenizeWithUrls(line), `L${lineIndex}`)}
          </p>
        );
      })}
    </div>
  );
}
