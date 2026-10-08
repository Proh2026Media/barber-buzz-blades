import { Check, Copy, ExternalLink, Eye, EyeOff, Share2 } from "lucide-react";
import { Fragment, useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { announce } from "./announce";
import { FieldMessage } from "./Field";
import { readableLink } from "./helpers";

const BUTTON =
  "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-semibold transition hover:border-primary/40";

/**
 * Valor para copiar ou enviar: link da loja, link do profissional, senha temporária, código.
 * Mostra o valor legível; "Copiar" vira "✓ Copiado" por 2 s; "Enviar" abre o compartilhamento do
 * celular (só aparece onde existe e com `share`); "Abrir" para links. Em `secret`, o valor começa
 * escondido. Endereços longos quebram só depois de "/", ".", "-" etc., nunca no meio de uma
 * palavra ("carla-o / liveira").
 */
export function CopyField({
  value,
  display,
  label,
  secret,
  href,
  shareTitle,
  mono,
  share: shareEnabled = true,
  className,
}: {
  /** O que vai para a área de transferência. */
  value: string;
  /** Como mostrar (padrão: o próprio valor; links ficam sem "https://"). */
  display?: string;
  label?: string;
  /** Senha ou código: começa escondido, com "Mostrar". */
  secret?: boolean;
  /** Mostra "Abrir" (nova aba). */
  href?: string;
  /** Título usado no compartilhamento do celular. */
  shareTitle?: string;
  /** Fonte monoespaçada só no valor (códigos e senhas). */
  mono?: boolean;
  /**
   * Mostra "Enviar" (compartilhar do celular). `false` em valores técnicos que só se copiam
   * (registro de DNS, por exemplo).
   */
  share?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const labelId = useId();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState(!secret);
  const [canShare, setCanShare] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    return () => window.clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setFailed(false);
      setCopied(true);
      announce(t("visual.copied"));
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  }

  async function share() {
    try {
      const isLink = /^https?:\/\//i.test(value);
      await navigator.share(
        isLink ? { title: shareTitle, url: value } : { title: shareTitle, text: value },
      );
    } catch {
      // A pessoa fechou o compartilhamento: nada a fazer.
    }
  }

  const shownText = display ?? (/^https?:\/\//i.test(value) ? readableLink(value) : value);

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <p id={labelId} className="text-xs font-semibold text-muted-foreground">
          {label}
        </p>
      )}
      <div
        role="group"
        aria-labelledby={label ? labelId : undefined}
        className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/60 p-2"
      >
        <span
          className={cn(
            // Quebra nos pontos naturais (<wbr>); `anywhere` só corta um trecho maior que a linha.
            "min-w-0 flex-1 basis-40 px-1 text-sm font-semibold [overflow-wrap:anywhere]",
            mono && "font-mono tracking-wide",
          )}
        >
          {shown ? breakable(shownText) : "••••••••"}
        </span>
        <span className="flex min-w-0 flex-wrap gap-1.5">
          {secret && (
            <button type="button" onClick={() => setShown((value) => !value)} className={BUTTON}>
              {shown ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
              {shown ? t("visual.hide") : t("visual.show")}
            </button>
          )}
          <button type="button" onClick={() => void copy()} className={BUTTON}>
            {copied ? (
              <Check className="tone-success size-4 text-[color:var(--tone-ink)]" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
            {copied ? t("visual.copied") : t("visual.copy")}
          </button>
          {canShare && shareEnabled && (
            <button type="button" onClick={() => void share()} className={BUTTON}>
              <Share2 className="size-4" aria-hidden />
              {t("visual.share")}
            </button>
          )}
          {href && (
            <a href={href} target="_blank" rel="noreferrer" className={BUTTON}>
              <ExternalLink className="size-4" aria-hidden />
              {t("visual.open")}
            </a>
          )}
        </span>
      </div>
      {failed && <FieldMessage tone="error">{t("visual.copyError")}</FieldMessage>}
    </div>
  );
}

/** Pontos onde um endereço ou código pode quebrar de linha sem partir uma palavra. */
const BREAK_AFTER = /[./\-_?&=#@:]/;

/**
 * Põe um <wbr> (quebra opcional, invisível e fora da cópia) depois de cada "/", ".", "-"…:
 * "arena-barber.beauty.com/carla-oliveira" quebra em "…beauty.com/" + "carla-oliveira".
 */
function breakable(text: string) {
  const parts: string[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (BREAK_AFTER.test(text[index]) && index < text.length - 1) {
      parts.push(text.slice(start, index + 1));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 && <wbr />}
      {part}
    </Fragment>
  ));
}
