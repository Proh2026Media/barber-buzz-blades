import { useDemo } from "@/features/demo/context";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { currentPush, pushIdentity, PUSH_OWNER } from "@/lib/push-client";
/** A inscrição é deste aparelho e desta sessão. Sair/trocar conta não transfere avisos. */
export function PushAccountGuard() {
  const demo = useDemo();
  useEffect(() => {
    if (demo || window.location.pathname.startsWith("/demo")) return;
    let live = true,
      chain = Promise.resolve();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Fora do callback síncrono do Auth: não manter seu bloqueio durante I/O.
      chain = chain
        .then(async () => {
          if (!live) return;
          const owner = localStorage.getItem(PUSH_OWNER);
          if (!owner || owner === (session ? pushIdentity(session) : null)) return;
          const { subscription: push } = await currentPush();
          if (!live || localStorage.getItem(PUSH_OWNER) !== owner) return;
          await push?.unsubscribe();
          if (localStorage.getItem(PUSH_OWNER) === owner) localStorage.removeItem(PUSH_OWNER);
        })
        .catch(() => {
          /* A sessão é revalidada no servidor antes de qualquer envio. */
        });
    });
    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, [demo]);
  return null;
}
