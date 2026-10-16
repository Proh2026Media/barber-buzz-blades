import { MessageCircle, Repeat, Smartphone, Sparkles } from "lucide-react";
import { CopyField, IconList } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { signupLink, whatsappLink } from "./model";

/**
 * Convite para o cliente do balcão se cadastrar no app da barbearia: sem conta ele não tem
 * horário recorrente, nem pontos, nem como remarcar sozinho. O botão abre o WhatsApp do
 * barbeiro com a mensagem pronta; o link também pode ser copiado.
 */
export function InviteCard({
  whatsappE164,
  clientName,
  shopName,
  publicOrigin,
  context = "booked",
  className,
}: {
  whatsappE164: string | null;
  clientName: string | null;
  shopName: string;
  publicOrigin: string | null;
  /** "booked": logo depois de marcar (cita o horário); "profile": da ficha, sem horário novo. */
  context?: "booked" | "profile";
  className?: string;
}) {
  const { t } = useI18n();
  if (!publicOrigin) return null;
  const link = signupLink(publicOrigin, whatsappE164);
  const message = t(context === "profile" ? "bk.invite.messageProfile" : "bk.invite.message", {
    name: clientName?.split(" ")[0] || t("bk.invite.friend"),
    shop: shopName.trim() || t("bk.invite.shopFallback"),
    link,
  });
  return (
    <section
      className={cn(
        "tone-highlight space-y-3 rounded-2xl border border-[color:var(--tone-border)] bg-[color:var(--tone-soft)] p-4",
        className,
      )}
    >
      <p className="flex items-center gap-2 text-sm font-bold text-foreground">
        <Sparkles className="size-4 shrink-0 text-[color:var(--tone-ink)]" aria-hidden />
        {t("bk.invite.title")}
      </p>
      <IconList
        items={[
          { icon: Repeat, text: t("bk.invite.perkRepeat") },
          { icon: Smartphone, text: t("bk.invite.perkSelf") },
        ]}
      />
      {whatsappE164 && (
        <a
          href={whatsappLink(whatsappE164, message)}
          target="_blank"
          rel="noreferrer"
          className="action-button action-success min-h-11 w-full"
        >
          <MessageCircle aria-hidden />
          {t("bk.invite.send")}
        </a>
      )}
      <CopyField value={link} label={t("bk.invite.copy")} shareTitle={t("bk.invite.title")} />
    </section>
  );
}
