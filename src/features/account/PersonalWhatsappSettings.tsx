import { useEffect, useState, type RefObject } from "react";
import type { Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { Notice } from "@/components/visual";
import { WhatsappProfileCard, type WhatsappStatus } from "@/features/customer/WhatsappProfileCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/lib/auth/use-auth-session";
import { useI18n } from "@/lib/i18n";

/** Cadastro pessoal: usa a confirmação existente, sem vínculo com loja ou número do sistema. */
export function PersonalWhatsappSettings({ userId }: { userId: string }) {
  const { t } = useI18n();
  const { session, currentSession, loading, retry } = useAuthSession();
  if (loading) return <LoadingProfile />;
  if (session?.user.id !== userId) {
    return (
      <Notice
        tone="warning"
        title={t("errors.sessionExpired")}
        action={{ label: t("common.retry"), onClick: retry }}
      />
    );
  }
  return <AccountWhatsapp key={userId} userId={userId} currentSession={currentSession} />;
}

function LoadingProfile() {
  const { t } = useI18n();
  return (
    <p
      role="status"
      className="flex min-h-20 items-center justify-center gap-2 text-sm text-muted-foreground"
    >
      <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
      {t("profile.loading")}
    </p>
  );
}

function AccountWhatsapp({
  userId,
  currentSession,
}: {
  userId: string;
  currentSession: RefObject<Session | null>;
}) {
  const { t } = useI18n();
  const [profile, setProfile] = useState<WhatsappStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const isCurrent = () => active && currentSession.current?.user.id === userId;
    setProfile(null);
    setFailed(false);
    async function load() {
      try {
        const session = currentSession.current;
        if (session?.user.id !== userId) return;
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single()
          .setHeader("Authorization", `Bearer ${session.access_token}`);
        if (!isCurrent()) return;
        // Não tratar falha de leitura ou banco incompleto como cadastro vazio/confirmado.
        if (error || !data || !("whatsapp_verified_at" in data))
          throw new Error("perfil_indisponivel");
        setProfile({
          number: data.whatsapp_e164 ?? "",
          verified: Boolean(data.whatsapp_e164 && data.whatsapp_verified_at),
          optIn: Boolean(data.whatsapp_opt_in_at),
        });
      } catch {
        if (isCurrent()) setFailed(true);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [userId, currentSession, attempt]);

  if (failed) {
    return (
      <Notice
        tone="warning"
        title={t("account.whatsapp.loadError")}
        action={{ label: t("common.retry"), onClick: () => setAttempt((value) => value + 1) }}
      />
    );
  }
  if (!profile) return <LoadingProfile />;
  return (
    <WhatsappProfileCard
      userId={userId}
      accountSession={currentSession}
      demo={false}
      disabled={false}
      initialNumber={profile.number}
      initialVerified={profile.verified}
      initialOptIn={profile.optIn}
      bare
      loginOnly
    />
  );
}
