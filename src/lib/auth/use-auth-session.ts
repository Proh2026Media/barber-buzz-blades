import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { observeSession } from "./observe-session";

/** Sessão viva das janelas de entrada; a referência também protege ações antes do render. */
export function useAuthSession(disabled = false) {
  const [snapshot, setSnapshot] = useState<{ session: Session | null }>({ session: null });
  const currentSession = useRef<Session | null>(null);

  useEffect(() => {
    currentSession.current = null;
    setSnapshot({ session: null });
    if (disabled) return;
    const stop = observeSession(supabase.auth, (session) => {
      currentSession.current = session;
      // Alguns eventos mantêm o objeto da sessão: o invólucro novo também atualiza a tela.
      setSnapshot({ session });
    });
    return () => {
      stop();
      currentSession.current = null;
    };
  }, [disabled]);

  return { session: disabled ? null : snapshot.session, currentSession };
}
