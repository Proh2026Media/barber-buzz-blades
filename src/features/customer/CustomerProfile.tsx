import { PrivacyCenter } from "@/features/insights/PrivacyCenter";
import { DataRights } from "@/features/insights/DataRights";
import { ChangePasswordCard } from "@/features/auth/ChangePasswordCard";
import { LanguageSettingsCard } from "@/components/LanguageSettingsCard";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Languages,
  Loader2,
  LockKeyhole,
  LogOut,
  Pencil,
  Repeat,
  Save,
  ShieldCheck,
  Store,
  UserRound,
  X,
} from "lucide-react";
import {
  ActionResult,
  FieldMessage,
  IconTile,
  LoadingState,
  Notice,
  PersonAvatar,
  SectionHeader,
  STATE,
  StatusBadge,
  type ActionState,
} from "@/components/visual";
import { WhatsappProfileCard, type WhatsappStatus } from "@/features/customer/WhatsappProfileCard";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { LOCALE_NATIVE_NAMES, t as tNow, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { customerShopHref, type CustomerShop } from "./shop-choice";

export type { CustomerShop };

const SECTION = {
  whatsapp: "conta-whatsapp",
  rhythm: "conta-ritmo",
  shops: "conta-barbearias",
  language: "conta-idioma",
  privacy: "conta-privacidade",
  data: "conta-dados",
  security: "conta-seguranca",
} as const;

/** Leva à seção pedida pelo resumo (respeita "menos movimento"). */
function jumpTo(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  // O título do SectionHeader não é focável: dá tabIndex=-1 para o teclado e o leitor de tela
  // irem junto com a rolagem (sem anel de foco visível no título).
  const heading = target.querySelector<HTMLElement>("h2, h3");
  if (!heading) return;
  if (!heading.hasAttribute("tabindex")) {
    heading.setAttribute("tabindex", "-1");
    heading.classList.add("outline-none");
  }
  heading.focus({ preventScroll: true });
}

export function CustomerProfile({
  onSaved,
  children,
  shops = [],
  currentShopId = null,
  focusWhatsapp = false,
  onOpenShop,
}: {
  /** Aberta pelo link "Número errado?" da entrada: rola e foca o cartão do WhatsApp. */
  focusWhatsapp?: boolean;
  onSaved?: (name: string) => void;
  /** "Seu ritmo": exibido logo depois do WhatsApp, num cartão próprio. */
  children?: ReactNode;
  /** Barbearias em que o cliente entrou; com mais de uma, aparece "Minhas barbearias". */
  shops?: CustomerShop[];
  currentShopId?: string | null;
  /** Abre outra barbearia com a tela "Abrindo …" (sem isso, o link abre direto). */
  onOpenShop?: (shop: CustomerShop) => void;
}) {
  const demo = useDemo();
  const { t, locale } = useI18n();
  const uid = useId();
  const nameInputId = `${uid}-name`;
  const nameMsgId = `${uid}-name-msg`;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [whatsappVerified, setWhatsappVerified] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameResult, setNameResult] = useState<{ state: ActionState; text: string } | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [whats, setWhats] = useState<WhatsappStatus | null>(null);
  const [privacyCount, setPrivacyCount] = useState<{ on: number; total: number } | null>(null);
  const [languageOpen, setLanguageOpen] = useState(false);
  const editNameRef = useRef<HTMLButtonElement>(null);
  const returnNameFocus = useRef(false);

  /** Fecha o formulário do nome e devolve o foco ao "Editar nome" (o botão focado some). */
  function closeNameForm() {
    returnNameFocus.current = true;
    setEditingName(false);
  }

  // Link "Número errado?": assim que o cartão do WhatsApp aparece, ele vem para a tela com foco.
  const whatsappFocused = useRef(false);
  useEffect(() => {
    if (!focusWhatsapp || loading || error || whatsappFocused.current) return;
    whatsappFocused.current = true;
    window.setTimeout(() => jumpTo(SECTION.whatsapp), 50);
  }, [focusWhatsapp, loading, error]);

  // Só foca depois que o botão voltou à tela e saiu do "ocupado" (botão desativado não recebe foco).
  useEffect(() => {
    if (editingName || busy || !returnNameFocus.current) return;
    returnNameFocus.current = false;
    editNameRef.current?.focus();
  }, [editingName, busy]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        if (demo) {
          setName(demo.customerName);
          setEmail("cliente@demo.example");
          setWhatsapp("(11) 99999-0000");
          setWhatsappOptIn(true);
          setWhatsappVerified(true);
          return;
        }
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError || !data.user) throw new Error(tNow("profile.errorLoadAccount"));
        const result = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
        if (result.error) throw new Error(tNow("profile.errorLoad"));
        if (!cancelled) {
          setUserId(data.user.id);
          setName(result.data.full_name ?? "");
          setEmail(data.user.email ?? "");
          setWhatsapp(result.data.whatsapp_e164 ?? "");
          setWhatsappOptIn(Boolean(result.data.whatsapp_opt_in_at));
          // whatsapp_verified_at (migration 20261003180000) ainda fora dos tipos gerados;
          // sem a coluna, o número gravado vale como antes.
          const row = result.data as Record<string, unknown>;
          setWhatsappVerified(
            "whatsapp_verified_at" in row
              ? Boolean(row.whatsapp_verified_at)
              : Boolean(result.data.whatsapp_e164),
          );
        }
      } catch (err) {
        if (!cancelled) setError(friendlyAuthError(err, tNow("profile.errorLoad")));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [demo, loadVersion]);

  async function save(event?: React.FormEvent) {
    event?.preventDefault();
    const normalized = nameDraft.trim();
    if (!normalized || normalized.length > 100) {
      setNameError(t("profile.errorName"));
      document.getElementById(nameInputId)?.focus();
      return;
    }
    setBusy(true);
    setNameError(null);
    setNameResult({ state: "saving", text: t("common.saving") });
    try {
      if (demo) demo.dispatch({ type: "profile.save", name: normalized });
      else {
        if (!userId) throw new Error(t("profile.errorNotLoaded"));
        const result = await supabase
          .from("profiles")
          .update({ full_name: normalized })
          .eq("id", userId)
          .select("id")
          .single();
        if (result.error) throw new Error(t("profile.errorSave"));
      }
      setName(normalized);
      onSaved?.(normalized);
      closeNameForm();
      setNameResult({ state: "saved", text: t("conta.nameSaved") });
    } catch (err) {
      setNameResult({ state: "error", text: friendlyAuthError(err, t("profile.errorSave")) });
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (demo) {
      demo.exit();
      return;
    }
    setBusy(true);
    setSignOutError(null);
    const { error: failure } = await supabase.auth.signOut();
    if (failure) {
      setSignOutError(t("profile.errorSignOut"));
      setBusy(false);
      return;
    }
    window.location.href = "/auth";
  }

  const ready = Boolean(demo) || Boolean(userId);
  const nameChanged = nameDraft.trim() !== name.trim();
  const whatsNeedsConfirm = Boolean(whats?.number) && !whats?.verified && !demo;
  // No resumo, o WhatsApp só aparece quando pede algo (sem número, sem confirmar ou lembretes
  // desligados); confirmado e com lembretes já está dito no cabeçalho do cartão logo abaixo.
  const whatsBadge = !whats
    ? null
    : !whats.number
      ? { ...STATE.paused, label: t("conta.whats.none") }
      : whatsNeedsConfirm
        ? { ...STATE.attention, label: t("conta.whats.pending") }
        : whats.optIn
          ? null
          : { ...STATE.paused, label: t("conta.whats.off") };
  const chipClass =
    "inline-flex min-h-11 items-center rounded-xl transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";
  const otherShops = shops.filter((shop) => shop.id !== currentShopId);

  const signOutButton = (
    <button
      type="button"
      disabled={busy}
      onClick={() => void signOut()}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold transition hover:border-primary/40 disabled:opacity-50"
    >
      <LogOut className="size-4" aria-hidden />
      {demo ? t("profile.exitDemo") : t("profile.signOut")}
    </button>
  );

  return (
    <section
      aria-labelledby={`${uid}-title`}
      className="space-y-5 lg:grid lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0"
    >
      {/* Coluna da identidade: quem é, o que está em ordem e o que pede atenção. */}
      <div className="space-y-4 lg:sticky lg:top-6">
        {/* Título de página no padrão do app: ícone dourado solto + h2. */}
        <div className="app-section-title">
          <UserRound aria-hidden />
          <h2 id={`${uid}-title`}>{t("conta.title")}</h2>
        </div>

        {loading ? (
          <LoadingState variant="cards" count={1} label={t("profile.loading")} />
        ) : error ? (
          // Sem os dados, nada de "Sem nome"/"Sem WhatsApp" falsos: só o motivo e o conserto.
          <div className="app-action-card p-4 sm:p-5">
            <Notice
              tone="danger"
              title={error}
              action={{ label: t("visual.retry"), onClick: () => setLoadVersion((v) => v + 1) }}
            />
          </div>
        ) : (
          <div className="app-action-card space-y-4 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              {/* Iniciais só do nome (sem o "(demo)" da demonstração). */}
              <PersonAvatar
                name={(name || email || "?").replace(/\s*\([^)]*\)\s*/g, " ").trim() || "?"}
                seed={userId ?? email}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <p className="break-words text-lg font-bold leading-tight">
                  {name || t("conta.noName")}
                </p>
                {email && (
                  <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{email}</p>
                )}
                {!editingName && (
                  <button
                    ref={editNameRef}
                    type="button"
                    disabled={!ready || busy}
                    onClick={() => {
                      setNameDraft(name);
                      setNameError(null);
                      setNameResult(null);
                      setEditingName(true);
                    }}
                    className="-ms-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-primary transition hover:bg-muted disabled:opacity-50"
                  >
                    <Pencil className="size-4" aria-hidden />
                    {t("conta.editName")}
                  </button>
                )}
              </div>
            </div>

            {editingName && (
              <form onSubmit={(event) => void save(event)} className="space-y-3" noValidate>
                <div className="space-y-2">
                  <label htmlFor={nameInputId} className="block text-sm font-semibold">
                    {t("profile.fullName")}
                  </label>
                  <input
                    id={nameInputId}
                    autoFocus
                    maxLength={100}
                    autoComplete="name"
                    value={nameDraft}
                    disabled={busy}
                    aria-invalid={nameError ? true : undefined}
                    aria-describedby={nameError ? nameMsgId : undefined}
                    onChange={(event) => {
                      setNameDraft(event.target.value);
                      setNameError(null);
                    }}
                    className="min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2"
                  />
                  {nameError && (
                    <FieldMessage id={nameMsgId} tone="error">
                      {nameError}
                    </FieldMessage>
                  )}
                  {!nameError && nameChanged && (
                    <StatusBadge tone="pending" variant="dot" label={t("visual.unsaved.badge")} />
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={busy || !nameChanged}
                    aria-busy={busy || undefined}
                    className="action-button action-confirm flex-1 basis-40"
                  >
                    {busy ? (
                      <Loader2 className="motion-safe:animate-spin" aria-hidden />
                    ) : (
                      <Save aria-hidden />
                    )}
                    {t("conta.saveName")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      closeNameForm();
                      setNameError(null);
                      setNameResult(null);
                    }}
                    className="inline-flex min-h-11 flex-1 basis-28 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold transition hover:border-primary/40 disabled:opacity-50"
                  >
                    <X className="size-4" aria-hidden />
                    {t("conta.cancelEdit")}
                  </button>
                </div>
              </form>
            )}
            <ActionResult
              state={nameResult?.state === "saving" ? null : nameResult?.state}
              text={nameResult?.text}
              onRetry={() => void save()}
              onDismiss={() => setNameResult(null)}
              autoHideMs={5000}
            />

            {/* Resumo em selos: cada um leva à seção certa. */}
            <ul aria-label={t("conta.summary")} className="flex flex-wrap gap-x-1.5">
              {whatsBadge && (
                <li>
                  <button
                    type="button"
                    className={chipClass}
                    onClick={() => jumpTo(SECTION.whatsapp)}
                  >
                    <StatusBadge {...whatsBadge} />
                  </button>
                </li>
              )}
              <li>
                <button
                  type="button"
                  className={chipClass}
                  onClick={() => {
                    setLanguageOpen(true);
                    window.setTimeout(() => jumpTo(SECTION.language), 50);
                  }}
                >
                  <StatusBadge
                    tone="neutral"
                    icon={Languages}
                    label={LOCALE_NATIVE_NAMES[locale]}
                  />
                </button>
              </li>
              {privacyCount && (
                <li>
                  <button
                    type="button"
                    className={chipClass}
                    onClick={() => jumpTo(SECTION.privacy)}
                  >
                    <StatusBadge
                      tone="neutral"
                      icon={ShieldCheck}
                      label={t("conta.privacy.count", privacyCount)}
                    />
                  </button>
                </li>
              )}
            </ul>

            {whatsNeedsConfirm && (
              <Notice
                tone="warning"
                role="none"
                title={t("conta.whats.consequence")}
                action={{
                  label: t("conta.attention.confirmWhats"),
                  onClick: () => jumpTo(SECTION.whatsapp),
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Coluna das seções: o que se usa mais primeiro; o raro (senha, sair) por último. */}
      <div className="space-y-5">
        {/* Reserva o lugar do WhatsApp enquanto carrega (a página não pula). */}
        {loading && <LoadingState variant="cards" count={1} hideLabel />}
        {!loading && !error && (
          <WhatsappProfileCard
            id={SECTION.whatsapp}
            demo={Boolean(demo)}
            disabled={busy || !ready}
            initialNumber={whatsapp}
            initialOptIn={whatsappOptIn}
            initialVerified={whatsappVerified}
            onStatusChange={setWhats}
          />
        )}

        {children && (
          <section
            id={SECTION.rhythm}
            aria-labelledby={`${uid}-rhythm`}
            className="app-action-card scroll-mt-24 space-y-4 p-4 sm:p-5"
          >
            <SectionHeader icon={Repeat} id={`${uid}-rhythm`} title={t("rhythm.title")} />
            {children}
          </section>
        )}

        {otherShops.length > 0 && (
          <section
            id={SECTION.shops}
            aria-labelledby={`${uid}-shops`}
            className="app-action-card scroll-mt-24 space-y-3 p-4 sm:p-5"
          >
            <SectionHeader
              icon={Store}
              id={`${uid}-shops`}
              title={t("conta.shops.title")}
              aside={
                <StatusBadge tone="neutral" icon={null} size="sm" label={String(shops.length)} />
              }
            />
            <ul className="divide-y divide-border rounded-2xl border border-border bg-background/60 px-3">
              {shops.map((shop) => {
                const here = shop.id === currentShopId;
                return (
                  <li key={shop.id} className="flex min-h-14 items-center gap-3 py-2">
                    <PersonAvatar name={shop.name} seed={shop.id} size="sm" />
                    <span className="min-w-0 flex-1 break-words text-sm font-semibold">
                      {shop.name}
                    </span>
                    {here ? (
                      <StatusBadge {...STATE.active} size="sm" label={t("conta.shops.here")} />
                    ) : (
                      <a
                        href={customerShopHref(shop.slug)}
                        onClick={(event) => {
                          if (!onOpenShop) return;
                          event.preventDefault();
                          onOpenShop(shop);
                        }}
                        aria-label={t("conta.shops.openAria", { shop: shop.name })}
                        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold transition hover:border-primary/40"
                      >
                        {t("conta.shops.open")}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Idioma recolhido numa linha; abre as opções no próprio lugar. */}
        <section
          id={SECTION.language}
          aria-labelledby={`${uid}-language`}
          className="app-action-card scroll-mt-24 space-y-3 p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-center gap-3">
            <IconTile icon={Languages} />
            {/* Em 320 px o botão desce para a direita em vez de espremer o idioma atual. */}
            <div className="min-w-0 flex-1 basis-28">
              <h3 id={`${uid}-language`} tabIndex={-1} className="text-base font-bold outline-none">
                {t("language.title")}
              </h3>
              <p className="text-sm text-muted-foreground">{LOCALE_NATIVE_NAMES[locale]}</p>
            </div>
            <button
              type="button"
              aria-expanded={languageOpen}
              aria-controls={`${uid}-language-panel`}
              onClick={() => setLanguageOpen((open) => !open)}
              className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold transition hover:border-primary/40"
            >
              {languageOpen ? t("common.close") : t("conta.language.change")}
              <ChevronDown
                className={cn("size-4 transition-transform", languageOpen && "rotate-180")}
                aria-hidden
              />
            </button>
          </div>
          {languageOpen && (
            <div id={`${uid}-language-panel`}>
              <LanguageSettingsCard hideHeading />
            </div>
          )}
        </section>

        <PrivacyCenter
          id={SECTION.privacy}
          onSummary={(on, total) =>
            setPrivacyCount((current) =>
              current?.on === on && current.total === total ? current : { on, total },
            )
          }
        />

        <DataRights id={SECTION.data} />

        <section
          id={SECTION.security}
          aria-labelledby={`${uid}-security`}
          className="app-action-card scroll-mt-24 space-y-4 p-4 sm:p-5"
        >
          <SectionHeader icon={LockKeyhole} id={`${uid}-security`} title={t("conta.security")} />
          {!demo && <ChangePasswordCard collapsible />}
          {signOutButton}
          {signOutError && <Notice tone="danger" title={signOutError} />}
        </section>
      </div>
    </section>
  );
}
