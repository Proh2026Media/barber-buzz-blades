import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Loader2, MessageCircle, UserRound } from "lucide-react";
import { FieldMessage, IconTile, Notice } from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

/**
 * Pedido de nome no primeiro acesso.
 *
 * Aparece quando o nome do perfil está vazio ou é só o começo do e-mail (o banco usava
 * "joao.silva82" para quem criou a conta sem informar nome). Não bloqueia o app: "Agora não"
 * esconde o cartão por alguns dias neste aparelho. Se a gravação falhar, o cartão mostra um
 * aviso curto e continua dispensável.
 */

const SNOOZE_KEY = "mb_name_prompt_snooze_v1";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const NAME_MIN = 2;
const NAME_MAX = 80;

function snoozedFor(userId: string) {
  try {
    const raw = window.localStorage.getItem(`${SNOOZE_KEY}:${userId}`);
    const until = raw ? Number(raw) : 0;
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

function snooze(userId: string) {
  try {
    window.localStorage.setItem(`${SNOOZE_KEY}:${userId}`, String(Date.now() + SNOOZE_MS));
  } catch {
    // Armazenamento bloqueado: o cartão some só nesta visita.
  }
}

/** Nome vazio ou igual ao começo do e-mail (antes do @). */
function needsDisplayName(name: string | null | undefined, email: string | null | undefined) {
  const current = (name ?? "").trim().toLowerCase();
  if (!current) return true;
  const local = (email ?? "").split("@")[0]?.trim().toLowerCase() ?? "";
  return Boolean(local) && current === local;
}

export type NamePromptState = "hidden" | "open" | "done";

type Props = {
  /** Demonstração: o cartão nunca aparece. */
  disabled?: boolean;
  onSaved?: (name: string) => void;
  /** Avisa quem agrupa as etapas do cadastro (aberto, concluído ou escondido). */
  onStateChange?: (state: NamePromptState) => void;
  /** Indicador de etapas, acima do título. */
  header?: ReactNode;
};

export function NamePrompt({ disabled = false, onSaved, onStateChange, header }: Props) {
  const { t } = useI18n();
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const visible = !disabled && open;
  const state: NamePromptState = !visible ? "hidden" : savedName ? "done" : "open";
  useEffect(() => {
    onStateChange?.(state);
  }, [onStateChange, state]);

  useEffect(() => {
    if (disabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (!user || cancelled || snoozedFor(user.id)) return;
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled || profileError || !profile) return;
        if (!needsDisplayName(profile.full_name, user.email)) return;
        setUserId(user.id);
        // Sugere o nome do Google, quando houver e não for o e-mail.
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const suggestion = [meta.full_name, meta.name].find(
          (value): value is string => typeof value === "string" && value.trim().length >= NAME_MIN,
        );
        if (suggestion && !needsDisplayName(suggestion, user.email)) {
          setName(suggestion.trim().slice(0, NAME_MAX));
        }
        setOpen(true);
      } catch {
        // Sem perfil ou sem rede: não pede o nome agora.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [disabled]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const normalized = name.trim().replace(/\s+/g, " ");
    if (normalized.length < NAME_MIN || normalized.length > NAME_MAX) {
      setError(t("cad.nome.errorLength"));
      inputRef.current?.focus();
      return;
    }
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      // Mesma gravação de Meu perfil: full_name é uma das colunas que o próprio usuário altera.
      const result = await supabase
        .from("profiles")
        .update({ full_name: normalized })
        .eq("id", userId)
        .select("id")
        .single();
      if (result.error) {
        setError(t("cad.nome.errorSave"));
        return;
      }
      setSavedName(normalized);
      onSaved?.(normalized);
    } catch {
      // Sem rede: o cartão continua aberto, com o aviso e o nome digitado.
      setError(t("cad.nome.errorSave"));
    } finally {
      setBusy(false);
    }
  }

  function later() {
    if (userId) snooze(userId);
    setOpen(false);
  }

  if (!visible) return null;

  if (savedName) {
    return (
      <Notice
        tone="success"
        title={t("cad.nome.saved", { name: savedName })}
        onDismiss={() => setOpen(false)}
        className="rounded-2xl p-4"
      />
    );
  }

  // Prévia do resultado no lugar da explicação: o lembrete já com o nome digitado.
  const previewName = name.trim().split(/\s+/)[0] || t("cad.nome.previewFallback");

  return (
    <section aria-labelledby="name-prompt-title" className="app-action-card space-y-3 p-4">
      {header}
      <div className="flex items-center gap-3">
        <IconTile icon={UserRound} />
        <h2 id="name-prompt-title" className="min-w-0 text-base font-semibold text-foreground">
          {t("cad.nome.title")}
        </h2>
      </div>
      <form onSubmit={(event) => void save(event)} className="space-y-3" noValidate>
        <label className="block space-y-1.5 text-sm font-semibold text-foreground/85">
          <span>{t("cad.nome.label")}</span>
          <input
            ref={inputRef}
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="done"
            maxLength={NAME_MAX}
            placeholder={t("cad.cliente.namePlaceholder")}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "name-prompt-error" : "name-prompt-preview"}
            className="min-h-11 w-full rounded-[var(--control-radius)] border border-border bg-background px-3 py-2 text-[15px] font-normal text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
        </label>
        {error && (
          <FieldMessage tone="error" id="name-prompt-error">
            <span role="alert">{error}</span>
          </FieldMessage>
        )}
        <div
          id="name-prompt-preview"
          className="flex items-start gap-2 rounded-2xl bg-muted/60 p-3"
        >
          <MessageCircle className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground">
              {t("cad.nome.previewLabel")}
            </p>
            <p className="mt-1 rounded-xl rounded-tl-sm bg-card px-3 py-2 text-sm shadow-sm">
              {t("cad.nome.preview", { name: previewName })}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={later}
            className="flex min-h-11 items-center justify-center rounded-[var(--button-radius)] border border-border px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            {t("cad.nome.later")}
          </button>
          <button
            type="submit"
            disabled={busy}
            aria-busy={busy || undefined}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--button-radius)] bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
            ) : (
              <Check className="size-4" aria-hidden />
            )}
            {busy ? t("common.wait") : t("cad.nome.save")}
          </button>
        </div>
      </form>
    </section>
  );
}
