/**
 * Login com Google no app instalado (PWA): a janela do Google entrega o código pelo banco e o
 * app troca pela sessão. Regras e formatos em `google-relay-model.ts`; migration
 * `20261016120000_retorno_google_app_instalado.sql`.
 */

import { supabase } from "@/integrations/supabase/client";
import { isStandalone } from "@/lib/standalone";
import { platformAuthOrigin } from "./return-origin";
import {
  RELAY_STORAGE_KEY,
  isMissingFunctionError,
  isRelayCode,
  parsePendingRelay,
  relayReturnUrl,
  type PendingRelay,
} from "./google-relay-model";

export type { PendingRelay } from "./google-relay-model";

let availability: Promise<boolean> | null = null;

/**
 * A ponte existe neste banco? (O site publica antes da migration.) Pergunta uma vez por página;
 * falha de rede não conta como "não existe".
 */
export function googleRelayAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      try {
        const { error } = await supabase.rpc("oauth_relay_take", { p_id: crypto.randomUUID() });
        if (!error) return true;
        if (isMissingFunctionError(error)) return false;
        availability = null;
        return true;
      } catch {
        availability = null;
        return false;
      }
    })();
  }
  return availability;
}

/** Usar a ponte: só no app instalado (no navegador comum o Google volta para a mesma aba). */
export function shouldUseGoogleRelay(): boolean {
  return isStandalone();
}

export function readPendingRelay(now = Date.now()): PendingRelay | null {
  if (typeof window === "undefined") return null;
  try {
    const pending = parsePendingRelay(window.localStorage.getItem(RELAY_STORAGE_KEY), now);
    if (!pending) window.localStorage.removeItem(RELAY_STORAGE_KEY);
    return pending;
  } catch {
    return null;
  }
}

export function clearPendingRelay(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(RELAY_STORAGE_KEY);
  } catch {
    /* sem armazenamento: nada a limpar */
  }
}

/**
 * Começa o login: guarda a chave do PKCE (feito pela biblioteca) e a espera no aparelho e abre o
 * Google. No app instalado o sistema abre a janela por cima; esta página fica onde está.
 */
export async function startGoogleRelay(context: { next?: string; shop?: string }): Promise<void> {
  const id = crypto.randomUUID();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: relayReturnUrl(platformAuthOrigin(), id), skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("google_url_missing");
  const pending: PendingRelay = {
    id,
    startedAt: Date.now(),
    ...(context.next ? { next: context.next } : {}),
    ...(context.shop ? { shop: context.shop } : {}),
  };
  window.localStorage.setItem(RELAY_STORAGE_KEY, JSON.stringify(pending));
  window.location.assign(data.url);
}

export type RelayCheck = "signed-in" | "waiting" | "failed";

/**
 * Confere se o login terminou: retira o código (uma vez só) e troca pela sessão. Se a janela
 * dividiu o armazenamento com o app (alguns aparelhos), a sessão já está aqui.
 */
export async function checkGoogleRelay(pending: PendingRelay): Promise<RelayCheck> {
  const { data: current } = await supabase.auth.getSession();
  if (current.session) {
    clearPendingRelay();
    return "signed-in";
  }
  const { data: code, error } = await supabase.rpc("oauth_relay_take", { p_id: pending.id });
  if (error) return "waiting";
  if (!isRelayCode(code)) {
    if (failureRelayMissing) return "waiting";
    const { data: failed, error: failureError } = await supabase.rpc("oauth_relay_failure_take", {
      p_id: pending.id,
    });
    if (isMissingFunctionError(failureError)) failureRelayMissing = true;
    if (!failureError && failed === true) {
      clearPendingRelay();
      return "failed";
    }
    return "waiting";
  }
  const { data: exchanged, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  clearPendingRelay();
  if (exchangeError || !exchanged.session) return "failed";
  return "signed-in";
}

/** Janela do Google: entrega o código ao app. Devolve se deu certo. */
export async function deliverGoogleRelayCode(relayId: string, code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("oauth_relay_put", { p_id: relayId, p_code: code });
  return !error && data === true;
}

// Compatibilidade com o banco anterior: o login continua sem o aviso antecipado de falha.
let failureRelayMissing = false;
export async function deliverGoogleRelayFailure(relayId: string): Promise<void> {
  try {
    await supabase.rpc("oauth_relay_failure_put", { p_id: relayId });
  } catch {
    /* A janela continua mostrando o erro, mesmo sem rede ou migration. */
  }
}
