import { useEffect, useId, useState } from "react";
import { Check, PencilLine, Tag as TagIcon, X } from "lucide-react";
import { InlineStatus, type ActionState } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { cleanNickname } from "./model";

/**
 * Apelido do cliente (como a equipe chama; o cliente não vê). Mostra o apelido com "Mudar"; ao
 * tocar, vira um campo com "Salvar" e "Cancelar". Grava pela função recebida.
 */
export function NicknameEditor({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (next: string | null) => Promise<void>;
}) {
  const { t } = useI18n();
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [state, setState] = useState<ActionState | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  async function save() {
    const next = cleanNickname(draft);
    if (next === (value ?? null)) {
      setEditing(false);
      return;
    }
    setState("saving");
    try {
      await onSave(next);
      setState("saved");
      setEditing(false);
    } catch {
      setState("error");
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {value ? (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <TagIcon className="size-4 shrink-0 text-gold" aria-hidden />
            <span className="text-muted-foreground">{t("client.nickname")}:</span>
            <strong className="font-semibold">{value}</strong>
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setState(null);
            setEditing(true);
          }}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-primary transition hover:bg-muted/60"
        >
          <PencilLine className="size-4" aria-hidden />
          {value ? t("client.nicknameEdit") : t("client.nicknameAdd")}
        </button>
        <InlineStatus state={state} />
      </div>
    );
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <label htmlFor={id} className="block text-sm font-semibold">
        {t("client.nickname")}
      </label>
      <input
        id={id}
        autoFocus
        value={draft}
        maxLength={40}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={t("bk.nicknamePlaceholder")}
        className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {t("bk.nicknameHint")}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={state === "saving"}
          className="action-button action-confirm min-h-11"
        >
          <Check aria-hidden />
          {t("client.nicknameSave")}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setState(null);
          }}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold"
        >
          <X className="size-4" aria-hidden />
          {t("common.cancel")}
        </button>
        <InlineStatus
          state={state === "error" ? "error" : null}
          text={state === "error" ? t("client.nicknameError") : undefined}
          onRetry={() => void save()}
        />
      </div>
    </form>
  );
}
