import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

type SessionSource = {
  getSession(): Promise<{ data: { session: Session | null }; error: unknown }>;
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): {
    data: { subscription: { unsubscribe(): void } };
  };
};

/**
 * Acompanha a sessão sem deixar a leitura inicial sobrescrever um evento mais recente.
 * O callback é síncrono: leituras de perfil ficam nos efeitos da tela, fora da trava do Auth.
 */
export function observeSession(
  source: SessionSource,
  onSession: (session: Session | null) => void,
) {
  let active = true;
  let authVersion = 0;
  const { data: listener } = source.onAuthStateChange((_event, session) => {
    authVersion++;
    if (active) onSession(session);
  });
  const versionAtRead = authVersion;

  void (async () => {
    try {
      const { data, error } = await source.getSession();
      if (active && authVersion === versionAtRead) onSession(error ? null : data.session);
    } catch {
      if (active && authVersion === versionAtRead) onSession(null);
    }
  })();

  return () => {
    if (!active) return;
    active = false;
    listener.subscription.unsubscribe();
  };
}
