import { useEffect, useRef, useState } from "react";
import { UserRound } from "lucide-react";
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

type Props = {
  /** Demonstração: o cartão nunca aparece. */
  disabled?: boolean;
  onSaved?: (name: string) => void;
};

export function NamePrompt({ disabled = false, onSaved }: Props) {
  const { t } = useI18n();
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  function later() {
    if (userId) snooze(userId);
    setOpen(false);
  }

  if (disabled || !open) return null;

  if (savedName) {
    return (
      <section
        role="status"
        className="app-action-card flex items-center gap-3 border border-border/70 bg-card p-4 text-sm"
      >
        <UserRound className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="min-w-0 flex-1">{t("cad.nome.saved", { name: savedName })}</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex min-h-11 items-center rounded-[var(--button-radius)] px-3 text-sm font-semibold text-primary"
        >
          {t("common.close")}
        </button>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="name-prompt-title"
      className="app-action-card space-y-3 border border-primary/25 bg-card p-4"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--control-radius)] bg-primary/10 text-primary">
          <UserRound className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="name-prompt-title" className="text-base font-semibold text-foreground">
            {t("cad.nome.title")}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("cad.nome.text")}</p>
        </div>
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
            aria-describedby={error ? "name-prompt-error" : undefined}
            className="min-h-11 w-full rounded-[var(--control-radius)] border border-border bg-background px-3 py-2 text-[15px] font-normal text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
        </label>
        {error && (
          <p id="name-prompt-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
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
            className="flex min-h-11 items-center justify-center rounded-[var(--button-radius)] bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? t("common.wait") : t("cad.nome.save")}
          </button>
        </div>
      </form>
    </section>
  );
}
